-- Execute once in the Supabase SQL editor for your private PediaQ project.
-- Client uses only a publishable/anon key, never the service_role key.
create table if not exists public.pediaq_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  question_id text not null,
  answer text not null check (answer in ('A','B','C','D','E')),
  correct boolean not null,
  answered_at timestamptz not null,
  rating text check (rating is null or rating in ('easy','normal','unsure')),
  rating_updated_at timestamptz not null,
  primary key (user_id, event_id)
);
create index if not exists pediaq_attempts_by_user_question
  on public.pediaq_attempts(user_id, question_id, answered_at);

create table if not exists public.pediaq_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  excluded boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, question_id)
);

alter table public.pediaq_attempts enable row level security;
alter table public.pediaq_preferences enable row level security;

revoke all on public.pediaq_attempts from anon;
revoke all on public.pediaq_preferences from anon;
grant select, insert, update on public.pediaq_attempts to authenticated;
grant select, insert, update on public.pediaq_preferences to authenticated;

create policy "Read own attempts"
  on public.pediaq_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Insert own attempts"
  on public.pediaq_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own attempts"
  on public.pediaq_attempts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Read own preferences"
  on public.pediaq_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Insert own preferences"
  on public.pediaq_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own preferences"
  on public.pediaq_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
