"use client";

import { useActionState, useState, useTransition } from "react";
import { resetBoundaries, saveBoundaries, saveTargets, type FormState } from "@/app/actions";
import { GRADES } from "@/lib/grades";
import type { UserSubject } from "@/lib/types";
import { FormMessage, SubmitButton } from "./submit-button";

const initial: FormState = { ok: true, message: "" };

export function TargetsForm({ subjectId, target }: { subjectId: string; target: UserSubject }) {
  const [state, action] = useActionState(saveTargets, initial);
  const id = (k: string) => `${subjectId}-${k}`;
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <input type="hidden" name="subject_id" value={subjectId} />
      <div>
        <label className="label" htmlFor={id("grade")}>Target grade</label>
        <select id={id("grade")} name="target_grade" defaultValue={target.target_grade} className="field">
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("hours")}>Target hours</label>
        <input id={id("hours")} name="target_hours" type="number" step="0.5" min={0} max={500} defaultValue={Number(target.target_hours)} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={id("papers")}>Target papers</label>
        <input id={id("papers")} name="target_papers" type="number" min={0} max={50} defaultValue={target.target_papers} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={id("date")}>Exam date</label>
        <input id={id("date")} name="exam_date" type="date" defaultValue={target.exam_date} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={id("session")}>Session</label>
        <select id={id("session")} name="exam_session" defaultValue={target.exam_session ?? ""} className="field">
          <option value="">Not confirmed</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-5">
        <SubmitButton className="btn-secondary">Save targets</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function toMarks(percents: Record<string, number>, max: number): Record<string, string> {
  return Object.fromEntries(GRADES.map((g) => [g, Number.isFinite(percents[g]) ? String(Math.ceil((percents[g] * max) / 100 - 1e-9)) : ""]));
}

export function BoundariesForm({
  subjectId,
  maxMarks,
  percents,
  defaults,
  custom,
}: {
  subjectId: string;
  maxMarks: number;
  percents: Record<string, number>;
  defaults: Record<string, number>;
  custom: boolean;
}) {
  const [state, action] = useActionState(saveBoundaries, initial);
  const [max, setMax] = useState(String(maxMarks));
  const [marks, setMarks] = useState(() => toMarks(percents, maxMarks));
  const [resetMessage, setResetMessage] = useState("");
  const [resetting, startReset] = useTransition();
  const id = (k: string) => `${subjectId}-b-${k}`;

  return (
    <form action={action} className="space-y-3" onSubmit={() => setResetMessage("")}>
      <input type="hidden" name="subject_id" value={subjectId} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        <div>
          <label className="label" htmlFor={id("max")}>Out of</label>
          <input id={id("max")} name="max_marks" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} className="field" />
        </div>
        {GRADES.map((g) => (
          <div key={g}>
            <label className="label" htmlFor={id(g)}>{g}</label>
            <input
              id={id(g)}
              name={`grade_${g}`}
              type="number"
              step="0.5"
              min={0}
              value={marks[g]}
              onChange={(e) => setMarks((m) => ({ ...m, [g]: e.target.value }))}
              className="field"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-secondary">Save my boundaries</SubmitButton>
        {custom ? (
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={resetting}
            onClick={() => {
              if (!window.confirm("Go back to the default boundaries?")) return;
              startReset(async () => {
                await resetBoundaries(subjectId);
                setMax(String(maxMarks));
                setMarks(toMarks(defaults, maxMarks));
                setResetMessage("Back to the default boundaries.");
              });
            }}
          >
            Use default boundaries
          </button>
        ) : null}
        {resetMessage ? <p role="status" className="text-sm text-green-700">{resetMessage}</p> : <FormMessage state={state} />}
      </div>
    </form>
  );
}
