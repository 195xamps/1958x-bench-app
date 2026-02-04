import React, { useState, useEffect } from 'react';
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
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

interface ExternalLink {
  label: string;
  url: string;
}

interface Attachment {
  id: string;
  schematicId: string;
  fileUrl: string;
  fileName: string | null;
  fileType: string | null;
  createdAt: string;
}

interface Schematic {
  id: string;
  name: string;
  ampModel: string;
  circuitFamily: string;
  fileUrl: string;
  isUserUploaded: boolean;
  tags: string;
  notes: string;
  externalLinks: ExternalLink[] | null;
  createdAt: string;
}

export default function SchematicDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/schematics' as any);
    }
  };
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editAmpModel, setEditAmpModel] = useState('');
  const [editCircuitFamily, setEditCircuitFamily] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const CIRCUIT_FAMILIES = [
    'AB763 (Blackface)',
    'AA763 (Blackface)',
    'AA864 (Blackface)',
    'AB568 (Silverface)',
    '5E3 (Tweed Deluxe)',
    '5F6-A (Tweed Bassman)',
    'JTM45',
    'JCM800',
    'AC30',
    'Plexi',
    'Other',
  ];

  useEffect(() => {
    fetchSchematic();
    fetchAttachments();
  }, [id]);

  const fetchSchematic = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/schematics/${id}`);
      setSchematic(response.data);
      setNotes(response.data.notes || '');
      setEditName(response.data.name || '');
      setEditTags(response.data.tags || '');
      setEditAmpModel(response.data.ampModel || '');
      setEditCircuitFamily(response.data.circuitFamily || '');
    } catch (error) {
      console.error('Error fetching schematic:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to load schematic');
      } else {
        Alert.alert('Error', 'Failed to load schematic');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/schematics/${id}/attachments`);
      setAttachments(response.data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const saveChanges = async () => {
    if (!schematic) return;
    setSaving(true);
    try {
      const response = await axios.patch(`${API_URL}/api/schematics/${schematic.id}`, { 
        name: editName,
        tags: editTags,
        ampModel: editAmpModel,
        circuitFamily: editCircuitFamily,
        notes 
      });
      setSchematic(response.data);
      setHasChanges(false);
      setEditMode(false);
      if (Platform.OS === 'web') {
        window.alert('Changes saved');
      } else {
        Alert.alert('Success', 'Changes saved');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save changes');
      } else {
        Alert.alert('Error', 'Failed to save changes');
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadFileToStorage = async (uri: string, name: string, contentType: string): Promise<string | null> => {
    try {
      const urlResponse = await axios.post(`${API_URL}/api/uploads/request-url`, {
        name: name,
        size: 0,
        contentType: contentType,
      });
      const { uploadURL, objectPath } = urlResponse.data;

      if (Platform.OS === 'web') {
        const fileResponse = await fetch(uri);
        const uploadBody = await fileResponse.blob();
        console.log('[Upload] Web upload, size:', uploadBody.size, 'type:', contentType);
        
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: uploadBody,
          headers: { 'Content-Type': contentType },
        });
        
        console.log('[Upload] Response status:', uploadResponse.status);
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('[Upload] Error response:', errorText);
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }
      } else {
        console.log('[Upload] Native upload using FileSystem.uploadAsync, type:', contentType);
        
        const uploadResult = await FileSystem.uploadAsync(uploadURL, uri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
          headers: { 'Content-Type': contentType },
        });
        
        console.log('[Upload] Response status:', uploadResult.status, 'body:', uploadResult.body?.substring(0, 200));
        
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          console.error('[Upload] Error response:', uploadResult.body);
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }
      }

      return `${API_URL}${objectPath}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const addImageAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingAttachment(true);
        const uri = result.assets[0].uri;
        const fileName = `attachment-${Date.now()}.jpg`;
        const uploadedUrl = await uploadFileToStorage(uri, fileName, 'image/jpeg');
        
        if (uploadedUrl) {
          const response = await axios.post(`${API_URL}/api/schematics/${id}/attachments`, {
            fileUrl: uploadedUrl,
            fileName: fileName,
            fileType: 'image/jpeg',
          });
          setAttachments([...attachments, response.data]);
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to upload image');
          } else {
            Alert.alert('Error', 'Failed to upload image');
          }
        }
        setUploadingAttachment(false);
      }
    } catch (error) {
      console.error('Error adding image attachment:', error);
      setUploadingAttachment(false);
    }
  };

  const addPdfAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingAttachment(true);
        const file = result.assets[0];
        const fileName = file.name || `attachment-${Date.now()}.pdf`;
        const uploadedUrl = await uploadFileToStorage(file.uri, fileName, 'application/pdf');
        
        if (uploadedUrl) {
          const response = await axios.post(`${API_URL}/api/schematics/${id}/attachments`, {
            fileUrl: uploadedUrl,
            fileName: fileName,
            fileType: 'application/pdf',
          });
          setAttachments([...attachments, response.data]);
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to upload PDF');
          } else {
            Alert.alert('Error', 'Failed to upload PDF');
          }
        }
        setUploadingAttachment(false);
      }
    } catch (error) {
      console.error('Error adding PDF attachment:', error);
      setUploadingAttachment(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Delete this attachment?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Delete Attachment', 'Delete this attachment?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    
    if (!confirmed) return;
    
    try {
      await axios.delete(`${API_URL}/api/schematics/${id}/attachments/${attachmentId}`);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const openAttachment = (attachment: Attachment) => {
    if (Platform.OS === 'web') {
      window.open(attachment.fileUrl, '_blank');
    } else {
      Linking.openURL(attachment.fileUrl).catch((err) => {
        console.error('Failed to open attachment:', err);
        Alert.alert('Error', 'Could not open attachment');
      });
    }
  };

  const openSchematic = () => {
    if (!schematic?.fileUrl) return;
    if (Platform.OS === 'web') {
      window.open(schematic.fileUrl, '_blank');
    } else {
      Linking.openURL(schematic.fileUrl).catch((err) => {
        console.error('Failed to open schematic:', err);
        Alert.alert('Error', 'Could not open schematic');
      });
    }
  };

  const isPdf = schematic?.fileUrl?.toLowerCase().includes('.pdf') || 
    schematic?.fileUrl?.includes('application/pdf');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading schematic...</Text>
      </View>
    );
  }

  if (!schematic) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Schematic not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          {editMode ? (
            <TextInput
              style={styles.editNameInput}
              value={editName}
              onChangeText={(text) => {
                setEditName(text);
                setHasChanges(true);
              }}
              placeholder="Schematic name"
              placeholderTextColor="#6b7280"
            />
          ) : (
            <>
              <Text style={styles.title} numberOfLines={1}>{schematic.name}</Text>
              {schematic.ampModel && (
                <Text style={styles.subtitle}>{schematic.ampModel}</Text>
              )}
            </>
          )}
        </View>
        <TouchableOpacity 
          onPress={() => {
            if (editMode && hasChanges) {
              saveChanges();
            } else {
              setEditMode(!editMode);
            }
          }} 
          style={styles.editButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : editMode ? (
            <Ionicons name={hasChanges ? "checkmark" : "close"} size={24} color="#f59e0b" />
          ) : (
            <Ionicons name="pencil" size={20} color="#f59e0b" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.schematicPreview} onPress={openSchematic}>
          {isPdf ? (
            <View style={styles.pdfPreview}>
              <Ionicons name="document-text" size={80} color="#f59e0b" />
              <Text style={styles.pdfLabel}>PDF Document</Text>
              <Text style={styles.tapToOpen}>Tap to open</Text>
            </View>
          ) : schematic.fileUrl ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: schematic.fileUrl }}
                style={styles.schematicImage}
                resizeMode="contain"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand-outline" size={24} color="white" />
                <Text style={styles.tapToOpen}>Tap to view full size</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noFilePreview}>
              <Ionicons name="image-outline" size={64} color="#6b7280" />
              <Text style={styles.noFileText}>No file available</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Amp Model</Text>
          {editMode ? (
            <TextInput
              style={styles.editTagsInput}
              value={editAmpModel}
              onChangeText={(text) => {
                setEditAmpModel(text);
                setHasChanges(true);
              }}
              placeholder="e.g., Deluxe Reverb"
              placeholderTextColor="#6b7280"
            />
          ) : schematic.ampModel ? (
            <Text style={styles.infoValue}>{schematic.ampModel}</Text>
          ) : (
            <Text style={styles.noTagsText}>Not specified</Text>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Circuit Family</Text>
          {editMode ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.circuitScroll}>
              {CIRCUIT_FAMILIES.map((family, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.circuitOption,
                    editCircuitFamily === family && styles.circuitOptionSelected,
                  ]}
                  onPress={() => {
                    setEditCircuitFamily(family);
                    setHasChanges(true);
                  }}
                >
                  <Text
                    style={[
                      styles.circuitOptionText,
                      editCircuitFamily === family && styles.circuitOptionTextSelected,
                    ]}
                  >
                    {family}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : schematic.circuitFamily ? (
            <Text style={styles.infoValue}>{schematic.circuitFamily}</Text>
          ) : (
            <Text style={styles.noTagsText}>Not specified</Text>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Tags</Text>
          {editMode ? (
            <TextInput
              style={styles.editTagsInput}
              value={editTags}
              onChangeText={(text) => {
                setEditTags(text);
                setHasChanges(true);
              }}
              placeholder="Enter tags (comma separated)"
              placeholderTextColor="#6b7280"
            />
          ) : schematic.tags ? (
            <View style={styles.tagsContainer}>
              {schematic.tags.split(',').map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.trim()}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noTagsText}>No tags added</Text>
          )}
        </View>

        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <Text style={styles.notesLabel}>Notes</Text>
            {hasChanges && (
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#1f2937" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#1f2937" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Add your notes about this schematic..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              setHasChanges(true);
            }}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.attachmentsSection}>
          <View style={styles.attachmentsHeader}>
            <Text style={styles.attachmentsLabel}>Attachments ({attachments.length})</Text>
            {uploadingAttachment && (
              <ActivityIndicator size="small" color="#f59e0b" style={{ marginLeft: 8 }} />
            )}
          </View>
          
          <View style={styles.attachmentsGrid}>
            {attachments.map((attachment) => {
              const isPdfAttachment = attachment.fileType?.includes('pdf') || 
                attachment.fileUrl?.toLowerCase().includes('.pdf');
              return (
                <View key={attachment.id} style={styles.attachmentItem}>
                  <TouchableOpacity 
                    style={styles.attachmentPreview}
                    onPress={() => openAttachment(attachment)}
                  >
                    {isPdfAttachment ? (
                      <Ionicons name="document-text" size={32} color="#f59e0b" />
                    ) : (
                      <Image
                        source={{ uri: attachment.fileUrl }}
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.fileName || 'Attachment'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.deleteAttachmentButton}
                    onPress={() => deleteAttachment(attachment.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
            
            <View style={styles.addAttachmentButtons}>
              <TouchableOpacity 
                style={styles.addAttachmentButton}
                onPress={addImageAttachment}
                disabled={uploadingAttachment}
              >
                <Ionicons name="image" size={24} color={uploadingAttachment ? '#6b7280' : '#f59e0b'} />
                <Text style={[styles.addAttachmentText, uploadingAttachment && styles.disabledText]}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addAttachmentButton}
                onPress={addPdfAttachment}
                disabled={uploadingAttachment}
              >
                <Ionicons name="document-text" size={24} color={uploadingAttachment ? '#6b7280' : '#f59e0b'} />
                <Text style={[styles.addAttachmentText, uploadingAttachment && styles.disabledText]}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {schematic.externalLinks && schematic.externalLinks.length > 0 && (
          <View style={styles.linksSection}>
            <Text style={styles.linksLabel}>External Links</Text>
            {schematic.externalLinks.map((link, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.linkRow}
                onPress={() => Linking.openURL(link.url)}
              >
                <Ionicons name="link" size={18} color="#f59e0b" />
                <Text style={styles.linkText}>{link.label}</Text>
                <Ionicons name="open-outline" size={16} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 16,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backArrow: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  schematicPreview: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  pdfPreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  tapToOpen: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  schematicImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#374151',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noFilePreview: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFileText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  infoSection: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoValue: {
    color: 'white',
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  notesSection: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  saveButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  linksSection: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  linksLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  linkText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '500',
  },
  editButton: {
    padding: 8,
  },
  editNameInput: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editTagsInput: {
    color: 'white',
    fontSize: 14,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noTagsText: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  attachmentsSection: {
    marginTop: 24,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachmentsLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentItem: {
    width: 100,
    alignItems: 'center',
  },
  attachmentPreview: {
    width: 100,
    height: 100,
    backgroundColor: '#374151',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentName: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
  },
  deleteAttachmentButton: {
    marginTop: 4,
    padding: 4,
  },
  addAttachmentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addAttachmentButton: {
    width: 80,
    height: 100,
    backgroundColor: '#374151',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4b5563',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAttachmentText: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 4,
  },
  disabledText: {
    color: '#6b7280',
  },
  circuitScroll: {
    marginTop: 8,
  },
  circuitOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  circuitOptionSelected: {
    backgroundColor: '#f59e0b',
  },
  circuitOptionText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  circuitOptionTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
});
