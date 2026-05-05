create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  token_type text,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

drop policy if exists "Users can delete their Google Calendar token" on public.google_calendar_tokens;

create policy "Users can delete their Google Calendar token"
  on public.google_calendar_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists google_calendar_tokens_expires_at_idx
  on public.google_calendar_tokens (expires_at);
