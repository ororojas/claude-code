"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { saveTopicNotes } from "@/app/actions";

export function TopicNotes({ topicId, initial }: { topicId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== saved;
  return (
    <div>
      <label htmlFor="topic-notes" className="mb-2 block font-semibold">
        My notes
      </label>
      <textarea
        id="topic-notes"
        rows={5}
        maxLength={4000}
        className="field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Mnemonics, examples you'll use, what tripped you up last time…"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              await saveTopicNotes(topicId, value);
              setSaved(value);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save notes
        </button>
        <span className="text-xs text-slate-500" role="status">
          {dirty ? "Unsaved changes" : saved ? "Saved" : ""}
        </span>
      </div>
    </div>
  );
}
