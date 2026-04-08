import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatAmpName } from '../../utils';
import type { JobWithProfile } from '../../types';

interface Props {
  visible: boolean;
  job: JobWithProfile | null;
  onClose: () => void;
  onOpenChat: () => void;
  onDelete: () => void;
}

export function JobPreviewModal({ visible, job, onClose, onOpenChat, onDelete }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.title}>{formatAmpName(job?.ampProfile)}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.scroll}>
            {job?.ampProfile?.year && (
              <View style={s.row}>
                <Text style={s.label}>Year</Text>
                <Text style={s.value}>{job.ampProfile.year}</Text>
              </View>
            )}
            {job?.ampProfile?.circuitFamily && (
              <View style={s.row}>
                <Text style={s.label}>Circuit Family</Text>
                <Text style={s.value}>{job.ampProfile.circuitFamily}</Text>
              </View>
            )}
            <View style={s.row}>
              <Text style={s.label}>Status</Text>
              <Text style={s.value}>{job?.job.status}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Safety Checked</Text>
              <Text style={s.value}>{job?.job.safetyChecklistCompleted ? 'Yes' : 'No'}</Text>
            </View>
            {job?.job.ownerSymptoms && (
              <View style={s.section}>
                <Text style={s.label}>Owner Symptoms</Text>
                <Text style={s.text}>{job.job.ownerSymptoms}</Text>
              </View>
            )}
            {job?.job.techNotes && (
              <View style={s.section}>
                <Text style={s.label}>Tech Notes</Text>
                <Text style={s.text}>{job.job.techNotes}</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={s.chatBtn} onPress={onOpenChat}>
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.text.onAccent} />
            <Text style={s.chatBtnText}>Open Job Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.white} />
            <Text style={s.deleteBtnText}>Delete Job</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', paddingBottom: 40,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright, flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.bg.elevated,
  },
  label: { color: colors.text.secondary, fontSize: 14 },
  value: { color: colors.text.bright, fontSize: 14, fontWeight: '500' },
  section: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.bg.elevated },
  text: { color: colors.text.bright, fontSize: 14, marginTop: 4, lineHeight: 20 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, padding: 16, borderRadius: 12,
    marginTop: 16, gap: 10, marginHorizontal: 20,
  },
  chatBtnText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.status.error, padding: 16, borderRadius: 12,
    marginTop: 12, gap: 10, marginHorizontal: 20,
  },
  deleteBtnText: { color: colors.white, fontSize: 18, fontWeight: '600' },
});
