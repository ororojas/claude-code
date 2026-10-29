"use client";

import { useActionState } from "react";
import { addBlock, updateBlock, type FormState } from "@/app/actions";
import type { ScheduleItem } from "@/lib/types";
import { FormMessage, SubmitButton } from "./submit-button";

const KIND_OPTIONS = [
  ["content", "Content"],
  ["timed_paper", "Timed paper"],
  ["marking", "Marking"],
  ["mop_up", "Mop-up"],
  ["recall", "Recall"],
  ["exam", "Mock exam"],
] as const;

export function BlockForm({
  subjects,
  item,
  defaultDay,
}: {
  subjects: { id: string; name: string }[];
  item?: ScheduleItem;
  defaultDay: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(item ? updateBlock : addBlock, { ok: true, message: "" });
  const prefix = item ? `edit-${item.id}` : "new";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${prefix}-day`}>Day</label>
        <input id={`${prefix}-day`} type="date" name="day" required defaultValue={item?.day ?? defaultDay} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-start`}>Start</label>
        <input id={`${prefix}-start`} type="time" name="start_time" required defaultValue={item?.start_time.slice(0, 5) ?? "16:30"} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-end`}>End</label>
        <input id={`${prefix}-end`} type="time" name="end_time" required defaultValue={item?.end_time.slice(0, 5) ?? "18:30"} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${prefix}-subject`}>Subject</label>
        <select id={`${prefix}-subject`} name="subject_id" defaultValue={item?.subject_id ?? ""} className="field">
          <option value="">Mixed / none</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${prefix}-kind`}>Type</label>
        <select id={`${prefix}-kind`} name="kind" defaultValue={item?.kind ?? "mop_up"} className="field">
          {KIND_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="label" htmlFor={`${prefix}-title`}>Title</label>
        <input id={`${prefix}-title`} name="title" required maxLength={200} defaultValue={item?.title ?? ""} className="field" placeholder="e.g. Redo the 25-marker on externalities" />
      </div>
      <div className="sm:col-span-6">
        <label className="label" htmlFor={`${prefix}-detail`}>What exactly to do (optional)</label>
        <textarea id={`${prefix}-detail`} name="detail" rows={2} maxLength={1000} defaultValue={item?.detail ?? ""} className="field" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-6">
        <SubmitButton>{item ? "Save block" : "Add block"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
