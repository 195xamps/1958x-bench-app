import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

// A thin double-line divider that evokes the pin-striping on vintage amp
// tolex and tweed covering. Two 1px lines with a 2px transparent gap.
// Drop-in replacement for `borderBottomWidth: 1` visual separators.

interface Props {
  /** Optional override for the line color. Defaults to border.default at 40%. */
  color?: string;
  /** Horizontal margin. Defaults to 0 (full width). */
  marginHorizontal?: number;
  /** Vertical margin around the divider. Defaults to 0. */
  marginVertical?: number;
}

function PinStripeImpl({ color, marginHorizontal = 0, marginVertical = 0 }: Props) {
  const lineColor = color || colors.border.default + '66'; // ~40% opacity
  return (
    <View style={[s.container, { marginHorizontal, marginVertical }]}>
      <View style={[s.line, { backgroundColor: lineColor }]} />
      <View style={s.gap} />
      <View style={[s.line, { backgroundColor: lineColor }]} />
    </View>
  );
}

export const PinStripe = memo(PinStripeImpl);

const s = StyleSheet.create({
  container: { flexDirection: 'column' },
  line: { height: 1 },
  gap: { height: 2 },
});
