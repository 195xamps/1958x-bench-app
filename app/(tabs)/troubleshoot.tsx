import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { troubleshootingApi } from '../../src/services';
import { colors } from '../../src/theme';
import type { TroubleshootingMessage } from '../../src/types';
import { MarkdownContent } from '../../src/components/MarkdownContent';
import { ChatInput } from '../../src/components/chat';

// ─── Constants ──────────────────────────────────────────────────────────────

const COMMON_SYMPTOMS = [
  'Hum after recap',
  'No sound at all',
  'Red plating on tubes',
  'Motorboating',
  'Volume drop',
  'Reverb not working',
  'Tremolo weak',
  'Fuse blows',
  'Scratchy pots',
  'Pops on standby toggle',
];

const WELCOME_MESSAGE: TroubleshootingMessage = {
  role: 'assistant',
  content:
    "I'm your troubleshooting assistant for the 195x Bench App. I'll guide you through diagnosing and repairing guitar amplifiers safely and methodically.\n\n" +
    '**SAFETY FIRST**: Before we begin any high-voltage work, please confirm:\n' +
    '- Isolation transformer is connected\n' +
    '- Capacitors are discharged\n' +
    '- PPE is available\n\n' +
    'Describe the symptom you\'re experiencing, or select one from the common issues above to get started.',
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TroubleshootScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TroubleshootingMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'guided' | 'expert'>('guided');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // ─── Session Management ─────────────────────────────────────────────────

  const startSession = async (symptom?: string) => {
    setLoading(true);
    try {
      const data = await troubleshootingApi.start({ mode });
      setSessionId(data.id);

      if (symptom) {
        await sendMessageToSession(symptom, data.id);
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (error: any) {
      console.error('Error starting session:', error);
      const msg = error?.response?.data?.error || 'Failed to start session. Check your connection and try again.';
      setMessages([{ role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setSessionId(null);
    setMessages([]);
  };

  // ─── Messaging ──────────────────────────────────────────────────────────

  const sendMessageToSession = async (text: string, sid: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const data = await troubleshootingApi.chat({
        sessionId: sid,
        message: text,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'I encountered an error. Please try again or rephrase your question.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    if (!sessionId) {
      await startSession(text);
    } else {
      await sendMessageToSession(text, sessionId);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="pulse" size={26} color={colors.accent} />
        <Text style={styles.headerTitle}>Diagnose</Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'guided' && styles.modeButtonActive]}
          onPress={() => !sessionId && setMode('guided')}
          disabled={!!sessionId}
        >
          <Ionicons name="list" size={18} color={mode === 'guided' ? colors.text.onAccent : colors.text.secondary} />
          <View>
            <Text style={[styles.modeButtonText, mode === 'guided' && styles.modeButtonTextActive]}>Guided</Text>
            <Text style={[styles.modeButtonSubtext, mode === 'guided' && styles.modeButtonSubtextActive]}>Step-by-step</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'expert' && styles.modeButtonActive]}
          onPress={() => !sessionId && setMode('expert')}
          disabled={!!sessionId}
        >
          <Ionicons name="flash" size={18} color={mode === 'expert' ? colors.text.onAccent : colors.text.secondary} />
          <View>
            <Text style={[styles.modeButtonText, mode === 'expert' && styles.modeButtonTextActive]}>Expert</Text>
            <Text style={[styles.modeButtonSubtext, mode === 'expert' && styles.modeButtonSubtextActive]}>Direct &amp; technical</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && !sessionId && (
          <WelcomePanel onSelectSymptom={(s) => startSession(s)} />
        )}

        {messages.map((msg, index) => (
          <View
            key={index}
            style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.assistantHeader}>
                <Ionicons name="hardware-chip" size={18} color={colors.accent} />
                <Text style={styles.assistantLabel}>Bench Assistant</Text>
              </View>
            )}
            {msg.role === 'user' ? (
              <Text style={styles.userText}>{msg.content}</Text>
            ) : (
              <MarkdownContent content={msg.content} />
            )}
          </View>
        ))}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Analyzing...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        sending={loading}
        placeholder="Describe the issue or ask a question..."
      />

      {/* New Session */}
      {sessionId && (
        <TouchableOpacity style={styles.newSessionButton} onPress={resetSession}>
          <Ionicons name="refresh" size={16} color={colors.text.secondary} />
          <Text style={styles.newSessionText}>New Session</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Welcome Panel ──────────────────────────────────────────────────────────

function WelcomePanel({ onSelectSymptom }: { onSelectSymptom: (symptom: string) => void }) {
  return (
    <View style={styles.welcomeContainer}>
      <Ionicons name="build" size={48} color={colors.accent} />
      <Text style={styles.welcomeTitle}>Troubleshooting Assistant</Text>
      <Text style={styles.welcomeText}>
        Select a common symptom or describe the issue you&apos;re experiencing
      </Text>

      <View style={styles.symptomsGrid}>
        {COMMON_SYMPTOMS.map((symptom, index) => (
          <TouchableOpacity
            key={index}
            style={styles.symptomChip}
            onPress={() => onSelectSymptom(symptom)}
          >
            <Text style={styles.symptomChipText}>{symptom}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.bg.surface,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.accent,
    fontFamily: 'Jost-Bold',
  },
  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.bg.surface,
  },
  modeButtonActive: { backgroundColor: colors.accent },
  modeButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: { color: colors.text.onAccent },
  modeButtonSubtext: {
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 1,
  },
  modeButtonSubtextActive: { color: colors.text.onAccent + 'cc' },
  // Messages
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16 },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.surface,
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assistantLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  userText: {
    color: colors.text.onAccent,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.accent,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Jost-Bold',
  },
  welcomeText: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  symptomChip: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  symptomChipText: {
    color: colors.text.bright,
    fontSize: 14,
  },
  // New session
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: colors.bg.surface,
  },
  newSessionText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
});
