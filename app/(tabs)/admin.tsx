import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors } from '../../src/theme/colors';
import { adminApi } from '../../src/services/endpoints/admin';
import { LoadingScreen } from '../../src/components/shared';
import {
  AdminUsersList,
  AdminChatsList,
  AdminJobsList,
  AdminUsageTab,
  AdminUserDetailOverlay,
} from '../../src/components/admin';
import type { AdminUser, AdminChat, AdminJob, AdminStats } from '../../src/types/admin';

type TabType = 'users' | 'chats' | 'jobs' | 'usage';

export default function AdminScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allChats, setAllChats] = useState<{ chat: AdminChat; user: AdminUser | null }[]>([]);
  const [allJobs, setAllJobs] = useState<AdminJob[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [u, c, j, st] = await Promise.all([
        adminApi.getUsers({ limit: 100 }),
        adminApi.getAllChats({ limit: 100 }),
        adminApi.getAllJobs({ limit: 100 }),
        adminApi.getStats(),
      ]);
      setUsers(u.data);
      setAllChats(c.data);
      setAllJobs(j.data);
      setStats(st);
    } catch (e) {
      console.error('Error loading admin data:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) loadData();
  }, [user?.isAdmin, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleUserUpdate = useCallback((updated: AdminUser) => {
    setSelectedUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }, []);

  const handleUserDelete = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedUser(null);
  }, []);

  // ─── Access denied / loading ────────────────────────────────────────────

  if (!user?.isAdmin) {
    return (
      <View style={s.container}>
        <View style={s.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={colors.status.error} />
          <Text style={s.accessDeniedTitle}>Admin Access Required</Text>
          <Text style={s.accessDeniedText}>You do not have permission to view this page.</Text>
        </View>
      </View>
    );
  }

  if (loading) return <LoadingScreen message="Loading admin data..." />;

  if (loadError) {
    return (
      <View style={s.container}>
        <View style={s.accessDenied}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.text.muted} />
          <Text style={s.accessDeniedTitle}>Failed to load data</Text>
          <Text style={s.accessDeniedText}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadData}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Admin Dashboard</Text>
        <View style={s.statsRow}>
          {[
            { n: users.length, l: 'Users' },
            { n: allChats.length, l: 'Chats' },
            { n: allJobs.length, l: 'Jobs' },
          ].map(({ n, l }) => (
            <View key={l} style={s.statCard}>
              <Text style={s.statNum}>{n}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.tabBar}>
        {(['users', 'chats', 'jobs', 'usage'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>
              {tab === 'usage' ? 'Usage $' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'users' && (
        <AdminUsersList
          users={users}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onSelect={setSelectedUser}
        />
      )}
      {activeTab === 'chats' && (
        <AdminChatsList chats={allChats} refreshing={refreshing} onRefresh={onRefresh} />
      )}
      {activeTab === 'jobs' && (
        <AdminJobsList jobs={allJobs} refreshing={refreshing} onRefresh={onRefresh} />
      )}
      {activeTab === 'usage' && (
        <AdminUsageTab stats={stats} refreshing={refreshing} onRefresh={onRefresh} />
      )}

      {selectedUser && (
        <AdminUserDetailOverlay
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleUserUpdate}
          onDelete={handleUserDelete}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    padding: 20, paddingTop: 60,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Jost-Bold', color: colors.cream, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.bg.elevated,
    padding: 16, borderRadius: 12, alignItems: 'center',
  },
  statNum: { fontSize: 24, fontWeight: 'bold', color: colors.accent },
  statLabel: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    paddingHorizontal: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: colors.transparent,
  },
  activeTab: { borderBottomColor: colors.accent },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.text.muted },
  activeTabText: { color: colors.accent },

  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  accessDeniedTitle: { fontSize: 24, fontWeight: 'bold', color: colors.status.error, marginTop: 16 },
  accessDeniedText: { fontSize: 16, color: colors.text.secondary, marginTop: 8, textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
