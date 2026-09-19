import PQueue from "p-queue";
import { chunkFile } from "@/lib/utils/chunkFile"

// POSTs JSON and throws with the server's error message on a non-OK response
async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `${url} failed (${res.status})`)
  return data
}

// Uploads the file in chunks and queues it for processing.
// Returns the uploadFileId to poll with GET /api/uploads/[uploadFileId].
export async function uploadFile(file:File): Promise<string> {
  const chunks = chunkFile(file)

  // 1. Create the upload record; its id ties every chunk to this file
  const { uploadFileId } = await postJson('/api/uploads', { fileName: file.name })

   // Queue with a concurrency limit (e.g., 3 uploads at once)
  const queue = new PQueue({concurrency: 3})

  async function uploadChunk(chunk: Blob, index: number) {
    // 2. Ask backend for signed URL
    const { signedUrl } = await postJson('/api/getSignedUrl', {
      uploadFileId,
      chunkIndex: index,
    })

    // 3. Upload the chunk using PUT
    const res = await fetch(signedUrl, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`Chunk ${index} upload failed (${res.status})`)
  }

  // Queue each chunk upload. Await the promises (not queue.onIdle()) so a
  // failed chunk rejects here instead of silently letting the merge start.
  await Promise.all(
    chunks.map((chunk, index) => queue.add(() => uploadChunk(chunk, index)))
  )

  // 4. Tell server to merge
  await postJson('/api/mergeChunk', {
    uploadFileId,
    totalChunks: chunks.length,
    fileType: file.type
  })

  return uploadFileId
}