import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface EmptyStateProps {
  /** Ionicon name OR a custom React element (e.g. a SchematicArt component). */
  icon: keyof typeof Ionicons.glyphMap | ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const isCustomIcon = typeof icon !== 'string';
  return (
    <View style={styles.container}>
      {isCustomIcon
        ? icon
        : <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={64} color={colors.text.muted} />
      }
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.text.onAccent,
    fontWeight: '600',
    fontSize: 16,
  },
});
