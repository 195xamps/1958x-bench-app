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
  {
    id: 'fuse-blows',
    name: 'Fuse Blows',
    symptom: 'Fuse blows immediately or after a few seconds',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the fuse blow the instant you flip the power switch?', yesNext: 'instant-blow', noNext: 'delayed-blow' },
      'instant-blow': { id: 'instant-blow', question: 'With all tubes removed, does the fuse still blow?', yesNext: 'wiring-short', noNext: 'tube-short' },
      'wiring-short': { id: 'wiring-short', result: 'Short circuit in the power transformer primary, power switch wiring, or mains wiring. Check for pinched wires, shorted filter caps, or a failed power transformer.', tip: 'Disconnect the PT primary leads and check continuity to chassis ground. Any reading below 100Ω is a short.' },
      'tube-short': { id: 'tube-short', question: 'Does the fuse blow with only the rectifier tube installed?', yesNext: 'rectifier-short', noNext: 'power-tube-short' },
      'rectifier-short': { id: 'rectifier-short', result: 'Rectifier tube is shorted internally, or a filter cap is shorted to ground. Replace the rectifier and check main filter caps with a meter.', tip: 'Disconnect one end of the first filter cap and re-test. If the fuse holds, the cap was the problem.' },
      'power-tube-short': { id: 'power-tube-short', result: 'One or more power tubes have an internal short. Insert them one at a time to find the faulty tube. Also check screen resistors.', tip: 'A shorted power tube often takes out the screen resistor. Always check both.' },
      'delayed-blow': { id: 'delayed-blow', question: 'Does it blow after 30-60 seconds (about when B+ comes up)?', yesNext: 'b-plus-short', noNext: 'load-issue' },
      'b-plus-short': { id: 'b-plus-short', result: 'Excessive current draw once B+ is present. Check for shorted filter caps, output tube bias runaway, or a failed output transformer.', tip: 'Measure B+ current with a series ammeter. Normal idle is 100-200mA for most amps.' },
      'load-issue': { id: 'load-issue', question: 'Is a speaker connected and working?', yesNext: 'thermal-failure', noNext: 'no-load' },
      'no-load': { id: 'no-load', result: '⚠️ Running a tube amp without a speaker load can destroy the output transformer. Connect a proper load and re-test.', tip: 'Always connect a speaker or dummy load before powering on a tube amp.' },
      'thermal-failure': { id: 'thermal-failure', result: 'Component is failing under heat. Use lower-value slow-blow fuse temporarily and monitor current draw. Check output tubes, bias circuit, and filter caps.', tip: 'A variac (variable transformer) lets you bring up voltage slowly and catch the failure before the fuse blows.' },
    },
  },
  {
    id: 'biasing',
    name: 'Biasing Problems',
    symptom: 'Output tubes running too hot or too cold',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Is this a fixed-bias or cathode-bias amp?', yesNext: 'fixed-bias', noNext: 'cathode-bias' },
      'fixed-bias': { id: 'fixed-bias', question: 'Is there negative voltage at the bias test point (-30 to -60V typical)?', yesNext: 'bias-voltage-ok', noNext: 'no-bias-voltage' },
      'no-bias-voltage': { id: 'no-bias-voltage', result: 'Bias supply is dead. Check the bias rectifier diode, bias filter cap, and the bias tap on the power transformer.', tip: 'No bias voltage = tubes run wide open and will red-plate immediately. Do not leave the amp on.' },
      'bias-voltage-ok': { id: 'bias-voltage-ok', question: 'Is the idle plate current within the target range (60-70% of max dissipation)?', yesNext: 'bias-correct', noNext: 'bias-adjust' },
      'bias-correct': { id: 'bias-correct', result: 'Bias is set correctly. If tubes still seem hot, check for oscillation at the output (use a scope). Also verify the B+ voltage is within spec.', tip: 'Parasitic oscillation can cause excess dissipation even with correct bias.' },
      'bias-adjust': { id: 'bias-adjust', question: 'Is the current too high (tubes running hot/red plating)?', yesNext: 'too-hot', noNext: 'too-cold' },
      'too-hot': { id: 'too-hot', result: 'Increase negative bias voltage (more negative = less current). If the bias pot is maxed out, check for a leaky coupling cap feeding DC to the output tube grids.', tip: 'A leaky coupling cap is the #1 cause of bias that won\'t adjust cold enough.' },
      'too-cold': { id: 'too-cold', result: 'Decrease negative bias voltage (less negative = more current). If adjusting doesn\'t help, check for mismatched tubes or a weak tube.', tip: 'Crossover distortion at low volume is a classic sign of too-cold bias.' },
      'cathode-bias': { id: 'cathode-bias', question: 'Is the cathode voltage within expected range (typically 15-25V for a pair of 6V6s)?', yesNext: 'cathode-ok', noNext: 'cathode-problem' },
      'cathode-ok': { id: 'cathode-ok', result: 'Cathode bias is self-adjusting. If dissipation seems high, check for matched tubes and verify the cathode resistor value hasn\'t drifted.', tip: 'Cathode-biased amps are more tolerant of tube mismatch but still benefit from matched pairs.' },
      'cathode-problem': { id: 'cathode-problem', result: 'Check the cathode resistor value (may have drifted high or low). Also check the bypass cap for shorts. A shorted bypass cap removes the bias altogether.', tip: 'Measure the cathode resistor out of circuit for accurate reading.' },
    },
  },
  {
    id: 'reverb-issues',
    name: 'Reverb Issues',
    symptom: 'Reverb not working, weak, or making noise',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the reverb control affect the sound at all?', yesNext: 'weak-reverb', noNext: 'no-reverb' },
      'no-reverb': { id: 'no-reverb', question: 'With reverb on full, does tapping the reverb tank make a crash sound through the speaker?', yesNext: 'drive-side', noNext: 'recovery-side' },
      'recovery-side': { id: 'recovery-side', question: 'Is the reverb recovery tube working (check for heater glow and plate voltage)?', yesNext: 'tank-recovery', noNext: 'recovery-tube' },
      'recovery-tube': { id: 'recovery-tube', result: 'Replace the reverb recovery tube. Check its plate resistor and cathode components.', tip: 'The recovery tube is typically the second half of a 12AX7 or 12AT7.' },
      'tank-recovery': { id: 'tank-recovery', result: 'Check the reverb tank output cable and jacks. The RCA connectors corrode over time. Also check tank spring continuity with a meter.', tip: 'Unplug the tank output cable and touch the center pin — you should hear a pop if the recovery circuit is working.' },
      'drive-side': { id: 'drive-side', result: 'Recovery side works. Problem is in the reverb driver. Check the drive tube, drive transformer, and the cable from the drive circuit to the tank input.', tip: 'Reverb drive transformers rarely fail. Start with the tube and cables.' },
      'weak-reverb': { id: 'weak-reverb', question: 'Are the reverb tank springs intact and not touching each other?', yesNext: 'tank-ok', noNext: 'tank-damage' },
      'tank-damage': { id: 'tank-damage', result: 'Replace or repair the reverb tank. Bent or touching springs cause weak or distorted reverb.', tip: 'Reverb tanks are impedance-matched. Replace with the same input/output impedance rating (check the Accutronics number).' },
      'tank-ok': { id: 'tank-ok', result: 'Check the reverb drive tube for weakness. Try a fresh 12AT7. Also check the reverb level pot for corrosion and clean with contact cleaner.', tip: 'A weak drive tube is the most common cause of low reverb volume.' },
    },
  },
  {
    id: 'oscillation',
    name: 'Oscillation / Squealing',
    symptom: 'Amp squeals, oscillates, or makes unwanted high-pitched noise',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does the oscillation happen only at high volume settings?', yesNext: 'high-volume', noNext: 'all-volumes' },
      'high-volume': { id: 'high-volume', question: 'Does it stop when you touch the chassis or a tube shield?', yesNext: 'grounding', noNext: 'feedback-loop' },
      'grounding': { id: 'grounding', result: 'Grounding issue. Check the ground bus, star ground point, and verify input jacks are grounded to chassis. Check for lifted ground wires.', tip: 'Vintage amps often develop ground issues as solder joints age. Reflow the ground bus.' },
      'feedback-loop': { id: 'feedback-loop', result: 'Positive feedback is overwhelming the negative feedback loop. Check NFB resistor value, output transformer phasing, and speaker wiring polarity.', tip: 'Disconnect the NFB loop temporarily. If oscillation stops, the loop is wired with wrong polarity.' },
      'all-volumes': { id: 'all-volumes', question: 'Is the oscillation a steady high-pitched tone (not related to playing)?', yesNext: 'parasitic', noNext: 'mechanical' },
      'parasitic': { id: 'parasitic', question: 'Does it stop when you pull one of the preamp tubes?', yesNext: 'preamp-osc', noNext: 'power-osc' },
      'preamp-osc': { id: 'preamp-osc', result: 'Parasitic oscillation in a preamp stage. Check for open grid-stopper resistors, dress signal wires away from B+ wires, and try a different tube.', tip: 'Add 1kΩ grid-stopper resistors if none exist. Keep plate and grid wiring on opposite sides of the tube socket.' },
      'power-osc': { id: 'power-osc', result: 'Power stage oscillation. Check screen bypass caps, output tube grid-stopper resistors, and look for parasitic suppressors (10Ω + 100pF on plates). Verify output transformer is not open.', tip: 'A scope on the output will show the oscillation waveform and help identify its frequency.' },
      'mechanical': { id: 'mechanical', result: 'Likely acoustic feedback from speaker to tubes (microphonic tubes). Replace suspect tubes, especially V1. Add tube dampeners if available.', tip: 'Microphonic feedback usually gets worse as the amp warms up and often stops when you cover the speaker.' },
    },
  },
  {
    id: 'microphonic',
    name: 'Microphonic Tubes',
    symptom: 'Ringing, feedback, or howl when tapping the amp',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Does tapping the amp chassis produce a ringing or howling sound through the speaker?', yesNext: 'which-tube', noNext: 'not-microphonic' },
      'not-microphonic': { id: 'not-microphonic', result: 'Likely not a microphonic tube issue. Check for loose hardware, speaker rattle, or acoustic feedback from the room.', tip: 'Loose transformer laminations or mounting bolts can vibrate and cause noise.' },
      'which-tube': { id: 'which-tube', question: 'Does tapping individual tubes (gently, with a pencil) isolate the ringing to one tube?', yesNext: 'found-tube', noNext: 'multiple-tubes' },
      'found-tube': { id: 'found-tube', question: 'Is it the first preamp tube (V1)?', yesNext: 'v1-replace', noNext: 'other-tube' },
      'v1-replace': { id: 'v1-replace', result: 'Replace V1 with a known low-microphonic tube. V1 is the most sensitive position — any microphonic behavior is amplified by every stage after it.', tip: 'Tubes marketed as "low noise" or "selected for V1" are tested for microphonics. Worth the premium in this position.' },
      'other-tube': { id: 'other-tube', result: 'Replace the microphonic tube. Later preamp positions and phase inverter tubes can also be microphonic, just less noticeably than V1.', tip: 'Mark the bad tube so you don\'t accidentally reuse it.' },
      'multiple-tubes': { id: 'multiple-tubes', result: 'Multiple microphonic tubes, or the chassis itself is resonating. Try replacing all preamp tubes. If that doesn\'t fix it, check tube socket tension (loose sockets amplify vibration) and add tube dampeners.', tip: 'Silicone tube dampening rings are cheap and effective at reducing microphonic feedback.' },
    },
  },
  {
    id: 'weak-thin',
    name: 'Weak / Thin Sound',
    symptom: 'Amp lacks power, sounds thin, weak bass, or compressed',
    startNode: 'start',
    nodes: {
      start: { id: 'start', question: 'Has the amp always sounded this way, or did it change recently?', yesNext: 'always-weak', noNext: 'recent-change' },
      'always-weak': { id: 'always-weak', question: 'Is the speaker the correct impedance for the amp\'s output?', yesNext: 'speaker-match', noNext: 'impedance-mismatch' },
      'impedance-mismatch': { id: 'impedance-mismatch', result: 'Impedance mismatch between amp and speaker reduces power transfer and can sound thin or weak. Match the speaker impedance to the amp\'s output tap.', tip: 'A 2:1 mismatch (e.g. 8Ω speaker on 4Ω tap) is usually safe but loses ~25% power. Greater mismatches risk OT damage.' },
      'speaker-match': { id: 'speaker-match', result: 'Check the speaker itself — cone tears, voice coil rub, or a tired speaker can cause thin sound. Also verify the amp design matches your expectations (a 5W Champ won\'t sound like a Twin).', tip: 'Cup your ear to the speaker while playing. Listen for rattles, rubbing, or distortion at the cone.' },
      'recent-change': { id: 'recent-change', question: 'Are the output tubes more than 1-2 years old or heavily used?', yesNext: 'tired-tubes', noNext: 'component-check' },
      'tired-tubes': { id: 'tired-tubes', result: 'Replace the output tubes with a fresh matched pair/quad. Tired output tubes lose emission and can\'t deliver full power. Rebias after replacement.', tip: 'If the amp sounds dramatically better with new tubes, the old ones were the problem. Test them on a tube tester if available.' },
      'component-check': { id: 'component-check', question: 'Is the B+ voltage within expected range for this amp?', yesNext: 'b-plus-ok', noNext: 'low-b-plus' },
      'low-b-plus': { id: 'low-b-plus', result: 'Low B+ means weak output. Check the rectifier tube/diodes, wall voltage (should be 120VAC), and filter caps. Sagging filter caps reduce B+ under load.', tip: 'Measure B+ at idle AND while playing a note. If it drops more than 10-15V, filter caps are suspect.' },
      'b-plus-ok': { id: 'b-plus-ok', result: 'Check coupling caps for leakage (causes bias shift). Check the phase inverter tube and balance. Verify the negative feedback loop is intact (disconnected NFB causes loose, unfocused sound).', tip: 'A scope is the best tool here — compare signal levels stage by stage to find where the gain drops.' },
    },
  },
];
