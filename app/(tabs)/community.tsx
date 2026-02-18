import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { communityApi, jobsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { getStatusConfig } from '../../src/types/common';
import type { CommunityJob, MyJob } from '../../src/types';
import { formatDate } from '../../src/utils';
import { LoadingScreen, EmptyState, SearchBar, StatusBadge } from '../../src/components/shared';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CommunityJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showManageModal, setShowManageModal] = useState(false);
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [loadingMyJobs, setLoadingMyJobs] = useState(false);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);

  // ─── Data ───────────────────────────────────────────────────────────────

  const fetchCommunityJobs = async () => {
    try {
      const data = await communityApi.list(searchQuery ? { search: searchQuery } : undefined);
      setJobs(data);
    } catch (error) {
      console.error('Error fetching community jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMyJobs = async () => {
    setLoadingMyJobs(true);
    try {
      const data = await jobsApi.list();
      const mapped: MyJob[] = data.map((item: any) => ({
        id: item.job.id,
        status: item.job.status,
        isPublic: item.job.isPublic || false,
        shareAnonymously: item.job.shareAnonymously || false,
        ampProfile: item.ampProfile,
      }));
      setMyJobs(mapped);
    } catch (error) {
      console.error('Error fetching my jobs:', error);
    } finally {
      setLoadingMyJobs(false);
    }
  };

  const toggleJobSharing = async (jobId: string, isPublic: boolean) => {
    setTogglingJob(jobId);
    try {
      await jobsApi.updateSharing(jobId, { isPublic });
      setMyJobs(prev => prev.map(j => j.id === jobId ? { ...j, isPublic } : j));
      fetchCommunityJobs();
    } catch (error) {
      console.error('Error toggling job sharing:', error);
    } finally {
      setTogglingJob(null);
    }
  };

  useFocusEffect(useCallback(() => { fetchCommunityJobs(); }, [searchQuery]));

  useEffect(() => {
    const timer = setTimeout(() => fetchCommunityJobs(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCommunityJobs();
  }, [searchQuery]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader />
        <LoadingScreen message="Loading shared jobs..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader />
      <Text style={styles.subtitle}>
        Browse jobs shared by other technicians. Learn from real troubleshooting cases.
      </Text>

      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by amp, symptom, circuit..."
          />
        </View>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => { setShowManageModal(true); fetchMyJobs(); }}
        >
          <Ionicons name="settings-outline" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.jobsList}
        contentContainerStyle={styles.jobsListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="No shared jobs yet"
            subtitle="Be the first to share! Open a job and enable sharing in the Notes tab."
          />
        ) : (
          jobs.map((job) => (
            <CommunityJobCard
              key={job.id}
              job={job}
              onPress={() => router.push(`/community-job/${job.id}` as any)}
            />
          ))
        )}
      </ScrollView>

      {/* Manage Sharing Modal */}
      <Modal visible={showManageModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage My Shared Jobs</Text>
              <TouchableOpacity onPress={() => setShowManageModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Toggle sharing for your jobs. Shared jobs appear in Community Bench.
            </Text>

            {loadingMyJobs ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : myJobs.length === 0 ? (
              <EmptyState
                icon="briefcase-outline"
                title="No jobs yet"
                subtitle="Create a job first, then share it here."
              />
            ) : (
              <ScrollView style={styles.modalList}>
                {myJobs.map((job) => (
                  <View key={job.id} style={styles.myJobCard}>
                    <View style={styles.myJobInfo}>
                      <Text style={styles.myJobTitle}>
                        {job.ampProfile?.make || 'Unknown'} {job.ampProfile?.model || 'Amp'}
                      </Text>
                      <Text style={styles.myJobYear}>
                        {job.ampProfile?.year || 'Unknown year'}
                      </Text>
                    </View>
                    <View style={styles.shareToggle}>
                      {togglingJob === job.id ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Switch
                          value={job.isPublic}
                          onValueChange={(value) => toggleJobSharing(job.id, value)}
                          trackColor={{ false: colors.bg.elevated, true: colors.accent }}
                          thumbColor={job.isPublic ? colors.white : colors.text.secondary}
                        />
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function ScreenHeader() {
  return (
    <View style={styles.header}>
      <Ionicons name="globe-outline" size={28} color={colors.accent} />
      <Text style={styles.headerTitle}>Community Bench</Text>
    </View>
  );
}

function CommunityJobCard({ job, onPress }: { job: CommunityJob; onPress: () => void }) {
  const statusConfig = getStatusConfig(job.status);

  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobHeader}>
        <View style={styles.jobTitleRow}>
          <Text style={styles.jobTitle}>
            {job.ampProfile?.make || 'Unknown'} {job.ampProfile?.model || 'Amp'}
          </Text>
          <StatusBadge status={job.status} />
        </View>
        <Text style={styles.jobMeta}>
          {job.ampProfile?.circuitFamily && `${job.ampProfile.circuitFamily} • `}
          {job.ampProfile?.year || 'Unknown year'}
        </Text>
      </View>

      {job.ownerSymptoms && (
        <Text style={styles.jobSymptoms} numberOfLines={2}>{job.ownerSymptoms}</Text>
      )}

      <View style={styles.jobFooter}>
        <View style={styles.ownerInfo}>
          {job.owner?.profileImageUrl ? (
            <Image source={{ uri: job.owner.profileImageUrl }} style={styles.ownerAvatar} />
          ) : (
            <View style={styles.ownerAvatarPlaceholder}>
              <Ionicons name="person" size={12} color={colors.text.muted} />
            </View>
          )}
          <Text style={styles.ownerName}>
            {job.owner
              ? `${job.owner.firstName} ${job.owner.lastName?.charAt(0)}.`
              : 'Anonymous'}
          </Text>
        </View>
        <Text style={styles.jobDate}>{formatDate(job.updatedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.bg.surface,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.accent,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.bg.surface,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingRight: 16,
    gap: 8,
  },
  searchWrapper: { flex: 1 },
  manageButton: {
    backgroundColor: colors.bg.elevated,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Job list
  jobsList: { flex: 1, marginTop: 12 },
  jobsListContent: { padding: 16, paddingBottom: 100 },
  jobCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobHeader: { marginBottom: 8 },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  jobMeta: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  jobSymptoms: {
    fontSize: 14,
    color: colors.text.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerAvatar: { width: 24, height: 24, borderRadius: 12 },
  ownerAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerName: { fontSize: 13, color: colors.text.secondary },
  jobDate: { fontSize: 12, color: colors.text.muted },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  modalLoading: { paddingVertical: 40, alignItems: 'center' },
  modalList: { maxHeight: 400 },
  myJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  myJobInfo: { flex: 1 },
  myJobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  myJobYear: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shareToggle: { marginLeft: 12 },
});
