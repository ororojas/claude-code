import { redirect } from "next/navigation";
import { cache } from "react";
import { londonMinutes, todayISO } from "./dates";
import { planRollover } from "./rollover";
import { createClient, type Db } from "./supabase/server";
import type {
  GradeBoundaryRow,
  PaperAttempt,
  PastPaper,
  ScheduleItem,
  StudySession,
  Subject,
  Topic,
  TopicProgress,
  UserSubject,
} from "./types";

type Result<T> = { data: T | null; error: { message: string } | null };

function must<T>(res: Result<T>, what: string): T {
  if (res.error) throw new Error(`Couldn't load ${what}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

/** The signed-in user, or a redirect to /login. Deduplicated per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return { supabase, userId: claims.sub as string, email: (claims.email as string | undefined) ?? null };
});

// Next.js memoizes identical GET fetches within one render, so a re-read after
// a write needs its own AbortSignal to see fresh rows.
async function loadTargets(supabase: Db, signal?: AbortSignal) {
  let q = supabase.from("user_subjects").select("subject_id, target_grade, target_hours, target_papers, exam_date, exam_session");
  if (signal) q = q.abortSignal(signal);
  return must<UserSubject[]>(await q, "targets");
}

async function loadProgress(supabase: Db, signal?: AbortSignal) {
  let q = supabase.from("topic_progress").select("topic_id, status, percent_complete, notes, updated_at");
  if (signal) q = q.abortSignal(signal);
  return must<TopicProgress[]>(await q, "topic progress");
}

/** Subjects, topics, targets, progress and grade boundaries: what most pages need. */
export const loadCore = cache(async () => {
  const { supabase } = await requireUser();
  const [subjects, topics, boundaries, firstTargets, firstProgress] = await Promise.all([
    supabase.from("subjects").select("*").order("sort_order").then((r) => must<Subject[]>(r, "subjects")),
    supabase.from("topics").select("*").order("sort_order").then((r) => must<Topic[]>(r, "topics")),
    supabase.from("grade_boundaries").select("subject_id, user_id, grade, min_percent, source").then((r) => must<GradeBoundaryRow[]>(r, "grade boundaries")),
    loadTargets(supabase),
    loadProgress(supabase),
  ]);

  let targets = firstTargets;
  let progress = firstProgress;
  // First visit: create this user's targets, topic list and timetable.
  if (targets.length === 0) {
    const { error } = await supabase.rpc("ensure_seeded");
    if (error) throw new Error(`Couldn't set up your account: ${error.message}`);
    const fresh = new AbortController().signal;
    [targets, progress] = await Promise.all([loadTargets(supabase, fresh), loadProgress(supabase, fresh)]);
  }

  return { supabase, subjects, topics, boundaries, targets, progress };
});

export async function loadSchedule(supabase: Db, signal?: AbortSignal) {
  let q = supabase.from("schedule_items").select("*").order("day").order("start_time");
  if (signal) q = q.abortSignal(signal);
  return must<ScheduleItem[]>(await q, "schedule");
}

/**
 * The timetable, after carrying any missed blocks forward. Runs once per
 * request. `stuck` is what couldn't be fitted in before its exam.
 */
export const loadPlan = cache(async () => {
  const { supabase, targets } = await loadCore();
  const today = todayISO();
  const items = await loadSchedule(supabase);
  const examDates = Object.fromEntries(targets.map((t) => [t.subject_id, t.exam_date]));
  const { rows, freed, stuck } = planRollover({ items, today, nowMinutes: londonMinutes(), examDates });
  // Once an exam has been sat there's nothing left to fit in for it.
  const stillDue = stuck.filter((s) => s.subject_id && (examDates[s.subject_id] ?? "") > today);
  if (!rows.length && !freed.length) return { items, stuck: stillDue };

  const { error } = await supabase.rpc("apply_rollover", { p_rows: rows, p_freed: freed });
  if (error) {
    // Don't take the page down over it; the plan just stays as it was.
    console.error(`Couldn't carry missed blocks forward: ${error.message}`);
    return { items, stuck: stillDue };
  }
  return { items: await loadSchedule(supabase, new AbortController().signal), stuck: stillDue };
});

export async function loadSessions(supabase: Db) {
  return must<StudySession[]>(
    await supabase.from("study_sessions").select("id, subject_id, topic_id, schedule_item_id, studied_on, minutes, note").order("studied_on", { ascending: false }),
    "study sessions",
  );
}

export async function loadAttempts(supabase: Db) {
  return must<PaperAttempt[]>(
    await supabase.from("paper_attempts").select("*").order("sat_on", { ascending: false }).order("created_at", { ascending: false }),
    "paper attempts",
  );
}

export async function loadPapers(supabase: Db) {
  return must<PastPaper[]>(
    await supabase.from("past_papers").select("*").order("subject_id").order("sort_order"),
    "past papers",
  );
}
