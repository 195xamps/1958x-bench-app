import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { Measurement, MeasurementStatus } from '../../types';

// ─── Status Helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MeasurementStatus, { color: string; icon: string }> = {
  green: { color: colors.status.success, icon: 'checkmark-circle' },
  yellow: { color: colors.status.warning, icon: 'warning' },
  red: { color: colors.status.error, icon: 'alert-circle' },
  unknown: { color: colors.text.muted, icon: 'help-circle' },
};

function getStatusConfig(status: MeasurementStatus) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface MeasurementCardProps {
  measurement: Measurement;
  onDelete?: (id: string) => void;
}

export function MeasurementCard({ measurement, onDelete }: MeasurementCardProps) {
  const status = getStatusConfig(measurement.status);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeName}>{measurement.nodeName}</Text>
          <Text style={styles.meterMode}>{measurement.meterMode}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusIndicator, { backgroundColor: status.color + '30' }]}>
            <Ionicons name={status.icon as any} size={20} color={status.color} />
          </View>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(measurement.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.status.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.valueRow}>
        <View style={styles.valueBlock}>
          <Text style={styles.valueLabel}>Recorded</Text>
          <Text style={[styles.valueText, { color: status.color }]}>
            {measurement.recordedValue} {measurement.unit}
          </Text>
        </View>
        {(measurement.expectedMin !== null || measurement.expectedMax !== null) && (
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>Expected Range</Text>
            <Text style={styles.rangeText}>
              {measurement.expectedMin ?? '?'} - {measurement.expectedMax ?? '?'} {measurement.unit}
            </Text>
          </View>
        )}
      </View>

      {measurement.meterTool ? (
        <Text style={styles.meterTool}>Tool: {measurement.meterTool}</Text>
      ) : null}

      {measurement.notes ? (
        <Text style={styles.notes}>{measurement.notes}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nodeInfo: { flex: 1 },
  nodeName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.bright,
  },
  meterMode: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.status.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  valueBlock: { flex: 1 },
  valueLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rangeText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  meterTool: {
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
});
