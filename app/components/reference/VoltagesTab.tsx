import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VOLTAGE_CARDS } from '../../data/voltageCards';
import { styles } from './referenceStyles';

export function VoltagesTab() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <ScrollView>
      <View style={styles.voltageList}>
        <Text style={styles.sectionTitle}>Voltage Reference Cards</Text>
        <Text style={styles.sectionSubtitle}>Expected voltages by circuit family</Text>
        {VOLTAGE_CARDS.map((card) => (
          <View key={card.id} style={styles.voltageCard}>
            <TouchableOpacity
              style={styles.voltageHeader}
              onPress={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
            >
              <View>
                <Text style={styles.voltageName}>{card.name}</Text>
                <Text style={styles.voltageFamily}>{card.circuitFamily}</Text>
                <Text style={styles.voltageDesc}>{card.description}</Text>
              </View>
              <Ionicons
                name={expandedCard === card.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#6b7280"
              />
            </TouchableOpacity>
            {expandedCard === card.id && (
              <View style={styles.voltageTable}>
                {card.voltages.map((v, idx) => (
                  <View key={idx} style={styles.voltageRow}>
                    <Text style={styles.voltageNode}>{v.node}</Text>
                    <Text style={styles.voltageValue}>{v.expected}</Text>
                    {v.notes && <Text style={styles.voltageNotes}>{v.notes}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
