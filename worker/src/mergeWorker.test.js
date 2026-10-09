import { jest } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

// supabase: storage.from(bucket).download(path) / .upload(path, stream, options)
const download = jest.fn()
const upload = jest.fn()
const supabase = { storage: { from: jest.fn(() => ({ download, upload })) } }
jest.unstable_mockModule('../lib/supabase.js', () => ({ supabase }))

const setUploadStatus = jest.fn()
jest.unstable_mockModule('../lib/uploadStatus.js', () => ({ setUploadStatus }))

const transcribeQueue = { add: jest.fn() }
jest.unstable_mockModule('../lib/queues/transcribeQueue.js', () => ({ transcribeQueue }))

// Chainable fluent-ffmpeg stand-in. save() records the reassembled input it was given,
// then either writes a fake mp3 and fires 'end', or fires 'error' when ffmpegFails is set.
let ffmpegFails = false
function fakeCommand(input) {
  const handlers = {}
  const command = {}
  for (const method of ['noVideo', 'audioCodec', 'audioBitrate', 'audioChannels', 'audioFrequency', 'format']) {
    command[method] = jest.fn(() => command)
  }
  command.on = jest.fn((event, handler) => {
    handlers[event] = handler
    return command
  })
  command.save = jest.fn((output) => {
    command.inputContents = fs.readFileSync(input, 'utf8')
    setImmediate(() => {
      if (ffmpegFails) return handlers.error(new Error('ffmpeg exploded'))
      fs.writeFileSync(output, 'mp3 bytes')
      handlers.end()
    })
    return command
  })
  return command
}
const ffmpeg = Object.assign(jest.fn(), { setFfmpegPath: jest.fn() })
jest.unstable_mockModule('@ts-ffmpeg/fluent-ffmpeg', () => ({ default: ffmpeg }))

const { toMp3Path, processMergeJob } = await import('./mergeWorker.js')

const UPLOAD_ID = 'merge-test-upload'
const workDir = path.join(os.tmpdir(), `job-${UPLOAD_ID}`)
const job = { id: 'job-1', data: { uploadFileId: UPLOAD_ID, totalChunks: 3, fileName: 'lecture.mp4' } }

const lastCommand = () => ffmpeg.mock.results[0].value
const statusesSet = () => setUploadStatus.mock.calls.map(([, status]) => status)

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  ffmpegFails = false
  ffmpeg.mockImplementation(fakeCommand)

  download.mockImplementation(async (chunkPath) => ({
    data: new Blob([`<${chunkPath.split('/').pop()}>`]),
    error: null,
  }))
  // Drain the stream like the real client would, so the read handle closes
  upload.mockImplementation(async (_name, stream) => {
    for await (const _ of stream);
    return { error: null }
  })
  transcribeQueue.add.mockResolvedValue({ id: 'transcribe-job' })
})

afterEach(() => jest.restoreAllMocks())

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

describe('processMergeJob', () => {
  it('reassembles chunks in order, extracts audio, uploads it, then queues transcription', async () => {
    await expect(processMergeJob(job)).resolves.toEqual({
      success: true,
      outputName: `${UPLOAD_ID}/lecture.mp3`,
    })

    // 1. Chunks downloaded in order from audio-temp and concatenated in that order
    expect(supabase.storage.from).toHaveBeenCalledWith('audio-temp')
    expect(download.mock.calls.map(([p]) => p)).toEqual([0, 1, 2].map((i) => `temp/${UPLOAD_ID}/${i}-lecture.mp4`))
    expect(lastCommand().inputContents).toBe('<0-lecture.mp4><1-lecture.mp4><2-lecture.mp4>')

    // 2. Audio extracted as mono 16kHz mp3
    expect(lastCommand().noVideo).toHaveBeenCalled()
    expect(lastCommand().audioChannels).toHaveBeenCalledWith(1)
    expect(lastCommand().audioFrequency).toHaveBeenCalledWith(16000)
    expect(lastCommand().format).toHaveBeenCalledWith('mp3')

    // 3. Uploaded to merged-audio under the .mp3 name
    expect(supabase.storage.from).toHaveBeenCalledWith('merged-audio')
    expect(upload).toHaveBeenCalledWith(
      `${UPLOAD_ID}/lecture.mp3`,
      expect.anything(),
      expect.objectContaining({ contentType: 'audio/mpeg' })
    )

    // 4. Status goes processing -> transcribing, and transcribing is set BEFORE the job is
    // queued so a fast transcribe job's 'completed' can't be overwritten
    expect(statusesSet()).toEqual(['processing', 'transcribing'])
    expect(transcribeQueue.add).toHaveBeenCalledWith('transcribe', {
      uploadFileId: UPLOAD_ID,
      audioPath: `${UPLOAD_ID}/lecture.mp3`,
    })
    expect(setUploadStatus.mock.invocationCallOrder[1]).toBeLessThan(transcribeQueue.add.mock.invocationCallOrder[0])

    expect(fs.existsSync(workDir)).toBe(false)
  })

  it('stops at a failed chunk download without extracting, uploading or queueing', async () => {
    const storageError = { message: 'chunk missing' }
    download.mockImplementation(async (chunkPath) =>
      chunkPath.includes('/1-')
        ? { data: null, error: storageError }
        : { data: new Blob(['chunk']), error: null }
    )

    await expect(processMergeJob(job)).rejects.toBe(storageError)

    expect(download).toHaveBeenCalledTimes(2)
    expect(ffmpeg).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(transcribeQueue.add).not.toHaveBeenCalled()
    expect(statusesSet()).toEqual(['processing'])
    expect(fs.existsSync(workDir)).toBe(false)
  })

  it('throws and cleans up when ffmpeg fails', async () => {
    ffmpegFails = true

    await expect(processMergeJob(job)).rejects.toThrow('ffmpeg exploded')

    expect(upload).not.toHaveBeenCalled()
    expect(transcribeQueue.add).not.toHaveBeenCalled()
    expect(fs.existsSync(workDir)).toBe(false)
  })

  it("doesn't set transcribing or queue the job when the audio upload fails", async () => {
    const uploadError = { message: 'bucket full' }
    upload.mockImplementation(async (_name, stream) => {
      for await (const _ of stream);
      return { error: uploadError }
    })

    await expect(processMergeJob(job)).rejects.toBe(uploadError)

    expect(statusesSet()).toEqual(['processing'])
    expect(transcribeQueue.add).not.toHaveBeenCalled()
    expect(fs.existsSync(workDir)).toBe(false)
  })
})
