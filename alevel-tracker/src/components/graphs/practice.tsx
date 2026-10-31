"use client";

import { createContext, useContext, useState } from "react";
import { Eye, EyeOff, PenLine } from "lucide-react";

type Mode = "show" | "labels" | "blank";

const ModeContext = createContext<Mode>("show");

const MODES: { mode: Mode; label: string; icon: typeof Eye }[] = [
  { mode: "show", label: "Show everything", icon: Eye },
  { mode: "labels", label: "Hide labels", icon: EyeOff },
  { mode: "blank", label: "Hide graphs", icon: PenLine },
];

/** Practice controls for the whole page. Each graph can still be revealed on its own. */
export function GraphsBoard({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("show");
  return (
    <ModeContext.Provider value={mode}>
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <div role="radiogroup" aria-label="Practice mode" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Practice:</span>
          {MODES.map(({ mode: m, label, icon: Icon }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 aria-checked:border-slate-900 aria-checked:bg-slate-900 aria-checked:text-white"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        {mode !== "show" ? (
          <p className="mt-1.5 text-xs text-slate-600">
            {mode === "labels" ? "Say each label out loud, then tap Check to see if you were right." : "Draw it on paper from the steps, then tap Check and compare."}
          </p>
        ) : null}
      </div>
      {children}
    </ModeContext.Provider>
  );
}

/** One drawing, hidden or stripped of labels while practising. */
export function GraphFigure({ title, children }: { title: string; children: React.ReactNode }) {
  const mode = useContext(ModeContext);
  // Remembers which mode it was revealed in, so switching modes hides it again.
  const [revealedIn, setRevealedIn] = useState<Mode | null>(null);
  const revealed = revealedIn === mode;
  const toggle = (
    <button type="button" onClick={() => setRevealedIn(revealed ? null : mode)} className="btn-secondary px-2.5 py-1 text-xs">
      {revealed ? "Hide again" : "Check"}
    </button>
  );

  if (mode === "blank" && !revealed) {
    return (
      <div className="flex aspect-[9/7] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
        <PenLine className="size-6 text-slate-400" aria-hidden />
        <p className="text-sm text-slate-600">Draw “{title}” from memory</p>
        {toggle}
      </div>
    );
  }
  return (
    <div>
      <div className={mode === "labels" && !revealed ? "hide-labels" : undefined}>{children}</div>
      {mode !== "show" ? <div className="mt-2 flex justify-end">{toggle}</div> : null}
    </div>
  );
}
