import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Creates the upload record the rest of the pipeline hangs off of.
// The client uses the returned id as its uploadFileId for every later request.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { fileName } = await req.json()
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('uploads')
    .insert({ user_id: user.id, file_name: fileName, status: 'uploading' })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create upload record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ uploadFileId: data.id })
}
