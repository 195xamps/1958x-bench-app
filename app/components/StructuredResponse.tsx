import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Step {
  StepNumber: number;
  Title: string;
  Action: string;
  Why: string;
  Safety: string;
  StopCondition: string;
}

interface Measurement {
  Name: string;
  WhereToMeasure: string;
  ToolSetting: string;
  ExpectedRange: string;
  WhatItMeans: string;
}

interface DecisionNode {
  Node: string;
  If: string;
  Then: string;
  Else: string;
  Next: string;
}

interface ImageCandidate {
  Make: string;
  Model: string;
  CircuitFamily: string;
  Year: string;
  Confidence: string;
}

interface StructuredResponseData {
  Intent: string;
  Inputs: {
    Answer?: string;
    NeededInfo?: string[];
    Candidates?: ImageCandidate[];
    Evidence?: string[];
    WouldConfirm?: string[];
    [key: string]: any;
  };
  Assumptions: string[];
  Steps: Step[];
  MeasurementsNeeded: Measurement[];
  DecisionTree: DecisionNode[];
}

interface StructuredResponseProps {
  content: string;
}

// Helper to safely coerce values to arrays
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function StructuredResponse({ content }: StructuredResponseProps) {
  let data: StructuredResponseData | null = null;
  
  try {
    data = JSON.parse(content);
  } catch {
    return <Text style={styles.plainText}>{content}</Text>;
  }

  if (!data || !data.Intent) {
    return <Text style={styles.plainText}>{content}</Text>;
  }

  // Safely extract arrays with defensive coercion
  const neededInfo = toArray(data.Inputs?.NeededInfo);
  const candidates = toArray(data.Inputs?.Candidates);
  const evidence = toArray(data.Inputs?.Evidence);
  const wouldConfirm = toArray(data.Inputs?.WouldConfirm);
  const assumptions = toArray(data.Assumptions);
  const steps = toArray(data.Steps);
  const measurements = toArray(data.MeasurementsNeeded);
  const decisionTree = toArray(data.DecisionTree);

  // Check if we have any meaningful content to render
  const hasQuickAnswer = data.Inputs?.Answer;
  const hasNeededInfo = neededInfo.length > 0;
  const hasCandidates = candidates.length > 0;
  const hasAssumptions = assumptions.length > 0;
  const hasSteps = steps.length > 0;
  const hasMeasurements = measurements.length > 0;
  const hasDecisionTree = decisionTree.length > 0;
  
  // Fallback: if no structured content available, show raw JSON inputs
  const hasAnyContent = hasQuickAnswer || hasNeededInfo || hasCandidates || hasAssumptions || hasSteps || hasMeasurements || hasDecisionTree;

  return (
    <View style={styles.container}>
      <IntentBadge intent={data.Intent} />
      
      {/* Safety procedure warning banner */}
      {data.Intent === 'SAFETY_PROCEDURE' && (
        <SafetyWarningBanner />
      )}
      
      {/* Quick Answer */}
      {data.Intent === 'QUICK_ANSWER' && hasQuickAnswer && (
        <QuickAnswerView answer={data.Inputs.Answer!} />
      )}
      
      {/* Need More Info - show what info is needed */}
      {data.Intent === 'NEED_MORE_INFO' && (
        <NeedMoreInfoView neededInfo={hasNeededInfo ? neededInfo : ['Please provide more details about your question.']} />
      )}
      
      {/* Image Identification */}
      {data.Intent === 'IMAGE_IDENTIFICATION' && (
        <ImageIdentificationView 
          candidates={candidates}
          evidence={evidence}
          wouldConfirm={wouldConfirm}
        />
      )}
      
      {/* Standard structured sections */}
      {hasAssumptions && (
        <AssumptionsView assumptions={assumptions} />
      )}
      
      {hasSteps && (
        <StepsListView steps={steps} />
      )}
      
      {hasMeasurements && (
        <MeasurementsTableView measurements={measurements} />
      )}
      
      {hasDecisionTree && (
        <DecisionTreeView nodes={decisionTree} />
      )}
      
      {/* Fallback for unexpected structure - show any text in Inputs */}
      {!hasAnyContent && data.Inputs && (
        <FallbackInputsView inputs={data.Inputs} />
      )}
    </View>
  );
}

function SafetyWarningBanner() {
  return (
    <View style={styles.safetyBanner}>
      <Ionicons name="warning" size={20} color="#ef4444" />
      <View style={styles.safetyBannerContent}>
        <Text style={styles.safetyBannerTitle}>High Voltage Safety Procedure</Text>
        <Text style={styles.safetyBannerText}>Follow all steps carefully. Lethal voltages present in tube amplifiers.</Text>
      </View>
    </View>
  );
}

