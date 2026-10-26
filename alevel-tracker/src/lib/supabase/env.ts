// All tracker tables live in their own Postgres schema so the app can share a
// Supabase project with other apps. It must be listed under Exposed schemas.
export const DB_SCHEMA = "mocks";

// Supabase now issues "publishable" keys; older projects still show an "anon" key.
// Accept either so the app works with whichever the dashboard gives you.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return { url, key };
}

/**
 * Passcode sign-in: when OWNER_EMAIL is set (server-only), the login page is a
 * keypad and the passcode is that account's Supabase password. The email
 * never has to be typed.
 */
export function ownerEmail(): string | null {
  return process.env.OWNER_EMAIL?.trim() || null;
}
