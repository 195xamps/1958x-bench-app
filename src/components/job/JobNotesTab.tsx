import React, { memo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatTimestamp } from '../../utils';
import type { JobData } from './types';

interface Props {
  job: JobData['job'];
  techNotes: string;
  savingNotes: boolean;
  notesSaved: boolean;
  isPublic: boolean;
  shareAnonymously: boolean;
  savingShare: boolean;
  onChangeNotes: (text: string) => void;
  onTogglePublic: (value: boolean) => void;
  onToggleAnonymous: (value: boolean) => void;
}

function JobNotesTabImpl({
  job,
  techNotes,
  savingNotes,
  notesSaved,
  isPublic,
  shareAnonymously,
  savingShare,
  onChangeNotes,
  onTogglePublic,
  onToggleAnonymous,
}: Props) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={s.notesHeader}>
          <View>
            <Text style={s.notesTitle}>Repair Notes</Text>
            {job.updatedAt && (
              <Text style={s.notesLastUpdated}>Last updated: {formatTimestamp(job.updatedAt)}</Text>
            )}
          </View>
          <View style={s.saveStatus}>
            {savingNotes && (
              <>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={s.saveStatusText}>Saving...</Text>
              </>
            )}
            {notesSaved && !savingNotes && (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
                <Text style={[s.saveStatusText, { color: colors.status.success }]}>Saved</Text>
              </>
            )}
          </View>
        </View>

        <TextInput
          style={s.notesInput}
          value={techNotes}
          onChangeText={onChangeNotes}
          placeholder="Add repair notes, parts replaced, observations..."
          placeholderTextColor={colors.text.muted}
          multiline
          textAlignVertical="top"
        />

        {job.ownerSymptoms ? <InfoBlock label="Owner's Symptoms" text={job.ownerSymptoms} /> : null}
        {job.priorWork ? <InfoBlock label="Prior Work" text={job.priorWork} /> : null}
        {job.knownMods ? <InfoBlock label="Known Modifications" text={job.knownMods} /> : null}

        <View style={s.shareSection}>
          <View style={s.shareSectionHeader}>
            <Ionicons name="globe-outline" size={20} color={colors.accent} />
            <Text style={s.shareSectionTitle}>Community Sharing</Text>
            {savingShare && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
          </View>
          <Text style={s.shareSectionDescription}>
            Share this job with the community so other technicians can learn from your work.
          </Text>
          <ToggleRow
            label="Share to Community Bench"
            hint="Other technicians can view this job (read-only)"
            value={isPublic}
            onToggle={() => onTogglePublic(!isPublic)}
            disabled={savingShare}
          />
          {isPublic && (
            <ToggleRow
              label="Share Anonymously"
              hint="Hide your name from the shared job"
              value={shareAnonymously}
              onToggle={() => onToggleAnonymous(!shareAnonymously)}
              disabled={savingShare}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const JobNotesTab = memo(JobNotesTabImpl);

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={s.infoSection}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

export function ToggleRow({
  label, hint, value, onToggle, disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={s.shareToggleRow} onPress={onToggle} disabled={disabled}>
      <View style={s.shareToggleInfo}>
        <Text style={s.shareToggleLabel}>{label}</Text>
        <Text style={s.shareToggleHint}>{hint}</Text>
      </View>
      <View style={[s.toggleSwitch, value && s.toggleSwitchOn]}>
        <View style={[s.toggleKnob, value && s.toggleKnobOn]} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 8 },
  notesTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  notesLastUpdated: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveStatusText: { fontSize: 13, color: colors.accent },
  notesInput: {
    marginHorizontal: 16, backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16,
    color: colors.text.bright, fontSize: 15, lineHeight: 22, minHeight: 200, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.border.default,
  },
  infoSection: { marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: colors.bg.surface, borderRadius: 12 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 4 },
  infoText: { fontSize: 14, color: colors.text.bright, lineHeight: 20 },
  shareSection: { margin: 16, padding: 16, backgroundColor: colors.bg.surface, borderRadius: 12 },
  shareSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  shareSectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.bright },
  shareSectionDescription: { fontSize: 13, color: colors.text.secondary, marginBottom: 16, lineHeight: 18 },
  shareToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  shareToggleInfo: { flex: 1, marginRight: 12 },
  shareToggleLabel: { fontSize: 15, fontWeight: '500', color: colors.text.bright },
  shareToggleHint: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  toggleSwitch: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: colors.bg.elevated,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleSwitchOn: { backgroundColor: colors.status.success },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  toggleKnobOn: { alignSelf: 'flex-end' },
});
