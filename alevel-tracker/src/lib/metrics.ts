import { boundariesFor, gradeFor, percentOf, type Grade } from "./grades";
import type { GradeBoundaryRow, PaperAttempt, StudySession, Topic, TopicProgress, UserSubject } from "./types";

export interface SubjectMetrics {
  subjectId: string;
  minutesLogged: number;
  targetHours: number;
  topicsTotal: number;
  red: number;
  amber: number;
  green: number;
  percentComplete: number;
  papersDone: number;
  targetPapers: number;
  targetGrade: string;
  latest: { percent: number; grade: Grade } | null;
  average: { percent: number; grade: Grade } | null;
}

export function subjectMetrics(
  subjectId: string,
  topics: Topic[],
  progress: TopicProgress[],
  sessions: StudySession[],
  attempts: PaperAttempt[],
  target: UserSubject | undefined,
  boundaryRows: GradeBoundaryRow[],
): SubjectMetrics {
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
  const byTopic = new Map(progress.map((p) => [p.topic_id, p]));
  let red = 0;
  let amber = 0;
  let green = 0;
  let percentSum = 0;
  for (const t of subjectTopics) {
    const p = byTopic.get(t.id);
    const status = p?.status ?? "red";
    if (status === "green") green++;
    else if (status === "amber") amber++;
    else red++;
    percentSum += p?.percent_complete ?? 0;
  }

  const b = boundariesFor(boundaryRows, subjectId);
  const subjectAttempts = attempts
    .filter((a) => a.subject_id === subjectId)
    .sort((x, y) => (x.sat_on < y.sat_on ? 1 : x.sat_on > y.sat_on ? -1 : y.created_at.localeCompare(x.created_at)));
  const percents = subjectAttempts.map((a) => percentOf(Number(a.marks_scored), a.max_marks));
  const avg = percents.length ? percents.reduce((s, p) => s + p, 0) / percents.length : null;

  return {
    subjectId,
    minutesLogged: sessions.filter((s) => s.subject_id === subjectId).reduce((s, x) => s + x.minutes, 0),
    targetHours: Number(target?.target_hours ?? 0),
    topicsTotal: subjectTopics.length,
    red,
    amber,
    green,
    percentComplete: subjectTopics.length ? Math.round(percentSum / subjectTopics.length) : 0,
    papersDone: subjectAttempts.length,
    targetPapers: target?.target_papers ?? 0,
    targetGrade: target?.target_grade ?? "A",
    latest: percents.length ? { percent: percents[0], grade: gradeFor(percents[0], b) } : null,
    average: avg === null ? null : { percent: avg, grade: gradeFor(avg, b) },
  };
}

export interface DroppedMarks {
  knowledge: number;
  timing: number;
  structure: number;
  other: number;
  unassigned: number;
  total: number;
}

export function droppedMarks(attempts: PaperAttempt[]): DroppedMarks {
  const out: DroppedMarks = { knowledge: 0, timing: 0, structure: 0, other: 0, unassigned: 0, total: 0 };
  for (const a of attempts) {
    const lost = a.max_marks - Number(a.marks_scored);
    const k = Number(a.lost_knowledge);
    const t = Number(a.lost_timing);
    const s = Number(a.lost_structure);
    const o = Number(a.lost_other);
    out.knowledge += k;
    out.timing += t;
    out.structure += s;
    out.other += o;
    out.unassigned += Math.max(0, lost - k - t - s - o);
    out.total += lost;
  }
  return out;
}

export const DROPPED_ADVICE: Record<"knowledge" | "timing" | "structure" | "other", string> = {
  knowledge: "Most lost marks are knowledge gaps. Go back to Teach Me on the tagged topics before the next paper.",
  timing: "Timing is costing you most. Write the minutes-per-mark plan on the front of every paper and stick to it.",
  structure: "Structure is the biggest leak. Rehearse the essay plans in Teach Me until the shape is automatic.",
  other: "Most lost marks are \"other\". Note what they were in the reflection box so you can spot the pattern.",
};

export function biggestLeak(d: DroppedMarks): keyof typeof DROPPED_ADVICE | null {
  const entries = (["knowledge", "timing", "structure", "other"] as const).map((k) => [k, d[k]] as const);
  const [key, value] = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return value > 0 ? key : null;
}

/** How often each topic has been tagged as weak in logged papers. */
export function weakTopicCounts(attempts: PaperAttempt[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of attempts) for (const id of a.weak_topic_ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}
