import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { getStatusConfig } from '../../types/common';
import { formatAmpName } from '../../utils';
import type { JobData, JobTabType } from './types';

interface Props {
  jobData: JobData;
  currentStatus: string;
  isPublic: boolean;
  activeTab: JobTabType;
  attachmentCount: number;
  onBack: () => void;
  onEditAmp: () => void;
  onEditCustomer: () => void;
  onOpenStatusPicker: () => void;
  onOpenShareModal: () => void;
  onOpenGallery: () => void;
  onDeleteJob: () => void;
}

function JobHeaderImpl({
  jobData,
  currentStatus,
  isPublic,
  activeTab,
  attachmentCount,
  onBack,
  onEditAmp,
  onEditCustomer,
  onOpenStatusPicker,
  onOpenShareModal,
  onOpenGallery,
  onDeleteJob,
}: Props) {
  const { job, ampProfile } = jobData;
  const statusCfg = getStatusConfig(currentStatus);

  return (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={28} color={colors.accent} />
      </TouchableOpacity>

      <View style={s.info}>
        <TouchableOpacity onPress={onEditAmp}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>{formatAmpName(ampProfile)}</Text>
            <Ionicons name="pencil" size={16} color={colors.text.muted} style={{ marginLeft: 6 }} />
          </View>
          <View style={s.secondRow}>
            <Text style={s.subtitle}>
              {ampProfile.circuitFamily && `${ampProfile.circuitFamily} • `}
              {ampProfile.year || 'Unknown year'}
            </Text>
            <TouchableOpacity
              style={[s.statusBadge, { backgroundColor: statusCfg.color + '20' }]}
              onPress={onOpenStatusPicker}
            >
              <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={[s.statusBadgeText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
              <Ionicons name="chevron-down" size={14} color={statusCfg.color} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.customerRow} onPress={onEditCustomer}>
          <Ionicons name="person-outline" size={13} color={colors.text.secondary} />
          <Text style={s.customerText}>
            {job.customerName ? job.customerName : 'Add customer'}
            {job.customerPhone ? ` · ${job.customerPhone}` : ''}
          </Text>
          <Ionicons name="pencil" size={12} color={colors.text.muted} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.shareBtn, isPublic && s.shareBtnActive]}
          onPress={onOpenShareModal}
        >
          <Ionicons
            name={isPublic ? 'globe' : 'globe-outline'}
            size={22}
            color={isPublic ? colors.status.success : colors.text.secondary}
          />
        </TouchableOpacity>

        {activeTab === 'chat' && (
          <TouchableOpacity style={s.galleryBtn} onPress={onOpenGallery}>
            <Ionicons name="images-outline" size={22} color={colors.text.secondary} />
            {attachmentCount > 0 && (
              <View style={s.galleryBadge}>
                <Text style={s.galleryBadgeText}>{attachmentCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.deleteBtn} onPress={onDeleteJob}>
          <Ionicons name="trash-outline" size={22} color={colors.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const JobHeader = memo(JobHeaderImpl);

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50,
    backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  backBtn: { marginRight: 12 },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright, fontFamily: 'SpaceMono' },
  secondRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  subtitle: { fontSize: 14, color: colors.accent },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  customerText: { fontSize: 12, color: colors.text.secondary, flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareBtn: { padding: 8, borderRadius: 8 },
  shareBtnActive: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  galleryBtn: { position: 'relative', padding: 8 },
  deleteBtn: { padding: 8 },
  galleryBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: colors.accent, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  galleryBadgeText: { color: colors.bg.primary, fontSize: 11, fontWeight: 'bold' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, gap: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
});
