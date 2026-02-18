import React, { useState, useEffect, useCallback } from 'react';
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

import { schematicsApi } from '../../src/services';
import { colors } from '../../src/theme';
import { CIRCUIT_FAMILIES } from '../../src/types/common';
import type { Schematic, SchematicAttachment } from '../../src/types';
import { showAlert, showConfirm, showError, openUrl } from '../../src/utils';
import { useFileUpload } from '../../src/hooks/useFileUpload';
import { LoadingScreen } from '../../src/components/shared/LoadingScreen';

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
        const fileName = `attachment-${Date.now()}.jpg`;
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
        const fileName = file.name || `attachment-${Date.now()}.pdf`;
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
  tagText: { color: colors.text.light, fontSize: 14 },

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
