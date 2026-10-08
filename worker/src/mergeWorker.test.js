import { jest } from '@jest/globals'

jest.unstable_mockModule('../lib/supabase.js', () => ({ supabase: {} }))
jest.unstable_mockModule('../lib/uploadStatus.js', () => ({ setUploadStatus: jest.fn() }))
jest.unstable_mockModule('../lib/queues/transcribeQueue.js', () => ({ transcribeQueue: { add: jest.fn() } }))
jest.unstable_mockModule('@ts-ffmpeg/fluent-ffmpeg', () => ({
  default: Object.assign(jest.fn(), { setFfmpegPath: jest.fn() }),
}))

const { toMp3Path } = await import('./mergeWorker.js')

describe('toMp3Path', () => {
  it.each([
    ['lecture.mp4', 'u1/lecture.mp3'],
    ['lecture.MP3', 'u1/lecture.mp3'],
    ['week.1.notes.wav', 'u1/week.1.notes.mp3'],
    ['my lecture.m4a', 'u1/my lecture.mp3'],
  ])('%s -> %s', (fileName, expected) => {
    expect(toMp3Path('u1', fileName)).toBe(expected)
  })

  // No extension to replace, so none is added. Harmless: the bucket object is still
  // uploaded as audio/mpeg and the transcribe worker saves it locally as .mp3.
  it('leaves a name without an extension unchanged', () => {
    expect(toMp3Path('u1', 'lecture')).toBe('u1/lecture')
  })
})
