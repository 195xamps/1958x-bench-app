import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Pressable as GHPressable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

import { chatsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { showAlert, showConfirm, showError, openUrl } from '../../src/utils';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFileUpload } from '../../src/hooks/useFileUpload';
import type { Chat, ChatMessage } from '../../src/types';
import { LoadingScreen, EmptyState } from '../../src/components/shared';
import { MessageList } from '../../src/components/chat';
import {
  AttachmentPickerModal,
  showAttachmentOptions,
  AttachmentPreview,
} from '../../src/components/chat';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat modal state
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // Sub-modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // File upload hook
  const {
    uploading,
    pendingAttachments,
    pickImage,
    pickDocument,
    removeAttachment,
    clearAttachments,
  } = useFileUpload();

  // ─── Data ───────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => { fetchChats(); }, []));

  const fetchChats = async () => {
    try {
      const data = await chatsApi.list();
      setChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Chat Actions ───────────────────────────────────────────────────────

  const createNewChat = async () => {
    try {
      const newChat = await chatsApi.create({ title: 'New Chat' });
      setChats([newChat, ...chats]);
      openChatModal(newChat);
    } catch (error) {
      console.error('Error creating chat:', error);
      showError('Failed to create new chat');
    }
  };

  const openChatModal = async (chat: Chat) => {
    setActiveChat(chat);
    setShowChatModal(true);
    clearAttachments();
    try {
      const data = await chatsApi.get(chat.id);
      setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  };

  const closeChat = () => {
    setShowChatModal(false);
    setActiveChat(null);
    setMessages([]);
    fetchChats();
  };

  const renameChat = async (chatId: string, title: string) => {
    try {
      await chatsApi.rename(chatId, title);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
      if (activeChat?.id === chatId) setActiveChat({ ...activeChat, title });
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    const doDelete = async () => {
      try {
        await chatsApi.delete(chatId);
        setChats(prev => prev.filter(c => c.id !== chatId));
        setShowOptionsModal(false);
        if (activeChat?.id === chatId) { setShowChatModal(false); setActiveChat(null); }
      } catch (error) {
        console.error('Error deleting chat:', error);
        showError('Failed to delete chat');
      }
    };
    showConfirm('Delete Chat', 'Are you sure you want to delete this chat?', doDelete);
  };

  const convertToJob = async (chat: Chat) => {
    try {
      await chatsApi.convertToJob(chat.id);
      setChats(prev => prev.filter(c => c.id !== chat.id));
      setShowOptionsModal(false);
      showAlert('Job Created', 'Chat converted to a bench job. Check the Jobs tab to fill in amp details.');
    } catch (error: any) {
      console.error('Error converting to job:', error);
      showError(error.response?.data?.error || 'Failed to convert chat to job');
    }
  };

  // ─── Messaging ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || !activeChat || sending) return;

    Keyboard.dismiss();
    const messageText = input.trim();
    const attachmentsToSend = [...pendingAttachments];
    setInput('');
    clearAttachments();
    setSending(true);

    // Optimistic user message
    const tempMsg: ChatMessage = {
      id: 'temp-user',
      chatId: activeChat.id,
      role: 'user',
      content: messageText,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const data = await chatsApi.sendMessage(
        activeChat.id, messageText,
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      );
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp-user'),
        data.userMessage,
        data.assistantMessage,
      ]);
      // Auto-title long first messages
      if (messages.length === 0 && messageText.length > 30) {
        await renameChat(activeChat.id, messageText.substring(0, 30) + '...');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
      showError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ─── Attachment Helpers ─────────────────────────────────────────────────

  const getAllAttachments = () => messages.flatMap(m => m.attachments || []);

  const handleAttachPress = () => {
    showAttachmentOptions(
      () => pickImage(true),
      () => pickImage(false),
      pickDocument,
      () => setShowAttachModal(true),
    );
  };

  // ─── Render: Loading ────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  // ─── Render: Dashboard ──────────────────────────────────────────────────

  const hasSendContent = input.trim().length > 0 || pendingAttachments.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* User Header */}
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            {user?.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Ionicons name="person" size={20} color={colors.text.secondary} />
              </View>
            )}
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>
                {user?.firstName || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>195x Bench App</Text>
          <Text style={styles.subtitle}>Guitar Amp Troubleshooting Assistant</Text>
        </View>

        <TouchableOpacity style={styles.newChatButton} onPress={createNewChat}>
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.text.onAccent} />
          <Text style={styles.newChatButtonText}>Start New Chat</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Recent Chats</Text>

        {chats.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No chats yet"
            subtitle="Start a new chat to ask questions about amp repair"
          />
        ) : (
          chats.map(chat => (
            <ChatCard
              key={chat.id}
              chat={chat}
              onPress={() => openChatModal(chat)}
              onOptions={() => { setSelectedChat(chat); setShowOptionsModal(true); }}
            />
          ))
        )}
      </ScrollView>

      {/* ─── Full-Screen Chat Modal ────────────────────────────────────── */}
      {showChatModal && (
        <View style={styles.fullScreenOverlay}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.chatModalContainer}>
              <View style={styles.chatModalHeader}>
                <GHPressable style={styles.headerButton} onPress={closeChat}>
                  <Ionicons name="arrow-back" size={28} color={colors.accent} />
                </GHPressable>
                <GHPressable
                  style={styles.chatTitleButton}
                  onPress={() => { setNewTitle(activeChat?.title || ''); setShowRenameModal(true); }}
                >
                  <Text style={styles.chatModalTitle} numberOfLines={1}>{activeChat?.title}</Text>
                  <Ionicons name="pencil" size={16} color={colors.text.secondary} />
                </GHPressable>
                <GHPressable style={styles.headerButton} onPress={() => setShowMediaGallery(true)}>
                  <Ionicons name="images-outline" size={22} color={colors.text.secondary} />
                  {getAllAttachments().length > 0 && (
                    <View style={styles.mediaCountBadge}>
                      <Text style={styles.mediaCountText}>{getAllAttachments().length}</Text>
                    </View>
                  )}
                </GHPressable>
                <GHPressable
                  style={styles.headerButton}
                  onPress={() => { if (activeChat) { setSelectedChat(activeChat); setShowOptionsModal(true); } }}
                >
                  <Ionicons name="ellipsis-vertical" size={24} color={colors.text.secondary} />
                </GHPressable>
              </View>

              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
              >
                <MessageList
                  messages={messages}
                  sending={sending}
                  sendingText="Thinking..."
                  emptyContent={<WelcomePanel />}
                />

                <AttachmentPreview
                  attachments={pendingAttachments}
                  onRemove={removeAttachment}
                  uploading={uploading}
                />

                <View style={styles.inputContainer}>
                  <TouchableOpacity
                    style={styles.attachButton}
                    onPress={handleAttachPress}
                    disabled={sending || uploading}
                  >
                    <Ionicons
                      name="camera"
                      size={24}
                      color={sending || uploading ? colors.text.muted : colors.accent}
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask about amp repair..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    maxLength={2000}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, (!hasSendContent || sending) && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!hasSendContent || sending}
                  >
                    <Ionicons name="send" size={22} color={colors.text.onAccent} />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </GestureHandlerRootView>
        </View>
      )}

      {/* ─── Sub-Modals ──────────────────────────────────────────────── */}

      <RenameModal
        visible={showRenameModal}
        title={newTitle}
        onChangeTitle={setNewTitle}
        onSave={() => {
          if (activeChat && newTitle.trim()) { renameChat(activeChat.id, newTitle.trim()); setShowRenameModal(false); }
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      <OptionsModal
        visible={showOptionsModal}
        chat={selectedChat}
        onClose={() => setShowOptionsModal(false)}
        onRename={() => {
          if (selectedChat) {
            setNewTitle(selectedChat.title);
            setShowOptionsModal(false);
            setShowRenameModal(true);
            if (!activeChat) setActiveChat(selectedChat);
          }
        }}
        onConvert={() => selectedChat && convertToJob(selectedChat)}
        onDelete={() => selectedChat && deleteChat(selectedChat.id)}
      />

      <AttachmentPickerModal
        visible={showAttachModal}
        onClose={() => setShowAttachModal(false)}
        onCamera={() => { setShowAttachModal(false); pickImage(true); }}
        onLibrary={() => { setShowAttachModal(false); pickImage(false); }}
        onDocument={() => { setShowAttachModal(false); pickDocument(); }}
      />

      <MediaGalleryModal
        visible={showMediaGallery}
        attachments={getAllAttachments()}
        onClose={() => setShowMediaGallery(false)}
      />
    </View>
  );
}

