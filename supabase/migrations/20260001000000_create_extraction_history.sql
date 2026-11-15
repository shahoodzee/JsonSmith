-- Run this SQL in your Supabase project SQL editor before using the History feature.
-- Table: extraction_history
-- Stores each successful Image to JSON extraction result.

create table if not exists public.extraction_history (
  id uuid default gen_random_uuid() primary key,
  image_filename text not null,
  signed_url text,
  extracted_json text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS (required for Supabase Postgres).
-- This open policy allows all access until PE7 (user auth) lands.
alter table public.extraction_history enable row level security;

create policy "Allow all access (pre-auth)"
  on public.extraction_history
  for all
  using (true)
  with check (true);
