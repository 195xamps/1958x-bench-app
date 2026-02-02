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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import MarkdownContent from '../components/MarkdownContent';

const API_URL = '';

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

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [article, setArticle] = useState<ReferenceArticle | null>(null);
  const [loading, setLoading] = useState(true);

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
        <Text style={styles.articleTitle}>{article.title}</Text>

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

        <View style={styles.markdownContainer}>
          <MarkdownContent content={article.content} />
        </View>

        <View style={styles.creditFooter}>
          <View style={styles.creditBox}>
            <Ionicons name="information-circle" size={20} color="#f59e0b" />
            <View style={styles.creditTextContainer}>
              <Text style={styles.creditTitle}>Content Attribution</Text>
              <Text style={styles.creditDescription}>
                This article was imported from {article.sourceName}. All credit for the original content belongs to the author.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(article.sourceUrl)}
              >
                <Text style={styles.creditLink}>View Original Article</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
  articleTitle: {
    color: '#e5e7eb',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 16,
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
  markdownContainer: {
    marginBottom: 24,
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
});
