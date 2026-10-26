"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Give me a 60-second recap I can say out loud",
  "Quiz me with 5 quick questions",
  "Write a model evaluation paragraph",
  "What do examiners say students get wrong here?",
];

export function TutorBox({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...turns, { role: "user" as const, content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, messages: history }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.text();
        throw new Error(msg || `Tutor unavailable (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setTurns([...history, { role: "assistant", content: text }]);
      }
    } catch (e) {
      setError((e as Error).message);
      setTurns(history.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-violet-600" aria-hidden />
        <h3 className="font-semibold">Ask a follow-up</h3>
      </div>
      {turns.length === 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-3 max-h-[28rem] space-y-3 overflow-y-auto" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "ml-8 rounded-xl bg-slate-900 p-3 text-sm text-white" : "mr-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed"}>
              {t.content || (busy && i === turns.length - 1 ? <Loader2 className="size-4 animate-spin" aria-label="Thinking" /> : null)}
            </div>
          ))}
        </div>
      )}
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <label htmlFor="tutor-input" className="sr-only">Question about {topicTitle}</label>
        <input id="tutor-input" className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask anything about ${topicTitle}…`} maxLength={1000} />
        <button type="submit" className="btn-primary" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </form>
    </div>
  );
}
