import PQueue from "p-queue";
import { chunkFile } from "@/lib/utils/chunkFile"

export async function uploadFile(file:File) {
  const chunks = chunkFile(file)
  const uploadId = crypto.randomUUID();

   // Queue with a concurrency limit (e.g., 3 uploads at once)
  const queue = new PQueue({concurrency: 3})

  async function uploadChunk(chunk: Blob, index: number) {
    // 1. Ask backend for signed URL
    const res = await fetch('/api/getSignedUrl', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        chunkIndex: index,
        fileName: file.name,
      }),
    })

    const { signedUrl } = await res.json();

    // 2. Upload the chunk using PUT
    await fetch(signedUrl, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }

  // Queue each chunk upload
  chunks.forEach((chunk, index) => {
    queue.add(() => uploadChunk(chunk, index))
  })

  // Wait for all queue jobs to finish
  await queue.onIdle();
}