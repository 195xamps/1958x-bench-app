import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { profileApi } from '../src/services';
import type { UserProfile } from '../src/services';
import { colors } from '../src/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { showAlert, showConfirm, showError } from '../src/utils';
import { LoadingScreen } from '../src/components/shared';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // API key state
  const [showApiKeySection, setShowApiKeySection] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    profileApi.getMe().then(setProfile).catch(() => showError('Failed to load profile')).finally(() => setLoading(false));
  }, []);

  const saveApiKey = async () => {
    setSavingKey(true);
    try {
      const result = await profileApi.updateApiKey(apiKeyInput.trim() || null);
      setProfile(prev => prev ? { ...prev, hasCustomApiKey: result.hasCustomApiKey } : null);
      setApiKeyInput('');
      setShowApiKeySection(false);
      showAlert('Saved', result.hasCustomApiKey ? 'Your API key has been saved.' : 'API key removed. Using system key.');
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const removeApiKey = async () => {
    const confirmed = await showConfirm('Remove API Key', 'Remove your custom key? The app will use the system key.', { confirmText: 'Remove', destructive: true });
    if (!confirmed) return;
    setSavingKey(true);
    try {
      await profileApi.updateApiKey(null);
      setProfile(prev => prev ? { ...prev, hasCustomApiKey: false } : null);
    } catch {
      showError('Failed to remove API key');
    } finally {
      setSavingKey(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!profile) return null;

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email?.split('@')[0] || 'User';
  const costStr = profile.estimatedCostUsd < 0.01 ? '<$0.01' : `$${profile.estimatedCostUsd.toFixed(2)}`;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* Identity */}
        <View style={s.identityCard}>
          {profile.profileImageUrl ? (
            <Image source={{ uri: profile.profileImageUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={colors.text.secondary} />
            </View>
          )}
          <View style={s.identityText}>
            <Text style={s.name}>{fullName}</Text>
            <Text style={s.email}>{profile.email}</Text>
            {profile.isAdmin && (
              <View style={s.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.text.onAccent} />
                <Text style={s.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <Text style={s.sectionLabel}>Your Activity</Text>
        <View style={s.statsRow}>
          <StatCard icon="briefcase-outline" value={profile.jobCount} label="Jobs" />
          <StatCard icon="chatbubble-ellipses-outline" value={profile.chatCount} label="Chats" />
          <StatCard icon="flash-outline" value={`${(profile.totalTokensUsed / 1000).toFixed(1)}k`} label="Tokens" />
          <StatCard icon="cash-outline" value={costStr} label="AI Cost" color={colors.status.success} />
        </View>

        {/* API Key */}
        <Text style={s.sectionLabel}>OpenAI API Key</Text>
        <View style={s.card}>
          <View style={s.apiKeyRow}>
            <View style={s.apiKeyStatus}>
              <Ionicons
                name={profile.hasCustomApiKey ? 'key' : 'key-outline'}
                size={20}
                color={profile.hasCustomApiKey ? colors.accent : colors.text.muted}
              />
              <Text style={s.apiKeyStatusText}>
                {profile.hasCustomApiKey ? 'Custom key active' : 'Using system key'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowApiKeySection(!showApiKeySection)}>
              <Text style={s.apiKeyChange}>{showApiKeySection ? 'Cancel' : profile.hasCustomApiKey ? 'Change' : 'Add Key'}</Text>
            </TouchableOpacity>
          </View>

          {showApiKeySection && (
            <View style={s.apiKeyForm}>
              <Text style={s.apiKeyHint}>
                Enter your OpenAI API key to use your own account. Leave blank to remove the current key.
              </Text>
              <View style={s.apiKeyInputRow}>
                <TextInput
                  style={s.apiKeyInput}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="sk-..."
                  placeholderTextColor={colors.text.muted}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={s.apiKeyToggle}>
                  <Ionicons name={showApiKey ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[s.apiKeySaveBtn, savingKey && s.btnDisabled]}
                onPress={saveApiKey}
                disabled={savingKey}
              >
                {savingKey
                  ? <ActivityIndicator size="small" color={colors.text.onAccent} />
                  : <Text style={s.apiKeySaveBtnText}>{apiKeyInput.trim() ? 'Save Key' : 'Remove Key'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {profile.hasCustomApiKey && !showApiKeySection && (
            <TouchableOpacity onPress={removeApiKey} style={s.removeKeyBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.status.error} />
              <Text style={s.removeKeyText}>Remove custom key</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Admin */}
        {profile.isAdmin && (
          <>
            <Text style={s.sectionLabel}>Admin</Text>
            <TouchableOpacity style={s.adminCard} onPress={() => router.push('/(tabs)/admin' as any)}>
              <View style={s.adminCardLeft}>
                <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
                <View>
                  <Text style={s.adminCardTitle}>Admin Dashboard</Text>
                  <Text style={s.adminCardSub}>Users, jobs, chats, token usage</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </>
        )}

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.status.error} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = colors.accent }: { icon: string; value: string | number; label: string; color?: string }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    fontFamily: 'SpaceMono',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  // Identity
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center', alignItems: 'center',
  },
  identityText: { flex: 1 },
  name: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  email: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignSelf: 'flex-start', marginTop: 8,
  },
  adminBadgeText: { fontSize: 11, fontWeight: 'bold', color: colors.text.onAccent },
  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: colors.bg.surface, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: 'bold', fontFamily: 'SpaceMono' },
  statLabel: { fontSize: 11, color: colors.text.muted },
  // Card
  card: {
    backgroundColor: colors.bg.surface, borderRadius: 14,
    padding: 16, marginBottom: 24,
  },
  // API Key
  apiKeyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  apiKeyStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apiKeyStatusText: { fontSize: 15, color: colors.text.primary },
  apiKeyChange: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  apiKeyForm: { marginTop: 16 },
  apiKeyHint: { fontSize: 13, color: colors.text.muted, marginBottom: 12, lineHeight: 18 },
  apiKeyInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.elevated, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border.default, marginBottom: 12,
  },
  apiKeyInput: {
    flex: 1, color: colors.text.primary, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  apiKeyToggle: { padding: 12 },
  apiKeySaveBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  apiKeySaveBtnText: { color: colors.text.onAccent, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  removeKeyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border.default,
  },
  removeKeyText: { fontSize: 14, color: colors.status.error },
  // Admin
  adminCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg.surface, borderRadius: 14,
    padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  adminCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adminCardTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  adminCardSub: { fontSize: 13, color: colors.text.muted, marginTop: 2 },
  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.bg.surface, marginTop: 8,
    borderWidth: 1, borderColor: colors.status.error + '40',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.status.error },
});
