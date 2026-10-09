import { jest } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

// openai: client.audio.transcriptions.create
const create = jest.fn()
jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => ({ audio: { transcriptions: { create } } })),
}))

// supabase: from('transcriptions').select().eq().maybeSingle() / .upsert(), storage.from().download()
const maybeSingle = jest.fn()
const eq = jest.fn(() => ({ maybeSingle }))
const select = jest.fn(() => ({ eq }))
const upsert = jest.fn()
const download = jest.fn()
const supabase = {
  from: jest.fn(() => ({ select, upsert })),
  storage: { from: jest.fn(() => ({ download })) },
}
jest.unstable_mockModule('../lib/supabase.js', () => ({ supabase }))

const setUploadStatus = jest.fn()
jest.unstable_mockModule('../lib/uploadStatus.js', () => ({ setUploadStatus }))

// ffprobe / ffmpeg for files over Whisper's 25MB limit
const execFile = jest.fn()
jest.unstable_mockModule('child_process', () => ({ execFile }))

const { offsetSegments, processTranscribeJob } = await import('./transcribeWorker.js')

const MB = 1024 * 1024
const VIDEO_ID = 'transcribe-test-upload'
const tempFile = path.join(os.tmpdir(), `job-transcribe-${VIDEO_ID}.mp3`)
const job = { id: 'job-1', data: { uploadFileId: VIDEO_ID, audioPath: `${VIDEO_ID}/lecture.mp3` } }

