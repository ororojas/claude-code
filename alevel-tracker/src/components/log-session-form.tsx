"use client";

import { useActionState } from "react";
import { logSession, type FormState } from "@/app/actions";
import { FormMessage, SubmitButton } from "./submit-button";

interface Option {
  id: string;
  name: string;
}

export function LogSessionForm({
  subjects,
  topics,
  today,
}: {
  subjects: Option[];
  topics: { id: string; title: string; subject_id: string }[];
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(logSession, { ok: true, message: "" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="ls-subject">Subject</label>
        <select id="ls-subject" name="subject_id" className="field" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ls-topic">Topic (optional)</label>
        <select id="ls-topic" name="topic_id" className="field" defaultValue="">
          <option value="">—</option>
          {subjects.map((s) => (
            <optgroup key={s.id} label={s.name}>
              {topics.filter((t) => t.subject_id === s.id).map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ls-minutes">Minutes</label>
        <input id="ls-minutes" name="minutes" type="number" inputMode="numeric" min={1} max={960} required className="field" placeholder="45" />
      </div>
      <div>
        <label className="label" htmlFor="ls-date">Date</label>
        <input id="ls-date" name="studied_on" type="date" defaultValue={today} required className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ls-note">Note (optional)</label>
        <input id="ls-note" name="note" className="field" placeholder="e.g. flashcards on elasticities" maxLength={500} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Log time</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
