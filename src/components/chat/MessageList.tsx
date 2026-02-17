import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MessageBubble } from './MessageBubble';
import { colors } from '../../theme';
import type { ChatMessage } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  sending?: boolean;
  sendingText?: string;
  showAssistantLabel?: boolean;
  assistantName?: string;
  emptyContent?: React.ReactNode;
  contentContainerStyle?: any;
}

export function MessageList({
  messages,
  sending = false,
  sendingText = 'Thinking...',
  showAssistantLabel = true,
  assistantName,
  emptyContent,
  contentContainerStyle,
}: MessageListProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Small delay to ensure layout is complete before scrolling
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {messages.length === 0 && emptyContent}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          showAssistantLabel={showAssistantLabel}
          assistantName={assistantName}
        />
      ))}

      {sending && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.typingText}>{sendingText}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  typingText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
