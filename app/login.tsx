import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './contexts/AuthContext';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="hardware-chip" size={48} color="#f59e0b" />
          </View>
          <Text style={styles.appName}>195x Bench</Text>
          <Text style={styles.tagline}>Professional Tube Amp Service Assistant</Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubbles-outline" size={24} color="#f59e0b" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>AI-Powered Troubleshooting</Text>
              <Text style={styles.featureDescription}>Expert guidance for diagnosing tube amp issues</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="document-text-outline" size={24} color="#f59e0b" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Schematic Library</Text>
              <Text style={styles.featureDescription}>Access circuit diagrams and reference materials</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="briefcase-outline" size={24} color="#f59e0b" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Job Management</Text>
              <Text style={styles.featureDescription}>Track repairs, measurements, and service history</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={login}>
          <View style={styles.googleIcon}>
            <Text style={styles.googleLetter}>G</Text>
          </View>
          <Text style={styles.loginButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Only Google accounts are supported.{'\n'}
          Your data is securely stored and never shared.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>195x Amps</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#374151',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  features: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 16,
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9ca3af',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    maxWidth: 320,
    justifyContent: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#4285f4',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleLetter: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
