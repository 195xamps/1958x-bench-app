import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { Measurement } from '../../types';

interface Props {
  measurements: Measurement[];
  onAdd: () => void;
}

function getStatusColor(status: string | null) {
  if (!status) return colors.text.muted;
  if (status === 'in_range' || status === 'green') return colors.status.success;
  if (status === 'warning' || status === 'yellow') return colors.status.warning;
  if (status === 'out_of_range' || status === 'red') return colors.status.error;
  return colors.text.muted;
}

function JobMeasurementsTabImpl({ measurements, onAdd }: Props) {
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Measurements</Text>
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={20} color={colors.text.onAccent} />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {measurements.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="analytics-outline" size={48} color={colors.bg.elevated} />
          <Text style={s.emptyTitle}>No measurements recorded</Text>
          <Text style={s.emptySub}>Tap &quot;Add&quot; to record voltage or resistance readings</Text>
        </View>
      ) : (
        measurements.map((m) => (
          <View key={m.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.node}>{m.nodeName}</Text>
              <View style={[s.statusDot, { backgroundColor: getStatusColor(m.status) }]} />
            </View>
            <View style={s.values}>
              <View style={s.col}>
                <Text style={s.valueLabel}>Recorded</Text>
                <Text style={s.valueText}>
                  {m.recordedValue !== null ? `${m.recordedValue} ${m.unit || ''}` : '--'}
                </Text>
              </View>
              <View style={s.col}>
                <Text style={s.valueLabel}>Expected</Text>
                <Text style={s.expectedText}>
                  {m.expectedMin !== null && m.expectedMax !== null
                    ? `${m.expectedMin} - ${m.expectedMax} ${m.unit || ''}`
                    : '--'}
                </Text>
              </View>
            </View>
            {m.notes && <Text style={s.notes}>{m.notes}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
}

export const JobMeasurementsTab = memo(JobMeasurementsTabImpl);

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
    backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border.default,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  node: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  values: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  valueLabel: { fontSize: 12, color: colors.text.muted, marginBottom: 2 },
  valueText: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  expectedText: { fontSize: 14, color: colors.text.secondary },
  notes: { fontSize: 13, color: colors.text.muted, marginTop: 8, fontStyle: 'italic' },
});
