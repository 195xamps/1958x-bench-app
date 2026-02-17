#!/usr/bin/env node
/**
 * Phase 3a Migration: Split reference.tsx (2,448 lines → ~8 focused files)
 * 
 * Creates:
 *   app/hooks/useCalculators.ts          — 12 calculator functions extracted
 *   app/components/reference/FlowchartsTab.tsx  — flowchart navigation UI
 *   app/components/reference/VoltagesTab.tsx    — voltage reference cards
 *   app/components/reference/CalculatorTab.tsx  — calculator UI (uses hook)
 *   app/components/reference/ArticlesTab.tsx    — articles list + import modal
 *   app/components/reference/TavaTab.tsx        — podcast index
 *   app/components/reference/referenceStyles.ts — shared styles
 *   app/components/reference/index.ts           — barrel export
 *   app/(tabs)/reference-refactored.tsx         — thin orchestrator (~80 lines)
 * 
 * Does NOT modify existing files. To activate:
 *   mv app/(tabs)/reference.tsx app/(tabs)/reference-old.tsx
 *   mv app/(tabs)/reference-refactored.tsx app/(tabs)/reference.tsx
 */

const fs = require('fs');
const path = require('path');

const files = {};

// ─────────────────────────────────────────────────────────────────────────────
// 1. useCalculators.ts — All 12 calculator functions as a custom hook
// ─────────────────────────────────────────────────────────────────────────────
files['app/hooks/useCalculators.ts'] = `import { useState } from 'react';

type TubeType = '6V6' | '6L6GC' | 'EL34' | 'EL84' | '6550';
type SpeakerWiring = 'series' | 'parallel' | 'series-parallel';

const TUBE_MAX_DISSIPATION: Record<TubeType, number> = {
  '6V6': 14,
  '6L6GC': 30,
  'EL34': 25,
  'EL84': 12,
  '6550': 35,
};

export const TUBE_TYPES: TubeType[] = ['6V6', '6L6GC', 'EL34', 'EL84', '6550'];
export const WIRING_OPTIONS: SpeakerWiring[] = ['series', 'parallel', 'series-parallel'];

export interface CalculatorState {
  // Bias & Power
  biasPlateV: string;
  biasTubeType: TubeType;
  biasTargetPercent: string;
  cathBiasDesiredCurrent: string;
  cathBiasDesiredVk: string;
  cathBiasNumTubes: string;
  vkRkVk: string;
  vkRkRk: string;
  vkRkScreenCurrent: string;
  plateVoltage: string;
  plateCurrent: string;
  screenCurrent: string;
  // Output & Load
  outputVrms: string;
  outputLoad: string;
  speaker1: string;
  speaker2: string;
  speaker3: string;
  speaker4: string;
  speakerWiring: SpeakerWiring;
  // Power Supply & Safety
  dropResVdrop: string;
  dropResCurrent: string;
  dropResValue: string;
  dischargeCap: string;
  dischargeVstart: string;
  dischargeVtarget: string;
  dischargeRes: string;
  filterCapValue: string;
  filterResValue: string;
  // Frequency & Coupling
  couplingCapValue: string;
  couplingGridLeak: string;
  cathodeResValue: string;
  // General Bench Math
  ohmV: string;
  ohmI: string;
  ohmR: string;
  dividerR1: string;
  dividerR2: string;
  dividerVin: string;
  // Expanded category
  expandedCalcCategory: string | null;
}

const initialState: CalculatorState = {
  biasPlateV: '', biasTubeType: '6L6GC', biasTargetPercent: '65',
  cathBiasDesiredCurrent: '', cathBiasDesiredVk: '', cathBiasNumTubes: '2',
  vkRkVk: '', vkRkRk: '', vkRkScreenCurrent: '',
  plateVoltage: '', plateCurrent: '', screenCurrent: '',
  outputVrms: '', outputLoad: '',
  speaker1: '', speaker2: '', speaker3: '', speaker4: '', speakerWiring: 'parallel',
  dropResVdrop: '', dropResCurrent: '', dropResValue: '',
  dischargeCap: '', dischargeVstart: '', dischargeVtarget: '', dischargeRes: '',
  filterCapValue: '', filterResValue: '',
  couplingCapValue: '', couplingGridLeak: '', cathodeResValue: '',
  ohmV: '', ohmI: '', ohmR: '',
  dividerR1: '', dividerR2: '', dividerVin: '',
  expandedCalcCategory: 'bias',
};

export function useCalculators() {
  const [state, setState] = useState<CalculatorState>(initialState);

  const set = <K extends keyof CalculatorState>(key: K) =>
    (value: CalculatorState[K]) => setState(prev => ({ ...prev, [key]: value }));

  const toggleCategory = (cat: string) =>
    setState(prev => ({ ...prev, expandedCalcCategory: prev.expandedCalcCategory === cat ? null : cat }));

  // ── Bias & Power ────────────────────────────────────────────────────────

  const calculateFixedBiasTarget = () => {
    const vPlate = parseFloat(state.biasPlateV);
    const targetPct = parseFloat(state.biasTargetPercent);
    if (isNaN(vPlate) || isNaN(targetPct) || vPlate <= 0 || targetPct <= 0) return null;
    const maxWatts = TUBE_MAX_DISSIPATION[state.biasTubeType] || 25;
    const targetWatts = (maxWatts * targetPct) / 100;
    const targetMa = (targetWatts / vPlate) * 1000;
    const screenEstimate = targetMa * 0.12;
    return {
      maxWatts,
      targetWatts: targetWatts.toFixed(1),
      targetMa: targetMa.toFixed(1),
      cathodeMa: (targetMa + screenEstimate).toFixed(1),
    };
  };

  const calculateCathodeBiasResistor = () => {
    const desiredCurrent = parseFloat(state.cathBiasDesiredCurrent);
    const desiredVk = parseFloat(state.cathBiasDesiredVk);
    const numTubes = parseInt(state.cathBiasNumTubes) || 1;
    if (isNaN(desiredCurrent) || isNaN(desiredVk) || desiredCurrent <= 0 || desiredVk <= 0) return null;
    const totalCurrent = desiredCurrent * numTubes;
    const resistance = (desiredVk / totalCurrent) * 1000;
    const power = (desiredVk * totalCurrent) / 1000;
    const safeWattage = Math.ceil(power * 2);
    return {
      resistance: resistance.toFixed(0),
      power: power.toFixed(1),
      safeWattage: safeWattage > 25 ? 25 : (safeWattage < 5 ? 5 : safeWattage),
      totalCurrent: totalCurrent.toFixed(1),
    };
  };

  const calculateCurrentFromVkRk = () => {
    const vk = parseFloat(state.vkRkVk);
    const rk = parseFloat(state.vkRkRk);
    const screenI = parseFloat(state.vkRkScreenCurrent) || 0;
    if (isNaN(vk) || isNaN(rk) || vk <= 0 || rk <= 0) return null;
    const cathodeCurrent = (vk / rk) * 1000;
    const plateCurrent = Math.max(0, cathodeCurrent - screenI);
    const warning = screenI > cathodeCurrent ? 'Screen current exceeds cathode current!' : null;
    return { cathodeCurrent: cathodeCurrent.toFixed(1), plateCurrent: plateCurrent.toFixed(1), warning };
  };

  const calculatePlateDissipation = () => {
    const vPlate = parseFloat(state.plateVoltage);
    const iPlate = parseFloat(state.plateCurrent);
    const iScreen = parseFloat(state.screenCurrent) || 0;
    if (isNaN(vPlate) || isNaN(iPlate) || vPlate <= 0 || iPlate <= 0) return null;
    const platePower = (vPlate * iPlate) / 1000;
    const totalPower = (vPlate * (iPlate + iScreen)) / 1000;
    return { plate: platePower.toFixed(1), total: totalPower.toFixed(1) };
  };

  // ── Output & Load ──────────────────────────────────────────────────────

  const calculateOutputPower = () => {
    const vrms = parseFloat(state.outputVrms);
    const load = parseFloat(state.outputLoad);
    if (isNaN(vrms) || isNaN(load) || vrms <= 0 || load <= 0) return null;
    const watts = (vrms * vrms) / load;
    const vpeak = vrms * Math.sqrt(2);
    return { watts: watts.toFixed(1), vpeak: vpeak.toFixed(1) };
  };

  const calculateSpeakerImpedance = () => {
    const speakers = [state.speaker1, state.speaker2, state.speaker3, state.speaker4]
      .map(s => parseFloat(s) || 0).filter(s => s > 0);
    if (speakers.length === 0) return null;
    if (speakers.length === 1) return { total: speakers[0].toFixed(1), tap: \`\${speakers[0]}Ω\` };
    let total = 0;
    if (state.speakerWiring === 'series') {
      total = speakers.reduce((a, b) => a + b, 0);
    } else if (state.speakerWiring === 'parallel') {
      total = 1 / speakers.reduce((a, b) => a + 1 / b, 0);
    } else {
      if (speakers.length === 4) {
        const pair1 = speakers[0] + speakers[1];
        const pair2 = speakers[2] + speakers[3];
        total = 1 / (1 / pair1 + 1 / pair2);
      } else {
        total = 1 / speakers.reduce((a, b) => a + 1 / b, 0);
      }
    }
    const nearestTaps = [2, 4, 8, 16];
    const recommendedTap = nearestTaps.reduce((prev, curr) =>
      Math.abs(curr - total) < Math.abs(prev - total) ? curr : prev
    );
    return { total: total.toFixed(1), tap: \`\${recommendedTap}Ω\` };
  };

  // ── Power Supply & Safety ──────────────────────────────────────────────

  const calculateDroppingResistor = () => {
    const vDrop = parseFloat(state.dropResVdrop);
    const current = parseFloat(state.dropResCurrent);
    const resistance = parseFloat(state.dropResValue);
    if (resistance > 0 && current > 0) {
      const actualDrop = (resistance * current) / 1000;
      const power = (actualDrop * current) / 1000;
      return { mode: 'fromRes' as const, actualDrop: actualDrop.toFixed(1), power: power.toFixed(2), safeWattage: Math.ceil(power * 2) };
    }
    if (vDrop > 0 && current > 0) {
      const neededRes = (vDrop / current) * 1000;
      const power = (vDrop * current) / 1000;
      return { mode: 'fromDrop' as const, neededRes: neededRes.toFixed(0), power: power.toFixed(2), safeWattage: Math.ceil(power * 2) };
    }
    return null;
  };

  const calculateDischargeTime = () => {
    const cap = parseFloat(state.dischargeCap);
    const vStart = parseFloat(state.dischargeVstart);
    const vTarget = parseFloat(state.dischargeVtarget);
    const res = parseFloat(state.dischargeRes);
    if (isNaN(cap) || isNaN(vStart) || isNaN(vTarget) || isNaN(res)) return null;
    if (cap <= 0 || vStart <= 0 || vTarget <= 0 || res <= 0 || vTarget >= vStart) return null;
    const tauSeconds = (res * cap) / 1000000;
    const timeToTarget = tauSeconds * Math.log(vStart / vTarget);
    const initialPower = (vStart * vStart) / res;
    const energy = 0.5 * (cap / 1000000) * (vStart * vStart);
    return {
      tau: tauSeconds.toFixed(2),
      timeToTarget: timeToTarget.toFixed(1),
      initialPower: initialPower.toFixed(2),
      safeWattage: Math.ceil(initialPower * 1.5),
      energy: energy.toFixed(2),
      dangerLevel: energy > 10 ? 'LETHAL' : energy > 1 ? 'Dangerous' : 'Low',
    };
  };

  const calculateFilterRC = () => {
    const c = parseFloat(state.filterCapValue);
    const r = parseFloat(state.filterResValue);
    if (isNaN(c) || isNaN(r) || c <= 0 || r <= 0) return null;
    const tau = (r * c) / 1000;
    const cutoff = 1 / (2 * Math.PI * r * (c / 1000000));
    return { tau: tau.toFixed(2), cutoff: cutoff.toFixed(2) };
  };

  // ── Frequency & Coupling ───────────────────────────────────────────────

  const calculateCouplingCutoff = () => {
    const cap = parseFloat(state.couplingCapValue);
    const gridLeak = parseFloat(state.couplingGridLeak);
    if (isNaN(cap) || isNaN(gridLeak) || cap <= 0 || gridLeak <= 0) return null;
    const capFarads = cap / 1000000000;
    const cutoff = 1 / (2 * Math.PI * gridLeak * 1000 * capFarads);
    return {
      cutoff: cutoff.toFixed(1),
      bassNote: cutoff < 82 ? 'Below low E' : cutoff < 110 ? 'Around low A' : cutoff < 165 ? 'Around low E octave' : 'Mid-range',
    };
  };

  const calculateBypassCap = () => {
    const r = parseFloat(state.cathodeResValue);
    if (isNaN(r) || r <= 0) return null;
    const cap25hz = 1000000 / (2 * Math.PI * r * 25);
    const cap100hz = 1000000 / (2 * Math.PI * r * 100);
    return { full: cap25hz.toFixed(1), partial: cap100hz.toFixed(1) };
  };

  // ── General Bench Math ─────────────────────────────────────────────────

  const calculateOhmsLaw = () => {
    const v = parseFloat(state.ohmV);
    const i = parseFloat(state.ohmI);
    const r = parseFloat(state.ohmR);
    const known = [!isNaN(v) && v > 0, !isNaN(i) && i > 0, !isNaN(r) && r > 0].filter(Boolean).length;
    if (known < 2) return null;
    const result: any = {};
    if (!isNaN(v) && v > 0 && !isNaN(i) && i > 0) {
      result.r = (v / (i / 1000)).toFixed(1);
      result.p = (v * (i / 1000)).toFixed(2);
    } else if (!isNaN(v) && v > 0 && !isNaN(r) && r > 0) {
      result.i = ((v / r) * 1000).toFixed(2);
      result.p = ((v * v) / r).toFixed(2);
    } else if (!isNaN(i) && i > 0 && !isNaN(r) && r > 0) {
      result.v = ((i / 1000) * r).toFixed(1);
      result.p = (((i / 1000) * (i / 1000)) * r).toFixed(2);
    }
    return result;
  };

  const calculateVoltageDivider = () => {
    const r1 = parseFloat(state.dividerR1);
    const r2 = parseFloat(state.dividerR2);
    const vin = parseFloat(state.dividerVin);
    if (isNaN(r1) || isNaN(r2) || isNaN(vin) || r1 <= 0 || r2 <= 0 || vin <= 0) return null;
    const vout = (vin * r2) / (r1 + r2);
    const ratio = r2 / (r1 + r2);
    return { vout: vout.toFixed(2), ratio: (ratio * 100).toFixed(1) };
  };

  const calculateCathodeRes = () => {
    const i = parseFloat(state.plateVoltage); // reuses plateCurrent field context
    if (isNaN(i) || i <= 0) return null;
    return [
      { bias: 10, r: ((10 / i) * 1000).toFixed(0) },
      { bias: 15, r: ((15 / i) * 1000).toFixed(0) },
      { bias: 20, r: ((20 / i) * 1000).toFixed(0) },
    ];
  };

  return {
    state, set, toggleCategory,
    // Calculations
    calculateFixedBiasTarget,
    calculateCathodeBiasResistor,
    calculateCurrentFromVkRk,
    calculatePlateDissipation,
    calculateOutputPower,
    calculateSpeakerImpedance,
    calculateDroppingResistor,
    calculateDischargeTime,
    calculateFilterRC,
    calculateCouplingCutoff,
    calculateBypassCap,
    calculateOhmsLaw,
    calculateVoltageDivider,
    calculateCathodeRes,
  };
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. referenceStyles.ts — All styles for reference sub-tabs
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/referenceStyles.ts'] = `import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: colors.bg.primary },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  activeTabText: { color: colors.accent },
  content: { flex: 1 },

  // ── Shared Section ────────────────────────────────────────────────────
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text.primary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: colors.text.muted, marginBottom: 16 },

  // ── Flowcharts ────────────────────────────────────────────────────────
  flowchartList: { padding: 16 },
  flowchartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  flowchartIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  flowchartInfo: { flex: 1 },
  flowchartName: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 4 },
  flowchartDesc: { fontSize: 13, color: colors.text.muted },
  flowchartActive: { padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  backButtonText: { color: colors.accent, fontSize: 16 },
  flowchartTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text.primary, marginBottom: 4 },
  flowchartSymptom: { fontSize: 14, color: colors.text.muted, marginBottom: 20 },
  nodeCard: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border.default },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  resultLabel: { fontSize: 18, fontWeight: 'bold', color: colors.status.success },
  resultText: { fontSize: 16, color: colors.text.bright, lineHeight: 24, marginBottom: 12 },
  tipBox: { flexDirection: 'row', backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, gap: 8, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 14, color: colors.accent, lineHeight: 20 },
  restartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 8, padding: 12, marginTop: 16, gap: 8 },
  restartButtonText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },
  questionText: { fontSize: 18, color: colors.text.primary, marginBottom: 20, lineHeight: 26 },
  answerButtons: { flexDirection: 'row', gap: 12 },
  answerButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  yesButton: { backgroundColor: colors.status.success },
  noButton: { backgroundColor: colors.status.error },
  answerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── Voltages ──────────────────────────────────────────────────────────
  voltageList: { padding: 16 },
  voltageCard: { backgroundColor: colors.bg.surface, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  voltageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  voltageName: { fontSize: 16, fontWeight: 'bold', color: colors.accent },
  voltageFamily: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  voltageDesc: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  voltageTable: { paddingHorizontal: 16, paddingBottom: 16 },
  voltageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  voltageNode: { flex: 1, fontSize: 14, color: colors.text.bright },
  voltageValue: { fontSize: 14, fontWeight: '600', color: colors.accent, minWidth: 100, textAlign: 'right' },
  voltageNotes: { fontSize: 12, color: colors.text.muted, marginLeft: 8, maxWidth: 100 },

  // ── Calculator ────────────────────────────────────────────────────────
  calculatorContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  calcCategoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 8 },
  calcCategoryTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calcCategoryText: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  calcCategoryContent: { marginBottom: 12 },
  calcCard: { backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border.default },
  calcTitle: { fontSize: 16, fontWeight: 'bold', color: colors.accent, marginBottom: 4 },
  calcDesc: { fontSize: 13, color: colors.text.muted, marginBottom: 12 },
  calcInputRow: { flexDirection: 'row', gap: 12 },
  calcInputGroup: { flex: 1, marginBottom: 12 },
  calcLabel: { fontSize: 13, color: colors.text.secondary, marginBottom: 6 },
  calcInput: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, color: colors.text.primary, fontSize: 15 },
  calcResult: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 12, marginTop: 4 },
  calcResultText: { fontSize: 14, color: colors.text.bright, marginBottom: 4 },
  calcResultValue: { fontWeight: 'bold', color: colors.accent },
  tubeTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tubeTypeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default },
  tubeTypeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tubeTypeBtnText: { fontSize: 14, color: colors.text.secondary, fontWeight: '500' },
  tubeTypeBtnTextActive: { color: colors.text.onAccent },

  // ── Articles ──────────────────────────────────────────────────────────
  articlesContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  articlesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  importButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  importButtonText: { color: colors.text.onAccent, fontSize: 14, fontWeight: '600' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: colors.text.secondary, marginTop: 12, fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.text.bright, fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { color: colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyImportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: colors.accent },
  emptyImportText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  articlesList: { gap: 12 },
  articleCard: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderRadius: 12, padding: 16, alignItems: 'center' },
  articleContent: { flex: 1 },
  articleTitle: { color: colors.text.bright, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circuitBadge: { backgroundColor: colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  circuitBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  articleSource: { color: colors.text.muted, fontSize: 12 },
  deleteButton: { padding: 8 },
  creditSection: { alignItems: 'center', paddingVertical: 24 },
  creditText: { color: colors.text.muted, fontSize: 12 },
  creditLink: { color: colors.accent, textDecorationLine: 'underline' },

  // ── Import Modal ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.bg.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: colors.accent, fontSize: 20, fontWeight: 'bold' },
  modalLabel: { color: colors.text.secondary, fontSize: 14, marginBottom: 8 },
  modalInput: { backgroundColor: colors.bg.elevated, borderRadius: 8, padding: 14, color: colors.text.primary, fontSize: 16, marginBottom: 8 },
  modalHint: { color: colors.text.muted, fontSize: 12, marginBottom: 20 },
  modalButton: { flexDirection: 'row', backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalButtonDisabled: { opacity: 0.6 },
  modalButtonText: { color: colors.text.onAccent, fontSize: 16, fontWeight: '600' },

  // ── TAVA Podcast ──────────────────────────────────────────────────────
  tavaContainer: { flex: 1, paddingHorizontal: 16 },
  tavaHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 16, paddingBottom: 12, gap: 12 },
  syncButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  syncButtonDisabled: { opacity: 0.7 },
  syncButtonText: { color: colors.text.onAccent, fontSize: 13, fontWeight: '600' },
  podcastSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, gap: 10 },
  podcastSearchInput: { flex: 1, color: colors.text.primary, fontSize: 16 },
  episodesList: { gap: 16 },
  episodeCard: { backgroundColor: colors.bg.surface, borderRadius: 12, overflow: 'hidden' },
  episodeHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.bg.elevated, gap: 12 },
  episodeNumberBadge: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  episodeNumberText: { color: colors.text.onAccent, fontSize: 12, fontWeight: 'bold' },
  episodeTitleText: { flex: 1, color: colors.text.bright, fontSize: 15, fontWeight: '600' },
  episodeHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openLinkButton: { padding: 4 },
  topicsList: { padding: 12, gap: 8 },
  topicItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  topicTimestamp: { color: colors.accent, fontSize: 12, fontFamily: 'monospace', minWidth: 50 },
  topicText: { flex: 1, color: colors.text.bright, fontSize: 14 },
});
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. FlowchartsTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/FlowchartsTab.tsx'] = `import React, { useState } from 'react';
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
`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. VoltagesTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/VoltagesTab.tsx'] = `import React, { useState } from 'react';
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
`;

// ─────────────────────────────────────────────────────────────────────────────
// 5. CalculatorTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/CalculatorTab.tsx'] = `import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCalculators, TUBE_TYPES, WIRING_OPTIONS } from '../../hooks/useCalculators';
import { styles } from './referenceStyles';

