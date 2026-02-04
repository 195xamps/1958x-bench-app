import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MarkdownContent } from '../components/MarkdownContent';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

type TabType = 'chat' | 'notes' | 'measurements';

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  createdAt: string;
}

interface Measurement {
  nodeName: string;
  recordedValue: number | null;
  expectedMin: number | null;
  expectedMax: number | null;
  unit: string | null;
  status: string | null;
  notes: string | null;
}

interface CommunityJobDetail {
  id: string;
  status: string;
  ownerSymptoms: string | null;
  techNotes: string | null;
  priorWork: string | null;
  knownMods: string | null;
  createdAt: string;
  updatedAt: string;
  shareAnonymously: boolean;
  ampProfile: {
    make: string | null;
    model: string | null;
    year: string | null;
    circuitFamily: string | null;
  } | null;
  owner: {
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  measurements: Measurement[];
  schematics: {
    id: string;
    name: string;
    ampModel: string | null;
    circuitFamily: string | null;
  }[];
  chatMessages: ChatMessage[];
}

export default function CommunityJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<CommunityJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJob();
    }
  }, [id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/community/jobs/${id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      } else if (response.status === 404) {
        setError('This job is not available or has been unshared.');
      } else {
        setError('Failed to load job details.');
      }
    } catch (err) {
      console.error('Error fetching community job:', err);
      setError('Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#3b82f6';
      case 'in_progress': return '#f59e0b';
      case 'waiting_parts': return '#8b5cf6';
      case 'completed': return '#22c55e';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'in_progress': return 'In Progress';
      case 'waiting_parts': return 'Waiting Parts';
      case 'completed': return 'Completed';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const getMeasurementStatusColor = (status: string | null) => {
    switch (status) {
      case 'green': return '#22c55e';
      case 'yellow': return '#f59e0b';
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAllAttachments = (): Attachment[] => {
    if (!job?.chatMessages || !Array.isArray(job.chatMessages)) return [];
    return job.chatMessages
      .filter(m => m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0)
      .flatMap(m => m.attachments || []);
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

  if (error || !job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Job</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'Job not found'}</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderChatTab = () => (
    <ScrollView style={styles.chatContainer} contentContainerStyle={styles.chatContent}>
      {(!job.chatMessages || job.chatMessages.length === 0) ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyText}>No chat history</Text>
          <Text style={styles.emptySubtext}>The job owner hasn't started a conversation yet</Text>
        </View>
      ) : (
        job.chatMessages.map((message) => (
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
            <Text style={styles.messageTimestamp}>
              {formatDate(message.createdAt)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderNotesTab = () => (
    <ScrollView style={styles.notesContainer} contentContainerStyle={styles.notesContent}>
      <View style={styles.ownerCard}>
        {job.owner ? (
          <>
            {job.owner.profileImageUrl ? (
              <Image source={{ uri: job.owner.profileImageUrl }} style={styles.ownerAvatar} />
            ) : (
              <View style={styles.ownerAvatarPlaceholder}>
                <Text style={styles.ownerInitial}>
                  {job.owner.firstName?.[0] || 'A'}
                </Text>
              </View>
            )}
            <View style={styles.ownerDetails}>
              <Text style={styles.ownerName}>
                Shared by {job.owner.firstName} {job.owner.lastName}
              </Text>
              <Text style={styles.ownerDate}>Updated {formatDate(job.updatedAt)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.ownerAvatarPlaceholder}>
              <Ionicons name="person" size={20} color="#6b7280" />
            </View>
            <View style={styles.ownerDetails}>
              <Text style={styles.ownerName}>Shared anonymously</Text>
              <Text style={styles.ownerDate}>Updated {formatDate(job.updatedAt)}</Text>
            </View>
          </>
        )}
      </View>

      {job.techNotes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tech Notes</Text>
          <Text style={styles.sectionText}>{job.techNotes}</Text>
        </View>
      )}

      {job.ownerSymptoms && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner's Symptoms</Text>
          <Text style={styles.sectionText}>{job.ownerSymptoms}</Text>
        </View>
      )}

      {job.priorWork && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prior Work</Text>
          <Text style={styles.sectionText}>{job.priorWork}</Text>
        </View>
      )}

      {job.knownMods && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Known Modifications</Text>
          <Text style={styles.sectionText}>{job.knownMods}</Text>
        </View>
      )}

      {job.schematics && job.schematics.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referenced Schematics</Text>
          {job.schematics.map((s) => (
            <View key={s.id} style={styles.schematicCard}>
              <Ionicons name="document-text" size={20} color="#f59e0b" />
              <View style={styles.schematicInfo}>
                <Text style={styles.schematicName}>{s.name}</Text>
                <Text style={styles.schematicMeta}>
                  {s.circuitFamily || s.ampModel || 'Unknown'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!job.techNotes && !job.ownerSymptoms && !job.priorWork && !job.knownMods && (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyText}>No notes recorded</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderMeasurementsTab = () => (
    <ScrollView style={styles.measurementsContainer} contentContainerStyle={styles.measurementsContent}>
      {(!job.measurements || job.measurements.length === 0) ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyText}>No measurements recorded</Text>
          <Text style={styles.emptySubtext}>The job owner hasn't taken any measurements yet</Text>
        </View>
      ) : (
        <>
          <Text style={styles.measurementsTitle}>{job.measurements.length} Measurements</Text>
          {job.measurements.map((m, idx) => (
            <View key={idx} style={styles.measurementCard}>
              <View style={styles.measurementHeader}>
                <Text style={styles.measurementNode}>{m.nodeName}</Text>
                <View style={[styles.measurementStatus, { backgroundColor: getMeasurementStatusColor(m.status) }]} />
              </View>
              <View style={styles.measurementValues}>
                <View>
                  <Text style={styles.measurementLabel}>Recorded</Text>
                  <Text style={styles.measurementValue}>
                    {m.recordedValue !== null ? `${m.recordedValue} ${m.unit || ''}` : 'N/A'}
                  </Text>
                </View>
                {m.expectedMin !== null && m.expectedMax !== null && (
                  <View style={styles.measurementExpectedCol}>
                    <Text style={styles.measurementLabel}>Expected</Text>
                    <Text style={styles.measurementExpected}>
                      {m.expectedMin}-{m.expectedMax} {m.unit || ''}
                    </Text>
                  </View>
                )}
              </View>
              {m.notes && <Text style={styles.measurementNotes}>{m.notes}</Text>}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.ampProfile?.make || ''} {job.ampProfile?.model || 'Community Job'}
          </Text>
          <View style={styles.headerMeta}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.status) }]} />
              <Text style={[styles.statusBadgeText, { color: getStatusColor(job.status) }]}>
                {getStatusLabel(job.status)}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {job.ampProfile?.circuitFamily && `${job.ampProfile.circuitFamily} • `}
              {job.ampProfile?.year || 'Unknown year'}
            </Text>
          </View>
        </View>
        {activeTab === 'chat' && getAllAttachments().length > 0 && (
          <TouchableOpacity style={styles.galleryButton} onPress={() => setShowMediaGallery(true)}>
            <Ionicons name="images-outline" size={22} color="#9ca3af" />
            <View style={styles.galleryBadge}>
              <Text style={styles.galleryBadgeText}>{getAllAttachments().length}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="eye" size={16} color="#9ca3af" />
        <Text style={styles.readOnlyText}>Read-only view from Community Bench</Text>
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

      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'notes' && renderNotesTab()}
      {activeTab === 'measurements' && renderMeasurementsTab()}

      <Modal visible={showMediaGallery} transparent animationType="slide">
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryContent}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Media Gallery</Text>
              <TouchableOpacity onPress={() => setShowMediaGallery(false)}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.galleryGrid}>
              {getAllAttachments().map((att, idx) => (
                <TouchableOpacity
                  key={idx}
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
                      <Text style={styles.galleryPdfText} numberOfLines={1}>{att.name || 'PDF'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 8,
    gap: 6,
  },
  readOnlyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
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
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#f59e0b',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 40,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '90%',
  },
  userMessage: {
    backgroundColor: '#f59e0b',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: '#374151',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  assistantLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#111827',
  },
  messageTimestamp: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  attachmentContainer: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
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
    backgroundColor: '#4b5563',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  pdfAttachmentText: {
    color: '#f3f4f6',
    fontSize: 14,
    flex: 1,
  },
  notesContainer: {
    flex: 1,
  },
  notesContent: {
    padding: 16,
    paddingBottom: 40,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  ownerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  ownerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  ownerDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 22,
  },
  measurementsContainer: {
    flex: 1,
  },
  measurementsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  measurementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f3f4f6',
    marginBottom: 12,
  },
  measurementCard: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementNode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  measurementStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  measurementValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  measurementLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
  },
  measurementExpectedCol: {
    alignItems: 'flex-end',
  },
  measurementExpected: {
    fontSize: 14,
    color: '#9ca3af',
  },
  measurementNotes: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  schematicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  schematicInfo: {
    flex: 1,
  },
  schematicName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f3f4f6',
  },
  schematicMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
    textAlign: 'center',
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
  backButtonLarge: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#111827',
    fontWeight: '600',
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
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  galleryContent: {
    flex: 1,
    paddingTop: 60,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  galleryItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 4,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  galleryPdf: {
    width: '100%',
    height: '100%',
    backgroundColor: '#374151',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPdfText: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
  },
});
