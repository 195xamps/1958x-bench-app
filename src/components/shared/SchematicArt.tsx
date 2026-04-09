import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

// Minimalist line-art illustrations that evoke schematic/bench imagery.
// Used in empty states to reinforce the 195x brand instead of generic
// Ionicons. Built entirely with Views — no SVG dependency needed.
//
// Each illustration is ~80×80px and uses the accent color for "active"
// elements (glowing filaments, signal paths) and muted colors for
// structure (outlines, pins).

const STROKE = colors.text.muted;
const GLOW = colors.accent;
const DIM = colors.border.default;

// ─── Tube Symbol ────────────────────────────────────────────────────────────
// A simplified vacuum tube: glass envelope + cathode heater glow + 3 pins
// Used for: "No activity yet" (home), general empty states

function TubeSymbolImpl() {
  return (
    <View style={s.artContainer}>
      {/* Glass envelope */}
      <View style={s.tubeEnvelope}>
        {/* Plate */}
        <View style={s.tubePlate} />
        {/* Heater glow */}
        <View style={s.tubeHeaterOuter}>
          <View style={s.tubeHeaterInner} />
        </View>
        {/* Grid */}
        <View style={s.tubeGrid} />
      </View>
      {/* Base + pins */}
      <View style={s.tubeBase}>
        <View style={s.tubePin} />
        <View style={[s.tubePin, { marginHorizontal: 8 }]} />
        <View style={s.tubePin} />
      </View>
    </View>
  );
}

// ─── Meter Symbol ───────────────────────────────────────────────────────────
// A voltmeter face: circle + needle + scale marks
// Used for: "No measurements recorded"

function MeterSymbolImpl() {
  return (
    <View style={s.artContainer}>
      <View style={s.meterFace}>
        {/* Scale marks */}
        <View style={s.meterScaleRow}>
          <View style={s.meterMark} />
          <View style={s.meterMark} />
          <View style={s.meterMark} />
          <View style={s.meterMark} />
          <View style={s.meterMark} />
        </View>
        {/* Needle */}
        <View style={s.meterNeedleWrap}>
          <View style={s.meterNeedle} />
        </View>
        {/* Center pivot */}
        <View style={s.meterPivot} />
        {/* V label */}
      </View>
    </View>
  );
}

// ─── Resistor Symbol ────────────────────────────────────────────────────────
// A zigzag resistor between two terminal lines
// Used for: "No repairs recorded"

function ResistorSymbolImpl() {
  return (
    <View style={s.artContainer}>
      {/* Left wire */}
      <View style={s.resistorWire} />
      {/* Zigzag body */}
      <View style={s.resistorBody}>
        <View style={[s.resistorZag, { transform: [{ rotate: '30deg' }] }]} />
        <View style={[s.resistorZag, { transform: [{ rotate: '-30deg' }] }]} />
        <View style={[s.resistorZag, { transform: [{ rotate: '30deg' }] }]} />
        <View style={[s.resistorZag, { transform: [{ rotate: '-30deg' }] }]} />
        <View style={[s.resistorZag, { transform: [{ rotate: '30deg' }] }]} />
      </View>
      {/* Right wire */}
      <View style={s.resistorWire} />
    </View>
  );
}

// ─── Waveform Symbol ────────────────────────────────────────────────────────
// A simple sine wave suggesting signal/audio
// Used for: "No chats yet", "No shared jobs yet"

function WaveformSymbolImpl() {
  return (
    <View style={s.artContainer}>
      <View style={s.waveformRow}>
        {/* Build a sine-like wave with rounded bars at different heights */}
        {[16, 32, 48, 40, 20, 36, 52, 44, 24, 40, 48, 32, 16].map((h, i) => (
          <View
            key={i}
            style={[
              s.waveformBar,
              {
                height: h,
                backgroundColor: i === 6 || i === 7 ? GLOW : DIM,
                opacity: i === 6 || i === 7 ? 1 : 0.5,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Schematic Page Symbol ──────────────────────────────────────────────────
// A stylized document page with circuit-like lines
// Used for: "No schematics yet"

function SchematicPageSymbolImpl() {
  return (
    <View style={s.artContainer}>
      <View style={s.pageBorder}>
        {/* "Circuit traces" */}
        <View style={s.pageLine} />
        <View style={[s.pageLine, { width: '60%' }]} />
        <View style={s.pageNodeRow}>
          <View style={s.pageNode} />
          <View style={[s.pageLine, { flex: 1, marginHorizontal: 6 }]} />
          <View style={s.pageNode} />
        </View>
        <View style={[s.pageLine, { width: '75%' }]} />
        <View style={[s.pageLine, { width: '45%' }]} />
      </View>
    </View>
  );
}

export const TubeSymbol = memo(TubeSymbolImpl);
export const MeterSymbol = memo(MeterSymbolImpl);
export const ResistorSymbol = memo(ResistorSymbolImpl);
export const WaveformSymbol = memo(WaveformSymbolImpl);
export const SchematicPageSymbol = memo(SchematicPageSymbolImpl);

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  artContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tube
  tubeEnvelope: {
    width: 40,
    height: 52,
    borderWidth: 2,
    borderColor: STROKE,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tubePlate: {
    width: 20,
    height: 2,
    backgroundColor: STROKE,
    position: 'absolute',
    top: 8,
  },
  tubeHeaterOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GLOW + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tubeHeaterInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GLOW,
  },
  tubeGrid: {
    width: 24,
    height: 2,
    backgroundColor: DIM,
    position: 'absolute',
    bottom: 12,
  },
  tubeBase: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  tubePin: {
    width: 2,
    height: 10,
    backgroundColor: STROKE,
  },

  // Meter
  meterFace: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: STROKE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  meterScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '80%',
    position: 'absolute',
    top: 10,
  },
  meterMark: {
    width: 2,
    height: 8,
    backgroundColor: DIM,
  },
  meterNeedleWrap: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    marginLeft: -1,
    transformOrigin: 'bottom center',
    transform: [{ rotate: '-25deg' }],
  },
  meterNeedle: {
    width: 2,
    height: 26,
    backgroundColor: GLOW,
    borderRadius: 1,
  },
  meterPivot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: STROKE,
    marginBottom: 6,
  },

  // Resistor
  resistorWire: {
    width: 16,
    height: 2,
    backgroundColor: STROKE,
  },
  resistorBody: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  resistorZag: {
    width: 8,
    height: 2,
    backgroundColor: GLOW,
    marginHorizontal: -1,
  },

  // Waveform
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 60,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },

  // Schematic page
  pageBorder: {
    width: 56,
    height: 68,
    borderWidth: 2,
    borderColor: STROKE,
    borderRadius: 4,
    padding: 8,
    gap: 6,
  },
  pageLine: {
    height: 2,
    backgroundColor: DIM,
    width: '80%',
    borderRadius: 1,
  },
  pageNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageNode: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GLOW,
  },
});
