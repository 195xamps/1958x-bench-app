import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FLOWCHARTS, Flowchart } from '../../data/flowcharts';
import { styles } from './referenceStyles';

export function FlowchartsTab() {
  const [selectedFlowchart, setSelectedFlowchart] = useState<Flowchart | null>(null);
  const [currentNode, setCurrentNode] = useState('');

  const startFlowchart = (flowchart: Flowchart) => {
    setSelectedFlowchart(flowchart);
    setCurrentNode(flowchart.startNode);
  };

  const handleAnswer = (answer: 'yes' | 'no') => {
    if (!selectedFlowchart) return;
    const node = selectedFlowchart.nodes[currentNode];
    if (answer === 'yes' && node.yesNext) setCurrentNode(node.yesNext);
    else if (answer === 'no' && node.noNext) setCurrentNode(node.noNext);
  };

  const resetFlowchart = () => {
    setSelectedFlowchart(null);
    setCurrentNode('');
  };

  if (selectedFlowchart) {
    const node = selectedFlowchart.nodes[currentNode];
    return (
      <ScrollView>
        <View style={styles.flowchartActive}>
          <TouchableOpacity style={styles.backButton} onPress={resetFlowchart}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
            <Text style={styles.backButtonText}>Back to Flowcharts</Text>
          </TouchableOpacity>

          <Text style={styles.flowchartTitle}>{selectedFlowchart.name}</Text>
          <Text style={styles.flowchartSymptom}>{selectedFlowchart.symptom}</Text>

          <View style={styles.nodeCard}>
            {node.result ? (
              <>
                <View style={styles.resultHeader}>
                  <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                  <Text style={styles.resultLabel}>Diagnosis</Text>
                </View>
                <Text style={styles.resultText}>{node.result}</Text>
                {node.tip && (
                  <View style={styles.tipBox}>
                    <Ionicons name="bulb" size={18} color="#f59e0b" />
                    <Text style={styles.tipText}>{node.tip}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.restartButton} onPress={() => setCurrentNode(selectedFlowchart.startNode)}>
                  <Ionicons name="refresh" size={20} color="#1f2937" />
                  <Text style={styles.restartButtonText}>Start Over</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.questionText}>{node.question}</Text>
                <View style={styles.answerButtons}>
                  <TouchableOpacity style={[styles.answerButton, styles.yesButton]} onPress={() => handleAnswer('yes')}>
                    <Text style={styles.answerButtonText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.answerButton, styles.noButton]} onPress={() => handleAnswer('no')}>
                    <Text style={styles.answerButtonText}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView>
      <View style={styles.flowchartList}>
        <Text style={styles.sectionTitle}>Troubleshooting Flowcharts</Text>
        <Text style={styles.sectionSubtitle}>Select a symptom to start diagnosis</Text>
        {FLOWCHARTS.map((fc) => (
          <TouchableOpacity key={fc.id} style={styles.flowchartItem} onPress={() => startFlowchart(fc)}>
            <View style={styles.flowchartIcon}>
              <Ionicons name="git-branch" size={24} color="#f59e0b" />
            </View>
            <View style={styles.flowchartInfo}>
              <Text style={styles.flowchartName}>{fc.name}</Text>
              <Text style={styles.flowchartDesc}>{fc.symptom}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
