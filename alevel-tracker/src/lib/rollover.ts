import { createHash } from "node:crypto";
import type { Busy } from "./calendar";
import { addDays, toMinutes } from "./dates";
import { studyDay } from "./plan";
import type { BlockKind, ScheduleItem, SubjectId } from "./types";

// Keeps the plan honest about the clock and your calendar.
//
// A block is missed once it ended more than an hour ago and still isn't
// ticked. A block also has to move if something in your calendar now
// overlaps it. Each one goes wherever it would be finished soonest, as long
// as that's before its subject's exam:
//   * a free gap in a day's study windows, clear of your calendar, if the day
//     isn't already full;
//   * split into shorter parts across several gaps;
//   * in place of a mop-up or recall block for the same subject. Those exist
//     to fix weak topics, and a topic you never got to is the weakest kind.
//     The evening before the exam is never given up this way.
// Exams never move. Blocks with no subject (the nightly recall) are habits
// rather than content: a missed or clashing one is simply dropped. A timed
// paper takes its marking with it. Anything with no room left before the
// exam is reported as stuck.

/** How long after a block's planned end it counts as missed, in minutes. */
export const GRACE_MINUTES = 60;
/** Shortest part a block is split into, in minutes. */
const MIN_PART = 45;
const FLEXIBLE: BlockKind[] = ["mop_up", "recall"];
const PART_RE = / \(part \d+ of \d+\)$/;

export interface RolledRow {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  subject_id: SubjectId | null;
  kind: BlockKind;
  title: string;
  detail: string | null;
  topic_ids: string[];
  past_paper_id: string | null;
  moved_from: string;
}

export interface Rollover {
  /** Blocks to write: the moved ones, plus the extra parts of split ones. */
  rows: RolledRow[];
  /** Blocks to delete: mop-ups or recalls given up to make room, and missed or clashing habits. */
  freed: string[];
  /** Missed blocks with no room before their exam. Left where they are. */
  stuck: ScheduleItem[];
}

interface Point {
  day: string;
  min: number;
}

interface Slot {
  day: string;
  start: number;
  end: number;
}

type Calendar = Map<string, { busy: [number, number][]; load: number }>;

function length(item: ScheduleItem): number {
  return toMinutes(item.end_time) - toMinutes(item.start_time);
}

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function isBefore(a: Point, b: Point): boolean {
  return a.day < b.day || (a.day === b.day && a.min < b.min);
}

function finish(parts: Slot[]): Point {
  const last = parts[parts.length - 1];
  return { day: last.day, min: last.end };
}

function dayOf(cal: Calendar, day: string) {
  let state = cal.get(day);
  if (!state) cal.set(day, (state = { busy: [], load: 0 }));
  return state;
}

function clone(cal: Calendar): Calendar {
  return new Map([...cal].map(([day, s]) => [day, { busy: [...s.busy], load: s.load }]));
}

function blockOut(cal: Calendar, b: Busy) {
  dayOf(cal, b.day).busy.push([b.start, b.end]);
}

// Exams take up the time but don't count towards the day's study cap.
function occupy(cal: Calendar, slot: Slot, kind: BlockKind) {
  const state = dayOf(cal, slot.day);
  state.busy.push([slot.start, slot.end]);
  if (kind !== "exam") state.load += slot.end - slot.start;
}

function release(cal: Calendar, item: ScheduleItem) {
  const state = dayOf(cal, item.day);
  const start = toMinutes(item.start_time);
  const at = state.busy.findIndex(([s, e]) => s === start && e === toMinutes(item.end_time));
  if (at >= 0) state.busy.splice(at, 1);
  state.load -= length(item);
}

/** First gap of `minutes` at or after `after`, no later than `lastDay`. */
function findGap(cal: Calendar, minutes: number, after: Point, lastDay: string): Slot | null {
  for (let day = after.day; day <= lastDay; day = addDays(day, 1)) {
    const { windows, capMinutes } = studyDay(day);
    const state = dayOf(cal, day);
    if (state.load + minutes > capMinutes) continue;
    const busy = [...state.busy].sort((a, b) => a[0] - b[0]);
    for (const [from, to] of windows) {
      let cursor = Math.max(toMinutes(from), day === after.day ? after.min : 0);
      const end = toMinutes(to);
      for (const [s, e] of busy) {
        if (e <= cursor) continue;
        if (s >= end) break;
        if (s - cursor >= minutes) return { day, start: cursor, end: cursor + minutes };
        cursor = e;
      }
      if (end - cursor >= minutes) return { day, start: cursor, end: cursor + minutes };
    }
  }
  return null;
}

