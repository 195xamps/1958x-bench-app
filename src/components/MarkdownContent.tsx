import React, { useState, useCallback } from 'react';
import { StyleSheet, Platform, Image, View, ActivityIndicator, TouchableOpacity, Dimensions, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '../theme/colors';

interface MarkdownContentProps {
  content: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_IMAGE_WIDTH = Math.min(SCREEN_WIDTH * 0.7, 280);

// ── Custom Image Component ──────────────────────────────────────────────────

function MarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dimensions, setDimensions] = useState({ width: MAX_IMAGE_WIDTH, height: 200 });

  const onLoad = useCallback((event: any) => {
    setLoading(false);
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      const ratio = MAX_IMAGE_WIDTH / width;
      setDimensions({
        width: MAX_IMAGE_WIDTH,
        height: Math.min(height * ratio, 400),
      });
    }
  }, []);

  if (error || !src) return null;

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(src).catch(() => {})}
      activeOpacity={0.8}
      style={{ marginVertical: 8 }}
    >
      <View style={{ width: dimensions.width, height: dimensions.height, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bg.elevated }}>
        {loading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        <Image
          source={{ uri: src }}
          style={{ width: dimensions.width, height: dimensions.height }}
          resizeMode="contain"
          onLoad={onLoad}
          onError={() => { setError(true); setLoading(false); }}
        />
      </View>
    </TouchableOpacity>
  );
}

// ── Custom render rules ─────────────────────────────────────────────────────

const renderRules = {
  image: (node: any) => {
    const src = node.attributes?.src || '';
    const alt = node.attributes?.alt || '';
    return <MarkdownImage key={node.key} src={src} alt={alt} />;
  },
};

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.text.bright,
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: 8,
  },
  heading2: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    color: colors.accentLight,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    color: colors.text.bright,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  strong: {
    color: colors.white,
    fontWeight: '700',
  },
  em: {
    color: colors.text.light,
    fontStyle: 'italic',
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet_list_icon: {
    color: colors.accent,
    fontSize: 15,
    marginRight: 8,
  },
  ordered_list_icon: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  bullet_list_content: {
    flex: 1,
  },
  ordered_list_content: {
    flex: 1,
  },
  code_inline: {
    backgroundColor: colors.bg.elevated,
    color: colors.accentLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: colors.text.bright,
  },
  blockquote: {
    backgroundColor: colors.bg.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  hr: {
    backgroundColor: colors.border.default,
    height: 1,
    marginVertical: 16,
  },
  link: {
    color: colors.status.infoLight,
    textDecorationLine: 'underline',
  },
  image: {
    width: 280,
    height: 200,
    borderRadius: 8,
    marginVertical: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: colors.bg.surface,
  },
  th: {
    color: colors.accent,
    fontWeight: '600',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  td: {
    color: colors.text.bright,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  text: {
    color: colors.text.bright,
  },
});

function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  return (
    <Markdown style={markdownStyles} rules={renderRules}>
      {content}
    </Markdown>
  );
}

export { MarkdownContent };
export default MarkdownContent;
