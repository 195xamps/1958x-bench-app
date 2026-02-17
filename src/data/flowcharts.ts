export interface FlowchartNode {
  id: string;
  question?: string;
  yesNext?: string;
  noNext?: string;
  result?: string;
  tip?: string;
}

export interface Flowchart {
  id: string;
  name: string;
  symptom: string;
  startNode: string;
  nodes: Record<string, FlowchartNode>;
}

export const FLOWCHARTS: Flowchart[] = [
  {
    id: 'no-output',
    name: 'No Output',
    symptom: 'Amp powers on but no sound from speaker',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the pilot light come on?', yesNext: 'tubes-glow', noNext: 'check-fuse' },
      'check-fuse': { id: 'check-fuse', question: 'Is the fuse intact?', yesNext: 'check-power-cord', noNext: 'fuse-blown' },
      'fuse-blown': { id: 'fuse-blown', result: 'Replace fuse. If it blows again, check rectifier and filter caps for shorts.', tip: 'A blown fuse often indicates a shorted rectifier tube or filter capacitor.' },
      'check-power-cord': { id: 'check-power-cord', result: 'Check power cord continuity and wall outlet. Verify power transformer primary.', tip: 'Use a multimeter to check for AC at the transformer primary.' },
      'tubes-glow': { id: 'tubes-glow', question: 'Do all tubes have heater glow (orange)?', yesNext: 'speaker-check', noNext: 'heater-issue' },
      'heater-issue': { id: 'heater-issue', result: 'Check heater wiring and heater voltage (should be ~6.3VAC). Replace non-glowing tubes.', tip: 'No heater glow = open heater. Check tube pins and socket contacts.' },
      'speaker-check': { id: 'speaker-check', question: 'Do you hear any hum or hiss from the speaker?', yesNext: 'preamp-issue', noNext: 'output-stage' },
      'output-stage': { id: 'output-stage', question: 'Is there B+ voltage at the output tube plates (250-450VDC typical)?', yesNext: 'output-tubes', noNext: 'power-supply' },
      'power-supply': { id: 'power-supply', result: 'Check rectifier tube/diodes and filter capacitors. Verify transformer secondary voltages.', tip: 'No B+ usually means rectifier failure or open filter cap.' },
      'output-tubes': { id: 'output-tubes', result: 'Swap output tubes with known good ones. Check output transformer primary and screen resistors.', tip: 'Bad output tubes or open screen resistors are common causes.' },
      'preamp-issue': { id: 'preamp-issue', question: 'Does tapping the first preamp tube (V1) produce sound?', yesNext: 'signal-trace', noNext: 'v1-check' },
      'v1-check': { id: 'v1-check', result: 'Replace V1 tube. Check V1 plate resistor and coupling cap to next stage.', tip: 'V1 is the most common tube failure point.' },
      'signal-trace': { id: 'signal-trace', result: 'Signal is reaching preamp. Trace signal stage-by-stage using audio probe or scope. Check coupling caps and plate resistors.', tip: 'Inject signal at each stage and listen for output.' },
    },
  },
  {
    id: 'hum',
    name: 'Excessive Hum',
    symptom: '60Hz or 120Hz hum from speaker',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the hum change when you turn the volume control?', yesNext: 'preamp-hum', noNext: 'power-supply-hum' },
      'preamp-hum': { id: 'preamp-hum', question: 'Does the hum stop when you ground the input jack?', yesNext: 'input-stage', noNext: 'preamp-supply' },
      'input-stage': { id: 'input-stage', result: 'Hum is being picked up at input. Check input jack grounding, cable, and V1 heater dress.', tip: 'Heater wires should be twisted and routed away from signal wiring.' },
      'preamp-supply': { id: 'preamp-supply', result: 'Check preamp B+ filter caps. Replace if ESR is high or capacitance is low.', tip: 'Old electrolytics are the #1 cause of hum in vintage amps.' },
      'power-supply-hum': { id: 'power-supply-hum', question: 'Is the hum a low 60Hz buzz or a higher 120Hz buzz?', yesNext: 'hum-60hz', noNext: 'hum-120hz' },
      'hum-60hz': { id: 'hum-60hz', result: '60Hz hum indicates heater-to-cathode leakage or bad grounding. Check tubes, heater elevation, and ground scheme.', tip: 'Try a heater elevation resistor network or replace tubes.' },
      'hum-120hz': { id: 'hum-120hz', result: '120Hz hum indicates filter cap failure. Replace main filter capacitors.', tip: '120Hz = full-wave rectified AC ripple. Caps are definitely suspect.' },
    },
  },
  {
    id: 'distortion',
    name: 'Unwanted Distortion',
    symptom: 'Amp distorts at low volume or sounds harsh',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the distortion happen on all inputs/channels?', yesNext: 'all-channels', noNext: 'single-channel' },
      'single-channel': { id: 'single-channel', result: 'Problem is in one channel. Check tubes, coupling caps, and resistors in that channel only.', tip: 'Swap tubes between channels to isolate the problem.' },
      'all-channels': { id: 'all-channels', question: 'Is the distortion present even with the volume at minimum?', yesNext: 'output-issue', noNext: 'preamp-issue' },
      'output-issue': { id: 'output-issue', question: 'Are the output tubes biased correctly?', yesNext: 'ot-check', noNext: 'bias-fix' },
      'bias-fix': { id: 'bias-fix', result: 'Rebias the output tubes. Cold bias causes crossover distortion, hot bias causes excessive distortion.', tip: 'Target 60-70% of max plate dissipation for most designs.' },
      'ot-check': { id: 'ot-check', result: 'Check output transformer for shorted turns. Check screen resistors and coupling caps to output tubes.', tip: 'A scope comparing input to output can reveal waveform clipping.' },
      'preamp-issue': { id: 'preamp-issue', question: 'Does the distortion clear up with fresh preamp tubes?', yesNext: 'bad-tube', noNext: 'component-check' },
      'bad-tube': { id: 'bad-tube', result: 'Replace the faulty preamp tube. Mark it and set aside for testing later.', tip: 'Microphonic or gassy tubes cause distortion.' },
      'component-check': { id: 'component-check', result: 'Check coupling caps for leakage (causes DC on grids). Check plate and cathode resistors for drift.', tip: 'A leaky coupling cap is a very common cause of distortion.' },
    },
  },
  {
    id: 'intermittent',
    name: 'Intermittent Problems',
    symptom: 'Sound cuts out, crackles, or changes randomly',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does tapping the chassis or tubes affect the problem?', yesNext: 'mechanical', noNext: 'thermal' },
      'mechanical': { id: 'mechanical', question: 'Does tapping a specific tube cause the problem?', yesNext: 'bad-tube', noNext: 'connection-issue' },
      'bad-tube': { id: 'bad-tube', result: 'Replace the microphonic or intermittent tube.', tip: 'Tap each tube gently with a chopstick while amp is on to identify the culprit.' },
      'connection-issue': { id: 'connection-issue', result: 'Check tube sockets, jacks, solder joints, and wire connections. Resolder any cold or cracked joints.', tip: 'Look for dull, grainy solder joints. Reflow with fresh solder.' },
      'thermal': { id: 'thermal', question: 'Does the problem appear after the amp warms up?', yesNext: 'thermal-component', noNext: 'cold-failure' },
      'thermal-component': { id: 'thermal-component', result: 'Use freeze spray to cool suspected components while amp is failing. When sprayed component fixes issue, you found it.', tip: 'Resistors and caps can fail when hot. Cool them one at a time.' },
      'cold-failure': { id: 'cold-failure', result: 'Use a heat gun or hair dryer to warm components. Problem may be a cold solder joint or cracked component.', tip: 'Flex the PCB gently while listening for changes.' },
    },
  },
];
