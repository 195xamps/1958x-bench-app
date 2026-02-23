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
  Keyboard,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { jobsApi, chatsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { JOB_STATUSES, getStatusConfig } from '../../src/types/common';
import type { ChatMessage, Attachment, Measurement } from '../../src/types';
import { useFileUpload } from '../../src/hooks';
import {
  showAlert,
  showConfirm,
  showError,
  formatTimestamp,
  formatAmpName,
  openUrl,
} from '../../src/utils';
import { LoadingScreen } from '../../src/components/shared';
import { MessageList, ChatInput } from '../../src/components/chat';
import {
  AttachmentPickerModal,
  showAttachmentOptions,
} from '../../src/components/chat/AttachmentPicker';
import { AttachmentPreview } from '../../src/components/chat/AttachmentPreview';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabType = 'chat' | 'notes' | 'measurements';

interface JobData {
  job: {
    id: string;
    status: string;
    ownerSymptoms: string;
    techNotes: string;
    priorWork: string;
    knownMods: string;
    safetyChecklistCompleted: boolean;
    isPublic: boolean;
    shareAnonymously: boolean;
    createdAt: string;
    updatedAt: string;
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInput, setChatInputText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const streamAbortRef = useRef<(() => void) | null>(null);

  // File upload hook
  const {
    uploading: uploadingImage,
    pendingAttachments,
    pickImage,
    pickDocument,
    removeAttachment,
    clearAttachments,
  } = useFileUpload();
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Notes state
  const [techNotes, setTechNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Status state
  const [currentStatus, setCurrentStatus] = useState('active');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Sharing state
  const [isPublic, setIsPublic] = useState(false);
  const [shareAnonymously, setShareAnonymously] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ jobName: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Media gallery
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (id) {
      fetchJobData();
      fetchJobChat();
    }
  }, [id]);

  const fetchJobData = async () => {
    try {
      const data = await jobsApi.get(id!);
      setJobData(data);
      setTechNotes(data.job.techNotes || '');
      setCurrentStatus(data.job.status || 'active');
      setIsPublic(data.job.isPublic || false);
      setShareAnonymously(data.job.shareAnonymously || false);
    } catch (error) {
      console.error('Error fetching job:', error);
      showError('Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobChat = async () => {
    try {
      const data = await jobsApi.getChat(id!);
      setChatId(data.chat.id);
      setChatMessages(data.messages);
    } catch (error) {
      console.error('Error fetching job chat:', error);
    }
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/jobs' as any);
  };

  // ── Job Actions ──────────────────────────────────────────────────────────

  const deleteJob = async () => {
    const jobName = formatAmpName(jobData?.ampProfile, 'this job');
    const confirmed = await showConfirm(
      'Delete Job',
      `Delete "${jobName}"? This will permanently remove the job, chat history, and measurements.`,
      { confirmText: 'Delete', destructive: true },
    );
    if (confirmed) {
      try {
        await jobsApi.delete(id!);
        router.replace('/(tabs)/jobs' as any);
      } catch (error) {
        console.error('Error deleting job:', error);
        showError('Failed to delete job');
      }
    }
  };

  const updateJobStatus = async (newStatus: string) => {
    const oldStatus = currentStatus;
    setCurrentStatus(newStatus);
    setShowStatusPicker(false);
    try {
      await jobsApi.updateStatus(id!, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      setCurrentStatus(oldStatus);
    }
  };

  const toggleSharing = async (field: 'isPublic' | 'shareAnonymously', value: boolean) => {
    if (!id) return;
    setSavingShare(true);
    const oldPublic = isPublic;
    const oldAnon = shareAnonymously;
    if (field === 'isPublic') {
      setIsPublic(value);
      if (!value) setShareAnonymously(false);
    } else {
      setShareAnonymously(value);
    }
    try {
      const updates = field === 'isPublic'
        ? { isPublic: value, shareAnonymously: value ? shareAnonymously : false }
        : { shareAnonymously: value };
      await jobsApi.updateSharing(id, updates);
    } catch (error) {
      console.error('Error updating sharing:', error);
      setIsPublic(oldPublic);
      setShareAnonymously(oldAnon);
    } finally {
      setSavingShare(false);
    }
  };

  // ── Notes ────────────────────────────────────────────────────────────────

  const handleNotesChange = (text: string) => {
    setTechNotes(text);
    setNotesSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveNotes(text), 1500);
  };

  const saveNotes = async (notes: string) => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const result = await jobsApi.updateNotes(id, notes);
      if (result) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const openEditModal = () => {
    if (jobData) {
      setEditForm({ jobName: formatAmpName(jobData.ampProfile) });
      setShowEditModal(true);
    }
  };

  const saveAmpProfile = async () => {
    if (!id) return;
    setSavingEdit(true);
    try {
      await jobsApi.updateAmpProfile(id, { make: '', model: editForm.jobName });
      setJobData((prev) =>
        prev ? { ...prev, ampProfile: { ...prev.ampProfile, make: '', model: editForm.jobName } } : null,
      );
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating amp profile:', error);
      showError('Failed to update job');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Chat ─────────────────────────────────────────────────────────────────

  const sendChatMessage = async () => {
    if ((!chatInput.trim() && pendingAttachments.length === 0) || !chatId || sendingChat) return;
    Keyboard.dismiss();
    const messageText = chatInput.trim();
    const attachmentsToSend = [...pendingAttachments];
    setChatInputText('');
    clearAttachments();
    setSendingChat(true);
    setStreamingText('');

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
      const { promise, abort } = chatsApi.streamMessage(
        chatId,
        messageText,
        (token) => { setStreamingText(prev => prev + token); },
        attachmentsToSend.length > 0 ? attachmentsToSend : null,
      );
      streamAbortRef.current = abort;

      const data = await promise;
      streamAbortRef.current = null;

      setChatMessages((prev) => [
        ...prev.filter((m) => m.id !== 'temp-user'),
        data.userMessage,
        data.assistantMessage,
      ]);
      setStreamingText('');
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      setStreamingText('');
    } finally {
      setSendingChat(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getAllAttachments = (): Attachment[] => {
    return chatMessages.flatMap((msg) => msg.attachments || []);
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return colors.text.muted;
    if (status === 'in_range' || status === 'green') return colors.status.success;
    if (status === 'warning' || status === 'yellow') return colors.status.warning;
    if (status === 'out_of_range' || status === 'red') return colors.status.error;
    return colors.text.muted;
  };

  const currentStatusConfig = getStatusConfig(currentStatus);

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Loading job..." />;

  if (!jobData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Job not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { job, ampProfile, measurements } = jobData;

  // ── Tab Renderers ────────────────────────────────────────────────────────

  const renderChatTab = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={280}
    >
      <MessageList
        messages={chatMessages}
        sending={sendingChat}
        streamingText={streamingText}
        assistantName="Assistant"
        emptyContent={
          <View style={styles.welcomeContainer}>
            <Ionicons name="hardware-chip" size={48} color={colors.accent} />
            <Text style={styles.welcomeTitle}>Job Assistant</Text>
            <Text style={styles.welcomeText}>
              Ask questions about this {ampProfile.make} {ampProfile.model}.
              Upload photos for identification or troubleshooting help.
            </Text>
          </View>
        }
      />
      <AttachmentPreview
        attachments={pendingAttachments}
        onRemove={removeAttachment}
        uploading={uploadingImage}
      />
      <ChatInput
        value={chatInput}
        onChangeText={setChatInputText}
        onSend={sendChatMessage}
        onAttach={() =>
          showAttachmentOptions(
            () => pickImage(true),
            () => pickImage(false),
            pickDocument,
            () => setShowAttachmentModal(true),
          )
        }
        sending={sendingChat}
        uploading={uploadingImage}
        placeholder="Ask about this amp..."
        canSend={chatInput.trim().length > 0 || pendingAttachments.length > 0}
      />
    </KeyboardAvoidingView>
  );

  const renderNotesTab = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.notesHeader}>
          <View>
            <Text style={styles.notesTitle}>Repair Notes</Text>
            {job.updatedAt && (
              <Text style={styles.notesLastUpdated}>Last updated: {formatTimestamp(job.updatedAt)}</Text>
            )}
          </View>
          <View style={styles.saveStatus}>
            {savingNotes && (
              <>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.saveStatusText}>Saving...</Text>
              </>
            )}
            {notesSaved && !savingNotes && (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
                <Text style={[styles.saveStatusText, { color: colors.status.success }]}>Saved</Text>
              </>
            )}
          </View>
        </View>

        <TextInput
          style={styles.notesInput}
          value={techNotes}
          onChangeText={handleNotesChange}
          placeholder="Add repair notes, parts replaced, observations..."
          placeholderTextColor={colors.text.muted}
          multiline
          textAlignVertical="top"
        />

        {job.ownerSymptoms ? <InfoBlock label="Owner's Symptoms" text={job.ownerSymptoms} /> : null}
        {job.priorWork ? <InfoBlock label="Prior Work" text={job.priorWork} /> : null}
        {job.knownMods ? <InfoBlock label="Known Modifications" text={job.knownMods} /> : null}

        {/* Sharing section */}
        <View style={styles.shareSection}>
          <View style={styles.shareSectionHeader}>
            <Ionicons name="globe-outline" size={20} color={colors.accent} />
            <Text style={styles.shareSectionTitle}>Community Sharing</Text>
            {savingShare && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
          </View>
          <Text style={styles.shareSectionDescription}>
            Share this job with the community so other technicians can learn from your work.
          </Text>
          <ToggleRow
            label="Share to Community Bench"
            hint="Other technicians can view this job (read-only)"
            value={isPublic}
            onToggle={() => toggleSharing('isPublic', !isPublic)}
            disabled={savingShare}
          />
          {isPublic && (
            <ToggleRow
              label="Share Anonymously"
              hint="Hide your name from the shared job"
              value={shareAnonymously}
              onToggle={() => toggleSharing('shareAnonymously', !shareAnonymously)}
              disabled={savingShare}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderMeasurementsTab = () => (
    <ScrollView style={styles.measurementsContainer}>
      <View style={styles.measurementsHeader}>
        <Text style={styles.measurementsTitle}>Measurements</Text>
        <TouchableOpacity
          style={styles.addMeasurementButton}
          onPress={() => router.push(`/measurement?benchJobId=${id}`)}
        >
          <Ionicons name="add" size={20} color={colors.text.onAccent} />
          <Text style={styles.addMeasurementText}>Add</Text>
        </TouchableOpacity>
      </View>
      {measurements.length === 0 ? (
        <View style={styles.emptyMeasurements}>
          <Ionicons name="analytics-outline" size={48} color={colors.bg.elevated} />
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

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={28} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={openEditModal}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>{formatAmpName(ampProfile)}</Text>
            <Ionicons name="pencil" size={16} color={colors.text.muted} style={{ marginLeft: 6 }} />
          </View>
          <View style={styles.headerSecondRow}>
            <Text style={styles.headerSubtitle}>
              {ampProfile.circuitFamily && `${ampProfile.circuitFamily} • `}
              {ampProfile.year || 'Unknown year'}
            </Text>
            <TouchableOpacity
              style={[styles.statusBadge, { backgroundColor: currentStatusConfig.color + '20' }]}
              onPress={() => setShowStatusPicker(true)}
            >
              <View style={[styles.statusDot, { backgroundColor: currentStatusConfig.color }]} />
              <Text style={[styles.statusBadgeText, { color: currentStatusConfig.color }]}>
                {currentStatusConfig.label}
              </Text>
              <Ionicons name="chevron-down" size={14} color={currentStatusConfig.color} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.shareButton, isPublic && styles.shareButtonActive]}
            onPress={() => setShowShareModal(true)}
          >
            <Ionicons name={isPublic ? 'globe' : 'globe-outline'} size={22} color={isPublic ? colors.status.success : colors.text.secondary} />
          </TouchableOpacity>
          {activeTab === 'chat' && (
            <TouchableOpacity style={styles.galleryButton} onPress={() => setShowMediaGallery(true)}>
              <Ionicons name="images-outline" size={22} color={colors.text.secondary} />
              {getAllAttachments().length > 0 && (
                <View style={styles.galleryBadge}>
                  <Text style={styles.galleryBadgeText}>{getAllAttachments().length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteJobButton} onPress={deleteJob}>
            <Ionicons name="trash-outline" size={22} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['chat', 'notes', 'measurements'] as TabType[]).map((tab) => {
          const icons: Record<TabType, string> = { chat: 'chatbubbles', notes: 'document-text', measurements: 'analytics' };
          const labels: Record<TabType, string> = { chat: 'Chat', notes: 'Notes', measurements: 'Measurements' };
          return (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
              <Ionicons name={icons[tab] as any} size={20} color={activeTab === tab ? colors.accent : colors.text.secondary} />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'chat' && renderChatTab()}
        {activeTab === 'notes' && renderNotesTab()}
        {activeTab === 'measurements' && renderMeasurementsTab()}
      </View>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      <AttachmentPickerModal
        visible={showAttachmentModal}
        onClose={() => setShowAttachmentModal(false)}
        onCamera={() => { setShowAttachmentModal(false); pickImage(true); }}
        onLibrary={() => { setShowAttachmentModal(false); pickImage(false); }}
        onDocument={() => { setShowAttachmentModal(false); pickDocument(); }}
      />

      {/* Media Gallery */}
      <Modal visible={showMediaGallery} transparent animationType="slide">
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryContainer}>
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Media Gallery</Text>
              <TouchableOpacity onPress={() => setShowMediaGallery(false)}>
                <Ionicons name="close" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            {getAllAttachments().length === 0 ? (
              <View style={styles.emptyGallery}>
                <Ionicons name="images-outline" size={48} color={colors.bg.elevated} />
                <Text style={styles.emptyGalleryText}>No attachments yet</Text>
              </View>
            ) : (
              <ScrollView style={styles.galleryScroll}>
                <View style={styles.galleryGrid}>
                  {getAllAttachments().map((att, index) => (
                    <TouchableOpacity key={index} style={styles.galleryItem} onPress={() => openUrl(att.url)}>
                      {att.type === 'image' ? (
                        <Image source={{ uri: att.url }} style={styles.galleryImage} />
                      ) : (
                        <View style={styles.galleryPdf}>
                          <Ionicons name="document-text" size={32} color={colors.accent} />
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

      {/* Status Picker */}
      <Modal visible={showStatusPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Update Status</Text>
            {JOB_STATUSES.filter((s) => s.value !== 'all').map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[styles.pickerOption, currentStatus === status.value && styles.pickerOptionSelected]}
                onPress={() => updateJobStatus(status.value)}
              >
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.pickerOptionText, { color: status.color }]}>{status.label}</Text>
                {currentStatus === status.value && (
                  <Ionicons name="checkmark" size={20} color={status.color} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Share Modal */}
      <Modal visible={showShareModal} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowShareModal(false)}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Ionicons name="globe-outline" size={24} color={colors.accent} />
              <Text style={styles.shareModalTitle}>Community Sharing</Text>
            </View>
            <Text style={styles.shareModalDescription}>
              Share this job with the community so other technicians can learn from your work.
            </Text>
            <ToggleRow
              label="Share to Community Bench"
              hint="Other technicians can view this job (read-only)"
              value={isPublic}
              onToggle={() => toggleSharing('isPublic', !isPublic)}
              disabled={savingShare}
            />
            {isPublic && (
              <ToggleRow
                label="Share Anonymously"
                hint="Hide your name from the shared job"
                value={shareAnonymously}
                onToggle={() => toggleSharing('shareAnonymously', !shareAnonymously)}
                disabled={savingShare}
              />
            )}
            {savingShare && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowShareModal(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Job</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.editModalForm}>
              <Text style={styles.editLabel}>Job Name</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.jobName}
                onChangeText={(text) => setEditForm({ jobName: text })}
                placeholder="e.g., John's Deluxe Reverb, 1965 Twin, etc."
                placeholderTextColor={colors.text.muted}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.editSaveButton, savingEdit && styles.buttonDisabled]}
              onPress={saveAmpProfile}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color={colors.text.onAccent} />
              ) : (
                <Text style={styles.editSaveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Small Reusable Components ───────────────────────────────────────────────

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.shareToggleRow} onPress={onToggle} disabled={disabled}>
      <View style={styles.shareToggleInfo}>
        <Text style={styles.shareToggleLabel}>{label}</Text>
        <Text style={styles.shareToggleHint}>{hint}</Text>
      </View>
      <View style={[styles.toggleSwitch, value && styles.toggleSwitchOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  errorContainer: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.status.error, fontSize: 18, marginBottom: 16 },
  backButton: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: colors.text.onAccent, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50,
    backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  headerBackButton: { marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  headerSecondRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  headerSubtitle: { fontSize: 14, color: colors.accent },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareButton: { padding: 8, borderRadius: 8 },
  shareButtonActive: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  galleryButton: { position: 'relative', padding: 8 },
  deleteJobButton: { padding: 8 },
  galleryBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: colors.accent, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  galleryBadgeText: { color: colors.bg.primary, fontSize: 11, fontWeight: 'bold' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, gap: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  activeTabText: { color: colors.accent },
  content: { flex: 1 },

  // Chat welcome
  welcomeContainer: { alignItems: 'center', paddingVertical: 40 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text.bright, marginTop: 16, marginBottom: 8 },
  welcomeText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },

  // Notes tab
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 8 },
  notesTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  notesLastUpdated: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveStatusText: { fontSize: 13, color: colors.accent },
  notesInput: {
    marginHorizontal: 16, backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16,
    color: colors.text.bright, fontSize: 15, lineHeight: 22, minHeight: 200, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.border.default,
  },
  infoSection: { marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: colors.bg.surface, borderRadius: 12 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 4 },
  infoText: { fontSize: 14, color: colors.text.bright, lineHeight: 20 },

  // Sharing section
  shareSection: { margin: 16, padding: 16, backgroundColor: colors.bg.surface, borderRadius: 12 },
  shareSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  shareSectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  shareSectionDescription: { fontSize: 13, color: colors.text.secondary, marginBottom: 16, lineHeight: 18 },
  shareToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  shareToggleInfo: { flex: 1, marginRight: 12 },
  shareToggleLabel: { fontSize: 15, fontWeight: '500', color: colors.text.bright },
  shareToggleHint: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  toggleSwitch: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: colors.bg.elevated,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleSwitchOn: { backgroundColor: colors.status.success },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white,
  },
  toggleKnobOn: { alignSelf: 'flex-end' },

  // Measurements tab
  measurementsContainer: { flex: 1, padding: 16 },
  measurementsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  measurementsTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  addMeasurementButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  addMeasurementText: { color: colors.text.onAccent, fontWeight: '600' },
  emptyMeasurements: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text.secondary, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.text.muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  measurementCard: {
    backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border.default,
  },
  measurementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  measurementNode: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  measurementValues: { flexDirection: 'row', gap: 16 },
  valueColumn: { flex: 1 },
  valueLabel: { fontSize: 12, color: colors.text.muted, marginBottom: 2 },
  valueText: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  expectedText: { fontSize: 14, color: colors.text.secondary },
  measurementNotes: { fontSize: 13, color: colors.text.muted, marginTop: 8, fontStyle: 'italic' },

  // Gallery modal
  galleryOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' },
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
  galleryPdfName: { color: colors.text.secondary, fontSize: 10, marginTop: 4, textAlign: 'center' },
  emptyGallery: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyGalleryText: { color: colors.text.secondary, fontSize: 18, fontWeight: '600', marginTop: 16 },

  // Status / share / edit modals
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 16, width: '100%', maxWidth: 320 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.bright, textAlign: 'center', marginBottom: 16 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10,
    marginBottom: 8, backgroundColor: colors.bg.elevated, gap: 10,
  },
  pickerOptionSelected: { borderWidth: 1, borderColor: colors.text.muted },
  pickerOptionText: { fontSize: 16, fontWeight: '500' },

  shareModalContent: {
    backgroundColor: colors.bg.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.default,
  },
  shareModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  shareModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  shareModalDescription: { fontSize: 14, color: colors.text.secondary, marginBottom: 20, lineHeight: 20 },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  savingText: { color: colors.accent, fontSize: 14 },
  doneButton: { backgroundColor: colors.bg.elevated, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  doneButtonText: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },

  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  editModalContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 24 },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editModalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  editModalForm: { marginBottom: 16 },
  editLabel: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: 8 },
  editInput: {
    backgroundColor: colors.bg.elevated, borderRadius: 10, padding: 14,
    color: colors.text.bright, fontSize: 16,
  },
  editSaveButton: {
    backgroundColor: colors.accent, padding: 16, borderRadius: 12, alignItems: 'center',
  },
  editSaveButtonText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});
