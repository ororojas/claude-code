"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  ok: boolean;
  message: string;
}

async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

function credentials(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!email || !password) return { ok: false, message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };
  redirect("/");
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!email || password.length < 8) return { ok: false, message: "Use your email and a password of at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) return { ok: false, message: error.message };
  // With "Confirm email" switched off in Supabase, sign-up returns a session straight away.
  if (data.session) redirect("/");
  return { ok: true, message: "Check your inbox for a confirmation link, then come back and sign in." };
}
