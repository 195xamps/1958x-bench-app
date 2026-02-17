export interface MeasurementNode {
  name: string;
  description: string;
  unit: string;
  meterMode: string;
  expectedMin?: number;
  expectedMax?: number;
}

export interface MeasurementCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  nodes: MeasurementNode[];
}

export const MEASUREMENT_CATEGORIES: MeasurementCategory[] = [
  {
    id: 'safety', title: '1. Safety & Baseline', icon: 'shield-checkmark', description: 'First checks to prevent mistakes',
    nodes: [
      { name: 'Mains VAC', description: 'Wall voltage', unit: 'V', meterMode: 'AC Volts', expectedMin: 115, expectedMax: 125 },
      { name: 'Earth\u2192Chassis \u03A9', description: '3-prong cord integrity', unit: 'ohms', meterMode: 'Ohms', expectedMin: 0, expectedMax: 1 },
      { name: 'Speaker DCR', description: 'Speaker DC resistance', unit: 'ohms', meterMode: 'Ohms', expectedMin: 4, expectedMax: 16 },
    ],
  },
  {
    id: 'pt_secondaries', title: '2. PT Secondaries (VAC)', icon: 'flash', description: 'Power transformer outputs',
    nodes: [
      { name: 'Heater VAC', description: 'Tube heater voltage', unit: 'V', meterMode: 'AC Volts', expectedMin: 6.0, expectedMax: 6.6 },
      { name: 'PT HT VAC', description: 'High tension secondary', unit: 'V', meterMode: 'AC Volts' },
      { name: 'PT Bias VAC', description: 'Bias tap secondary', unit: 'V', meterMode: 'AC Volts' },
      { name: '5VAC Rectifier', description: 'Rectifier heater', unit: 'V', meterMode: 'AC Volts', expectedMin: 4.8, expectedMax: 5.2 },
    ],
  },
  {
    id: 'b_plus', title: '3. B+ Rail & Ripple', icon: 'battery-charging', description: 'Power quality map',
    nodes: [
      { name: 'B+0', description: 'Rectifier output', unit: 'V', meterMode: 'DC Volts' },
      { name: 'B+1', description: 'First filter cap', unit: 'V', meterMode: 'DC Volts' },
      { name: 'B+2', description: 'Second filter cap', unit: 'V', meterMode: 'DC Volts' },
      { name: 'B+3', description: 'Third filter cap', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Ripple B+1', description: 'Ripple at first node', unit: 'mV', meterMode: 'mV AC', expectedMin: 0, expectedMax: 50 },
      { name: 'Ripple B+2', description: 'Ripple at second node', unit: 'mV', meterMode: 'mV AC', expectedMin: 0, expectedMax: 20 },
      { name: 'Dropper \u0394V', description: 'Voltage drop across choke/resistor', unit: 'V', meterMode: 'DC Volts' },
    ],
  },
  {
    id: 'output_stage', title: '4. Output Stage', icon: 'volume-high', description: 'Power tubes operating point',
    nodes: [
      { name: 'Power Plate V', description: 'Power tube plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Power Screen V', description: 'Power tube screen voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Power Grid V', description: 'Control grid bias (neg)', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Power Cathode V', description: 'Cathode bias voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Bias mA', description: 'Bias current', unit: 'mA', meterMode: 'DC Volts' },
      { name: 'Dissipation W', description: 'Plate dissipation (calculated)', unit: 'W', meterMode: 'DC Volts' },
    ],
  },
  {
    id: 'phase_inverter', title: '5. Phase Inverter', icon: 'git-compare', description: 'PI operating point',
    nodes: [
      { name: 'PI Plate 1', description: 'PI first plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'PI Plate 2', description: 'PI second plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'PI Cathode', description: 'PI cathode/tail voltage', unit: 'V', meterMode: 'DC Volts' },
    ],
  },
  {
    id: 'preamp', title: '6. Preamp Triodes', icon: 'radio', description: 'Preamp stage DC checks',
    nodes: [
      { name: 'V1A Plate', description: 'V1A plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'V1A Cathode', description: 'V1A cathode voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'V1B Plate', description: 'V1B plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'V1B Cathode', description: 'V1B cathode voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'V2A Plate', description: 'V2A plate voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'V2A Cathode', description: 'V2A cathode voltage', unit: 'V', meterMode: 'DC Volts' },
      { name: 'Preamp Grid DC', description: 'Grid DC (leaky cap check)', unit: 'V', meterMode: 'DC Volts', expectedMin: -0.5, expectedMax: 0.5 },
    ],
  },
  {
    id: 'resistance', title: '7. Power-Off Resistance', icon: 'construct', description: 'Safe resistance checks',
    nodes: [
      { name: 'OT Pri DCR A-CT', description: 'Output transformer primary A to CT', unit: 'ohms', meterMode: 'Ohms' },
      { name: 'OT Pri DCR B-CT', description: 'Output transformer primary B to CT', unit: 'ohms', meterMode: 'Ohms' },
      { name: 'OT Sec DCR', description: 'Output transformer secondary', unit: 'ohms', meterMode: 'Ohms' },
      { name: 'PT HV DCR', description: 'Power transformer HV winding', unit: 'ohms', meterMode: 'Ohms' },
      { name: 'Bleeder \u03A9', description: 'Bleeder resistor value', unit: 'k-ohms', meterMode: 'Ohms' },
      { name: 'Input Jack Switch', description: 'Input jack switching continuity', unit: 'ohms', meterMode: 'Continuity' },
    ],
  },
  {
    id: 'output_performance', title: '8. Output Performance', icon: 'pulse', description: 'Health checks without scope',
    nodes: [
      { name: 'Output Hum mV', description: 'Idle hum at speaker jack', unit: 'mV', meterMode: 'mV AC', expectedMin: 0, expectedMax: 50 },
      { name: 'Output Vrms @1kHz', description: 'Output with 1kHz test tone', unit: 'V', meterMode: 'AC Volts' },
      { name: 'Output Power W', description: 'Calculated output power', unit: 'W', meterMode: 'AC Volts' },
    ],
  },
];
