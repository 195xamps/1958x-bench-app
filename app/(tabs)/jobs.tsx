import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { jobsApi, chatsApi } from '../../src/services';
import { colors } from '../../src/theme';
import {
  JOB_STATUSES,
  SAFETY_CHECKLIST,
  getStatusConfig,
} from '../../src/types/common';
import type {
  JobWithProfile,
  CreateJobPayload,
  ChatMessage,
} from '../../src/types';
import { useDebounce } from '../../src/hooks';
import { showAlert, showConfirm, showError, formatDate, formatAmpName } from '../../src/utils';
import { LoadingScreen, EmptyState } from '../../src/components/shared';
import { MessageList, ChatInput } from '../../src/components/chat';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Search with debounce
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebounce(searchInput, 500);

  // New-job modal
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJob, setNewJob] = useState<CreateJobPayload>({
    ampMake: '',
    ampModel: '',
    ampYear: '',
    circuitFamily: '',
    ownerSymptoms: '',
    techNotes: '',
    priorWork: '',
    knownMods: '',
  });

  // Safety checklist modal
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<boolean[]>(
    new Array(SAFETY_CHECKLIST.length).fill(false),
  );

  // Job detail modal (preview before navigating)
  const [showJobDetailModal, setShowJobDetailModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithProfile | null>(null);

  // Inline job chat modal
  const [showJobChatModal, setShowJobChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatInput, setChatInputText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const [fetchError, setFetchError] = useState(false);
  const [creating, setCreating] = useState(false);
  const PAGE_SIZE = 20;
  const lastFetchRef = useRef<number>(0);

  const fetchJobs = async (loadMore = false) => {
    if (loadMore) setLoadingMore(true);
    setFetchError(false);
    try {
      const offset = loadMore ? jobs.length : 0;
      const result = await jobsApi.list({ status: statusFilter, search: searchQuery, limit: PAGE_SIZE, offset });
      if (loadMore) {
        setJobs(prev => [...prev, ...result.data]);
      } else {
        setJobs(result.data);
      }
      setHasMore(result.hasMore);
      lastFetchRef.current = Date.now();
    } catch (error) {
      console.error('Error fetching jobs:', error);
      if (!loadMore) setFetchError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [statusFilter, searchQuery]);

  useFocusEffect(
    React.useCallback(() => {
      const elapsed = (Date.now() - lastFetchRef.current) / 1000;
      if (elapsed > 30) { fetchJobs(); }
    }, [statusFilter, searchQuery]),
  );

  // ── Job CRUD ─────────────────────────────────────────────────────────────

  const createJob = async () => {
    if (!newJob.ampMake && !newJob.ampModel) {
      showAlert('Required', 'Please enter at least amp make or model');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const result = await jobsApi.create(newJob);
      setJobs([{ job: result.benchJob, ampProfile: result.ampProfile }, ...jobs]);
      setShowNewJobModal(false);
      setCurrentJobId(result.benchJob.id);
      setNewJob({ ampMake: '', ampModel: '', ampYear: '', circuitFamily: '', ownerSymptoms: '', techNotes: '', priorWork: '', knownMods: '' });
      setSafetyChecks(new Array(SAFETY_CHECKLIST.length).fill(false));
      setShowSafetyModal(true);
    } catch (error: any) {
      console.error('Error creating job:', error);
      showError(error?.response?.data?.error || 'Failed to create bench job. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const deleteJob = async (jobId: string, ampName: string) => {
    const confirmed = await showConfirm(
      'Delete Job',
      `Delete "${ampName}"? This will permanently remove the job, its chat history, and all measurements.`,
      { confirmText: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await jobsApi.delete(jobId);
      setShowJobDetailModal(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      showError('Failed to delete job');
    }
  };

  // ── Safety checklist ─────────────────────────────────────────────────────

  const toggleSafetyCheck = (index: number) => {
    const updated = [...safetyChecks];
    updated[index] = !updated[index];
    setSafetyChecks(updated);
  };

  const completeSafetyChecklist = async () => {
    if (!safetyChecks.every(Boolean)) {
      showAlert('Safety First', 'Please confirm all safety checks before proceeding');
      return;
    }
    try {
      await jobsApi.completeSafetyChecklist(currentJobId!);
      setShowSafetyModal(false);
      fetchJobs();
      showAlert('Ready to Proceed', 'Safety checklist completed. You may now begin troubleshooting.');
    } catch (error) {
      console.error('Error completing safety checklist:', error);
    }
  };

  // ── Inline chat ──────────────────────────────────────────────────────────

  const openJobChat = async (jobId: string) => {
    setShowJobDetailModal(false);
    setShowJobChatModal(true);
    try {
      const data = await jobsApi.getChat(jobId);
      setChatId(data.chat.id);
      setChatMessages(data.messages);
    } catch (error) {
      console.error('Error fetching job chat:', error);
    }
  };

  const sendJobChatMessage = async () => {
    if (!chatInput.trim() || !chatId || sendingChat) return;
    const messageText = chatInput.trim();
    setChatInputText('');
    setSendingChat(true);

    const tempMessage: ChatMessage = {
      id: 'temp-user',
      chatId,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempMessage]);

    try {
      const data = await chatsApi.sendMessage(chatId, messageText);
      setChatMessages((prev) => [
        ...prev.filter((m) => m.id !== 'temp-user'),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      showError('Failed to send message');
    } finally {
      setSendingChat(false);
    }
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const openJobDetail = (jobData: JobWithProfile) => {
    router.push(`/job/${jobData.job.id}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Loading bench jobs..." />;

  if (fetchError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <Ionicons name="cloud-offline-outline" size={64} color={colors.text.muted} />
        <Text style={{ color: colors.text.secondary, fontSize: 16 }}>Couldn&apos;t load bench jobs</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => { setLoading(true); fetchJobs(); }}
        >
          <Text style={{ color: colors.text.onAccent, fontWeight: '600', fontSize: 16 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bench Jobs</Text>
        <Text style={styles.subtitle}>Manage your amp repair jobs</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor={colors.text.muted}
          value={searchInput}
          onChangeText={setSearchInput}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => setSearchInput('')}>
            <Ionicons name="close-circle" size={20} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterContainer}>
        {JOB_STATUSES.map((status) => (
          <TouchableOpacity
            key={status.value}
            style={[
              styles.statusFilterTab,
              statusFilter === status.value && { backgroundColor: status.color + '30', borderColor: status.color },
            ]}
            onPress={() => setStatusFilter(status.value)}
          >
            <View style={[styles.statusFilterDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusFilterText, statusFilter === status.value && { color: status.color }]}>
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Job list */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.job.id}
        style={styles.scrollView}
        contentContainerStyle={jobs.length === 0 ? { flex: 1 } : undefined}
        renderItem={({ item: { job, ampProfile } }) => {
          const statusCfg = getStatusConfig(job.status || 'active');
          return (
            <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => openJobDetail({ job, ampProfile })}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobAmpName}>{formatAmpName(ampProfile)}</Text>
                <View style={styles.jobBadges}>
                  {job.safetyChecklistCompleted && (
                    <Ionicons name="shield-checkmark" size={18} color={colors.status.success} style={{ marginRight: 6 }} />
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                </View>
              </View>
              {ampProfile?.circuitFamily && <Text style={styles.jobCircuitFamily}>{ampProfile.circuitFamily}</Text>}
              <Text style={styles.jobSymptoms} numberOfLines={2}>
                {job.ownerSymptoms || 'No symptoms recorded'}
              </Text>
              <Text style={styles.jobDate}>{formatDate(job.createdAt)}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase-outline"
            title="No bench jobs yet"
            subtitle="Start a new job to begin troubleshooting"
          />
        }
        onEndReached={() => { if (hasMore && !loadingMore) fetchJobs(true); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 16 }} />
        ) : null}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNewJobModal(true)}>
        <Ionicons name="add" size={32} color={colors.text.onAccent} />
      </TouchableOpacity>

      {/* ── New Job Modal ──────────────────────────────────────────────── */}
      <Modal visible={showNewJobModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Bench Job</Text>
                <TouchableOpacity onPress={() => setShowNewJobModal(false)}>
                  <Ionicons name="close" size={28} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionTitle}>Amp Identification</Text>
                {renderInput('Make', newJob.ampMake, (t) => setNewJob({ ...newJob, ampMake: t }), 'e.g., Fender, Marshall, Vox')}
                {renderInput('Model', newJob.ampModel, (t) => setNewJob({ ...newJob, ampModel: t }), 'e.g., Deluxe Reverb, JCM800')}
                {renderInput('Year (if known)', newJob.ampYear || '', (t) => setNewJob({ ...newJob, ampYear: t }), 'e.g., 1965, 1970s')}
                {renderInput('Circuit Family', newJob.circuitFamily || '', (t) => setNewJob({ ...newJob, circuitFamily: t }), 'e.g., AB763, 5E3, JTM45')}
                <Text style={styles.sectionTitle}>Problem Description</Text>
                {renderInput('Owner Symptoms', newJob.ownerSymptoms || '', (t) => setNewJob({ ...newJob, ownerSymptoms: t }), 'What is the owner experiencing?', true)}
                {renderInput('Known Mods', newJob.knownMods || '', (t) => setNewJob({ ...newJob, knownMods: t }), 'Any modifications to the original circuit?', true)}
                {renderInput('Prior Tech Work', newJob.priorWork || '', (t) => setNewJob({ ...newJob, priorWork: t }), 'Any previous repair attempts?', true)}
                {renderInput('Tech Notes', newJob.techNotes || '', (t) => setNewJob({ ...newJob, techNotes: t }), 'Initial observations...', true)}
              </ScrollView>
              <TouchableOpacity
                style={[styles.createButton, creating && { opacity: 0.6 }]}
                onPress={createJob}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color={colors.text.onAccent} />
                  : <Text style={styles.createButtonText}>Create Job & Safety Check</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Safety Checklist Modal ─────────────────────────────────────── */}
      <Modal visible={showSafetyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={28} color={colors.accent} />
              <Text style={styles.modalTitle}>Safety Checklist</Text>
            </View>
            <Text style={styles.safetyWarning}>
              HIGH VOLTAGE WARNING: Guitar amplifiers contain lethal voltages. Confirm each safety measure before proceeding.
            </Text>
            <ScrollView style={styles.modalScroll}>
              {SAFETY_CHECKLIST.map((item, index) => (
                <TouchableOpacity key={index} style={styles.checklistItem} onPress={() => toggleSafetyCheck(index)}>
                  <View style={[styles.checkbox, safetyChecks[index] && styles.checkboxChecked]}>
                    {safetyChecks[index] && <Ionicons name="checkmark" size={18} color={colors.text.onAccent} />}
                  </View>
                  <Text style={styles.checklistText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.safetyButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSafetyModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !safetyChecks.every(Boolean) && styles.buttonDisabled]}
                onPress={completeSafetyChecklist}
              >
                <Text style={styles.confirmButtonText}>Confirm & Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Job Detail Modal ───────────────────────────────────────────── */}
      <Modal visible={showJobDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{formatAmpName(selectedJob?.ampProfile)}</Text>
              <TouchableOpacity onPress={() => setShowJobDetailModal(false)}>
                <Ionicons name="close" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {selectedJob?.ampProfile?.year && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Year</Text>
                  <Text style={styles.detailValue}>{selectedJob.ampProfile.year}</Text>
                </View>
              )}
              {selectedJob?.ampProfile?.circuitFamily && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Circuit Family</Text>
                  <Text style={styles.detailValue}>{selectedJob.ampProfile.circuitFamily}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{selectedJob?.job.status}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Safety Checked</Text>
                <Text style={styles.detailValue}>{selectedJob?.job.safetyChecklistCompleted ? 'Yes' : 'No'}</Text>
              </View>
              {selectedJob?.job.ownerSymptoms && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Owner Symptoms</Text>
                  <Text style={styles.detailText}>{selectedJob.job.ownerSymptoms}</Text>
                </View>
              )}
              {selectedJob?.job.techNotes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Tech Notes</Text>
                  <Text style={styles.detailText}>{selectedJob.job.techNotes}</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.chatButton} onPress={() => selectedJob && openJobChat(selectedJob.job.id)}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.text.onAccent} />
              <Text style={styles.chatButtonText}>Open Job Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => selectedJob && deleteJob(selectedJob.job.id, formatAmpName(selectedJob.ampProfile, 'Unknown Amp'))}
            >
              <Ionicons name="trash-outline" size={22} color={colors.white} />
              <Text style={styles.deleteButtonText}>Delete Job</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Job Chat Modal ─────────────────────────────────────────────── */}
      <Modal visible={showJobChatModal} animationType="slide">
        <KeyboardAvoidingView style={styles.chatModalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatModalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowJobChatModal(false);
                setChatMessages([]);
                setChatId(null);
              }}
            >
              <Ionicons name="arrow-back" size={28} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.chatModalTitle} numberOfLines={1}>
              {formatAmpName(selectedJob?.ampProfile)} Chat
            </Text>
            <View style={{ width: 28 }} />
          </View>
          <MessageList
            messages={chatMessages}
            sending={sendingChat}
            assistantName="Job Assistant"
            emptyContent={
              <View style={styles.welcomeContainer}>
                <Ionicons name="hardware-chip" size={48} color={colors.accent} />
                <Text style={styles.welcomeTitle}>Job Assistant</Text>
                <Text style={styles.welcomeText}>
                  Ask questions specific to this job. The assistant knows the amp details and can help troubleshoot.
                </Text>
              </View>
            }
          />
          <ChatInput
            value={chatInput}
            onChangeText={setChatInputText}
            onSend={sendJobChatMessage}
            sending={sendingChat}
            placeholder="Ask about this amp..."
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function renderInput(
  label: string,
  value: string,
  onChange: (text: string) => void,
  placeholder: string,
  multiline = false,
) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollView: { flex: 1, padding: 16 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text.bright },
  subtitle: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface,
    borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 12, height: 44,
  },
  searchInput: { flex: 1, color: colors.text.bright, fontSize: 16, height: '100%' },

  // Status filter
  statusFilterContainer: { flexGrow: 0, paddingHorizontal: 12, marginBottom: 8 },
  statusFilterTab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, marginHorizontal: 4, borderWidth: 1, borderColor: colors.bg.elevated,
    backgroundColor: colors.bg.surface,
  },
  statusFilterDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusFilterText: { fontSize: 13, fontWeight: '500', color: colors.text.secondary },

  // Job card
  jobCard: {
    backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.bg.elevated,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  jobAmpName: { fontSize: 18, fontWeight: '600', color: colors.text.bright, flex: 1, marginRight: 8 },
  jobBadges: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  jobCircuitFamily: { fontSize: 13, color: colors.accent, marginBottom: 4 },
  jobSymptoms: { fontSize: 14, color: colors.text.secondary, marginBottom: 4 },
  jobDate: { fontSize: 12, color: colors.text.muted },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },

  // Modal common
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.bg.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright, flex: 1 },
  modalScroll: { paddingHorizontal: 20, paddingTop: 8 },

  // New-job form
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 16, marginBottom: 8 },
  inputLabel: { fontSize: 13, color: colors.text.secondary, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: colors.bg.elevated, borderRadius: 10, padding: 14, color: colors.text.bright,
    fontSize: 15, borderWidth: 1, borderColor: colors.bg.elevated,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  createButton: {
    backgroundColor: colors.accent, marginHorizontal: 20, marginTop: 12, padding: 16,
    borderRadius: 12, alignItems: 'center',
  },
  createButtonText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },

  // Safety checklist
  safetyWarning: {
    color: colors.accent, fontSize: 14, fontWeight: '600', padding: 16,
    backgroundColor: colors.accent + '10', marginHorizontal: 20, borderRadius: 8,
    lineHeight: 20, marginTop: 8,
  },
  checklistItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.bg.elevated,
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.text.muted,
    marginRight: 14, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.status.success, borderColor: colors.status.success },
  checklistText: { color: colors.text.bright, fontSize: 15, flex: 1 },
  safetyButtons: { flexDirection: 'row', marginTop: 20, gap: 12, paddingHorizontal: 20 },
  cancelButton: { flex: 1, backgroundColor: colors.bg.elevated, borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelButtonText: { color: colors.text.bright, fontSize: 16, fontWeight: '600' },
  confirmButton: { flex: 1, backgroundColor: colors.status.success, borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },

  // Job detail modal
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.bg.elevated },
  detailLabel: { color: colors.text.secondary, fontSize: 14 },
  detailValue: { color: colors.text.bright, fontSize: 14, fontWeight: '500' },
  detailSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.bg.elevated },
  detailText: { color: colors.text.bright, fontSize: 14, marginTop: 4, lineHeight: 20 },
  chatButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent,
    padding: 16, borderRadius: 12, marginTop: 16, gap: 10, marginHorizontal: 20,
  },
  chatButtonText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.status.error,
    padding: 16, borderRadius: 12, marginTop: 12, gap: 10, marginHorizontal: 20,
  },
  deleteButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },

  // Chat modal
  chatModalContainer: { flex: 1, backgroundColor: colors.bg.primary },
  chatModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  chatModalTitle: { color: colors.text.bright, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  welcomeContainer: { alignItems: 'center', paddingVertical: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.accent, marginTop: 16, marginBottom: 8 },
  welcomeText: { color: colors.text.secondary, fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
});
