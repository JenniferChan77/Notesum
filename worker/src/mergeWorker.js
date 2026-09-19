import { Worker } from 'bullmq'
import connection from '../lib/redis.js'
import { supabase } from '../lib/supabase.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Readable } from 'stream'
import ffmpeg from '@ts-ffmpeg/fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { transcribeQueue } from '../lib/queues/transcribeQueue.js'
import { setUploadStatus, markFailedIfFinal } from '../lib/uploadStatus.js'

ffmpeg.setFfmpegPath(ffmpegPath)

export const worker = new Worker(
  'merge-chunk',
  async (job) => {
    const { uploadFileId, totalChunks, fileName } = job.data
    const outputName = `${uploadFileId}/${fileName.replace(/\.[^/.]+$/, '.mp3')}`

    const workDir = path.join(os.tmpdir(), `job-${uploadFileId}`)
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir)
    
    const tempVideoPath = path.join(workDir, 'input-video')
    const tempAudioPath = path.join(workDir, 'output.mp3')

    try {
      await setUploadStatus(uploadFileId, 'processing')

      /* 1. Reassemble chunks using a WriteStream */
      const writeStream = fs.createWriteStream(tempVideoPath)

      for (let i = 0; i < totalChunks; i++) {
        const {data, error} = await supabase.storage
          .from('audio-temp')
          .download(`temp/${uploadFileId}/${i}-${fileName}`)
        
        if (error) {
          console.error(`Error processing job: ${job.id} for downloading supabase chunk:`, error)
          throw error
        }

        const nodeStream = Readable.fromWeb(data.stream())
        for await (const chunk of nodeStream) {
          if (!writeStream.write(chunk)) {
            await new Promise(resolve => writeStream.once('drain', resolve))
          }
        }
      }
      
      await new Promise((resolve, reject)=>{
        writeStream
          .on('finish', resolve)
          .on('error', reject)
          .end()
      })

      /* 2. extract audio */
      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate(48)
          .audioChannels(1)
          .audioFrequency(16000)
          .format('mp3')
          .on('error', reject)
          .on('end', resolve)
          .save(tempAudioPath)
      })

      /* 3. upload the final audio */
      const audioReadStream = fs.createReadStream(tempAudioPath)
      const {error: uploadError} = await supabase.storage
        .from('merged-audio')
        .upload(outputName, audioReadStream, {
          contentType: 'audio/mpeg',
          duplex: 'half'
        })

      if (uploadError) {
        console.error(`Error processing job ${job.id} for uploading merged audio`, uploadError)
        throw uploadError
      }

      // Set status first so a fast transcribe job can't finish and then get overwritten
      await setUploadStatus(uploadFileId, 'transcribing')

      // Enqueue the transcribe job after a successful upload
      await transcribeQueue.add('transcribe', {
        uploadFileId,
        audioPath: outputName
      })

      return { success: true, outputName}

    } catch(err) {
      console.error(`Merge job ${job.id} for upload ${uploadFileId} failed:`, err);
      throw err
    } finally {
      // This always runs, cleaning up files whether we succeeded or failed.
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, {recursive: true, force: true})
      }
    }
  },
  { 
    connection,
    concurrency: 2 // Limits how many FFmpeg jobs run at once on one machine
  }
)

worker.on('failed', markFailedIfFinal)
