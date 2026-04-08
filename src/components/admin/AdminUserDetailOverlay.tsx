import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { adminApi } from '../../services/endpoints/admin';
import { formatDate, showConfirm, showError } from '../../utils';
import type { AdminUser, AdminChat, AdminJob } from '../../types/admin';
import { adminStyles } from './adminStyles';

interface Props {
  user: AdminUser;
  onClose: () => void;
  onUpdate: (updated: AdminUser) => void;
  onDelete: (userId: string) => void;
}

export function AdminUserDetailOverlay({ user, onClose, onUpdate, onDelete }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [quotaInput, setQuotaInput] = useState(user.tokenQuota != null ? String(user.tokenQuota) : '');
  const [userChats, setUserChats] = useState<AdminChat[]>([]);
  const [userJobs, setUserJobs] = useState<AdminJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminApi.getUserChats(user.id),
      adminApi.getUserJobs(user.id),
    ])
      .then(([chats, jobs]) => {
        if (cancelled) return;
        setUserChats(chats);
        setUserJobs(jobs);
      })
      .catch((e) => console.error('Error fetching user details:', e));
    return () => { cancelled = true; };
  }, [user.id]);

  const toggleApproved = async () => {
    setUpdating(true);
    try {
      const updated = await adminApi.updateUser(user.id, { isApproved: !user.isApproved });
      onUpdate({ ...user, isApproved: updated.isApproved });
    } catch { showError('Failed to update user'); }
    finally { setUpdating(false); }
  };

  const toggleAdmin = async () => {
    setUpdating(true);
    try {
      const updated = await adminApi.updateUser(user.id, { isAdmin: !user.isAdmin });
      onUpdate({ ...user, isAdmin: updated.isAdmin });
    } catch { showError('Failed to update user'); }
    finally { setUpdating(false); }
  };

  const saveQuota = async () => {
    setUpdating(true);
    try {
      const quota = quotaInput.trim() === '' ? null : parseInt(quotaInput.trim());
      await adminApi.updateUser(user.id, { tokenQuota: quota });
      onUpdate({ ...user, tokenQuota: quota });
    } catch { showError('Failed to save quota'); }
    finally { setUpdating(false); }
  };

  const deleteUser = async () => {
    const confirmed = await showConfirm(
      'Delete User',
      `Delete ${user.email}? This will permanently remove their account, jobs, and chats.`,
      { confirmText: 'Delete User', destructive: true },
    );
    if (!confirmed) return;
    setUpdating(true);
    try {
      await adminApi.deleteUser(user.id);
      onDelete(user.id);
    } catch { showError('Failed to delete user'); }
    finally { setUpdating(false); }
  };

  const quotaUsed = user.totalTokensUsed || 0;
  const quotaPct = user.tokenQuota ? Math.min(quotaUsed / user.tokenQuota, 1) : null;

  return (
    <View style={s.overlay}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={s.info}>
          {user.profileImageUrl && <Image source={{ uri: user.profileImageUrl }} style={s.avatar} />}
          <View>
            <Text style={s.name}>{user.firstName} {user.lastName}</Text>
            <Text style={s.email}>{user.email}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.content}>
        {/* Admin Actions */}
        <Text style={adminStyles.sectionTitle}>Actions</Text>
        <View style={s.actionsCard}>
          <TouchableOpacity style={s.actionRow} onPress={toggleApproved} disabled={updating}>
            <Ionicons
              name={user.isApproved ? 'checkmark-circle' : 'close-circle-outline'}
              size={20}
              color={user.isApproved ? colors.status.success : colors.text.muted}
            />
            <Text style={s.actionLabel}>
              {user.isApproved ? 'Revoke Access' : 'Approve Access'}
            </Text>
          </TouchableOpacity>

          <View style={s.actionDivider} />

          <TouchableOpacity style={s.actionRow} onPress={toggleAdmin} disabled={updating}>
            <Ionicons
              name={user.isAdmin ? 'shield-checkmark' : 'shield-outline'}
              size={20}
              color={user.isAdmin ? colors.accent : colors.text.muted}
            />
            <Text style={s.actionLabel}>
              {user.isAdmin ? 'Revoke Admin' : 'Promote to Admin'}
            </Text>
            {updating && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>

          <View style={s.actionDivider} />

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
              <TouchableOpacity onPress={saveQuota} disabled={updating} style={s.quotaSaveBtn}>
                <Text style={s.quotaSaveBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          {quotaPct !== null && (
            <View style={s.quotaBarWrap}>
              <Text style={s.quotaBarLabel}>
                {(quotaUsed / 1000).toFixed(1)}k / {((user.tokenQuota || 0) / 1000).toFixed(1)}k tokens used
              </Text>
              <View style={s.quotaBarTrack}>
                <View style={[s.quotaBarFill, {
                  width: `${quotaPct * 100}%` as any,
                  backgroundColor: quotaPct > 0.9 ? colors.status.error : colors.accent,
                }]} />
              </View>
            </View>
          )}

          <View style={s.actionDivider} />

          <TouchableOpacity style={s.actionRow} onPress={deleteUser} disabled={updating}>
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            <Text style={[s.actionLabel, { color: colors.status.error }]}>Delete User</Text>
          </TouchableOpacity>
        </View>

        {/* Chats */}
        <Text style={adminStyles.sectionTitle}>Chats ({userChats.length})</Text>
        {userChats.length === 0 ? (
          <Text style={adminStyles.emptyText}>No chats</Text>
        ) : userChats.map((chat) => (
          <TouchableOpacity key={chat.id} style={adminStyles.itemCard} onPress={() => router.push(`/chat/${chat.id}` as any)}>
            <Text style={adminStyles.itemTitle}>{chat.title}</Text>
            <View style={adminStyles.itemFooter}>
              <Text style={adminStyles.itemSub}>{chat.isStandalone ? 'Standalone' : 'Job Chat'} - {formatDate(chat.updatedAt)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Jobs */}
        <Text style={[adminStyles.sectionTitle, { marginTop: 20 }]}>Jobs ({userJobs.length})</Text>
        {userJobs.length === 0 ? (
          <Text style={adminStyles.emptyText}>No jobs</Text>
        ) : userJobs.map(({ job, ampProfile }) => (
          <TouchableOpacity key={job.id} style={adminStyles.itemCard} onPress={() => router.push(`/job/${job.id}` as any)}>
            <Text style={adminStyles.itemTitle}>{ampProfile?.make || 'Unknown'} {ampProfile?.model || 'Amp'}</Text>
            <View style={adminStyles.itemFooter}>
              <Text style={adminStyles.itemSub}>Status: {job.status} - {formatDate(job.createdAt)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, paddingTop: 60,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  backBtn: { marginRight: 16 },
  info: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  email: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  content: { flex: 1, padding: 16 },

  actionsCard: {
    backgroundColor: colors.bg.surface, borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border.default,
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
