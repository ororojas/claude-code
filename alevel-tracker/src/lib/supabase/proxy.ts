import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ownerAutoLogin, supabaseEnv } from "./env";

const PUBLIC_PATHS = ["/login", "/auth"];

// Mints a session for the owner without a password: the admin API makes a
// one-time magic-link token (no email is sent) and we redeem it here, which
// writes the session cookies onto the response.
async function signInAsOwner(supabase: SupabaseClient, url: string, owner: { email: string; secretKey: string }) {
  const admin = createClient(url, owner.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.email });
  if (error || !data.properties?.hashed_token) {
    console.error("Owner auto sign-in: couldn't create a sign-in token:", error?.message);
    return false;
  }
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verifyError) {
    console.error("Owner auto sign-in: couldn't redeem the token:", verifyError.message);
    return false;
  }
  return true;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Keep any refreshed or newly minted session cookies on redirects too.
  const redirectTo = (pathname: string) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Refreshes the session cookie if needed and verifies the JWT.
  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims);

  const owner = ownerAutoLogin();
  if (!signedIn && owner) {
    signedIn = await signInAsOwner(supabase, url, owner);
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && !isPublic) return redirectTo("/login");
  if (signedIn && path === "/login") return redirectTo("/");
  return response;
}
