"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/submit-button";
import { signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = { ok: true, message: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState(signIn, initial);
  const [upState, upAction] = useActionState(signUp, initial);
  const state = mode === "in" ? inState : upState;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="rounded-md py-1.5 font-medium text-slate-600 aria-selected:bg-white aria-selected:text-slate-900 aria-selected:shadow-sm"
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {notice ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{notice}</p> : null}
      <form action={mode === "in" ? inAction : upAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={mode === "up" ? 8 : undefined}
            required
            className="field"
          />
        </div>
        <SubmitButton className="btn-primary w-full">{mode === "in" ? "Sign in" : "Create account"}</SubmitButton>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
