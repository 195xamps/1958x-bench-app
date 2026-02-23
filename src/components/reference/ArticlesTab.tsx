import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { articlesApi } from '../../services/endpoints/reference';
import { showAlert, showError } from '../../utils/alert';
import { styles } from './referenceStyles';

interface ReferenceArticle {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  circuitFamily: string | null;
  createdAt: string;
}

export function ArticlesTab() {
  const router = useRouter();
  const [articles, setArticles] = useState<ReferenceArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const data = await articlesApi.list();
      setArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const article = await articlesApi.importFromUrl(importUrl.trim());
      setArticles([article, ...articles]);
      setShowImportModal(false);
      setImportUrl('');
      showAlert('Success', `Imported: ${article.title}`);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to import article');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await articlesApi.delete(id);
      setArticles(articles.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  };

  return (
    <>
      <ScrollView style={styles.articlesContainer}>
        <View style={styles.articlesHeader}>
          <View>
            <Text style={styles.sectionTitle}>Reference Articles</Text>
            <Text style={styles.sectionSubtitle}>Imported from robrobinette.com</Text>
          </View>
          <TouchableOpacity style={styles.importButton} onPress={() => setShowImportModal(true)}>
            <Ionicons name="add" size={20} color="#1f2937" />
            <Text style={styles.importButtonText}>Import</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading articles...</Text>
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#374151" />
            <Text style={styles.emptyTitle}>No Articles Yet</Text>
            <Text style={styles.emptySubtitle}>Import technical articles from robrobinette.com</Text>
            <TouchableOpacity style={styles.emptyImportButton} onPress={() => setShowImportModal(true)}>
              <Ionicons name="cloud-download-outline" size={20} color="#f59e0b" />
              <Text style={styles.emptyImportText}>Import Your First Article</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.articlesList}>
            {articles.map((article) => (
              <TouchableOpacity key={article.id} style={styles.articleCard} onPress={() => router.push(`/article/${article.id}` as any)}>
                <View style={styles.articleContent}>
                  <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                  <View style={styles.articleMeta}>
                    {article.circuitFamily && (
                      <View style={styles.circuitBadge}>
                        <Text style={styles.circuitBadgeText}>{article.circuitFamily}</Text>
                      </View>
                    )}
                    <Text style={styles.articleSource}>via {article.sourceName}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(article.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.creditSection}>
          <TouchableOpacity onPress={() => Linking.openURL('https://robrobinette.com')}>
            <Text style={styles.creditText}>Content sourced from <Text style={styles.creditLink}>robrobinette.com</Text></Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showImportModal} transparent animationType="fade" onRequestClose={() => setShowImportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Article</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Paste URL from robrobinette.com</Text>
            <TextInput style={styles.modalInput} value={importUrl} onChangeText={setImportUrl} placeholder="https://robrobinette.com/..." placeholderTextColor="#6b7280" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.modalHint}>Example: https://robrobinette.com/How_The_AB763_Deluxe_Reverb_Works.htm</Text>
            <TouchableOpacity style={[styles.modalButton, importing && styles.modalButtonDisabled]} onPress={handleImport} disabled={importing || !importUrl.trim()}>
              {importing ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="cloud-download" size={20} color="#1f2937" />
                  <Text style={styles.modalButtonText}>Import Article</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
