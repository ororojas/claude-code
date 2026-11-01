import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { DRAWINGS } from "@/components/graphs";
import { GraphFigure, GraphsBoard } from "@/components/graphs/practice";
import { Card, PageTitle } from "@/components/ui";
import { GRAPHS, type GraphGuide } from "@/content/graphs";
import { loadCore } from "@/lib/data";
import { palette } from "@/lib/subjects";

export const metadata: Metadata = { title: "Graphs" };

const SUBJECTS = [
  { id: "econ", name: "Economics", paper: "AQA Paper 1" },
  { id: "business", name: "Business", paper: "Edexcel Paper 2 (Themes 2 & 3)" },
] as const;

export default async function GraphsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const active = s === "business" ? "business" : "econ";
  const { topics } = await loadCore();
  const guides = GRAPHS.filter((g) => g.subject === active);
  const sections = topics
    .filter((t) => t.subject_id === active)
    .map((t) => ({ topic: t, guides: guides.filter((g) => g.topicId === t.id) }))
    .filter((sec) => sec.guides.length);

  return (
    <>
      <PageTitle title="Graphs" subtitle="Every diagram worth knowing for the mocks, drawn out with the order to draw it in. Hide the labels or the whole graph to test yourself." />

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Subject">
        {SUBJECTS.map((x) => {
          const on = x.id === active;
          const count = GRAPHS.filter((g) => g.subject === x.id).length;
          return (
            <Link
              key={x.id}
              aria-current={on ? "page" : undefined}
              href={`/graphs?s=${x.id}`}
              className={`flex min-w-40 flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${on ? `${palette(x.id).border} ${palette(x.id).soft} ring-2 ring-slate-900/10` : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`size-2 rounded-full ${palette(x.id).dot}`} aria-hidden />
                {x.name}
                <span className="font-normal text-slate-500">· {x.paper}</span>
              </span>
              <span className="tabular-nums text-slate-500">{count}</span>
            </Link>
          );
        })}
      </nav>

      <details className="mb-6 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">Jump to a graph</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sections.map(({ topic, guides: gs }) => (
            <div key={topic.id}>
              <p className="text-xs font-semibold text-slate-500">{topic.title}</p>
              <ul className="mt-1 space-y-0.5">
                {gs.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`} className="text-slate-700 underline-offset-2 hover:underline">
                      {g.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <GraphsBoard>
        <div className="space-y-10">
          {sections.map(({ topic, guides: gs }) => (
            <section key={topic.id} aria-labelledby={`topic-${topic.id}`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`topic-${topic.id}`} className="text-lg font-semibold">
                  {topic.title}
                </h2>
                <Link href={`/teach/${topic.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                  <BookOpen className="size-4" aria-hidden /> Teach Me
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {gs.map((g) => (
                  <GraphCard key={g.id} guide={g} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </GraphsBoard>
    </>
  );
}

function GraphCard({ guide }: { guide: GraphGuide }) {
  const Drawing = DRAWINGS[guide.id];
  return (
    <Card className={guide.wide ? "md:col-span-2" : ""}>
      <article id={guide.id} className="scroll-mt-32">
        <h3 className="mb-2 font-semibold">{guide.title}</h3>
        <GraphFigure title={guide.title}>
          <Drawing />
        </GraphFigure>
        <p className="mt-3 text-sm text-slate-700">{guide.shows}</p>
        <details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Draw it in this order</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
            {guide.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="font-semibold">Use it for</dt>
            <dd className="text-slate-700">{guide.useFor}</dd>
          </div>
          <div>
            <dt className="font-semibold text-red-800">Watch out</dt>
            <dd className="text-slate-700">{guide.watchOut}</dd>
          </div>
        </dl>
      </article>
    </Card>
  );
}
