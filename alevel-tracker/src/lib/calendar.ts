import { addDays, londonMinutes, todayISO } from "./dates";

// Events copied in from Google Calendar. Only some of them stop you studying:
// all-day markers, events marked "free", quick breaks and the study sessions
// you've put in your own calendar don't count.

export interface CalendarEvent {
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  transparent: boolean;
}

/** A busy stretch on one London day, in minutes since midnight. */
export interface Busy {
  day: string;
  start: number;
  end: number;
  title: string;
}

/** Shorter than this (a coffee break) and it doesn't block a session. */
const MIN_BUSY = 30;

// Study sessions you've added to your own calendar. School lessons are named
// "Subject – Teacher" with a dash, so the colon pattern doesn't catch them.
const STUDY =
  /revis|study|studying|past paper|timed|mop[ -]?up|mock prep|marking|flashcard|blurt|recall|essay|10-marker|content|^(econ|economics|business|sociology|soc)\s*:/i;

export function isBusy(e: CalendarEvent): boolean {
  if (e.all_day || e.transparent) return false;
  const minutes = (Date.parse(e.ends_at) - Date.parse(e.starts_at)) / 60_000;
  if (!(minutes >= MIN_BUSY)) return false;
  return !STUDY.test(e.title ?? "");
}

/** Busy events as per-day stretches in UK time, split at midnight. */
export function busyStretches(events: CalendarEvent[]): Busy[] {
  const out: Busy[] = [];
  for (const e of events) {
    if (!isBusy(e)) continue;
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    const title = e.title?.trim() || "Busy";
    let day = todayISO(start);
    const lastDay = todayISO(end);
    let from = londonMinutes(start);
    while (day <= lastDay) {
      const to = day === lastDay ? londonMinutes(end) : 24 * 60;
      if (to > from) out.push({ day, start: from, end: to, title });
      day = addDays(day, 1);
      from = 0;
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
}
