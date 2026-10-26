import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
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

async function loadTargets(supabase: SupabaseClient) {
  return must<UserSubject[]>(
    await supabase.from("user_subjects").select("subject_id, target_grade, target_hours, target_papers, exam_date, exam_session"),
    "targets",
  );
}

async function loadProgress(supabase: SupabaseClient) {
  return must<TopicProgress[]>(
    await supabase.from("topic_progress").select("topic_id, status, percent_complete, notes, updated_at"),
    "topic progress",
  );
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
  // Accounts created before the migrations ran have no seeded rows yet.
  if (targets.length === 0) {
    const { error } = await supabase.rpc("ensure_seeded");
    if (error) throw new Error(`Couldn't set up your account: ${error.message}`);
    [targets, progress] = await Promise.all([loadTargets(supabase), loadProgress(supabase)]);
  }

  return { supabase, subjects, topics, boundaries, targets, progress };
});

export async function loadSchedule(supabase: SupabaseClient, range?: { from: string; to: string }) {
  let q = supabase.from("schedule_items").select("*").order("day").order("start_time");
  if (range) q = q.gte("day", range.from).lte("day", range.to);
  return must<ScheduleItem[]>(await q, "schedule");
}

export async function loadSessions(supabase: SupabaseClient) {
  return must<StudySession[]>(
    await supabase.from("study_sessions").select("id, subject_id, topic_id, schedule_item_id, studied_on, minutes, note").order("studied_on", { ascending: false }),
    "study sessions",
  );
}

export async function loadAttempts(supabase: SupabaseClient) {
  return must<PaperAttempt[]>(
    await supabase.from("paper_attempts").select("*").order("sat_on", { ascending: false }).order("created_at", { ascending: false }),
    "paper attempts",
  );
}

export async function loadPapers(supabase: SupabaseClient) {
  return must<PastPaper[]>(
    await supabase.from("past_papers").select("*").order("subject_id").order("sort_order"),
    "past papers",
  );
}
