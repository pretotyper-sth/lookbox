create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  color text,
  image_url text,
  storage_path text,
  source text not null default 'upload',
  status text not null default 'owned',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  mood text,
  type text not null default 'daily',
  item_ids uuid[] not null default '{}',
  look_image_url text,
  saved boolean not null default false,
  worn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  kind text not null,
  storage_path text not null,
  image_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, cache_key, kind)
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  image_count int,
  estimated_cost_usd numeric(12, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_wardrobe_items_user_status on public.wardrobe_items(user_id, status);
create index if not exists idx_outfits_user_created on public.outfits(user_id, created_at desc);
create index if not exists idx_generated_images_user_cache on public.generated_images(user_id, cache_key);
create index if not exists idx_credit_ledger_user on public.credit_ledger(user_id);

alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.outfits enable row level security;
alter table public.generated_images enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "wardrobe own rows" on public.wardrobe_items;
create policy "wardrobe own rows" on public.wardrobe_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "outfits own rows" on public.outfits;
create policy "outfits own rows" on public.outfits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "generated images own rows" on public.generated_images;
create policy "generated images own rows" on public.generated_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai logs own rows" on public.ai_usage_logs;
create policy "ai logs own rows" on public.ai_usage_logs
  for select using (auth.uid() = user_id);

drop policy if exists "credits own rows" on public.credit_ledger;
create policy "credits own rows" on public.credit_ledger
  for select using (auth.uid() = user_id);
