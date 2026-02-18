import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
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
                <ResultLine label="Max Dissipation" value={`${fixedBias.maxWatts}W`} />
                <ResultLine label="Target Dissipation" value={`${fixedBias.targetWatts}W`} />
                <ResultLine label="Target Plate Current" value={`${fixedBias.targetMa} mA`} />
                <ResultLine label="Est. Cathode Current" value={`${fixedBias.cathodeMa} mA`} />
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
                <ResultLine label="Total Cathode Current" value={`${cathBias.totalCurrent} mA`} />
                <ResultLine label="Cathode Resistor" value={`${cathBias.resistance} ohms`} />
                <ResultLine label="Power Dissipation" value={`${cathBias.power} W`} />
                <ResultLine label="Use at least" value={`${cathBias.safeWattage}W resistor`} />
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
                <ResultLine label="Cathode Current" value={`${vkRk.cathodeCurrent} mA`} />
                <ResultLine label="Est. Plate Current" value={`${vkRk.plateCurrent} mA`} />
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
                <ResultLine label="Plate Dissipation" value={`${plateDiss.plate} W`} />
                <ResultLine label="Total (with screen)" value={`${plateDiss.total} W`} />
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
                <ResultLine label="Output Power" value={`${outputPower.watts} W`} />
                <ResultLine label="Peak Voltage" value={`${outputPower.vpeak} V`} />
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
                <ResultLine label="Total Load" value={`${speakerZ.total} ohms`} />
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
                {dropRes.mode === 'fromDrop' && <ResultLine label="Needed Resistor" value={`${dropRes.neededRes} ohms`} />}
                {dropRes.mode === 'fromRes' && <ResultLine label="Voltage Drop" value={`${dropRes.actualDrop} V`} />}
                <ResultLine label="Power" value={`${dropRes.power} W`} />
                <ResultLine label="Use at least" value={`${dropRes.safeWattage}W resistor`} />
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
                <ResultLine label="Time to Target" value={`${discharge.timeToTarget} sec`} />
                <ResultLine label="Initial Power" value={`${discharge.initialPower} W`} />
                <ResultLine label="Stored Energy" value={`${discharge.energy} J`} />
                <ResultLine label="Danger Level" value={discharge.dangerLevel} color={discharge.dangerLevel === 'LETHAL' ? colors.status.error : discharge.dangerLevel === 'Dangerous' ? colors.status.warning : colors.status.success} />
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
                <ResultLine label="Time Constant" value={`${filterRC.tau} ms`} />
                <ResultLine label="-3dB Cutoff" value={`${filterRC.cutoff} Hz`} />
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
                <ResultLine label="-3dB Cutoff" value={`${coupling.cutoff} Hz`} />
                <ResultLine label="Bass Reference" value={coupling.bassNote} />
              </Result>
            )}
          </CalcCard>

          <CalcCard title="Cathode Bypass Capacitor" desc="Size bypass cap for bass boost">
            <CalcInput label="Cathode Resistor (ohms)" value={state.cathodeResValue} onChange={set('cathodeResValue')} placeholder="e.g. 1500" />
            {bypass && (
              <Result>
                <ResultLine label="Full bypass (25Hz)" value={`${bypass.full} uF`} />
                <ResultLine label="Partial bypass (100Hz)" value={`${bypass.partial} uF`} />
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
                {ohms.v && <ResultLine label="Voltage" value={`${ohms.v} V`} />}
                {ohms.i && <ResultLine label="Current" value={`${ohms.i} mA`} />}
                {ohms.r && <ResultLine label="Resistance" value={`${ohms.r} ohms`} />}
                {ohms.p && <ResultLine label="Power" value={`${ohms.p} W`} />}
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
                <ResultLine label="Output Voltage" value={`${divider.vout} V`} />
                <ResultLine label="Ratio" value={`${divider.ratio}%`} />
              </Result>
            )}
          </CalcCard>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
