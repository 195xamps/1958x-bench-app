import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';

const API_URL = '';

interface Measurement {
  id: string;
  nodeName: string;
  expectedMin: number | null;
  expectedMax: number | null;
  recordedValue: number | null;
  unit: string;
  meterTool: string;
  meterMode: string;
  status: string;
  notes: string;
  createdAt: string;
}

const COMMON_NODES = [
  { name: 'B+1', description: 'First filter cap' },
  { name: 'B+2', description: 'Second filter cap' },
  { name: 'B+3', description: 'Third filter cap' },
  { name: 'Plate V1', description: 'V1 plate voltage' },
  { name: 'Plate V2', description: 'V2 plate voltage' },
  { name: 'Cathode V1', description: 'V1 cathode voltage' },
  { name: 'Screen', description: 'Output tube screen voltage' },
  { name: 'Bias', description: 'Fixed bias voltage' },
  { name: 'Heater', description: 'Heater voltage (AC)' },
  { name: 'Ripple', description: 'B+ ripple (mV AC)' },
];

const METER_MODES = [
  'DC Volts',
  'AC Volts',
  'mV DC',
  'mV AC',
  'Ohms',
  'Diode Test',
  'Continuity',
];

const UNITS = ['V', 'mV', 'A', 'mA', 'ohms', 'k-ohms', 'M-ohms'];

