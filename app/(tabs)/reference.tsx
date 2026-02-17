import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlowchartsTab, VoltagesTab, CalculatorTab, ArticlesTab, TavaTab } from '../components/reference';
import { colors } from '../theme/colors';

type SubTab = 'flowcharts' | 'voltages' | 'calculator' | 'articles' | 'tava';

const TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'flowcharts', label: 'Flowcharts', icon: 'git-branch' },
  { id: 'voltages', label: 'Voltages', icon: 'flash' },
  { id: 'calculator', label: 'Calc', icon: 'calculator' },
  { id: 'articles', label: 'Articles', icon: 'document-text' },
  { id: 'tava', label: 'TAVA', icon: 'mic' },
];

export default function ReferenceScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('flowcharts');

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? colors.accent : colors.text.secondary}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'flowcharts' && <FlowchartsTab />}
        {activeTab === 'voltages' && <VoltagesTab />}
        {activeTab === 'calculator' && <CalculatorTab />}
        {activeTab === 'articles' && <ArticlesTab />}
        {activeTab === 'tava' && <TavaTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  activeTabText: { color: colors.accent },
  content: { flex: 1 },
});
