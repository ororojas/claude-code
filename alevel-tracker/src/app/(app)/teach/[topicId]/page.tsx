import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Calculator, ChartLine, ClipboardCheck, GraduationCap, Lightbulb, ListChecks, PenLine, Users } from "lucide-react";
import { DiagramChecklist } from "@/components/diagram-checklist";
import { PercentPicker } from "@/components/percent-picker";
import { RagPicker } from "@/components/rag-picker";
import { TopicNotes } from "@/components/topic-notes";
import { TutorBox } from "@/components/tutor-box";
import { Card, PageTitle, SubjectTag } from "@/components/ui";
import { examTechnique, teachCard } from "@/content";
import { graphsFor } from "@/content/graphs";
import { loadCore } from "@/lib/data";
import { tutorEnabled } from "@/lib/tutor";

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const { topics } = await loadCore();
  const topic = topics.find((t) => t.id === topicId);
  return { title: topic ? `Teach Me: ${topic.title}` : "Teach Me" };
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-slate-500" aria-hidden />
        {title}
      </h2>
      {children}
    </Card>
  );
}

export default async function TeachPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const { subjects, topics, progress } = await loadCore();
  const topic = topics.find((t) => t.id === topicId);
  const card = teachCard(topicId);
  if (!topic || !card) notFound();

  const subject = subjects.find((s) => s.id === topic.subject_id)!;
  const technique = examTechnique(topic.subject_id);
  const p = progress.find((x) => x.topic_id === topicId);
  const siblings = topics.filter((t) => t.subject_id === topic.subject_id);
  const idx = siblings.findIndex((t) => t.id === topicId);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const graphs = graphsFor(topicId);

  return (
    <>
      <Link href={`/tracker?s=${topic.subject_id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden /> {subject.name} tracker
      </Link>
      <PageTitle
        title={topic.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SubjectTag subjectId={subject.id}>
              {subject.board} {subject.name}
            </SubjectTag>
            <span>{topic.spec_ref}</span>
            {topic.exam_focus ? <span>· Exam focus: {topic.exam_focus}</span> : null}
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-sm font-medium">After this session:</span>
        <RagPicker topicId={topic.id} status={p?.status ?? "red"} topicTitle={topic.title} />
        <PercentPicker topicId={topic.id} percent={p?.percent_complete ?? 0} topicTitle={topic.title} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Section icon={Lightbulb} title="High-yield summary">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-slate-400">
              {card.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Section>

          <Section icon={BookOpen} title="Key definitions">
            <dl className="divide-y divide-slate-100">
              {card.definitions.map((d) => (
                <div key={d.term} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
                  <dt className="text-sm font-semibold">{d.term}</dt>
                  <dd className="text-sm text-slate-700">{d.definition}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {card.diagrams?.length ? (
            <Section icon={ListChecks} title="Diagram checklist">
              <p className="mb-3 text-sm text-slate-600">Draw each one from memory, then tick off what you got right.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {card.diagrams.map((d) => (
                  <DiagramChecklist key={d.name} diagram={d} />
                ))}
              </div>
            </Section>
          ) : null}

          {graphs.length ? (
            <Section icon={ChartLine} title="Graphs to know">
              <p className="mb-3 text-sm text-slate-600">Drawn out step by step, with a mode that hides the labels so you can test yourself.</p>
              <ul className="flex flex-wrap gap-2">
                {graphs.map((g) => (
                  <li key={g.id}>
                    <Link href={`/graphs?s=${g.subject}#${g.id}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                      <ChartLine className="size-3.5" aria-hidden /> {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {card.formulas?.length ? (
            <Section icon={Calculator} title="Formulas">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {card.formulas.map((f) => (
                    <tr key={f.name}>
                      <th scope="row" className="py-2 pr-3 text-left align-top font-semibold">{f.name}</th>
                      <td className="py-2">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">{f.formula}</code>
                        {f.tip ? <p className="mt-1 text-xs text-slate-500">{f.tip}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {card.studies?.length ? (
            <Section icon={Users} title="Key studies and theorists">
              <ul className="grid gap-2 sm:grid-cols-2">
                {card.studies.map((s) => (
                  <li key={s.name} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-slate-700"> · {s.point}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section icon={PenLine} title="Essay structures">
            <div className="space-y-5">
              {card.essays.map((e, i) => (
                <article key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{e.label}</span>
                  </div>
                  <p className="mb-3 text-sm font-medium italic">“{e.question}”</p>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</h3>
                  <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                    {e.structure.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ol>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Model evaluation points</h3>
                  <ul className="space-y-1.5 text-sm">
                    {e.evaluation.map((s, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Section>

          <Section icon={AlertTriangle} title="Common mistakes">
            <ul className="space-y-1.5 text-sm">
              {card.mistakes.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-red-500" aria-hidden>✕</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={ClipboardCheck} title="Practice questions">
            <ol className="space-y-3 text-sm">
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
          </Section>
        </div>

        <aside className="space-y-6">
          <Card>
            <TopicNotes topicId={topic.id} initial={p?.notes ?? ""} />
          </Card>
          {tutorEnabled() ? (
            <Card>
              <TutorBox topicId={topic.id} topicTitle={topic.title} />
            </Card>
          ) : null}
          {technique ? (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <GraduationCap className="size-4 text-slate-500" aria-hidden /> Exam technique
              </h2>
              <p className="mb-3 text-xs text-slate-500">{technique.paper}</p>
              <p className="mb-3 text-sm text-slate-700">{technique.timing}</p>
              <ul className="space-y-2.5">
                {technique.questionTypes.map((q) => (
                  <li key={q.marks + q.command} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {q.marks} · {q.command}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">~{q.minutes} min</span>
                    </div>
                    <p className="text-slate-600">{q.howToHit}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <nav className="flex justify-between gap-2 text-sm" aria-label="Topic navigation">
            {prev ? (
              <Link href={`/teach/${prev.id}`} className="btn-secondary max-w-[48%] truncate">
                <ArrowLeft className="size-4 shrink-0" aria-hidden /> <span className="truncate">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/teach/${next.id}`} className="btn-secondary max-w-[48%] truncate">
                <span className="truncate">{next.title}</span> <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
          </nav>
        </aside>
      </div>
    </>
  );
}
