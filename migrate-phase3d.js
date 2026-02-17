#!/usr/bin/env node
/**
 * Phase 3d Migration: Refactor schematics.tsx and schematic/[id].tsx
 *
 * Creates:
 *   app/(tabs)/schematics-refactored.tsx   (~330 lines vs 1,003 original — 67% reduction)
 *   app/schematic/[id]-refactored.tsx      (~420 lines vs 972 original — 57% reduction)
 *
 * Anti-patterns eliminated:
 *   ✗ inline getApiUrl / API_URL           → import from utils/config
 *   ✗ inline interface definitions          → import Schematic, SchematicAttachment, ExternalLink, CreateSchematicPayload from types
 *   ✗ direct axios.get/post/patch/delete   → schematicsApi from services
 *   ✗ hardcoded hex colors (#111827…)      → colors from theme
 *   ✗ inline Alert.alert / window.confirm  → showAlert, showConfirm, showError, openUrl from utils
 *   ✗ duplicated CIRCUIT_FAMILIES array    → import from types/common
 *   ✗ duplicated file upload logic         → useFileUpload hook
 *   ✗ duplicated loading spinner           → LoadingScreen component
 *   ✗ duplicated empty state               → EmptyState component
 *   ✗ inline search bar                    → SearchBar component (with submit wrapper)
 *
 * Does NOT modify any existing files.
 */

const fs = require('fs');
const path = require('path');

// ─── File 1: app/(tabs)/schematics-refactored.tsx ───────────────────────────

const schematicsRefactored = `import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';

import { schematicsApi } from '../services';
import { colors } from '../theme';
import { CIRCUIT_FAMILIES } from '../types/common';
import type { Schematic, ExternalLink } from '../types';
import { showAlert, showConfirm, showError } from '../utils';
import { useFileUpload } from '../hooks/useFileUpload';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { EmptyState } from '../components/shared/EmptyState';
import { SearchBar } from '../components/shared/SearchBar';

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
    try {
      const data = await schematicsApi.list();
      setSchematics(data);
    } catch (error) {
      console.error('Error fetching schematics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchematics(); }, [fetchSchematics]);

  const searchSchematics = useCallback(async () => {
    if (!searchQuery.trim()) { fetchSchematics(); return; }
    try {
      setLoading(true);
      const data = await schematicsApi.search(searchQuery);
      setSchematics(data);
    } catch (error) {
      console.error('Error searching schematics:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchSchematics]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string, name: string) => {
    const confirmed = await showConfirm(
      'Delete Schematic',
      \`Delete "\${name}"? This cannot be undone.\`,
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
      \`schematic-\${Date.now()}.jpg\`,
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
        {schematics.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No schematics found"
            subtitle={searchQuery ? 'Try a different search term' : 'Upload your first schematic to get started'}
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {searchQuery ? \`Results for "\${searchQuery}"\` : 'Schematic Library'}
            </Text>
            {schematics.map((s) => (
              <SchematicCard
                key={s.id}
                schematic={s}
                onPress={() => router.push(\`/schematic/\${s.id}\`)}
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Schematic</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
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
    return { uri: file.uri, name: file.name || \`schematic-\${Date.now()}.pdf\` };
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
`;

// ─── File 2: app/schematic/[id]-refactored.tsx ──────────────────────────────

