import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusConfig } from '../../types';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  return (
    <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
      <Text style={[styles.text, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
