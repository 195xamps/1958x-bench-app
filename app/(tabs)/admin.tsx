import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  totalTokensUsed: number | null;
  chatCount: number;
  jobCount: number;
  isActive: boolean;
}

interface Chat {
  id: string;
  userId: string | null;
  title: string;
  benchJobId: string | null;
  isStandalone: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  job: {
    id: string;
    userId: string | null;
    status: string;
    ownerSymptoms: string | null;
    techNotes: string | null;
    createdAt: string;
  };
  ampProfile: {
    make: string | null;
    model: string | null;
    year: string | null;
    circuitFamily: string | null;
  } | null;
  user?: User;
}

type TabType = 'users' | 'chats' | 'jobs';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [allChats, setAllChats] = useState<{ chat: Chat; user: User | null }[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [userJobs, setUserJobs] = useState<Job[]>([]);

  const navigateToChat = (chatId: string) => {
    router.push(`/chat/${chatId}` as any);
  };

  const navigateToJob = (jobId: string) => {
    router.push(`/job/${jobId}` as any);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAllChats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/all-chats`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAllChats(data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchAllJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/all-jobs`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAllJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const [chatsRes, jobsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users/${userId}/chats`, { credentials: 'include' }),
        fetch(`${API_URL}/api/admin/users/${userId}/jobs`, { credentials: 'include' }),
      ]);
      
      if (chatsRes.ok) {
        const chats = await chatsRes.json();
        setUserChats(chats);
      }
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        setUserJobs(jobs);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchAllChats(), fetchAllJobs()]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.isAdmin) {
      loadData();
    }
  }, [user?.isAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleUserSelect = async (selectedUser: User) => {
    setSelectedUser(selectedUser);
    await fetchUserDetails(selectedUser.id);
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.accessDeniedTitle}>Admin Access Required</Text>
          <Text style={styles.accessDeniedText}>
            You do not have permission to view this page.
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderUserDetail = () => {
    if (!selectedUser) return null;

    return (
      <View style={styles.userDetailModal}>
        <View style={styles.userDetailHeader}>
          <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <View style={styles.userDetailInfo}>
            {selectedUser.profileImageUrl && (
              <Image source={{ uri: selectedUser.profileImageUrl }} style={styles.userDetailAvatar} />
            )}
            <View>
              <Text style={styles.userDetailName}>
                {selectedUser.firstName} {selectedUser.lastName}
              </Text>
              <Text style={styles.userDetailEmail}>{selectedUser.email}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.userDetailContent}>
          <Text style={styles.sectionTitle}>Chats ({userChats.length})</Text>
          {userChats.length === 0 ? (
            <Text style={styles.emptyText}>No chats</Text>
          ) : (
            userChats.map((chat) => (
              <TouchableOpacity key={chat.id} style={styles.itemCard} onPress={() => navigateToChat(chat.id)}>
                <Text style={styles.itemTitle}>{chat.title}</Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemSubtitle}>
                    {chat.isStandalone ? 'Standalone' : 'Job Chat'} - {formatDate(chat.updatedAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Jobs ({userJobs.length})</Text>
          {userJobs.length === 0 ? (
            <Text style={styles.emptyText}>No jobs</Text>
          ) : (
            userJobs.map(({ job, ampProfile }) => (
              <TouchableOpacity key={job.id} style={styles.itemCard} onPress={() => navigateToJob(job.id)}>
                <Text style={styles.itemTitle}>
                  {ampProfile?.make || 'Unknown'} {ampProfile?.model || 'Amp'}
                </Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemSubtitle}>
                    Status: {job.status} - {formatDate(job.createdAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{users.length}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{allChats.length}</Text>
            <Text style={styles.statLabel}>Chats</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{allJobs.length}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(['users', 'chats', 'jobs'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        {activeTab === 'users' && (
          <>
            {users.map((u) => (
              <TouchableOpacity key={u.id} style={styles.userCard} onPress={() => handleUserSelect(u)}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    {u.profileImageUrl ? (
                      <Image source={{ uri: u.profileImageUrl }} style={styles.userAvatar} />
                    ) : (
                      <View style={styles.userAvatarPlaceholder}>
                        <Ionicons name="person" size={20} color="#9ca3af" />
                      </View>
                    )}
                    {u.isActive && <View style={styles.activeIndicator} />}
                  </View>
                  <View style={styles.userDetails}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>
                        {u.firstName} {u.lastName}
                      </Text>
                      {u.isAdmin && <View style={styles.adminBadgeTag}><Text style={styles.adminBadgeText}>Admin</Text></View>}
                    </View>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <View style={styles.userStatsRow}>
                      <View style={styles.userStat}>
                        <Ionicons name="chatbubble-outline" size={14} color="#9ca3af" />
                        <Text style={styles.userStatText}>{u.chatCount} chats</Text>
                      </View>
                      <View style={styles.userStat}>
                        <Ionicons name="briefcase-outline" size={14} color="#9ca3af" />
                        <Text style={styles.userStatText}>{u.jobCount} jobs</Text>
                      </View>
                      <View style={styles.userStat}>
                        <Ionicons name="flash-outline" size={14} color="#f59e0b" />
                        <Text style={styles.userStatText}>{((u.totalTokensUsed || 0) / 1000).toFixed(1)}k tokens</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTab === 'chats' && (
          <>
            {allChats.map(({ chat, user: chatUser }) => (
              <TouchableOpacity key={chat.id} style={styles.itemCard} onPress={() => navigateToChat(chat.id)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{chat.title}</Text>
                  {chat.isStandalone ? (
                    <View style={styles.standaloneBadge}>
                      <Text style={styles.badgeText}>Standalone</Text>
                    </View>
                  ) : (
                    <View style={styles.jobChatBadge}>
                      <Text style={styles.badgeText}>Job Chat</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemSubtitle}>
                  User: {chatUser?.firstName} {chatUser?.lastName} ({chatUser?.email})
                </Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemDate}>Updated: {formatDate(chat.updatedAt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTab === 'jobs' && (
          <>
            {allJobs.map(({ job, ampProfile, user: jobUser }) => (
              <TouchableOpacity key={job.id} style={styles.itemCard} onPress={() => navigateToJob(job.id)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {ampProfile?.make || 'Unknown'} {ampProfile?.model || 'Amp'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
                    <Text style={styles.badgeText}>{job.status}</Text>
                  </View>
                </View>
                <Text style={styles.itemSubtitle}>
                  User: {jobUser?.firstName} {jobUser?.lastName} ({jobUser?.email})
                </Text>
                {job.ownerSymptoms && (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    Symptoms: {job.ownerSymptoms}
                  </Text>
                )}
                <View style={styles.itemFooter}>
                  <Text style={styles.itemDate}>Created: {formatDate(job.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {selectedUser && renderUserDetail()}
    </View>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#f59e0b',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  adminBadge: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  userJoined: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  itemCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f3f4f6',
    flex: 1,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  standaloneBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobChatBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  userDetailModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111827',
  },
  userDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    marginRight: 16,
  },
  userDetailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userDetailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f3f4f6',
  },
  userDetailEmail: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  userDetailContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 12,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadgeTag: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  userStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  userStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userStatText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
