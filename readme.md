# 🎓 Lecture Transcriber & Summarizer

A web application that helps students transcribe and summarize audio/video lectures using AI technology.

## ✨ Features

- 🔐 **User Authentication** - Secure login and registration
- 📁 **File Upload** - Support for audio (MP3, WAV, M4A) and video (MP4) files
- 🎯 **AI Transcription** - Powered by OpenAI Whisper for accurate speech-to-text
- 📝 **Smart Summaries** - AI-generated summaries using GPT-4o-mini
- 📄 **Export Options** - Download transcripts and summaries as PDF or Word documents
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **AI Services:** OpenAI Whisper API, GPT-4o-mini
- **Deployment:** Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Vercel account (for deployment)

## 📁 Project Structure

```
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # Main app dashboard
│   ├── api/              # API routes
│   └── globals.css       # Global styles
├── components/           # Reusable UI components
├── lib/                 # Utility functions and configurations
├── types/              # TypeScript type definitions
└── public/            # Static assets
```

## 🔧 API Endpoints

- `POST /api/upload` - Upload audio/video files
- `POST /api/transcribe` - Process transcription
- `POST /api/summarize` - Generate summaries
- `GET /api/files` - Get user files
- `POST /api/export` - Export documents
- `DELETE /api/files/[id]` - Delete files

## 🚀 Deployment

### Environment Variables for Production

Make sure to set all the environment variables from `.env.local` in your Vercel project settings.

## 📝 Usage

1. **Sign Up/Login** - Create an account or sign in
2. **Upload Files** - Drag and drop or select audio/video files
3. **Process** - Wait for AI transcription and summarization
4. **Review** - View transcripts and summaries
5. **Export** - Download as PDF or Word documents

## 🛡️ Security

- Row Level Security (RLS) enabled on all tables
- User authentication required for all operations
- File uploads validated for type and size
- API routes protected with authentication middleware

**Built with ❤️ for students everywhere**