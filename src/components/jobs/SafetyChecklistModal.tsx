import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { SAFETY_CHECKLIST } from '../../types/common';

interface Props {
  visible: boolean;
  safetyChecks: boolean[];
  suggestedSchematics: any[];
  attachedSchematicIds: Set<string>;
  onToggle: (index: number) => void;
  onAttach: (schematicId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function SafetyChecklistModal({
  visible,
  safetyChecks,
  suggestedSchematics,
  attachedSchematicIds,
  onToggle,
  onAttach,
  onConfirm,
  onClose,
}: Props) {
  const allChecked = safetyChecks.every(Boolean);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.content}>
          <View style={s.header}>
            <Ionicons name="warning" size={28} color={colors.accent} />
            <Text style={s.title}>Safety Checklist</Text>
          </View>
          <Text style={s.warning}>
            HIGH VOLTAGE WARNING: Guitar amplifiers contain lethal voltages. Confirm each safety measure before proceeding.
          </Text>

          <ScrollView style={s.scroll}>
            {SAFETY_CHECKLIST.map((item, index) => (
              <TouchableOpacity key={index} style={s.checkItem} onPress={() => onToggle(index)}>
                <View style={[s.checkbox, safetyChecks[index] && s.checkboxChecked]}>
                  {safetyChecks[index] && <Ionicons name="checkmark" size={18} color={colors.text.onAccent} />}
                </View>
                <Text style={s.checkText}>{item}</Text>
              </TouchableOpacity>
            ))}

            {suggestedSchematics.length > 0 && (
              <View style={s.suggested}>
                <Text style={s.suggestedTitle}>
                  <Ionicons name="document-text-outline" size={14} color={colors.accent} />
                  {' '}Schematics found in your library
                </Text>
                {suggestedSchematics.map((sch) => {
                  const attached = attachedSchematicIds.has(sch.id);
                  return (
                    <View key={sch.id} style={s.suggestedRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.suggestedName} numberOfLines={1}>{sch.name}</Text>
                        {sch.circuitFamily && <Text style={s.suggestedFamily}>{sch.circuitFamily}</Text>}
                      </View>
                      <TouchableOpacity
                        style={[s.attachBtn, attached && s.attachBtnDone]}
                        onPress={() => onAttach(sch.id)}
                        disabled={attached}
                      >
                        <Ionicons name={attached ? 'checkmark' : 'add'} size={16} color={colors.text.onAccent} />
                        <Text style={s.attachBtnText}>{attached ? 'Attached' : 'Attach'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={s.buttons}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, !allChecked && s.btnDisabled]}
              onPress={onConfirm}
            >
              <Text style={s.confirmText}>Confirm & Proceed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', paddingBottom: 40,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text.bright },
  warning: {
    color: colors.accent, fontSize: 14, fontWeight: '600', padding: 16,
    backgroundColor: colors.accent + '10', marginHorizontal: 20, borderRadius: 8,
    lineHeight: 20, marginTop: 8,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.bg.elevated,
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.text.muted,
    marginRight: 14, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.status.success, borderColor: colors.status.success },
  checkText: { color: colors.text.bright, fontSize: 15, flex: 1 },
  suggested: {
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border.default,
  },
  suggestedTitle: { fontSize: 13, fontWeight: '600', color: colors.accent, marginBottom: 10 },
  suggestedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.bg.elevated, gap: 10,
  },
  suggestedName: { fontSize: 14, color: colors.text.bright, fontWeight: '500' },
  suggestedFamily: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  attachBtnDone: { backgroundColor: colors.status.success },
  attachBtnText: { color: colors.text.onAccent, fontSize: 13, fontWeight: '600' },
  buttons: { flexDirection: 'row', marginTop: 20, gap: 12, paddingHorizontal: 20 },
  cancelBtn: { flex: 1, backgroundColor: colors.bg.elevated, borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelText: { color: colors.text.bright, fontSize: 16, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: colors.status.success, borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
