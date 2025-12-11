import { NextRequest, NextResponse } from "next/server";
import {createServerSupabaseClient} from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { uploadId, chunkIndex, fileName } = await req.json()
  const chunkPath = `temp/${uploadId}/${chunkIndex}-${fileName}`
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase.storage
    .from('audio-temp')
    .createSignedUploadUrl(chunkPath); // 10 min

  if (error) return NextResponse.json(error,{status: 500})
  return NextResponse.json({ signedUrl: data.signedUrl })
}