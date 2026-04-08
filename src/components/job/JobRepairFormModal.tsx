import React from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { RepairFormState } from './types';

interface Props {
  visible: boolean;
  isEditing: boolean;
  form: RepairFormState;
  photoUrl: string | null;
  uploadingPhoto: boolean;
  saving: boolean;
  onClose: () => void;
  onChange: (form: RepairFormState) => void;
  onPickPhoto: (useCamera: boolean) => void;
  onClearPhoto: () => void;
  onSave: () => void;
}

export function JobRepairFormModal({
  visible,
  isEditing,
  form,
  photoUrl,
  uploadingPhoto,
  saving,
  onClose,
  onChange,
  onPickPhoto,
  onClearPhoto,
  onSave,
}: Props) {
  const update = (patch: Partial<RepairFormState>) => onChange({ ...form, ...patch });

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.title}>{isEditing ? 'Edit Repair' : 'Add Repair Action'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={s.label}>What was done? *</Text>
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={form.description}
              onChangeText={(t) => update({ description: t })}
              placeholder="e.g. Replaced coupling cap at V1 plate"
              placeholderTextColor={colors.text.muted}
              multiline
            />

            <Text style={s.label}>Part Replaced</Text>
            <TextInput
              style={s.input}
              value={form.partReplaced}
              onChangeText={(t) => update({ partReplaced: t })}
              placeholder="e.g. Coupling capacitor C3"
              placeholderTextColor={colors.text.muted}
            />

            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Value</Text>
                <TextInput
                  style={s.input}
                  value={form.partValue}
                  onChangeText={(t) => update({ partValue: t })}
                  placeholder="e.g. 0.022µF"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Brand</Text>
                <TextInput
                  style={s.input}
                  value={form.partBrand}
                  onChangeText={(t) => update({ partBrand: t })}
                  placeholder="e.g. Sprague"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Voltage Rating</Text>
                <TextInput
                  style={s.input}
                  value={form.voltageRating}
                  onChangeText={(t) => update({ voltageRating: t })}
                  placeholder="e.g. 600V"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Date Code</Text>
                <TextInput
                  style={s.input}
                  value={form.dateCode}
                  onChangeText={(t) => update({ dateCode: t })}
                  placeholder="e.g. 6428"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Before</Text>
                <TextInput
                  style={s.input}
                  value={form.beforeMeasurement}
                  onChangeText={(t) => update({ beforeMeasurement: t })}
                  placeholder="e.g. 180V DC"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
              <View style={s.half}>
                <Text style={s.label}>After</Text>
                <TextInput
                  style={s.input}
                  value={form.afterMeasurement}
                  onChangeText={(t) => update({ afterMeasurement: t })}
                  placeholder="e.g. 250V DC"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>

            <Text style={s.label}>Notes</Text>
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={form.notes}
              onChangeText={(t) => update({ notes: t })}
              placeholder="Additional notes..."
              placeholderTextColor={colors.text.muted}
              multiline
            />

            <Text style={s.label}>Photo</Text>
            {photoUrl ? (
              <View style={s.photoPreview}>
                <Image source={{ uri: photoUrl }} style={s.photoThumb} resizeMode="cover" />
                <TouchableOpacity style={s.photoRemove} onPress={onClearPhoto}>
                  <Ionicons name="close-circle" size={22} color={colors.status.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.photoButtons}>
                <TouchableOpacity
                  style={s.photoBtn}
                  onPress={() => onPickPhoto(true)}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={colors.accent} />
                  )}
                  <Text style={s.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.photoBtn}
                  onPress={() => onPickPhoto(false)}
                  disabled={uploadingPhoto}
                >
                  <Ionicons name="image-outline" size={20} color={colors.accent} />
                  <Text style={s.photoBtnText}>Library</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <TouchableOpacity
            style={[s.saveButton, saving && s.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.onAccent} />
            ) : (
              <Text style={s.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Repair'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '92%', flex: 1,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.accent },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.text.secondary,
    marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: colors.bg.elevated, borderRadius: 10, padding: 14,
    color: colors.text.bright, fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  photoPreview: { position: 'relative', marginBottom: 4 },
  photoThumb: { width: '100%', height: 160, borderRadius: 8 },
  photoRemove: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: colors.bg.primary, borderRadius: 11,
  },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: colors.bg.elevated, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border.default,
  },
  photoBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  saveButtonText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});
