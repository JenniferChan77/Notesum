import 'dotenv/config'
import { Worker } from 'bullmq'
import connection from '../lib/redis.js'
import { markFailedIfFinal } from '../lib/uploadStatus.js'
import { processMergeJob } from './mergeWorker.js'
import { processTranscribeJob } from './transcribeWorker.js'

// Workers are created here rather than in the processor modules, so tests can
// import the processors without opening a Redis connection.
const mergeWorker = new Worker('merge-chunk', processMergeJob, {
  connection,
  concurrency: 2 // Limits how many FFmpeg jobs run at once on one machine
})
mergeWorker.on('failed', markFailedIfFinal)

const transcribeWorker = new Worker('transcribe', processTranscribeJob, {
  connection,
  concurrency: 1
})
transcribeWorker.on('failed', markFailedIfFinal)
