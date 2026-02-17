import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MarkdownContentProps {
  content: string;
}

const markdownStyles = StyleSheet.create({
  body: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    color: '#f59e0b',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingBottom: 8,
  },
  heading2: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  strong: {
    color: '#ffffff',
    fontWeight: '700',
  },
  em: {
    color: '#d1d5db',
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
    color: '#f59e0b',
    fontSize: 15,
    marginRight: 8,
  },
  ordered_list_icon: {
    color: '#f59e0b',
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
    backgroundColor: '#374151',
    color: '#fbbf24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#e5e7eb',
  },
  blockquote: {
    backgroundColor: '#1f2937',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  hr: {
    backgroundColor: '#374151',
    height: 1,
    marginVertical: 16,
  },
  link: {
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  table: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: '#1f2937',
  },
  th: {
    color: '#f59e0b',
    fontWeight: '600',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  td: {
    color: '#e5e7eb',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  text: {
    color: '#e5e7eb',
  },
});

function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  return (
    <Markdown style={markdownStyles}>
      {content}
    </Markdown>
  );
}

export { MarkdownContent };
export default MarkdownContent;
