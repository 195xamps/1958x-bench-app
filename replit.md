# 195X Bench App

A production-grade iOS app for guitar amplifier technicians. The app guides technicians step-by-step through troubleshooting, servicing, validation, and safe power-up of guitar amplifiers (vintage and modern), including blackface/silverface Fender-style circuits and beyond.

## Overview

The 195X Bench App implements the "Reality + Remix" concept:
- **Reality**: The technician's actual bench situation (symptoms, measurements, photos, known mods, voltages, noise behavior)
- **Remix**: Trusted guidance assembled from curated schematics, structured troubleshooting playbooks, and open-source community knowledge

## Technology Stack

- **Frontend**: React Native with Expo (iOS-first, web preview)
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o via Replit AI Integrations

## Project Structure

```
/
├── app/                     # Expo Router app screens
│   ├── (tabs)/             # Tab navigation screens
│   │   ├── index.tsx       # Jobs screen (bench job management)
│   │   ├── troubleshoot.tsx # AI troubleshooting assistant
│   │   └── schematics.tsx  # Schematic library
│   └── _layout.tsx         # Root layout
├── server/                  # Express backend
│   ├── index.ts            # Main server entry
│   ├── migrate.ts          # Database migration script
│   └── db/                 # Database configuration
│       ├── index.ts        # Drizzle DB instance
│       └── schema.ts       # Database schema
├── assets/                  # Static assets
│   └── schematics/         # Schematic file storage (placeholder)
└── components/             # Reusable React Native components
```

## Core Features

### 1. Start New Bench Job
- Amp identification (make/model/year, circuit family)
- Owner symptom recording
- Photo upload support
- Safety checklist with mandatory confirmation
- Prior work and known mods tracking

### 2. Guided Troubleshooting Session
- AI-powered diagnostic assistant
- Two modes: Guided (step-by-step) and Expert (condensed)
- Safety gates for high-voltage procedures
- Common symptom quick-select
- Measurement guidance with meter settings and probe placement

### 3. Measurement Capture
- Structured measurement entries (node name, expected range, recorded value)
- Automatic red/yellow/green status indicators
- Meter tool and mode tracking
- Photo attachment support

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
- `symptoms` - Problem descriptions
- `troubleshooting_sessions` - AI chat sessions with history
- `test_steps` - Individual diagnostic steps
- `measurements` - Captured voltage/resistance readings
- `schematics` - Schematic library entries
- `repair_actions` - Parts replaced and repairs made
- `reference_sources` - Curated knowledge sources

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/bench-jobs` - List all bench jobs
- `POST /api/bench-jobs` - Create new bench job
- `GET /api/bench-jobs/:id` - Get job details with measurements
- `PATCH /api/bench-jobs/:id/safety-checklist` - Complete safety checklist
- `POST /api/troubleshooting/start` - Start troubleshooting session
- `POST /api/troubleshooting/chat` - Send message to AI assistant
- `POST /api/measurements` - Record a measurement
- `GET /api/measurements/:benchJobId` - Get measurements for a job
- `GET /api/schematics` - List all schematics
- `GET /api/schematics/search` - Search schematics
- `POST /api/schematics` - Upload new schematic

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL
- `EXPO_PUBLIC_API_URL` - Backend API URL for frontend

## Running the App

The app uses two workflows:
1. **API Server** - Express backend on port 3001
2. **Expo App** - React Native web preview on port 5000

To run migrations: `npm run migrate`

## Safety Features

The app emphasizes safety for high-voltage work:
- Mandatory safety checklist before starting work
- AI assistant always includes safety warnings
- Stop conditions for dangerous situations
- One-hand rule reminders for HV measurements
- Emergency stop guidance

## User Preferences

- Dark mode UI optimized for bench work
- Large tap targets for gloved hands
- Technician-friendly terminology
- Amber/gold accent color theme

## Recent Changes

- Feb 2026: Initial MVP with Jobs, Troubleshooting, and Schematics tabs
- Database schema created with full entity relationships
- OpenAI integration for AI troubleshooting assistant
- Safety checklist implementation
