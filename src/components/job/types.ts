import type { Measurement, RepairAction } from '../../types';

export type JobTabType = 'chat' | 'notes' | 'measurements' | 'repairs';

export interface JobData {
  job: {
    id: string;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    ownerSymptoms: string;
    techNotes: string;
    priorWork: string;
    knownMods: string;
    safetyChecklistCompleted: boolean;
    isPublic: boolean;
    shareAnonymously: boolean;
    createdAt: string;
    updatedAt: string;
  };
  ampProfile: {
    id: string;
    make: string;
    model: string;
    year: string;
    circuitFamily: string;
  };
  measurements: Measurement[];
  repairActions: RepairAction[];
}

export interface RepairFormState {
  description: string;
  partReplaced: string;
  partValue: string;
  partBrand: string;
  voltageRating: string;
  dateCode: string;
  beforeMeasurement: string;
  afterMeasurement: string;
  notes: string;
}

export const EMPTY_REPAIR_FORM: RepairFormState = {
  description: '',
  partReplaced: '',
  partValue: '',
  partBrand: '',
  voltageRating: '',
  dateCode: '',
  beforeMeasurement: '',
  afterMeasurement: '',
  notes: '',
};
