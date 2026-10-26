"use client";

import { useOptimistic, useTransition } from "react";
import { setTopicStatus } from "@/app/actions";
import type { Rag } from "@/lib/types";

const OPTIONS: { value: Rag; label: string; on: string }[] = [
  { value: "red", label: "Red", on: "bg-red-500 text-white border-red-500" },
  { value: "amber", label: "Amber", on: "bg-amber-400 text-amber-950 border-amber-400" },
  { value: "green", label: "Green", on: "bg-green-500 text-white border-green-500" },
];

export function RagPicker({ topicId, status, topicTitle }: { topicId: string; status: Rag; topicTitle: string }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [, startTransition] = useTransition();

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="radiogroup" aria-label={`Mastery for ${topicTitle}`}>
      {OPTIONS.map((o) => {
        const active = optimistic === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() =>
              startTransition(async () => {
                setOptimistic(o.value);
                await setTopicStatus(topicId, o.value);
              })
            }
            className={`border-l px-2.5 py-1 text-xs font-semibold first:border-l-0 ${active ? o.on : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