// ─── Welcome Panel ──────────────────────────────────────────────────────────

function WelcomePanel() {
  return (
    <View style={styles.welcomeContainer}>
      <Ionicons name="hardware-chip" size={48} color={colors.accent} />
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
  );
}

// ─── Chat Card ──────────────────────────────────────────────────────────────

function ChatCard({ chat, onPress, onOptions }: { chat: Chat; onPress: () => void; onOptions: () => void }) {
  return (
    <View style={styles.chatCard}>
      <TouchableOpacity style={styles.chatCardContent} onPress={onPress}>
        <View style={styles.chatCardHeader}>
          <Ionicons name={chat.benchJobId ? 'briefcase' : 'chatbubble-ellipses'} size={20} color={colors.accent} />
          <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
        </View>
        <Text style={styles.chatDate}>{formatRelativeDate(chat.updatedAt)}</Text>
        {chat.benchJobId && (
          <View style={styles.linkedBadge}>
            <Text style={styles.linkedBadgeText}>Linked to Job</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.chatOptionsButton} onPress={onOptions}>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Rename Modal ───────────────────────────────────────────────────────────

function RenameModal({ visible, title, onChangeTitle, onSave, onCancel }: {
  visible: boolean; title: string; onChangeTitle: (t: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Rename Chat</Text>
          <TextInput
            style={styles.renameInput}
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Enter chat name"
            placeholderTextColor={colors.text.muted}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={onSave}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Options Modal ──────────────────────────────────────────────────────────

function OptionsModal({ visible, chat, onClose, onRename, onConvert, onDelete }: {
  visible: boolean; chat: Chat | null; onClose: () => void;
  onRename: () => void; onConvert: () => void; onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.optionsContent}>
          <TouchableOpacity style={styles.optionItem} onPress={onRename}>
            <Ionicons name="pencil" size={22} color={colors.text.bright} />
            <Text style={styles.optionText}>Rename</Text>
          </TouchableOpacity>
          {chat && !chat.benchJobId && (
            <TouchableOpacity style={styles.optionItem} onPress={onConvert}>
              <Ionicons name="briefcase" size={22} color={colors.text.bright} />
              <Text style={styles.optionText}>Convert to Job</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.optionItem, styles.optionItemDanger]} onPress={onDelete}>
            <Ionicons name="trash" size={22} color={colors.status.error} />
            <Text style={[styles.optionText, { color: colors.status.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Media Gallery Modal ────────────────────────────────────────────────────

function MediaGalleryModal({ visible, attachments, onClose }: {
  visible: boolean; attachments: any[]; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.galleryOverlay}>
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Media Gallery</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {attachments.length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="No attachments yet"
              subtitle="Photos and PDFs shared in this chat will appear here"
            />
          ) : (
            <ScrollView style={styles.galleryScroll}>
              <View style={styles.galleryGrid}>
                {attachments.map((att, idx) => (
                  <TouchableOpacity key={idx} style={styles.galleryItem} onPress={() => openUrl(att.url)}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.url }} style={styles.galleryImage} />
                    ) : (
                      <View style={styles.galleryPdf}>
                        <Ionicons name="document-text" size={32} color={colors.accent} />
                        <Text style={styles.galleryPdfText} numberOfLines={2}>{att.name || 'Document.pdf'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollView: { flex: 1, padding: 16 },
  // User header
  userHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.elevated,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  userTextContainer: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: colors.white },
  userEmail: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  logoutButton: { padding: 8 },
  // Header
  header: { marginBottom: 24, paddingTop: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.accent, marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.text.secondary },
  // New chat
  newChatButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, padding: 16, borderRadius: 12, gap: 10, marginBottom: 24,
  },
  newChatButtonText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.bright, marginBottom: 12 },
  // Chat cards
  chatCard: {
    backgroundColor: colors.bg.surface, borderRadius: 12, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: colors.accent, flexDirection: 'row', alignItems: 'center',
  },
  chatCardContent: { flex: 1, padding: 16 },
  chatOptionsButton: { padding: 16, justifyContent: 'center', alignItems: 'center' },
  chatCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  chatTitle: { color: colors.text.bright, fontSize: 16, fontWeight: '500', flex: 1 },
  chatDate: { color: colors.text.muted, fontSize: 12 },
  linkedBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.status.successDark,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8,
  },
  linkedBadgeText: { color: colors.status.successLight, fontSize: 11, fontWeight: '600' },
  // Full-screen chat
  fullScreenOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg.primary, zIndex: 1000,
  },
  chatModalContainer: { flex: 1, backgroundColor: colors.bg.primary },
  chatModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50, borderBottomWidth: 1,
    borderBottomColor: colors.border.default, backgroundColor: colors.bg.surface,
  },
  chatTitleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 200,
  },
  headerButton: {
    padding: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  chatModalTitle: { color: colors.text.bright, fontSize: 18, fontWeight: '600' },
  mediaCountBadge: {
    position: 'absolute', top: -2, right: -2, backgroundColor: colors.accent,
    borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  mediaCountText: { color: colors.text.onAccent, fontSize: 11, fontWeight: 'bold' },
  // Welcome
  welcomeContainer: { alignItems: 'center', paddingVertical: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.accent, marginTop: 16, marginBottom: 8 },
  welcomeText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  exampleQuestions: { backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, width: '100%' },
  exampleTitle: { color: colors.accent, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  exampleText: { color: colors.text.secondary, fontSize: 14, marginBottom: 8, lineHeight: 20 },
  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border.default, backgroundColor: colors.bg.surface,
  },
  attachButton: { padding: 8, marginRight: 4 },
  input: {
    flex: 1, backgroundColor: colors.bg.elevated, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 12, color: colors.white, fontSize: 16, maxHeight: 100,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  // Rename modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 24, width: '100%' },
  modalTitle: { color: colors.accent, fontSize: 20, fontWeight: '600', marginBottom: 16 },
  renameInput: {
    backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 14,
    color: colors.white, fontSize: 16, marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 14, alignItems: 'center' },
  modalCancelText: { color: colors.text.bright, fontSize: 16, fontWeight: '500' },
  modalSaveBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: 'center' },
  modalSaveText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },
  // Options modal
  optionsContent: {
    backgroundColor: colors.bg.surface, borderRadius: 16, width: '100%', maxWidth: 300, overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  optionItemDanger: { borderBottomWidth: 0 },
  optionText: { color: colors.text.bright, fontSize: 16 },
  // Media gallery
  galleryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  galleryContainer: {
    flex: 1, backgroundColor: colors.bg.primary, marginTop: 50,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  galleryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  galleryTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  galleryScroll: { flex: 1, padding: 8 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryPdf: {
    width: '100%', height: '100%', backgroundColor: colors.bg.surface,
    justifyContent: 'center', alignItems: 'center', padding: 8, borderRadius: 8,
  },
  galleryPdfText: { color: colors.text.secondary, fontSize: 10, marginTop: 4, textAlign: 'center' },
});
