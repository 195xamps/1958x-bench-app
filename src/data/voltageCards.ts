export interface VoltageReading {
  node: string;
  expected: string;
  notes?: string;
}

export interface VoltageCard {
  id: string;
  name: string;
  circuitFamily: string;
  description: string;
  voltages: VoltageReading[];
}

export const VOLTAGE_CARDS: VoltageCard[] = [
  {
    id: 'aa763', name: 'Fender AA763', circuitFamily: 'Blackface',
    description: 'Deluxe Reverb, Twin Reverb, Super Reverb (1963-1967)',
    voltages: [
      { node: 'B+ (main)', expected: '420-440V', notes: 'After rectifier' },
      { node: 'Output tube plates', expected: '420-440V', notes: '6L6 or 6V6' },
      { node: 'Output tube screens', expected: '415-435V' },
      { node: 'Phase inverter plates', expected: '200-220V', notes: '12AT7' },
      { node: 'Preamp plates', expected: '180-200V', notes: '12AX7' },
      { node: 'Preamp cathodes', expected: '1.2-1.8V', notes: 'Depends on stage' },
      { node: 'Bias voltage', expected: '-48 to -55V', notes: 'Adjustable' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'ab763', name: 'Fender AB763', circuitFamily: 'Blackface',
    description: 'Similar to AA763, slightly different bias circuit',
    voltages: [
      { node: 'B+ (main)', expected: '420-450V' },
      { node: 'Output tube plates', expected: '420-450V' },
      { node: 'Output tube screens', expected: '420-445V' },
      { node: 'Phase inverter plates', expected: '200-225V' },
      { node: 'Preamp plates', expected: '175-200V' },
      { node: 'Bias voltage', expected: '-50 to -58V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'aa864', name: 'Fender AA864', circuitFamily: 'Silverface',
    description: 'Early Silverface, same circuit as Blackface',
    voltages: [
      { node: 'B+ (main)', expected: '420-440V' },
      { node: 'Output tube plates', expected: '420-440V' },
      { node: 'Output tube screens', expected: '415-435V' },
      { node: 'Phase inverter plates', expected: '200-220V' },
      { node: 'Preamp plates', expected: '180-200V' },
      { node: 'Bias voltage', expected: '-48 to -55V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5f1', name: 'Fender 5F1', circuitFamily: 'Tweed',
    description: 'Champ (1955-1964)',
    voltages: [
      { node: 'B+ (main)', expected: '355-375V', notes: 'From 5Y3 rectifier' },
      { node: 'Output tube plate', expected: '355-375V', notes: '6V6' },
      { node: 'Output tube screen', expected: '355-375V' },
      { node: 'Output cathode', expected: '16-20V', notes: 'Cathode bias' },
      { node: 'Preamp plate', expected: '150-165V', notes: '12AX7' },
      { node: 'Preamp cathode', expected: '1.0-1.5V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5e3', name: 'Fender 5E3', circuitFamily: 'Tweed',
    description: 'Deluxe (1955-1960)',
    voltages: [
      { node: 'B+ (main)', expected: '360-385V', notes: 'From 5Y3 rectifier' },
      { node: 'Output tube plates', expected: '360-385V', notes: '6V6 push-pull' },
      { node: 'Output cathode', expected: '20-24V', notes: 'Shared cathode bias' },
      { node: 'Phase inverter plate', expected: '175-195V', notes: 'Cathodyne' },
      { node: 'Preamp plates', expected: '150-175V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5f6a', name: 'Fender 5F6-A', circuitFamily: 'Tweed',
    description: 'Bassman (1958-1960)',
    voltages: [
      { node: 'B+ (main)', expected: '420-450V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '420-450V', notes: '6L6' },
      { node: 'Output tube screens', expected: '405-430V' },
      { node: 'Phase inverter plates', expected: '215-235V' },
      { node: 'Preamp plates', expected: '160-180V' },
      { node: 'Bias voltage', expected: '-42 to -50V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'jtm45', name: 'Marshall JTM45', circuitFamily: 'Marshall',
    description: 'Based on 5F6-A Bassman',
    voltages: [
      { node: 'B+ (main)', expected: '430-465V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '430-465V', notes: 'KT66 or 6L6' },
      { node: 'Output tube screens', expected: '415-445V' },
      { node: 'Phase inverter plates', expected: '220-240V' },
      { node: 'Preamp plates', expected: '165-190V' },
      { node: 'Bias voltage', expected: '-35 to -45V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'plexi', name: 'Marshall 1959/1987', circuitFamily: 'Marshall',
    description: 'Plexi Super Lead / Super Bass',
    voltages: [
      { node: 'B+ (main)', expected: '470-500V', notes: 'Solid state rectifier' },
      { node: 'Output tube plates', expected: '470-500V', notes: 'EL34' },
      { node: 'Output tube screens', expected: '450-480V' },
      { node: 'Phase inverter plates', expected: '230-260V' },
      { node: 'Preamp plates', expected: '180-210V' },
      { node: 'Bias voltage', expected: '-40 to -50V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'ac30', name: 'Vox AC30', circuitFamily: 'Vox',
    description: 'AC30 Top Boost',
    voltages: [
      { node: 'HT (main)', expected: '320-340V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '320-340V', notes: 'EL84 quad' },
      { node: 'Output tube screens', expected: '310-330V' },
      { node: 'Output cathode', expected: '14-18V', notes: 'Cathode bias' },
      { node: 'Preamp plates', expected: '150-180V', notes: 'EF86/12AX7' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
];
