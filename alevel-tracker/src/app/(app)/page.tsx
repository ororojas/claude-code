import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, ExternalLink, FileText, Trash2 } from "lucide-react";
import { deleteSession } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { BlockCheck } from "@/components/block-check";
import { LogSessionForm } from "@/components/log-session-form";
import { Card, Empty, KIND_LABEL, PageTitle, ProgressBar, RagBadge, SectionTitle, Stat, SubjectTag } from "@/components/ui";
import { loadAttempts, loadCore, loadPapers, loadSchedule, loadSessions } from "@/lib/data";
import { addDays, daysBetween, durationMinutes, formatDay, formatHours, hhmm, londonMinutes, toMinutes, todayISO, weekStart } from "@/lib/dates";
import { phaseFor, PLAN_END } from "@/lib/plan";
import { palette } from "@/lib/subjects";
import type { PastPaper, ScheduleItem, Topic } from "@/lib/types";

export default async function TodayPage() {
  const today = todayISO();
  const nowMinutes = londonMinutes();
  const { supabase, subjects, topics, targets, progress } = await loadCore();
  const [schedule, sessions, attempts, papers] = await Promise.all([
    loadSchedule(supabase),
    loadSessions(supabase),
    loadAttempts(supabase),
    loadPapers(supabase),
  ]);

  const phase = phaseFor(today);
  const todays = schedule.filter((s) => s.day === today);
  // If today is empty (e.g. a rest day), show the next day that has blocks.
  const nextDay = todays.length ? null : schedule.find((s) => s.day > today)?.day ?? null;
  const shown = todays.length ? todays : nextDay ? schedule.filter((s) => s.day === nextDay) : [];
  const shownDay = todays.length ? today : nextDay;
  const tomorrow = schedule.filter((s) => s.day === addDays(today, 1));

  const doneCount = todays.filter((s) => s.completed_at).length;
  const plannedMinutes = todays.reduce((sum, s) => sum + durationMinutes(s.start_time, s.end_time), 0);
  const weekFrom = weekStart(today);
  const weekMinutes = sessions.filter((s) => s.studied_on >= weekFrom && s.studied_on <= today).reduce((a, s) => a + s.minutes, 0);
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const totalTarget = targets.reduce((a, t) => a + Number(t.target_hours), 0);
  const greens = progress.filter((p) => p.status === "green").length;
  const papersTarget = targets.reduce((a, t) => a + t.target_papers, 0);

  const topicById = new Map(topics.map((t) => [t.id, t]));
  // Ticked blocks are undone by unticking; only hand-logged sessions get a delete button.
  const manualSessions = sessions.filter((s) => !s.schedule_item_id).slice(0, 5);
  const paperById = new Map(papers.map((p) => [p.id, p]));
  const statusById = new Map(progress.map((p) => [p.topic_id, p.status]));
  const priority = topics
    .filter((t) => (statusById.get(t.id) ?? "red") !== "green")
    .sort((a, b) => (statusById.get(a.id) === "red" ? 0 : 1) - (statusById.get(b.id) === "red" ? 0 : 1))
    .slice(0, 6);

  return (
    <>
      <PageTitle title={formatDay(today, "long")} subtitle={<><span className="font-medium text-slate-900">{phase.label}:</span> {phase.focus}</>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {subjects.map((s) => {
          const t = targets.find((x) => x.subject_id === s.id);
          const examDate = t?.exam_date ?? today;
          const days = daysBetween(today, examDate);
          const p = palette(s.id);
          return (
            <div key={s.id} className={`rounded-2xl border p-4 ${p.border} ${p.soft}`}>
              <div className={`text-sm font-semibold ${p.text}`}>{s.name}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {days > 0 ? days : days === 0 ? "Today" : "Done"}
                {days > 0 ? <span className="ml-1 text-base font-medium text-slate-600">{days === 1 ? "day" : "days"}</span> : null}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {formatDay(examDate)} · {t?.exam_session ?? "session TBC"} · target {t?.target_grade ?? "A"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <SectionTitle
              aside={todays.length ? <span className="text-sm text-slate-500 tabular-nums">{doneCount}/{todays.length} done · {formatHours(plannedMinutes)} planned</span> : null}
            >
              {todays.length ? "Today's checklist" : shownDay ? `Nothing scheduled today. Next up: ${formatDay(shownDay)}` : "Today's checklist"}
            </SectionTitle>
            {todays.length ? <ProgressBar value={doneCount} max={todays.length} className="bg-green-500" label="Blocks done today" /> : null}
            {shown.length ? (
              <ol className="mt-4 space-y-3">
                {shown.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    isNow={item.day === today && nowMinutes >= toMinutes(item.start_time) && nowMinutes < toMinutes(item.end_time)}
                    topicById={topicById}
                    paper={item.past_paper_id ? paperById.get(item.past_paper_id) : undefined}
                  />
                ))}
              </ol>
            ) : (
              <Empty>{today > PLAN_END ? "The mock timetable is finished. Log your real results in Papers." : "No blocks scheduled. Add some in Schedule."}</Empty>
            )}
          </Card>

          {tomorrow.length && todays.length ? (
            <Card>
              <SectionTitle aside={<Link href="/schedule" className="text-sm text-slate-500 hover:text-slate-900">Full schedule →</Link>}>Tomorrow</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {tomorrow.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 tabular-nums text-slate-500">{hhmm(i.start_time)}–{hhmm(i.end_time)}</span>
                    <span className={`size-2 shrink-0 rounded-full ${palette(i.subject_id).dot}`} aria-hidden />
                    <span className="truncate">{i.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Log extra study time</SectionTitle>
            <p className="mb-3 text-sm text-slate-600">Ticking a block logs its time automatically. Use this for anything off-plan.</p>
            <LogSessionForm subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} topics={topics} today={today} />
            {manualSessions.length ? (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold">Recently logged by hand</h3>
                <ul className="space-y-1.5 text-sm">
                  {manualSessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${palette(s.subject_id).dot}`} aria-hidden />
                      <span className="w-20 shrink-0 text-slate-500">{formatDay(s.studied_on)}</span>
                      <span className="w-12 shrink-0 tabular-nums">{s.minutes}m</span>
                      <span className="min-w-0 flex-1 truncate text-slate-600">{s.note ?? topicById.get(s.topic_id ?? "")?.title ?? ""}</span>
                      <ActionButton action={deleteSession.bind(null, s.id)} confirm="Delete this logged session?" className="btn-ghost p-1 text-slate-400 hover:text-red-700" label="Delete session">
                        <Trash2 className="size-4" aria-hidden />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Stat label="Hours this week" value={formatHours(weekMinutes)} sub={`${formatHours(totalMinutes)} of ${totalTarget}h total target`}>
              <ProgressBar value={totalMinutes} max={totalTarget * 60} label="Hours logged against target" />
            </Stat>
            <Stat label="Topics mastered" value={`${greens}/${topics.length}`} sub="green across all three">
              <ProgressBar value={greens} max={topics.length} className="bg-green-500" label="Topics mastered" />
            </Stat>
            <Stat label="Papers done" value={`${attempts.length}/${papersTarget}`} sub="timed papers logged">
              <ProgressBar value={attempts.length} max={papersTarget} label="Papers done against target" />
            </Stat>
          </div>

          <Card>
            <SectionTitle aside={<Link href="/tracker" className="text-sm text-slate-500 hover:text-slate-900">Tracker →</Link>}>Fix next</SectionTitle>
            {priority.length ? (
              <ul className="space-y-2">
                {priority.map((t) => (
                  <li key={t.id}>
                    <Link href={`/teach/${t.id}`} className="group flex items-start gap-2 rounded-lg p-1.5 hover:bg-slate-50">
                      <RagBadge status={statusById.get(t.id) ?? "red"} />
                      <span className="flex-1 text-sm leading-snug">{t.title}</span>
                      <BookOpen className="mt-0.5 size-4 shrink-0 text-slate-400 group-hover:text-slate-900" aria-label="Teach me" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Everything is green. Keep doing timed papers.</Empty>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function ChecklistItem({
  item,
  isNow,
  topicById,
  paper,
}: {
  item: ScheduleItem;
  isNow: boolean;
  topicById: Map<string, Topic>;
  paper?: PastPaper;
}) {
  const done = Boolean(item.completed_at);
  return (
    <li className={`flex gap-3 rounded-xl border p-3 ${isNow ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200"} ${done ? "bg-slate-50" : "bg-white"}`}>
      <BlockCheck itemId={item.id} done={done} title={item.title} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium tabular-nums text-slate-700">
            <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {hhmm(item.start_time)}–{hhmm(item.end_time)}
          </span>
          {item.subject_id ? <SubjectTag subjectId={item.subject_id}>{KIND_LABEL[item.kind]}</SubjectTag> : <span className="rounded-full bg-slate-100 px-2 py-0.5">{KIND_LABEL[item.kind]}</span>}
          {isNow ? <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">Now</span> : null}
        </div>
        <p className={`mt-1 font-medium ${done ? "text-slate-500 line-through" : ""}`}>{item.title}</p>
        {item.detail ? <p className="mt-1 text-sm text-slate-600">{item.detail}</p> : null}
        {item.topic_ids.length || paper ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.topic_ids.map((id) => {
              const t = topicById.get(id);
              return t ? (
                <Link key={id} href={`/teach/${id}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">
                  <BookOpen className="size-3" aria-hidden /> {t.title}
                </Link>
              ) : null;
            })}
            {paper ? (
              <>
                <a href={paper.qp_url ?? paper.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">
                  <FileText className="size-3" aria-hidden /> {paper.qp_url ? "Question paper" : "Find paper"} <ExternalLink className="size-3" aria-hidden />
                </a>
                {paper.ms_url ? (
                  <a href={paper.ms_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">
                    Mark scheme <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
                {item.kind === "marking" || item.kind === "timed_paper" ? (
                  <Link href={`/papers?view=log&log=${paper.id}#log`} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
                    Log score <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
