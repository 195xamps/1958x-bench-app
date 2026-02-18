import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { articlesApi } from '../../src/services';
import { showError, openUrl } from '../../src/utils';
import { LoadingScreen } from '../../src/components/shared';
import ImageViewer from '../../src/components/ImageViewer';
import type { ReferenceArticle } from '../../src/types';

const { width: screenWidth } = Dimensions.get('window');

// ─── Content parsing ─────────────────────────────────────────────────────────

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
    const trimmed = line.trim();
    if (!trimmed) { if (currentText) currentText += '\n'; continue; }
    if (/^#+\s*$/.test(trimmed) || trimmed === '#') continue;

    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushText();
      blocks.push({ type: 'image', content: imgMatch[1] || 'Schematic', imageUrl: imgMatch[2], imageAlt: imgMatch[1] || 'Schematic' });
      continue;
    }

    const hdrMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hdrMatch) {
      const text = hdrMatch[2].replace(/[*#]/g, '').trim();
      if (text) { flushText(); blocks.push({ type: 'header', content: text, level: hdrMatch[1].length }); }
      continue;
    }

    if (trimmed === '---') { flushText(); blocks.push({ type: 'separator', content: '' }); continue; }
    currentText += (currentText ? '\n' : '') + trimmed;
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [article, setArticle] = useState<ReferenceArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/reference' as any);

  useEffect(() => {
    (async () => {
      try {
        setArticle(await articlesApi.get(id as string));
      } catch { /* logged by interceptor */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  const saveTitle = async () => {
    if (!newTitle.trim() || !article) return;
    setSaving(true);
    try {
      setArticle(await articlesApi.updateTitle(id as string, newTitle.trim()));
      setRenameModalVisible(false);
    } catch {
      showError('Failed to update title');
    } finally { setSaving(false); }
  };

  const openRenameModal = () => {
    if (article) { setNewTitle(article.title); setRenameModalVisible(true); }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'header':
        return <Text key={index} style={HEADER_STYLES[(block.level || 1) - 1]}>{block.content}</Text>;
      case 'image':
        return (
          <TouchableOpacity key={index} style={s.imageContainer} onPress={() => setSelectedImage(block.imageUrl || null)} activeOpacity={0.8}>
            <Image source={{ uri: block.imageUrl }} style={s.articleImage} resizeMode="contain" />
            <View style={s.imageTapHint}>
              <Ionicons name="expand-outline" size={16} color={colors.accent} />
              <Text style={s.imageTapText}>Tap to zoom</Text>
            </View>
            {block.imageAlt && block.imageAlt !== 'Schematic' && <Text style={s.imageCaption}>{block.imageAlt}</Text>}
          </TouchableOpacity>
        );
      case 'separator':
        return <View key={index} style={s.separator} />;
      default: {
        const cleaned = cleanText(block.content);
        return cleaned ? <Text key={index} style={s.paragraph}>{cleaned}</Text> : null;
      }
    }
  };

  // ─── States ──────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Loading article..." />;

  if (!article) {
    return (
      <View style={s.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.status.error} />
        <Text style={s.errorText}>Article not found</Text>
        <TouchableOpacity style={s.errorBackBtn} onPress={goBack}>
          <Text style={s.errorBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const contentBlocks = parseContent(article.content);

  return (
    <View style={s.container}>
      {/* Header bar */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Article</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => openUrl(article.sourceUrl || '')}>
          <Ionicons name="open-outline" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title + edit */}
        <View style={s.titleRow}>
          <Text style={s.articleTitle}>{article.title}</Text>
          <TouchableOpacity style={s.editBtn} onPress={openRenameModal}>
            <Ionicons name="pencil" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Circuit badge */}
        {article.circuitFamily && (
          <View style={s.metaRow}>
            <View style={s.circuitBadge}><Text style={s.circuitBadgeText}>{article.circuitFamily}</Text></View>
          </View>
        )}

        {/* Source link */}
        <TouchableOpacity style={s.sourceRow} onPress={() => openUrl(article.sourceUrl || '')}>
          <Ionicons name="link" size={16} color={colors.text.muted} />
          <Text style={s.sourceText}>Source: <Text style={s.sourceLink}>{article.sourceName}</Text></Text>
          <Ionicons name="open-outline" size={14} color={colors.text.muted} />
        </TouchableOpacity>

        <View style={s.divider} />

        {/* Article content */}
        <View style={s.contentContainer}>
          {contentBlocks.map((block, i) => renderBlock(block, i))}
        </View>

        {/* Credit footer */}
        <View style={s.creditFooter}>
          <View style={s.creditBox}>
            <Ionicons name="information-circle" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.creditTitle}>Content Attribution</Text>
              <Text style={s.creditDesc}>
                This article was imported from {article.sourceName}. All credit for the original content belongs to the author.
              </Text>
              <TouchableOpacity onPress={() => openUrl(article.sourceUrl || '')}>
                <Text style={s.creditLink}>View Original Article</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ImageViewer visible={!!selectedImage} imageUrl={selectedImage || ''} onClose={() => setSelectedImage(null)} />

      {/* Rename modal */}
      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Edit Article Title</Text>
            <TextInput
              style={s.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter article title"
              placeholderTextColor={colors.text.muted}
              autoFocus
            />
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setRenameModalVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn, saving && s.btnDisabled]} onPress={saveTitle} disabled={saving}>
                <Text style={s.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const HEADER_STYLES = [
  { color: colors.accent, fontSize: 22, fontWeight: '700' as const, marginTop: 24, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border.default, paddingBottom: 8 },
  { color: colors.accent, fontSize: 18, fontWeight: '600' as const, marginTop: 20, marginBottom: 10 },
  { color: colors.accentLight, fontSize: 16, fontWeight: '600' as const, marginTop: 16, marginBottom: 8 },
  { color: colors.accentLight, fontSize: 15, fontWeight: '600' as const, marginTop: 12, marginBottom: 6 },
];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  headerBtn: { padding: 8 },
  headerTitle: { color: colors.accent, fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  errorContainer: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: colors.status.error, fontSize: 18, marginTop: 16, marginBottom: 24 },
  errorBackBtn: { backgroundColor: colors.bg.elevated, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  errorBackText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  scrollContent: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  articleTitle: { color: colors.text.bright, fontSize: 24, fontWeight: 'bold', lineHeight: 32, marginBottom: 16, flex: 1 },
  editBtn: { padding: 8, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  circuitBadge: { backgroundColor: colors.bg.elevated, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  circuitBadgeText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  sourceText: { color: colors.text.muted, fontSize: 14, flex: 1 },
  sourceLink: { color: colors.accent },
  divider: { height: 1, backgroundColor: colors.border.default, marginVertical: 20 },
  contentContainer: { marginBottom: 24 },
  paragraph: { color: colors.text.bright, fontSize: 15, lineHeight: 24, marginBottom: 16 },
  separator: { height: 1, backgroundColor: colors.border.default, marginVertical: 20 },
  imageContainer: { marginVertical: 16, backgroundColor: colors.bg.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border.default },
  articleImage: { width: screenWidth - 34, height: 250, backgroundColor: colors.bg.dark },
  imageTapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6, backgroundColor: colors.bg.surface },
  imageTapText: { color: colors.accent, fontSize: 12, fontWeight: '500' },
  imageCaption: { color: colors.text.secondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, paddingBottom: 12, fontStyle: 'italic' },
  creditFooter: { marginTop: 20, marginBottom: 20 },
  creditBox: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border.default, gap: 12 },
  creditTitle: { color: colors.text.bright, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  creditDesc: { color: colors.text.secondary, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  creditLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.default },
  modalTitle: { color: colors.text.bright, fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalInput: { backgroundColor: colors.bg.primary, borderRadius: 8, padding: 12, color: colors.text.bright, fontSize: 16, borderWidth: 1, borderColor: colors.border.default, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.bg.elevated, alignItems: 'center' },
  modalCancelText: { color: colors.text.secondary, fontSize: 16, fontWeight: '600' },
  modalSaveBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  modalSaveText: { color: colors.bg.primary, fontSize: 16, fontWeight: '600' },
});
