create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'en-IN' check (preferred_language in ('en-IN','hi-IN','ta-IN')),
  general_location text,
  crops text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null default 'en-IN' check (locale in ('en-IN','hi-IN','ta-IN')),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_created_idx on public.conversations(user_id,created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  locale text not null default 'en-IN',
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists messages_user_created_idx on public.messages(user_id,created_at desc);

create table if not exists public.crop_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crop_id text not null,
  predicted_label text,
  model_score double precision,
  uncertainty text not null,
  result jsonb not null default '{}'::jsonb,
  model_version text,
  created_at timestamptz not null default now()
);
create index if not exists crop_scans_user_created_idx on public.crop_scans(user_id,created_at desc);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_label text not null,
  provider text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists weather_user_fetched_idx on public.weather_snapshots(user_id,fetched_at desc);

create table if not exists public.farm_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crop_id text,
  location_label text,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.crop_scans enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.farm_reports enable row level security;

create policy "profile owner access" on public.profiles for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "conversation owner access" on public.conversations for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "message owner access" on public.messages for all to authenticated using (user_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=auth.uid())) with check (user_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy "scan owner access" on public.crop_scans for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "weather owner access" on public.weather_snapshots for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "report owner access" on public.farm_reports for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('crop-photos','crop-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "user can manage own crop photos" on storage.objects for all to authenticated
using (bucket_id='crop-photos' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='crop-photos' and (storage.foldername(name))[1]=auth.uid()::text);