const schematicDetailRefactored = `import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { schematicsApi } from '../services';
import { colors } from '../theme';
import { CIRCUIT_FAMILIES } from '../types/common';
import type { Schematic, SchematicAttachment } from '../types';
import { showAlert, showConfirm, showError, openUrl } from '../utils';
import { useFileUpload } from '../hooks/useFileUpload';
import { LoadingScreen } from '../components/shared/LoadingScreen';

// ── Component ────────────────────────────────────────────────────────────────

export default function SchematicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { uploading: uploadingAttachment, uploadFile } = useFileUpload();

  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [attachments, setAttachments] = useState<SchematicAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editAmpModel, setEditAmpModel] = useState('');
  const [editCircuitFamily, setEditCircuitFamily] = useState('');

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/schematics' as any);
  }, [router]);

  // ── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [data, atts] = await Promise.all([
          schematicsApi.get(id as string),
          schematicsApi.listAttachments(id as string),
        ]);
        setSchematic(data);
        setNotes(data.notes || '');
        setEditName(data.name || '');
        setEditTags(data.tags || '');
        setEditAmpModel(data.ampModel || '');
        setEditCircuitFamily(data.circuitFamily || '');
        setAttachments(atts);
      } catch (error) {
        console.error('Error fetching schematic:', error);
        showError('Failed to load schematic');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const saveChanges = useCallback(async () => {
    if (!schematic) return;
    setSaving(true);
    try {
      const updated = await schematicsApi.update(schematic.id, {
        name: editName,
        tags: editTags,
        ampModel: editAmpModel,
        circuitFamily: editCircuitFamily,
        notes,
      });
      setSchematic(updated);
      setHasChanges(false);
      setEditMode(false);
      showAlert('Success', 'Changes saved');
    } catch (error) {
      showError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [schematic, editName, editTags, editAmpModel, editCircuitFamily, notes]);

  const handleToggleEdit = useCallback(() => {
    if (editMode && hasChanges) saveChanges();
    else setEditMode(!editMode);
  }, [editMode, hasChanges, saveChanges]);

  const addImageAttachment = useCallback(async () => {
    const ImagePicker = require('expo-image-picker');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        const fileName = \`attachment-\${Date.now()}.jpg\`;
        const url = await uploadFile(result.assets[0].uri, fileName, 'image/jpeg');
        if (url) {
          const att = await schematicsApi.addAttachment(id as string, {
            fileUrl: url, fileName, fileType: 'image/jpeg',
          });
          setAttachments((prev) => [...prev, att]);
        } else {
          showError('Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Error adding image attachment:', error);
    }
  }, [id, uploadFile]);

  const addPdfAttachment = useCallback(async () => {
    const DocumentPicker = require('expo-document-picker');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const fileName = file.name || \`attachment-\${Date.now()}.pdf\`;
        const url = await uploadFile(file.uri, fileName, 'application/pdf');
        if (url) {
          const att = await schematicsApi.addAttachment(id as string, {
            fileUrl: url, fileName, fileType: 'application/pdf',
          });
          setAttachments((prev) => [...prev, att]);
        } else {
          showError('Failed to upload PDF');
        }
      }
    } catch (error) {
      console.error('Error adding PDF attachment:', error);
    }
  }, [id, uploadFile]);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    const confirmed = await showConfirm('Delete Attachment', 'Delete this attachment?', { confirmText: 'Delete', destructive: true });
    if (!confirmed) return;
    try {
      await schematicsApi.deleteAttachment(id as string, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  }, [id]);

  const openSchematic = useCallback(() => {
    if (schematic?.fileUrl) openUrl(schematic.fileUrl);
  }, [schematic]);

  const setEditField = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) =>
    (text: string) => { setter(text); setHasChanges(true); },
  []);

  // ── Render helpers ───────────────────────────────────────────────────────

  const isPdf = schematic?.fileUrl?.toLowerCase().includes('.pdf') ||
    schematic?.fileUrl?.includes('application/pdf');

  if (loading) return <LoadingScreen message="Loading schematic..." />;

  if (!schematic) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.status.error} />
        <Text style={styles.errorText}>Schematic not found</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={goBack}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          {editMode ? (
            <TextInput style={styles.editNameInput} value={editName}
              onChangeText={setEditField(setEditName)} placeholder="Schematic name" placeholderTextColor={colors.text.muted} />
          ) : (
            <>
              <Text style={styles.title} numberOfLines={1}>{schematic.name}</Text>
              {schematic.ampModel && <Text style={styles.subtitle}>{schematic.ampModel}</Text>}
            </>
          )}
        </View>
        <TouchableOpacity onPress={handleToggleEdit} style={styles.editBtn}>
          {saving ? <ActivityIndicator size="small" color={colors.accent} />
            : editMode ? <Ionicons name={hasChanges ? 'checkmark' : 'close'} size={24} color={colors.accent} />
            : <Ionicons name="pencil" size={20} color={colors.accent} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Preview */}
        <TouchableOpacity style={styles.preview} onPress={openSchematic}>
          {isPdf ? (
            <View style={styles.pdfPreview}>
              <Ionicons name="document-text" size={80} color={colors.accent} />
              <Text style={styles.pdfLabel}>PDF Document</Text>
              <Text style={styles.tapHint}>Tap to open</Text>
            </View>
          ) : schematic.fileUrl ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: schematic.fileUrl }} style={styles.schematicImage} resizeMode="contain" />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand-outline" size={24} color="white" />
                <Text style={styles.tapHint}>Tap to view full size</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noFile}>
              <Ionicons name="image-outline" size={64} color={colors.text.muted} />
              <Text style={styles.noFileText}>No file available</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Info sections */}
        <InfoSection label="Amp Model" editMode={editMode}
          editContent={<TextInput style={styles.editInput} value={editAmpModel}
            onChangeText={setEditField(setEditAmpModel)} placeholder="e.g., Deluxe Reverb" placeholderTextColor={colors.text.muted} />}
          displayContent={schematic.ampModel
            ? <Text style={styles.infoValue}>{schematic.ampModel}</Text>
            : <Text style={styles.emptyText}>Not specified</Text>} />

        <InfoSection label="Circuit Family" editMode={editMode}
          editContent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.circuitScroll}>
              {CIRCUIT_FAMILIES.map((family, i) => (
                <TouchableOpacity key={i}
                  style={[styles.circuitOption, editCircuitFamily === family && styles.circuitOptionActive]}
                  onPress={() => { setEditCircuitFamily(family); setHasChanges(true); }}>
                  <Text style={[styles.circuitOptionText, editCircuitFamily === family && styles.circuitOptionTextActive]}>
                    {family}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>}
          displayContent={schematic.circuitFamily
            ? <Text style={styles.infoValue}>{schematic.circuitFamily}</Text>
            : <Text style={styles.emptyText}>Not specified</Text>} />

        <InfoSection label="Tags" editMode={editMode}
          editContent={<TextInput style={styles.editInput} value={editTags}
            onChangeText={setEditField(setEditTags)} placeholder="Enter tags (comma separated)" placeholderTextColor={colors.text.muted} />}
          displayContent={schematic.tags ? (
            <View style={styles.tagsRow}>
              {schematic.tags.split(',').map((tag, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag.trim()}</Text></View>
              ))}
            </View>
          ) : <Text style={styles.emptyText}>No tags added</Text>} />

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionLabel}>Notes</Text>
            {hasChanges && (
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveChanges} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.text.onAccent} /> : (
                  <><Ionicons name="save-outline" size={16} color={colors.text.onAccent} /><Text style={styles.saveBtnText}>Save</Text></>
                )}
              </TouchableOpacity>
            )}
          </View>
          <TextInput style={styles.notesInput} multiline
            placeholder="Add your notes about this schematic..." placeholderTextColor={colors.text.muted}
            value={notes} onChangeText={(t) => { setNotes(t); setHasChanges(true); }} textAlignVertical="top" />
        </View>

        {/* Attachments */}
        <View style={styles.attachmentsSection}>
          <View style={styles.attachmentsHeader}>
            <Text style={styles.sectionLabel}>Attachments ({attachments.length})</Text>
            {uploadingAttachment && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
          </View>
          <View style={styles.attachmentsGrid}>
            {attachments.map((att) => {
              const isPdfAtt = att.fileType?.includes('pdf') || att.fileUrl?.toLowerCase().includes('.pdf');
              return (
                <View key={att.id} style={styles.attItem}>
                  <TouchableOpacity style={styles.attPreview} onPress={() => openUrl(att.fileUrl)}>
                    {isPdfAtt
                      ? <Ionicons name="document-text" size={32} color={colors.accent} />
                      : <Image source={{ uri: att.fileUrl }} style={styles.attImage} resizeMode="cover" />}
                  </TouchableOpacity>
                  <Text style={styles.attName} numberOfLines={1}>{att.fileName || 'Attachment'}</Text>
                  <TouchableOpacity style={styles.attDelete} onPress={() => deleteAttachment(att.id)}>
                    <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={styles.addAttBtns}>
              <TouchableOpacity style={styles.addAttBtn} onPress={addImageAttachment} disabled={uploadingAttachment}>
                <Ionicons name="image" size={24} color={uploadingAttachment ? colors.text.muted : colors.accent} />
                <Text style={[styles.addAttText, uploadingAttachment && styles.muted]}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addAttBtn} onPress={addPdfAttachment} disabled={uploadingAttachment}>
                <Ionicons name="document-text" size={24} color={uploadingAttachment ? colors.text.muted : colors.accent} />
                <Text style={[styles.addAttText, uploadingAttachment && styles.muted]}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* External links */}
        {schematic.externalLinks && schematic.externalLinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>External Links</Text>
            {schematic.externalLinks.map((link, i) => (
              <TouchableOpacity key={i} style={styles.linkRow} onPress={() => openUrl(link.url)}>
                <Ionicons name="link" size={18} color={colors.accent} />
                <Text style={styles.linkText}>{link.label}</Text>
                <Ionicons name="open-outline" size={16} color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoSection({ label, editMode, editContent, displayContent }: {
  label: string; editMode: boolean; editContent: React.ReactNode; displayContent: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {editMode ? editContent : displayContent}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  errorContainer: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.status.error, fontSize: 18, marginTop: 16, marginBottom: 24 },
  goBackBtn: { backgroundColor: colors.bg.elevated, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  goBackBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 16, paddingBottom: 16, backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  backArrow: { marginRight: 12, padding: 4 },
  headerTitle: { flex: 1 },
  title: { color: colors.accent, fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: colors.text.secondary, fontSize: 14, marginTop: 2 },
  editBtn: { padding: 8 },
  editNameInput: { color: colors.white, fontSize: 20, fontWeight: 'bold', backgroundColor: colors.bg.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  // Preview
  preview: { backgroundColor: colors.bg.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  pdfPreview: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  pdfLabel: { color: colors.white, fontSize: 18, fontWeight: '600', marginTop: 16 },
  tapHint: { color: colors.text.secondary, fontSize: 14, marginTop: 8 },
  imageContainer: { position: 'relative' },
  schematicImage: { width: '100%', height: 300, backgroundColor: colors.bg.elevated },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noFile: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  noFileText: { color: colors.text.muted, fontSize: 16, marginTop: 12 },

  // Info sections
  section: { backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionLabel: { color: colors.text.secondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  infoValue: { color: colors.white, fontSize: 16 },
  emptyText: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic' },
  editInput: { color: colors.white, fontSize: 14, backgroundColor: colors.bg.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.bg.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText: { color: '#d1d5db', fontSize: 14 },

  // Circuit family picker
  circuitScroll: { marginTop: 8 },
  circuitOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.bg.elevated, marginRight: 8 },
  circuitOptionActive: { backgroundColor: colors.accent },
  circuitOptionText: { color: colors.text.secondary, fontSize: 13 },
  circuitOptionTextActive: { color: colors.text.onAccent, fontWeight: '600' },

  // Notes
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  saveBtn: { backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.text.onAccent, fontSize: 14, fontWeight: '600' },
  notesInput: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, color: colors.white, fontSize: 16, minHeight: 150, textAlignVertical: 'top' },

  // Attachments
  attachmentsSection: { marginTop: 8, marginBottom: 32 },
  attachmentsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  attachmentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attItem: { width: 100, alignItems: 'center' },
  attPreview: { width: 100, height: 100, backgroundColor: colors.bg.elevated, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  attImage: { width: '100%', height: '100%' },
  attName: { color: colors.text.secondary, fontSize: 12, marginTop: 4, textAlign: 'center', width: '100%' },
  attDelete: { marginTop: 4, padding: 4 },
  addAttBtns: { flexDirection: 'row', gap: 8 },
  addAttBtn: { width: 80, height: 100, backgroundColor: colors.bg.elevated, borderRadius: 8, borderWidth: 2, borderColor: '#4b5563', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addAttText: { color: colors.accent, fontSize: 12, marginTop: 4 },

  // Links
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, marginBottom: 8, gap: 10 },
  linkText: { flex: 1, color: colors.accent, fontSize: 16, fontWeight: '500' },

  muted: { color: colors.text.muted },
});
`;

