create table if not exists public.user_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table public.user_notification_state enable row level security;

drop policy if exists "user_notification_state_select_own" on public.user_notification_state;
create policy "user_notification_state_select_own" on public.user_notification_state
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_notification_state_insert_own" on public.user_notification_state;
create policy "user_notification_state_insert_own" on public.user_notification_state
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_notification_state_update_own" on public.user_notification_state;
create policy "user_notification_state_update_own" on public.user_notification_state
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.user_notification_state to authenticated;

create table if not exists public.user_match_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_keys text[] not null default '{}'::text[],
  initialized boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_match_state enable row level security;

drop policy if exists "user_match_state_select_own" on public.user_match_state;
create policy "user_match_state_select_own" on public.user_match_state
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_match_state_insert_own" on public.user_match_state;
create policy "user_match_state_insert_own" on public.user_match_state
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_match_state_update_own" on public.user_match_state;
create policy "user_match_state_update_own" on public.user_match_state
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.user_match_state to authenticated;