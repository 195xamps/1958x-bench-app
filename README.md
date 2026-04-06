# 195x Bench App

A mobile-first repair documentation and AI troubleshooting tool for vintage amplifiers (1950s era). Built for technicians who want to document jobs, track measurements, reference schematics, and get AI-assisted troubleshooting — all from the bench.

## Features

- **Bench Jobs** — create and manage repair jobs with amp profile tracking
- **AI Chat** — conversational troubleshooting powered by OpenAI with web search and image support
- **Repair Actions** — log what was done on each job (parts replaced, adjustments made, etc.)
- **Measurements** — record and track voltage, resistance, and other readings per job
- **Schematics** — attach and view reference schematics per amp
- **Community** — share repair notes and browse the community feed
- **Article RAG** — AI answers grounded in a curated knowledge base
- **Google OAuth** — sign in with Google

## Stack

| Layer | Tech |
|---|---|
| Mobile/Web | React Native + Expo (iOS, Android, Web) |
| Navigation | Expo Router (file-based) |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI API (Responses API + Chat Completions) |
| Auth | Passport.js + Google OAuth 2.0 + JWT |
| File Storage | Google Cloud Storage |
| Hosting | Replit (backend) + EAS (mobile builds) |

## Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Google OAuth app credentials (for auth)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in the values in `.env` (see [.env.example](.env.example) for required variables).

3. **Run database migrations**

   ```bash
   npm run migrate
   ```

4. **Start development (backend + web frontend)**

   ```bash
   npm run dev
   ```

   Or start them separately:

   ```bash
   # Backend only
   npm run server

   # Mobile app (choose a target)
   npm run ios
   npm run android
   npm run web
   ```

## Project Structure

```
195x-bench-app/
├── app/               # Expo Router screens (file-based routing)
│   ├── (tabs)/        # Bottom tab navigation
│   ├── chat/          # AI chat screens
│   ├── job/           # Bench job detail screens
│   └── article/       # Knowledge base articles
├── components/        # Shared React Native components
├── hooks/             # Custom React hooks
├── constants/         # Theme, colors, config
├── server/            # Express backend
│   ├── routes/        # API route handlers
│   ├── db/            # Drizzle schema and migrations
│   └── lib/           # Utilities (OpenAI, auth, etc.)
├── shared/            # Types shared between app and server
└── assets/            # Icons, splash screen, images
```

## Building for App Store

This project uses [EAS Build](https://docs.expo.dev/build/introduction/).

```bash
# Production build (iOS)
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## License

Private — all rights reserved.
