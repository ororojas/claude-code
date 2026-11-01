import Link from "next/link";
import { CalendarX, TriangleAlert } from "lucide-react";
import type { Busy } from "@/lib/calendar";
import { formatDay, toMinutes } from "@/lib/dates";
import { studyDay } from "@/lib/plan";
import type { ScheduleItem } from "@/lib/types";

/** Missed blocks that couldn't be fitted in before their exam. */
export function StuckNotice({ stuck, linkToSchedule = false }: { stuck: ScheduleItem[]; linkToSchedule?: boolean }) {
  if (!stuck.length) return null;
  return (
    <div role="status" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="flex items-start gap-2 font-semibold">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {stuck.length === 1 ? "1 missed block doesn't fit" : `${stuck.length} missed blocks don't fit`} before the exam
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-10">
        {stuck.map((s) => (
          <li key={s.id}>
            {s.title} <span className="text-amber-800">(from {formatDay(s.day)})</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 pl-6">
        Every free slot before the exam is taken. Delete or shorten something you can skip and it moves into the gap by itself. You can also move it by hand, or delete it.{" "}
        {linkToSchedule ? (
          <Link href="/schedule" className="font-medium underline">
            Open Schedule
          </Link>
        ) : null}
      </p>
    </div>
  );
}

export function MovedTag({ from }: { from: string | null | undefined }) {
  if (!from) return null;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Moved from {formatDay(from)}</span>;
}

const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** What your calendar blocks out during that day's study hours. */
export function BusyList({ busy, day }: { busy: Busy[]; day: string }) {
  const { windows } = studyDay(day);
  const shown = busy.filter((b) => b.day === day && windows.some(([from, to]) => b.start < toMinutes(to) && b.end > toMinutes(from)));
  if (!shown.length) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
      <CalendarX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-slate-600">Busy (from your calendar):</span>{" "}
        {shown.map((b) => `${b.title} ${clock(b.start)}–${clock(Math.min(b.end, 24 * 60 - 1))}`).join(" · ")}
      </span>
    </p>
  );
}
