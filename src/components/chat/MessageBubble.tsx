import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarkdownContent } from '../MarkdownContent';
import { formatTimestamp, openUrl } from '../../utils';
import { colors } from '../../theme';
import type { ChatMessage, Attachment } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  showAssistantLabel?: boolean;
  assistantName?: string;
}

function renderAttachment(attachment: Attachment, index: number) {
  if (attachment.type === 'image') {
    return (
      <TouchableOpacity key={index} onPress={() => openUrl(attachment.url)}>
        <Image source={{ uri: attachment.url }} style={styles.attachmentImage} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      key={index}
      style={styles.pdfAttachment}
      onPress={() => openUrl(attachment.url)}
    >
      <Ionicons name="document-text" size={24} color={colors.accent} />
      <Text style={styles.pdfText} numberOfLines={1}>
        {attachment.name || 'PDF Document'}
      </Text>
      <Ionicons name="open-outline" size={18} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

export const MessageBubble = React.memo(function MessageBubble({ message, showAssistantLabel = true, assistantName = 'Bench Assistant' }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      {!isUser && showAssistantLabel && (
        <View style={styles.assistantHeader}>
          <Ionicons name="hardware-chip" size={18} color={colors.accent} />
          <Text style={styles.assistantLabel}>{assistantName}</Text>
        </View>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <View style={styles.attachments}>
          {message.attachments.map((att, idx) => renderAttachment(att, idx))}
        </View>
      )}

      {message.content ? (
        isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <MarkdownContent content={message.content} />
        )
      ) : null}

      {message.createdAt && (
        <Text style={styles.timestamp}>{formatTimestamp(message.createdAt)}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
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
  timestamp: {
    color: colors.text.secondary,
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  attachments: {
    marginBottom: 8,
    gap: 8,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  pdfAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pdfText: {
    color: colors.text.bright,
    fontSize: 14,
    flex: 1,
  },
});
