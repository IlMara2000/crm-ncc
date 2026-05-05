create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

drop policy if exists "Users can read their workspace" on public.workspaces;
drop policy if exists "Users can insert their workspace" on public.workspaces;
drop policy if exists "Users can update their workspace" on public.workspaces;
drop policy if exists "Users can delete their workspace" on public.workspaces;

create policy "Users can read their workspace"
  on public.workspaces
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their workspace"
  on public.workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their workspace"
  on public.workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their workspace"
  on public.workspaces
  for delete
  to authenticated
  using (auth.uid() = user_id);
