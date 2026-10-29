import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Flag } from "lucide-react";
import { PercentPicker } from "@/components/percent-picker";
import { RagPicker } from "@/components/rag-picker";
import { Card, GradeBadge, PageTitle, ProgressBar, RagBar, Stat } from "@/components/ui";
import { loadAttempts, loadCore, loadSessions } from "@/lib/data";
import { formatHours } from "@/lib/dates";
import { subjectMetrics, weakTopicCounts } from "@/lib/metrics";
import { isSubjectId, palette } from "@/lib/subjects";
import type { Rag, Topic } from "@/lib/types";

export const metadata: Metadata = { title: "Syllabus tracker" };

export default async function TrackerPage({ searchParams }: { searchParams: Promise<{ s?: string; filter?: string }> }) {
  const { s, filter } = await searchParams;
  const { supabase, subjects, topics, targets, progress, boundaries } = await loadCore();
  const [sessions, attempts] = await Promise.all([loadSessions(supabase), loadAttempts(supabase)]);

  const active = isSubjectId(s) ? s : subjects[0]?.id;
  const subject = subjects.find((x) => x.id === active)!;
  const target = targets.find((t) => t.subject_id === active);
  const m = subjectMetrics(active, topics, progress, sessions, attempts, target, boundaries);
  const weak = weakTopicCounts(attempts);
  const byTopic = new Map(progress.map((p) => [p.topic_id, p]));
  const minutesByTopic = new Map<string, number>();
  for (const x of sessions) if (x.topic_id) minutesByTopic.set(x.topic_id, (minutesByTopic.get(x.topic_id) ?? 0) + x.minutes);

  const onlyWeak = filter === "todo";
  const subjectTopics = topics
    .filter((t) => t.subject_id === active)
    .filter((t) => !onlyWeak || (byTopic.get(t.id)?.status ?? "red") !== "green");
  const sections = [...new Set(subjectTopics.map((t) => t.section))];
  const p = palette(active);

  return (
    <>
      <PageTitle title="Syllabus tracker" subtitle="Set a traffic light for every topic. Anything red or amber gets a Teach Me button." />

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Subject">
        {subjects.map((x) => {
          const xm = subjectMetrics(x.id, topics, progress, sessions, attempts, targets.find((t) => t.subject_id === x.id), boundaries);
          const on = x.id === active;
          return (
            <Link
              key={x.id}
              aria-current={on ? "page" : undefined}
              href={`/tracker?s=${x.id}${onlyWeak ? "&filter=todo" : ""}`}
              className={`flex min-w-40 flex-1 flex-col gap-1.5 rounded-xl border px-3 py-2 text-sm ${on ? `${palette(x.id).border} ${palette(x.id).soft} ring-2 ring-slate-900/10` : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <span className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${palette(x.id).dot}`} aria-hidden />
                  {x.name}
                </span>
                <span className="tabular-nums text-slate-500">{xm.percentComplete}%</span>
              </span>
              <RagBar red={xm.red} amber={xm.amber} green={xm.green} />
            </Link>
          );
        })}
      </nav>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Hours logged" value={formatHours(m.minutesLogged)} sub={`target ${m.targetHours}h`}>
          <ProgressBar value={m.minutesLogged} max={m.targetHours * 60} className={p.bar} label="Hours logged against target" />
        </Stat>
        <Stat label="Topics mastered" value={`${m.green}/${m.topicsTotal}`} sub={`${m.amber} amber · ${m.red} red`}>
          <RagBar red={m.red} amber={m.amber} green={m.green} />
        </Stat>
        <Stat label="Completed" value={`${m.percentComplete}%`} sub="average across topics">
          <ProgressBar value={m.percentComplete} max={100} className={p.bar} label="Average completion" />
        </Stat>
        <Stat label="Papers done" value={`${m.papersDone}/${m.targetPapers}`} sub="timed papers">
          <ProgressBar value={m.papersDone} max={m.targetPapers} className={p.bar} label="Papers against target" />
        </Stat>
        <Stat
          label="Latest grade"
          value={m.latest ? <GradeBadge grade={m.latest.grade} target={m.targetGrade} /> : "—"}
          sub={m.latest ? `${m.latest.percent.toFixed(0)}% · avg ${m.average!.grade} · target ${m.targetGrade}` : `target ${m.targetGrade}`}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {subject.board} {subject.spec_code} · {subject.paper_label}
        </p>
        <div className="flex gap-1 text-sm">
          <Link href={`/tracker?s=${active}`} className={!onlyWeak ? "btn-primary py-1" : "btn-ghost py-1"}>All topics</Link>
          <Link href={`/tracker?s=${active}&filter=todo`} className={onlyWeak ? "btn-primary py-1" : "btn-ghost py-1"}>Red & amber only</Link>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <Card key={section} flush>
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{section}</h2>
            <ul className="divide-y divide-slate-100">
              {subjectTopics.filter((t) => t.section === section).map((t) => (
                <TopicRow
                  key={t.id}
                  topic={t}
                  status={byTopic.get(t.id)?.status ?? "red"}
                  percent={byTopic.get(t.id)?.percent_complete ?? 0}
                  flagged={weak.get(t.id) ?? 0}
                  minutes={minutesByTopic.get(t.id) ?? 0}
                />
              ))}
            </ul>
          </Card>
        ))}
        {sections.length === 0 ? <p className="text-sm text-slate-600">Every topic in {subject.name} is green.</p> : null}
      </div>
    </>
  );
}

function TopicRow({ topic, status, percent, flagged, minutes }: { topic: Topic; status: Rag; percent: number; flagged: number; minutes: number }) {
  const needsWork = status !== "green";
  return (
    <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{topic.spec_ref}</span>
          {flagged ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              <Flag className="size-3" aria-hidden /> weak in {flagged} paper{flagged > 1 ? "s" : ""}
            </span>
          ) : null}
          {minutes ? <span className="text-xs text-slate-500">{formatHours(minutes)} logged</span> : null}
        </div>
        <p className="mt-0.5 font-medium leading-snug">{topic.title}</p>
        {topic.exam_focus ? <p className="mt-0.5 text-xs text-slate-500">Exam focus: {topic.exam_focus}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RagPicker topicId={topic.id} status={status} topicTitle={topic.title} />
        <PercentPicker topicId={topic.id} percent={percent} topicTitle={topic.title} />
        <Link
          href={`/teach/${topic.id}`}
          className={needsWork ? "btn-primary py-1.5 text-xs" : "btn-secondary py-1.5 text-xs"}
          aria-label={`Teach me: ${topic.title}`}
        >
          <BookOpen className="size-3.5" aria-hidden />
          {needsWork ? "Teach Me" : "Review"}
        </Link>
      </div>
    </li>
  );
}
