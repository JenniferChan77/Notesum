import {
  validateFile,
  formatFileSize,
  getFileExtension,
  isAudioFile,
  isVideoFile,
} from './fileValidation'

const MB = 1024 * 1024

// Only name/size/type are read, so skip allocating real 100MB buffers
function fakeFile(name: string, size: number, type: string) {
  return { name, size, type } as File
}

describe('validateFile', () => {
  it('accepts an allowed MIME type under the size limit', () => {
    expect(validateFile(fakeFile('lecture.mp3', 5 * MB, 'audio/mpeg'))).toEqual({ isValid: true })
  })

  it('accepts a file of exactly the size limit', () => {
    expect(validateFile(fakeFile('lecture.mp4', 100 * MB, 'video/mp4')).isValid).toBe(true)
  })

  it('rejects a file over the size limit and reports its size', () => {
    const result = validateFile(fakeFile('lecture.mp4', 150 * MB, 'video/mp4'))
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('File size must be less than 100MB. Current size: 150 MB')
  })

  it('falls back to the extension when the MIME type is unknown', () => {
    expect(validateFile(fakeFile('LECTURE.MP3', MB, '')).isValid).toBe(true)
    expect(validateFile(fakeFile('lecture.m4a', MB, 'application/octet-stream')).isValid).toBe(true)
  })

  it('rejects when both MIME type and extension are unsupported', () => {
    const result = validateFile(fakeFile('notes.pdf', MB, 'application/pdf'))
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('File type not supported. Please upload: .mp3, .wav, .m4a, .mp4')
  })
})

describe('formatFileSize', () => {
  it.each([
    [0, '0 Bytes'],
    [500, '500 Bytes'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [MB, '1 MB'],
    [1.25 * 1024 * MB, '1.25 GB'],
  ])('%d -> %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})

describe('getFileExtension', () => {
  it('returns the lowercased last extension', () => {
    expect(getFileExtension('Lecture.MP4')).toBe('.mp4')
    expect(getFileExtension('week.1.notes.wav')).toBe('.wav')
  })

  it('returns an empty string when there is no extension', () => {
    expect(getFileExtension('lecture')).toBe('')
    expect(isAudioFile(fakeFile('mp3', 1, ''))).toBe(false)
  })
})

describe('isAudioFile / isVideoFile', () => {
  it('detects by MIME type', () => {
    expect(isAudioFile(fakeFile('x', 1, 'audio/wav'))).toBe(true)
    expect(isVideoFile(fakeFile('x', 1, 'video/mp4'))).toBe(true)
  })

  it('detects by extension when the MIME type is missing', () => {
    expect(isAudioFile(fakeFile('a.m4a', 1, ''))).toBe(true)
    expect(isVideoFile(fakeFile('a.MP4', 1, ''))).toBe(true)
  })

  it('does not classify audio as video or vice versa', () => {
    expect(isVideoFile(fakeFile('a.mp3', 1, 'audio/mpeg'))).toBe(false)
    expect(isAudioFile(fakeFile('a.mp4', 1, 'video/mp4'))).toBe(false)
  })
})
