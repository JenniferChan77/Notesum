import { NextResponse } from "next/server";
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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
  const { uploadFileId, totalChunks, fileType } = await req.json()
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!Number.isInteger(totalChunks) || totalChunks < 1) {
    return NextResponse.json({ error: 'totalChunks must be a positive integer' }, { status: 400 })
  }

  // Flip 'uploading' -> 'queued'. RLS allows this only on the user's own row,
  // so a miss here means the upload isn't theirs or was already queued.
  const { data: upload, error } = await supabase
    .from('uploads')
    .update({ status: 'queued' })
    .eq('id', uploadFileId)
    .eq('status', 'uploading')
    .select('id, file_name')
    .maybeSingle()

  if (error) {
    console.error(`Failed to queue upload ${uploadFileId}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!upload) return NextResponse.json({ error: 'Upload not found or already queued' }, { status: 404 })
  const job = await mergeQueue.add('merge', {
    uploadFileId: upload.id,
    totalChunks,
    fileName: upload.file_name,
    fileType
  })

  return NextResponse.json({ uploadFileId: upload.id, jobId: job.id })
}
