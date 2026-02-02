# 195x Bench App

A production-grade iOS app for guitar amplifier technicians. The app guides technicians step-by-step through troubleshooting, servicing, validation, and safe power-up of guitar amplifiers (vintage and modern), including blackface/silverface Fender-style circuits and beyond.

## Overview

The 195x Bench App implements the "Reality + Remix" concept:
- **Reality**: The technician's actual bench situation (symptoms, measurements, photos, known mods, voltages, noise behavior)
- **Remix**: Trusted guidance assembled from curated schematics, structured troubleshooting playbooks, and open-source community knowledge

**Primary Feature**: Persistent AI chatbot accessible from the dashboard and within each job, capable of answering both general amp repair questions and querying the app's database (past jobs, schematics).

## Technology Stack

- **Frontend**: React Native with Expo (iOS-first, web preview)
- **Backend**: Express.js with TypeScript (unified server on port 5000)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o via Replit AI Integrations

## Project Structure

```
/
├── app/                     # Expo Router app screens
│   ├── (tabs)/             # Tab navigation screens
│   │   ├── index.tsx       # Dashboard with AI chat
│   │   ├── jobs.tsx        # Bench job management
│   │   ├── schematics.tsx  # Schematic library
│   │   ├── troubleshoot.tsx # Legacy troubleshooting (hidden)
│   │   └── _layout.tsx     # Tab navigation layout
│   ├── _layout.tsx         # Root layout
│   └── measurement.tsx     # Measurement entry screen
├── server/                  # Express backend
│   ├── index.ts            # Main server entry with API routes
│   ├── migrate.ts          # Database migration script
│   └── db/                 # Database configuration
│       ├── index.ts        # Drizzle DB instance
│       └── schema.ts       # Database schema
├── dist/                    # Built Expo web app (served by Express)
└── assets/                  # Static assets
```

## Core Features

### 1. Persistent AI Chatbot (Primary Feature)
- **Dashboard Access**: Start new chats from the home screen
- **Dual-Purpose AI**: Answers general amp repair questions AND queries the database
- **Database Queries**: Ask about past jobs, schematics, and work history
- **Chat Management**: Rename, delete, and convert chats to jobs
- **Job-Specific Chat**: Each job has its own dedicated chat thread
- **Persistent History**: All conversations saved for future reference

### 2. Bench Job Management
- Amp identification (make/model/year, circuit family)
- Owner symptom recording
- Safety checklist with mandatory confirmation
- Prior work and known mods tracking
- Dedicated chat thread per job

### 3. Measurement Capture
- Structured measurement entries (node name, expected range, recorded value)
- Automatic red/yellow/green status indicators
- Meter tool and mode tracking

### 4. Schematic Library
- Search by name, model, or circuit family
- User-uploaded schematics
- Circuit family categorization (Blackface, Silverface, Tweed, Marshall, Vox)
- Tag-based organization

## Database Schema

Key entities:
- `users` - Technician accounts with competency confirmation
- `amp_profiles` - Amplifier identification info
- `bench_jobs` - Service job records with safety checklist
- `chats` - Persistent chat sessions (standalone or linked to jobs)
- `chat_messages` - Individual messages in chat threads
- `symptoms` - Problem descriptions
- `troubleshooting_sessions` - Legacy AI chat sessions
- `test_steps` - Individual diagnostic steps
- `measurements` - Captured voltage/resistance readings
- `schematics` - Schematic library entries
- `repair_actions` - Parts replaced and repairs made
- `reference_sources` - Curated knowledge sources
- `media` - Photos and attachments

## API Endpoints

