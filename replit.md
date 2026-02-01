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
