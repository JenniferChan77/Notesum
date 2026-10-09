import { supabase } from './supabase.js'

// Updates the `uploads` row the frontend polls. Failures are logged, not thrown:
// a status write shouldn't make BullMQ retry (and redo) the expensive work.
export async function setUploadStatus(uploadFileId, status, error = null) {
  const { error: updateError } = await supabase
    .from('uploads')
    .update({ status, error })
    .eq('id', uploadFileId)

  if (updateError) {
    console.error(`Failed to set upload ${uploadFileId} status to '${status}':`, updateError)
  }
}

// Worker 'failed' handler: only mark the upload failed once retries are used up,
// so the UI doesn't show "failed" while a retry is still pending.
export async function markFailedIfFinal(job, err) {
  if (!job) return
  const maxAttempts = job.opts.attempts ?? 1
  if (job.attemptsMade < maxAttempts) return

  await setUploadStatus(job.data.uploadFileId, 'failed', err?.message ?? 'Unknown error')
}
