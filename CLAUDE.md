# CLAUDE.md

This file provides guidance to Claude Code when working with this lecture transcription project.

## Project Overview

**Notesum** is a lecture transcriber and summarizer web application that helps students transcribe and summarize audio/video lectures using AI technology.

## Development Commands

- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build production version  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - Run TypeScript compiler without emitting files

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage  
- **AI Services:** OpenAI Whisper API, GPT-4o-mini
- **State Management:** Zustand
- **Form Handling:** React Hook Form

## Project Structure

```
src/
├── app/                 # Next.js 14 app directory
│   ├── (auth)/         # Auth-related pages (login, signup, callback)
│   ├── api/            # API routes
│   │   └── auth/       # Authentication API endpoints
│   └── upload/         # Main upload page
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   └── ui/             # UI components (Button, Input, etc.)
├── contexts/            # React contexts
│   └── auth.tsx        # Authentication context and hooks
├── lib/                # Utility functions
│   ├── supabase/       # Supabase client and server utilities
│   └── utils/          # Helper functions
├── middleware.ts        # Next.js middleware for route protection
└── types/              # TypeScript definitions
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

### 🚧 In Development
- File upload for audio/video files (MP3, WAV, M4A, MP4, MOV, AVI)
- AI transcription using OpenAI Whisper
- AI-powered summaries using GPT-4o-mini
- Export transcripts and summaries as PDF/Word

## Environment Setup

Create `.env.local` with:
- Supabase URL and keys
- OpenAI API key
- App URL (defaults to localhost:3000)

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

## Current Status

**Phase 1 Complete:** User authentication system with email verification
**Phase 2 Next:** File upload and transcription features