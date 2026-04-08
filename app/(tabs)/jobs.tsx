import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { jobsApi, chatsApi, schematicsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { JOB_STATUSES, SAFETY_CHECKLIST, getStatusConfig } from '../../src/types/common';
import type { JobWithProfile, CreateJobPayload, ChatMessage } from '../../src/types';
import { useDebounce } from '../../src/hooks';
import { showAlert, showConfirm, showError, formatDate, formatAmpName } from '../../src/utils';
import { LoadingScreen, EmptyState } from '../../src/components/shared';
import {
  NewJobModal,
  SafetyChecklistModal,
  JobPreviewModal,
  JobChatModal,
} from '../../src/components/jobs';

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
    customerName: '',
    customerPhone: '',
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
  const [suggestedSchematics, setSuggestedSchematics] = useState<any[]>([]);
  const [attachedSchematicIds, setAttachedSchematicIds] = useState<Set<string>>(new Set());

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
    if (!newJob.ampMake || !newJob.ampModel) {
      showAlert('Required', 'Please enter both amp make and model');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const result = await jobsApi.create(newJob);
      setJobs([{ job: result.benchJob, ampProfile: result.ampProfile }, ...jobs]);
      setShowNewJobModal(false);
      setCurrentJobId(result.benchJob.id);
      setNewJob({ ampMake: '', ampModel: '', ampYear: '', circuitFamily: '', customerName: '', customerPhone: '', ownerSymptoms: '', techNotes: '', priorWork: '', knownMods: '' });
      setSafetyChecks(new Array(SAFETY_CHECKLIST.length).fill(false));
      setSuggestedSchematics([]);
      setAttachedSchematicIds(new Set());
      setShowSafetyModal(true);

      // Search for matching schematics in background — don't block job creation
      const query = [newJob.ampMake, newJob.ampModel, newJob.circuitFamily].filter(Boolean).join(' ').trim();
      if (query) {
        schematicsApi.search(query).then((results: any[]) => {
          setSuggestedSchematics(results.slice(0, 4));
        }).catch(() => {}); // non-critical
      }
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

  const attachSuggestedSchematic = async (schematicId: string) => {
    if (!currentJobId || attachedSchematicIds.has(schematicId)) return;
    try {
      await jobsApi.attachSchematic(currentJobId, schematicId);
      setAttachedSchematicIds(prev => new Set(prev).add(schematicId));
    } catch (error) {
      console.error('Error attaching schematic:', error);
    }
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
              {job.customerName && (
                <View style={styles.customerRow}>
                  <Ionicons name="person-outline" size={12} color={colors.text.secondary} />
                  <Text style={styles.customerName}>{job.customerName}</Text>
                  {job.customerPhone && <Text style={styles.customerPhone}>{job.customerPhone}</Text>}
                </View>
              )}
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

      <NewJobModal
        visible={showNewJobModal}
        newJob={newJob}
        creating={creating}
        onClose={() => setShowNewJobModal(false)}
        onChange={setNewJob}
        onCreate={createJob}
      />

      <SafetyChecklistModal
        visible={showSafetyModal}
        safetyChecks={safetyChecks}
        suggestedSchematics={suggestedSchematics}
        attachedSchematicIds={attachedSchematicIds}
        onToggle={toggleSafetyCheck}
        onAttach={attachSuggestedSchematic}
        onConfirm={completeSafetyChecklist}
        onClose={() => setShowSafetyModal(false)}
      />

      <JobPreviewModal
        visible={showJobDetailModal}
        job={selectedJob}
        onClose={() => setShowJobDetailModal(false)}
        onOpenChat={() => selectedJob && openJobChat(selectedJob.job.id)}
        onDelete={() => selectedJob && deleteJob(selectedJob.job.id, formatAmpName(selectedJob.ampProfile, 'Unknown Amp'))}
      />

      <JobChatModal
        visible={showJobChatModal}
        job={selectedJob}
        messages={chatMessages}
        input={chatInput}
        sending={sendingChat}
        onClose={() => {
          setShowJobChatModal(false);
          setChatMessages([]);
          setChatId(null);
        }}
        onChangeInput={setChatInputText}
        onSend={sendJobChatMessage}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollView: { flex: 1, padding: 16 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text.bright, fontFamily: 'SpaceMono' },
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
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  customerName: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  customerPhone: { fontSize: 12, color: colors.text.muted, marginLeft: 6 },
  jobCircuitFamily: { fontSize: 13, color: colors.accent, marginBottom: 4 },
  jobSymptoms: { fontSize: 14, color: colors.text.secondary, marginBottom: 4 },
  jobDate: { fontSize: 12, color: colors.text.muted },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },

});
