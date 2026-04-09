import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { jobsApi, chatsApi, repairActionsApi } from '../../src/services';
import { colors } from '../../src/theme';
import type { ChatMessage, Attachment, RepairAction } from '../../src/types';
import { useFileUpload } from '../../src/hooks';
import { showAlert, showConfirm, showError, formatAmpName } from '../../src/utils';
import { LoadingScreen } from '../../src/components/shared';
import { MessageList, ChatInput } from '../../src/components/chat';
import {
  AttachmentPickerModal,
  showAttachmentOptions,
} from '../../src/components/chat/AttachmentPicker';
import { AttachmentPreview } from '../../src/components/chat/AttachmentPreview';
import {
  WorkflowProgress,
  JobHeader,
  JobNotesTab,
  JobMeasurementsTab,
  JobRepairsTab,
  JobRepairFormModal,
  JobStatusPickerModal,
  JobShareModal,
  JobEditAmpModal,
  JobCustomerModal,
  JobMediaGalleryModal,
  EMPTY_REPAIR_FORM,
} from '../../src/components/job';
import type { JobData, JobTabType, RepairFormState } from '../../src/components/job';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [activeTab, setActiveTab] = useState<JobTabType>('chat');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [chatSendingText, setChatSendingText] = useState('Thinking...');
  const streamAbortRef = useRef<(() => void) | null>(null);

  // File upload (chat attachments)
  const {
    uploading: uploadingImage,
    pendingAttachments,
    pickImage,
    pickDocument,
    removeAttachment,
    clearAttachments,
    uploadFile,
  } = useFileUpload();

  // Repair photo upload state
  const [repairPhotoUrl, setRepairPhotoUrl] = useState<string | null>(null);
  const [uploadingRepairPhoto, setUploadingRepairPhoto] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Notes state
  const [techNotes, setTechNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status state
  const [currentStatus, setCurrentStatus] = useState('active');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Sharing state
  const [isPublic, setIsPublic] = useState(false);
  const [shareAnonymously, setShareAnonymously] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Edit modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ make: '', model: '', year: '', circuitFamily: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [customerForm, setCustomerForm] = useState({ customerName: '', customerPhone: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Media gallery
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // Repair actions
  const [showAddRepair, setShowAddRepair] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairAction | null>(null);
  const [repairForm, setRepairForm] = useState<RepairFormState>(EMPTY_REPAIR_FORM);
  const [savingRepair, setSavingRepair] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const fetchJobData = async () => {
      try {
        const data = await jobsApi.get(id);
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
        const data = await jobsApi.getChat(id);
        setChatId(data.chat.id);
        setChatMessages(data.messages);
      } catch (error) {
        console.error('Error fetching job chat:', error);
        showError('Failed to load chat — tap the Chat tab to retry');
      }
    };
    fetchJobData();
    fetchJobChat();
  }, [id]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/jobs' as any);
  }, [router]);

  // ── Job Actions ──────────────────────────────────────────────────────────

  const deleteJob = useCallback(async () => {
    const jobName = formatAmpName(jobData?.ampProfile, 'this job');
    const confirmed = await showConfirm(
      'Delete Job',
      `Delete "${jobName}"? This will permanently remove the job, chat history, and measurements.`,
      { confirmText: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await jobsApi.delete(id!);
      router.replace('/(tabs)/jobs' as any);
    } catch (error) {
      console.error('Error deleting job:', error);
      showError('Failed to delete job');
    }
  }, [id, jobData?.ampProfile, router]);

  const updateJobStatus = useCallback(async (newStatus: string) => {
    const oldStatus = currentStatus;
    setCurrentStatus(newStatus);
    setShowStatusPicker(false);
    try {
      await jobsApi.updateStatus(id!, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      setCurrentStatus(oldStatus);
    }
  }, [id, currentStatus]);

  const toggleSharing = useCallback(async (field: 'isPublic' | 'shareAnonymously', value: boolean) => {
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
  }, [id, isPublic, shareAnonymously]);

  // ── Notes ────────────────────────────────────────────────────────────────

  const saveNotes = useCallback(async (notes: string) => {
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
  }, [id]);

  const handleNotesChange = useCallback((text: string) => {
    setTechNotes(text);
    setNotesSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveNotes(text), 1500);
  }, [saveNotes]);

  // ── Edit amp ─────────────────────────────────────────────────────────────

  const openEditModal = useCallback(() => {
    if (jobData) {
      setEditForm({
        make: jobData.ampProfile.make || '',
        model: jobData.ampProfile.model || '',
        year: jobData.ampProfile.year || '',
        circuitFamily: jobData.ampProfile.circuitFamily || '',
      });
      setShowEditModal(true);
    }
  }, [jobData]);

  const saveAmpProfile = useCallback(async () => {
    if (!id) return;
    if (!editForm.make.trim() && !editForm.model.trim()) {
      showAlert('Required', 'Please enter at least a make or model');
      return;
    }
    setSavingEdit(true);
    try {
      await jobsApi.updateAmpProfile(id, {
        make: editForm.make.trim(),
        model: editForm.model.trim(),
        year: editForm.year.trim(),
        circuitFamily: editForm.circuitFamily.trim(),
      });
      setJobData((prev) =>
        prev ? {
          ...prev,
          ampProfile: {
            ...prev.ampProfile,
            make: editForm.make.trim(),
            model: editForm.model.trim(),
            year: editForm.year.trim(),
            circuitFamily: editForm.circuitFamily.trim(),
          },
        } : null,
      );
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating amp profile:', error);
      showError('Failed to update job');
    } finally {
      setSavingEdit(false);
    }
  }, [id, editForm]);

  // ── Customer ─────────────────────────────────────────────────────────────

  const openCustomerModal = useCallback(() => {
    setCustomerForm({
      customerName: jobData?.job.customerName || '',
      customerPhone: jobData?.job.customerPhone || '',
    });
    setShowCustomerModal(true);
  }, [jobData?.job.customerName, jobData?.job.customerPhone]);

  const saveCustomer = useCallback(async () => {
    if (!id) return;
    setSavingCustomer(true);
    try {
      await jobsApi.updateCustomer(id, customerForm);
      setJobData((prev) =>
        prev ? {
          ...prev,
          job: {
            ...prev.job,
            customerName: customerForm.customerName || null,
            customerPhone: customerForm.customerPhone || null,
          },
        } : null,
      );
      setShowCustomerModal(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      showError('Failed to update customer');
    } finally {
      setSavingCustomer(false);
    }
  }, [id, customerForm]);

  // ── Repair actions ───────────────────────────────────────────────────────

  const openAddRepairModal = useCallback(() => {
    setEditingRepair(null);
    setRepairForm(EMPTY_REPAIR_FORM);
    setRepairPhotoUrl(null);
    setShowAddRepair(true);
  }, []);

  const openEditRepairModal = useCallback((action: RepairAction) => {
    setEditingRepair(action);
    setRepairForm({
      description: action.description,
      partReplaced: action.partReplaced || '',
      partValue: action.partValue || '',
      partBrand: action.partBrand || '',
      voltageRating: action.voltageRating || '',
      dateCode: action.dateCode || '',
      beforeMeasurement: action.beforeMeasurement || '',
      afterMeasurement: action.afterMeasurement || '',
      notes: action.notes || '',
    });
    setRepairPhotoUrl(action.photoUrl || null);
    setShowAddRepair(true);
  }, []);

  const pickRepairPhoto = useCallback(async (useCamera: boolean) => {
    const ImagePicker = require('expo-image-picker');
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Camera permission is required');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Photo library permission is required');
        return;
      }
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setUploadingRepairPhoto(true);
      const url = await uploadFile(result.assets[0].uri, 'repair-' + Date.now() + '.jpg', 'image/jpeg');
      setUploadingRepairPhoto(false);
      if (url) setRepairPhotoUrl(url);
      else showError('Failed to upload photo');
    }
  }, [uploadFile]);

  const saveRepairAction = useCallback(async () => {
    if (!repairForm.description.trim()) {
      showError('Description is required');
      return;
    }
    setSavingRepair(true);
    try {
      if (editingRepair) {
        const updated = await repairActionsApi.update(editingRepair.id, {
          ...repairForm,
          benchJobId: id!,
          photoUrl: repairPhotoUrl || undefined,
        });
        setJobData((prev) =>
          prev ? {
            ...prev,
            repairActions: prev.repairActions.map((a) => a.id === updated.id ? updated : a),
          } : null,
        );
      } else {
        const created = await repairActionsApi.create({
          ...repairForm,
          benchJobId: id!,
          photoUrl: repairPhotoUrl || undefined,
        });
        setJobData((prev) =>
          prev ? { ...prev, repairActions: [created, ...prev.repairActions] } : null,
        );
      }
      setShowAddRepair(false);
    } catch (error) {
      console.error('Error saving repair action:', error);
      showError('Failed to save repair action');
    } finally {
      setSavingRepair(false);
    }
  }, [editingRepair, id, repairForm, repairPhotoUrl]);

  const deleteRepairAction = useCallback(async (actionId: string) => {
    const confirmed = await showConfirm(
      'Delete Repair Action',
      'Remove this repair action? This cannot be undone.',
      { confirmText: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await repairActionsApi.remove(actionId);
      setJobData((prev) =>
        prev ? { ...prev, repairActions: prev.repairActions.filter((a) => a.id !== actionId) } : null,
      );
    } catch (error) {
      console.error('Error deleting repair action:', error);
      showError('Failed to delete repair action');
    }
  }, []);

  // ── Chat ─────────────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(async () => {
    if ((!chatInput.trim() && pendingAttachments.length === 0) || !chatId || sendingChat) return;
    Keyboard.dismiss();
    const messageText = chatInput.trim();
    const attachmentsToSend = [...pendingAttachments];
    setChatInput('');
    clearAttachments();
    setSendingChat(true);
    setStreamingText('');
    setChatSendingText('Thinking...');

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
        (token) => { setStreamingText((prev) => prev + token); },
        attachmentsToSend.length > 0 ? attachmentsToSend : null,
        (status) => { setChatSendingText(status); },
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
      showError('Message failed to send — please try again');
    } finally {
      setSendingChat(false);
    }
  }, [chatInput, chatId, sendingChat, pendingAttachments, clearAttachments]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const allAttachments: Attachment[] = useMemo(
    () => chatMessages.flatMap((msg) => msg.attachments || []),
    [chatMessages],
  );

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

  const { job, ampProfile, measurements, repairActions } = jobData;

  // ── Chat tab (kept inline because of streaming + attachment state coupling) ─

  const renderChatTab = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={280}
    >
      <MessageList
        messages={chatMessages}
        sending={sendingChat}
        sendingText={chatSendingText}
        streamingText={streamingText}
        assistantName="Assistant"
        emptyContent={
          <View style={styles.welcomeContainer}>
            <Ionicons name="hardware-chip" size={48} color={colors.accent} />
            <Text style={styles.welcomeTitle}>Job Assistant</Text>
            <Text style={styles.welcomeText}>
              Ask questions about this {ampProfile?.make} {ampProfile?.model}.
              Upload photos for identification or troubleshooting help.
            </Text>
            <Text style={styles.aiDisclaimer}>
              AI responses may contain errors. Always verify measurements and safety procedures independently.
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
        onChangeText={setChatInput}
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

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <JobHeader
        jobData={jobData}
        currentStatus={currentStatus}
        isPublic={isPublic}
        activeTab={activeTab}
        attachmentCount={allAttachments.length}
        onBack={goBack}
        onEditAmp={openEditModal}
        onEditCustomer={openCustomerModal}
        onOpenStatusPicker={() => setShowStatusPicker(true)}
        onOpenShareModal={() => setShowShareModal(true)}
        onOpenGallery={() => setShowMediaGallery(true)}
        onDeleteJob={deleteJob}
      />

      <WorkflowProgress
        safetyDone={job.safetyChecklistCompleted}
        diagnoseDone={chatMessages.length > 0}
        measureDone={measurements.length > 0}
        repairDone={repairActions.length > 0}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['chat', 'notes', 'measurements', 'repairs'] as JobTabType[]).map((tab) => {
          const icons: Record<JobTabType, string> = { chat: 'chatbubbles', notes: 'document-text', measurements: 'analytics', repairs: 'construct' };
          const labels: Record<JobTabType, string> = { chat: 'Chat', notes: 'Notes', measurements: 'Readings', repairs: 'Repairs' };
          const counts: Record<JobTabType, number> = { chat: 0, notes: 0, measurements: measurements.length, repairs: repairActions.length };
          const count = counts[tab];
          return (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
              <View style={styles.tabIconWrap}>
                <Ionicons name={icons[tab] as any} size={20} color={activeTab === tab ? colors.accent : colors.text.secondary} />
                {count > 0 && (
                  <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                    <Text style={styles.tabBadgeText}>{count}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'chat' && renderChatTab()}
        {activeTab === 'notes' && (
          <JobNotesTab
            job={job}
            techNotes={techNotes}
            savingNotes={savingNotes}
            notesSaved={notesSaved}
            isPublic={isPublic}
            shareAnonymously={shareAnonymously}
            savingShare={savingShare}
            onChangeNotes={handleNotesChange}
            onTogglePublic={(value) => toggleSharing('isPublic', value)}
            onToggleAnonymous={(value) => toggleSharing('shareAnonymously', value)}
          />
        )}
        {activeTab === 'measurements' && (
          <JobMeasurementsTab
            measurements={measurements}
            onAdd={() => {
              const params = new URLSearchParams({ benchJobId: id! });
              if (ampProfile?.circuitFamily) params.append('circuitFamily', ampProfile.circuitFamily);
              if (ampProfile) params.append('jobName', `${ampProfile.make || ''} ${ampProfile.model || ''}`.trim());
              router.push(`/measurement?${params.toString()}` as any);
            }}
          />
        )}
        {activeTab === 'repairs' && (
          <JobRepairsTab
            repairActions={repairActions}
            onAdd={openAddRepairModal}
            onEdit={openEditRepairModal}
            onDelete={deleteRepairAction}
          />
        )}
      </View>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      <AttachmentPickerModal
        visible={showAttachmentModal}
        onClose={() => setShowAttachmentModal(false)}
        onCamera={() => { setShowAttachmentModal(false); pickImage(true); }}
        onLibrary={() => { setShowAttachmentModal(false); pickImage(false); }}
        onDocument={() => { setShowAttachmentModal(false); pickDocument(); }}
      />

      <JobMediaGalleryModal
        visible={showMediaGallery}
        attachments={allAttachments}
        onClose={() => setShowMediaGallery(false)}
      />

      <JobStatusPickerModal
        visible={showStatusPicker}
        currentStatus={currentStatus}
        onClose={() => setShowStatusPicker(false)}
        onSelect={updateJobStatus}
      />

      <JobShareModal
        visible={showShareModal}
        isPublic={isPublic}
        shareAnonymously={shareAnonymously}
        saving={savingShare}
        onClose={() => setShowShareModal(false)}
        onTogglePublic={(value) => toggleSharing('isPublic', value)}
        onToggleAnonymous={(value) => toggleSharing('shareAnonymously', value)}
      />

      <JobEditAmpModal
        visible={showEditModal}
        form={editForm}
        saving={savingEdit}
        onClose={() => setShowEditModal(false)}
        onChange={setEditForm}
        onSave={saveAmpProfile}
      />

      <JobCustomerModal
        visible={showCustomerModal}
        form={customerForm}
        saving={savingCustomer}
        onClose={() => setShowCustomerModal(false)}
        onChange={setCustomerForm}
        onSave={saveCustomer}
      />

      <JobRepairFormModal
        visible={showAddRepair}
        isEditing={!!editingRepair}
        form={repairForm}
        photoUrl={repairPhotoUrl}
        uploadingPhoto={uploadingRepairPhoto}
        saving={savingRepair}
        onClose={() => setShowAddRepair(false)}
        onChange={setRepairForm}
        onPickPhoto={pickRepairPhoto}
        onClearPhoto={() => setRepairPhotoUrl(null)}
        onSave={saveRepairAction}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  errorContainer: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.status.error, fontSize: 18, marginBottom: 16 },
  backButton: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: colors.text.onAccent, fontWeight: '600' },

  // Chat welcome
  welcomeContainer: { alignItems: 'center', paddingVertical: 40 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text.bright, marginTop: 16, marginBottom: 8 },
  welcomeText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
  aiDisclaimer: { color: colors.text.muted, fontSize: 11, textAlign: 'center', marginTop: 16, fontStyle: 'italic', paddingHorizontal: 16, lineHeight: 16 },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  activeTabText: { color: colors.accent },
  content: { flex: 1 },

  // Tab badges
  tabIconWrap: { position: 'relative' },
  tabBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: colors.bg.elevated, borderRadius: 8,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  tabBadgeActive: { backgroundColor: colors.accent },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text.onAccent },
});
