import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

interface CommunityJob {
  id: string;
  status: string;
  ownerSymptoms: string | null;
  techNotes: string | null;
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
}

const CIRCUIT_FAMILIES = [
  'All',
  'Blackface',
  'Silverface',
  'Tweed',
  'Brownface',
  'Marshall',
  'Vox',
  'Mesa',
  'Other',
];

export default function CommunityScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CommunityJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('All');

  const fetchCommunityJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedFamily !== 'All') params.append('circuitFamily', selectedFamily);
      
      const response = await fetch(
        `${API_URL}/api/community/jobs?${params.toString()}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching community jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommunityJobs();
  }, [selectedFamily]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommunityJobs();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCommunityJobs();
  }, [searchQuery, selectedFamily]);

  const navigateToJob = (jobId: string) => {
    router.push(`/community-job/${jobId}` as any);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="globe-outline" size={28} color="#f59e0b" />
          <Text style={styles.headerTitle}>Community Bench</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading shared jobs...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="globe-outline" size={28} color="#f59e0b" />
        <Text style={styles.headerTitle}>Community Bench</Text>
      </View>
      
      <Text style={styles.subtitle}>
        Browse jobs shared by other technicians. Learn from real troubleshooting cases.
      </Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by amp, symptom, circuit..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {CIRCUIT_FAMILIES.map((family) => (
          <TouchableOpacity
            key={family}
            style={[
              styles.filterChip,
              selectedFamily === family && styles.filterChipActive,
            ]}
            onPress={() => setSelectedFamily(family)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFamily === family && styles.filterChipTextActive,
              ]}
            >
              {family}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.jobsList}
        contentContainerStyle={styles.jobsListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
      >
        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyTitle}>No shared jobs yet</Text>
            <Text style={styles.emptyText}>
              Be the first to share! Open a job and enable sharing in the Notes tab.
            </Text>
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => navigateToJob(job.id)}
            >
              <View style={styles.jobHeader}>
                <View style={styles.jobTitleRow}>
                  <Text style={styles.jobTitle}>
                    {job.ampProfile?.make || 'Unknown'} {job.ampProfile?.model || 'Amp'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(job.status) }]}>
                      {job.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.jobMeta}>
                  {job.ampProfile?.circuitFamily && `${job.ampProfile.circuitFamily} • `}
                  {job.ampProfile?.year || 'Unknown year'}
                </Text>
              </View>

              {job.ownerSymptoms && (
                <Text style={styles.jobSymptoms} numberOfLines={2}>
                  {job.ownerSymptoms}
                </Text>
              )}

              <View style={styles.jobFooter}>
                <View style={styles.ownerInfo}>
                  {job.owner ? (
                    <>
                      {job.owner.profileImageUrl ? (
                        <Image source={{ uri: job.owner.profileImageUrl }} style={styles.ownerAvatar} />
                      ) : (
                        <View style={styles.ownerAvatarPlaceholder}>
                          <Ionicons name="person" size={12} color="#6b7280" />
                        </View>
                      )}
                      <Text style={styles.ownerName}>
                        {job.owner.firstName} {job.owner.lastName?.charAt(0)}.
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.ownerAvatarPlaceholder}>
                        <Ionicons name="person" size={12} color="#6b7280" />
                      </View>
                      <Text style={styles.ownerName}>Anonymous</Text>
                    </>
                  )}
                </View>
                <Text style={styles.jobDate}>{formatDate(job.updatedAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: '#1f2937',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#f3f4f6',
    fontSize: 16,
  },
  filterScroll: {
    maxHeight: 50,
    marginTop: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
  },
  filterChipActive: {
    backgroundColor: '#f59e0b',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  filterChipTextActive: {
    color: '#111827',
  },
  jobsList: {
    flex: 1,
    marginTop: 12,
  },
  jobsListContent: {
    padding: 16,
    paddingBottom: 100,
  },
  jobCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobHeader: {
    marginBottom: 8,
  },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f3f4f6',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  jobMeta: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  jobSymptoms: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  ownerAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerName: {
    fontSize: 13,
    color: '#9ca3af',
  },
  jobDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
