# Notesum — Lecture Transcriber & Summarizer

A web application that helps students transcribe (and, soon, summarize) audio/video lectures using AI.

## Status

- ✅ **Authentication** — Supabase Auth with email/password, email verification flow, and middleware-based route protection.
- ✅ **Upload & Transcription** — chunked upload of large audio/video files, background processing pipeline, and AI transcription via OpenAI Whisper. End-to-end functional.
- 🚧 **Transcript display** — transcription results are written to the database but not yet surfaced in the upload UI.
- 🚧 **Summarization** — GPT-4o-mini summary generation is queued after transcription but not yet complete.
- 🚧 **Export** — PDF/Word export is planned, not yet built.

## Architecture

Notesum splits work between the Next.js web app and a standalone Node worker process, connected by a Redis-backed job queue (BullMQ). This keeps large-file processing (ffmpeg, Whisper API calls) off the request/response cycle.

```
Browser
  │  1. split file into 10MB chunks, upload directly to Supabase Storage
  │     via per-chunk signed URLs (3 chunks in parallel)
  ▼
Next.js API (getSignedUrl, mergeChunk)
  │  2. once all chunks are uploaded, enqueue a "merge-chunk" job
  ▼
Redis (BullMQ)
  ▼
worker/mergeWorker.js
  │  3. reassemble chunks, extract audio with ffmpeg, upload merged
  │     audio to storage, enqueue a "transcribe" job
  ▼
worker/transcribeWorker.js
  │  4. download audio, transcribe with OpenAI Whisper (auto-splitting
  │     files over the 25MB API limit and re-merging timestamped
  │     segments), write the result to Supabase
  ▼
Supabase (transcriptions table)
```

Every queue stage retries up to 3 times with exponential backoff.

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

### Running locally

The app and the worker are two separate processes and both need to be running:

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
│   │   ├── getSignedUrl/     # issues signed upload URLs for file chunks
│   │   └── mergeChunk/       # enqueues the merge job once upload is complete
│   └── upload/           # main upload page
├── components/
│   ├── auth/             # login/signup forms
│   ├── ui/                # Button, Input, Tabs
│   └── upload/            # drag-and-drop zone, chunked upload logic
├── contexts/auth.tsx      # auth state/context
├── lib/
│   ├── supabase/          # browser + server Supabase clients
│   └── utils/              # file chunking/validation helpers
├── middleware.ts           # route protection
└── types/

worker/
├── src/
│   ├── index.js            # boots the merge + transcribe workers
│   ├── mergeWorker.js       # reassembles chunks, extracts audio (ffmpeg)
│   └── transcribeWorker.js  # calls OpenAI Whisper, stores the transcript
└── lib/
    ├── redis.js, supabase.js
    └── queues/               # BullMQ queue definitions
```

## API Endpoints

- `POST /api/getSignedUrl` — get a signed URL to upload one file chunk to Supabase Storage
- `POST /api/mergeChunk` — enqueue background processing once all chunks are uploaded
- `GET /api/auth/callback` — email verification callback

## Security

- Row Level Security (RLS) enabled on Supabase tables/storage
- Authenticated routes protected via Next.js middleware
- File uploads validated for type and size (100MB max; mp3/wav/m4a/mp4) before upload begins
