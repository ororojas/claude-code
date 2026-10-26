import type { GradeBoundaryRow } from "./types";

export const GRADES = ["A*", "A", "B", "C", "D", "E"] as const;
export type Grade = (typeof GRADES)[number] | "U";

/** Minimum percentage for each grade. */
export type Boundaries = Record<(typeof GRADES)[number], number>;

/**
 * Collapse boundary rows for one subject into a lookup, letting the user's own
 * rows override the defaults (rows with user_id = null).
 */
export function boundariesFor(rows: GradeBoundaryRow[], subjectId: string): Boundaries {
  const result = {} as Boundaries;
  const mine = rows.filter((r) => r.subject_id === subjectId && r.user_id !== null);
  const defaults = rows.filter((r) => r.subject_id === subjectId && r.user_id === null);
  for (const grade of GRADES) {
    const row = mine.find((r) => r.grade === grade) ?? defaults.find((r) => r.grade === grade);
    // A grade with no boundary row can never be awarded.
    result[grade] = row ? Number(row.min_percent) : Number.POSITIVE_INFINITY;
  }
  return result;
}

export function hasCustomBoundaries(rows: GradeBoundaryRow[], subjectId: string): boolean {
  return rows.some((r) => r.subject_id === subjectId && r.user_id !== null);
}

export function percentOf(scored: number, max: number): number {
  if (!max) return 0;
  return (scored / max) * 100;
}

// Float maths can put 52/80 a hair under 65; this keeps exact hits on the boundary.
const EPSILON = 1e-9;

export function gradeFor(percent: number, b: Boundaries): Grade {
  for (const grade of GRADES) {
    if (percent + EPSILON >= b[grade]) return grade;
  }
  return "U";
}

export function gradeRank(grade: string): number {
  const i = (GRADES as readonly string[]).indexOf(grade);
  return i === -1 ? GRADES.length : i;
}

/** True when `grade` is at or above `target`. */
export function meetsTarget(grade: string, target: string): boolean {
  return gradeRank(grade) <= gradeRank(target);
}

/** Raw marks needed for a grade on a paper of `max` marks, or null if it has no boundary. */
export function marksForGrade(grade: (typeof GRADES)[number], b: Boundaries, max: number): number | null {
  if (!Number.isFinite(b[grade])) return null;
  return Math.ceil((b[grade] * max) / 100 - EPSILON);
}

/** How many more marks would have reached the target grade (0 if already there). */
export function marksToTarget(scored: number, max: number, target: string, b: Boundaries): number {
  if (!(GRADES as readonly string[]).includes(target)) return 0;
  const needed = marksForGrade(target as (typeof GRADES)[number], b, max);
  return needed === null ? 0 : Math.max(0, needed - scored);
}
