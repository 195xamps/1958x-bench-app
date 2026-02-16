export interface AmpProfile {
  id: string;
  make: string;
  model: string;
  year: string | null;
  circuitFamily: string | null;
  serialNumber?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export type JobStatus = 'active' | 'in_progress' | 'waiting_parts' | 'completed' | 'archived';

export interface BenchJob {
  id: string;
  userId: string;
  ampProfileId: string;
  status: JobStatus;
  ownerSymptoms: string | null;
  techNotes: string | null;
  priorWork: string | null;
  knownMods: string | null;
  safetyChecklistCompleted: boolean;
  isPublic: boolean;
  shareAnonymously: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithProfile {
  job: BenchJob;
  ampProfile: AmpProfile | null;
}

export interface CreateJobPayload {
  ampMake: string;
  ampModel: string;
  ampYear?: string;
  circuitFamily?: string;
  serialNumber?: string;
  photoUrl?: string;
  ownerSymptoms?: string;
  techNotes?: string;
  priorWork?: string;
  knownMods?: string;
}

export interface CreateJobResponse {
  benchJob: BenchJob;
  ampProfile: AmpProfile;
}

export interface JobDetail {
  job: BenchJob;
  ampProfile: AmpProfile | null;
  measurements: Measurement[];
  sessions: any[];
}

export type MeasurementStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface Measurement {
  id: string;
  benchJobId: string;
  testStepId?: string | null;
  nodeName: string;
  expectedMin: number | null;
  expectedMax: number | null;
  recordedValue: number | null;
  unit: string;
  meterTool: string;
  meterMode: string;
  status: MeasurementStatus;
  notes: string | null;
  createdAt: string;
}

export interface CreateMeasurementPayload {
  benchJobId: string;
  nodeName: string;
  recordedValue: number;
  expectedMin?: number | null;
  expectedMax?: number | null;
  unit: string;
  meterTool?: string;
  meterMode?: string;
  notes?: string;
  testStepId?: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Schematic {
  id: string;
  name: string;
  ampModel: string | null;
  circuitFamily: string | null;
  fileUrl: string | null;
  isUserUploaded: boolean;
  tags: string | null;
  notes: string | null;
  externalLinks: ExternalLink[] | null;
  createdAt: string;
}

export interface SchematicAttachment {
  id: string;
  schematicId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

export interface CreateSchematicPayload {
  name: string;
  ampModel?: string;
  circuitFamily?: string;
  fileUrl?: string;
  tags?: string;
  notes?: string;
  isUserUploaded?: boolean;
  externalLinks?: ExternalLink[];
}

export interface CommunityJob {
  id: string;
  status: string;
  ownerSymptoms: string | null;
  techNotes: string | null;
  createdAt: string;
  updatedAt: string;
  shareAnonymously: boolean;
  ampProfile: {
    make: string | null;
    model: string | null;
    year: string | null;
    circuitFamily: string | null;
  } | null;
  owner: {
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

export interface CommunityJobDetail extends CommunityJob {
  priorWork: string | null;
  knownMods: string | null;
  measurements: {
    nodeName: string;
    recordedValue: number | null;
    expectedMin: number | null;
    expectedMax: number | null;
    unit: string;
    status: string;
    notes: string | null;
  }[];
  schematics: {
    id: string;
    name: string;
    ampModel: string | null;
    circuitFamily: string | null;
  }[];
  chatMessages: {
    id: string;
    role: string;
    content: string;
    attachments: any;
    createdAt: string;
  }[];
}

export interface MyJob {
  id: string;
  status: string;
  isPublic: boolean;
  shareAnonymously: boolean;
  ampProfile: {
    make: string | null;
    model: string | null;
    year: string | null;
  } | null;
}
