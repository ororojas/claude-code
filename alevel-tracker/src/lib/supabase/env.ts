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
 * Single-owner mode: no login screen. When OWNER_EMAIL and a Supabase secret
 * key are set (server-only env vars, never NEXT_PUBLIC_), every visitor is
 * signed in as that account. Anyone with the site's address gets in.
 */
export function ownerAutoLogin() {
  const email = process.env.OWNER_EMAIL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return email && secretKey ? { email, secretKey } : null;
}
