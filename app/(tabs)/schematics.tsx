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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

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

export default function SchematicsScreen() {
  const router = useRouter();
  const [schematics, setSchematics] = useState<Schematic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newSchematic, setNewSchematic] = useState({
    name: '',
    ampModel: '',
    circuitFamily: '',
    tags: '',
    notes: '',
    fileUrl: '',
    externalLinks: [] as ExternalLink[],
  });
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    fetchSchematics();
  }, []);

  const fetchSchematics = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/schematics`);
      setSchematics(response.data);
    } catch (error) {
      console.error('Error fetching schematics:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSchematic = async (schematicId: string, name: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Delete "${name}"? This cannot be undone.`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Schematic',
            `Delete "${name}"? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirmed) return;
    
    try {
      await axios.delete(`${API_URL}/api/schematics/${schematicId}`);
      setSchematics(schematics.filter(s => s.id !== schematicId));
    } catch (error) {
      console.error('Error deleting schematic:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete schematic');
      } else {
        Alert.alert('Error', 'Failed to delete schematic');
      }
    }
  };

  const searchSchematics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/schematics/search`, {
        params: { q: searchQuery },
      });
      setSchematics(response.data);
    } catch (error) {
      console.error('Error searching schematics:', error);
    } finally {
      setLoading(false);
    }
  };

  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState('');

  const uploadFileToStorage = async (uri: string, name: string, contentType: string): Promise<string | null> => {
    try {
      setUploadingFile(true);
      console.log('Step 1: Requesting upload URL for:', name);
      const urlResponse = await axios.post(`${API_URL}/api/uploads/request-url`, {
        name: name,
        size: 0,
        contentType: contentType,
      });
      const { uploadURL, objectPath } = urlResponse.data;
      console.log('Step 2: Got upload URL:', uploadURL?.substring(0, 50) + '...');

      let uploadBody: Blob | Uint8Array;
      
      if (Platform.OS === 'web') {
        console.log('Step 3: Fetching file from URI (web):', uri?.substring(0, 50));
        const fileResponse = await fetch(uri);
        console.log('Step 3b: File response ok:', fileResponse.ok);
        uploadBody = await fileResponse.blob();
        console.log('Step 3c: Got blob, size:', uploadBody.size);
      } else {
        console.log('Step 3: Reading file from URI (native):', uri?.substring(0, 50));
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        uploadBody = bytes;
        console.log('Step 3b: Got bytes, size:', bytes.length);
      }

      console.log('Step 4: Uploading to storage...');
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: uploadBody,
        headers: { 'Content-Type': contentType },
      });
      console.log('Step 4b: Upload response status:', uploadResponse.status);
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
      }

      const publicUrl = `${API_URL}${objectPath}`;
      console.log('Step 5: Success! Public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      if (Platform.OS === 'web') {
        console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const uploadedUrl = await uploadFileToStorage(uri, `schematic-${Date.now()}.jpg`, 'image/jpeg');
        if (uploadedUrl) {
          setNewSchematic({ ...newSchematic, fileUrl: uploadedUrl });
          setFileName('Image uploaded');
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to upload image. Please try again.');
          } else {
            Alert.alert('Error', 'Failed to upload image');
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to pick image: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } else {
        Alert.alert('Error', 'Failed to pick image');
      }
    }
  };

  const pickPdf = async () => {
    try {
      console.log('Opening document picker for PDF...');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      console.log('Document picker result:', JSON.stringify(result));

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const name = file.name || `schematic-${Date.now()}.pdf`;
        console.log('Uploading PDF:', name, 'URI:', file.uri);
        const uploadedUrl = await uploadFileToStorage(file.uri, name, 'application/pdf');
        console.log('Upload result:', uploadedUrl);
        
        if (uploadedUrl) {
          setNewSchematic({ ...newSchematic, fileUrl: uploadedUrl });
          setFileName(name);
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to upload PDF. Please try again.');
          } else {
            Alert.alert('Error', 'Failed to upload PDF');
          }
        }
      }
    } catch (error) {
      console.error('Error picking PDF:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to pick PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } else {
        Alert.alert('Error', 'Failed to pick PDF');
      }
    }
  };

  const uploadSchematic = async () => {
    if (!newSchematic.name) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a name for the schematic');
      } else {
        Alert.alert('Required', 'Please enter a name for the schematic');
      }
      return;
    }

    if (!newSchematic.fileUrl) {
      if (Platform.OS === 'web') {
        window.alert('Please upload a schematic file (image or PDF)');
      } else {
        Alert.alert('Required', 'Please upload a schematic file (image or PDF)');
      }
      return;
    }

    setUploading(true);
    try {
      const response = await axios.post(`${API_URL}/api/schematics`, {
        ...newSchematic,
        isUserUploaded: true,
      });
      setSchematics([response.data, ...schematics]);
      setShowUploadModal(false);
      setNewSchematic({
        name: '',
        ampModel: '',
        circuitFamily: '',
        tags: '',
        notes: '',
        fileUrl: '',
        externalLinks: [],
      });
      setNewLinkLabel('');
      setNewLinkUrl('');
      setFileName('');
      if (Platform.OS === 'web') {
        window.alert('Schematic added to library');
      } else {
        Alert.alert('Success', 'Schematic added to library');
      }
    } catch (error) {
      console.error('Error uploading schematic:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to upload schematic');
      } else {
        Alert.alert('Error', 'Failed to upload schematic');
      }
    } finally {
      setUploading(false);
    }
  };

  const getCircuitFamilyColor = (family: string): string => {
    if (family?.includes('Blackface') || family?.includes('AB763') || family?.includes('AA763')) {
      return '#3b82f6';
    }
    if (family?.includes('Silverface') || family?.includes('AB568')) {
      return '#9ca3af';
    }
    if (family?.includes('Tweed') || family?.includes('5E3') || family?.includes('5F6')) {
      return '#f59e0b';
    }
    if (family?.includes('JTM') || family?.includes('JCM') || family?.includes('Plexi')) {
      return '#ef4444';
    }
    if (family?.includes('AC30') || family?.includes('Vox')) {
      return '#22c55e';
    }
    return '#6b7280';
  };

  if (loading && schematics.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading schematics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, model, or circuit..."
            placeholderTextColor="#6b7280"
            onSubmitEditing={searchSchematics}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              fetchSchematics();
            }}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {schematics.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No schematics found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Upload your first schematic to get started'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {searchQuery ? `Results for "${searchQuery}"` : 'Schematic Library'}
            </Text>
            {schematics.map((schematic) => (
              <TouchableOpacity 
                key={schematic.id} 
                style={styles.schematicCard}
                onPress={() => router.push(`/schematic/${schematic.id}`)}
              >
                <View style={styles.schematicHeader}>
                  <View style={styles.schematicIcon}>
                    <Ionicons name="document-text" size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.schematicInfo}>
                    <Text style={styles.schematicName}>{schematic.name}</Text>
                    {schematic.ampModel && (
                      <Text style={styles.schematicModel}>{schematic.ampModel}</Text>
                    )}
                  </View>
                  {schematic.isUserUploaded && (
                    <View style={styles.userBadge}>
                      <Text style={styles.userBadgeText}>User</Text>
                    </View>
                  )}
                </View>
                
                {schematic.circuitFamily && (
                  <View style={styles.circuitBadgeContainer}>
                    <View style={[styles.circuitBadge, { backgroundColor: getCircuitFamilyColor(schematic.circuitFamily) + '30' }]}>
                      <Text style={[styles.circuitBadgeText, { color: getCircuitFamilyColor(schematic.circuitFamily) }]}>
                        {schematic.circuitFamily}
                      </Text>
                    </View>
                  </View>
                )}

                {schematic.tags && (
                  <View style={styles.tagsContainer}>
                    {schematic.tags.split(',').map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag.trim()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {schematic.notes && (
                  <Text style={styles.schematicNotes} numberOfLines={2}>
                    {schematic.notes}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.deleteSchematicButton}
                  onPress={() => deleteSchematic(schematic.id, schematic.name)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteSchematicText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowUploadModal(true)}
      >
        <Ionicons name="cloud-upload" size={28} color="#1f2937" />
      </TouchableOpacity>

      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Schematic</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={newSchematic.name}
                onChangeText={(text) => setNewSchematic({ ...newSchematic, name: text })}
                placeholder="e.g., Fender Deluxe Reverb AB763"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Amp Model</Text>
              <TextInput
                style={styles.input}
                value={newSchematic.ampModel}
                onChangeText={(text) => setNewSchematic({ ...newSchematic, ampModel: text })}
                placeholder="e.g., Deluxe Reverb"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Circuit Family</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.circuitScroll}>
                {CIRCUIT_FAMILIES.map((family, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.circuitOption,
                      newSchematic.circuitFamily === family && styles.circuitOptionSelected,
                    ]}
                    onPress={() => setNewSchematic({ ...newSchematic, circuitFamily: family })}
                  >
                    <Text
                      style={[
                        styles.circuitOptionText,
                        newSchematic.circuitFamily === family && styles.circuitOptionTextSelected,
                      ]}
                    >
                      {family}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                value={newSchematic.tags}
                onChangeText={(text) => setNewSchematic({ ...newSchematic, tags: text })}
                placeholder="e.g., reverb, vibrato, 6V6"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newSchematic.notes}
                onChangeText={(text) => setNewSchematic({ ...newSchematic, notes: text })}
                placeholder="Any additional notes about this schematic..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>External Links</Text>
              {newSchematic.externalLinks.map((link, index) => (
                <View key={index} style={styles.linkItem}>
                  <View style={styles.linkItemContent}>
                    <Text style={styles.linkLabel}>{link.label}</Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const updated = [...newSchematic.externalLinks];
                      updated.splice(index, 1);
                      setNewSchematic({ ...newSchematic, externalLinks: updated });
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addLinkRow}>
                <TextInput
                  style={[styles.input, styles.linkLabelInput]}
                  value={newLinkLabel}
                  onChangeText={setNewLinkLabel}
                  placeholder="Label"
                  placeholderTextColor="#6b7280"
                />
                <TextInput
                  style={[styles.input, styles.linkUrlInput]}
                  value={newLinkUrl}
                  onChangeText={setNewLinkUrl}
                  placeholder="https://..."
                  placeholderTextColor="#6b7280"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={styles.addLinkButton}
                  onPress={() => {
                    if (newLinkLabel && newLinkUrl) {
                      setNewSchematic({
                        ...newSchematic,
                        externalLinks: [...newSchematic.externalLinks, { label: newLinkLabel, url: newLinkUrl }],
                      });
                      setNewLinkLabel('');
                      setNewLinkUrl('');
                    }
                  }}
                >
                  <Ionicons name="add" size={20} color="#f59e0b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Schematic File *</Text>
              
              {uploadingFile && (
                <View style={styles.uploadingIndicator}>
                  <ActivityIndicator size="small" color="#f59e0b" />
                  <Text style={styles.uploadingText}>Uploading file...</Text>
                </View>
              )}

              {fileName ? (
                <View style={styles.fileSelectedContainer}>
                  <Ionicons 
                    name={fileName.endsWith('.pdf') ? 'document-text' : 'image'} 
                    size={24} 
                    color="#22c55e" 
                  />
                  <Text style={styles.fileSelectedText} numberOfLines={1}>{fileName}</Text>
                  <TouchableOpacity onPress={() => { setFileName(''); setNewSchematic({ ...newSchematic, fileUrl: '' }); }}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.filePickerRow}>
                  <TouchableOpacity 
                    style={[styles.uploadButton, styles.halfWidth]} 
                    onPress={pickImage}
                    disabled={uploadingFile}
                  >
                    <Ionicons name="image" size={22} color={uploadingFile ? '#6b7280' : '#f59e0b'} />
                    <Text style={[styles.uploadButtonText, uploadingFile && styles.disabledText]}>Image</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.uploadButton, styles.halfWidth]} 
                    onPress={pickPdf}
                    disabled={uploadingFile}
                  >
                    <Ionicons name="document-text" size={22} color={uploadingFile ? '#6b7280' : '#f59e0b'} />
                    <Text style={[styles.uploadButtonText, uploadingFile && styles.disabledText]}>PDF</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, uploading && styles.buttonDisabled]}
              onPress={uploadSchematic}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <Text style={styles.saveButtonText}>Add to Library</Text>
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
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 16,
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
    textAlign: 'center',
  },
  schematicCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  schematicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schematicIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  schematicInfo: {
    flex: 1,
  },
  schematicName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  schematicModel: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  userBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  userBadgeText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  circuitBadgeContainer: {
    marginTop: 12,
  },
  circuitBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  circuitBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tagText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  schematicNotes: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  deleteSchematicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 6,
  },
  deleteSchematicText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  linkItemContent: {
    flex: 1,
    marginRight: 8,
  },
  linkLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  linkUrl: {
    color: '#6b7280',
    fontSize: 12,
  },
  addLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  linkLabelInput: {
    flex: 1,
    marginBottom: 0,
  },
  linkUrlInput: {
    flex: 2,
    marginBottom: 0,
  },
  addLinkButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circuitScroll: {
    marginVertical: 8,
  },
  circuitOption: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  circuitOptionSelected: {
    backgroundColor: '#f59e0b',
  },
  circuitOptionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  circuitOptionTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#4b5563',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#f59e0b',
    fontSize: 16,
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
  filePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  halfWidth: {
    flex: 1,
    marginTop: 0,
  },
  fileSelectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  fileSelectedText: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
  },
  uploadingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  disabledText: {
    color: '#6b7280',
  },
});
