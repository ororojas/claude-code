"use client";

import { useOptimistic, useTransition } from "react";
import { setTopicPercent } from "@/app/actions";

const STEPS = [0, 25, 50, 75, 100];

export function PercentPicker({ topicId, percent, topicTitle }: { topicId: string; percent: number; topicTitle: string }) {
  const [optimistic, setOptimistic] = useOptimistic(percent);
  const [, startTransition] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className="sr-only">Percent complete for {topicTitle}</span>
      <select
        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums"
        value={optimistic}
        onChange={(e) => {
          const value = Number(e.target.value);
          startTransition(async () => {
            setOptimistic(value);
            await setTopicPercent(topicId, value);
          });
        }}
      >
        {(STEPS.includes(optimistic) ? STEPS : [...STEPS, optimistic].sort((a, b) => a - b)).map((s) => (
          <option key={s} value={s}>
            {s}% done
          </option>
        ))}
      </select>
    </label>
  );
}
