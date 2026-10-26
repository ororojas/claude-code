"use client";

import { useState } from "react";
import type { DiagramCheck } from "@/content/types";

/** Tick-as-you-draw checklist. Local only: it resets each visit, like a drill. */
export function DiagramChecklist({ diagram }: { diagram: DiagramCheck }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const all = ticked.size === diagram.checklist.length;
  return (
    <div className={`rounded-xl border p-3 ${all ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{diagram.name}</h4>
        <span className="text-xs tabular-nums text-slate-500">
          {ticked.size}/{diagram.checklist.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {diagram.checklist.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={ticked.has(i)}
                onChange={() =>
                  setTicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
