import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { MEASUREMENT_CATEGORIES } from '../../data';
import type { MeasurementNode } from '../../data';
import { METER_MODES, UNITS } from '../../data/measurementConstants';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MeasurementFormData {
  nodeName: string;
  expectedMin: string;
  expectedMax: string;
  recordedValue: string;
  unit: string;
  meterTool: string;
  meterMode: string;
  notes: string;
}

export const EMPTY_FORM: MeasurementFormData = {
  nodeName: '',
  expectedMin: '',
  expectedMax: '',
  recordedValue: '',
  unit: 'V',
  meterTool: '',
  meterMode: 'DC Volts',
  notes: '',
};

interface AddMeasurementModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  form: MeasurementFormData;
  onFormChange: (form: MeasurementFormData) => void;
  onSelectNode: (node: MeasurementNode) => void;
  // Diagnostic mode
  diagnosticMode: boolean;
  diagnosticStep: number;
  diagnosticTotal: number;
  onExitDiagnostic: () => void;
}

export function AddMeasurementModal({
  visible,
  onClose,
  onSave,
  saving,
  form,
  onFormChange,
  onSelectNode,
  diagnosticMode,
  diagnosticStep,
  diagnosticTotal,
  onExitDiagnostic,
}: AddMeasurementModalProps) {
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const updateField = (field: keyof MeasurementFormData, value: string) => {
    onFormChange({ ...form, [field]: value });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Measurement</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Diagnostic Banner */}
          {diagnosticMode && (
            <View style={styles.diagnosticBanner}>
              <View style={styles.diagnosticProgress}>
                <Ionicons name="navigate" size={20} color={colors.accent} />
                <Text style={styles.diagnosticText}>
                  Diagnostic Step {diagnosticStep + 1} of {diagnosticTotal}
                </Text>
              </View>
              <TouchableOpacity onPress={onExitDiagnostic} style={styles.diagnosticExit}>
                <Text style={styles.diagnosticExitText}>Exit Sequence</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Two-Column Layout */}
          <View style={styles.twoColumn}>
            {/* Left: Node Selection */}
            <ScrollView style={styles.leftColumn}>
              <Text style={styles.sectionTitle}>Select Node</Text>
              {MEASUREMENT_CATEGORIES.map((category) => (
                <View key={category.id} style={styles.categoryContainer}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <View style={styles.categoryTitleRow}>
                      <Ionicons name={category.icon as any} size={18} color={colors.accent} />
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                    </View>
                    <Ionicons
                      name={expandedCategories[category.id] ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>

                  {expandedCategories[category.id] && (
                    <View style={styles.categoryNodes}>
                      <View style={styles.nodeGrid}>
                        {category.nodes.map((node) => (
                          <TouchableOpacity
                            key={node.name}
                            style={[
                              styles.nodeChip,
                              form.nodeName === node.name && styles.nodeChipSelected,
                            ]}
                            onPress={() => onSelectNode(node)}
                          >
                            <Text
                              style={[
                                styles.nodeChipText,
                                form.nodeName === node.name && styles.nodeChipTextSelected,
                              ]}
                            >
                              {node.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Right: Form */}
            <View style={styles.rightColumn}>
              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Node Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.nodeName}
                  onChangeText={(t) => updateField('nodeName', t)}
                  placeholder="Select from left or type"
                  placeholderTextColor={colors.text.muted}
                />

                <Text style={styles.inputLabel}>Recorded Value *</Text>
                <TextInput
                  style={[styles.input, styles.recordedValueInput]}
                  value={form.recordedValue}
                  onChangeText={(t) => updateField('recordedValue', t)}
                  placeholder="Enter value"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                />

                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>Expected Min</Text>
                    <TextInput
                      style={styles.input}
                      value={form.expectedMin}
                      onChangeText={(t) => updateField('expectedMin', t)}
                      placeholder="Min"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>Expected Max</Text>
                    <TextInput
                      style={styles.input}
                      value={form.expectedMax}
                      onChangeText={(t) => updateField('expectedMax', t)}
                      placeholder="Max"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Unit</Text>
                <View style={styles.chipRow}>
                  {UNITS.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.chip, form.unit === unit && styles.chipSelected]}
                      onPress={() => updateField('unit', unit)}
                    >
                      <Text style={[styles.chipText, form.unit === unit && styles.chipTextSelected]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Meter Mode</Text>
                <View style={styles.chipRow}>
                  {METER_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.chip, form.meterMode === mode && styles.chipSelected]}
                      onPress={() => updateField('meterMode', mode)}
                    >
                      <Text style={[styles.chipText, form.meterMode === mode && styles.chipTextSelected]}>
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.notes}
                  onChangeText={(t) => updateField('notes', t)}
                  placeholder="Optional observations..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={2}
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.text.onAccent} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {diagnosticMode ? 'Save & Next' : 'Save Measurement'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
  },
  // Diagnostic
  diagnosticBanner: {
    backgroundColor: colors.bg.warm,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  diagnosticProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  diagnosticExit: { padding: 8 },
  diagnosticExitText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  // Two-column
  twoColumn: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
    maxWidth: '45%',
  },
  rightColumn: {
    flex: 1,
    maxWidth: '55%',
  },
  formScroll: { flex: 1 },
  // Node selection
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.bright,
    marginBottom: 10,
  },
  categoryContainer: {
    marginBottom: 8,
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryTitle: {
    color: colors.text.bright,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryNodes: {
    padding: 14,
    paddingTop: 0,
  },
  nodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nodeChip: {
    backgroundColor: colors.bg.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  nodeChipSelected: {
    backgroundColor: colors.accent,
  },
  nodeChipText: {
    color: colors.text.light,
    fontSize: 12,
  },
  nodeChipTextSelected: {
    color: colors.text.onAccent,
    fontWeight: '600',
  },
  // Form
  inputLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    padding: 14,
    color: colors.white,
    fontSize: 16,
  },
  recordedValueInput: {
    fontSize: 20,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: { flex: 1 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.text.onAccent,
    fontWeight: '600',
  },
  // Save
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: colors.text.onAccent,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: { opacity: 0.5 },
});