function FallbackInputsView({ inputs }: { inputs: Record<string, any> }) {
  const entries = Object.entries(inputs).filter(([key, value]) => 
    value !== null && value !== undefined && key !== 'Answer' && key !== 'NeededInfo' && key !== 'Candidates'
  );
  
  if (entries.length === 0) return null;
  
  return (
    <View style={styles.section}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.fallbackItem}>
          <Text style={styles.fallbackKey}>{key}:</Text>
          <Text style={styles.fallbackValue}>
            {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const getIntentConfig = () => {
    switch (intent) {
      case 'SAFETY_PROCEDURE':
        return { icon: 'shield-checkmark', color: '#ef4444', label: 'Safety Procedure' };
      case 'MEASUREMENT_SETUP':
        return { icon: 'speedometer', color: '#3b82f6', label: 'Measurement Setup' };
      case 'SYMPTOM_TROUBLESHOOTING':
        return { icon: 'build', color: '#f59e0b', label: 'Troubleshooting' };
      case 'IMAGE_IDENTIFICATION':
        return { icon: 'camera', color: '#8b5cf6', label: 'Identification' };
      case 'VALIDATION_QA':
        return { icon: 'checkmark-circle', color: '#10b981', label: 'Validation' };
      case 'QUICK_ANSWER':
        return { icon: 'chatbubble', color: '#6b7280', label: 'Quick Answer' };
      case 'NEED_MORE_INFO':
        return { icon: 'help-circle', color: '#f97316', label: 'Need More Info' };
      default:
        return { icon: 'information-circle', color: '#6b7280', label: intent };
    }
  };

  const config = getIntentConfig();
  
  return (
    <View style={[styles.intentBadge, { backgroundColor: config.color + '20' }]}>
      <Ionicons name={config.icon as any} size={14} color={config.color} />
      <Text style={[styles.intentText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function QuickAnswerView({ answer }: { answer: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.answerText}>{answer}</Text>
    </View>
  );
}

function NeedMoreInfoView({ neededInfo }: { neededInfo: string[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.warningBox}>
        <Ionicons name="alert-circle" size={20} color="#f97316" />
        <Text style={styles.warningTitle}>Additional Information Needed</Text>
      </View>
      {neededInfo.map((info, idx) => (
        <View key={idx} style={styles.neededInfoItem}>
          <Text style={styles.bulletPoint}>{idx + 1}.</Text>
          <Text style={styles.neededInfoText}>{info}</Text>
        </View>
      ))}
    </View>
  );
}

function ImageIdentificationView({ 
  candidates, 
  evidence, 
  wouldConfirm 
}: { 
  candidates: ImageCandidate[];
  evidence: string[];
  wouldConfirm: string[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Identification</Text>
      {candidates.map((candidate, idx) => (
        <View key={idx} style={styles.candidateCard}>
          <View style={styles.candidateHeader}>
            <Text style={styles.candidateMake}>{candidate.Make} {candidate.Model}</Text>
            <View style={[styles.confidenceBadge, getConfidenceStyle(candidate.Confidence)]}>
              <Text style={styles.confidenceText}>{candidate.Confidence}</Text>
            </View>
          </View>
          <Text style={styles.candidateDetails}>
            {candidate.CircuitFamily} • {candidate.Year}
          </Text>
        </View>
      ))}
      
      {evidence.length > 0 && (
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Visual Evidence</Text>
          {evidence.map((item, idx) => (
            <View key={idx} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
      
      {wouldConfirm.length > 0 && (
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>To Confirm</Text>
          {wouldConfirm.map((item, idx) => (
            <View key={idx} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getConfidenceStyle(confidence: string) {
  switch (confidence?.toLowerCase()) {
    case 'high':
      return { backgroundColor: '#10b98120' };
    case 'medium':
      return { backgroundColor: '#f59e0b20' };
    case 'low':
      return { backgroundColor: '#ef444420' };
    default:
      return { backgroundColor: '#6b728020' };
  }
}

function AssumptionsView({ assumptions }: { assumptions: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Assumptions</Text>
      {assumptions.map((assumption, idx) => (
        <View key={idx} style={styles.bulletItem}>
          <Ionicons name="checkbox" size={14} color="#f59e0b" />
          <Text style={styles.bulletText}>{assumption}</Text>
        </View>
      ))}
    </View>
  );
}

function StepsListView({ steps }: { steps: Step[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Steps</Text>
      {steps.map((step, idx) => (
        <View key={idx} style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.StepNumber}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.Title}</Text>
          </View>
          
          <Text style={styles.stepAction}>{step.Action}</Text>
          
          {step.Why && (
            <View style={styles.stepDetail}>
              <Text style={styles.stepDetailLabel}>Why:</Text>
              <Text style={styles.stepDetailText}>{step.Why}</Text>
            </View>
          )}
          
          {step.Safety && (
            <View style={[styles.stepDetail, styles.safetyDetail]}>
              <Ionicons name="warning" size={14} color="#ef4444" />
              <Text style={styles.safetyText}>{step.Safety}</Text>
            </View>
          )}
          
          {step.StopCondition && (
            <View style={styles.stopCondition}>
              <Ionicons name="stop-circle" size={14} color="#ef4444" />
              <Text style={styles.stopConditionText}>{step.StopCondition}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function MeasurementsTableView({ measurements }: { measurements: Measurement[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Measurements Needed</Text>
      {measurements.map((m, idx) => (
        <View key={idx} style={styles.measurementCard}>
          <Text style={styles.measurementName}>{m.Name}</Text>
          <View style={styles.measurementRow}>
            <Text style={styles.measurementLabel}>Where:</Text>
            <Text style={styles.measurementValue}>{m.WhereToMeasure}</Text>
          </View>
          <View style={styles.measurementRow}>
            <Text style={styles.measurementLabel}>Tool:</Text>
            <Text style={styles.measurementValue}>{m.ToolSetting}</Text>
          </View>
          <View style={styles.measurementRow}>
            <Text style={styles.measurementLabel}>Expected:</Text>
            <Text style={[styles.measurementValue, styles.expectedValue]}>{m.ExpectedRange}</Text>
          </View>
          <View style={styles.measurementRow}>
            <Text style={styles.measurementLabel}>Meaning:</Text>
            <Text style={styles.measurementValue}>{m.WhatItMeans}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DecisionTreeView({ nodes }: { nodes: DecisionNode[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Decision Tree</Text>
      {nodes.map((node, idx) => (
        <View key={idx} style={styles.decisionNode}>
          <View style={styles.nodeHeader}>
            <View style={styles.nodeId}>
              <Text style={styles.nodeIdText}>{node.Node}</Text>
            </View>
            <Text style={styles.nodeCondition}>{node.If}</Text>
          </View>
          <View style={styles.nodeBranches}>
            <View style={styles.nodeBranch}>
              <View style={[styles.branchIndicator, { backgroundColor: '#10b981' }]} />
              <Text style={styles.branchLabel}>Then:</Text>
              <Text style={styles.branchText}>{node.Then}</Text>
            </View>
            <View style={styles.nodeBranch}>
              <View style={[styles.branchIndicator, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.branchLabel}>Else:</Text>
              <Text style={styles.branchText}>{node.Else}</Text>
            </View>
          </View>
          {node.Next && node.Next !== 'END' && (
            <Text style={styles.nextNode}>Next: {node.Next}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  plainText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  intentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  answerText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f9731620',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  warningTitle: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
  },
  neededInfoItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletPoint: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
  },
  neededInfoText: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  candidateCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  candidateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  candidateMake: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
  },
  candidateDetails: {
    color: '#9ca3af',
    fontSize: 13,
  },
  subsection: {
    marginTop: 12,
  },
  subsectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bulletItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  bulletDot: {
    color: '#f59e0b',
    fontSize: 14,
  },
  bulletText: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  stepAction: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  stepDetail: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  stepDetailLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  stepDetailText: {
    color: '#9ca3af',
    fontSize: 12,
    flex: 1,
  },
  safetyDetail: {
    backgroundColor: '#ef444420',
    padding: 8,
    borderRadius: 6,
    alignItems: 'flex-start',
  },
  safetyText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  stopCondition: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#4b5563',
    alignItems: 'flex-start',
  },
  stopConditionText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
    fontStyle: 'italic',
  },
  measurementCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  measurementName: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  measurementRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  measurementLabel: {
    color: '#9ca3af',
    fontSize: 12,
    width: 70,
    fontWeight: '600',
  },
  measurementValue: {
    color: '#e5e7eb',
    fontSize: 12,
    flex: 1,
  },
  expectedValue: {
    color: '#10b981',
    fontWeight: '600',
  },
  decisionNode: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  nodeId: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nodeIdText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  nodeCondition: {
    color: '#e5e7eb',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  nodeBranches: {
    gap: 6,
  },
  nodeBranch: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  branchIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  branchLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    width: 40,
  },
  branchText: {
    color: '#e5e7eb',
    fontSize: 12,
    flex: 1,
  },
  nextNode: {
    color: '#8b5cf6',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  safetyBanner: {
    flexDirection: 'row',
    backgroundColor: '#ef444420',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    gap: 12,
    alignItems: 'flex-start',
  },
  safetyBannerContent: {
    flex: 1,
  },
  safetyBannerTitle: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  safetyBannerText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
  },
  fallbackItem: {
    marginBottom: 8,
  },
  fallbackKey: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  fallbackValue: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default StructuredResponse;
