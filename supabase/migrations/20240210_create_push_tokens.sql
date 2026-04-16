-- Create table for storing push notification tokens
create table if not exists public.push_tokens (
  token text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (token, user_id)
);

-- Enable RLS
alter table public.push_tokens enable row level security;

-- Policies
create policy "Users can insert their own tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

create policy "Users can view their own tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);
