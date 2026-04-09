import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlowchartsTab, VoltagesTab, CalculatorTab, LinksTab } from '../../src/components/reference';
import { colors } from '../../src/theme/colors';

type MainTab = 'tools' | 'links' | 'schematics';
type ToolsSub = 'flowcharts' | 'voltages' | 'calculator';

const MAIN_TABS: { id: MainTab; label: string; icon: string }[] = [
  { id: 'tools', label: 'Tools', icon: 'construct' },
  { id: 'links', label: 'Links', icon: 'link' },
  { id: 'schematics', label: 'Schematics', icon: 'document-text' },
];

const TOOLS_SUBS: { id: ToolsSub; label: string }[] = [
  { id: 'flowcharts', label: 'Flowcharts' },
  { id: 'voltages', label: 'Voltages' },
  { id: 'calculator', label: 'Calculator' },
];

export default function ReferenceScreen() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>('tools');
  const [toolsSub, setToolsSub] = useState<ToolsSub>('flowcharts');

  const handleMainTab = (tab: MainTab) => {
    if (tab === 'schematics') {
      router.push('/(tabs)/schematics' as any);
      return;
    }
    setMainTab(tab);
  };

  return (
    <View style={s.container}>
      {/* Main tab bar — 3 tabs */}
      <View style={s.mainTabBar}>
        {MAIN_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[s.mainTab, mainTab === tab.id && s.mainTabActive]}
            onPress={() => handleMainTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={mainTab === tab.id ? colors.accent : colors.text.secondary}
            />
            <Text style={[s.mainTabText, mainTab === tab.id && s.mainTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Secondary segmented control — only Tools has sub-tabs */}
      {mainTab === 'tools' && (
        <View style={s.segmentBar}>
          {TOOLS_SUBS.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={[s.segment, toolsSub === sub.id && s.segmentActive]}
              onPress={() => setToolsSub(sub.id)}
            >
              <Text style={[s.segmentText, toolsSub === sub.id && s.segmentTextActive]}>
                {sub.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      <View style={s.content}>
        {mainTab === 'tools' && toolsSub === 'flowcharts' && <FlowchartsTab />}
        {mainTab === 'tools' && toolsSub === 'voltages' && <VoltagesTab />}
        {mainTab === 'tools' && toolsSub === 'calculator' && <CalculatorTab />}
        {mainTab === 'links' && <LinksTab />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  // Main tab bar
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabActive: { borderBottomColor: colors.accent },
  mainTabText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  mainTabTextActive: { color: colors.accent },

  // Secondary segmented control
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.elevated,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 4,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 3,
  },
  segmentActive: { backgroundColor: colors.bg.surface },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },
  segmentTextActive: { color: colors.accent },

  content: { flex: 1 },
});
