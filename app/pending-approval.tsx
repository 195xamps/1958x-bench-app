import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { colors } from '../src/theme/colors';

export default function PendingApprovalScreen() {
  const { user, refreshUser, logout, isLoading } = useAuth();

  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name="time-outline" size={64} color={colors.accent} />
      </View>

      <Text style={s.title}>Account Pending Approval</Text>

      <Text style={s.body}>
        Thanks for signing up{user?.firstName ? `, ${user.firstName}` : ''}!
        {'\n\n'}
        The 195x Bench app is currently in private beta. Your account
        ({user?.email}) is waiting for an admin to review and approve access.
        {'\n\n'}
        You'll be able to use the app as soon as you're approved. Check back
        shortly, or sign out and try again later.
      </Text>

      <TouchableOpacity style={s.primaryBtn} onPress={refreshUser} disabled={isLoading}>
        {isLoading
          ? <ActivityIndicator color={colors.text.onAccent} />
          : <>
              <Ionicons name="refresh" size={18} color={colors.text.onAccent} />
              <Text style={s.primaryBtnText}>Check Again</Text>
            </>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.secondaryBtn} onPress={logout}>
        <Text style={s.secondaryBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.bg.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1, borderColor: colors.border.default,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.bright,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  body: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 16, padding: 12 },
  secondaryBtnText: { color: colors.text.muted, fontSize: 15 },
});
