import {
  FileValidationResult,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_MB
} from '@/types/upload'

export function validateFile(file: File): FileValidationResult {
  // An empty file has no chunks to upload, so /api/mergeChunk would reject it
  // and leave its uploads row stuck at 'uploading'
  if (file.size === 0) {
    return { isValid: false, error: 'File is empty. Please choose a different file.' }
  }

  // Check file size
  const maxSizeInBytes = MAX_FILE_SIZE_MB * 1024 * 1024
  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      error: `File size must be less than ${MAX_FILE_SIZE_MB}MB. Current size: ${formatFileSize(file.size)}`
    }
  }

  // Check file type by MIME type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    // If MIME type check fails, check by file extension
    const fileName = file.name.toLowerCase()
    const hasValidExtension = ALLOWED_FILE_EXTENSIONS.some(ext =>
      fileName.endsWith(ext.toLowerCase())
    )

    if (!hasValidExtension) {
      return {
        isValid: false,
        error: `File type not supported. Please upload: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
      }
    }
  }

  return { isValid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase()
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') ||
         ['.mp3', '.wav', '.m4a'].includes(getFileExtension(file.name))
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') ||
         ['.mp4'].includes(getFileExtension(file.name))
}