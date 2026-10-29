"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleBlock } from "@/app/actions";

export function BlockCheck({ itemId, done, title }: { itemId: string; done: boolean; title: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${optimistic ? "Untick" : "Tick"} ${title}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleBlock(itemId, !optimistic);
        })
      }
      className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
        optimistic ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white hover:border-slate-500"
      }`}
    >
      {optimistic ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}
