"use client";

import { useActionState, useState } from "react";
import { logAttempt, type FormState } from "@/app/actions";
import { gradeFor, marksToTarget, percentOf, type Boundaries } from "@/lib/grades";
import type { PastPaper, SubjectId, Topic } from "@/lib/types";
import { GradeBadge } from "./ui";
import { FormMessage, SubmitButton } from "./submit-button";

const REASONS = [
  { key: "lost_knowledge", label: "Knowledge gap", hint: "didn't know the content" },
  { key: "lost_timing", label: "Timing", hint: "ran out of time / rushed" },
  { key: "lost_structure", label: "Structure", hint: "no chain, no evaluation, no judgement" },
  { key: "lost_other", label: "Other", hint: "misread, calculation slip…" },
] as const;

export function AttemptForm({
  subjects,
  papers,
  topics,
  boundaries,
  targets,
  today,
  preselect,
}: {
  subjects: { id: SubjectId; name: string; max_marks: number }[];
  papers: PastPaper[];
  topics: Topic[];
  boundaries: Record<string, Boundaries>;
  targets: Record<string, string>;
  today: string;
  preselect?: PastPaper;
}) {
  const [subjectId, setSubjectId] = useState<SubjectId>(preselect?.subject_id ?? subjects[0].id);
  const [paperId, setPaperId] = useState(preselect?.id ?? "");
  const paper = papers.find((p) => p.id === paperId);
  const subject = subjects.find((s) => s.id === subjectId)!;
  const [title, setTitle] = useState(preselect ? paperTitle(preselect) : "");
  const [max, setMax] = useState(preselect?.max_marks ?? subject.max_marks);
  const [scored, setScored] = useState<string>("");
  const [lost, setLost] = useState<Record<string, string>>({});
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await logAttempt(prev, fd);
    if (result.ok) {
      setScored("");
      setLost({});
    }
    return result;
  }, { ok: true, message: "" });

  const scoreNum = Number(scored);
  const hasScore = scored !== "" && Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= max;
  const pct = hasScore ? percentOf(scoreNum, max) : null;
  const b = boundaries[subjectId];
  const grade = pct !== null && b ? gradeFor(pct, b) : null;
  const target = targets[subjectId] ?? "A";
  const gap = hasScore && b ? marksToTarget(scoreNum, max, target, b) : 0;
  const dropped = hasScore ? max - scoreNum : 0;
  const allocated = REASONS.reduce((s, r) => s + (Number(lost[r.key]) || 0), 0);
  const unallocated = dropped - allocated;

  function choosePaper(id: string) {
    setPaperId(id);
    const p = papers.find((x) => x.id === id);
    if (p) {
      setTitle(paperTitle(p));
      setMax(p.max_marks);
    }
  }

  function chooseSubject(id: SubjectId) {
    setSubjectId(id);
    setPaperId("");
    setTitle("");
    setMax(subjects.find((s) => s.id === id)!.max_marks);
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pa-subject">Subject</label>
          <select id="pa-subject" name="subject_id" className="field" value={subjectId} onChange={(e) => chooseSubject(e.target.value as SubjectId)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pa-paper">Paper from the bank</label>
          <select id="pa-paper" name="past_paper_id" className="field" value={paperId} onChange={(e) => choosePaper(e.target.value)}>
            <option value="">Custom / school mock paper</option>
            {papers.filter((p) => p.subject_id === subjectId).map((p) => (
              <option key={p.id} value={p.id}>{paperTitle(p)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pa-title">Paper title</label>
          <input id="pa-title" name="title" required className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. School mock Paper 1" maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="pa-date">Date sat</label>
          <input id="pa-date" name="sat_on" type="date" required defaultValue={today} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pa-score">Score</label>
            <input id="pa-score" name="marks_scored" type="number" inputMode="decimal" step="0.5" min={0} max={max} required className="field" value={scored} onChange={(e) => setScored(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pa-max">Out of</label>
            <input id="pa-max" name="max_marks" type="number" inputMode="numeric" min={1} required className="field" value={max} onChange={(e) => setMax(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="timed" defaultChecked className="size-4" /> Timed, exam conditions
          </label>
        </div>
        <div>
          <label className="label" htmlFor="pa-minutes">Minutes taken (optional)</label>
          <input id="pa-minutes" name="minutes_taken" type="number" inputMode="numeric" min={1} className="field" placeholder={String(paper?.duration_minutes ?? 120)} />
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3" aria-live="polite">
        {pct !== null && grade ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-2xl font-bold tabular-nums">{pct.toFixed(1)}%</span>
            <GradeBadge grade={grade} target={target} />
            <span className="text-slate-600">
              {gap === 0 ? `On or above your ${target} target.` : `${gap} more mark${gap === 1 ? "" : "s"} would have been ${target}.`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Enter your score to see the grade against the boundaries in Settings.</p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Dropped Marks Analysis</legend>
        <p className="mb-2 text-xs text-slate-500">
          Split the {hasScore ? dropped : "…"} marks you lost by reason.
          {hasScore ? (unallocated >= 0 ? ` ${unallocated} still unallocated.` : ` That's ${-unallocated} too many.`) : ""}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REASONS.map((r) => (
            <div key={r.key}>
              <label className="label" htmlFor={`pa-${r.key}`}>{r.label}</label>
              <input
                id={`pa-${r.key}`}
                name={r.key}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                className={`field ${unallocated < 0 ? "border-red-400" : ""}`}
                value={lost[r.key] ?? ""}
                onChange={(e) => setLost((l) => ({ ...l, [r.key]: e.target.value }))}
                placeholder="0"
              />
              <p className="mt-0.5 text-[11px] text-slate-500">{r.hint}</p>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Weak topics in this paper</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {topics.filter((t) => t.subject_id === subjectId).map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="weak_topic_ids" value={t.id} className="mt-0.5 size-4" />
              <span>{t.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="pa-reflection">What will you do differently?</label>
        <textarea id="pa-reflection" name="reflection" rows={3} maxLength={2000} className="field" placeholder="e.g. Spent 50 minutes on Section A; plan the 25-marker before writing" />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>Save score</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function paperTitle(p: PastPaper) {
  return `${p.component} ${p.series}${p.kind === "as_paper" ? " (AS)" : ""}`;
}
