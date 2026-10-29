// All "today" logic runs in UK time. Vercel servers are on UTC, which would
// otherwise flip the day an hour early during BST.
export const TZ = "Europe/London";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Today's date in London as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return isoFormatter.format(now);
}

/** Minutes since midnight in London. */
export function londonMinutes(now: Date = new Date()): number {
  const [h, m] = timeFormatter.format(now).split(":").map(Number);
  return h * 60 + m;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const dow = (parseISO(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function formatDay(iso: string, style: "short" | "long" = "short"): string {
  return parseISO(iso).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
  });
}

/** "09:00:00" → "09:00" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}
