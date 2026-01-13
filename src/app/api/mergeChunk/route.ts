import { NextResponse } from "next/server";
import {Queue} from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL!,{
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})
const mergeQueue = new Queue('merge-chunk',{
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30_000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
  })

export async function POST(req: Request) {
  const { uploadId, totalChunks, fileName, fileType } = await req.json()
  const job = await mergeQueue.add('merge', {
    uploadId,
    totalChunks,
    fileName,
    fileType
  })

  return NextResponse.json({jobId: job.id})
}