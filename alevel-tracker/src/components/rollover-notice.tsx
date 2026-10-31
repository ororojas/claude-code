import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { formatDay } from "@/lib/dates";
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
