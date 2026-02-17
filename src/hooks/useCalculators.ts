import { useState } from 'react';

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
    if (speakers.length === 1) return { total: speakers[0].toFixed(1), tap: `${speakers[0]}Ω` };
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
    return { total: total.toFixed(1), tap: `${recommendedTap}Ω` };
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
