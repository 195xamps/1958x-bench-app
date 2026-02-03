import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, real, varchar, index } from 'drizzle-orm/pg-core';

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table - updated for Google OAuth
export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: text('email').unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  profileImageUrl: text('profile_image_url'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ampProfiles = pgTable('amp_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  make: text('make'),
  model: text('model'),
  year: text('year'),
  circuitFamily: text('circuit_family'),
  serialNumber: text('serial_number'),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const benchJobs = pgTable('bench_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').references(() => users.id),
  ampProfileId: uuid('amp_profile_id').references(() => ampProfiles.id),
  status: text('status').default('active'),
  ownerSymptoms: text('owner_symptoms'),
  techNotes: text('tech_notes'),
  priorWork: text('prior_work'),
  knownMods: text('known_mods'),
  safetyChecklistCompleted: boolean('safety_checklist_completed').default(false),
  isPublic: boolean('is_public').default(false),
  shareAnonymously: boolean('share_anonymously').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const symptoms = pgTable('symptoms', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  description: text('description').notNull(),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const troubleshootingSessions = pgTable('troubleshooting_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  mode: text('mode').default('guided'),
  status: text('status').default('active'),
  currentStepIndex: integer('current_step_index').default(0),
  aiConversationHistory: jsonb('ai_conversation_history'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const testSteps = pgTable('test_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => troubleshootingSessions.id),
  stepNumber: integer('step_number').notNull(),
  instruction: text('instruction').notNull(),
  meterMode: text('meter_mode'),
  probePlacement: text('probe_placement'),
  expectedRange: text('expected_range'),
  safetyWarning: text('safety_warning'),
  stopConditions: text('stop_conditions'),
  completed: boolean('completed').default(false),
  result: text('result'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const measurements = pgTable('measurements', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  testStepId: uuid('test_step_id').references(() => testSteps.id),
  nodeName: text('node_name').notNull(),
  expectedMin: real('expected_min'),
  expectedMax: real('expected_max'),
  recordedValue: real('recorded_value'),
  unit: text('unit'),
  meterTool: text('meter_tool'),
  meterMode: text('meter_mode'),
  status: text('status'),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schematics = pgTable('schematics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ampModel: text('amp_model'),
  circuitFamily: text('circuit_family'),
  fileUrl: text('file_url'),
  isUserUploaded: boolean('is_user_uploaded').default(false),
  tags: text('tags'),
  notes: text('notes'),
  externalLinks: jsonb('external_links'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schematicAttachments = pgTable('schematic_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  schematicId: uuid('schematic_id').references(() => schematics.id).notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name'),
  fileType: text('file_type'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobSchematics = pgTable('job_schematics', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id).notNull(),
  schematicId: uuid('schematic_id').references(() => schematics.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const repairActions = pgTable('repair_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  description: text('description').notNull(),
  partReplaced: text('part_replaced'),
  partValue: text('part_value'),
  partBrand: text('part_brand'),
  voltageRating: text('voltage_rating'),
  dateCode: text('date_code'),
  beforeMeasurement: text('before_measurement'),
  afterMeasurement: text('after_measurement'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const referenceSources = pgTable('reference_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url'),
  title: text('title'),
  author: text('author'),
  dateAccessed: timestamp('date_accessed'),
  excerptSummary: text('excerpt_summary'),
  reliabilityScore: integer('reliability_score'),
  sourceType: text('source_type'),
});

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  type: text('type'),
  url: text('url'),
  caption: text('caption'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').references(() => users.id),
  title: text('title').default('New Chat'),
  benchJobId: uuid('bench_job_id').references(() => benchJobs.id),
  isStandalone: boolean('is_standalone').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id).notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const referenceArticles = pgTable('reference_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceName: text('source_name').default('Rob Robinette'),
  content: text('content').notNull(),
  images: jsonb('images'),
  circuitFamily: text('circuit_family'),
  tags: text('tags'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const podcastEpisodes = pgTable('podcast_episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  sourceUrl: text('source_url').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const podcastTopics = pgTable('podcast_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeId: uuid('episode_id').references(() => podcastEpisodes.id),
  topic: text('topic').notNull(),
  timestamp: text('timestamp'),
  timestampSeconds: integer('timestamp_seconds'),
  circuitFamily: text('circuit_family'),
  createdAt: timestamp('created_at').defaultNow(),
});
