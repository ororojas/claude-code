-- Missed blocks roll forward. The app works out where each one goes
-- (src/lib/rollover.ts) and sends the whole change here, so it lands in one
-- transaction or not at all.

alter table mocks.schedule_items add column if not exists moved_from date;

comment on column mocks.schedule_items.moved_from is
  'The day a missed block was first planned for, once it has been carried forward.';

-- p_rows: blocks to move or create (split parts). p_freed: mop-up or recall
-- blocks given up to make room. A block ticked in the meantime is left alone.
create or replace function mocks.apply_rollover(p_rows jsonb, p_freed uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  delete from mocks.schedule_items
  where user_id = auth.uid() and id = any(p_freed) and completed_at is null;

  insert into mocks.schedule_items as s
    (id, user_id, day, start_time, end_time, subject_id, kind, title, detail, topic_ids, past_paper_id, moved_from)
  select r.id, auth.uid(), r.day, r.start_time, r.end_time, r.subject_id, r.kind, r.title, r.detail,
         coalesce(r.topic_ids, '{}'), r.past_paper_id, r.moved_from
  from jsonb_to_recordset(p_rows) as r(
    id uuid, day date, start_time time, end_time time, subject_id text, kind mocks.block_kind,
    title text, detail text, topic_ids text[], past_paper_id text, moved_from date
  )
  on conflict (id) do update set
    day        = excluded.day,
    start_time = excluded.start_time,
    end_time   = excluded.end_time,
    title      = excluded.title,
    topic_ids  = excluded.topic_ids,
    moved_from = excluded.moved_from
  where s.user_id = auth.uid() and s.completed_at is null;
end;
$$;

revoke execute on function mocks.apply_rollover(jsonb, uuid[]) from public, anon;
grant execute on function mocks.apply_rollover(jsonb, uuid[]) to authenticated;