// Whisper result. Read the file stream to the end like the real client does; destroying it
// unopened would race the worker's cleanup and emit ENOENT after the test.
function whisperReturns(...results) {
  let call = 0
  create.mockImplementation(async ({ file }) => {
    for await (const _ of file);
    return results[call++]
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(fs, 'unlink')

  maybeSingle.mockResolvedValue({ data: null, error: null })
  download.mockResolvedValue({ data: new Blob(['small audio']), error: null })
  upsert.mockResolvedValue({ error: null })
  whisperReturns({ text: ' Hello world ', segments: [{ id: 0, start: 0, end: 2, text: ' Hello world' }] })
})

afterEach(() => jest.restoreAllMocks())

describe('offsetSegments', () => {
  const segments = [
    { id: 0, start: 0, end: 4.5, text: ' Hello' },
    { id: 1, start: 4.5, end: 9, text: ' world' },
  ]

  it('shifts start and end by the offset and keeps other fields', () => {
    expect(offsetSegments(segments, 600)).toEqual([
      { id: 0, start: 600, end: 604.5, text: ' Hello' },
      { id: 1, start: 604.5, end: 609, text: ' world' },
    ])
  })

  it('does not mutate the input segments', () => {
    offsetSegments(segments, 600)
    expect(segments[0]).toEqual({ id: 0, start: 0, end: 4.5, text: ' Hello' })
  })

  it('returns an empty list for no segments', () => {
    expect(offsetSegments([], 600)).toEqual([])
  })
})

describe('processTranscribeJob', () => {
  describe('retry safety', () => {
    it('skips download and Whisper when a transcript already exists, and re-asserts completed', async () => {
      maybeSingle.mockResolvedValue({ data: { video_id: VIDEO_ID }, error: null })

      await expect(processTranscribeJob(job)).resolves.toEqual({ success: true, skipped: true })

      expect(supabase.from).toHaveBeenCalledWith('transcriptions')
      expect(eq).toHaveBeenCalledWith('video_id', VIDEO_ID)
      expect(download).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
      expect(upsert).not.toHaveBeenCalled()
      expect(setUploadStatus).toHaveBeenCalledWith(VIDEO_ID, 'completed')
    })

    it('throws without transcribing when the existence check fails', async () => {
      const dbError = { message: 'db down' }
      maybeSingle.mockResolvedValue({ data: null, error: dbError })

      await expect(processTranscribeJob(job)).rejects.toBe(dbError)

      expect(download).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
      expect(setUploadStatus).not.toHaveBeenCalled()
    })
  })

  it('throws and still cleans up when the audio download fails', async () => {
    const storageError = { message: 'not found' }
    download.mockResolvedValue({ data: null, error: storageError })

    await expect(processTranscribeJob(job)).rejects.toBe(storageError)

    expect(supabase.storage.from).toHaveBeenCalledWith('merged-audio')
    expect(download).toHaveBeenCalledWith(`${VIDEO_ID}/lecture.mp3`)
    expect(create).not.toHaveBeenCalled()
    expect(fs.unlink).toHaveBeenCalledWith(tempFile, expect.any(Function))
  })

  it('transcribes a small file in one Whisper call, upserts it, then marks completed', async () => {
    await expect(processTranscribeJob(job)).resolves.toEqual({ success: true })

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    }))
    expect(create.mock.calls[0][0].file.path).toBe(tempFile)
    expect(execFile).not.toHaveBeenCalled()

    expect(upsert).toHaveBeenCalledWith(
      { video_id: VIDEO_ID, text: 'Hello world', segments: [{ id: 0, start: 0, end: 2, text: ' Hello world' }] },
      { onConflict: 'video_id' }
    )
    expect(setUploadStatus).toHaveBeenCalledWith(VIDEO_ID, 'completed')
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(setUploadStatus.mock.invocationCallOrder[0])
    expect(fs.unlink).toHaveBeenCalledWith(tempFile, expect.any(Function))
  })

  it("throws and doesn't mark completed when the upsert fails", async () => {
    const insertError = { message: 'insert failed' }
    upsert.mockResolvedValue({ error: insertError })

    await expect(processTranscribeJob(job)).rejects.toBe(insertError)

    expect(setUploadStatus).not.toHaveBeenCalled()
  })

  it('splits a file over 25MB, offsets each chunk onto the full timeline, and cleans up every chunk', async () => {
    download.mockResolvedValue({ data: new Blob([new Uint8Array(25 * MB)]), error: null })
    // ffprobe reports 20 minutes; ffmpeg "writes" each chunk so Whisper can open it
    execFile.mockImplementation((cmd, args, callback) => {
      if (cmd === 'ffmpeg') fs.writeFileSync(args[args.length - 1], 'chunk audio')
      callback(null, { stdout: cmd === 'ffprobe' ? '1200.0\n' : '', stderr: '' })
    })
    whisperReturns(
      { text: 'First part.', segments: [{ id: 0, start: 0, end: 5, text: ' First part.' }] },
      { text: 'Second part.', segments: [{ id: 0, start: 1, end: 4, text: ' Second part.' }] },
    )

    await processTranscribeJob(job)

    // 25MB / 24MB chunks -> 2 chunks of 600s each
    const ffmpegCalls = execFile.mock.calls.filter(([cmd]) => cmd === 'ffmpeg')
    expect(ffmpegCalls).toHaveLength(2)
    expect(ffmpegCalls.map(([, args]) => args[args.indexOf('-ss') + 1])).toEqual(['0', '600'])
    expect(ffmpegCalls.map(([, args]) => args[args.indexOf('-t') + 1])).toEqual(['600', '600'])
    expect(create.mock.calls.map(([{ file }]) => file.path)).toEqual([`${tempFile}.0.mp3`, `${tempFile}.1.mp3`])

    expect(upsert).toHaveBeenCalledWith({
      video_id: VIDEO_ID,
      text: 'First part. Second part.',
      segments: [
        { id: 0, start: 0, end: 5, text: ' First part.' },
        { id: 0, start: 601, end: 604, text: ' Second part.' },
      ],
    }, { onConflict: 'video_id' })

    for (const file of [tempFile, `${tempFile}.0.mp3`, `${tempFile}.1.mp3`]) {
      expect(fs.unlink).toHaveBeenCalledWith(file, expect.any(Function))
    }
  })
})
