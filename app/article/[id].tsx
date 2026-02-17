import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import ImageViewer from '../../src/components/ImageViewer';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();
const { width: screenWidth } = Dimensions.get('window');

interface ArticleImage {
  url: string;
  alt: string;
}

interface ReferenceArticle {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  content: string;
  images: ArticleImage[] | null;
  circuitFamily: string | null;
  tags: string | null;
  createdAt: string;
}

interface ContentBlock {
  type: 'text' | 'image' | 'header' | 'separator';
  content: string;
  level?: number;
  imageUrl?: string;
  imageAlt?: string;
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split('\n');
  let currentText = '';

  const flushText = () => {
    if (currentText.trim()) {
      blocks.push({ type: 'text', content: currentText.trim() });
      currentText = '';
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      if (currentText) currentText += '\n';
      continue;
    }

    if (/^#+\s*$/.test(trimmedLine) || trimmedLine === '#') {
      continue;
    }

    const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushText();
      blocks.push({
        type: 'image',
        content: imageMatch[1] || 'Schematic',
        imageUrl: imageMatch[2],
        imageAlt: imageMatch[1] || 'Schematic',
      });
      continue;
    }

    const headerMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const headerText = headerMatch[2].replace(/[*#]/g, '').trim();
      if (headerText) {
        flushText();
        blocks.push({
          type: 'header',
          content: headerText,
          level: headerMatch[1].length,
        });
      }
      continue;
    }

    if (trimmedLine === '---') {
      flushText();
      blocks.push({ type: 'separator', content: '' });
      continue;
    }

    currentText += (currentText ? '\n' : '') + trimmedLine;
  }

  flushText();
  return blocks;
}

function cleanText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\s*\]/g, '')
    .replace(/\|\s*$/gm, '')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/^#+\s*$/gm, '')
    .replace(/^\s*#\s*$/gm, '')
    .trim();
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [article, setArticle] = useState<ReferenceArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/reference' as any);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reference-articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      console.error('Error fetching article:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRenameModal = () => {
    if (article) {
      setNewTitle(article.title);
      setRenameModalVisible(true);
    }
  };

  const saveTitle = async () => {
    if (!newTitle.trim() || !article) return;
    setSaving(true);
    try {
      const response = await axios.patch(`${API_URL}/api/reference-articles/${id}`, {
        title: newTitle.trim(),
      });
      setArticle(response.data);
      setRenameModalVisible(false);
    } catch (error) {
      console.error('Error updating title:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update title');
      } else {
        Alert.alert('Error', 'Failed to update title');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'header':
        const headerStyles = [
          styles.header1,
          styles.header2,
          styles.header3,
          styles.header4,
        ];
        return (
          <Text key={index} style={headerStyles[(block.level || 1) - 1]}>
            {block.content}
          </Text>
        );

      case 'image':
        return (
          <TouchableOpacity
            key={index}
            style={styles.imageContainer}
            onPress={() => setSelectedImage(block.imageUrl || null)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: block.imageUrl }}
              style={styles.articleImage}
              resizeMode="contain"
            />
            <View style={styles.imageTapHint}>
              <Ionicons name="expand-outline" size={16} color="#f59e0b" />
              <Text style={styles.imageTapText}>Tap to zoom</Text>
            </View>
            {block.imageAlt && block.imageAlt !== 'Schematic' && (
              <Text style={styles.imageCaption}>{block.imageAlt}</Text>
            )}
          </TouchableOpacity>
        );

      case 'separator':
        return <View key={index} style={styles.separator} />;

      case 'text':
      default:
        const cleanedText = cleanText(block.content);
        if (!cleanedText) return null;
        return (
          <Text key={index} style={styles.paragraph}>
            {cleanedText}
          </Text>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading article...</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Article not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const contentBlocks = parseContent(article.content);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Article
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => Linking.openURL(article.sourceUrl)}
        >
          <Ionicons name="open-outline" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.articleTitle}>{article.title}</Text>
          <TouchableOpacity style={styles.editTitleButton} onPress={openRenameModal}>
            <Ionicons name="pencil" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          {article.circuitFamily && (
            <View style={styles.circuitBadge}>
              <Text style={styles.circuitBadgeText}>{article.circuitFamily}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.sourceRow}
          onPress={() => Linking.openURL(article.sourceUrl)}
        >
          <Ionicons name="link" size={16} color="#6b7280" />
          <Text style={styles.sourceText}>
            Source: <Text style={styles.sourceLink}>{article.sourceName}</Text>
          </Text>
          <Ionicons name="open-outline" size={14} color="#6b7280" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.contentContainer}>
          {contentBlocks.map((block, index) => renderBlock(block, index))}
        </View>

        <View style={styles.creditFooter}>
          <View style={styles.creditBox}>
            <Ionicons name="information-circle" size={20} color="#f59e0b" />
            <View style={styles.creditTextContainer}>
              <Text style={styles.creditTitle}>Content Attribution</Text>
              <Text style={styles.creditDescription}>
                This article was imported from {article.sourceName}. All credit for the original content belongs to the author.
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(article.sourceUrl)}>
                <Text style={styles.creditLink}>View Original Article</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ImageViewer
        visible={!!selectedImage}
        imageUrl={selectedImage || ''}
        onClose={() => setSelectedImage(null)}
      />

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Article Title</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter article title"
              placeholderTextColor="#6b7280"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, saving && styles.modalButtonDisabled]}
                onPress={saveTitle}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  articleTitle: {
    color: '#e5e7eb',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 16,
    flex: 1,
  },
  editTitleButton: {
    padding: 8,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  circuitBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  circuitBadgeText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  sourceText: {
    color: '#6b7280',
    fontSize: 14,
    flex: 1,
  },
  sourceLink: {
    color: '#f59e0b',
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 20,
  },
  contentContainer: {
    marginBottom: 24,
  },
  header1: {
    color: '#f59e0b',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingBottom: 8,
  },
  header2: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  header3: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  header4: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 20,
  },
  imageContainer: {
    marginVertical: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  articleImage: {
    width: screenWidth - 34,
    height: 250,
    backgroundColor: '#0f172a',
  },
  imageTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
    backgroundColor: '#1f2937',
  },
  imageTapText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
  },
  imageCaption: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontStyle: 'italic',
  },
  creditFooter: {
    marginTop: 20,
    marginBottom: 20,
  },
  creditBox: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
  },
  creditTextContainer: {
    flex: 1,
  },
  creditTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  creditDescription: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  creditLink: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    color: '#e5e7eb',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
