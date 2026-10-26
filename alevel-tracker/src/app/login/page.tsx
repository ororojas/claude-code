import type { Metadata } from "next";
import { ownerEmail } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";
import { PasscodeForm } from "./passcode-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  confirm_failed: "That confirmation link didn't work. It may have expired, or been opened in a different browser. Try signing in, or sign up again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center gap-1" aria-hidden>
            <span className="size-3.5 rounded-full bg-red-500" />
            <span className="size-3.5 rounded-full bg-amber-500" />
            <span className="size-3.5 rounded-full bg-green-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Mock Tracker</h1>
          <p className="mt-1 text-sm text-slate-600">Economics, Business and Sociology mocks · 12–13 November</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {ownerEmail() ? <PasscodeForm /> : <LoginForm notice={error ? NOTICES[error] : undefined} />}
        </div>
      </div>
    </main>
  );
}
