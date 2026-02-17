import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { Attachment } from '../../types';

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (index: number) => void;
  uploading?: boolean;
}

export function AttachmentPreview({ attachments, onRemove, uploading = false }: AttachmentPreviewProps) {
  if (attachments.length === 0 && !uploading) return null;

  return (
    <View style={styles.container}>
      {uploading && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
      <View style={styles.row}>
        {attachments.map((attachment, idx) => (
          <View key={idx} style={styles.preview}>
            {attachment.type === 'image' ? (
              <Image source={{ uri: attachment.url }} style={styles.previewImage} />
            ) : (
              <View style={styles.pdfPreview}>
                <Ionicons name="document-text" size={28} color={colors.accent} />
                <Text style={styles.pdfName} numberOfLines={1}>
                  {attachment.name || 'PDF'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(idx)}
            >
              <Ionicons name="close-circle" size={20} color={colors.status.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  uploadingText: {
    color: colors.accent,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  preview: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  pdfPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  pdfName: {
    color: colors.text.secondary,
    fontSize: 10,
    marginTop: 2,
    maxWidth: 60,
    textAlign: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.bg.surface,
    borderRadius: 10,
  },
});
