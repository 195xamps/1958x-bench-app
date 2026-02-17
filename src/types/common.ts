import type { JobStatus } from './domain';

export interface StatusConfig {
  value: JobStatus | 'all';
  label: string;
  color: string;
}

export const JOB_STATUSES: StatusConfig[] = [
  { value: 'all', label: 'All', color: '#9ca3af' },
  { value: 'active', label: 'Active', color: '#3b82f6' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'waiting_parts', label: 'Waiting', color: '#8b5cf6' },
  { value: 'completed', label: 'Done', color: '#22c55e' },
  { value: 'archived', label: 'Archived', color: '#6b7280' },
];

export const VALID_STATUSES: JobStatus[] = [
  'active', 'in_progress', 'waiting_parts', 'completed', 'archived',
];

export function getStatusConfig(status: string): StatusConfig {
  return JOB_STATUSES.find((s) => s.value === status) || JOB_STATUSES[1];
}

export const SAFETY_CHECKLIST = [
  'Isolation transformer connected and verified',
  'High voltage capacitors discharged (check with meter)',
  'PPE available (rubber gloves, safety glasses)',
  'One-hand rule understood for HV measurements',
  'Meter verified working on known voltage source',
  'Work area clear and dry',
  'Emergency shutoff accessible',
] as const;

export const CIRCUIT_FAMILIES = [
  'AB763 (Blackface)',
  'AA763 (Blackface)',
  'AA864 (Blackface)',
  'AB568 (Silverface)',
  '5E3 (Tweed Deluxe)',
  '5F6-A (Tweed Bassman)',
  'JTM45',
  'JCM800',
  'AC30',
  'Plexi',
  'Other',
] as const;

export const COMMON_SYMPTOMS = [
  'Hum after recap',
  'No sound at all',
  'Red plating on tubes',
  'Motorboating',
  'Volume drop',
  'Reverb not working',
  'Tremolo weak',
  'Fuse blows',
  'Scratchy pots',
  'Pops on standby toggle',
] as const;

export const METER_MODES = [
  'DC Volts', 'AC Volts', 'mV DC', 'mV AC', 'Ohms', 'Diode Test', 'Continuity',
] as const;

export const MEASUREMENT_UNITS = [
  'V', 'mV', 'A', 'mA', 'ohms', 'k-ohms', 'M-ohms',
] as const;

export const DEFAULT_DIAGNOSTIC_SEQUENCE = [
  'Mains VAC', 'Speaker DCR', 'Earth→Chassis Ω',
  'Heater VAC',
  'B+0', 'B+1', 'B+2', 'B+3', 'Ripple B+1',
  'Power Plate V', 'Power Screen V', 'Power Grid V', 'Bias mA',
  'PI Plate 1', 'PI Plate 2', 'PI Cathode',
  'V1A Plate', 'V1A Cathode', 'V2A Plate', 'V2A Cathode',
] as const;
