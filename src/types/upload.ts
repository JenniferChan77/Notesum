export interface UploadFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  status: UploadStatus
  progress: number
  error?: string
}

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export interface FileValidationOptions {
  maxSizeInMB: number
  allowedFormats: string[]
}

export const ALLOWED_FILE_TYPES = [
  'audio/mpeg',      // MP3
  'audio/wav',       // WAV
  'audio/x-m4a',     // M4A
  'audio/mp4',       // M4A (alternative MIME type)
  'video/mp4',       // MP4
]

export const ALLOWED_FILE_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.m4a',
  '.mp4',
]

export const MAX_FILE_SIZE_MB = 100