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
│   │   ├── uploads/         # POST: create `uploads` row, returns uploadFileId
│   │   │   └── [uploadFileId]/  # GET: status (+ transcript when completed), polled by the page
│   │   ├── getSignedUrl/    # issues a signed upload URL for one file chunk
│   │   └── mergeChunk/      # marks upload 'queued' and enqueues the "merge-chunk" BullMQ job
│   └── upload/               # main upload page (protected): upload, status polling, transcript view
├── components/
│   ├── auth/                 # LoginForm, SignupForm, AuthLayout
│   ├── ui/                    # Button, Input, Tabs (optionally controlled via activeTab/onTabChange)
│   └── upload/                 # FileUploadZone, uploadFile.tsx (chunked upload orchestration)
├── contexts/auth.tsx           # auth state/context
├── lib/
│   ├── supabase/               # browser + server Supabase clients
│   └── utils/                   # chunkFile.js, fileValidation.ts
├── middleware.ts                # route protection (401 JSON for /api/*, redirect for pages)
└── types/                       # upload.ts: ProcessingStatus, UploadRecord, Transcript types

supabase/
└── migrations/                  # SQL run manually in the Supabase SQL editor (uploads table + RLS, transcriptions unique index)

worker/
├── src/
│   ├── index.js                # entry point — imports mergeWorker + transcribeWorker
│   ├── mergeWorker.js           # reassembles uploaded chunks, extracts audio (ffmpeg), enqueues transcribe job
│   ├── transcribeWorker.js      # downloads audio, calls Whisper, writes to `transcriptions` table (summarize enqueue is commented out)
│   └── summarizeWorker.js       # summarization (in progress, not wired into index.js yet)
└── lib/
    ├── redis.js, supabase.js
    ├── uploadStatus.js          # setUploadStatus() + markFailedIfFinal() for the `uploads` table
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
- **Upload status + transcript display** (end-to-end, user-visible)
  - `uploads` table tracks each upload's status; workers update it as the job moves through the pipeline
  - `/upload` polls the status every 4s, shows progress/errors, and renders the transcript as `[mm:ss] text` lines
  - After completion, "Start Transcription" is replaced by "Upload a new file" (prevents re-transcribing/re-billing the same file)

