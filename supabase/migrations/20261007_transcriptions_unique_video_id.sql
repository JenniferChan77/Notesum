-- One transcript per upload. Without this, a retried transcribe job that already
-- inserted (crash/stall after commit) writes a second row for the same video_id,
-- which breaks the .maybeSingle() read in /api/uploads/[uploadFileId].
-- Run in the Supabase SQL editor.

-- 1. Collapse any duplicates already in the table, keeping the first physical row.
--    ctid is used so this works without knowing whether the table has created_at/id.
delete from public.transcriptions t
using public.transcriptions d
where t.video_id = d.video_id
  and t.ctid > d.ctid;

-- 2. Enforce it going forward. A unique index (not just a constraint) is enough for
--    PostgREST/supabase-js to infer `on conflict (video_id)` for upserts.
create unique index if not exists transcriptions_video_id_key
  on public.transcriptions (video_id);
