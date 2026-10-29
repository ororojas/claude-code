"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GRADES } from "@/lib/grades";
import { requireUser } from "@/lib/data";
import { isSubjectId } from "@/lib/subjects";
import type { BlockKind, Rag } from "@/lib/types";

export interface FormState {
  ok: boolean;
  message: string;
}

const RAG: Rag[] = ["red", "amber", "green"];
const KINDS: BlockKind[] = ["content", "timed_paper", "marking", "mop_up", "recall", "exam"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback = 0): number {
  const raw = text(form, key);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export async function setTopicStatus(topicId: string, status: Rag) {
  if (!RAG.includes(status)) throw new Error("Invalid status");
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("topic_progress")
    .upsert({ user_id: userId, topic_id: topicId, status, updated_at: new Date().toISOString() }, { onConflict: "user_id,topic_id" });
  if (error) throw new Error(error.message);
  refreshAll();
}

export async function setTopicPercent(topicId: string, percent: number) {
  const value = Math.round(Math.min(100, Math.max(0, percent)));
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("topic_progress")
    .upsert({ user_id: userId, topic_id: topicId, percent_complete: value, updated_at: new Date().toISOString() }, { onConflict: "user_id,topic_id" });
  if (error) throw new Error(error.message);
  refreshAll();
}

export async function saveTopicNotes(topicId: string, notes: string) {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("topic_progress")
    .upsert({ user_id: userId, topic_id: topicId, notes: notes.slice(0, 4000) || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,topic_id" });
  if (error) throw new Error(error.message);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function toggleBlock(itemId: string, done: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_block_done", { p_item: itemId, p_done: done });
  if (error) throw new Error(error.message);
  refreshAll();
}

function readBlock(form: FormData) {
  const day = text(form, "day");
  const start = text(form, "start_time");
  const end = text(form, "end_time");
  const subject = text(form, "subject_id");
  const kind = text(form, "kind") as BlockKind;
  const title = text(form, "title");
  if (!DAY_RE.test(day)) return { error: "Pick a day." };
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: "Set a start and end time." };
  if (end <= start) return { error: "The block has to end after it starts." };
  if (!KINDS.includes(kind)) return { error: "Pick a block type." };
  if (!title) return { error: "Give the block a title." };
  if (subject && !isSubjectId(subject)) return { error: "Unknown subject." };
  return {
    value: {
      day,
      start_time: start,
      end_time: end,
      subject_id: subject || null,
      kind,
      title: title.slice(0, 200),
      detail: text(form, "detail").slice(0, 1000) || null,
    },
  };
}

export async function addBlock(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = readBlock(form);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("schedule_items").insert({ ...parsed.value, user_id: userId });
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: "Block added." };
}

export async function updateBlock(_prev: FormState, form: FormData): Promise<FormState> {
  const id = text(form, "id");
  const parsed = readBlock(form);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("schedule_items").update(parsed.value).eq("id", id);
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: "Saved." };
}

export async function deleteBlock(itemId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("schedule_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  refreshAll();
}

export async function resetPlan() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("reset_my_plan");
  if (error) throw new Error(error.message);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------------------

export async function logSession(_prev: FormState, form: FormData): Promise<FormState> {
  const subject = text(form, "subject_id");
  const minutes = num(form, "minutes", Number.NaN);
  const day = text(form, "studied_on");
  if (!isSubjectId(subject)) return { ok: false, message: "Pick a subject." };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 960) return { ok: false, message: "Minutes must be between 1 and 960." };
  if (!DAY_RE.test(day)) return { ok: false, message: "Pick a date." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject_id: subject,
    topic_id: text(form, "topic_id") || null,
    studied_on: day,
    minutes,
    note: text(form, "note").slice(0, 500) || null,
  });
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: `Logged ${minutes} minutes.` };
}

