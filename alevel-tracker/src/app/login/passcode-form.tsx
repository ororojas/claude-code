"use client";

import { useActionState, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { Delete, Loader2 } from "lucide-react";
import { signInWithPasscode, type AuthState } from "./actions";

const LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PasscodeForm() {
  const [code, setCode] = useState("");
  const codeRef = useRef("");
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<AuthState, FormData>(
    async (prev, fd) => {
      const result = await signInWithPasscode(prev, fd);
      // On success the action redirects; on failure start again.
      codeRef.current = "";
      setCode("");
      return result;
    },
    { ok: true, message: "" },
  );

  function update(next: string) {
    codeRef.current = next;
    setCode(next);
  }

  function press(key: string) {
    if (pending) return;
    if (key === "del") return update(codeRef.current.slice(0, -1));
    if (codeRef.current.length >= LENGTH) return;
    const next = codeRef.current + key;
    update(next);
    if (next.length === LENGTH) {
      const fd = new FormData();
      fd.set("passcode", next);
      startTransition(() => action(fd));
    }
  }

  // Typing on a keyboard works too.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("del");
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-sm text-slate-600">Enter your passcode</p>
      <div className="mb-3 flex gap-3" role="status" aria-label={`${code.length} of ${LENGTH} digits entered`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span key={i} className={`size-3.5 rounded-full border-2 ${i < code.length ? "border-slate-900 bg-slate-900" : "border-slate-300"}`} />
        ))}
      </div>
      <p className={`mb-4 h-5 text-sm ${state.ok ? "text-slate-500" : "text-red-700"}`} aria-live="polite">
        {pending ? <Loader2 className="inline size-4 animate-spin" aria-label="Checking" /> : state.ok ? "" : state.message}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={pending}
              aria-label={key === "del" ? "Delete last digit" : key}
              className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-2xl font-medium text-slate-900 transition active:scale-95 active:bg-slate-200 disabled:opacity-50"
            >
              {key === "del" ? <Delete className="size-6" aria-hidden /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
