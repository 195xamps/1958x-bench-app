import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme';

const ONBOARDING_KEY = 'onboarding_seen_v1';
const { width } = Dimensions.get('window');

// ─── Slide definitions ───────────────────────────────────────────────────────

const SLIDES = [
  {
    icon: 'hardware-chip' as const,
    title: 'Welcome to\n195x Bench',
    body: 'A professional service tool for vintage tube amp technicians. Track jobs, run diagnostics, and build your repair history.',
    cta: 'Next',
  },
  {
    icon: 'briefcase' as const,
    title: 'Start With\na Job',
    body: 'Create a bench job for each amp you service. Log customer info, symptoms, and track every measurement and part you touch.',
    cta: 'Next',
  },
  {
    icon: 'pulse' as const,
    title: 'Diagnose &\nMeasure',
    body: 'Use the Diagnose tab for AI-guided troubleshooting. Record voltage readings, replace parts, and share completed jobs with the community.',
    cta: 'Get Started',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface OnboardingOverlayProps {
  onDone?: () => void;
}

export function OnboardingOverlay({ onDone }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (!val) setVisible(true);
    });
  }, []);

  const goToStep = (nextStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      goToStep(step + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const slide = SLIDES[step];

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Skip */}
          {step < SLIDES.length - 1 && (
            <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}

          {/* Content */}
          <Animated.View style={[styles.slideContent, { opacity: fadeAnim }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={slide.icon} size={52} color={colors.accent} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </Animated.View>

          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleNext}>
            <Text style={styles.ctaText}>{slide.cta}</Text>
            {step < SLIDES.length - 1 && (
              <Ionicons name="arrow-forward" size={18} color={colors.text.onAccent} style={{ marginLeft: 6 }} />
            )}
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  skipText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  slideContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.text.bright,
    fontFamily: 'Jost-Bold',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.elevated,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  ctaText: {
    color: colors.text.onAccent,
    fontSize: 17,
    fontWeight: '700',
  },
});
