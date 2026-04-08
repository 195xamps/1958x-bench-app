import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { formatDate } from '../../utils';
import { getStatusConfig } from '../../types/common';
import type { AdminJob } from '../../types/admin';
import { adminStyles as s } from './adminStyles';

interface Props {
  jobs: AdminJob[];
  refreshing: boolean;
  onRefresh: () => void;
}

export function AdminJobsList({ jobs, refreshing, onRefresh }: Props) {
  const router = useRouter();

  const renderItem = useCallback(({ item }: { item: AdminJob }) => {
    const { job, ampProfile, user: jobUser } = item;
    const statusCfg = getStatusConfig(job.status);
    return (
      <TouchableOpacity style={s.itemCard} onPress={() => router.push(`/job/${job.id}` as any)}>
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
  }, [router]);

  return (
    <FlatList
      data={jobs}
      keyExtractor={(item) => item.job.id}
      renderItem={renderItem}
      contentContainerStyle={s.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={11}
      removeClippedSubviews
    />
  );
}