### 🚧 In Development
- AI-powered summaries using GPT-4o-mini (`summarizeWorker.js` exists but isn't imported by `worker/src/index.js` yet). The Summary tab on `/upload` is hidden behind `SHOW_SUMMARY = false` in `src/app/upload/page.tsx` — flip it to bring the tab back
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
- **API routes:** middleware returns `401 JSON` for unauthenticated `/api/*` calls instead of redirecting to `/login` (a redirect would hand `fetch()` callers HTML). `/api/auth/*` is exempt so the verification callback still works.
- Each upload API route also calls `supabase.auth.getUser()` itself (middleware only uses `getSession()`, which doesn't verify the token with Supabase) and checks that the `uploads` row belongs to the caller. RLS hides other users' rows, so an unauthorized id returns 404 rather than 403.

## Transcription Pipeline Implementation

### Flow
`uploadFileId` is the id that ties everything together: it's the `uploads` row id, the storage path prefix, the BullMQ job payload field, and `transcriptions.video_id`.

1. **Client** (`src/components/upload/uploadFile.tsx`) calls `POST /api/uploads` with the file name. The route creates an `uploads` row (`status: 'uploading'`) and returns `uploadFileId`.
2. The client splits the file into 10MB chunks (`src/lib/utils/chunkFile.js`) and uploads up to 3 concurrently, each via a signed URL from `POST /api/getSignedUrl` (Supabase Storage bucket `audio-temp`, path `temp/{uploadFileId}/{chunkIndex}-{fileName}`). The route uses the *stored* `file_name`, never the client's, so paths always match what the worker downloads. Any failed chunk rejects, so the merge never starts on an incomplete upload.
3. The client calls `POST /api/mergeChunk`, which flips the row `uploading` → `queued` (a conditional update, so the same upload can't be queued twice) and enqueues a `merge-chunk` job (Redis/BullMQ, defined inline in the route — there is no separate producer file in `worker/`).
4. `worker/src/mergeWorker.js` consumes `merge-chunk` jobs: sets `processing`, reassembles the chunks, extracts audio with ffmpeg (mono, 16kHz mp3), uploads to the `merged-audio` bucket, sets `transcribing`, then enqueues a `transcribe` job (`worker/lib/queues/transcribeQueue.js`). The status is set *before* enqueueing so a fast transcribe job can't be overwritten.
5. `worker/src/transcribeWorker.js` consumes `transcribe` jobs: downloads the merged audio, calls Whisper (`whisper-1`, verbose JSON with segment timestamps), splitting files over the 25MB limit and offsetting/merging segments. It upserts into `transcriptions` (`{ video_id, text, segments }`, `onConflict: 'video_id'`) and sets `completed`. The job is idempotent: it first checks for an existing `transcriptions` row and, if one is there, skips the download/Whisper call entirely and just re-asserts `completed` — a retry after a crash between the insert and the status write costs nothing and can't double-bill.
6. Meanwhile `/upload` polls `GET /api/uploads/{uploadFileId}` every 4s and renders the status. On `completed` the response also carries the transcript, which the Transcript tab renders as `[mm:ss] text`.
7. Failures: each worker's `failed` handler (`markFailedIfFinal`) sets `failed` + the error message **only after retries are exhausted**, so the UI doesn't flash an error during a retry. Status writes never throw — a failed status update must not make BullMQ redo expensive ffmpeg/Whisper work.

### Database
- `uploads`: `id`, `user_id`, `file_name`, `status`, `error`, timestamps. Status: `uploading | queued | processing | transcribing | completed | failed`.
- RLS (see `supabase/migrations/`): users read/insert only their own rows and may only move their own row `uploading` → `queued` (column-level grant limits them to `status`). Every other transition comes from the worker, which uses the service-role key and bypasses RLS.
- `transcriptions` is readable only via the matching `uploads` row's owner. A unique index on `video_id` (`transcriptions_video_id_key`) enforces one transcript per upload — the worker's upsert relies on it for `on conflict` inference, so the migration must be applied before that worker code runs.

### Key files
- `src/app/api/uploads/route.ts`, `src/app/api/uploads/[uploadFileId]/route.ts`
- `src/app/api/getSignedUrl/route.ts`, `src/app/api/mergeChunk/route.ts`
- `src/components/upload/uploadFile.tsx`, `src/lib/utils/chunkFile.js`, `src/app/upload/page.tsx`
- `worker/src/mergeWorker.js`, `worker/src/transcribeWorker.js`, `worker/lib/uploadStatus.js`
- `worker/lib/queues/transcribeQueue.js`, `supabase/migrations/`

### Known gaps
- All BullMQ queues (`merge-chunk`, `transcribe`, `summarize`) use 3 retry attempts with exponential backoff (30s base delay), so a hard failure takes ~1.5 min to surface in the UI.
- `summarizeWorker.js` still inserts into `summaries` unconditionally, so a summarize retry after a successful insert would duplicate the row. `transcriptions` was fixed (unique index + upsert + existence check); apply the same pattern when summarization is wired into `worker/src/index.js`.
- If the client dies mid-upload, the `uploads` row is left at `uploading` forever (no cleanup job); the `audio-temp` chunks are never deleted either.
- Polling is simple but chatty — Supabase Realtime on the `uploads` row is the natural upgrade.

## Current Status

**Phase 1 Complete:** User authentication system with email verification
**Phase 2 Complete:** Chunked upload → transcription pipeline, with status tracking and transcript display in the UI (end-to-end, user-visible)
**Phase 3 In Progress:** Summarization (worker exists, not wired into `worker/src/index.js`; Summary tab hidden behind `SHOW_SUMMARY`) and PDF/Word export
