import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { communityApi } from '../../src/services';
import { colors } from '../../src/theme';
import { getStatusConfig } from '../../src/types/common';
import type { CommunityJobDetail } from '../../src/types';
import { formatTimestamp, openUrl } from '../../src/utils';
import { LoadingScreen, EmptyState, StatusBadge } from '../../src/components/shared';
import { MarkdownContent } from '../../src/components/MarkdownContent';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabType = 'chat' | 'notes' | 'measurements';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CommunityJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<CommunityJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  useEffect(() => {
    if (id) fetchJob();
  }, [id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await communityApi.get(id!);
      setJob(data);
    } catch (err: any) {
      console.error('Error fetching community job:', err);
      if (err.response?.status === 404) {
        setError('This job is not available or has been unshared.');
      } else {
        setError('Failed to load job details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getAllAttachments = () => {
    if (!job?.chatMessages) return [];
    return job.chatMessages
      .filter(m => m.attachments?.length > 0)
      .flatMap(m => m.attachments || []);
  };

  // ─── Loading / Error States ─────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Loading..." onBack={() => router.back()} />
        <LoadingScreen />
      </View>
    );
  }

  if (error || !job) {
    const isNotFound = error?.includes('not available') || error?.includes('not found');
    return (
      <View style={styles.container}>
        <Header title="Community Job" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <Ionicons name={isNotFound ? 'alert-circle' : 'cloud-offline-outline'} size={64} color={isNotFound ? colors.status.error : colors.text.muted} />
          <Text style={styles.errorText}>{error || 'Job not found'}</Text>
          <View style={styles.errorActions}>
            {!isNotFound && (
              <TouchableOpacity style={styles.retryButton} onPress={fetchJob}>
                <Ionicons name="refresh" size={16} color={colors.text.onAccent} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  const attachments = getAllAttachments();
  const statusConfig = getStatusConfig(job.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.ampProfile?.make || ''} {job.ampProfile?.model || 'Community Job'}
          </Text>
          <View style={styles.headerMeta}>
            <StatusBadge status={job.status} />
            <Text style={styles.headerSubtitle}>
              {job.ampProfile?.circuitFamily && `${job.ampProfile.circuitFamily} • `}
              {job.ampProfile?.year || 'Unknown year'}
            </Text>
          </View>
        </View>
        {activeTab === 'chat' && attachments.length > 0 && (
          <TouchableOpacity style={styles.galleryButton} onPress={() => setShowMediaGallery(true)}>
            <Ionicons name="images-outline" size={22} color={colors.text.secondary} />
            <View style={styles.galleryBadge}>
              <Text style={styles.galleryBadgeText}>{attachments.length}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Read-only Banner */}
      <View style={styles.readOnlyBanner}>
        <Ionicons name="eye" size={16} color={colors.text.secondary} />
        <Text style={styles.readOnlyText}>Read-only view from Community Bench</Text>
      </View>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'chat' && <ChatTab job={job} />}
      {activeTab === 'notes' && <NotesTab job={job} />}
      {activeTab === 'measurements' && <MeasurementsTab job={job} />}

      {/* Media Gallery Modal */}
      <MediaGalleryModal
        visible={showMediaGallery}
        attachments={attachments}
        onClose={() => setShowMediaGallery(false)}
      />
    </View>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.accent} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'chatbubbles' },
  { id: 'notes', label: 'Notes', icon: 'document-text' },
  { id: 'measurements', label: 'Measurements', icon: 'analytics' },
];

function TabBar({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (t: TabType) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => onTabChange(tab.id)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={activeTab === tab.id ? colors.accent : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Chat Tab ───────────────────────────────────────────────────────────────

function ChatTab({ job }: { job: CommunityJobDetail }) {
  if (!job.chatMessages?.length) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <EmptyState
          icon="chatbubbles-outline"
          title="No chat history"
          subtitle="The job owner hasn't started a conversation yet"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.tabContent}>
      {job.chatMessages.map((msg) => (
        <View
          key={msg.id}
          style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}
        >
          {msg.role === 'assistant' && (
            <View style={styles.assistantHeader}>
              <Ionicons name="hardware-chip" size={18} color={colors.accent} />
              <Text style={styles.assistantLabel}>Assistant</Text>
            </View>
          )}
          {msg.attachments?.map((att: any, idx: number) => (
            <TouchableOpacity key={idx} style={styles.attachmentContainer} onPress={() => openUrl(att.url)}>
              {att.type === 'image' ? (
                <Image source={{ uri: att.url }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.pdfAttachment}>
                  <Ionicons name="document-text" size={24} color={colors.accent} />
                  <Text style={styles.pdfText} numberOfLines={1}>{att.name || 'Document.pdf'}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          {msg.role === 'assistant' ? (
            <MarkdownContent content={msg.content} />
          ) : (
            <Text style={styles.userText}>{msg.content}</Text>
          )}
          <Text style={styles.timestamp}>{formatTimestamp(msg.createdAt)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Notes Tab ──────────────────────────────────────────────────────────────

function NotesTab({ job }: { job: CommunityJobDetail }) {
  const hasNotes = job.techNotes || job.ownerSymptoms || job.priorWork || job.knownMods;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.tabContent}>
      {/* Owner Card */}
      <View style={styles.ownerCard}>
        {job.owner?.profileImageUrl ? (
          <Image source={{ uri: job.owner.profileImageUrl }} style={styles.ownerAvatar} />
        ) : (
          <View style={styles.ownerAvatarPlaceholder}>
            {job.owner ? (
              <Text style={styles.ownerInitial}>{job.owner.firstName?.[0] || 'A'}</Text>
            ) : (
              <Ionicons name="person" size={20} color={colors.text.muted} />
            )}
          </View>
        )}
        <View style={styles.ownerDetails}>
          <Text style={styles.ownerName}>
            {job.owner ? `Shared by ${job.owner.firstName} ${job.owner.lastName}` : 'Shared anonymously'}
          </Text>
          <Text style={styles.ownerDate}>Updated {formatTimestamp(job.updatedAt)}</Text>
        </View>
      </View>

      {/* Sections */}
      {job.techNotes && <NoteSection title="Tech Notes" text={job.techNotes} />}
      {job.ownerSymptoms && <NoteSection title="Owner's Symptoms" text={job.ownerSymptoms} />}
      {job.priorWork && <NoteSection title="Prior Work" text={job.priorWork} />}
      {job.knownMods && <NoteSection title="Known Modifications" text={job.knownMods} />}

      {/* Schematics */}
      {job.schematics?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referenced Schematics</Text>
          {job.schematics.map((s) => (
            <View key={s.id} style={styles.schematicCard}>
              <Ionicons name="document-text" size={20} color={colors.accent} />
              <View style={styles.schematicInfo}>
                <Text style={styles.schematicName}>{s.name}</Text>
                <Text style={styles.schematicMeta}>{s.circuitFamily || s.ampModel || 'Unknown'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!hasNotes && (
        <EmptyState icon="document-text-outline" title="No notes recorded" />
      )}
    </ScrollView>
  );
}

function NoteSection({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

// ─── Measurements Tab ───────────────────────────────────────────────────────

const MEASUREMENT_STATUS_COLORS: Record<string, string> = {
  green: colors.status.success,
  yellow: colors.status.warning,
  red: colors.status.error,
};

function MeasurementsTab({ job }: { job: CommunityJobDetail }) {
  if (!job.measurements?.length) {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <EmptyState
          icon="analytics-outline"
          title="No measurements recorded"
          subtitle="The job owner hasn't taken any measurements yet"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.tabContent}>
      <Text style={styles.measurementsTitle}>{job.measurements.length} Measurements</Text>
      {job.measurements.map((m, idx) => {
        const statusColor = MEASUREMENT_STATUS_COLORS[m.status || ''] || colors.text.muted;
        return (
          <View key={idx} style={styles.measurementCard}>
            <View style={styles.measurementHeader}>
              <Text style={styles.measurementNode}>{m.nodeName}</Text>
              <View style={[styles.measurementDot, { backgroundColor: statusColor }]} />
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
        );
      })}
    </ScrollView>
  );
}

// ─── Media Gallery Modal ────────────────────────────────────────────────────

function MediaGalleryModal({
  visible,
  attachments,
  onClose,
}: {
  visible: boolean;
  attachments: any[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.galleryOverlay}>
        <View style={styles.galleryContent}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Media Gallery</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.galleryGrid}>
            {attachments.map((att, idx) => (
              <TouchableOpacity key={idx} style={styles.galleryItem} onPress={() => openUrl(att.url)}>
                {att.type === 'image' ? (
                  <Image source={{ uri: att.url }} style={styles.galleryImage} />
                ) : (
                  <View style={styles.galleryPdf}>
                    <Ionicons name="document-text" size={32} color={colors.accent} />
                    <Text style={styles.galleryPdfText} numberOfLines={1}>{att.name || 'PDF'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  flex: { flex: 1 },
  // Header
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
  backButton: { marginRight: 12, padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  headerSubtitle: { fontSize: 14, color: colors.text.secondary },
  // Read-only
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
    paddingVertical: 8,
    gap: 6,
  },
  readOnlyText: { fontSize: 13, color: colors.text.secondary },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
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
  activeTab: { borderBottomColor: colors.accent },
  tabText: { fontSize: 14, color: colors.text.secondary, fontWeight: '500' },
  activeTabText: { color: colors.accent },
  tabContent: { padding: 16, paddingBottom: 40 },
  // Error
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
  errorActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  retryButtonText: { color: colors.text.onAccent, fontWeight: '600' },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
  },
  errorButtonText: { color: colors.text.primary, fontWeight: '600' },
  // Chat bubbles
  bubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: colors.accent,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.bg.elevated,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  assistantLabel: { fontSize: 12, fontWeight: '600', color: colors.accent },
  userText: { color: colors.text.onAccent, fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 11, color: colors.text.muted, marginTop: 6, alignSelf: 'flex-end' },
  attachmentContainer: { marginBottom: 10, borderRadius: 8, overflow: 'hidden' },
  attachmentImage: { width: 200, height: 150, borderRadius: 8 },
  pdfAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.muted,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  pdfText: { color: colors.text.primary, fontSize: 14, flex: 1 },
  // Notes
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22 },
  ownerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.status.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInitial: { fontSize: 18, fontWeight: '600', color: colors.white },
  ownerDetails: { marginLeft: 12, flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  ownerDate: { fontSize: 13, color: colors.text.muted, marginTop: 2 },
  section: {
    backgroundColor: colors.bg.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.accent, marginBottom: 12 },
  sectionText: { fontSize: 15, color: colors.text.light, lineHeight: 22 },
  schematicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  schematicInfo: { flex: 1 },
  schematicName: { fontSize: 15, fontWeight: '500', color: colors.text.primary },
  schematicMeta: { fontSize: 13, color: colors.text.muted, marginTop: 2 },
  // Measurements
  measurementsTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 12 },
  measurementCard: {
    backgroundColor: colors.bg.surface,
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
  measurementNode: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  measurementDot: { width: 12, height: 12, borderRadius: 6 },
  measurementValues: { flexDirection: 'row', justifyContent: 'space-between' },
  measurementLabel: { fontSize: 11, color: colors.text.muted, marginBottom: 2 },
  measurementValue: { fontSize: 18, fontWeight: '600', color: colors.accent },
  measurementExpectedCol: { alignItems: 'flex-end' },
  measurementExpected: { fontSize: 14, color: colors.text.secondary },
  measurementNotes: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Gallery
  galleryButton: { position: 'relative', padding: 8 },
  galleryBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  galleryBadgeText: { color: colors.text.onAccent, fontSize: 11, fontWeight: 'bold' },
  galleryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  galleryContent: { flex: 1, paddingTop: 60 },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  galleryTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  galleryItem: { width: '33.33%', aspectRatio: 1, padding: 4 },
  galleryImage: { width: '100%', height: '100%', borderRadius: 8 },
  galleryPdf: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPdfText: { color: colors.text.secondary, fontSize: 11, marginTop: 4 },
});
