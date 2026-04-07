import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors } from '../../src/theme/colors';
import { adminApi } from '../../src/services/endpoints/admin';
import { formatDate, showConfirm, showError } from '../../src/utils';
import { LoadingScreen } from '../../src/components/shared';
import { getStatusConfig } from '../../src/types/common';
import type { AdminUser, AdminChat, AdminJob, AdminStats } from '../../src/types/admin';

type TabType = 'users' | 'chats' | 'jobs' | 'usage';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allChats, setAllChats] = useState<{ chat: AdminChat; user: AdminUser | null }[]>([]);
  const [allJobs, setAllJobs] = useState<AdminJob[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userChats, setUserChats] = useState<AdminChat[]>([]);
  const [userJobs, setUserJobs] = useState<AdminJob[]>([]);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [quotaInput, setQuotaInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [u, c, j, st] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getAllChats(),
        adminApi.getAllJobs(),
        adminApi.getStats(),
      ]);
      setUsers(u); setAllChats(c); setAllJobs(j); setStats(st);
    } catch (e) {
      console.error('Error loading admin data:', e);
      setLoadError(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.isAdmin) loadData(); }, [user?.isAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleUserSelect = async (u: AdminUser) => {
    setSelectedUser(u);
    setQuotaInput(u.tokenQuota != null ? String(u.tokenQuota) : '');
    try {
      const [chats, jobs] = await Promise.all([
        adminApi.getUserChats(u.id),
        adminApi.getUserJobs(u.id),
      ]);
      setUserChats(chats); setUserJobs(jobs);
    } catch (e) { console.error('Error fetching user details:', e); }
  };

  const toggleAdmin = async () => {
    if (!selectedUser) return;
    setUpdatingUser(true);
    try {
      const updated = await adminApi.updateUser(selectedUser.id, { isAdmin: !selectedUser.isAdmin });
      setSelectedUser(prev => prev ? { ...prev, isAdmin: updated.isAdmin } : null);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, isAdmin: updated.isAdmin } : u));
    } catch { showError('Failed to update user'); }
    finally { setUpdatingUser(false); }
  };

  const saveQuota = async () => {
    if (!selectedUser) return;
    setUpdatingUser(true);
    try {
      const quota = quotaInput.trim() === '' ? null : parseInt(quotaInput.trim());
      await adminApi.updateUser(selectedUser.id, { tokenQuota: quota });
      setSelectedUser(prev => prev ? { ...prev, tokenQuota: quota } : null);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, tokenQuota: quota } : u));
    } catch { showError('Failed to save quota'); }
    finally { setUpdatingUser(false); }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    const confirmed = await showConfirm(
      'Delete User',
      `Delete ${selectedUser.email}? This will permanently remove their account, jobs, and chats.`,
      { confirmText: 'Delete User', destructive: true }
    );
    if (!confirmed) return;
    setUpdatingUser(true);
    try {
      await adminApi.deleteUser(selectedUser.id);
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setSelectedUser(null);
    } catch { showError('Failed to delete user'); }
    finally { setUpdatingUser(false); }
  };

  // ─── Access denied / loading ─────────────────────────────────────────────

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

  // ─── User detail overlay ─────────────────────────────────────────────────

  const renderUserDetail = () => {
    if (!selectedUser) return null;
    const quotaUsed = selectedUser.totalTokensUsed || 0;
    const quotaPct = selectedUser.tokenQuota ? Math.min(quotaUsed / selectedUser.tokenQuota, 1) : null;
    return (
      <View style={s.detailOverlay}>
        <View style={s.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedUser(null)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View style={s.detailInfo}>
            {selectedUser.profileImageUrl && <Image source={{ uri: selectedUser.profileImageUrl }} style={s.detailAvatar} />}
            <View>
              <Text style={s.detailName}>{selectedUser.firstName} {selectedUser.lastName}</Text>
              <Text style={s.detailEmail}>{selectedUser.email}</Text>
            </View>
          </View>
        </View>
        <ScrollView style={s.detailContent}>

          {/* Admin Actions */}
          <Text style={s.sectionTitle}>Actions</Text>
          <View style={s.actionsCard}>
            {/* Promote / Demote */}
            <TouchableOpacity style={s.actionRow} onPress={toggleAdmin} disabled={updatingUser}>
              <Ionicons
                name={selectedUser.isAdmin ? 'shield-checkmark' : 'shield-outline'}
                size={20}
                color={selectedUser.isAdmin ? colors.accent : colors.text.muted}
              />
              <Text style={s.actionLabel}>
                {selectedUser.isAdmin ? 'Revoke Admin' : 'Promote to Admin'}
              </Text>
              {updatingUser && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <View style={s.actionDivider} />

            {/* Token Quota */}
            <View style={s.actionRow}>
              <Ionicons name="flash-outline" size={20} color={colors.text.muted} />
              <Text style={s.actionLabel}>Token Quota</Text>
              <View style={s.quotaInputRow}>
                <TextInput
                  style={s.quotaInput}
                  value={quotaInput}
                  onChangeText={setQuotaInput}
                  placeholder="No limit"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={saveQuota} disabled={updatingUser} style={s.quotaSaveBtn}>
                  <Text style={s.quotaSaveBtnText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quota usage bar */}
            {quotaPct !== null && (
              <View style={s.quotaBarWrap}>
                <Text style={s.quotaBarLabel}>
                  {(quotaUsed / 1000).toFixed(1)}k / {((selectedUser.tokenQuota || 0) / 1000).toFixed(1)}k tokens used
                </Text>
                <View style={s.quotaBarTrack}>
                  <View style={[s.quotaBarFill, { width: `${quotaPct * 100}%` as any, backgroundColor: quotaPct > 0.9 ? colors.status.error : colors.accent }]} />
                </View>
              </View>
            )}

            <View style={s.actionDivider} />

            {/* Delete */}
            <TouchableOpacity style={s.actionRow} onPress={deleteUser} disabled={updatingUser}>
              <Ionicons name="trash-outline" size={20} color={colors.status.error} />
              <Text style={[s.actionLabel, { color: colors.status.error }]}>Delete User</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.sectionTitle}>Chats ({userChats.length})</Text>
          {userChats.length === 0
            ? <Text style={s.emptyText}>No chats</Text>
            : userChats.map((chat) => (
              <TouchableOpacity key={chat.id} style={s.itemCard} onPress={() => router.push(`/chat/${chat.id}` as any)}>
                <Text style={s.itemTitle}>{chat.title}</Text>
                <View style={s.itemFooter}>
                  <Text style={s.itemSub}>{chat.isStandalone ? 'Standalone' : 'Job Chat'} - {formatDate(chat.updatedAt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                </View>
              </TouchableOpacity>
            ))
          }
          <Text style={[s.sectionTitle, { marginTop: 20 }]}>Jobs ({userJobs.length})</Text>
          {userJobs.length === 0
            ? <Text style={s.emptyText}>No jobs</Text>
            : userJobs.map(({ job, ampProfile }) => (
              <TouchableOpacity key={job.id} style={s.itemCard} onPress={() => router.push(`/job/${job.id}` as any)}>
                <Text style={s.itemTitle}>{ampProfile?.make || 'Unknown'} {ampProfile?.model || 'Amp'}</Text>
                <View style={s.itemFooter}>
                  <Text style={s.itemSub}>Status: {job.status} - {formatDate(job.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                </View>
              </TouchableOpacity>
            ))
          }
        </ScrollView>
      </View>
    );
  };

  // ─── Tab content renderers ───────────────────────────────────────────────

  const renderUsersTab = () => users.map((u) => (
    <TouchableOpacity key={u.id} style={s.userCard} onPress={() => handleUserSelect(u)}>
      <View style={s.userInfo}>
        <View style={s.avatarWrap}>
          {u.profileImageUrl
            ? <Image source={{ uri: u.profileImageUrl }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}><Ionicons name="person" size={20} color={colors.text.secondary} /></View>
          }
          {u.isActive && <View style={s.activeIndicator} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.userName}>{u.firstName} {u.lastName}</Text>
            {u.isAdmin && <View style={s.adminTag}><Text style={s.adminTagText}>Admin</Text></View>}
          </View>
          <Text style={s.userEmail}>{u.email}</Text>
          <View style={s.userStats}>
            <StatChip icon="chatbubble-outline" label={`${u.chatCount} chats`} />
            <StatChip icon="briefcase-outline" label={`${u.jobCount} jobs`} />
            <StatChip icon="flash-outline" label={`${((u.totalTokensUsed || 0) / 1000).toFixed(1)}k tokens`} iconColor={colors.accent} />
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
    </TouchableOpacity>
  ));

  const renderChatsTab = () => allChats.map(({ chat, user: chatUser }) => (
    <TouchableOpacity key={chat.id} style={s.itemCard} onPress={() => router.push(`/chat/${chat.id}` as any)}>
      <View style={s.itemHeader}>
        <Text style={s.itemTitle}>{chat.title}</Text>
        <View style={[s.badge, { backgroundColor: chat.isStandalone ? colors.status.info : colors.status.purple }]}>
          <Text style={s.badgeText}>{chat.isStandalone ? 'Standalone' : 'Job Chat'}</Text>
        </View>
      </View>
      <Text style={s.itemSub}>User: {chatUser?.firstName} {chatUser?.lastName} ({chatUser?.email})</Text>
      <View style={s.itemFooter}>
        <Text style={s.itemDate}>Updated: {formatDate(chat.updatedAt)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      </View>
    </TouchableOpacity>
  ));

  const renderJobsTab = () => allJobs.map(({ job, ampProfile, user: jobUser }) => {
    const statusCfg = getStatusConfig(job.status);
    return (
      <TouchableOpacity key={job.id} style={s.itemCard} onPress={() => router.push(`/job/${job.id}` as any)}>
        <View style={s.itemHeader}>
          <Text style={s.itemTitle}>{ampProfile?.make || 'Unknown'} {ampProfile?.model || 'Amp'}</Text>
          <View style={[s.badge, { backgroundColor: statusCfg.color }]}><Text style={s.badgeText}>{job.status}</Text></View>
        </View>
        <Text style={s.itemSub}>User: {jobUser?.firstName} {jobUser?.lastName} ({jobUser?.email})</Text>
        {job.ownerSymptoms && <Text style={s.itemDesc} numberOfLines={2}>Symptoms: {job.ownerSymptoms}</Text>}
        <View style={s.itemFooter}>
          <Text style={s.itemDate}>Created: {formatDate(job.createdAt)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </View>
      </TouchableOpacity>
    );
  });

  const renderUsageTab = () => {
    if (!stats) return null;
    const totalK = (stats.totalTokens / 1000).toFixed(1);
    const totalM = (stats.totalTokens / 1_000_000).toFixed(3);
    const costStr = stats.estimatedCostUsd < 0.01
      ? '<$0.01'
      : `$${stats.estimatedCostUsd.toFixed(2)}`;

    return (
      <>
        {/* Cost summary */}
        <View style={s.usageSummaryCard}>
          <View style={s.usageSummaryRow}>
            <View style={s.usageSummaryBlock}>
              <Ionicons name="flash" size={28} color={colors.accent} />
              <Text style={s.usageBigNum}>{totalK}k</Text>
              <Text style={s.usageBigLabel}>Total Tokens</Text>
            </View>
            <View style={s.usageDivider} />
            <View style={s.usageSummaryBlock}>
              <Ionicons name="cash-outline" size={28} color={colors.status.success} />
              <Text style={[s.usageBigNum, { color: colors.status.success }]}>{costStr}</Text>
              <Text style={s.usageBigLabel}>Est. Cost (USD)</Text>
            </View>
            <View style={s.usageDivider} />
            <View style={s.usageSummaryBlock}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.text.secondary} />
              <Text style={s.usageBigNum}>{stats.totalAssistantMessages}</Text>
              <Text style={s.usageBigLabel}>AI Responses</Text>
            </View>
          </View>
          <Text style={s.usageNote}>
            GPT-4o blended rate ~$5/1M tokens. Token counts are a mix of estimated and actual values.
          </Text>
        </View>

        {/* Per-user breakdown */}
        <Text style={s.sectionTitle}>By User</Text>
        {stats.breakdown.length === 0 ? (
          <Text style={s.emptyText}>No token usage recorded yet.</Text>
        ) : (
          stats.breakdown.map((u) => {
            const pct = stats.totalTokens > 0 ? u.tokens / stats.totalTokens : 0;
            const userCost = u.estimatedCostUsd < 0.01 ? '<$0.01' : `$${u.estimatedCostUsd.toFixed(2)}`;
            return (
              <View key={u.id} style={s.usageUserRow}>
                <View style={s.usageUserInfo}>
                  <Text style={s.usageUserName}>
                    {u.firstName || u.email?.split('@')[0] || 'Unknown'}
                    {u.lastName ? ` ${u.lastName}` : ''}
                  </Text>
                  <Text style={s.usageUserEmail}>{u.email}</Text>
                  <View style={s.usageBarTrack}>
                    <View style={[s.usageBarFill, { width: `${Math.max(pct * 100, 2)}%` as any }]} />
                  </View>
                </View>
                <View style={s.usageUserStats}>
                  <Text style={s.usageUserTokens}>{(u.tokens / 1000).toFixed(1)}k</Text>
                  <Text style={s.usageUserCost}>{userCost}</Text>
                </View>
              </View>
            );
          })
        )}
      </>
    );
  };

  return (
    <View style={s.container}>
      {/* Header with stats */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Admin Dashboard</Text>
        <View style={s.statsRow}>
          {[{ n: users.length, l: 'Users' }, { n: allChats.length, l: 'Chats' }, { n: allJobs.length, l: 'Jobs' }].map(({ n, l }) => (
            <View key={l} style={s.statCard}><Text style={s.statNum}>{n}</Text><Text style={s.statLabel}>{l}</Text></View>
          ))}
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['users', 'chats', 'jobs', 'usage'] as TabType[]).map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>
              {tab === 'usage' ? 'Usage $' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'chats' && renderChatsTab()}
        {activeTab === 'jobs' && renderJobsTab()}
        {activeTab === 'usage' && renderUsageTab()}
      </ScrollView>

      {selectedUser && renderUserDetail()}
    </View>
  );
}

// ─── Small helper ────────────────────────────────────────────────────────────

function StatChip({ icon, label, iconColor = colors.text.secondary }: { icon: string; label: string; iconColor?: string }) {
  return (
    <View style={s.statChip}>
      <Ionicons name={icon as any} size={14} color={iconColor} />
      <Text style={s.statChipText}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  // Header
  header: { padding: 20, paddingTop: 60, backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.accent, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statCard: { flex: 1, backgroundColor: colors.bg.elevated, padding: 16, borderRadius: 12, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: 'bold', color: colors.accent },
  statLabel: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.surface, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: colors.transparent },
  activeTab: { borderBottomColor: colors.accent },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.text.muted },
  activeTabText: { color: colors.accent },
  content: { flex: 1, padding: 16 },
  // User cards
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg.surface, padding: 16, borderRadius: 12, marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  activeIndicator: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.status.success, borderWidth: 2, borderColor: colors.bg.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  adminTag: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminTagText: { fontSize: 10, fontWeight: 'bold', color: colors.bg.primary },
  userEmail: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  userStats: { flexDirection: 'row', marginTop: 8, gap: 12 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText: { fontSize: 12, color: colors.text.secondary },
  // Item cards (chats / jobs)
  itemCard: { backgroundColor: colors.bg.surface, padding: 16, borderRadius: 12, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, flex: 1 },
  itemSub: { fontSize: 14, color: colors.text.secondary, marginBottom: 4 },
  itemDesc: { fontSize: 14, color: colors.text.muted, marginTop: 4 },
  itemDate: { fontSize: 12, color: colors.text.muted },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.white },
  // Access denied
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  accessDeniedTitle: { fontSize: 24, fontWeight: 'bold', color: colors.status.error, marginTop: 16 },
  accessDeniedText: { fontSize: 16, color: colors.text.secondary, marginTop: 8, textAlign: 'center' },
  // User detail overlay
  detailOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg.primary },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  backBtn: { marginRight: 16 },
  detailInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  detailAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  detailName: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  detailEmail: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  detailContent: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.accent, marginBottom: 12 },
  emptyText: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic' },
  retryBtn: { marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  // Usage tab
  usageSummaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  usageSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageSummaryBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  usageDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.border.default,
    marginHorizontal: 8,
  },
  usageBigNum: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    fontFamily: 'SpaceMono',
  },
  usageBigLabel: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
  },
  usageNote: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  usageUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  usageUserInfo: { flex: 1, marginRight: 12 },
  usageUserName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  usageUserEmail: { fontSize: 12, color: colors.text.muted, marginTop: 1, marginBottom: 8 },
  usageBarTrack: {
    height: 6,
    backgroundColor: colors.bg.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  usageUserStats: { alignItems: 'flex-end', gap: 2 },
  usageUserTokens: { fontSize: 15, fontWeight: '700', color: colors.accent, fontFamily: 'SpaceMono' },
  usageUserCost: { fontSize: 12, color: colors.status.success },
  // Admin actions in user detail
  actionsCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  actionLabel: { fontSize: 15, color: colors.text.primary },
  actionDivider: { height: 1, backgroundColor: colors.border.default, marginVertical: 12 },
  quotaInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  quotaInput: {
    width: 90, backgroundColor: colors.bg.elevated, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, color: colors.text.primary,
    fontSize: 14, borderWidth: 1, borderColor: colors.border.default, textAlign: 'right',
  },
  quotaSaveBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  quotaSaveBtnText: { color: colors.text.onAccent, fontWeight: '700', fontSize: 14 },
  quotaBarWrap: { marginTop: 8 },
  quotaBarLabel: { fontSize: 12, color: colors.text.muted, marginBottom: 6 },
  quotaBarTrack: { height: 6, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden' },
  quotaBarFill: { height: 6, borderRadius: 3 },
});
