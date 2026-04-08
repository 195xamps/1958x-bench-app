import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Curated technical vocabulary that biases the recognizer toward amp-shop
// terminology. Recognizers use these as "contextual strings" to weight
// homophones in our favor (e.g. "plate" the tube node vs "plate" the dish).
const AMP_VOCAB = [
  // Basic electronics
  'amp', 'amplifier', 'tube', 'valve', 'capacitor', 'cap', 'resistor',
  'transformer', 'choke', 'rectifier', 'diode', 'transistor',
  // Measurement terms
  'voltage', 'current', 'resistance', 'continuity', 'ohms', 'volts',
  'amps', 'milliamps', 'AC', 'DC', 'B+', 'bias', 'idle current',
  // Tube nodes
  'plate', 'cathode', 'grid', 'screen', 'heater', 'filament',
  'pin one', 'pin two', 'pin three', 'pin four', 'pin five',
  'pin six', 'pin seven', 'pin eight', 'pin nine',
  // Amp sections
  'preamp', 'power amp', 'phase inverter', 'tone stack', 'reverb',
  'tremolo', 'vibrato', 'output transformer', 'filter cap', 'coupling cap',
  // Brands and models
  'Fender', 'Marshall', 'Vox', 'Mesa', 'Boogie', 'Gibson', 'Ampeg',
  'Deluxe Reverb', 'Twin Reverb', 'Princeton', 'Champ', 'Bassman',
  'Super Reverb', 'JCM800', 'Plexi', 'AC30', 'Bandmaster',
  // Tube types
  '12AX7', '12AT7', '12AU7', '6V6', '6L6', 'EL34', 'EL84', '5U4', '5Y3', 'GZ34',
  // Eras / circuits
  'blackface', 'silverface', 'tweed', 'brownface', 'AB763', 'AA864',
  '5E3', '5F1', '5F6A', '5F8', '6G15',
];

interface UseSpeechToTextOptions {
  /** Read the latest input value at the moment recording starts. Use a
   *  callback rather than passing the value directly so the hook always
   *  sees the freshest text without re-subscribing to events on every
   *  keystroke. */
  getCurrentValue: () => string;
  /** Called whenever the recognized transcript updates (interim or final). */
  onUpdate: (newValue: string) => void;
  /** Called with a friendly error message on recognition failures. */
  onError?: (message: string) => void;
}

export interface UseSpeechToTextResult {
  recording: boolean;
  toggle: () => Promise<void>;
  stop: () => void;
}

/**
 * Voice → text input hook. Wraps expo-speech-recognition with sane defaults
 * for a hands-busy bench use case:
 * - Append mode: dictation gets inserted at the end of the existing input
 * - Continuous: lets the user speak in pauses without auto-stopping
 * - Interim results: shows transcribed text live as you talk
 * - Amp vocabulary bias: better accuracy on technical terms
 */
export function useSpeechToText({
  getCurrentValue,
  onUpdate,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [recording, setRecording] = useState(false);

  // Refs that survive re-renders without re-subscribing event listeners.
  const baselineRef = useRef('');
  const getValueRef = useRef(getCurrentValue);
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);

  // Keep the latest callbacks in refs so the event handlers always read fresh ones.
  useEffect(() => {
    getValueRef.current = getCurrentValue;
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  });

  useSpeechRecognitionEvent('start', () => {
    setRecording(true);
    // Snapshot the input so subsequent transcript updates can be appended
    // to a stable baseline rather than colliding with prior interim text.
    baselineRef.current = getValueRef.current();
  });

  useSpeechRecognitionEvent('end', () => {
    setRecording(false);
  });

  useSpeechRecognitionEvent('result', (event: { results: Array<{ transcript?: string }> }) => {
    const transcript = event.results[0]?.transcript || '';
    if (!transcript) return;
    const baseline = baselineRef.current;
    const sep = baseline && !baseline.endsWith(' ') ? ' ' : '';
    onUpdateRef.current(baseline + sep + transcript);
  });

  useSpeechRecognitionEvent('error', (event: { error: string; message?: string }) => {
    console.warn('[speech] error:', event.error, event.message);
    setRecording(false);
    // Surface the raw code in the friendly message during development so
    // we can diagnose when the recognizer refuses to start. Once we know
    // the codes that show up in practice, we can tighten this back up.
    const friendly = errorToFriendly(event.error);
    const detail = event.message ? ` (${event.message})` : '';
    onErrorRef.current?.(`${friendly} [code: ${event.error || 'unknown'}]${detail}`);
  });

  const toggle = useCallback(async () => {
    if (recording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      onErrorRef.current?.('Voice input is only available on mobile.');
      return;
    }

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      onErrorRef.current?.('Voice permission denied. Enable Microphone and Speech Recognition for 195x Bench in Settings.');
      return;
    }

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: AMP_VOCAB,
      });
    } catch (e: any) {
      console.warn('[speech] start() threw:', e);
      setRecording(false);
      onErrorRef.current?.(`Voice failed to start: ${e?.message || String(e)}`);
    }
  }, [recording]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { recording, toggle, stop };
}

function errorToFriendly(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'permission-denied':
      return 'Voice permission denied. Enable Microphone and Speech Recognition for 195x Bench in Settings.';
    case 'no-speech':
      return 'No speech detected. Try again and speak clearly.';
    case 'network':
      return 'Network error during speech recognition. Try again.';
    case 'audio-capture':
      return 'Could not access the microphone.';
    case 'service-not-allowed':
      return 'Speech recognition service is unavailable on this device.';
    default:
      return 'Voice input failed. Try again.';
  }
}
