import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { chatsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import type { Chat, ChatMessage } from '../../src/types';
import { LoadingScreen, EmptyState } from '../../src/components/shared';
import { MessageList, ChatInput } from '../../src/components/chat';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [sendingText, setSendingText] = useState('Thinking...');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // ─── Data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (id) fetchChat();
    return () => { abortRef.current?.(); };
  }, [id]);

  const fetchChat = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatsApi.get(id!);
      setChat(data.chat);
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error('Error fetching chat:', err);
      if (err.response?.status === 403) {
        setError('Access denied - you do not have permission to view this chat');
      } else if (err.response?.status === 404) {
        setError('Chat not found');
      } else {
        setError('Failed to load chat');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Send ───────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const messageContent = input.trim();
    setInput('');
    setSending(true);
    setStreamingText('');
    setSendingText('Thinking...');

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: 'temp-user',
      chatId: id!,
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const { promise, abort } = chatsApi.streamMessage(
        id!,
        messageContent,
        (token) => {
          setStreamingText(prev => prev + token);
        },
        undefined,
        (status) => { if (status) setSendingText(status); },
      );
      abortRef.current = abort;

      const data = await promise;
      abortRef.current = null;

      // Replace temp message and add final messages
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp-user'),
        data.userMessage,
        data.assistantMessage,
      ]);
      setStreamingText('');
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
      setInput(messageContent);
      setStreamingText('');
    } finally {
      setSending(false);
    }
  };

  // ─── Render: Loading ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Loading..." onBack={() => router.back()} />
        <LoadingScreen />
      </View>
    );
  }

  // ─── Render: Error ──────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Error" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render: Chat ───────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Header
        title={chat?.title || 'Chat'}
        onBack={() => router.back()}
        badge={
          chat?.userId && user?.isAdmin && chat.userId !== user.id
            ? 'Viewing as Admin'
            : undefined
        }
      />

      <MessageList
        messages={messages}
        sending={sending}
        streamingText={streamingText}
        sendingText={sendingText}
        showAssistantLabel={false}
        emptyContent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            subtitle="Start the conversation below"
          />
        }
      />

      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={sendMessage}
        sending={sending}
        maxLength={4000}
        placeholder="Ask about amp repair..."
      />
    </KeyboardAvoidingView>
  );
}

// ─── Header Sub-Component ───────────────────────────────────────────────────

function Header({
  title,
  onBack,
  badge,
}: {
  title: string;
  onBack: () => void;
  badge?: string;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.accent} />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {badge && <Text style={styles.ownerBadge}>{badge}</Text>}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  ownerBadge: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.text.onAccent,
    fontWeight: '600',
  },
});
