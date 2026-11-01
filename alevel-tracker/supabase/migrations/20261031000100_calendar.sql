-- Calendar-aware planning, and a reset that doesn't plan things in the past.

-- Events copied from your Google Calendar. The app decides which ones block
-- study time (src/lib/calendar.ts), so everything is stored as it came in.
create table mocks.busy_times (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  external_id text not null,                      -- the calendar event's id
  title       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  all_day     boolean not null default false,
  transparent boolean not null default false,     -- marked "free" in the calendar
  synced_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint busy_times_unique unique (user_id, external_id)
);
create index busy_times_user_start_idx on mocks.busy_times (user_id, starts_at);

alter table mocks.busy_times enable row level security;
create policy "busy: read own" on mocks.busy_times
  for select to authenticated using (user_id = (select auth.uid()));

grant select on mocks.busy_times to authenticated;
grant all on mocks.busy_times to service_role;

-- Replaces everything between p_from and p_to with p_events, a JSON array of
-- Google Calendar events as the API returns them. Run by the calendar sync,
-- never by the app, so clients can't call it.
create or replace function mocks.replace_calendar(p_user uuid, p_from timestamptz, p_to timestamptz, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from mocks.busy_times
  where user_id = p_user and starts_at < p_to and ends_at > p_from;

  insert into mocks.busy_times (user_id, external_id, title, starts_at, ends_at, all_day, transparent)
  select p_user, e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.transparent
  from (
    select
      ev->>'id' as id,
      ev->>'summary' as title,
      coalesce(ev->'start'->>'dateTime', ev->'start'->>'date')::timestamptz as starts_at,
      coalesce(ev->'end'->>'dateTime', ev->'end'->>'date')::timestamptz as ends_at,
      ev->'start' ? 'date' as all_day,
      coalesce(ev->>'transparency', '') = 'transparent' or coalesce(ev->>'availability', '') = 'AVAILABILITY_FREE' as transparent
    from jsonb_array_elements(p_events) as ev
    where coalesce(ev->>'status', 'confirmed') <> 'cancelled'
  ) e
  where e.id is not null and e.ends_at > e.starts_at
  on conflict (user_id, external_id) do update set
    title       = excluded.title,
    starts_at   = excluded.starts_at,
    ends_at     = excluded.ends_at,
    all_day     = excluded.all_day,
    transparent = excluded.transparent,
    synced_at   = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function mocks.replace_calendar(uuid, timestamptz, timestamptz, jsonb) from public, anon, authenticated;

-- Reset now keeps what you've ticked, and leaves out habit blocks (no subject)
-- whose time has already gone. Unticked work from past days is put back so the
-- app can move it forward into your free time.
create or replace function mocks.reset_my_plan()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamp := now() at time zone 'Europe/London';
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  delete from mocks.schedule_items where user_id = auth.uid() and completed_at is null;

  insert into mocks.schedule_items
    (user_id, day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id)
  select auth.uid(), t.day, t.start_time, t.end_time, t.subject_id, t.kind, t.title, t.detail, t.topic_ids, t.past_paper_id
  from mocks.plan_template t
  where not (t.subject_id is null and t.kind <> 'exam' and t.day + t.end_time < v_now)
    and not exists (
      select 1 from mocks.schedule_items s
      where s.user_id = auth.uid()
        and s.completed_at is not null
        and left(s.title, length(t.title)) = t.title
        and coalesce(s.moved_from, s.day) = t.day
        and (s.moved_from is not null or s.start_time = t.start_time)
    );
end;
$$;
