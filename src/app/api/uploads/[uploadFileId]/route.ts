import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Polled by the upload page until the status is 'completed' or 'failed'.
// RLS keeps this to the signed-in user's own uploads.
export async function GET(
  _req: NextRequest,
  { params }: { params: { uploadFileId: string } }
) {
  const { uploadFileId } = params
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: upload, error } = await supabase
    .from('uploads')
    .select('id, file_name, status, error, updated_at')
    .eq('id', uploadFileId)
    .maybeSingle()

  if (error) {
    console.error(`Failed to read upload ${uploadFileId}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  if (upload.status !== 'completed') {
    return NextResponse.json({ ...upload, transcript: null })
  }

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcriptions')
    .select('text, segments')
    .eq('video_id', uploadFileId)
    .maybeSingle()

  if (transcriptError) {
    console.error(`Failed to read transcript for ${uploadFileId}:`, transcriptError)
    return NextResponse.json({ error: transcriptError.message }, { status: 500 })
  }

  return NextResponse.json({ ...upload, transcript })
}
