import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { AdminStats } from '../../types/admin';
import { adminStyles } from './adminStyles';

interface Props {
  stats: AdminStats | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function AdminUsageTab({ stats, refreshing, onRefresh }: Props) {
  if (!stats) return null;

  const totalK = (stats.totalTokens / 1000).toFixed(1);
  const costStr = stats.estimatedCostUsd < 0.01
    ? '<$0.01'
    : `$${stats.estimatedCostUsd.toFixed(2)}`;

  return (
    <ScrollView
      style={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <View style={s.summaryBlock}>
            <Ionicons name="flash" size={28} color={colors.accent} />
            <Text style={s.bigNum}>{totalK}k</Text>
            <Text style={s.bigLabel}>Total Tokens</Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryBlock}>
            <Ionicons name="cash-outline" size={28} color={colors.status.success} />
            <Text style={[s.bigNum, { color: colors.status.success }]}>{costStr}</Text>
            <Text style={s.bigLabel}>Est. Cost (USD)</Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryBlock}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.text.secondary} />
            <Text style={s.bigNum}>{stats.totalAssistantMessages}</Text>
            <Text style={s.bigLabel}>AI Responses</Text>
          </View>
        </View>
        <Text style={s.note}>
          GPT-4o blended rate ~$5/1M tokens. Token counts are a mix of estimated and actual values.
        </Text>
      </View>

      <Text style={adminStyles.sectionTitle}>By User</Text>
      {stats.breakdown.length === 0 ? (
        <Text style={adminStyles.emptyText}>No token usage recorded yet.</Text>
      ) : (
        stats.breakdown.map((u) => {
          const pct = stats.totalTokens > 0 ? u.tokens / stats.totalTokens : 0;
          const userCost = u.estimatedCostUsd < 0.01 ? '<$0.01' : `$${u.estimatedCostUsd.toFixed(2)}`;
          return (
            <View key={u.id} style={s.userRow}>
              <View style={s.userInfo}>
                <Text style={s.userName}>
                  {u.firstName || u.email?.split('@')[0] || 'Unknown'}
                  {u.lastName ? ` ${u.lastName}` : ''}
                </Text>
                <Text style={s.userEmail}>{u.email}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.max(pct * 100, 2)}%` as any }]} />
                </View>
              </View>
              <View style={s.userStats}>
                <Text style={s.userTokens}>{(u.tokens / 1000).toFixed(1)}k</Text>
                <Text style={s.userCost}>{userCost}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { flex: 1, padding: 16 },
  summaryCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryBlock: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 60, backgroundColor: colors.border.default, marginHorizontal: 8 },
  bigNum: { fontSize: 22, fontWeight: 'bold', color: colors.accent, fontFamily: 'SpaceMono' },
  bigLabel: { fontSize: 11, color: colors.text.muted, textAlign: 'center' },
  note: { fontSize: 11, color: colors.text.muted, textAlign: 'center', lineHeight: 16, fontStyle: 'italic' },

  userRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  userInfo: { flex: 1, marginRight: 12 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  userEmail: { fontSize: 12, color: colors.text.muted, marginTop: 1, marginBottom: 8 },
  barTrack: { height: 6, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  userStats: { alignItems: 'flex-end', gap: 2 },
  userTokens: { fontSize: 15, fontWeight: '700', color: colors.accent, fontFamily: 'SpaceMono' },
  userCost: { fontSize: 12, color: colors.status.success },
});
