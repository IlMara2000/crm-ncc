create table if not exists public.invoice_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id text not null,
  provider text not null,
  provider_document_id text,
  provider_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.invoice_exports enable row level security;

drop policy if exists "Users can read their invoice exports" on public.invoice_exports;

create policy "Users can read their invoice exports"
  on public.invoice_exports
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists invoice_exports_user_created_at_idx
  on public.invoice_exports (user_id, created_at desc);

create index if not exists invoice_exports_invoice_id_idx
  on public.invoice_exports (invoice_id);
