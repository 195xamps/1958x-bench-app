import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { CreateJobPayload } from '../../types';

interface Props {
  visible: boolean;
  newJob: CreateJobPayload;
  creating: boolean;
  onClose: () => void;
  onChange: (job: CreateJobPayload) => void;
  onCreate: () => void;
}

export function NewJobModal({ visible, newJob, creating, onClose, onChange, onCreate }: Props) {
  const update = (patch: Partial<CreateJobPayload>) => onChange({ ...newJob, ...patch });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.overlay}>
          <View style={s.content}>
            <View style={s.header}>
              <Text style={s.title}>New Bench Job</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
              <Text style={s.section}>Customer</Text>
              <Field label="Customer Name" value={newJob.customerName || ''} onChange={(t) => update({ customerName: t })} placeholder="e.g., John Smith" />
              <Field label="Phone" value={newJob.customerPhone || ''} onChange={(t) => update({ customerPhone: t })} placeholder="e.g., 555-1234" keyboardType="phone-pad" />

              <Text style={s.section}>Amp Identification</Text>
              <Field label="Make" value={newJob.ampMake} onChange={(t) => update({ ampMake: t })} placeholder="e.g., Fender, Marshall, Vox" />
              <Field label="Model" value={newJob.ampModel} onChange={(t) => update({ ampModel: t })} placeholder="e.g., Deluxe Reverb, JCM800" />
              <Field label="Year (if known)" value={newJob.ampYear || ''} onChange={(t) => update({ ampYear: t })} placeholder="e.g., 1965, 1970s" />
              <Field label="Circuit Family" value={newJob.circuitFamily || ''} onChange={(t) => update({ circuitFamily: t })} placeholder="e.g., AB763, 5E3, JTM45" />

              <Text style={s.section}>Problem Description</Text>
              <Field label="Owner Symptoms" value={newJob.ownerSymptoms || ''} onChange={(t) => update({ ownerSymptoms: t })} placeholder="What is the owner experiencing?" multiline />
              <Field label="Known Mods" value={newJob.knownMods || ''} onChange={(t) => update({ knownMods: t })} placeholder="Any modifications to the original circuit?" multiline />
              <Field label="Prior Tech Work" value={newJob.priorWork || ''} onChange={(t) => update({ priorWork: t })} placeholder="Any previous repair attempts?" multiline />
              <Field label="Tech Notes" value={newJob.techNotes || ''} onChange={(t) => update({ techNotes: t })} placeholder="Initial observations..." multiline />
            </ScrollView>
            <TouchableOpacity
              style={[s.createButton, creating && { opacity: 0.6 }]}
              onPress={onCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color={colors.text.onAccent} />
                : <Text style={s.createButtonText}>Create Job & Safety Check</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric';
}) {
  return (
    <>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType || 'default'}
      />
    </>
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
  section: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 16, marginBottom: 8 },
  inputLabel: { fontSize: 13, color: colors.text.secondary, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: colors.bg.elevated, borderRadius: 10, padding: 14, color: colors.text.bright,
    fontSize: 15, borderWidth: 1, borderColor: colors.bg.elevated,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  createButton: {
    backgroundColor: colors.accent, marginHorizontal: 20, marginTop: 12, padding: 16,
    borderRadius: 12, alignItems: 'center',
  },
  createButtonText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },
});
