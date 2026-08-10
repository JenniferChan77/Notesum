# CLAUDE.md

This file provides guidance to Claude Code when working with this lecture transcription project.

## Project Overview

**Notesum** is a lecture transcriber and summarizer web application that helps students transcribe and summarize audio/video lectures using AI technology.

The app is two separate processes: the **Next.js web app** (upload UI, auth, signed-URL/queue-trigger API routes) and a **standalone Node worker** (`worker/`) that does the actual file processing (merging chunks, extracting audio, calling Whisper). They communicate via a Redis-backed BullMQ job queue — the web app never touches ffmpeg or the OpenAI API directly.

## Development Commands

App (root):
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - Run TypeScript compiler without emitting files

Worker (`worker/`) — must be running for uploads to actually get processed:
- `npm start` (run from `worker/`) - Boots both the merge and transcribe BullMQ workers (`worker/src/index.js`)

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Background workers:** Node.js, BullMQ, ioredis, ffmpeg (`@ts-ffmpeg/fluent-ffmpeg` + `ffmpeg-static`)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **AI Services:** OpenAI Whisper API (`whisper-1`), GPT-4o-mini (summarization, in progress)
- **State Management:** Zustand
- **Form Handling:** React Hook Form

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # login, signup, auth/callback pages
│   ├── api/
│   │   ├── auth/callback/   # server-side email verification handler
│   │   ├── getSignedUrl/    # issues a signed upload URL for one file chunk
│   │   └── mergeChunk/      # enqueues the "merge-chunk" BullMQ job
│   └── upload/               # main upload page (protected)
├── components/
│   ├── auth/                 # LoginForm, SignupForm, AuthLayout
│   ├── ui/                    # Button, Input, Tabs
│   └── upload/                 # FileUploadZone, uploadFile.tsx (chunked upload orchestration)
├── contexts/auth.tsx           # auth state/context
├── lib/
│   ├── supabase/               # browser + server Supabase clients
│   └── utils/                   # chunkFile.js, fileValidation.ts
├── middleware.ts                # route protection
└── types/

worker/
├── src/
│   ├── index.js                # entry point — imports mergeWorker + transcribeWorker
│   ├── mergeWorker.js           # reassembles uploaded chunks, extracts audio (ffmpeg), enqueues transcribe job
│   ├── transcribeWorker.js      # downloads audio, calls Whisper, writes to `transcriptions` table, enqueues summarize job
│   └── summarizeWorker.js       # summarization (in progress, not wired into index.js yet)
└── lib/
    ├── redis.js, supabase.js
    ├── queues/                  # transcribeQueue.js, summarizeQueue.js (BullMQ queue definitions)
    ├── chunkText.js             # summarization-only (token-bounded text chunking)
    ├── validateChunk.js         # summarization-only (validates LLM chunk-summary output)
    └── prompts.js                # summarization-only
