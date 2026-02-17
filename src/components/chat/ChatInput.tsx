import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

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

  return (
    <View style={styles.container}>
      {onAttach && (
        <TouchableOpacity
          style={styles.attachButton}
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
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
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
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
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
