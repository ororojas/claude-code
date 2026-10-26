-- A-level revision tracker: schema, row level security and seeding functions.
--
-- Everything lives in its own "mocks" schema, so the tracker can share a
-- Supabase project with other apps without clashing with their tables. It adds
-- nothing to "public" and no triggers on auth.users. Expose the schema to the
-- API in Supabase: Project Settings → Data API → Exposed schemas → add "mocks".
--
-- Two kinds of table:
--   * Reference data (subjects, topics, past_papers, plan_template, default
--     grade boundaries). Seeded by the next migration, read-only for users.
--   * Per-user data (everything with a user_id). Locked to the owner by RLS.

create schema if not exists mocks;
grant usage on schema mocks to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type mocks.rag_status as enum ('red', 'amber', 'green');

create type mocks.block_kind as enum (
  'content',      -- first-pass learning of a topic
  'timed_paper',  -- full paper under exam conditions
  'marking',      -- mark with the mark scheme, log score + dropped marks
  'mop_up',       -- fix red/amber topics
  'recall',       -- flashcards, blurting, essay plans
  'exam'          -- the mock itself
);

create type mocks.paper_kind as enum ('past_paper', 'specimen', 'as_paper');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table mocks.subjects (
  id                   text primary key,          -- 'econ' | 'business' | 'sociology'
  name                 text not null,
  board                text not null,
  spec_code            text not null,
  paper_label          text not null,
  duration_minutes     int  not null,
  max_marks            int  not null,
  default_exam_date    date not null,
  default_exam_session text check (default_exam_session in ('AM', 'PM')),
  default_target_grade text not null default 'A',
  default_target_papers int not null default 3,
  colour               text not null,             -- key into the UI palette
  sort_order           int  not null default 0
);

create table mocks.topics (
  id          text primary key,                   -- e.g. 'econ-elasticities'
  subject_id  text not null references mocks.subjects (id) on delete cascade,
  section     text not null,                      -- grouping, e.g. 'Theme 3' or 'Crime & Deviance'
  spec_ref    text not null,                      -- e.g. '4.1.3' or '3.3'
  title       text not null,
  exam_focus  text,                               -- what the mock tends to ask on it
  est_hours   numeric(4, 1) not null default 2,
  sort_order  int not null default 0
);
create index topics_subject_idx on mocks.topics (subject_id, sort_order);

create table mocks.past_papers (
  id               text primary key,              -- e.g. 'aqa-7136-1-jun23'
  subject_id       text not null references mocks.subjects (id) on delete cascade,
  kind             mocks.paper_kind not null default 'past_paper',
  series           text not null,                 -- 'June 2023'
  year             int  not null,
  component        text not null,                 -- '7136/1'
  title            text not null,
  max_marks        int  not null check (max_marks > 0),
  duration_minutes int  not null,
  qp_url           text,                          -- direct question paper link, if stable
  ms_url           text,                          -- direct mark scheme link, if stable
  source_url       text not null,                 -- page to find it on otherwise
  notes            text,
  sort_order       int  not null default 0
);
create index past_papers_subject_idx on mocks.past_papers (subject_id, year desc);