export function CalculatorTab() {
  const calc = useCalculators();
  const { state, set, toggleCategory } = calc;

  const CalcCard = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
    <View style={styles.calcCard}>
      <Text style={styles.calcTitle}>{title}</Text>
      <Text style={styles.calcDesc}>{desc}</Text>
      {children}
    </View>
  );

  const CalcInput = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <View style={styles.calcInputGroup}>
      <Text style={styles.calcLabel}>{label}</Text>
      <TextInput style={styles.calcInput} value={value} onChangeText={onChange} keyboardType="numeric" placeholder={placeholder || ''} placeholderTextColor="#6b7280" />
    </View>
  );

  const Result = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.calcResult}>{children}</View>
  );

  const ResultLine = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <Text style={[styles.calcResultText, color ? { color } : undefined]}>
      {label}: <Text style={styles.calcResultValue}>{value}</Text>
    </Text>
  );

  const CategoryHeader = ({ id, icon, title }: { id: string; icon: string; title: string }) => (
    <TouchableOpacity style={styles.calcCategoryHeader} onPress={() => toggleCategory(id)}>
      <View style={styles.calcCategoryTitle}>
        <Ionicons name={icon as any} size={20} color="#f59e0b" />
        <Text style={styles.calcCategoryText}>{title}</Text>
      </View>
      <Ionicons name={state.expandedCalcCategory === id ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const fixedBias = calc.calculateFixedBiasTarget();
  const cathBias = calc.calculateCathodeBiasResistor();
  const vkRk = calc.calculateCurrentFromVkRk();
  const plateDiss = calc.calculatePlateDissipation();
  const outputPower = calc.calculateOutputPower();
  const speakerZ = calc.calculateSpeakerImpedance();
  const dropRes = calc.calculateDroppingResistor();
  const discharge = calc.calculateDischargeTime();
  const filterRC = calc.calculateFilterRC();
  const coupling = calc.calculateCouplingCutoff();
  const bypass = calc.calculateBypassCap();
  const ohms = calc.calculateOhmsLaw();
  const divider = calc.calculateVoltageDivider();

  return (
    <ScrollView style={styles.calculatorContainer}>
      <Text style={styles.sectionTitle}>Tube Amp Calculators</Text>
      <Text style={styles.sectionSubtitle}>Essential bench calculations</Text>

      {/* ── Bias and Power Tube Health ──────────────────────────────────── */}
      <CategoryHeader id="bias" icon="flash" title="Bias and Power Tube Health" />
      {state.expandedCalcCategory === 'bias' && (
        <View style={styles.calcCategoryContent}>
          <CalcCard title="Fixed-Bias Target Calculator" desc="Calculate target plate current for % of max dissipation">
            <View style={styles.calcInputGroup}>
              <Text style={styles.calcLabel}>Tube Type</Text>
              <View style={styles.tubeTypeRow}>
                {TUBE_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.tubeTypeBtn, state.biasTubeType === t && styles.tubeTypeBtnActive]} onPress={() => set('biasTubeType')(t)}>
                    <Text style={[styles.tubeTypeBtnText, state.biasTubeType === t && styles.tubeTypeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.calcInputRow}>
              <CalcInput label="Plate Voltage (V)" value={state.biasPlateV} onChange={set('biasPlateV')} placeholder="e.g. 420" />
              <CalcInput label="Target % (60-70 typical)" value={state.biasTargetPercent} onChange={set('biasTargetPercent')} placeholder="65" />
            </View>
            {fixedBias && (
              <Result>
                <ResultLine label="Max Dissipation" value={\`\${fixedBias.maxWatts}W\`} />
                <ResultLine label="Target Dissipation" value={\`\${fixedBias.targetWatts}W\`} />
                <ResultLine label="Target Plate Current" value={\`\${fixedBias.targetMa} mA\`} />
                <ResultLine label="Est. Cathode Current" value={\`\${fixedBias.cathodeMa} mA\`} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Cathode-Bias Resistor Sizing" desc="Size cathode resistor for target bias voltage">
            <View style={styles.calcInputRow}>
              <CalcInput label="Desired Ik per tube (mA)" value={state.cathBiasDesiredCurrent} onChange={set('cathBiasDesiredCurrent')} placeholder="e.g. 35" />
              <CalcInput label="Desired Vk (V)" value={state.cathBiasDesiredVk} onChange={set('cathBiasDesiredVk')} placeholder="e.g. 18" />
            </View>
            <View style={styles.calcInputGroup}>
              <Text style={styles.calcLabel}>Number of Tubes</Text>
              <View style={styles.tubeTypeRow}>
                {['1', '2', '4'].map((n) => (
                  <TouchableOpacity key={n} style={[styles.tubeTypeBtn, state.cathBiasNumTubes === n && styles.tubeTypeBtnActive]} onPress={() => set('cathBiasNumTubes')(n)}>
                    <Text style={[styles.tubeTypeBtnText, state.cathBiasNumTubes === n && styles.tubeTypeBtnTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {cathBias && (
              <Result>
                <ResultLine label="Total Cathode Current" value={\`\${cathBias.totalCurrent} mA\`} />
                <ResultLine label="Cathode Resistor" value={\`\${cathBias.resistance} ohms\`} />
                <ResultLine label="Power Dissipation" value={\`\${cathBias.power} W\`} />
                <ResultLine label="Use at least" value={\`\${cathBias.safeWattage}W resistor\`} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Current from Vk/Rk" desc="Estimate plate current from cathode measurements">
            <View style={styles.calcInputRow}>
              <CalcInput label="Measured Vk (V)" value={state.vkRkVk} onChange={set('vkRkVk')} placeholder="e.g. 18" />
              <CalcInput label="Cathode R (ohms)" value={state.vkRkRk} onChange={set('vkRkRk')} placeholder="e.g. 470" />
            </View>
            <CalcInput label="Screen Current (mA, optional)" value={state.vkRkScreenCurrent} onChange={set('vkRkScreenCurrent')} placeholder="e.g. 5" />
            {vkRk && (
              <Result>
                <ResultLine label="Cathode Current" value={\`\${vkRk.cathodeCurrent} mA\`} />
                <ResultLine label="Est. Plate Current" value={\`\${vkRk.plateCurrent} mA\`} />
                {vkRk.warning && <ResultLine label="Warning" value={vkRk.warning} color="#ef4444" />}
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Plate Dissipation" desc="Calculate tube power dissipation from V and I">
            <View style={styles.calcInputRow}>
              <CalcInput label="Plate Voltage (V)" value={state.plateVoltage} onChange={set('plateVoltage')} placeholder="e.g. 400" />
              <CalcInput label="Plate Current (mA)" value={state.plateCurrent} onChange={set('plateCurrent')} placeholder="e.g. 35" />
            </View>
            <CalcInput label="Screen Current (mA, optional)" value={state.screenCurrent} onChange={set('screenCurrent')} placeholder="e.g. 5" />
            {plateDiss && (
              <Result>
                <ResultLine label="Plate Dissipation" value={\`\${plateDiss.plate} W\`} />
                <ResultLine label="Total (with screen)" value={\`\${plateDiss.total} W\`} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      {/* ── Output Power and Load Matching ─────────────────────────────── */}
      <CategoryHeader id="output" icon="volume-high" title="Output Power and Load Matching" />
      {state.expandedCalcCategory === 'output' && (
        <View style={styles.calcCategoryContent}>
          <CalcCard title="Output Power from Vrms" desc="Measure Vrms at speaker jack with dummy load">
            <View style={styles.calcInputRow}>
              <CalcInput label="Vrms at Output" value={state.outputVrms} onChange={set('outputVrms')} placeholder="e.g. 20" />
              <CalcInput label="Load Impedance (ohms)" value={state.outputLoad} onChange={set('outputLoad')} placeholder="e.g. 8" />
            </View>
            {outputPower && (
              <Result>
                <ResultLine label="Output Power" value={\`\${outputPower.watts} W\`} />
                <ResultLine label="Peak Voltage" value={\`\${outputPower.vpeak} V\`} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Speaker Impedance Calculator" desc="Series/parallel speaker combinations">
            <View style={styles.calcInputRow}>
              <CalcInput label="Speaker 1 (ohms)" value={state.speaker1} onChange={set('speaker1')} placeholder="8" />
              <CalcInput label="Speaker 2 (ohms)" value={state.speaker2} onChange={set('speaker2')} placeholder="8" />
            </View>
            <View style={styles.calcInputRow}>
              <CalcInput label="Speaker 3 (optional)" value={state.speaker3} onChange={set('speaker3')} />
              <CalcInput label="Speaker 4 (optional)" value={state.speaker4} onChange={set('speaker4')} />
            </View>
            <View style={styles.calcInputGroup}>
              <Text style={styles.calcLabel}>Wiring</Text>
              <View style={styles.tubeTypeRow}>
                {WIRING_OPTIONS.map((w) => (
                  <TouchableOpacity key={w} style={[styles.tubeTypeBtn, state.speakerWiring === w && styles.tubeTypeBtnActive]} onPress={() => set('speakerWiring')(w)}>
                    <Text style={[styles.tubeTypeBtnText, state.speakerWiring === w && styles.tubeTypeBtnTextActive]}>{w === 'series-parallel' ? 'S/P' : w.charAt(0).toUpperCase() + w.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {speakerZ && (
              <Result>
                <ResultLine label="Total Load" value={\`\${speakerZ.total} ohms\`} />
                <ResultLine label="Recommended Tap" value={speakerZ.tap} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      {/* ── Power Supply and Safety ────────────────────────────────────── */}
      <CategoryHeader id="power" icon="battery-charging" title="Power Supply and Safety" />
      {state.expandedCalcCategory === 'power' && (
        <View style={styles.calcCategoryContent}>
          <CalcCard title="Dropping Resistor Calculator" desc="B+ voltage drop and power rating">
            <View style={styles.calcInputRow}>
              <CalcInput label="Desired Vdrop (V)" value={state.dropResVdrop} onChange={set('dropResVdrop')} placeholder="e.g. 50" />
              <CalcInput label="Current (mA)" value={state.dropResCurrent} onChange={set('dropResCurrent')} placeholder="e.g. 10" />
            </View>
            <CalcInput label="Or enter resistor value (ohms)" value={state.dropResValue} onChange={set('dropResValue')} placeholder="e.g. 10000" />
            {dropRes && (
              <Result>
                {dropRes.mode === 'fromDrop' && <ResultLine label="Needed Resistor" value={\`\${dropRes.neededRes} ohms\`} />}
                {dropRes.mode === 'fromRes' && <ResultLine label="Voltage Drop" value={\`\${dropRes.actualDrop} V\`} />}
                <ResultLine label="Power" value={\`\${dropRes.power} W\`} />
                <ResultLine label="Use at least" value={\`\${dropRes.safeWattage}W resistor\`} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Capacitor Discharge Time" desc="How long to wait before it's safe">
            <View style={styles.calcInputRow}>
              <CalcInput label="Capacitance (uF)" value={state.dischargeCap} onChange={set('dischargeCap')} placeholder="e.g. 47" />
              <CalcInput label="Start Voltage (V)" value={state.dischargeVstart} onChange={set('dischargeVstart')} placeholder="e.g. 450" />
            </View>
            <View style={styles.calcInputRow}>
              <CalcInput label="Target Voltage (V)" value={state.dischargeVtarget} onChange={set('dischargeVtarget')} placeholder="e.g. 50" />
              <CalcInput label="Discharge R (ohms)" value={state.dischargeRes} onChange={set('dischargeRes')} placeholder="e.g. 220000" />
            </View>
            {discharge && (
              <Result>
                <ResultLine label="Time to Target" value={\`\${discharge.timeToTarget} sec\`} />
                <ResultLine label="Initial Power" value={\`\${discharge.initialPower} W\`} />
                <ResultLine label="Stored Energy" value={\`\${discharge.energy} J\`} />
                <ResultLine label="Danger Level" value={discharge.dangerLevel} color={discharge.dangerLevel === 'LETHAL' ? '#ef4444' : discharge.dangerLevel === 'Dangerous' ? '#f59e0b' : '#22c55e'} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Filter RC Time Constant" desc="Calculate ripple filter effectiveness">
            <View style={styles.calcInputRow}>
              <CalcInput label="Capacitance (uF)" value={state.filterCapValue} onChange={set('filterCapValue')} placeholder="e.g. 47" />
              <CalcInput label="Resistance (ohms)" value={state.filterResValue} onChange={set('filterResValue')} placeholder="e.g. 1000" />
            </View>
            {filterRC && (
              <Result>
                <ResultLine label="Time Constant" value={\`\${filterRC.tau} ms\`} />
                <ResultLine label="-3dB Cutoff" value={\`\${filterRC.cutoff} Hz\`} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      {/* ── Frequency and Coupling ─────────────────────────────────────── */}
      <CategoryHeader id="frequency" icon="pulse" title="Frequency and Coupling" />
      {state.expandedCalcCategory === 'frequency' && (
        <View style={styles.calcCategoryContent}>
          <CalcCard title="Coupling Cap High-Pass Cutoff" desc="Why does it sound thin after a cap change?">
            <View style={styles.calcInputRow}>
              <CalcInput label="Coupling Cap (nF)" value={state.couplingCapValue} onChange={set('couplingCapValue')} placeholder="e.g. 22" />
              <CalcInput label="Grid Leak (kohms)" value={state.couplingGridLeak} onChange={set('couplingGridLeak')} placeholder="e.g. 1000" />
            </View>
            {coupling && (
              <Result>
                <ResultLine label="-3dB Cutoff" value={\`\${coupling.cutoff} Hz\`} />
                <ResultLine label="Bass Reference" value={coupling.bassNote} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Cathode Bypass Capacitor" desc="Size bypass cap for bass boost">
            <CalcInput label="Cathode Resistor (ohms)" value={state.cathodeResValue} onChange={set('cathodeResValue')} placeholder="e.g. 1500" />
            {bypass && (
              <Result>
                <ResultLine label="Full bypass (25Hz)" value={\`\${bypass.full} uF\`} />
                <ResultLine label="Partial bypass (100Hz)" value={\`\${bypass.partial} uF\`} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      {/* ── General Bench Math ─────────────────────────────────────────── */}
      <CategoryHeader id="general" icon="calculator" title="General Bench Math" />
      {state.expandedCalcCategory === 'general' && (
        <View style={styles.calcCategoryContent}>
          <CalcCard title="Ohm's Law + Power" desc="Enter any 2 values to calculate the others">
            <View style={styles.calcInputRow}>
              <CalcInput label="Voltage (V)" value={state.ohmV} onChange={set('ohmV')} />
              <CalcInput label="Current (mA)" value={state.ohmI} onChange={set('ohmI')} />
            </View>
            <CalcInput label="Resistance (ohms)" value={state.ohmR} onChange={set('ohmR')} />
            {ohms && (
              <Result>
                {ohms.v && <ResultLine label="Voltage" value={\`\${ohms.v} V\`} />}
                {ohms.i && <ResultLine label="Current" value={\`\${ohms.i} mA\`} />}
                {ohms.r && <ResultLine label="Resistance" value={\`\${ohms.r} ohms\`} />}
                {ohms.p && <ResultLine label="Power" value={\`\${ohms.p} W\`} />}
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Voltage Divider" desc="For bias feeds, NFB tweaks, etc.">
            <View style={styles.calcInputRow}>
              <CalcInput label="R1 (kohms)" value={state.dividerR1} onChange={set('dividerR1')} placeholder="e.g. 100" />
              <CalcInput label="R2 (kohms)" value={state.dividerR2} onChange={set('dividerR2')} placeholder="e.g. 47" />
            </View>
            <CalcInput label="Input Voltage (V)" value={state.dividerVin} onChange={set('dividerVin')} placeholder="e.g. 400" />
            {divider && (
              <Result>
                <ResultLine label="Output Voltage" value={\`\${divider.vout} V\`} />
                <ResultLine label="Ratio" value={\`\${divider.ratio}%\`} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 6. ArticlesTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/ArticlesTab.tsx'] = `import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { articlesApi } from '../../services/endpoints/reference';
import { showAlert, showError } from '../../utils/alert';
import { styles } from './referenceStyles';

interface ReferenceArticle {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  circuitFamily: string | null;
  createdAt: string;
}

export function ArticlesTab() {
  const router = useRouter();
  const [articles, setArticles] = useState<ReferenceArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const data = await articlesApi.list();
      setArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const article = await articlesApi.importFromUrl(importUrl.trim());
      setArticles([article, ...articles]);
      setShowImportModal(false);
      setImportUrl('');
      showAlert('Success', \`Imported: \${article.title}\`);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to import article');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await articlesApi.delete(id);
      setArticles(articles.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  };

  return (
    <>
      <ScrollView style={styles.articlesContainer}>
        <View style={styles.articlesHeader}>
          <View>
            <Text style={styles.sectionTitle}>Reference Articles</Text>
            <Text style={styles.sectionSubtitle}>Imported from robrobinette.com</Text>
          </View>
          <TouchableOpacity style={styles.importButton} onPress={() => setShowImportModal(true)}>
            <Ionicons name="add" size={20} color="#1f2937" />
            <Text style={styles.importButtonText}>Import</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading articles...</Text>
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#374151" />
            <Text style={styles.emptyTitle}>No Articles Yet</Text>
            <Text style={styles.emptySubtitle}>Import technical articles from robrobinette.com</Text>
            <TouchableOpacity style={styles.emptyImportButton} onPress={() => setShowImportModal(true)}>
              <Ionicons name="cloud-download-outline" size={20} color="#f59e0b" />
              <Text style={styles.emptyImportText}>Import Your First Article</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.articlesList}>
            {articles.map((article) => (
              <TouchableOpacity key={article.id} style={styles.articleCard} onPress={() => router.push(\`/article/\${article.id}\` as any)}>
                <View style={styles.articleContent}>
                  <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                  <View style={styles.articleMeta}>
                    {article.circuitFamily && (
                      <View style={styles.circuitBadge}>
                        <Text style={styles.circuitBadgeText}>{article.circuitFamily}</Text>
                      </View>
                    )}
                    <Text style={styles.articleSource}>via {article.sourceName}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(article.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.creditSection}>
          <TouchableOpacity onPress={() => Linking.openURL('https://robrobinette.com')}>
            <Text style={styles.creditText}>Content sourced from <Text style={styles.creditLink}>robrobinette.com</Text></Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showImportModal} transparent animationType="fade" onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Article</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Paste URL from robrobinette.com</Text>
            <TextInput style={styles.modalInput} value={importUrl} onChangeText={setImportUrl} placeholder="https://robrobinette.com/..." placeholderTextColor="#6b7280" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.modalHint}>Example: https://robrobinette.com/How_The_AB763_Deluxe_Reverb_Works.htm</Text>
            <TouchableOpacity style={[styles.modalButton, importing && styles.modalButtonDisabled]} onPress={handleImport} disabled={importing || !importUrl.trim()}>
              {importing ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="cloud-download" size={20} color="#1f2937" />
                  <Text style={styles.modalButtonText}>Import Article</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 7. TavaTab.tsx
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/TavaTab.tsx'] = `import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { podcastApi } from '../../services/endpoints/reference';
import { showAlert, showError } from '../../utils/alert';
import { styles } from './referenceStyles';

interface PodcastTopic {
  id: string;
  topic: string;
  timestamp: string | null;
  timestampSeconds: number | null;
  circuitFamily: string | null;
  episodeNumber: number;
  episodeTitle: string;
  episodeUrl: string;
}

export function TavaTab() {
  const [topics, setTopics] = useState<PodcastTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastTopic[]>([]);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const data = await podcastApi.listTopics();
      setTopics(data);
    } catch (error) {
      console.error('Error fetching podcast topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await podcastApi.search(query);
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching podcast:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await podcastApi.sync();
      fetchTopics();
      const msg = result.newEpisodes > 0
        ? \`Added \${result.newEpisodes} new episodes! Total: \${result.totalEpisodes} episodes, \${result.totalTopics} topics\`
        : \`Already up to date: \${result.totalEpisodes} episodes, \${result.totalTopics} topics\`;
      showAlert('Sync Complete', msg);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to sync podcast data');
    } finally {
      setSyncing(false);
    }
  };

  const toggleEpisode = (episodeNumber: number) => {
    setExpandedEpisodes(prev => {
      const newSet = new Set(prev);
      newSet.has(episodeNumber) ? newSet.delete(episodeNumber) : newSet.add(episodeNumber);
      return newSet;
    });
  };

  const topicsToShow = search.trim() ? searchResults : topics;
  const groupedByEpisode = topicsToShow.reduce((acc, topic) => {
    const epKey = \`\${topic.episodeNumber}-\${topic.episodeTitle}\`;
    if (!acc[epKey]) {
      acc[epKey] = { episodeNumber: topic.episodeNumber, episodeTitle: topic.episodeTitle, episodeUrl: topic.episodeUrl, topics: [] };
    }
    acc[epKey].topics.push(topic);
    return acc;
  }, {} as Record<string, { episodeNumber: number; episodeTitle: string; episodeUrl: string; topics: PodcastTopic[] }>);

  const episodes = Object.values(groupedByEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber);
  const isSearching = search.trim().length > 0;

  return (
    <ScrollView style={styles.tavaContainer}>
      <View style={styles.tavaHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>TAVA Podcast Index</Text>
          <Text style={styles.sectionSubtitle}>The Truth About Vintage Amps</Text>
        </View>
        <TouchableOpacity style={[styles.syncButton, syncing && styles.syncButtonDisabled]} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator size="small" color="#1f2937" /> : <Ionicons name="refresh" size={18} color="#1f2937" />}
          <Text style={styles.syncButtonText}>{syncing ? 'Syncing...' : 'Check Updates'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.podcastSearchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.podcastSearchInput} placeholder="Search topics..." placeholderTextColor="#6b7280" value={search} onChangeText={handleSearch} />
        {searching && <ActivityIndicator size="small" color="#f59e0b" />}
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading podcast topics...</Text>
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mic-outline" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>{search.trim() ? 'No Results' : 'No Episodes Yet'}</Text>
          <Text style={styles.emptySubtitle}>{search.trim() ? \`No topics match "\${search}"\` : 'Tap "Check Updates" to sync episodes'}</Text>
        </View>
      ) : (
        <View style={styles.episodesList}>
          {episodes.map((ep) => {
            const isExpanded = isSearching || expandedEpisodes.has(ep.episodeNumber);
            return (
              <View key={\`ep-\${ep.episodeNumber}\`} style={styles.episodeCard}>
                <TouchableOpacity style={styles.episodeHeader} onPress={() => toggleEpisode(ep.episodeNumber)}>
                  <View style={styles.episodeNumberBadge}>
                    <Text style={styles.episodeNumberText}>#{ep.episodeNumber}</Text>
                  </View>
                  <Text style={styles.episodeTitleText} numberOfLines={2}>{ep.episodeTitle}</Text>
                  <View style={styles.episodeHeaderIcons}>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); Linking.openURL(ep.episodeUrl); }} style={styles.openLinkButton}>
                      <Ionicons name="open-outline" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.topicsList}>
                    {ep.topics.map((topic) => (
                      <View key={topic.id} style={styles.topicItem}>
                        {topic.timestamp && <Text style={styles.topicTimestamp}>{topic.timestamp}</Text>}
                        <Text style={styles.topicText}>{topic.topic}</Text>
                        {topic.circuitFamily && (
                          <View style={styles.circuitBadge}>
                            <Text style={styles.circuitBadgeText}>{topic.circuitFamily}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.creditSection}>
        <TouchableOpacity onPress={() => Linking.openURL('https://fretboardjournal.com/the-truth-about-vintage-amps-podcast/')}>
          <Text style={styles.creditText}>Podcast from <Text style={styles.creditLink}>The Fretboard Journal</Text></Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 8. Barrel export
// ─────────────────────────────────────────────────────────────────────────────
files['app/components/reference/index.ts'] = `export { FlowchartsTab } from './FlowchartsTab';
export { VoltagesTab } from './VoltagesTab';
export { CalculatorTab } from './CalculatorTab';
export { ArticlesTab } from './ArticlesTab';
export { TavaTab } from './TavaTab';
`;

// ─────────────────────────────────────────────────────────────────────────────
// 9. New reference-refactored.tsx — thin orchestrator (~80 lines)
// ─────────────────────────────────────────────────────────────────────────────
files['app/(tabs)/reference-refactored.tsx'] = `import React, { useState } from 'react';
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
`;

// ─────────────────────────────────────────────────────────────────────────────
// Write all files
// ─────────────────────────────────────────────────────────────────────────────
let created = 0;
for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
  created++;
  console.log(`  ✅ ${filePath}`);
}

console.log(`\n✅ Phase 3a complete — ${created} files created`);
console.log(`\n📊 reference.tsx: 2,448 lines → split into ${created} focused files`);
console.log(`\n🔄 To activate the refactored version:`);
console.log(`  mv "app/(tabs)/reference.tsx" "app/(tabs)/reference-old.tsx"`);
console.log(`  mv "app/(tabs)/reference-refactored.tsx" "app/(tabs)/reference.tsx"`);
console.log(`\n📋 Next: Phase 3b will refactor index.tsx, jobs.tsx, job/[id].tsx, etc.`);