/** How a block breaks into parts: by topic where it has several, otherwise in half. */
export function splitBlock(item: ScheduleItem): { minutes: number; topic_ids: string[] }[] | null {
  if (item.kind === "timed_paper" || PART_RE.test(item.title)) return null;
  const total = length(item);
  const topics = item.topic_ids;
  const n = Math.min(Math.max(topics.length, 2), Math.floor(total / MIN_PART));
  if (n < 2) return null;
  const each = Math.floor(total / n / 15) * 15;
  return Array.from({ length: n }, (_, k) => ({
    minutes: k === n - 1 ? total - each * (n - 1) : each,
    topic_ids: topics.length >= n ? topics.slice(Math.floor((k * topics.length) / n), Math.floor(((k + 1) * topics.length) / n)) : topics,
  }));
}

function placeParts(cal: Calendar, item: ScheduleItem, after: Point, lastDay: string): Slot[] | null {
  const plan = splitBlock(item);
  if (!plan) return null;
  const parts: Slot[] = [];
  let from = after;
  for (const part of plan) {
    const slot = findGap(cal, part.minutes, from, lastDay);
    if (!slot) return null;
    occupy(cal, slot, item.kind);
    parts.push(slot);
    from = { day: slot.day, min: slot.end };
  }
  return parts;
}

