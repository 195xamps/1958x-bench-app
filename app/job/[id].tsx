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
  Alert,
  Image,
  Linking,
  ActionSheetIOS,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MarkdownContent } from '../components/MarkdownContent';

const API_URL = '';

type TabType = 'chat' | 'notes' | 'measurements';

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

interface Measurement {
  id: string;
  nodeName: string;
  expectedMin: number | null;
  expectedMax: number | null;
  recordedValue: number | null;
  unit: string | null;
  meterTool: string | null;
  meterMode: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
}

interface JobData {
  job: {
    id: string;
    status: string;
    ownerSymptoms: string;
    techNotes: string;
    priorWork: string;
    knownMods: string;
    safetyChecklistCompleted: boolean;
    createdAt: string;
  };
  ampProfile: {
    id: string;
    make: string;
    model: string;
    year: string;
    circuitFamily: string;
  };
  measurements: Measurement[];
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  
  const [techNotes, setTechNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      fetchJobData();
      fetchJobChat();
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [chatMessages, activeTab]);

  const fetchJobData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bench-jobs/${id}`);
      setJobData(response.data);
      setTechNotes(response.data.job.techNotes || '');
    } catch (error) {
      console.error('Error fetching job:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to load job');
      } else {
        Alert.alert('Error', 'Failed to load job');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchJobChat = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bench-jobs/${id}/chat`);
      setChatId(response.data.chat.id);
      setChatMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching job chat:', error);
    }
  };

  const handleNotesChange = (text: string) => {
    setTechNotes(text);
    setNotesSaved(false);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(text);
    }, 1500);
  };

  const saveNotes = async (notes: string) => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const response = await axios.patch(`${API_URL}/api/bench-jobs/${id}/notes`, { techNotes: notes });
      if (response.data) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  const uploadImage = async (uri: string, fileName: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('file', blob, fileName);
      
      const uploadResponse = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return uploadResponse.data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const pickImage = async (useCamera: boolean) => {
    setShowAttachmentModal(false);
    
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          window.alert('Camera permission is required');
        } else {
          Alert.alert('Permission required', 'Camera permission is required');
        }
        return;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      const asset = result.assets[0];
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const uploadedUrl = await uploadImage(asset.uri, fileName);
      setUploadingImage(false);
      
      if (uploadedUrl) {
        setPendingAttachments((prev) => [...prev, { type: 'image', url: uploadedUrl }]);
      }
    }
  };

  const pickDocument = async () => {
    setShowAttachmentModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append('file', blob, asset.name);
        
        const uploadResponse = await axios.post(`${API_URL}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadingImage(false);
        
        if (uploadResponse.data.url) {
          setPendingAttachments((prev) => [...prev, { type: 'file', url: uploadResponse.data.url, name: asset.name }]);
        }
      }
    } catch (error) {
      setUploadingImage(false);
      console.error('Error picking document:', error);
    }
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Choose PDF'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage(true);
          else if (buttonIndex === 2) pickImage(false);
          else if (buttonIndex === 3) pickDocument();
        }
      );
    } else {
      setShowAttachmentModal(true);
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const sendChatMessage = async () => {
    if ((!chatInput.trim() && pendingAttachments.length === 0) || !chatId || sendingChat) return;

    const messageText = chatInput.trim();
    const attachmentsToSend = [...pendingAttachments];
    setChatInput('');
    setPendingAttachments([]);
    setSendingChat(true);

    const tempUserMessage: ChatMessage = {
      id: 'temp-user',
      chatId,
      role: 'user',
      content: messageText,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await axios.post(`${API_URL}/api/chats/${chatId}/messages`, {
        content: messageText,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      });
      
      setChatMessages((prev) => [
        ...prev.filter((m) => m.id !== 'temp-user'),
        response.data.userMessage,
        response.data.assistantMessage,
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
    } finally {
      setSendingChat(false);
    }
  };

  const getAllAttachments = (): Attachment[] => {
    const attachments: Attachment[] = [];
    chatMessages.forEach((msg) => {
      if (msg.attachments && Array.isArray(msg.attachments)) {
        msg.attachments.forEach((att) => attachments.push(att));
      }
    });
    return attachments;
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return '#6b7280';
    if (status === 'in_range' || status === 'green') return '#22c55e';
    if (status === 'warning' || status === 'yellow') return '#f59e0b';
    if (status === 'out_of_range' || status === 'red') return '#ef4444';
    return '#6b7280';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading job...</Text>
      </View>
    );
  }

  if (!jobData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Job not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { job, ampProfile, measurements } = jobData;

  const renderChatTab = () => (
    <KeyboardAvoidingView 
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={180}
    >
      <ScrollView
        ref={chatScrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {chatMessages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <Ionicons name="hardware-chip" size={48} color="#f59e0b" />
            <Text style={styles.welcomeTitle}>Job Assistant</Text>
            <Text style={styles.welcomeText}>
              Ask questions about this {ampProfile.make} {ampProfile.model}. 
              Upload photos for identification or troubleshooting help.
            </Text>
          </View>
        )}

        {chatMessages.map((message) => (
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
                <Text style={styles.assistantLabel}>Assistant</Text>
              </View>
            )}
            {message.attachments && message.attachments.map((att, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.attachmentContainer}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(att.url, '_blank');
                  } else {
                    Linking.openURL(att.url);
                  }
                }}
              >
                {att.type === 'image' ? (
                  <Image source={{ uri: att.url }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.pdfAttachment}>
                    <Ionicons name="document-text" size={24} color="#f59e0b" />
                    <Text style={styles.pdfAttachmentText} numberOfLines={1}>{att.name || 'Document.pdf'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {message.role === 'assistant' ? (
              <MarkdownContent content={message.content} />
            ) : (
              <Text style={[styles.messageText, styles.userMessageText]}>
                {message.content}
              </Text>
            )}
          </View>
        ))}

        {sendingChat && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#f59e0b" />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {pendingAttachments.length > 0 && (
        <View style={styles.pendingAttachments}>
          {pendingAttachments.map((att, idx) => (
            <View key={idx} style={styles.pendingAttachmentItem}>
              {att.type === 'image' ? (
                <Image source={{ uri: att.url }} style={styles.pendingImage} />
              ) : (
                <View style={styles.pendingPdfAttachment}>
                  <Ionicons name="document-text" size={20} color="#f59e0b" />
                  <Text style={styles.pendingPdfText} numberOfLines={1}>{att.name}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.removeAttachment} onPress={() => removeAttachment(idx)}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={showAttachmentOptions} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <Ionicons name="attach" size={24} color="#f59e0b" />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.chatInput}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Ask about this amp..."
          placeholderTextColor="#6b7280"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!chatInput.trim() && pendingAttachments.length === 0 || sendingChat) && styles.sendButtonDisabled]}
          onPress={sendChatMessage}
          disabled={(!chatInput.trim() && pendingAttachments.length === 0) || sendingChat}
        >
          <Ionicons name="send" size={22} color="#1f2937" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderNotesTab = () => (
    <KeyboardAvoidingView 
      style={styles.notesContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.notesHeader}>
        <Text style={styles.notesTitle}>Repair Notes</Text>
        <View style={styles.saveStatus}>
          {savingNotes && (
            <>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={styles.saveStatusText}>Saving...</Text>
            </>
          )}
          {notesSaved && !savingNotes && (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              <Text style={[styles.saveStatusText, { color: '#22c55e' }]}>Saved</Text>
            </>
          )}
        </View>
      </View>
      
      <TextInput
        style={styles.notesInput}
        value={techNotes}
        onChangeText={handleNotesChange}
        placeholder="Add repair notes, parts replaced, observations..."
        placeholderTextColor="#6b7280"
        multiline
        textAlignVertical="top"
      />

      {job.ownerSymptoms && (
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Owner's Symptoms</Text>
          <Text style={styles.infoText}>{job.ownerSymptoms}</Text>
        </View>
      )}

      {job.priorWork && (
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Prior Work</Text>
          <Text style={styles.infoText}>{job.priorWork}</Text>
        </View>
      )}

      {job.knownMods && (
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Known Modifications</Text>
          <Text style={styles.infoText}>{job.knownMods}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  const renderMeasurementsTab = () => (
    <ScrollView style={styles.measurementsContainer}>
      <View style={styles.measurementsHeader}>
        <Text style={styles.measurementsTitle}>Measurements</Text>
        <TouchableOpacity 
          style={styles.addMeasurementButton}
          onPress={() => router.push(`/measurement?jobId=${id}`)}
        >
          <Ionicons name="add" size={20} color="#1f2937" />
          <Text style={styles.addMeasurementText}>Add</Text>
        </TouchableOpacity>
      </View>

      {measurements.length === 0 ? (
        <View style={styles.emptyMeasurements}>
          <Ionicons name="analytics-outline" size={48} color="#4b5563" />
          <Text style={styles.emptyText}>No measurements recorded</Text>
          <Text style={styles.emptySubtext}>Tap "Add" to record voltage or resistance readings</Text>
        </View>
      ) : (
        measurements.map((m) => (
          <View key={m.id} style={styles.measurementCard}>
            <View style={styles.measurementHeader}>
              <Text style={styles.measurementNode}>{m.nodeName}</Text>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(m.status) }]} />
            </View>
            <View style={styles.measurementValues}>
              <View style={styles.valueColumn}>
                <Text style={styles.valueLabel}>Recorded</Text>
                <Text style={styles.valueText}>
                  {m.recordedValue !== null ? `${m.recordedValue} ${m.unit || ''}` : '--'}
                </Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.valueLabel}>Expected</Text>
                <Text style={styles.expectedText}>
                  {m.expectedMin !== null && m.expectedMax !== null 
                    ? `${m.expectedMin} - ${m.expectedMax} ${m.unit || ''}`
                    : '--'}
                </Text>
              </View>
            </View>
            {m.notes && <Text style={styles.measurementNotes}>{m.notes}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {ampProfile.make} {ampProfile.model}
          </Text>
          <Text style={styles.headerSubtitle}>
            {ampProfile.circuitFamily && `${ampProfile.circuitFamily} • `}
            {ampProfile.year || 'Unknown year'}
          </Text>
        </View>
        {activeTab === 'chat' && (
          <TouchableOpacity style={styles.galleryButton} onPress={() => setShowMediaGallery(true)}>
            <Ionicons name="images-outline" size={22} color="#9ca3af" />
            {getAllAttachments().length > 0 && (
              <View style={styles.galleryBadge}>
                <Text style={styles.galleryBadgeText}>{getAllAttachments().length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubbles" size={20} color={activeTab === 'chat' ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
          onPress={() => setActiveTab('notes')}
        >
          <Ionicons name="document-text" size={20} color={activeTab === 'notes' ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'measurements' && styles.activeTab]}
          onPress={() => setActiveTab('measurements')}
        >
          <Ionicons name="analytics" size={20} color={activeTab === 'measurements' ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'measurements' && styles.activeTabText]}>Measurements</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'chat' && renderChatTab()}
        {activeTab === 'notes' && renderNotesTab()}
        {activeTab === 'measurements' && renderMeasurementsTab()}
      </View>

      <Modal visible={showAttachmentModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={22} color="#e5e7eb" />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={22} color="#e5e7eb" />
              <Text style={styles.modalOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={pickDocument}>
              <Ionicons name="document-text" size={22} color="#e5e7eb" />
              <Text style={styles.modalOptionText}>Upload PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => setShowAttachmentModal(false)}>
              <Ionicons name="close" size={22} color="#9ca3af" />
              <Text style={[styles.modalOptionText, { color: '#9ca3af' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMediaGallery} transparent animationType="slide">
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryContainer}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Media Gallery</Text>
              <TouchableOpacity onPress={() => setShowMediaGallery(false)}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {getAllAttachments().length === 0 ? (
              <View style={styles.emptyGallery}>
                <Ionicons name="images-outline" size={48} color="#4b5563" />
                <Text style={styles.emptyGalleryText}>No attachments yet</Text>
              </View>
            ) : (
              <ScrollView style={styles.galleryScroll}>
                <View style={styles.galleryGrid}>
                  {getAllAttachments().map((att, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.galleryItem}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(att.url, '_blank');
                        } else {
                          Linking.openURL(att.url);
                        }
                      }}
                    >
                      {att.type === 'image' ? (
                        <Image source={{ uri: att.url }} style={styles.galleryImage} />
                      ) : (
                        <View style={styles.galleryPdf}>
                          <Ionicons name="document-text" size={32} color="#f59e0b" />
                          <Text style={styles.galleryPdfName} numberOfLines={2}>{att.name || 'Document.pdf'}</Text>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerBackButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 2,
  },
  galleryButton: {
    position: 'relative',
    padding: 8,
  },
  galleryBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  galleryBadgeText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#f59e0b',
  },
  content: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f59e0b',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assistantLabel: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#1f2937',
  },
  attachmentContainer: {
    marginBottom: 8,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  pdfAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  pdfAttachmentText: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
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
  pendingAttachments: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#1f2937',
    flexWrap: 'wrap',
  },
  pendingAttachmentItem: {
    position: 'relative',
  },
  pendingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  pendingPdfAttachment: {
    width: 60,
    height: 60,
    backgroundColor: '#374151',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingPdfText: {
    color: '#9ca3af',
    fontSize: 8,
    marginTop: 2,
  },
  removeAttachment: {
    position: 'absolute',
    top: -6,
    right: -6,
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
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInput: {
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
  notesContainer: {
    flex: 1,
    padding: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveStatusText: {
    fontSize: 14,
    color: '#f59e0b',
  },
  notesInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    color: '#e5e7eb',
    fontSize: 16,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoSection: {
    marginTop: 20,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 22,
  },
  measurementsContainer: {
    flex: 1,
    padding: 16,
  },
  measurementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  measurementsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  addMeasurementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addMeasurementText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyMeasurements: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  measurementCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurementNode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  measurementValues: {
    flexDirection: 'row',
    gap: 20,
  },
  valueColumn: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
  },
  expectedText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  measurementNotes: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#e5e7eb',
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: '#111827',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  galleryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e5e7eb',
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGalleryText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 16,
  },
  galleryScroll: {
    flex: 1,
    padding: 8,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryPdf: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  galleryPdfName: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
