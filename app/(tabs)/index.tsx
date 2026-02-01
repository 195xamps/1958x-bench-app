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
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface BenchJob {
  id: string;
  status: string;
  ownerSymptoms: string;
  techNotes: string;
  safetyChecklistCompleted: boolean;
  createdAt: string;
}

interface AmpProfile {
  make: string;
  model: string;
  year: string;
  circuitFamily: string;
}

const SAFETY_CHECKLIST = [
  'Isolation transformer connected and verified',
  'High voltage capacitors discharged (check with meter)',
  'PPE available (rubber gloves, safety glasses)',
  'One-hand rule understood for HV measurements',
  'Meter verified working on known voltage source',
  'Work area clear and dry',
  'Emergency shutoff accessible',
];

export default function JobsScreen() {
  const [jobs, setJobs] = useState<BenchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<boolean[]>(new Array(SAFETY_CHECKLIST.length).fill(false));
  
  const [newJob, setNewJob] = useState({
    ampMake: '',
    ampModel: '',
    ampYear: '',
    circuitFamily: '',
    ownerSymptoms: '',
    techNotes: '',
    priorWork: '',
    knownMods: '',
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bench-jobs`);
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createJob = async () => {
    if (!newJob.ampMake && !newJob.ampModel) {
      Alert.alert('Required', 'Please enter at least amp make or model');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/bench-jobs`, newJob);
      setJobs([response.data.benchJob, ...jobs]);
      setShowNewJobModal(false);
      setCurrentJobId(response.data.benchJob.id);
      setNewJob({
        ampMake: '',
        ampModel: '',
        ampYear: '',
        circuitFamily: '',
        ownerSymptoms: '',
        techNotes: '',
        priorWork: '',
        knownMods: '',
      });
      setSafetyChecks(new Array(SAFETY_CHECKLIST.length).fill(false));
      setShowSafetyModal(true);
    } catch (error) {
      console.error('Error creating job:', error);
      Alert.alert('Error', 'Failed to create bench job');
    }
  };

  const completeSafetyChecklist = async () => {
    if (!safetyChecks.every(check => check)) {
      Alert.alert('Safety First', 'Please confirm all safety checks before proceeding');
      return;
    }

    try {
      await axios.patch(`${API_URL}/api/bench-jobs/${currentJobId}/safety-checklist`);
      setShowSafetyModal(false);
      fetchJobs();
      Alert.alert('Ready to Proceed', 'Safety checklist completed. You may now begin troubleshooting.');
    } catch (error) {
      console.error('Error completing safety checklist:', error);
    }
  };

  const toggleSafetyCheck = (index: number) => {
    const newChecks = [...safetyChecks];
    newChecks[index] = !newChecks[index];
    setSafetyChecks(newChecks);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading bench jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>195X Bench App</Text>
          <Text style={styles.subtitle}>Guitar Amp Troubleshooting Assistant</Text>
        </View>

        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="build-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No bench jobs yet</Text>
            <Text style={styles.emptySubtext}>Start a new job to begin troubleshooting</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity key={job.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={[styles.statusBadge, job.status === 'active' ? styles.statusActive : styles.statusComplete]}>
                  <Text style={styles.statusText}>{job.status}</Text>
                </View>
                {job.safetyChecklistCompleted && (
                  <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
                )}
              </View>
              <Text style={styles.jobSymptoms} numberOfLines={2}>
                {job.ownerSymptoms || 'No symptoms recorded'}
              </Text>
              <Text style={styles.jobDate}>
                {new Date(job.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewJobModal(true)}
      >
        <Ionicons name="add" size={32} color="#1f2937" />
      </TouchableOpacity>

      <Modal visible={showNewJobModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Bench Job</Text>
              <TouchableOpacity onPress={() => setShowNewJobModal(false)}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.sectionTitle}>Amp Identification</Text>
              
              <Text style={styles.inputLabel}>Make</Text>
              <TextInput
                style={styles.input}
                value={newJob.ampMake}
                onChangeText={(text) => setNewJob({ ...newJob, ampMake: text })}
                placeholder="e.g., Fender, Marshall, Vox"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={newJob.ampModel}
                onChangeText={(text) => setNewJob({ ...newJob, ampModel: text })}
                placeholder="e.g., Deluxe Reverb, JCM800"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Year (if known)</Text>
              <TextInput
                style={styles.input}
                value={newJob.ampYear}
                onChangeText={(text) => setNewJob({ ...newJob, ampYear: text })}
                placeholder="e.g., 1965, 1970s"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Circuit Family</Text>
              <TextInput
                style={styles.input}
                value={newJob.circuitFamily}
                onChangeText={(text) => setNewJob({ ...newJob, circuitFamily: text })}
                placeholder="e.g., AB763, 5E3, JTM45"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.sectionTitle}>Problem Description</Text>

              <Text style={styles.inputLabel}>Owner Symptoms</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newJob.ownerSymptoms}
                onChangeText={(text) => setNewJob({ ...newJob, ownerSymptoms: text })}
                placeholder="What is the owner experiencing? e.g., Hum after recap, no sound, volume drop..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Known Mods</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newJob.knownMods}
                onChangeText={(text) => setNewJob({ ...newJob, knownMods: text })}
                placeholder="Any modifications to the original circuit?"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
              />

              <Text style={styles.inputLabel}>Prior Tech Work</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newJob.priorWork}
                onChangeText={(text) => setNewJob({ ...newJob, priorWork: text })}
                placeholder="Any previous repair attempts?"
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
              />

              <Text style={styles.inputLabel}>Tech Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newJob.techNotes}
                onChangeText={(text) => setNewJob({ ...newJob, techNotes: text })}
                placeholder="Initial observations..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
              />
            </ScrollView>

            <TouchableOpacity style={styles.createButton} onPress={createJob}>
              <Text style={styles.createButtonText}>Create Job & Safety Check</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSafetyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={28} color="#f59e0b" />
              <Text style={styles.modalTitle}>Safety Checklist</Text>
            </View>

            <Text style={styles.safetyWarning}>
              HIGH VOLTAGE WARNING: Guitar amplifiers contain lethal voltages. Confirm each safety measure before proceeding.
            </Text>

            <ScrollView style={styles.modalScroll}>
              {SAFETY_CHECKLIST.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.checklistItem}
                  onPress={() => toggleSafetyCheck(index)}
                >
                  <View style={[styles.checkbox, safetyChecks[index] && styles.checkboxChecked]}>
                    {safetyChecks[index] && (
                      <Ionicons name="checkmark" size={18} color="#1f2937" />
                    )}
                  </View>
                  <Text style={styles.checklistText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.safetyButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSafetyModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !safetyChecks.every(c => c) && styles.buttonDisabled]}
                onPress={completeSafetyChecklist}
              >
                <Text style={styles.confirmButtonText}>Confirm & Proceed</Text>
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
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
  jobCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#065f46',
  },
  statusComplete: {
    backgroundColor: '#374151',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  jobSymptoms: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 8,
  },
  jobDate: {
    color: '#6b7280',
    fontSize: 12,
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
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginTop: 16,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
  },
  safetyWarning: {
    backgroundColor: '#7c2d12',
    padding: 12,
    borderRadius: 8,
    color: '#fef3c7',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6b7280',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checklistText: {
    color: '#e5e7eb',
    fontSize: 15,
    flex: 1,
  },
  safetyButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
