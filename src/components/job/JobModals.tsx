import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
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
import { JOB_STATUSES } from '../../types/common';
import { openUrl } from '../../utils';
import type { Attachment } from '../../types';
import { ToggleRow } from './JobNotesTab';

// ─── Status Picker Modal ────────────────────────────────────────────────────

interface StatusPickerProps {
  visible: boolean;
  currentStatus: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}

export function JobStatusPickerModal({ visible, currentStatus, onClose, onSelect }: StatusPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={s.pickerContent}>
          <Text style={s.pickerTitle}>Update Status</Text>
          {JOB_STATUSES.filter((status) => status.value !== 'all').map((status) => (
            <TouchableOpacity
              key={status.value}
              style={[s.pickerOption, currentStatus === status.value && s.pickerOptionSelected]}
              onPress={() => onSelect(status.value)}
            >
              <View style={[s.statusDot, { backgroundColor: status.color }]} />
              <Text style={[s.pickerOptionText, { color: status.color }]}>{status.label}</Text>
              {currentStatus === status.value && (
                <Ionicons name="checkmark" size={20} color={status.color} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Share Modal ────────────────────────────────────────────────────────────

interface ShareModalProps {
  visible: boolean;
  isPublic: boolean;
  shareAnonymously: boolean;
  saving: boolean;
  onClose: () => void;
  onTogglePublic: (value: boolean) => void;
  onToggleAnonymous: (value: boolean) => void;
}

export function JobShareModal({
  visible,
  isPublic,
  shareAnonymously,
  saving,
  onClose,
  onTogglePublic,
  onToggleAnonymous,
}: ShareModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={s.shareModalContent}>
          <View style={s.shareModalHeader}>
            <Ionicons name="globe-outline" size={24} color={colors.accent} />
            <Text style={s.shareModalTitle}>Community Sharing</Text>
          </View>
          <Text style={s.shareModalDescription}>
            Share this job with the community so other technicians can learn from your work.
          </Text>
          <ToggleRow
            label="Share to Community Bench"
            hint="Other technicians can view this job (read-only)"
            value={isPublic}
            onToggle={() => onTogglePublic(!isPublic)}
            disabled={saving}
          />
          {isPublic && (
            <ToggleRow
              label="Share Anonymously"
              hint="Hide your name from the shared job"
              value={shareAnonymously}
              onToggle={() => onToggleAnonymous(!shareAnonymously)}
              disabled={saving}
            />
          )}
          {saving && (
            <View style={s.savingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.savingText}>Saving...</Text>
            </View>
          )}
          <TouchableOpacity style={s.doneButton} onPress={onClose}>
            <Text style={s.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Edit Amp Modal ─────────────────────────────────────────────────────────

interface EditAmpModalProps {
  visible: boolean;
  form: { make: string; model: string; year: string; circuitFamily: string };
  saving: boolean;
  onClose: () => void;
  onChange: (form: { make: string; model: string; year: string; circuitFamily: string }) => void;
  onSave: () => void;
}

export function JobEditAmpModal({ visible, form, saving, onClose, onChange, onSave }: EditAmpModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.repairModalOverlay}>
        <View style={s.repairModalContent}>
          <View style={s.repairModalHeader}>
            <Text style={s.repairModalTitle}>Edit Amp Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.formRow}>
              <View style={s.formHalf}>
                <Text style={s.editLabel}>Make</Text>
                <TextInput
                  style={s.editInput}
                  value={form.make}
                  onChangeText={(t) => onChange({ ...form, make: t })}
                  placeholder="e.g. Fender"
                  placeholderTextColor={colors.text.muted}
                  autoFocus
                />
              </View>
              <View style={s.formHalf}>
                <Text style={s.editLabel}>Model</Text>
                <TextInput
                  style={s.editInput}
                  value={form.model}
                  onChangeText={(t) => onChange({ ...form, model: t })}
                  placeholder="e.g. Deluxe Reverb"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>

            <View style={s.formRow}>
              <View style={s.formHalf}>
                <Text style={s.editLabel}>Year</Text>
                <TextInput
                  style={s.editInput}
                  value={form.year}
                  onChangeText={(t) => onChange({ ...form, year: t })}
                  placeholder="e.g. 1966"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                />
              </View>
              <View style={s.formHalf}>
                <Text style={s.editLabel}>Circuit Family</Text>
                <TextInput
                  style={s.editInput}
                  value={form.circuitFamily}
                  onChangeText={(t) => onChange({ ...form, circuitFamily: t })}
                  placeholder="e.g. Blackface"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            </View>

            <Text style={[s.editLabel, { marginTop: 8 }]}>Common Families</Text>
            <View style={s.editChipRow}>
              {['Blackface', 'Silverface', 'Tweed', 'Marshall', 'Vox', 'Other'].map((family) => (
                <TouchableOpacity
                  key={family}
                  style={[s.editChip, form.circuitFamily === family && s.editChipSelected]}
                  onPress={() => onChange({ ...form, circuitFamily: form.circuitFamily === family ? '' : family })}
                >
                  <Text style={[s.editChipText, form.circuitFamily === family && s.editChipTextSelected]}>
                    {family}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 12 }} />
          </ScrollView>
          <TouchableOpacity
            style={[s.saveButton, saving && s.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.onAccent} />
            ) : (
              <Text style={s.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Customer Modal ─────────────────────────────────────────────────────────

interface CustomerModalProps {
  visible: boolean;
  form: { customerName: string; customerPhone: string };
  saving: boolean;
  onClose: () => void;
  onChange: (form: { customerName: string; customerPhone: string }) => void;
  onSave: () => void;
}

export function JobCustomerModal({ visible, form, saving, onClose, onChange, onSave }: CustomerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.repairModalOverlay}>
        <View style={[s.repairModalContent, { flex: undefined }]}>
          <View style={s.repairModalHeader}>
            <Text style={s.repairModalTitle}>Customer Info</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={s.editLabel}>Name</Text>
          <TextInput
            style={s.editInput}
            value={form.customerName}
            onChangeText={(t) => onChange({ ...form, customerName: t })}
            placeholder="Customer name"
            placeholderTextColor={colors.text.muted}
            autoFocus
          />
          <Text style={[s.editLabel, { marginTop: 12 }]}>Phone</Text>
          <TextInput
            style={s.editInput}
            value={form.customerPhone}
            onChangeText={(t) => onChange({ ...form, customerPhone: t })}
            placeholder="Phone number"
            placeholderTextColor={colors.text.muted}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[s.saveButton, saving && s.buttonDisabled, { marginTop: 20 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.onAccent} />
            ) : (
              <Text style={s.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Media Gallery Modal ────────────────────────────────────────────────────

interface MediaGalleryProps {
  visible: boolean;
  attachments: Attachment[];
  onClose: () => void;
}

export function JobMediaGalleryModal({ visible, attachments, onClose }: MediaGalleryProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.galleryOverlay}>
        <View style={s.galleryContainer}>
          <View style={s.galleryHeader}>
            <Text style={s.galleryTitle}>Media Gallery</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {attachments.length === 0 ? (
            <View style={s.emptyGallery}>
              <Ionicons name="images-outline" size={48} color={colors.bg.elevated} />
              <Text style={s.emptyGalleryText}>No attachments yet</Text>
            </View>
          ) : (
            <ScrollView style={s.galleryScroll}>
              <View style={s.galleryGrid}>
                {attachments.map((att, index) => (
                  <TouchableOpacity key={index} style={s.galleryItem} onPress={() => openUrl(att.url)}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.url }} style={s.galleryImage} />
                    ) : (
                      <View style={s.galleryPdf}>
                        <Ionicons name="document-text" size={32} color={colors.accent} />
                        <Text style={s.galleryPdfName} numberOfLines={2}>{att.name || 'Document.pdf'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 16, width: '100%', maxWidth: 320 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.bright, textAlign: 'center', marginBottom: 16 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10,
    marginBottom: 8, backgroundColor: colors.bg.elevated, gap: 10,
  },
  pickerOptionSelected: { borderWidth: 1, borderColor: colors.text.muted },
  pickerOptionText: { fontSize: 16, fontWeight: '500' },
  statusDot: { width: 8, height: 14, borderRadius: 3 },

  // Share modal
  shareModalContent: {
    backgroundColor: colors.bg.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.default,
  },
  shareModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  shareModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  shareModalDescription: { fontSize: 14, color: colors.text.secondary, marginBottom: 20, lineHeight: 20 },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  savingText: { color: colors.accent, fontSize: 14 },
  doneButton: { backgroundColor: colors.bg.elevated, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  doneButtonText: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },

  // Edit amp / customer
  editLabel: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: 8 },
  editInput: {
    backgroundColor: colors.bg.elevated, borderRadius: 10, padding: 14,
    color: colors.text.bright, fontSize: 16,
  },
  editChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  editChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
  },
  editChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  editChipText: { fontSize: 13, color: colors.text.secondary },
  editChipTextSelected: { color: colors.text.onAccent, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  buttonDisabled: { opacity: 0.5 },

  // Sheet-style modal
  repairModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  repairModalContent: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '92%', flex: 1,
  },
  repairModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  repairModalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.accent },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  saveButtonText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },

  // Gallery
  galleryOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  galleryContainer: {
    flex: 1, backgroundColor: colors.bg.primary, marginTop: 50,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  galleryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  galleryTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  galleryScroll: { flex: 1, padding: 8 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  galleryPdf: {
    width: '100%', height: '100%', backgroundColor: colors.bg.surface,
    justifyContent: 'center', alignItems: 'center', padding: 8, borderRadius: 8,
  },
  galleryPdfName: { color: colors.text.secondary, fontSize: 10, marginTop: 4, textAlign: 'center' },
  emptyGallery: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyGalleryText: { color: colors.text.secondary, fontSize: 18, fontWeight: '600', marginTop: 16 },
});
