import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { MarkdownContent } from '../components/MarkdownContent';
import { useAuth } from '../contexts/AuthContext';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

interface Chat {
  id: string;
  title: string;
  userId: string | null;
  benchJobId: string | null;
  isStandalone: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  createdAt: string;
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) {
      fetchChat();
    }
  }, [id]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const fetchChat = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/chats/${id}`, { withCredentials: true });
      setChat(response.data);
      setMessages(response.data.messages || []);
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

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const messageContent = input.trim();
    setInput('');
    setSending(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/chats/${id}/messages`,
        { content: messageContent },
        { withCredentials: true }
      );
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error sending message:', error);
      setInput(messageContent);
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderAttachment = (attachment: Attachment, index: number) => {
    if (attachment.type === 'image') {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.open(attachment.url, '_blank');
            } else {
              Linking.openURL(attachment.url);
            }
          }}
        >
          <Image source={{ uri: attachment.url }} style={styles.attachmentImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        key={index}
        style={styles.pdfAttachment}
        onPress={() => {
          if (Platform.OS === 'web') {
            window.open(attachment.url, '_blank');
          } else {
            Linking.openURL(attachment.url);
          }
        }}
      >
        <Ionicons name="document" size={24} color="#f59e0b" />
        <Text style={styles.pdfName} numberOfLines={1}>
          {attachment.name || 'Document'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chat?.title || 'Chat'}
          </Text>
          {chat?.userId && user?.isAdmin && chat.userId !== user.id && (
            <Text style={styles.ownerBadge}>Viewing as Admin</Text>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyChatText}>No messages yet</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  {msg.attachments.map((att, idx) => renderAttachment(att, idx))}
                </View>
              )}
              {msg.role === 'assistant' ? (
                <MarkdownContent content={msg.content} />
              ) : (
                <Text style={styles.messageText}>{msg.content}</Text>
              )}
              <Text style={styles.timestamp}>{formatTimestamp(msg.createdAt)}</Text>
            </View>
          ))
        )}
        {sending && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#f59e0b" />
            <Text style={styles.thinkingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about amp repair..."
          placeholderTextColor="#6b7280"
          multiline
          maxLength={4000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color={input.trim() && !sending ? '#f59e0b' : '#6b7280'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6',
  },
  ownerBadge: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyChatText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#374151',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  messageText: {
    color: '#f3f4f6',
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  thinkingText: {
    color: '#9ca3af',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  attachmentsContainer: {
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
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  pdfName: {
    color: '#f3f4f6',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f3f4f6',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#374151',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
