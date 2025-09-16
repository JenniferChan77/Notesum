export interface User {
  id: string
  email: string
  created_at: string
}

export interface AudioFile {
  id: string
  user_id: string
  filename: string
  file_size: number
  duration: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  created_at: string
}

export interface Transcription {
  id: string
  audio_file_id: string
  content: string
  confidence: number
  segments: TranscriptionSegment[]
  created_at: string
}

export interface TranscriptionSegment {
  text: string
  start: number
  end: number
  speaker?: string
}

export interface ClinicalNote {
  id: string
  transcription_id: string
  format: 'soap' | 'dap'
  content: {
    subjective?: string
    objective?: string
    assessment?: string
    plan?: string
    data?: string
  }
  created_at: string
  updated_at: string
}

export type NoteFormat = 'soap' | 'dap'