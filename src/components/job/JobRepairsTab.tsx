import React, { memo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatTimestamp } from '../../utils';
import type { RepairAction } from '../../types';

interface Props {
  repairActions: RepairAction[];
  onAdd: () => void;
  onEdit: (action: RepairAction) => void;
  onDelete: (id: string) => void;
}

function JobRepairsTabImpl({ repairActions, onAdd, onEdit, onDelete }: Props) {
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Repair Actions</Text>
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={20} color={colors.text.onAccent} />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {repairActions.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="construct-outline" size={48} color={colors.bg.elevated} />
          <Text style={s.emptyTitle}>No repair actions recorded</Text>
          <Text style={s.emptySub}>Tap &quot;Add&quot; to log parts replaced, measurements, and notes</Text>
        </View>
      ) : (
        repairActions.map((ra) => (
          <TouchableOpacity
            key={ra.id}
            style={s.card}
            onPress={() => onEdit(ra)}
            activeOpacity={0.8}
          >
            <View style={s.cardHeader}>
              <Ionicons name="build" size={16} color={colors.accent} />
              <Text style={s.description} numberOfLines={2}>{ra.description}</Text>
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => onDelete(ra.id)}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.status.error} />
              </TouchableOpacity>
            </View>

            {ra.partReplaced && (
              <View style={s.detailRow}>
                <Text style={s.label}>Part</Text>
                <Text style={s.value}>
                  {ra.partReplaced}
                  {ra.partValue ? ` (${ra.partValue})` : ''}
                  {ra.partBrand ? ` — ${ra.partBrand}` : ''}
                </Text>
              </View>
            )}

            {ra.voltageRating && (
              <View style={s.detailRow}>
                <Text style={s.label}>Rating</Text>
                <Text style={s.value}>{ra.voltageRating}</Text>
              </View>
            )}

            {(ra.beforeMeasurement || ra.afterMeasurement) && (
              <View style={s.measurements}>
                {ra.beforeMeasurement && (
                  <View style={s.measBox}>
                    <Text style={s.measLabel}>Before</Text>
                    <Text style={s.measValue}>{ra.beforeMeasurement}</Text>
                  </View>
                )}
                {ra.beforeMeasurement && ra.afterMeasurement && (
                  <Ionicons name="arrow-forward" size={14} color={colors.text.muted} style={{ marginHorizontal: 6, marginTop: 14 }} />
                )}
                {ra.afterMeasurement && (
                  <View style={s.measBox}>
                    <Text style={s.measLabel}>After</Text>
                    <Text style={[s.measValue, { color: colors.status.success }]}>{ra.afterMeasurement}</Text>
                  </View>
                )}
              </View>
            )}

            {ra.dateCode && (
              <View style={s.detailRow}>
                <Text style={s.label}>Date Code</Text>
                <Text style={s.value}>{ra.dateCode}</Text>
              </View>
            )}

            {ra.notes && <Text style={s.notes}>{ra.notes}</Text>}
            {ra.photoUrl && (
              <Image source={{ uri: ra.photoUrl }} style={s.photo} resizeMode="cover" />
            )}

            <View style={s.footer}>
              <Text style={s.timestamp}>{formatTimestamp(ra.createdAt)}</Text>
              <View style={s.editHint}>
                <Ionicons name="pencil-outline" size={12} color={colors.text.muted} />
                <Text style={s.editHintText}>tap to edit</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

export const JobRepairsTab = memo(JobRepairsTabImpl);

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  addBtnText: { color: colors.text.onAccent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text.secondary, marginTop: 16 },
  emptySub: { fontSize: 14, color: colors.text.muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.bg.surface, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border.default,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  description: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text.bright, lineHeight: 20 },
  deleteBtn: { padding: 4, marginLeft: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  label: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, width: 52 },
  value: { flex: 1, fontSize: 14, color: colors.text.primary },
  measurements: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 6,
    backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 10,
  },
  measBox: { flex: 1 },
  measLabel: {
    fontSize: 11, fontWeight: '600', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  measValue: { fontSize: 15, fontWeight: '600', color: colors.text.bright },
  notes: { fontSize: 13, color: colors.text.muted, marginTop: 6, fontStyle: 'italic', lineHeight: 18 },
  photo: { width: '100%', height: 160, borderRadius: 8, marginTop: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  timestamp: { fontSize: 11, color: colors.text.muted },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editHintText: { fontSize: 11, color: colors.text.muted, fontStyle: 'italic' },
});
