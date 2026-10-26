"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerEmail } from "@/lib/supabase/env";
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
  // For an email that's already registered, Supabase returns a user with no
  // identities instead of an error (so emails can't be probed). Say so plainly.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, message: "You already have an account with this email. Use the Sign in tab with your existing password." };
  }
  // With "Confirm email" switched off in Supabase, sign-up returns a session straight away.
  if (data.session) redirect("/");
  return { ok: true, message: "Check your inbox for a confirmation link, then come back and sign in." };
}

export async function signInWithPasscode(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = ownerEmail();
  const passcode = String(form.get("passcode") ?? "");
  if (!email) return { ok: false, message: "Passcode sign-in isn't set up. Add OWNER_EMAIL in Vercel." };
  if (!/^\d{6}$/.test(passcode)) return { ok: false, message: "Enter all 6 digits." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: passcode });
  if (error) return { ok: false, message: error.code === "invalid_credentials" ? "Wrong code. Try again." : error.message };
  redirect("/");
}