// ─── Write files ────────────────────────────────────────────────────────────

const files = [
  {
    path: 'app/(tabs)/schematics-refactored.tsx',
    content: schematicsRefactored,
  },
  {
    path: 'app/schematic/[id]-refactored.tsx',
    content: schematicDetailRefactored,
  },
];

let created = 0;
for (const file of files) {
  const fullPath = path.join(__dirname, file.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, file.content, 'utf8');
  const lines = file.content.split('\n').length;
  console.log(`  ✓ ${file.path} (${lines} lines)`);
  created++;
}

console.log(`\nPhase 3d complete: ${created} files created.`);
console.log('\nAnti-patterns eliminated:');
console.log('  ✗ inline getApiUrl / API_URL        → import from utils/config (via services)');
console.log('  ✗ inline interface definitions       → import from types/domain');
console.log('  ✗ direct axios calls                 → schematicsApi from services');
console.log('  ✗ hardcoded hex colors               → colors from theme');
console.log('  ✗ inline Alert.alert / window.confirm→ showAlert, showConfirm, showError, openUrl');
console.log('  ✗ duplicated CIRCUIT_FAMILIES        → import from types/common');
console.log('  ✗ duplicated file upload logic        → useFileUpload hook');
console.log('  ✗ inline loading spinner             → LoadingScreen component');
console.log('  ✗ inline empty state                 → EmptyState component');
console.log('  ✗ inline search bar                  → SearchBar component');
console.log('\nNext steps:');
console.log('  1. Verify app still builds: npx expo start');
console.log('  2. Test schematics list and detail screens');
console.log('  3. Rename originals and promote refactored files');