export default function MeasurementScreen() {
  const { benchJobId, jobName } = useLocalSearchParams<{ benchJobId: string; jobName: string }>();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newMeasurement, setNewMeasurement] = useState({
    nodeName: '',
    expectedMin: '',
    expectedMax: '',
    recordedValue: '',
    unit: 'V',
    meterTool: '',
    meterMode: 'DC Volts',
    notes: '',
  });

  useEffect(() => {
    if (benchJobId) {
      fetchMeasurements();
    } else {
      setLoading(false);
    }
  }, [benchJobId]);

  const fetchMeasurements = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/measurements/${benchJobId}`);
      setMeasurements(response.data);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMeasurement = async () => {
    if (!newMeasurement.nodeName || !newMeasurement.recordedValue) {
      Alert.alert('Required', 'Please enter node name and recorded value');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/api/measurements`, {
        benchJobId,
        nodeName: newMeasurement.nodeName,
        expectedMin: newMeasurement.expectedMin ? parseFloat(newMeasurement.expectedMin) : null,
        expectedMax: newMeasurement.expectedMax ? parseFloat(newMeasurement.expectedMax) : null,
        recordedValue: parseFloat(newMeasurement.recordedValue),
        unit: newMeasurement.unit,
        meterTool: newMeasurement.meterTool,
        meterMode: newMeasurement.meterMode,
        notes: newMeasurement.notes,
      });

      setMeasurements([response.data, ...measurements]);
      setShowAddModal(false);
      setNewMeasurement({
        nodeName: '',
        expectedMin: '',
        expectedMax: '',
        recordedValue: '',
        unit: 'V',
        meterTool: '',
        meterMode: 'DC Volts',
        notes: '',
      });
    } catch (error) {
      console.error('Error saving measurement:', error);
      Alert.alert('Error', 'Failed to save measurement');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return '#22c55e';
      case 'yellow': return '#f59e0b';
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'green': return 'checkmark-circle';
      case 'yellow': return 'warning';
      case 'red': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading measurements...</Text>
      </View>
    );
  }

  if (!benchJobId) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.loadingText}>No job selected</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, padding: 12, backgroundColor: '#f59e0b', borderRadius: 8 }}>
          <Text style={{ color: '#1f2937', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Measurements</Text>
          <Text style={styles.subtitle}>{jobName || 'Bench Job'}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {measurements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="speedometer-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No measurements recorded</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a measurement</Text>
          </View>
        ) : (
          measurements.map((measurement) => (
            <View key={measurement.id} style={styles.measurementCard}>
              <View style={styles.measurementHeader}>
                <View style={styles.nodeInfo}>
                  <Text style={styles.nodeName}>{measurement.nodeName}</Text>
                  <Text style={styles.meterMode}>{measurement.meterMode}</Text>
                </View>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(measurement.status) + '30' }]}>
                  <Ionicons name={getStatusIcon(measurement.status)} size={20} color={getStatusColor(measurement.status)} />
                </View>
              </View>

              <View style={styles.valueRow}>
                <View style={styles.valueBlock}>
                  <Text style={styles.valueLabel}>Recorded</Text>
                  <Text style={[styles.valueText, { color: getStatusColor(measurement.status) }]}>
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

              {measurement.meterTool && (
                <Text style={styles.meterTool}>Tool: {measurement.meterTool}</Text>
              )}

              {measurement.notes && (
                <Text style={styles.notes}>{measurement.notes}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={32} color="#1f2937" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Measurement</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.sectionTitle}>Quick Select Node</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nodesScroll}>
                {COMMON_NODES.map((node, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.nodeChip,
                      newMeasurement.nodeName === node.name && styles.nodeChipSelected,
                    ]}
                    onPress={() => setNewMeasurement({ ...newMeasurement, nodeName: node.name })}
                  >
                    <Text style={[
                      styles.nodeChipText,
                      newMeasurement.nodeName === node.name && styles.nodeChipTextSelected,
                    ]}>
                      {node.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Node Name *</Text>
              <TextInput
                style={styles.input}
                value={newMeasurement.nodeName}
                onChangeText={(text) => setNewMeasurement({ ...newMeasurement, nodeName: text })}
                placeholder="e.g., B+1, V1 Plate, Cathode"
                placeholderTextColor="#6b7280"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Expected Min</Text>
                  <TextInput
                    style={styles.input}
                    value={newMeasurement.expectedMin}
                    onChangeText={(text) => setNewMeasurement({ ...newMeasurement, expectedMin: text })}
                    placeholder="e.g., 380"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Expected Max</Text>
                  <TextInput
                    style={styles.input}
                    value={newMeasurement.expectedMax}
                    onChangeText={(text) => setNewMeasurement({ ...newMeasurement, expectedMax: text })}
                    placeholder="e.g., 420"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Recorded Value *</Text>
                  <TextInput
                    style={styles.input}
                    value={newMeasurement.recordedValue}
                    onChangeText={(text) => setNewMeasurement({ ...newMeasurement, recordedValue: text })}
                    placeholder="e.g., 405"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {UNITS.map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitChip,
                          newMeasurement.unit === unit && styles.unitChipSelected,
                        ]}
                        onPress={() => setNewMeasurement({ ...newMeasurement, unit })}
                      >
                        <Text style={[
                          styles.unitChipText,
                          newMeasurement.unit === unit && styles.unitChipTextSelected,
                        ]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.inputLabel}>Meter Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.meterModesScroll}>
                {METER_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeChip,
                      newMeasurement.meterMode === mode && styles.modeChipSelected,
                    ]}
                    onPress={() => setNewMeasurement({ ...newMeasurement, meterMode: mode })}
                  >
                    <Text style={[
                      styles.modeChipText,
                      newMeasurement.meterMode === mode && styles.modeChipTextSelected,
                    ]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Meter Tool</Text>
              <TextInput
                style={styles.input}
                value={newMeasurement.meterTool}
                onChangeText={(text) => setNewMeasurement({ ...newMeasurement, meterTool: text })}
                placeholder="e.g., Fluke 87V"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newMeasurement.notes}
                onChangeText={(text) => setNewMeasurement({ ...newMeasurement, notes: text })}
                placeholder="Any observations about this measurement..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={saveMeasurement}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <Text style={styles.saveButtonText}>Save Measurement</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  measurementCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  meterMode: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  valueBlock: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rangeText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  meterTool: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  modalScroll: {
    maxHeight: 450,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 10,
  },
  nodesScroll: {
    marginBottom: 16,
  },
  nodeChip: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  nodeChipSelected: {
    backgroundColor: '#f59e0b',
  },
  nodeChipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  nodeChipTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  unitChip: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginTop: 8,
  },
  unitChipSelected: {
    backgroundColor: '#f59e0b',
  },
  unitChipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  unitChipTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
  meterModesScroll: {
    marginBottom: 8,
  },
  modeChip: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  modeChipSelected: {
    backgroundColor: '#f59e0b',
  },
  modeChipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  modeChipTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
