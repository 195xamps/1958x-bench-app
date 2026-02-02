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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = '';

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

export default function SchematicDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [schematic, setSchematic] = useState<Schematic | null>(null);
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

  useEffect(() => {
    fetchSchematic();
  }, [id]);

  const fetchSchematic = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/schematics/${id}`);
      setSchematic(response.data);
      setNotes(response.data.notes || '');
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

  const saveNotes = async () => {
    if (!schematic) return;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/api/schematics/${schematic.id}`, { notes });
      setHasChanges(false);
      if (Platform.OS === 'web') {
        window.alert('Notes saved');
      } else {
        Alert.alert('Success', 'Notes saved');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save notes');
      } else {
        Alert.alert('Error', 'Failed to save notes');
      }
    } finally {
      setSaving(false);
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
          <Text style={styles.title} numberOfLines={1}>{schematic.name}</Text>
          {schematic.ampModel && (
            <Text style={styles.subtitle}>{schematic.ampModel}</Text>
          )}
        </View>
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

        {schematic.circuitFamily && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Circuit Family</Text>
            <Text style={styles.infoValue}>{schematic.circuitFamily}</Text>
          </View>
        )}

        {schematic.tags && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Tags</Text>
            <View style={styles.tagsContainer}>
              {schematic.tags.split(',').map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.trim()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.notesSection}>
          <View style={styles.notesHeader}>
            <Text style={styles.notesLabel}>Notes</Text>
            {hasChanges && (
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
                onPress={saveNotes}
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
});
