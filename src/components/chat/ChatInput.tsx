import React, { useEffect, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { useSpeechToText } from '../../hooks';
import { showError } from '../../utils';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  sending?: boolean;
  uploading?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Extra condition beyond input.trim() for enabling send */
  canSend?: boolean;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onAttach,
  sending = false,
  uploading = false,
  placeholder = 'Ask about amp repair...',
  maxLength = 2000,
  canSend = true,
}: ChatInputProps) {
  const sendDisabled = (!value.trim() && canSend) || sending || !canSend;

  // Voice input — appends to the existing value when the user dictates
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; });

  const getCurrentValue = useCallback(() => valueRef.current, []);
  const { recording, toggle: toggleVoice } = useSpeechToText({
    getCurrentValue,
    onUpdate: onChangeText,
    onError: showError,
  });

  // Pulsing red dot animation while recording
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  return (
    <View style={styles.container}>
      {onAttach && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onAttach}
          disabled={sending || uploading}
        >
          <Ionicons
            name="camera"
            size={24}
            color={sending || uploading ? colors.text.muted : colors.accent}
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.iconButton}
        onPress={toggleVoice}
        disabled={sending}
        accessibilityLabel={recording ? 'Stop voice input' : 'Start voice input'}
      >
        <Animated.View style={{ opacity: recording ? pulse : 1 }}>
          <Ionicons
            name={recording ? 'mic' : 'mic-outline'}
            size={24}
            color={recording ? colors.status.error : sending ? colors.text.muted : colors.accent}
          />
        </Animated.View>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={recording ? 'Listening…' : placeholder}
        placeholderTextColor={colors.text.muted}
        multiline
        maxLength={maxLength}
        editable={!sending}
      />
      <TouchableOpacity
        style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={sendDisabled}
      >
        <Ionicons name="send" size={22} color={colors.text.onAccent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  iconButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
