import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { schematicsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { CIRCUIT_FAMILIES } from '../../src/types/common';
import type { Schematic, ExternalLink } from '../../src/types';
import { showAlert, showConfirm, showError } from '../../src/utils';
import { useFileUpload } from '../../src/hooks/useFileUpload';
import { LoadingScreen } from '../../src/components/shared/LoadingScreen';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { SearchBar } from '../../src/components/shared/SearchBar';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCircuitFamilyColor(family: string): string {
  if (family?.includes('Blackface') || family?.includes('AB763') || family?.includes('AA763')) {
    return colors.status.info;
  }
  if (family?.includes('Silverface') || family?.includes('AB568')) {
    return colors.text.secondary;
  }
  if (family?.includes('Tweed') || family?.includes('5E3') || family?.includes('5F6')) {
    return colors.accent;
  }
  if (family?.includes('JTM') || family?.includes('JCM') || family?.includes('Plexi')) {
    return colors.status.error;
  }
  if (family?.includes('AC30') || family?.includes('Vox')) {
    return colors.status.success;
  }
  return colors.text.muted;
}

const EMPTY_FORM = {
  name: '',
  ampModel: '',
  circuitFamily: '',
  tags: '',
  notes: '',
  fileUrl: '',
  externalLinks: [] as ExternalLink[],
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SchematicsScreen() {
  const router = useRouter();
  const { uploading: uploadingFile, uploadFile } = useFileUpload();

  const [schematics, setSchematics] = useState<Schematic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [fileName, setFileName] = useState('');

  const updateForm = useCallback(
    (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value })),
    [],
  );

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchSchematics = useCallback(async () => {
    setFetchError(false);
    try {
      const data = await schematicsApi.list();
      setSchematics(data);
    } catch (error) {
      console.error('Error fetching schematics:', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchematics(); }, [fetchSchematics]);

  const searchSchematics = useCallback(async () => {
    if (!searchQuery.trim()) { fetchSchematics(); return; }
    setFetchError(false);
    try {
      setLoading(true);
      const data = await schematicsApi.search(searchQuery);
      setSchematics(data);
    } catch (error) {
      console.error('Error searching schematics:', error);
      setFetchError(true);
      setSchematics([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchSchematics]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string, name: string) => {
    const confirmed = await showConfirm(
      'Delete Schematic',
      `Delete "${name}"? This cannot be undone.`,
      { confirmText: 'Delete', destructive: true },
    );
    if (!confirmed) return;
    try {
      await schematicsApi.delete(id);
      setSchematics((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      showError('Failed to delete schematic');
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const url = await uploadFile(
      await pickImageUri(),
      `schematic-${Date.now()}.jpg`,
      'image/jpeg',
    );
    if (url) { updateForm('fileUrl', url); setFileName('Image uploaded'); }
    else { showError('Failed to upload image'); }
  }, [uploadFile, updateForm]);

  const handlePickPdf = useCallback(async () => {
    const { uri, name } = await pickPdfFile();
    if (!uri) return;
    const url = await uploadFile(uri, name, 'application/pdf');
    if (url) { updateForm('fileUrl', url); setFileName(name); }
    else { showError('Failed to upload PDF'); }
  }, [uploadFile, updateForm]);

  const handleSave = useCallback(async () => {
    if (!form.name) { showAlert('Required', 'Please enter a name for the schematic'); return; }
    if (!form.fileUrl) { showAlert('Required', 'Please upload a schematic file (image or PDF)'); return; }
    setSaving(true);
    try {
      const created = await schematicsApi.create({ ...form, isUserUploaded: true });
      setSchematics((prev) => [created, ...prev]);
      setShowUploadModal(false);
      setForm(EMPTY_FORM);
      setNewLinkLabel('');
      setNewLinkUrl('');
      setFileName('');
      showAlert('Success', 'Schematic added to library');
    } catch (error) {
      showError('Failed to upload schematic');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const addLink = useCallback(() => {
    if (newLinkLabel && newLinkUrl) {
      updateForm('externalLinks', [...form.externalLinks, { label: newLinkLabel, url: newLinkUrl }]);
      setNewLinkLabel('');
      setNewLinkUrl('');
    }
  }, [newLinkLabel, newLinkUrl, form.externalLinks, updateForm]);

  const removeLink = useCallback((index: number) => {
    const updated = [...form.externalLinks];
    updated.splice(index, 1);
    updateForm('externalLinks', updated);
  }, [form.externalLinks, updateForm]);

  const handleSearchClear = useCallback((text: string) => {
    setSearchQuery(text);
    if (!text) fetchSchematics();
  }, [fetchSchematics]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading && schematics.length === 0) {
    return <LoadingScreen message="Loading schematics..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchClear}
          placeholder="Search by name, model, or circuit..."
        />
      </View>

      <ScrollView style={styles.scrollView}>
        {fetchError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={searchQuery ? 'Search failed' : 'Could not load schematics'}
            subtitle="Check your connection and try again"
            actionLabel="Retry"
            onAction={searchQuery ? searchSchematics : fetchSchematics}
          />
        ) : schematics.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={searchQuery ? 'No results' : 'No schematics yet'}
            subtitle={searchQuery ? `No schematics match "${searchQuery}"` : 'Upload your first schematic to get started'}
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {searchQuery ? `Results for "${searchQuery}"` : 'Schematic Library'}
            </Text>
            {schematics.map((s) => (
              <SchematicCard
                key={s.id}
                schematic={s}
                onPress={() => router.push(`/schematic/${s.id}`)}
                onDelete={() => handleDelete(s.id, s.name)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowUploadModal(true)}>
        <Ionicons name="cloud-upload" size={28} color={colors.text.onAccent} />
      </TouchableOpacity>

      <UploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        form={form}
        updateForm={updateForm}
        onSave={handleSave}
        saving={saving}
        uploadingFile={uploadingFile}
        fileName={fileName}
        onPickImage={handlePickImage}
        onPickPdf={handlePickPdf}
        onClearFile={() => { setFileName(''); updateForm('fileUrl', ''); }}
        newLinkLabel={newLinkLabel}
        newLinkUrl={newLinkUrl}
        onLinkLabelChange={setNewLinkLabel}
        onLinkUrlChange={setNewLinkUrl}
        onAddLink={addLink}
        onRemoveLink={removeLink}
      />
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SchematicCard({ schematic, onPress, onDelete }: {
  schematic: Schematic; onPress: () => void; onDelete: () => void;
}) {
  const familyColor = schematic.circuitFamily ? getCircuitFamilyColor(schematic.circuitFamily) : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons name="document-text" size={24} color={colors.accent} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{schematic.name}</Text>
          {schematic.ampModel && <Text style={styles.cardModel}>{schematic.ampModel}</Text>}
        </View>
        {schematic.isUserUploaded && (
          <View style={styles.userBadge}><Text style={styles.userBadgeText}>User</Text></View>
        )}
      </View>

      {familyColor && (
        <View style={styles.circuitBadgeWrap}>
          <View style={[styles.circuitBadge, { backgroundColor: familyColor + '30' }]}>
            <Text style={[styles.circuitBadgeText, { color: familyColor }]}>{schematic.circuitFamily}</Text>
          </View>
        </View>
      )}

      {schematic.tags && (
        <View style={styles.tagsRow}>
          {schematic.tags.split(',').map((tag, i) => (
            <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag.trim()}</Text></View>
          ))}
        </View>
      )}

      {schematic.notes && <Text style={styles.cardNotes} numberOfLines={2}>{schematic.notes}</Text>}

      <TouchableOpacity style={styles.deleteRow} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={colors.status.error} />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function UploadModal({
  visible, onClose, form, updateForm, onSave, saving, uploadingFile, fileName,
  onPickImage, onPickPdf, onClearFile,
  newLinkLabel, newLinkUrl, onLinkLabelChange, onLinkUrlChange, onAddLink, onRemoveLink,
}: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Schematic</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={form.name}
              onChangeText={(t) => updateForm('name', t)}
              placeholder="e.g., Fender Deluxe Reverb AB763" placeholderTextColor={colors.text.muted} />

            <Text style={styles.label}>Amp Model</Text>
            <TextInput style={styles.input} value={form.ampModel}
              onChangeText={(t) => updateForm('ampModel', t)}
              placeholder="e.g., Deluxe Reverb" placeholderTextColor={colors.text.muted} />

            <Text style={styles.label}>Circuit Family</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.circuitScroll}>
              {CIRCUIT_FAMILIES.map((family, i) => (
                <TouchableOpacity key={i}
                  style={[styles.circuitOption, form.circuitFamily === family && styles.circuitOptionActive]}
                  onPress={() => updateForm('circuitFamily', family)}>
                  <Text style={[styles.circuitOptionText, form.circuitFamily === family && styles.circuitOptionTextActive]}>
                    {family}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Tags (comma separated)</Text>
            <TextInput style={styles.input} value={form.tags}
              onChangeText={(t) => updateForm('tags', t)}
              placeholder="e.g., reverb, vibrato, 6V6" placeholderTextColor={colors.text.muted} />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.notes}
              onChangeText={(t) => updateForm('notes', t)}
              placeholder="Any additional notes..." placeholderTextColor={colors.text.muted}
              multiline numberOfLines={3} />

            <Text style={styles.label}>External Links</Text>
            {form.externalLinks.map((link: ExternalLink, i: number) => (
              <View key={i} style={styles.linkItem}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.linkLabel}>{link.label}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                </View>
                <TouchableOpacity onPress={() => onRemoveLink(i)}>
                  <Ionicons name="close-circle" size={20} color={colors.status.error} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addLinkRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={newLinkLabel}
                onChangeText={onLinkLabelChange} placeholder="Label" placeholderTextColor={colors.text.muted} />
              <TextInput style={[styles.input, { flex: 2 }]} value={newLinkUrl}
                onChangeText={onLinkUrlChange} placeholder="https://..." placeholderTextColor={colors.text.muted}
                autoCapitalize="none" keyboardType="url" />
              <TouchableOpacity style={styles.addLinkBtn} onPress={onAddLink}>
                <Ionicons name="add" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Schematic File *</Text>
            {uploadingFile && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.uploadingText}>Uploading file...</Text>
              </View>
            )}
            {fileName ? (
              <View style={styles.fileSelected}>
                <Ionicons name={fileName.endsWith('.pdf') ? 'document-text' : 'image'} size={24} color={colors.status.success} />
                <Text style={styles.fileSelectedText} numberOfLines={1}>{fileName}</Text>
                <TouchableOpacity onPress={onClearFile}>
                  <Ionicons name="close-circle" size={20} color={colors.status.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.filePickerRow}>
                <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={onPickImage} disabled={uploadingFile}>
                  <Ionicons name="image" size={22} color={uploadingFile ? colors.text.muted : colors.accent} />
                  <Text style={[styles.uploadBtnText, uploadingFile && styles.muted]}>Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={onPickPdf} disabled={uploadingFile}>
                  <Ionicons name="document-text" size={22} color={uploadingFile ? colors.text.muted : colors.accent} />
                  <Text style={[styles.uploadBtnText, uploadingFile && styles.muted]}>PDF</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={onSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.text.onAccent} />
              : <Text style={styles.saveBtnText}>Add to Library</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── File pickers (thin wrappers) ───────────────────────────────────────────

async function pickImageUri(): Promise<string> {
  const ImagePicker = require('expo-image-picker');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false, quality: 1,
  });
  if (!result.canceled && result.assets[0]) return result.assets[0].uri;
  throw new Error('Image selection cancelled');
}

async function pickPdfFile(): Promise<{ uri: string; name: string }> {
  const DocumentPicker = require('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf', copyToCacheDirectory: true,
  });
  if (!result.canceled && result.assets && result.assets[0]) {
    const file = result.assets[0];
    return { uri: file.uri, name: file.name || `schematic-${Date.now()}.pdf` };
  }
  return { uri: '', name: '' };
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  searchWrapper: { borderBottomWidth: 1, borderBottomColor: colors.border.default, paddingVertical: 8 },
  scrollView: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.bright, marginBottom: 16 },

  // Card
  card: { backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: colors.text.bright },
  cardModel: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  userBadge: { backgroundColor: colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  userBadgeText: { color: colors.text.secondary, fontSize: 11, fontWeight: '600' },
  circuitBadgeWrap: { marginTop: 12 },
  circuitBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  circuitBadgeText: { fontSize: 13, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { backgroundColor: colors.bg.elevated, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  tagText: { color: colors.text.secondary, fontSize: 12 },
  cardNotes: { color: colors.text.muted, fontSize: 14, marginTop: 12, lineHeight: 20 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border.default, gap: 6 },
  deleteText: { color: colors.status.error, fontSize: 14, fontWeight: '500' },

  // FAB
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.accent },
  modalScroll: { maxHeight: 400 },
  label: { color: colors.text.secondary, fontSize: 14, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 14, color: colors.white, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  // Circuit family picker
  circuitScroll: { marginVertical: 8 },
  circuitOption: { backgroundColor: colors.bg.elevated, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
  circuitOptionActive: { backgroundColor: colors.accent },
  circuitOptionText: { color: colors.text.secondary, fontSize: 14 },
  circuitOptionTextActive: { color: colors.text.onAccent, fontWeight: '600' },

  // Links
  linkItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 10, marginBottom: 8 },
  linkLabel: { color: colors.text.bright, fontSize: 14, fontWeight: '600' },
  linkUrl: { color: colors.text.muted, fontSize: 12 },
  addLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addLinkBtn: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, justifyContent: 'center', alignItems: 'center' },

  // File picker
  filePickerRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.elevated, borderRadius: 12, padding: 16, gap: 10, borderWidth: 2, borderColor: '#4b5563', borderStyle: 'dashed' },
  uploadBtnText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  fileSelected: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.primary, borderRadius: 12, padding: 14, gap: 10, marginTop: 8, borderWidth: 1, borderColor: colors.status.success },
  fileSelectedText: { color: colors.text.bright, fontSize: 14, flex: 1 },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10 },
  uploadingText: { color: colors.text.secondary, fontSize: 14 },

  // Save
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: colors.text.onAccent, fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  muted: { color: colors.text.muted },
});
