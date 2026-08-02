-- Create bucket for SOS recordings
insert into storage.buckets (id, name, public)
values ('sos-recordings', 'sos-recordings', true)
on conflict (id) do nothing;

-- Policy to allow authenticated users to upload recordings
create policy "Authenticated users can upload recordings"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'sos-recordings' );

-- Policy to allow public to view recordings (for emergency links)
create policy "Public can view recordings"
on storage.objects for select
to public
using ( bucket_id = 'sos-recordings' );

-- Update sos_alerts table
alter table sos_alerts 
add column if not exists media_url text,
add column if not exists mode text DEFAULT 'visible'; -- 'visible' or 'discrete'

-- Create safe_zones table
create table if not exists safe_zones (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius double precision default 100, -- meters
  type text default 'general', -- home, school, work, gym
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for safe_zones
alter table safe_zones enable row level security;

create policy "Users can manage their own safe zones"
on safe_zones for all
using (auth.uid() = user_id);

-- Create family_stats table
create table if not exists family_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  week_start_date date not null,
  safe_arrivals_count int default 0,
  risk_alerts_count int default 0,
  routes_completed_count int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, week_start_date)
);

-- RLS for family_stats
alter table family_stats enable row level security;

create policy "Users can view their family stats"
on family_stats for select
using (auth.uid() = user_id); 
-- Note: In a real family app, we'd add logic to allow family members to view stats
