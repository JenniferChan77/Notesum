import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { uploadFileId, chunkIndex } = await req.json()
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: 'chunkIndex must be a non-negative integer' }, { status: 400 })
  }

  // RLS limits this to the user's own uploads, so "not found" also covers "not yours".
  const { data: upload } = await supabase
    .from('uploads')
    .select('id, file_name, status')
    .eq('id', uploadFileId)
    .maybeSingle()

  if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  if (upload.status !== 'uploading') {
    return NextResponse.json({ error: 'Upload is no longer accepting chunks' }, { status: 409 })
  }

  // Use the stored file name rather than one the client sends, so the chunk
  // paths always match what the merge worker looks for.
  const chunkPath = `temp/${upload.id}/${chunkIndex}-${upload.file_name}`

  const { data, error } = await supabase.storage
    .from('audio-temp')
    .createSignedUploadUrl(chunkPath); // 10 min

  if (error) return NextResponse.json(error, { status: 500 })
  return NextResponse.json({ signedUrl: data.signedUrl })
}
