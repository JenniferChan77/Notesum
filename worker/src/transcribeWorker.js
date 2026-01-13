import { Worker } from "bullmq";
import fs from 'fs'
import path from 'path'
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import OpenAI from 'openai'
import { supabase } from "../lib/supabase.js";
import connection from "../lib/redis.js";
import { Readable } from 'stream'

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

export const transcribeWorker = new Worker(
  'transcribe',
  async job => {
    const {uploadId: videoId, audioPath} = job.data
    const tempFile = path.join(tmpdir(), `job-transcribe-${videoId}.mp3`)
    // Track all files for cleanup
    const createdFiles = [tempFile] 

    try {
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

          for (const seg of res.segments) {
            fullSegments.push({
              ...seg,
              start: seg.start + chunk.offset,
              end: seg.end + chunk.offset
            })
          }
        }
      }
      
      // 3. Store result
      const { error: insertError } = await supabase
        .from('transcriptions')
        .insert({
          video_id: videoId,
          text: fullText.trim(),
          segments: fullSegments
        })

      if (insertError) {
        console.error(`Error processing job ${job.id} for uploading transcription`, insertError)
      }

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
  },
  {
    connection,
    concurrency: 1
  }
)