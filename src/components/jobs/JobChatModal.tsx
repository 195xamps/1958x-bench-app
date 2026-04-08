import React from 'react';
import { View, Text, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatAmpName } from '../../utils';
import { MessageList, ChatInput } from '../chat';
import type { ChatMessage, JobWithProfile } from '../../types';

interface Props {
  visible: boolean;
  job: JobWithProfile | null;
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onClose: () => void;
  onChangeInput: (text: string) => void;
  onSend: () => void;
}

export function JobChatModal({
  visible,
  job,
  messages,
  input,
  sending,
  onClose,
  onChangeInput,
  onSend,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={28} color={colors.accent} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>
            {formatAmpName(job?.ampProfile)} Chat
          </Text>
          <View style={{ width: 28 }} />
        </View>
        <MessageList
          messages={messages}
          sending={sending}
          assistantName="Job Assistant"
          emptyContent={
            <View style={s.welcome}>
              <Ionicons name="hardware-chip" size={48} color={colors.accent} />
              <Text style={s.welcomeTitle}>Job Assistant</Text>
              <Text style={s.welcomeText}>
                Ask questions specific to this job. The assistant knows the amp details and can help troubleshoot.
              </Text>
            </View>
          }
        />
        <ChatInput
          value={input}
          onChangeText={onChangeInput}
          onSend={onSend}
          sending={sending}
          placeholder="Ask about this amp..."
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  title: { color: colors.text.bright, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  welcome: { alignItems: 'center', paddingVertical: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.accent, marginTop: 16, marginBottom: 8 },
  welcomeText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
});