```

## Core Features

### ✅ Completed Features
- **User Authentication System** (Supabase Auth)
  - Email/password registration and login
  - Email verification with secure callback flow
  - Route protection with middleware
  - Password validation and error handling
  - Resend verification functionality
- **Landing Page** - Student-focused copy and responsive design
- **Chunked upload + background transcription pipeline** (backend, end-to-end)
  - Client-side file chunking (10MB chunks) and validation (MP3/WAV/M4A/MP4, 100MB max)
  - Parallel chunk upload (3 concurrent) directly to Supabase Storage via per-chunk signed URLs
  - BullMQ job chain: `merge-chunk` → `transcribe` (see Transcription Pipeline section below)
  - Whisper transcription with automatic chunk-splitting for files over the 25MB API limit, with timestamp-accurate segment re-merging
  - Transcript persisted to the `transcriptions` Supabase table

### 🚧 In Development
- **Transcript display** - transcription results are stored but not yet fetched/shown in the upload UI (the Transcript tab on `/upload` is still a static placeholder)
- AI-powered summaries using GPT-4o-mini (`summarizeWorker.js` exists but isn't imported by `worker/src/index.js` yet)
- Export transcripts and summaries as PDF/Word

## Environment Setup

App root — create `.env.local` with:
- Supabase URL and keys
- `REDIS_URL` (used directly by `/api/mergeChunk` to enqueue jobs)
- App URL (defaults to localhost:3000)

`worker/` — create `worker/.env` with:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `REDIS_URL`

## Authentication Implementation

### Email Verification Flow
1. **User Registration** → Redirects to `/auth/callback?status=pending&email=xxx`
2. **Email Verification** → User clicks email link → `/api/auth/callback` → `/auth/callback?status=verified`
3. **Manual Login** → User manually signs in after verification

### Key Components
- **Auth Context** (`/src/contexts/auth.tsx`) - Manages authentication state and API calls
- **LoginForm** - Handles sign-in with verification error handling and resend option
- **SignupForm** - User registration with redirect to verification page
- **Unified Callback Page** (`/auth/callback`) - Handles all verification states
- **API Callback** (`/api/auth/callback`) - Server-side email verification processing
- **Middleware** (`/src/middleware.ts`) - Route protection and authentication checks

### Route Protection
- **Public Routes:** `/` (landing page)
- **Auth Routes:** `/login`, `/signup`, `/auth/callback` (unauthenticated users only)
- **Protected Routes:** `/upload` and all other routes (authenticated users only)
- Note: `getSignedUrl` and `mergeChunk` API routes do not do an explicit `session.user` check themselves — they rely on Supabase RLS via the cookie-derived client

## Transcription Pipeline Implementation

### Flow
1. **Client** (`src/components/upload/uploadFile.tsx`) splits the file into 10MB chunks (`src/lib/utils/chunkFile.js`) and uploads up to 3 chunks concurrently, each via a signed URL fetched from `POST /api/getSignedUrl` (Supabase Storage bucket `audio-temp`, path `temp/{uploadId}/{chunkIndex}-{fileName}`).
2. Once all chunks are uploaded, the client calls `POST /api/mergeChunk`, which enqueues a job on the `merge-chunk` BullMQ queue (Redis, defined inline in the route — there is no separate producer file in `worker/`).
3. `worker/src/mergeWorker.js` consumes `merge-chunk` jobs: downloads and reassembles the chunks, extracts audio with ffmpeg (mono, 16kHz mp3), uploads the result to the `merged-audio` Storage bucket, then enqueues a `transcribe` job (`worker/lib/queues/transcribeQueue.js`).
4. `worker/src/transcribeWorker.js` consumes `transcribe` jobs: downloads the merged audio, calls the OpenAI Whisper API (`whisper-1`, verbose JSON with segment timestamps). If the file is over Whisper's 25MB limit, it splits the audio into chunks with ffmpeg, transcribes each separately, and offsets/merges the segments before combining. Result is inserted into the `transcriptions` Supabase table (`{ video_id, text, segments }`).
5. On success, `transcribeWorker.js` enqueues a `summarize` job (`summarizeQueue`) — this hands off into the not-yet-complete summarization pipeline.

### Key files
- `src/app/api/getSignedUrl/route.ts`, `src/app/api/mergeChunk/route.ts`
- `src/components/upload/uploadFile.tsx`, `src/lib/utils/chunkFile.js`
- `worker/src/mergeWorker.js`, `worker/src/transcribeWorker.js`
- `worker/lib/queues/transcribeQueue.js`

### Known gaps
- No UI polls/fetches the `transcriptions` table — this is the main missing piece before the feature is user-visible end-to-end.
- `uploadFile.tsx` currently calls a hardcoded `http://localhost:3000/api/getSignedUrl` rather than a relative URL — will break in non-local deployments.
- All BullMQ queues (`merge-chunk`, `transcribe`, `summarize`) use 3 retry attempts with exponential backoff (30s base delay).

## Current Status

**Phase 1 Complete:** User authentication system with email verification
**Phase 2 Complete (backend):** Chunked upload and transcription pipeline — transcript is generated and stored, but not yet displayed in the UI
**Phase 3 In Progress:** Summarization (worker exists, not yet wired up) and transcript/summary display UI
