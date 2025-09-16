# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - Run TypeScript compiler without emitting files

### Environment Setup
- Copy `.env.example` to `.env.local` and configure:
  - Supabase URL and keys
  - OpenAI API key
  - App URL (defaults to localhost:3000)
  - Encryption key for sensitive data

## Architecture Overview

### Tech Stack
- **Next.js 14** with App Router and TypeScript strict mode
- **Supabase** for database, authentication, and file storage
- **OpenAI APIs** (Whisper for transcription, GPT-4o-mini for summarization)
- **Tailwind CSS** for styling
- **React Hook Form** for form handling
- **Zustand** for state management

### Core Workflow
This is a therapy transcription app that processes audio → transcription → clinical notes:
1. Audio upload (MP3/WAV/M4A) to Supabase Storage
2. Send to OpenAI Whisper for transcription
3. AI-powered generation of SOAP/DAP clinical notes
4. Export to PDF/Word with automatic audio cleanup for privacy

### Project Structure
- `src/app/` - Next.js App Router pages
- `src/components/` - Organized by feature (auth/, upload/, transcription/, notes/, export/)
- `src/lib/` - Core utilities (supabase/, openai/, export/, utils/)
- `src/types/` - TypeScript definitions

## Key Technical Considerations

### Privacy & Security
- **CRITICAL**: This handles sensitive healthcare data
- Auto-delete audio files (configurable retention)
- Use client initials/codes only (never full names)
- All operations must be encrypted and logged
- Supabase handles secure authentication and storage

### Performance Requirements
- Support 100MB+ audio files
- Transcription should complete in <2 minutes for 60-minute audio
- Handle 50+ concurrent users

### Code Standards
- TypeScript strict mode is enforced
- Prefer Tailwind utility classes over custom CSS
- Use server-side processing for sensitive operations
- Implement proper loading states for async operations
- Favor React functional components and hooks

### Clinical Note Formats
- **SOAP**: Subjective, Objective, Assessment, Plan
- **DAP**: Data, Assessment, Plan
- Both formats are healthcare industry standards for therapy documentation

## Development Context

### Domain Knowledge
- Therapists need quick, accurate, editable transcription results
- Audio quality varies significantly in therapy settings
- Consider speaker diarization (therapist vs client identification)
- HIPAA compliance considerations for production deployment

### Current Status
- MVP in development (Phase 1: ~40% complete)
- Basic authentication and file upload implemented
- Landing page and basic UI components exist
- Transcription and note generation features in development