-- A row with user_id = null is a default; a user's own row overrides it.
create table mocks.grade_boundaries (
  id          bigint generated always as identity primary key,
  subject_id  text not null references mocks.subjects (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  grade       text not null check (grade in ('A*', 'A', 'B', 'C', 'D', 'E')),
  min_percent numeric(5, 2) not null check (min_percent between 0 and 100),
  source      text,
  constraint grade_boundaries_unique unique nulls not distinct (subject_id, user_id, grade)
);

-- The default revision timetable. Copied into schedule_items for each user.
create table mocks.plan_template (
  id            bigint generated always as identity primary key,
  day           date not null,
  start_time    time not null,
  end_time      time not null,
  subject_id    text references mocks.subjects (id) on delete cascade,
  kind          mocks.block_kind not null,
  title         text not null,
  detail        text,
  topic_ids     text[] not null default '{}',
  past_paper_id text references mocks.past_papers (id) on delete set null,
  check (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

create table mocks.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  overall_target text not null default 'AAA',
  created_at     timestamptz not null default now()
);

-- Targets and exam details per subject. Exam date/session live here so you can
-- fix them when the school publishes the final mock timetable.
create table mocks.user_subjects (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id    text not null references mocks.subjects (id) on delete cascade,
  target_grade  text not null default 'A' check (target_grade in ('A*', 'A', 'B', 'C', 'D', 'E')),
  target_hours  numeric(5, 1) not null default 20 check (target_hours >= 0),
  target_papers int not null default 3 check (target_papers >= 0),
  exam_date     date not null,
  exam_session  text check (exam_session in ('AM', 'PM')),
  primary key (user_id, subject_id)
);

create table mocks.topic_progress (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id         text not null references mocks.topics (id) on delete cascade,
  status           mocks.rag_status not null default 'red',
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  notes            text,
  updated_at       timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table mocks.schedule_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           date not null,
  start_time    time not null,
  end_time      time not null,
  subject_id    text references mocks.subjects (id) on delete cascade,
  kind          mocks.block_kind not null,
  title         text not null,
  detail        text,
  topic_ids     text[] not null default '{}',
  past_paper_id text references mocks.past_papers (id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (end_time > start_time)
);
create index schedule_items_user_day_idx on mocks.schedule_items (user_id, day, start_time);

-- Hours logged. Ticking a schedule block auto-creates one of these (linked by
-- schedule_item_id) and unticking removes it; manual logs have no link.
create table mocks.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id       text not null references mocks.subjects (id) on delete cascade,
  topic_id         text references mocks.topics (id) on delete set null,
  schedule_item_id uuid unique references mocks.schedule_items (id) on delete set null,
  studied_on       date not null default current_date,
  minutes          int not null check (minutes > 0 and minutes <= 960),
  note             text,
  created_at       timestamptz not null default now()
);
create index study_sessions_user_subject_idx on mocks.study_sessions (user_id, subject_id);

create table mocks.paper_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id     text not null references mocks.subjects (id) on delete cascade,
  past_paper_id  text references mocks.past_papers (id) on delete set null,
  title          text not null,
  sat_on         date not null default current_date,
  marks_scored   numeric(5, 1) not null check (marks_scored >= 0),
  max_marks      int not null check (max_marks > 0),
  timed          boolean not null default true,
  minutes_taken  int check (minutes_taken > 0),
  -- Dropped Marks Analysis: where the missing marks went.
  lost_knowledge numeric(5, 1) not null default 0 check (lost_knowledge >= 0),
  lost_timing    numeric(5, 1) not null default 0 check (lost_timing >= 0),
  lost_structure numeric(5, 1) not null default 0 check (lost_structure >= 0),
  lost_other     numeric(5, 1) not null default 0 check (lost_other >= 0),
  reflection     text,
  weak_topic_ids text[] not null default '{}',
  created_at     timestamptz not null default now(),
  constraint score_within_max check (marks_scored <= max_marks),
  constraint dropped_within_lost
    check (lost_knowledge + lost_timing + lost_structure + lost_other <= max_marks - marks_scored)
);
create index paper_attempts_user_subject_idx on mocks.paper_attempts (user_id, subject_id, sat_on desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table mocks.subjects         enable row level security;
alter table mocks.topics           enable row level security;
alter table mocks.past_papers      enable row level security;
alter table mocks.plan_template    enable row level security;
alter table mocks.grade_boundaries enable row level security;
alter table mocks.profiles         enable row level security;
alter table mocks.user_subjects    enable row level security;
alter table mocks.topic_progress   enable row level security;
alter table mocks.schedule_items   enable row level security;
alter table mocks.study_sessions   enable row level security;
alter table mocks.paper_attempts   enable row level security;

create policy "reference: signed-in read" on mocks.subjects
  for select to authenticated using (true);
create policy "reference: signed-in read" on mocks.topics
  for select to authenticated using (true);
create policy "reference: signed-in read" on mocks.past_papers
  for select to authenticated using (true);
create policy "reference: signed-in read" on mocks.plan_template
  for select to authenticated using (true);

create policy "boundaries: read defaults and own" on mocks.grade_boundaries
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "boundaries: write own" on mocks.grade_boundaries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "boundaries: update own" on mocks.grade_boundaries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "boundaries: delete own" on mocks.grade_boundaries
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "profiles: own row" on mocks.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own rows" on mocks.user_subjects
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on mocks.topic_progress
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on mocks.schedule_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on mocks.study_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on mocks.paper_attempts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Seeding a user: profile, subject targets, red topic list and the timetable.
-- There is deliberately no trigger on auth.users, so sign-ups to any other app
-- sharing this project are unaffected.
-- ---------------------------------------------------------------------------

-- Internal. Not callable by clients (execute is revoked below).
create or replace function mocks.seed_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into mocks.profiles (id) values (p_user)
  on conflict (id) do nothing;

  -- Target hours default to the subject's share of the planned timetable.
  insert into mocks.user_subjects
    (user_id, subject_id, target_grade, target_hours, target_papers, exam_date, exam_session)
  select p_user, s.id, s.default_target_grade,
         coalesce((
           select round(sum(extract(epoch from (t.end_time - t.start_time)) / 3600)::numeric, 1)
           from mocks.plan_template t
           where t.subject_id = s.id and t.kind <> 'exam'
         ), 20),
         s.default_target_papers, s.default_exam_date, s.default_exam_session
  from mocks.subjects s
  on conflict (user_id, subject_id) do nothing;

  insert into mocks.topic_progress (user_id, topic_id)
  select p_user, t.id from mocks.topics t
  on conflict (user_id, topic_id) do nothing;

  if not exists (select 1 from mocks.schedule_items where user_id = p_user) then
    insert into mocks.schedule_items
      (user_id, day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id)
    select p_user, day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id
    from mocks.plan_template;
  end if;
end;
$$;

revoke execute on function mocks.seed_user(uuid) from public, anon, authenticated;

-- Called by the app when a signed-in user has no targets yet. Idempotent.
create or replace function mocks.ensure_seeded()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  perform mocks.seed_user(auth.uid());
end;
$$;

revoke execute on function mocks.ensure_seeded() from public, anon;
grant execute on function mocks.ensure_seeded() to authenticated;

-- Throws away your timetable edits and restores the default plan. Logged hours
-- survive: study_sessions.schedule_item_id is set null when a block goes.
create or replace function mocks.reset_my_plan()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from mocks.schedule_items where user_id = auth.uid();
  insert into mocks.schedule_items
    (user_id, day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id)
  select auth.uid(), day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id
  from mocks.plan_template;
end;
$$;

revoke execute on function mocks.reset_my_plan() from public, anon;
grant execute on function mocks.reset_my_plan() to authenticated;

-- Tick or untick a block. Ticking logs its duration against the subject so
-- "hours logged" stays honest without double entry; unticking removes it.
create or replace function mocks.set_block_done(p_item uuid, p_done boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item mocks.schedule_items;
begin
  select * into v_item from mocks.schedule_items
  where id = p_item and user_id = auth.uid();
  if not found then
    raise exception 'block not found';
  end if;

  if p_done then
    update mocks.schedule_items set completed_at = now() where id = p_item;
    if v_item.subject_id is not null and v_item.kind <> 'exam' then
      insert into mocks.study_sessions
        (user_id, subject_id, topic_id, schedule_item_id, studied_on, minutes, note)
      values (
        auth.uid(), v_item.subject_id, v_item.topic_ids[1], v_item.id, v_item.day,
        greatest(1, (extract(epoch from (v_item.end_time - v_item.start_time)) / 60)::int),
        v_item.title
      )
      on conflict (schedule_item_id) do nothing;
    end if;
  else
    update mocks.schedule_items set completed_at = null where id = p_item;
    delete from mocks.study_sessions where schedule_item_id = p_item and user_id = auth.uid();
  end if;
end;
$$;

revoke execute on function mocks.set_block_done(uuid, boolean) from public, anon;
grant execute on function mocks.set_block_done(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges. A new schema gets none by default; RLS above decides rows.
-- ---------------------------------------------------------------------------

grant select on mocks.subjects, mocks.topics, mocks.past_papers, mocks.plan_template to authenticated;
grant select, insert, update, delete on
  mocks.grade_boundaries, mocks.profiles, mocks.user_subjects, mocks.topic_progress,
  mocks.schedule_items, mocks.study_sessions, mocks.paper_attempts
  to authenticated;
grant usage, select on all sequences in schema mocks to authenticated;
grant all on all tables in schema mocks to service_role;
grant all on all sequences in schema mocks to service_role;
