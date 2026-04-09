import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { colors } from '../src/theme/colors';
import { LoadingScreen } from '../src/components/shared';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={s.container}>
      <View style={s.content}>
        <View style={s.logoContainer}>
          <View style={s.logoCircle}>
            <Ionicons name="hardware-chip" size={48} color={colors.accent} />
          </View>
          <Text style={s.appName}>195x Bench Assistant</Text>
          <Text style={s.tagline}>Professional Tube Amp Service Assistant</Text>
        </View>

        <View style={s.features}>
          <Feature icon="chatbubbles-outline" title="AI-Powered Troubleshooting" desc="Expert guidance for diagnosing tube amp issues" />
          <Feature icon="document-text-outline" title="Schematic Library" desc="Access circuit diagrams and reference materials" />
          <Feature icon="briefcase-outline" title="Job Management" desc="Track repairs, measurements, and service history" />
        </View>

        <TouchableOpacity style={s.loginButton} onPress={login}>
          <View style={s.googleIcon}><Text style={s.googleLetter}>G</Text></View>
          <Text style={s.loginButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Only Google accounts are supported.{'\n'}
          Your data is securely stored and never shared.
        </Text>
      </View>

      <View style={s.footer}><Text style={s.footerText}>195x Amps</Text></View>
    </View>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={s.featureItem}>
      <Ionicons name={icon as any} size={24} color={colors.accent} />
      <View style={s.featureText}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: colors.border.default },
  appName: { fontSize: 34, fontFamily: 'Jost-Bold', color: colors.cream, marginBottom: 8 },
  tagline: { fontSize: 16, fontFamily: 'Jost', color: colors.text.secondary, textAlign: 'center' },
  features: { width: '100%', maxWidth: 400, marginBottom: 48 },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.bg.surface, borderRadius: 12, marginBottom: 12 },
  featureText: { marginLeft: 16, flex: 1 },
  featureTitle: { fontSize: 16, fontFamily: 'Jost-SemiBold', color: colors.white, marginBottom: 4 },
  featureDesc: { fontSize: 14, color: colors.text.secondary },
  loginButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, width: '100%', maxWidth: 320, justifyContent: 'center' },
  googleIcon: { width: 24, height: 24, backgroundColor: colors.brand.google, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  googleLetter: { color: colors.white, fontSize: 16, fontWeight: '700' },
  loginButtonText: { fontSize: 16, fontWeight: '600', color: colors.bg.surface },
  disclaimer: { marginTop: 24, fontSize: 12, color: colors.text.muted, textAlign: 'center', lineHeight: 18 },
  footer: { paddingVertical: 24, alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Jost', color: colors.text.muted },
});
