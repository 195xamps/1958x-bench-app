import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { colors } from '../../theme';

// A branded loading indicator that replaces the generic ActivityIndicator
// spinner. Shows a stylized vacuum tube that "warms up" — the filament
// glow pulses from dim to bright amber, mimicking a real tube powering on.
//
// Drop-in replacement: <TubeLoader /> instead of <ActivityIndicator />

interface Props {
  size?: number; // overall size, default 48
}

function TubeLoaderImpl({ size = 48 }: Props) {
  const glow = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const scale = size / 48; // base design is 48px

  return (
    <View style={[s.container, { width: size, height: size * 1.4 }]}>
      {/* Glass envelope */}
      <View style={[s.envelope, {
        width: 28 * scale,
        height: 38 * scale,
        borderRadius: 10 * scale,
        borderWidth: 2 * scale,
      }]}>
        {/* Heater glow — animated */}
        <Animated.View style={[s.glowOuter, {
          width: 16 * scale,
          height: 16 * scale,
          borderRadius: 8 * scale,
          opacity: glow,
        }]}>
          <Animated.View style={[s.glowInner, {
            width: 8 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
            opacity: glow,
          }]} />
        </Animated.View>
      </View>

      {/* Pins */}
      <View style={s.pinRow}>
        <View style={[s.pin, { width: 2 * scale, height: 6 * scale }]} />
        <View style={[s.pin, { width: 2 * scale, height: 6 * scale, marginHorizontal: 6 * scale }]} />
        <View style={[s.pin, { width: 2 * scale, height: 6 * scale }]} />
      </View>
    </View>
  );
}

export const TubeLoader = memo(TubeLoaderImpl);

const s = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  envelope: {
    borderColor: colors.text.muted,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowOuter: {
    backgroundColor: colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    backgroundColor: colors.accent,
  },
  pinRow: { flexDirection: 'row', marginTop: 2 },
  pin: { backgroundColor: colors.text.muted },
});