export async function deleteSession(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("study_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Paper attempts
// ---------------------------------------------------------------------------

export async function logAttempt(_prev: FormState, form: FormData): Promise<FormState> {
  const subject = text(form, "subject_id");
  const title = text(form, "title");
  const day = text(form, "sat_on");
  const scored = num(form, "marks_scored", Number.NaN);
  const max = num(form, "max_marks", Number.NaN);
  const minutes = num(form, "minutes_taken", 0);
  const lost = {
    lost_knowledge: num(form, "lost_knowledge"),
    lost_timing: num(form, "lost_timing"),
    lost_structure: num(form, "lost_structure"),
    lost_other: num(form, "lost_other"),
  };

  if (!isSubjectId(subject)) return { ok: false, message: "Pick a subject." };
  if (!title) return { ok: false, message: "Give the paper a title." };
  if (!DAY_RE.test(day)) return { ok: false, message: "Pick the date you sat it." };
  if (!Number.isInteger(max) || max < 1) return { ok: false, message: "Total marks must be a whole number." };
  if (!Number.isFinite(scored) || scored < 0 || scored > max) return { ok: false, message: `Your score must be between 0 and ${max}.` };
  if (Object.values(lost).some((v) => !Number.isFinite(v) || v < 0)) return { ok: false, message: "Dropped marks can't be negative." };
  const lostTotal = Object.values(lost).reduce((s, v) => s + v, 0);
  if (lostTotal > max - scored + 1e-9) {
    return { ok: false, message: `You dropped ${max - scored} marks but split ${lostTotal} between the reasons. Bring them down.` };
  }
  if (!Number.isFinite(minutes) || minutes < 0) return { ok: false, message: "Minutes taken must be a positive number." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("paper_attempts").insert({
    user_id: userId,
    subject_id: subject,
    past_paper_id: text(form, "past_paper_id") || null,
    title: title.slice(0, 200),
    sat_on: day,
    marks_scored: scored,
    max_marks: max,
    timed: form.get("timed") === "on",
    minutes_taken: minutes > 0 ? Math.round(minutes) : null,
    ...lost,
    reflection: text(form, "reflection").slice(0, 2000) || null,
    weak_topic_ids: form.getAll("weak_topic_ids").map(String).filter(Boolean),
  });
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: `Saved ${title}: ${scored}/${max}.` };
}

export async function deleteAttempt(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("paper_attempts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveTargets(_prev: FormState, form: FormData): Promise<FormState> {
  const subject = text(form, "subject_id");
  const grade = text(form, "target_grade");
  const hours = num(form, "target_hours", Number.NaN);
  const papers = num(form, "target_papers", Number.NaN);
  const examDate = text(form, "exam_date");
  const session = text(form, "exam_session");
  if (!isSubjectId(subject)) return { ok: false, message: "Unknown subject." };
  if (!(GRADES as readonly string[]).includes(grade)) return { ok: false, message: "Pick a target grade." };
  if (!Number.isFinite(hours) || hours < 0 || hours > 500) return { ok: false, message: "Target hours must be 0–500." };
  if (!Number.isInteger(papers) || papers < 0 || papers > 50) return { ok: false, message: "Target papers must be 0–50." };
  if (!DAY_RE.test(examDate)) return { ok: false, message: "Set the exam date." };
  if (session && session !== "AM" && session !== "PM") return { ok: false, message: "Session must be AM or PM." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("user_subjects").upsert(
    { user_id: userId, subject_id: subject, target_grade: grade, target_hours: hours, target_papers: papers, exam_date: examDate, exam_session: session || null },
    { onConflict: "user_id,subject_id" },
  );
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: "Targets saved." };
}

export async function saveBoundaries(_prev: FormState, form: FormData): Promise<FormState> {
  const subject = text(form, "subject_id");
  if (!isSubjectId(subject)) return { ok: false, message: "Unknown subject." };
  const max = num(form, "max_marks", Number.NaN);
  if (!Number.isInteger(max) || max < 1) return { ok: false, message: "Enter the paper's total marks." };

  const rows = [];
  let previous = Number.POSITIVE_INFINITY;
  for (const grade of GRADES) {
    const raw = num(form, `grade_${grade}`, Number.NaN);
    if (!Number.isFinite(raw) || raw < 0 || raw > max) return { ok: false, message: `${grade} must be between 0 and ${max} marks.` };
    if (raw >= previous) return { ok: false, message: "Each grade needs fewer marks than the one above it." };
    previous = raw;
    rows.push({ grade, min_percent: Math.round((raw / max) * 10000) / 100 });
  }

  const { supabase, userId } = await requireUser();
  const { error: delError } = await supabase.from("grade_boundaries").delete().eq("subject_id", subject).eq("user_id", userId);
  if (delError) return { ok: false, message: delError.message };
  const { error } = await supabase.from("grade_boundaries").insert(
    rows.map((r) => ({ ...r, subject_id: subject, user_id: userId, source: `Your boundaries (out of ${max})` })),
  );
  if (error) return { ok: false, message: error.message };
  refreshAll();
  return { ok: true, message: "Boundaries saved. Grades have been recalculated." };
}

export async function resetBoundaries(subjectId: string) {
  if (!isSubjectId(subjectId)) throw new Error("Unknown subject");
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("grade_boundaries").delete().eq("subject_id", subjectId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
