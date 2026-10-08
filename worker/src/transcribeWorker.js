import fs from 'fs'
import path from 'path'
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import OpenAI from 'openai'
import { supabase } from "../lib/supabase.js";
import { Readable } from 'stream'
import { setUploadStatus } from "../lib/uploadStatus.js";

const exec = promisify(execFile)

const MAX_MB = 25
const CHUNK_MB = 24

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

function getFileSizeMB(filePath) {
  return fs.statSync(filePath).size / ( 1024 * 1024 )
}

async function getAudioDuration(filePath) {
  const {stdout} = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ])
  return parseFloat(stdout)
}

async function splitAudio(input, duration) {
  const totalSizeMB = getFileSizeMB(input)
  const chunks = Math.ceil(totalSizeMB / CHUNK_MB)
  const chunkDuration = duration / chunks
  const results = []

  for (let i = 0; i < chunks; i++) {
    const out = `${input}.${i}.mp3`
    const start = i * chunkDuration

    await exec('ffmpeg', [
      '-y',
      '-i', input,
      '-ss', start.toString(),
      '-t', chunkDuration.toString(),
      '-ac', '1',
      '-ar', '16000',
      '-b:a', '64k',
      out
    ])
    results.push({file: out, offset: start})
  }
  return results
}

async function transcribe(file) {
  return openai.audio.transcriptions.create({
    file: fs.createReadStream(file),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  })
}

// Whisper timestamps are relative to the chunk it was sent; shift them onto the full file's timeline
export function offsetSegments(segments, offset) {
  return segments.map(seg => ({
    ...seg,
    start: seg.start + offset,
    end: seg.end + offset
  }))
}

// BullMQ processor for 'transcribe' jobs (the Worker itself is created in index.js)
export async function processTranscribeJob(job) {
  const {uploadFileId: videoId, audioPath} = job.data
  const tempFile = path.join(tmpdir(), `job-transcribe-${videoId}.mp3`)
  // Track all files for cleanup
  const createdFiles = [tempFile]

  try {
    // 0. A retry can land here after a previous attempt already inserted (crash or
    // stall after the commit). Re-running would bill Whisper again for the same audio.
    const {data: existing, error: existingError} = await supabase
      .from('transcriptions')
      .select('video_id')
      .eq('video_id', videoId)
      .maybeSingle()

    // Unknown state — let BullMQ retry rather than risk a duplicate transcription.
    if (existingError) {
      console.error(`Error processing job ${job.id} for checking existing transcription`, existingError)
      throw existingError
    }

    if (existing) {
      console.log(`Transcript already exists for ${videoId}, skipping re-transcription`)
      // The previous attempt may have died between the insert and this status write.
      await setUploadStatus(videoId, 'completed')
      return { success: true, skipped: true }
    }

    // 1. Download audio
    const {data, error} = await supabase
      .storage
      .from('merged-audio')
      .download(audioPath)

    if (error) {
      console.error(`Error processing job: ${job.id} for downloading supabase audio:`, error)
      throw error
    }

    await pipeline(Readable.fromWeb(data.stream()), fs.createWriteStream(tempFile))

    const sizeMB = getFileSizeMB(tempFile)

    let fullText = ''
    let fullSegments = []

    // 2. Transcribe audio
    if (sizeMB < MAX_MB) {
      const res = await transcribe(tempFile)
      fullText = res.text
      fullSegments = res.segments
    } else {
      const duration = await getAudioDuration(tempFile)
      const chunks = await splitAudio(tempFile, duration)

      for (const chunk of chunks) {
        // Add chunks to tracking for cleanup
        createdFiles.push(chunk.file)

        const res = await transcribe(chunk.file)
        fullText += res.text + ' '
        fullSegments.push(...offsetSegments(res.segments, chunk.offset))
      }
      console.log('transcribing succeeded')
    }

    // 3. Store result. Upsert, not insert: the check above can miss a previous
    // attempt whose insert committed after this attempt's read, and the unique
    // index on video_id would then fail the job over an already-good transcript.
    const { error: insertError } = await supabase
      .from('transcriptions')
      .upsert({
        video_id: videoId,
        text: fullText.trim(),
        segments: fullSegments
      }, { onConflict: 'video_id' })

    if (insertError) {
      console.error(`Error processing job ${job.id} for uploading transcription`, insertError)
      throw insertError
    }

    await setUploadStatus(videoId, 'completed')

    return { success: true }
  } catch (err) {
    console.error(`Transcription job ${job.id} for ${videoId} failed:`, err);
    throw err;
  } finally {
    // 4. Guaranteed Cleanup
    for (const filePath of createdFiles) {
      fs.unlink(filePath, () => {})
    }
  }
}
