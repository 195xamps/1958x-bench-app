import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { AdminUser } from '../../types/admin';
import { adminStyles } from './adminStyles';

interface Props {
  users: AdminUser[];
  refreshing: boolean;
  onRefresh: () => void;
  onSelect: (user: AdminUser) => void;
}

export function AdminUsersList({ users, refreshing, onRefresh, onSelect }: Props) {
  const renderItem = useCallback(({ item: u }: { item: AdminUser }) => (
    <TouchableOpacity style={s.userCard} onPress={() => onSelect(u)}>
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
            {!u.isApproved && !u.isAdmin && (
              <View style={[s.adminTag, { backgroundColor: colors.status.warning }]}>
                <Text style={s.adminTagText}>Pending</Text>
              </View>
            )}
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
  ), [onSelect]);

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={renderItem}
      contentContainerStyle={adminStyles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={11}
      removeClippedSubviews
    />
  );
}

function StatChip({ icon, label, iconColor = colors.text.secondary }: { icon: string; label: string; iconColor?: string }) {
  return (
    <View style={s.statChip}>
      <Ionicons name={icon as any} size={14} color={iconColor} />
      <Text style={s.statChipText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  userCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg.surface, padding: 16, borderRadius: 12, marginBottom: 12,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center', alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.status.success,
    borderWidth: 2, borderColor: colors.bg.surface,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  adminTag: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminTagText: { fontSize: 10, fontWeight: 'bold', color: colors.bg.primary },
  userEmail: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  userStats: { flexDirection: 'row', marginTop: 8, gap: 12 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText: { fontSize: 12, color: colors.text.secondary },
});
