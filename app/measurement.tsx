import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { measurementsApi } from '../src/services';
import { colors } from '../src/theme';
import type { Measurement } from '../src/types';
import type { MeasurementNode } from '../src/data';
import { MEASUREMENT_CATEGORIES } from '../src/data';
import { DEFAULT_DIAGNOSTIC_SEQUENCE } from '../src/data/measurementConstants';
import { VOLTAGE_CARDS } from '../src/data/voltageCards';
import type { VoltageCard } from '../src/data/voltageCards';
import { showAlert, showError, showConfirm } from '../src/utils';
import { LoadingScreen, EmptyState } from '../src/components/shared';
import {
  MeasurementCard,
  AddMeasurementModal,
  EMPTY_FORM,
} from '../src/components/measurement';
import type { MeasurementFormData } from '../src/components/measurement';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MeasurementScreen() {
  const { benchJobId, jobName, circuitFamily } = useLocalSearchParams<{ benchJobId: string; jobName: string; circuitFamily: string }>();
  const router = useRouter();

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MeasurementFormData>(EMPTY_FORM);

  // Voltage reference cards for this circuit family
  const voltageCards = circuitFamily
    ? VOLTAGE_CARDS.filter(c => c.circuitFamily === circuitFamily)
    : [];

  // Diagnostic sequence state
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState(0);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (benchJobId) {
      router.replace(`/job/${benchJobId}` as any);
    } else {
      router.replace('/(tabs)/jobs' as any);
    }
  };

  // ─── Data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (benchJobId) {
      loadMeasurements();
    } else {
      setLoading(false);
    }
  }, [benchJobId]);

  const loadMeasurements = async () => {
    try {
      const data = await measurementsApi.list(benchJobId!);
      setMeasurements(data);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Node Selection ─────────────────────────────────────────────────────

  const findNodeByName = (name: string): MeasurementNode | null => {
    for (const category of MEASUREMENT_CATEGORIES) {
      const node = category.nodes.find(n => n.name === name);
      if (node) return node;
    }
    return null;
  };

  const selectNode = (node: MeasurementNode) => {
    setForm(prev => ({
      ...prev,
      nodeName: node.name,
      unit: node.unit,
      meterMode: node.meterMode,
      expectedMin: node.expectedMin !== undefined ? String(node.expectedMin) : '',
      expectedMax: node.expectedMax !== undefined ? String(node.expectedMax) : '',
    }));
  };

  // ─── Diagnostic Sequence ────────────────────────────────────────────────

  const startDiagnosticSequence = () => {
    setDiagnosticMode(true);
    setDiagnosticStep(0);
    const firstNode = findNodeByName(DEFAULT_DIAGNOSTIC_SEQUENCE[0]);
    if (firstNode) selectNode(firstNode);
    setShowAddModal(true);
  };

  const advanceDiagnostic = () => {
    if (diagnosticStep < DEFAULT_DIAGNOSTIC_SEQUENCE.length - 1) {
      const nextStep = diagnosticStep + 1;
      setDiagnosticStep(nextStep);
      const nextNode = findNodeByName(DEFAULT_DIAGNOSTIC_SEQUENCE[nextStep]);
      if (nextNode) selectNode(nextNode);
    } else {
      setDiagnosticMode(false);
      setDiagnosticStep(0);
    }
  };

  const exitDiagnostic = () => {
    setDiagnosticMode(false);
    setShowAddModal(false);
  };

  // ─── Delete ─────────────────────────────────────────────────────────────

  const deleteMeasurement = async (id: string) => {
    const confirmed = await showConfirm(
      'Delete Measurement',
      'Remove this measurement? This cannot be undone.',
      { confirmText: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await measurementsApi.remove(id);
      setMeasurements(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting measurement:', error);
      showError('Failed to delete measurement');
    }
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const saveMeasurement = async () => {
    if (!form.nodeName || !form.recordedValue) {
      showAlert('Required', 'Please enter node name and recorded value');
      return;
    }

    setSaving(true);
    try {
      const data = await measurementsApi.create({
        benchJobId,
        nodeName: form.nodeName,
        expectedMin: form.expectedMin ? parseFloat(form.expectedMin) : null,
        expectedMax: form.expectedMax ? parseFloat(form.expectedMax) : null,
        recordedValue: parseFloat(form.recordedValue),
        unit: form.unit,
        meterTool: form.meterTool,
        meterMode: form.meterMode,
        notes: form.notes,
      });

      setMeasurements(prev => [data, ...prev]);

      if (diagnosticMode) {
        advanceDiagnostic();
        setForm(prev => ({ ...prev, recordedValue: '', notes: '' }));
      } else {
        setShowAddModal(false);
        setForm(EMPTY_FORM);
      }
    } catch (error) {
      console.error('Error saving measurement:', error);
      showError('Failed to save measurement');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Loading measurements..." />;

  if (!benchJobId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.status.error} />
        <Text style={styles.errorText}>No job selected</Text>
        <TouchableOpacity onPress={goBack} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Measurements</Text>
          <Text style={styles.subtitle}>{jobName || 'Bench Job'}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <TouchableOpacity style={styles.diagnosticButton} onPress={startDiagnosticSequence}>
          <Ionicons name="navigate" size={24} color={colors.accent} />
          <Text style={styles.diagnosticButtonText}>Start Diagnostic Sequence</Text>
        </TouchableOpacity>

        {measurements.length === 0 ? (
          <EmptyState
            icon="speedometer-outline"
            title="No measurements recorded"
            subtitle="Tap the button above or + to add measurements"
          />
        ) : (
          measurements.map((m) => (
            <MeasurementCard key={m.id} measurement={m} onDelete={deleteMeasurement} />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={32} color={colors.text.onAccent} />
      </TouchableOpacity>

      {/* Modal */}
      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setDiagnosticMode(false); }}
        onSave={saveMeasurement}
        saving={saving}
        form={form}
        onFormChange={setForm}
        onSelectNode={selectNode}
        diagnosticMode={diagnosticMode}
        diagnosticStep={diagnosticStep}
        diagnosticTotal={DEFAULT_DIAGNOSTIC_SEQUENCE.length}
        onExitDiagnostic={exitDiagnostic}
        voltageCards={voltageCards.length > 0 ? voltageCards : undefined}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.text.secondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  errorButtonText: {
    color: colors.text.onAccent,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: { padding: 8, marginRight: 12 },
  headerText: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    fontFamily: 'Jost-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  scrollView: { flex: 1, padding: 16 },
  diagnosticButton: {
    backgroundColor: colors.bg.warm,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  diagnosticButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