/** Same id in, same id out, so two overlapping runs write the same rows. */
export function partId(id: string, n: number): string {
  const h = createHash("sha256").update(`${id}#${n}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function planRollover({
  items,
  today,
  nowMinutes,
  examDates,
  busy = [],
}: {
  items: ScheduleItem[];
  today: string;
  nowMinutes: number;
  examDates: Partial<Record<SubjectId, string>>;
  busy?: Busy[];
}): Rollover {
  const result: Rollover = { rows: [], freed: [], stuck: [] };
  const open = items.filter((i) => !i.completed_at && i.kind !== "exam");
  const over = (i: ScheduleItem) => i.day < today || (i.day === today && toMinutes(i.end_time) + GRACE_MINUTES <= nowMinutes);
  const clashes = (i: ScheduleItem) =>
    !over(i) && busy.some((b) => b.day === i.day && b.start < toMinutes(i.end_time) && b.end > toMinutes(i.start_time));

  // Habits that were missed or now clash just go.
  const dropped = open.filter((i) => !i.subject_id && (over(i) || clashes(i)));
  result.freed.push(...dropped.map((i) => i.id));

  const missed = new Set(open.filter((i) => i.subject_id && over(i)).map((i) => i.id));
  const clashing = new Set(open.filter((i) => i.subject_id && clashes(i)).map((i) => i.id));
  const movingPapers = new Set(
    open.filter((i) => i.kind === "timed_paper" && i.past_paper_id && (missed.has(i.id) || clashing.has(i.id))).map((i) => i.past_paper_id),
  );
  const moving = new Set([...missed, ...clashing]);
  for (const i of open) {
    if (i.kind === "marking" && i.subject_id && movingPapers.has(i.past_paper_id)) moving.add(i.id);
  }
  if (moving.size === 0) return result;

  const byTime = (a: ScheduleItem, b: ScheduleItem) => a.day.localeCompare(b.day) || a.start_time.localeCompare(b.start_time);
  const queue = items.filter((i) => moving.has(i.id)).sort(byTime);

  const slotOf = (i: ScheduleItem): Slot => ({ day: i.day, start: toMinutes(i.start_time), end: toMinutes(i.end_time) });
  const gone = new Set([...missed, ...clashing, ...result.freed]);
  let cal: Calendar = new Map();
  for (const i of items) if (i.day >= today && !gone.has(i.id)) occupy(cal, slotOf(i), i.kind);
  for (const b of busy) if (b.day >= today) blockOut(cal, b);
  // Blocks that may be given up. Ones that were themselves carried over are kept.
  const flexible = items
    .filter((i) => i.day >= today && !over(i) && !i.completed_at && !moving.has(i.id) && !i.moved_from && i.subject_id && FLEXIBLE.includes(i.kind) && length(i) >= MIN_PART)
    .sort(byTime);

  const now: Point = { day: today, min: Math.ceil(nowMinutes / 30) * 30 };
  const paperEnds = new Map<string, Point>();
  const stuckPapers = new Set<string>();

  for (const item of queue) {
    // A marking block that wasn't missed itself only moves if its paper now
    // lands after it.
    const follower = !missed.has(item.id) && !clashing.has(item.id);
    const exam = examDates[item.subject_id!];
    const paper = item.past_paper_id;
    let after = now;
    if (item.kind === "marking" && paper) {
      if (stuckPapers.has(paper)) {
        if (missed.has(item.id)) result.stuck.push(item);
        continue;
      }
      const paperEnd = paperEnds.get(paper);
      if (paperEnd && isBefore(after, paperEnd)) after = paperEnd;
    }
    if (follower) {
      if (!isBefore({ day: item.day, min: toMinutes(item.start_time) }, after)) continue;
      release(cal, item);
    }
    const giveUp = () => {
      // Missed work is reported. Anything still ahead stays where it was.
      if (missed.has(item.id)) result.stuck.push(item);
      else occupy(cal, slotOf(item), item.kind);
      if (item.kind === "timed_paper" && paper) stuckPapers.add(paper);
    };
    if (!exam) {
      giveUp();
      continue;
    }
    const lastDay = addDays(exam, -1);

    // Each way of fitting it in, tried on a copy of the calendar.
    const options: { parts: Slot[]; cal: Calendar; freed?: ScheduleItem }[] = [];
    const tryWhole = (c: Calendar) => {
      const slot = findGap(c, length(item), after, lastDay);
      if (slot) occupy(c, slot, item.kind);
      return slot ? [slot] : null;
    };

    let c = clone(cal);
    const whole = tryWhole(c);
    if (whole) options.push({ parts: whole, cal: c });

    c = clone(cal);
    const parts = placeParts(c, item, after, lastDay);
    if (parts) options.push({ parts, cal: c });

    // The evening before the exam keeps its own plan.
    const swap = flexible.find(
      (f) => f.subject_id === item.subject_id && f.day < lastDay && !isBefore({ day: f.day, min: toMinutes(f.start_time) }, after),
    );
    if (swap) {
      // It takes that block's exact slot, even if the slot is a little shorter.
      c = clone(cal);
      release(c, swap);
      occupy(c, slotOf(swap), item.kind);
      options.push({ parts: [slotOf(swap)], cal: c, freed: swap });
    }

    // The option that's finished on the earliest day wins. On the same day the
    // simpler one stays: whole beats split beats taking over another block.
    const best = options.reduce<(typeof options)[number] | null>((a, o) => (!a || finish(o.parts).day < finish(a.parts).day ? o : a), null);
    if (!best) {
      giveUp();
      continue;
    }

    cal = best.cal;
    if (best.freed) {
      result.freed.push(best.freed.id);
      flexible.splice(flexible.indexOf(best.freed), 1);
    }
    const split = best.parts.length > 1 ? splitBlock(item) : null;
    best.parts.forEach((slot, k) => {
      result.rows.push({
        id: k === 0 ? item.id : partId(item.id, k),
        day: slot.day,
        start_time: hm(slot.start),
        end_time: hm(slot.end),
        subject_id: item.subject_id,
        kind: item.kind,
        title: split ? `${item.title} (part ${k + 1} of ${best.parts.length})` : item.title,
        detail: item.detail,
        topic_ids: split ? split[k].topic_ids : item.topic_ids,
        past_paper_id: item.past_paper_id,
        moved_from: item.moved_from ?? item.day,
      });
    });
    if (item.kind === "timed_paper" && paper) paperEnds.set(paper, finish(best.parts));
  }

  return result;
}
