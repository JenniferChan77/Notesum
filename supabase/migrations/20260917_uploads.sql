-- Tracks each upload's progress through the pipeline so the frontend can poll it.
-- Run in the Supabase SQL editor.

-- 1. uploads table
create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name   text not null,
  status      text not null default 'uploading'
              check (status in ('uploading', 'queued', 'processing', 'transcribing', 'completed', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists uploads_user_id_idx on public.uploads (user_id);

-- keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists uploads_set_updated_at on public.uploads;
create trigger uploads_set_updated_at
  before update on public.uploads
  for each row execute function public.set_updated_at();

-- 2. RLS on uploads
-- The worker uses the service-role key, which bypasses RLS.
alter table public.uploads enable row level security;

drop policy if exists "uploads: select own" on public.uploads;
create policy "uploads: select own"
  on public.uploads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "uploads: insert own" on public.uploads;
create policy "uploads: insert own"
  on public.uploads for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'uploading');

-- Users may only move their own upload to 'queued' (done by /api/mergeChunk).
-- Every other status change comes from the worker.
drop policy if exists "uploads: queue own" on public.uploads;
create policy "uploads: queue own"
  on public.uploads for update
  to authenticated
  using (user_id = auth.uid() and status = 'uploading')
  with check (user_id = auth.uid() and status = 'queued');

revoke update on public.uploads from authenticated;
grant update (status) on public.uploads to authenticated;

-- 3. RLS on transcriptions: readable only by the owner of the matching upload.
-- The ::text casts make this work whether video_id is uuid or text.
alter table public.transcriptions enable row level security;

drop policy if exists "transcriptions: select own" on public.transcriptions;
create policy "transcriptions: select own"
  on public.transcriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.uploads u
      where u.id::text = transcriptions.video_id::text
        and u.user_id = auth.uid()
    )
  );
