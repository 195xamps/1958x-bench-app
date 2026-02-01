import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = '';

interface Chat {
  id: string;
  title: string;
  benchJobId: string | null;
  isStandalone: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface BenchJob {
  id: string;
  status: string;
  ownerSymptoms: string;
  techNotes: string;
  safetyChecklistCompleted: boolean;
  createdAt: string;
}

export default function DashboardScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (showChatModal) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, showChatModal]);

  const fetchChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chats`);
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/chats`, {
        title: 'New Chat',
      });
      const newChat = response.data;
      setChats([newChat, ...chats]);
      openChat(newChat);
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create new chat');
    }
  };

  const openChat = async (chat: Chat) => {
    setActiveChat(chat);
    setShowChatModal(true);
    try {
      const response = await axios.get(`${API_URL}/api/chats/${chat.id}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat || sending) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    const tempUserMessage: ChatMessage = {
      id: 'temp-user',
      chatId: activeChat.id,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await axios.post(`${API_URL}/api/chats/${activeChat.id}/messages`, {
        content: messageText,
      });
      
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'temp-user'),
        response.data.userMessage,
        response.data.assistantMessage,
      ]);

      if (messages.length === 0 && messageText.length > 30) {
        const autoTitle = messageText.substring(0, 30) + '...';
        await renameChat(activeChat.id, autoTitle);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const renameChat = async (chatId: string, title: string) => {
    try {
      await axios.patch(`${API_URL}/api/chats/${chatId}`, { title });
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title } : c))
      );
      if (activeChat?.id === chatId) {
        setActiveChat({ ...activeChat, title });
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/chats/${chatId}`);
            setChats((prev) => prev.filter((c) => c.id !== chatId));
            setShowOptionsModal(false);
            if (activeChat?.id === chatId) {
              setShowChatModal(false);
              setActiveChat(null);
            }
          } catch (error) {
            console.error('Error deleting chat:', error);
            Alert.alert('Error', 'Failed to delete chat');
          }
        },
      },
    ]);
  };

  const convertToJob = async (chat: Chat) => {
    try {
      const response = await axios.post(`${API_URL}/api/chats/${chat.id}/convert-to-job`);
      Alert.alert(
        'Job Created',
        'This chat has been converted to a bench job. You can now fill in the amp details.',
        [{ text: 'OK' }]
      );
      setChats((prev) =>
        prev.map((c) =>
          c.id === chat.id ? { ...c, benchJobId: response.data.benchJob.id, isStandalone: false } : c
        )
      );
      setShowOptionsModal(false);
    } catch (error: any) {
      console.error('Error converting to job:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to convert chat to job');
    }
  };

  const handleLongPress = (chat: Chat) => {
    setSelectedChat(chat);
    setShowOptionsModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>195X Bench App</Text>
          <Text style={styles.subtitle}>Guitar Amp Troubleshooting Assistant</Text>
        </View>

        <TouchableOpacity style={styles.newChatButton} onPress={createNewChat}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#1f2937" />
          <Text style={styles.newChatButtonText}>Start New Chat</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Recent Chats</Text>

        {chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>
              Start a new chat to ask questions about amp repair
            </Text>
          </View>
        ) : (
          chats.map((chat) => (
            <View key={chat.id} style={styles.chatCard}>
              <TouchableOpacity
                style={styles.chatCardContent}
                onPress={() => openChat(chat)}
              >
                <View style={styles.chatCardHeader}>
                  <Ionicons
                    name={chat.benchJobId ? 'briefcase' : 'chatbubble-ellipses'}
                    size={20}
                    color="#f59e0b"
                  />
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {chat.title}
                  </Text>
                </View>
                <Text style={styles.chatDate}>{formatDate(chat.updatedAt)}</Text>
                {chat.benchJobId && (
                  <View style={styles.linkedBadge}>
                    <Text style={styles.linkedBadgeText}>Linked to Job</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatOptionsButton}
                onPress={() => handleLongPress(chat)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showChatModal} animationType="slide">
        <KeyboardAvoidingView
          style={styles.chatModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatModalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowChatModal(false);
                setActiveChat(null);
                setMessages([]);
                fetchChats();
              }}
            >
              <Ionicons name="arrow-back" size={28} color="#f59e0b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chatTitleButton}
              onPress={() => {
                setNewTitle(activeChat?.title || '');
                setShowRenameModal(true);
              }}
            >
              <Text style={styles.chatModalTitle} numberOfLines={1}>
                {activeChat?.title}
              </Text>
              <Ionicons name="pencil" size={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (activeChat) {
                  setSelectedChat(activeChat);
                  setShowOptionsModal(true);
                }
              }}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.length === 0 && (
              <View style={styles.welcomeContainer}>
                <Ionicons name="hardware-chip" size={48} color="#f59e0b" />
                <Text style={styles.welcomeTitle}>Bench Assistant</Text>
                <Text style={styles.welcomeText}>
                  Ask me anything about guitar amp repair, troubleshooting, or your past jobs and schematics.
                </Text>
                <View style={styles.exampleQuestions}>
                  <Text style={styles.exampleTitle}>Try asking:</Text>
                  <Text style={styles.exampleText}>• "How do I test for leaky caps?"</Text>
                  <Text style={styles.exampleText}>• "What causes red plating on tubes?"</Text>
                  <Text style={styles.exampleText}>• "Have I worked on a Fender amp before?"</Text>
                  <Text style={styles.exampleText}>• "Show me schematics for Vox AC30"</Text>
                </View>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}
              >
                {message.role === 'assistant' && (
                  <View style={styles.assistantHeader}>
                    <Ionicons name="hardware-chip" size={18} color="#f59e0b" />
                    <Text style={styles.assistantLabel}>Bench Assistant</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            ))}

            {sending && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text style={styles.typingText}>Thinking...</Text>
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
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={22} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showRenameModal} transparent animationType="fade">
        <View style={styles.renameModalOverlay}>
          <View style={styles.renameModalContent}>
            <Text style={styles.renameModalTitle}>Rename Chat</Text>
            <TextInput
              style={styles.renameInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter chat name"
              placeholderTextColor="#6b7280"
              autoFocus
            />
            <View style={styles.renameModalButtons}>
              <TouchableOpacity
                style={styles.renameModalCancel}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.renameModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameModalSave}
                onPress={() => {
                  if (activeChat && newTitle.trim()) {
                    renameChat(activeChat.id, newTitle.trim());
                    setShowRenameModal(false);
                  }
                }}
              >
                <Text style={styles.renameModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showOptionsModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.optionsModalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsModalContent}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                if (selectedChat) {
                  setNewTitle(selectedChat.title);
                  setShowOptionsModal(false);
                  setShowRenameModal(true);
                  if (!activeChat) {
                    setActiveChat(selectedChat);
                  }
                }
              }}
            >
              <Ionicons name="pencil" size={22} color="#e5e7eb" />
              <Text style={styles.optionText}>Rename</Text>
            </TouchableOpacity>

            {selectedChat && !selectedChat.benchJobId && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => selectedChat && convertToJob(selectedChat)}
              >
                <Ionicons name="briefcase" size={22} color="#e5e7eb" />
                <Text style={styles.optionText}>Convert to Job</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemDanger]}
              onPress={() => selectedChat && deleteChat(selectedChat.id)}
            >
              <Ionicons name="trash" size={22} color="#ef4444" />
              <Text style={[styles.optionText, styles.optionTextDanger]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 24,
  },
  newChatButtonText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  chatCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatCardContent: {
    flex: 1,
    padding: 16,
  },
  chatOptionsButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  chatTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  chatDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  linkedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#065f46',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  linkedBadgeText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '600',
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    backgroundColor: '#1f2937',
  },
  chatTitleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
  },
  chatModalTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  exampleQuestions: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  exampleTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  exampleText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f59e0b',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assistantLabel: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#1f2937',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  typingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#1f2937',
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameModalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  renameModalTitle: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  renameModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  renameModalCancel: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  renameModalCancelText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  renameModalSave: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  renameModalSaveText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  optionsModalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  optionItemDanger: {
    borderBottomWidth: 0,
  },
  optionText: {
    color: '#e5e7eb',
    fontSize: 16,
  },
  optionTextDanger: {
    color: '#ef4444',
  },
});
