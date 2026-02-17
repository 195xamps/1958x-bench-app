export interface ReferenceArticle {
  id: string;
  title: string;
  sourceUrl: string | null;
  sourceName: string | null;
  content: string;
  images: { url: string; alt: string }[] | null;
  circuitFamily: string | null;
  createdAt: string;
}

export interface PodcastEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  sourceUrl: string | null;
  description: string | null;
}

export interface PodcastTopic {
  id: string;
  topic: string;
  timestamp: string | null;
  timestampSeconds: number | null;
  circuitFamily: string | null;
  episodeNumber: number;
  episodeTitle: string;
  episodeUrl: string | null;
}

export interface PodcastSyncResult {
  success: boolean;
  newEpisodes: number;
  totalEpisodes: number;
  totalTopics: number;
}

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

export interface FlowchartNode {
  id: string;
  question: string;
  yes?: string;
  no?: string;
  result?: string;
  info?: string;
}

export interface Flowchart {
  id: string;
  title: string;
  description: string;
  icon: string;
  nodes: FlowchartNode[];
}

export interface VoltageReading {
  label: string;
  value: string;
  unit?: string;
}

export interface VoltageCard {
  id: string;
  ampName: string;
  circuit: string;
  description: string;
  readings: VoltageReading[];
}
