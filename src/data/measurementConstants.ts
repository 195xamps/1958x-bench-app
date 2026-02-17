// Static constants for measurement screen
// Separated from categories data to keep screen-specific config modular

export const DEFAULT_DIAGNOSTIC_SEQUENCE = [
  'Mains VAC', 'Speaker DCR', 'Earth→Chassis Ω',
  'Heater VAC',
  'B+0', 'B+1', 'B+2', 'B+3', 'Ripple B+1',
  'Power Plate V', 'Power Screen V', 'Power Grid V', 'Bias mA',
  'PI Plate 1', 'PI Plate 2', 'PI Cathode',
  'V1A Plate', 'V1A Cathode', 'V2A Plate', 'V2A Cathode',
] as const;

export const METER_MODES = [
  'DC Volts',
  'AC Volts',
  'mV DC',
  'mV AC',
  'Ohms',
  'Diode Test',
  'Continuity',
] as const;

export const UNITS = ['V', 'mV', 'A', 'mA', 'ohms', 'k-ohms', 'M-ohms'] as const;

export type MeterMode = (typeof METER_MODES)[number];
export type MeasurementUnit = (typeof UNITS)[number];
