import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle2, ExternalLink, Trash2 } from "lucide-react";
import { deleteAttempt } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { AttemptForm } from "@/components/attempt-form";
import { Card, Empty, GradeBadge, PageTitle, SectionTitle, SubjectTag } from "@/components/ui";
import { teachCard } from "@/content";
import { loadAttempts, loadCore, loadPapers } from "@/lib/data";
import { formatDay, todayISO } from "@/lib/dates";
import { boundariesFor, gradeFor, percentOf, type Boundaries } from "@/lib/grades";
import { biggestLeak, DROPPED_ADVICE, droppedMarks, weakTopicCounts, type DroppedMarks } from "@/lib/metrics";
import { FILTER_LABEL, isSubjectId, palette } from "@/lib/subjects";
import type { PaperAttempt, PastPaper, SubjectId } from "@/lib/types";

export const metadata: Metadata = { title: "Past papers" };

const VIEWS = [
  { key: "log", label: "Score log" },
  { key: "bank", label: "Paper bank" },
  { key: "questions", label: "Topic question sets" },
] as const;

type View = (typeof VIEWS)[number]["key"];

export default async function PapersPage({ searchParams }: { searchParams: Promise<{ s?: string; view?: string; log?: string }> }) {
  const params = await searchParams;
  const filter = isSubjectId(params.s) ? params.s : null;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "log";

  const { supabase, subjects, topics, targets, boundaries } = await loadCore();
  const [papers, attempts] = await Promise.all([loadPapers(supabase), loadAttempts(supabase)]);

  const shownPapers = papers.filter((p) => !filter || p.subject_id === filter);
  const shownAttempts = attempts.filter((a) => !filter || a.subject_id === filter);
  const boundaryMap: Record<string, Boundaries> = Object.fromEntries(subjects.map((s) => [s.id, boundariesFor(boundaries, s.id)]));
  const targetMap: Record<string, string> = Object.fromEntries(targets.map((t) => [t.subject_id, t.target_grade]));
  const attemptsByPaper = new Map<string, PaperAttempt[]>();
  for (const a of attempts) if (a.past_paper_id) attemptsByPaper.set(a.past_paper_id, [...(attemptsByPaper.get(a.past_paper_id) ?? []), a]);
  const preselect = params.log ? papers.find((p) => p.id === params.log) : undefined;

  const href = (next: { s?: SubjectId | null; view?: View }) => {
    const q = new URLSearchParams();
    const s = next.s === undefined ? filter : next.s;
    if (s) q.set("s", s);
    q.set("view", next.view ?? view);
    return `/papers?${q.toString()}`;
  };

  return (
    <>
      <PageTitle title="Past papers" subtitle="Find a paper, sit it timed, then log the score and where the marks went." />

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by subject">
        <Link href={href({ s: null })} aria-current={!filter ? "true" : undefined} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm aria-[current=true]:border-slate-900 aria-[current=true]:bg-slate-900 aria-[current=true]:text-white">
          All
        </Link>
        {subjects.map((s) => (
          <Link
            key={s.id}
            href={href({ s: s.id })}
            aria-current={filter === s.id ? "true" : undefined}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm aria-[current=true]:border-slate-900 aria-[current=true]:bg-slate-900 aria-[current=true]:text-white"
          >
            <span className={`size-2 rounded-full ${palette(s.id).dot}`} aria-hidden />
            {FILTER_LABEL[s.id]}
          </Link>
        ))}
      </div>

      <nav className="mb-6 flex gap-1 border-b border-slate-200" aria-label="Papers sections">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ view: v.key })}
            aria-current={view === v.key ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:text-slate-900 aria-[current=page]:border-slate-900 aria-[current=page]:font-semibold aria-[current=page]:text-slate-900"
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "log" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <DroppedMarksCard attempts={shownAttempts} topics={topics} />
            <Card>
              <SectionTitle>Logged papers</SectionTitle>
              {shownAttempts.length ? (
                <ul className="divide-y divide-slate-100">
                  {shownAttempts.map((a) => (
                    <AttemptRow key={a.id} attempt={a} boundaries={boundaryMap[a.subject_id]} target={targetMap[a.subject_id] ?? "A"} topics={topics} />
                  ))}
                </ul>
              ) : (
                <Empty>No papers logged yet. Your first timed papers are on 31 Oct and 1 Nov.</Empty>
              )}
            </Card>
          </div>
          <Card className="h-fit lg:sticky lg:top-20">
            <div id="log" className="scroll-mt-24">
              <SectionTitle>Log a score</SectionTitle>
              <AttemptForm
                key={preselect?.id ?? "blank"}
                subjects={subjects.map((s) => ({ id: s.id, name: s.name, max_marks: s.max_marks }))}
                papers={papers}
                topics={topics}
                boundaries={boundaryMap}
                targets={targetMap}
                today={todayISO()}
                preselect={preselect}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {view === "bank" ? (
        <div className="space-y-6">
          {subjects
            .filter((s) => !filter || s.id === filter)
            .map((s) => (
              <Card key={s.id} flush>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <h2 className="font-semibold">
                    {s.board} {s.name} <span className="font-normal text-slate-500">· {s.paper_label}</span>
                  </h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {shownPapers.filter((p) => p.subject_id === s.id).map((p) => (
                    <PaperRow key={p.id} paper={p} attempts={attemptsByPaper.get(p.id) ?? []} boundaries={boundaryMap[p.subject_id]} />
                  ))}
                </ul>
              </Card>
            ))}
          <p className="text-xs text-slate-500">
            Links go to the exam board&apos;s own files where they are public, or to Physics & Maths Tutor for Economics papers AQA no longer hosts.
            Papers marked &quot;Find on board site&quot; are behind the board&apos;s past-paper search or teacher login. Ask your teacher if one is locked.
          </p>
        </div>
      ) : null}

      {view === "questions" ? (
        <div className="space-y-6">
          {subjects
            .filter((s) => !filter || s.id === filter)
            .map((s) => (
              <section key={s.id}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <span className={`size-2.5 rounded-full ${palette(s.id).dot}`} aria-hidden /> {s.name}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {topics.filter((t) => t.subject_id === s.id).map((t) => {
                    const card = teachCard(t.id);
                    if (!card) return null;
                    return (
                      <Card key={t.id}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug">{t.title}</h3>
                          <Link href={`/teach/${t.id}`} className="shrink-0 text-xs text-slate-500 hover:text-slate-900">
                            <BookOpen className="mr-0.5 inline size-3.5" aria-hidden /> Teach Me
                          </Link>
                        </div>
                        <ol className="space-y-2 text-sm">
                          {card.practice.map((q, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="h-fit shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{q.marks}</span>
                              <div>
                                <p>{q.question}</p>
                                {q.answer ? (
                                  <details className="mt-1 text-xs">
                                    <summary className="cursor-pointer text-slate-500">Show worked answer</summary>
                                    <p className="mt-1 rounded bg-green-50 p-2 text-green-900">{q.answer}</p>
                                  </details>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          <p className="text-xs text-slate-500">These are exam-style questions written for this tracker, not copied from past papers. Use the paper bank for the real thing.</p>
        </div>
      ) : null}
    </>
  );
}

function PaperRow({ paper, attempts, boundaries }: { paper: PastPaper; attempts: PaperAttempt[]; boundaries: Boundaries }) {
  const best = attempts.reduce<PaperAttempt | null>((b, a) => (!b || a.marks_scored / a.max_marks > b.marks_scored / b.max_marks ? a : b), null);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{paper.series}</span>
          <span className="text-sm text-slate-500">{paper.component}</span>
          {paper.kind === "as_paper" ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">AS</span> : null}
          {paper.kind === "specimen" ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">Specimen</span> : null}
          {best ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="size-3.5" aria-hidden /> {Number(best.marks_scored)}/{best.max_marks} · {gradeFor(percentOf(Number(best.marks_scored), best.max_marks), boundaries)}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-600">
          {paper.title} · {paper.max_marks} marks · {paper.duration_minutes / 60}h{paper.notes ? ` · ${paper.notes}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {paper.qp_url ? (
          <a href={paper.qp_url} target="_blank" rel="noreferrer" className="btn-secondary py-1 text-xs">
            Paper <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        {paper.ms_url ? (
          <a href={paper.ms_url} target="_blank" rel="noreferrer" className="btn-secondary py-1 text-xs">
            Mark scheme <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        {!paper.qp_url || !paper.ms_url ? (
          <a href={paper.source_url} target="_blank" rel="noreferrer" className="btn-ghost py-1 text-xs">
            Find on board site <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        <Link href={`/papers?view=log&log=${paper.id}#log`} className="btn-primary py-1 text-xs">
          Log score
        </Link>
      </div>
    </li>
  );
}

function AttemptRow({ attempt: a, boundaries, target, topics }: { attempt: PaperAttempt; boundaries: Boundaries; target: string; topics: { id: string; title: string }[] }) {
  const scored = Number(a.marks_scored);
  const pct = percentOf(scored, a.max_marks);
  const grade = gradeFor(pct, boundaries);
  const d = droppedMarks([a]);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <SubjectTag subjectId={a.subject_id}>{formatDay(a.sat_on)}</SubjectTag>
        <span className="font-medium">{a.title}</span>
        {!a.timed ? <span className="text-xs text-slate-500">(untimed)</span> : null}
        <span className="ml-auto flex items-center gap-2">
          <span className="tabular-nums text-sm">
            {scored}/{a.max_marks} · {pct.toFixed(0)}%
          </span>
          <GradeBadge grade={grade} target={target} />
          <ActionButton action={deleteAttempt.bind(null, a.id)} confirm={`Delete "${a.title}"?`} className="btn-ghost p-1 text-slate-400 hover:text-red-700" label={`Delete ${a.title}`}>
            <Trash2 className="size-4" aria-hidden />
          </ActionButton>
        </span>
      </div>
      {d.total > 0 ? <DroppedBar d={d} className="mt-2" /> : null}
      {a.weak_topic_ids.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {a.weak_topic_ids.map((id) => {
            const t = topics.find((x) => x.id === id);
            return t ? (
              <Link key={id} href={`/teach/${id}`} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800 hover:bg-red-100">
                {t.title}
              </Link>
            ) : null;
          })}
        </div>
      ) : null}
      {a.reflection ? <p className="mt-2 text-sm text-slate-600">“{a.reflection}”</p> : null}
    </li>
  );
}

const SEGMENTS = [
  { key: "knowledge", label: "Knowledge", className: "bg-rose-500" },
  { key: "timing", label: "Timing", className: "bg-amber-500" },
  { key: "structure", label: "Structure", className: "bg-indigo-500" },
  { key: "other", label: "Other", className: "bg-slate-500" },
  { key: "unassigned", label: "Not split", className: "bg-slate-200" },
] as const;

function DroppedBar({ d, className = "" }: { d: DroppedMarks; className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={SEGMENTS.map((s) => `${s.label} ${d[s.key]}`).join(", ")}>
        {SEGMENTS.map((s) => (d[s.key] > 0 ? <div key={s.key} className={s.className} style={{ width: `${(d[s.key] / d.total) * 100}%` }} /> : null))}
      </div>
    </div>
  );
}

function DroppedMarksCard({ attempts, topics }: { attempts: PaperAttempt[]; topics: { id: string; title: string }[] }) {
  const d = droppedMarks(attempts);
  const leak = biggestLeak(d);
  const weak = [...weakTopicCounts(attempts).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <Card>
      <SectionTitle>Dropped Marks Analysis</SectionTitle>
      {d.total === 0 ? (
        <Empty>Log a paper and split the marks you lost to see where they go.</Empty>
      ) : (
        <>
          <DroppedBar d={d} />
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-sm ${s.className}`} aria-hidden />
                <span className="text-slate-600">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums sm:ml-0">{d[s.key]}</span>
              </li>
            ))}
          </ul>
          {leak ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{DROPPED_ADVICE[leak]}</p> : null}
          {weak.length ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-slate-500">Most-tagged weak topics</p>
              <div className="flex flex-wrap gap-1.5">
                {weak.map(([id, n]) => {
                  const t = topics.find((x) => x.id === id);
                  return t ? (
                    <Link key={id} href={`/teach/${id}`} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100">
                      {t.title} <span className="font-semibold">×{n}</span>
                    </Link>
                  ) : null;
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
