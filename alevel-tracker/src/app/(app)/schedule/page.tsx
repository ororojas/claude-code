import type { Metadata } from "next";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { deleteBlock, resetPlan } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { BlockCheck } from "@/components/block-check";
import { BlockForm } from "@/components/block-form";
import { Card, KIND_LABEL, PageTitle, ProgressBar, SectionTitle } from "@/components/ui";
import { loadCore, loadSchedule } from "@/lib/data";
import { durationMinutes, formatDay, formatHours, hhmm, todayISO } from "@/lib/dates";
import { PHASES, phaseFor } from "@/lib/plan";
import { palette } from "@/lib/subjects";
import type { ScheduleItem } from "@/lib/types";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const today = todayISO();
  const { supabase, subjects } = await loadCore();
  const items = await loadSchedule(supabase);

  const byDay = new Map<string, ScheduleItem[]>();
  for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const days = [...byDay.keys()].sort();
  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));
  const done = items.filter((i) => i.completed_at).length;

  // Group days by phase; anything outside the plan goes in "Other days".
  const groups = PHASES.map((ph) => ({ ...ph, days: days.filter((d) => d >= ph.start && d <= ph.end) }));
  const extra = days.filter((d) => !PHASES.some((ph) => d >= ph.start && d <= ph.end));
  const currentPhase = phaseFor(today).key;

  return (
    <>
      <PageTitle title="Schedule" subtitle={`${done} of ${items.length} blocks done. Ticking a block logs its time against the subject.`}>
        <ActionButton
          action={resetPlan}
          confirm="Restore the original timetable? Your edits and ticks will be lost (logged hours stay)."
          className="btn-secondary"
        >
          <RotateCcw className="size-4" aria-hidden /> Reset plan
        </ActionButton>
      </PageTitle>

      <div className="space-y-8">
        {groups.map((g) =>
          g.days.length ? (
            <section key={g.key} aria-labelledby={`phase-${g.key}`}>
              <div className={`mb-3 rounded-xl px-4 py-3 ${currentPhase === g.key ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
                <h2 id={`phase-${g.key}`} className="font-semibold">
                  {g.label} <span className="font-normal opacity-75">· {formatDay(g.start)} – {formatDay(g.end)}</span>
                </h2>
                <p className="text-sm opacity-80">{g.focus}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {g.days.map((d) => (
                  <DayCard key={d} day={d} items={byDay.get(d)!} today={today} subjects={subjectOptions} />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {extra.length ? (
          <section>
            <h2 className="mb-3 font-semibold">Other days</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {extra.map((d) => (
                <DayCard key={d} day={d} items={byDay.get(d)!} today={today} subjects={subjectOptions} />
              ))}
            </div>
          </section>
        ) : null}

        <Card>
          <SectionTitle>Add a block</SectionTitle>
          <BlockForm subjects={subjectOptions} defaultDay={today} />
        </Card>
      </div>
    </>
  );
}

function DayCard({ day, items, today, subjects }: { day: string; items: ScheduleItem[]; today: string; subjects: { id: string; name: string }[] }) {
  const done = items.filter((i) => i.completed_at).length;
  const minutes = items.reduce((s, i) => s + durationMinutes(i.start_time, i.end_time), 0);
  const isToday = day === today;
  const missed = day < today && done < items.length;
  return (
    <Card className={isToday ? "ring-2 ring-slate-900" : missed ? "border-amber-300" : ""}>
      <div id={`day-${day}`} className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {formatDay(day)} {isToday ? <span className="ml-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">Today</span> : null}
        </h3>
        <span className="text-xs tabular-nums text-slate-500">
          {done}/{items.length} · {formatHours(minutes)}
        </span>
      </div>
      <ProgressBar value={done} max={items.length} className="bg-green-500" label={`Blocks done on ${formatDay(day)}`} />
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-100 p-2">
            <div className="flex items-start gap-2.5">
              <BlockCheck itemId={item.id} done={Boolean(item.completed_at)} title={item.title} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`size-2 rounded-full ${palette(item.subject_id).dot}`} aria-hidden />
                  <span className="tabular-nums">
                    {hhmm(item.start_time)}–{hhmm(item.end_time)}
                  </span>
                  <span>· {KIND_LABEL[item.kind]}</span>
                </div>
                <p className={`text-sm font-medium leading-snug ${item.completed_at ? "text-slate-500 line-through" : ""}`}>{item.title}</p>
              </div>
            </div>
            <details className="mt-1 pl-8">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
                <Pencil className="size-3" aria-hidden /> Details & edit
              </summary>
              {item.detail ? <p className="mt-2 text-sm text-slate-600">{item.detail}</p> : null}
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <BlockForm subjects={subjects} item={item} defaultDay={item.day} />
                <div className="mt-2 flex justify-end">
                  <ActionButton
                    action={deleteBlock.bind(null, item.id)}
                    confirm={`Delete "${item.title}"?`}
                    className="btn-ghost text-xs text-red-700"
                    label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Delete
                  </ActionButton>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}
