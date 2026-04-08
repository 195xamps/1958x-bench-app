import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface Props {
  safetyDone: boolean;
  diagnoseDone: boolean;
  measureDone: boolean;
  repairDone: boolean;
}

function WorkflowProgressImpl({ safetyDone, diagnoseDone, measureDone, repairDone }: Props) {
  const steps = [
    { label: 'Safety', icon: 'shield-checkmark', done: safetyDone },
    { label: 'Diagnose', icon: 'pulse', done: diagnoseDone },
    { label: 'Measure', icon: 'analytics', done: measureDone },
    { label: 'Repair', icon: 'construct', done: repairDone },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <View style={s.container}>
      <View style={s.row}>
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <View style={s.step}>
              <View style={[s.circle, step.done && s.circleDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={14} color={colors.text.onAccent} />
                ) : (
                  <Ionicons name={step.icon as any} size={14} color={colors.text.muted} />
                )}
              </View>
              <Text style={[s.label, step.done && s.labelDone]}>{step.label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[s.connector, steps[i + 1].done && s.connectorDone]} />
            )}
          </React.Fragment>
        ))}
      </View>
      <Text style={s.summary}>{completedCount}/{steps.length} steps complete</Text>
    </View>
  );
}

export const WorkflowProgress = memo(WorkflowProgressImpl);

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  step: { alignItems: 'center', gap: 4 },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  circleDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  connector: {
    flex: 1, height: 2, backgroundColor: colors.bg.elevated,
    marginHorizontal: 4, marginBottom: 12,
  },
  connectorDone: { backgroundColor: colors.accent + '60' },
  label: { fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  labelDone: { color: colors.accent },
  summary: { fontSize: 11, color: colors.text.muted, textAlign: 'center' },
});
