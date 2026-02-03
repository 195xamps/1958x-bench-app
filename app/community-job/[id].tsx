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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

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
  measurements: {
    nodeName: string;
    recordedValue: number | null;
    expectedMin: number | null;
    expectedMax: number | null;
    unit: string | null;
    status: string | null;
    notes: string | null;
  }[];
  schematics: {
    id: string;
    name: string;
    ampModel: string | null;
    circuitFamily: string | null;
  }[];
}

export default function CommunityJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<CommunityJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      year: 'numeric',
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

  const getMeasurementStatusColor = (status: string | null) => {
    switch (status) {
      case 'green': return '#22c55e';
      case 'yellow': return '#f59e0b';
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.ampProfile?.make || 'Unknown'} {job.ampProfile?.model || 'Amp'}
          </Text>
          <View style={styles.headerMeta}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(job.status) }]}>
                {job.status.replace('_', ' ')}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {job.ampProfile?.circuitFamily && `${job.ampProfile.circuitFamily} • `}
              {job.ampProfile?.year || 'Unknown year'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="eye" size={16} color="#9ca3af" />
        <Text style={styles.readOnlyText}>Read-only view from Community Bench</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.ownerCard}>
          {job.owner ? (
            <>
              {job.owner.profileImageUrl ? (
                <Image source={{ uri: job.owner.profileImageUrl }} style={styles.ownerAvatar} />
              ) : (
                <View style={styles.ownerAvatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#6b7280" />
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

        {job.ownerSymptoms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owner's Symptoms</Text>
            <Text style={styles.sectionText}>{job.ownerSymptoms}</Text>
          </View>
        )}

        {job.techNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tech Notes</Text>
            <Text style={styles.sectionText}>{job.techNotes}</Text>
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

        {job.measurements && job.measurements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Measurements ({job.measurements.length})</Text>
            {job.measurements.map((m, idx) => (
              <View key={idx} style={styles.measurementCard}>
                <View style={styles.measurementHeader}>
                  <Text style={styles.measurementNode}>{m.nodeName}</Text>
                  <View style={[styles.measurementStatus, { backgroundColor: getMeasurementStatusColor(m.status) }]} />
                </View>
                <View style={styles.measurementValues}>
                  <Text style={styles.measurementValue}>
                    {m.recordedValue !== null ? `${m.recordedValue} ${m.unit || ''}` : 'N/A'}
                  </Text>
                  {m.expectedMin !== null && m.expectedMax !== null && (
                    <Text style={styles.measurementExpected}>
                      Expected: {m.expectedMin}-{m.expectedMax} {m.unit || ''}
                    </Text>
                  )}
                </View>
                {m.notes && <Text style={styles.measurementNotes}>{m.notes}</Text>}
              </View>
            ))}
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
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
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
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
  measurementCard: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  measurementNode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  measurementStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  measurementValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  measurementExpected: {
    fontSize: 12,
    color: '#6b7280',
  },
  measurementNotes: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
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
});