### Chat Endpoints (New)
- `GET /api/chats` - List all chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat with messages
- `PATCH /api/chats/:id` - Rename chat
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/messages` - Send message (AI responds)
- `POST /api/chats/:id/convert-to-job` - Convert chat to bench job
- `GET /api/bench-jobs/:id/chat` - Get/create job-specific chat

### Job Endpoints
- `GET /api/bench-jobs` - List all bench jobs
- `POST /api/bench-jobs` - Create new bench job
- `GET /api/bench-jobs/:id` - Get job details with measurements
- `PATCH /api/bench-jobs/:id/safety-checklist` - Complete safety checklist

### Other Endpoints
- `GET /api/health` - Health check
- `POST /api/measurements` - Record a measurement
- `GET /api/measurements/:benchJobId` - Get measurements for a job
- `GET /api/schematics` - List all schematics
- `GET /api/schematics/search` - Search schematics
- `POST /api/schematics` - Upload new schematic

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (Replit AI Integrations)
- `EXPO_PUBLIC_API_URL` - Backend API URL for frontend (empty for relative paths)

## Running the App

The app runs as a single unified server:
- **API Server** - Express backend serving both API and static web app on port 5000

To run migrations: `npm run migrate`
To rebuild frontend: `npx expo export --platform web`

## Safety Features

The app emphasizes safety for high-voltage work:
- Mandatory 7-item safety checklist before starting work
- AI assistant always includes safety warnings
- Stop conditions for dangerous situations
- One-hand rule reminders for HV measurements
- Emergency stop guidance

## User Preferences

- Dark mode UI optimized for bench work
- Large tap targets for gloved hands
- Technician-friendly terminology
- Amber/gold (#f59e0b) accent color theme

## Recent Changes

- Feb 2026: **TAVA Podcast Index** - Searchable topic index for "The Truth About Vintage Amps" podcast
  - New TAVA sub-tab in Reference screen
  - "Check Updates" button auto-scrapes fretboardjournal.com index page for new episodes
  - Collapsible episode cards - tap to expand/collapse topic list
  - Searchable topic index with 2,400+ topics across 115+ episodes
  - Timestamps displayed for manual seeking in podcast episodes
  - Tap external link icon to open episode in podcast player
  - Database tables: podcast_episodes, podcast_topics
  - API endpoints: GET /api/podcast/episodes, GET /api/podcast/topics, GET /api/podcast/search, POST /api/podcast/sync
- Feb 2026: **Job Status Workflow & Search** - Enhanced job management workflow
  - 5 job statuses: Active (blue), In Progress (amber), Waiting Parts (purple), Completed (green), Archived (gray)
  - Status picker modal in job detail header - tap status badge to change
  - Color-coded status badges on jobs list with filter tabs
  - Search bar on Jobs tab with debounced search
  - Backend search across job names, symptoms, and notes
- Feb 2026: **Timestamps on Chat & Notes** - All entries now display timestamps
  - Chat messages show "Feb 1, 10:30 AM" format below each message
  - Notes section shows "Last updated" timestamp in header
- Feb 2026: **Enhanced Measurements Workflow** - Redesigned for real tech workflows
  - 8 categorized measurement sections organized by diagnostic sequence
  - Safety & Baseline, PT Secondaries, B+ Rail & Ripple, Output Stage, Phase Inverter, Preamp Triodes, Power-Off Resistance, Output Performance
  - Smart defaults: auto-fills unit, meter mode, and expected ranges when selecting nodes
  - "Start Diagnostic Sequence" guided 20-step diagnostic routine
  - Collapsible accordion UI for easy node browsing
- Feb 2026: **Reference Tab** - New tab with technician reference tools
  - Troubleshooting Flowcharts: 4 interactive decision trees (No Output, Hum, Distortion, Intermittent)
  - Voltage Reference Cards: 9 circuit families with expandable voltage tables
  - Component Calculator: Filter RC, Bypass Cap, Plate Dissipation, Cathode Resistor
- Feb 2026: **Media Gallery** - View all attachments shared in a chat
  - Gallery button with count badge in chat header
  - Grid view of images and PDFs
  - Tap to open in full viewer
  - Available in both dashboard chats and job-specific chats
- Feb 2026: **PDF Upload Support** - Users can now upload PDF documents
  - PDF uploads in chat (alongside images)
  - PDF uploads in schematics library
  - Clickable PDF attachments that open in browser/system viewer
  - Files stored in Replit Object Storage
- Feb 2026: **Rich Markdown Responses** - AI now returns detailed, conversational responses like ChatGPT
  - Expert-level amp identification with visual evidence analysis
  - Detailed troubleshooting with explanations and reasoning
  - Rich markdown formatting (headers, bullets, bold, code blocks)
  - Confident, educational mentor voice
  - Proper formatting for step-by-step procedures
- Feb 2026: **Image Upload Feature** - Users can now upload images/photos to chat
  - Camera access on mobile devices for real-time photo capture
  - Image picker for selecting photos from library
  - Images stored in Replit Object Storage
  - GPT-4o Vision integration for image analysis
  - Attachments displayed in chat messages
  - **Expert amp identification from chassis photos** - AI confidently identifies make, model, circuit family, and year from gut shots
- Feb 2026: **Major Feature** - Persistent AI chatbot as primary feature
  - Dashboard with recent chats list
  - Chat rename, delete, convert to job functionality
  - AI queries database for past jobs and schematics
  - Job-specific chat threads
- Feb 2026: Unified server architecture (single port 5000)
- Feb 2026: Initial MVP with Jobs, Troubleshooting, and Schematics tabs
- Database schema with chats and chat_messages tables
- OpenAI integration for AI troubleshooting assistant
- Safety checklist implementation
