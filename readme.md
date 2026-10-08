# Notesum — Lecture Transcriber & Summarizer

A web application that helps students transcribe (and, soon, summarize) audio/video lectures using AI.

## Status

- ✅ **Authentication** — Supabase Auth with email/password, email verification flow, and middleware-based route protection.
- ✅ **Upload & Transcription** — chunked upload of large audio/video files, background processing pipeline, and AI transcription via OpenAI Whisper. End-to-end functional.
- ✅ **Status tracking & transcript display** — each upload's progress through the pipeline is tracked in the database, polled by the upload page, and the finished transcript is rendered as timestamped `[mm:ss] text` lines.
- 🚧 **Summarization** — `worker/src/summarizeWorker.js` exists but isn't wired into the worker entry point yet, and the Summary tab is hidden behind a `SHOW_SUMMARY` flag.
- 🚧 **Export** — PDF/Word export is planned, not yet built.

## Architecture

Notesum splits work between the Next.js web app and a standalone Node worker process, connected by a Redis-backed job queue (BullMQ). This keeps large-file processing (ffmpeg, Whisper API calls) off the request/response cycle.

```
Browser
  │  1. POST /api/uploads creates an `uploads` row and returns uploadFileId
  │  2. split file into 10MB chunks, upload directly to Supabase Storage
  │     via per-chunk signed URLs (3 chunks in parallel)
  ▼
Next.js API (uploads, getSignedUrl, mergeChunk)
  │  3. once all chunks are uploaded, flip the row to "queued" and
  │     enqueue a "merge-chunk" job
  ▼
Redis (BullMQ)
  ▼
worker/mergeWorker.js                                      status: processing
  │  4. reassemble chunks, extract audio with ffmpeg, upload merged
  │     audio to storage, enqueue a "transcribe" job
  ▼
worker/transcribeWorker.js                                 status: transcribing
  │  5. download audio, transcribe with OpenAI Whisper (auto-splitting
  │     files over the 25MB API limit and re-merging timestamped
  │     segments), write the result to Supabase
  ▼
Supabase (transcriptions table)                            status: completed
  ▲
  │  6. the upload page polls GET /api/uploads/{uploadFileId} every 4s and
  │     renders the status, then the transcript once it's complete
Browser
```

`uploadFileId` is the id that ties everything together: it's the `uploads` row id, the
storage path prefix, the BullMQ job payload field, and `transcriptions.video_id`.

Every queue stage retries up to 3 times with exponential backoff. A stage is only marked
`failed` in the UI after its retries are exhausted, so a transient error doesn't flash an
error at the user mid-retry.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Background workers:** Node.js, BullMQ, Redis, ffmpeg
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **AI Services:** OpenAI Whisper API (transcription), GPT-4o-mini (summarization, in progress)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- OpenAI API key
- Redis instance (for the job queue)

### Configuration

The two processes read separate env files:

- `.env.local` (app root) — Supabase URL and keys, `REDIS_URL`, app URL
- `worker/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `REDIS_URL`

The SQL in `supabase/migrations/` needs to be run in the Supabase SQL editor to create the
tables and RLS policies.

### Running locally

The app and the worker are two separate processes and both need to be running — without the
worker, uploads will sit at `queued` forever:

```
npm install && npm run dev        # Next.js app, localhost:3000
cd worker && npm install && npm start   # background worker (merge + transcribe)
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # login, signup, auth callback pages
│   ├── api/
│   │   ├── auth/callback/    # email verification handler
│   │   ├── uploads/          # creates the upload record; [uploadFileId] returns status + transcript
│   │   ├── getSignedUrl/     # issues signed upload URLs for file chunks
│   │   └── mergeChunk/       # enqueues the merge job once upload is complete
│   └── upload/           # main upload page: upload, status polling, transcript view
├── components/
│   ├── auth/             # login/signup forms
│   ├── ui/                # Button, Input, Tabs
│   └── upload/            # drag-and-drop zone, chunked upload logic
├── contexts/auth.tsx      # auth state/context
├── lib/
│   ├── supabase/          # browser + server Supabase clients
│   └── utils/              # file chunking/validation helpers
├── middleware.ts           # route protection
└── types/                  # pipeline status, upload record, transcript types

supabase/
└── migrations/             # SQL run manually in the Supabase SQL editor

worker/
├── src/
│   ├── index.js            # boots the merge + transcribe workers
│   ├── mergeWorker.js       # reassembles chunks, extracts audio (ffmpeg)
│   ├── transcribeWorker.js  # calls OpenAI Whisper, stores the transcript
│   └── summarizeWorker.js   # summarization (in progress, not booted yet)
└── lib/
    ├── redis.js, supabase.js
    ├── uploadStatus.js       # status updates for the `uploads` table
    └── queues/               # BullMQ queue definitions
```

## Data Model

- **`uploads`** — one row per upload: `id`, `user_id`, `file_name`, `status`, `error`, timestamps.
  Status moves `uploading → queued → processing → transcribing → completed`, or `failed`.
- **`transcriptions`** — the finished transcript: `video_id` (the upload id), `text`, and
  `segments` (Whisper's timestamped segments).

## API Endpoints

- `POST /api/uploads` — create the upload record, returns `uploadFileId`
- `GET /api/uploads/{uploadFileId}` — current status, plus the transcript once complete
- `POST /api/getSignedUrl` — get a signed URL to upload one file chunk to Supabase Storage
- `POST /api/mergeChunk` — enqueue background processing once all chunks are uploaded
- `GET /api/auth/callback` — email verification callback

## Security

- Row Level Security (RLS) on Supabase tables/storage: users can only read their own uploads
  and transcripts, and the only status change they can make is `uploading → queued`. Every
  other transition comes from the worker, which uses the service-role key.
- Authenticated routes protected via Next.js middleware; unauthenticated `/api/*` calls get a
  401 JSON response rather than a redirect to HTML. Each upload route re-verifies the user and
  checks row ownership itself.
- File uploads validated for type and size (100MB max; mp3/wav/m4a/mp4) before upload begins
