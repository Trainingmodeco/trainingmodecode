import { GoTrueClient } from '@supabase/auth-js';

// Supabase auth for Training Mode — Google sign-in only, for now. Sign-in is
// OPTIONAL and purely additive: the app runs fully local without it. Once an
// account exists it becomes the anchor for Pro entitlements + Stripe.
//
// We use @supabase/auth-js (GoTrueClient) directly instead of the full
// supabase-js — auth is all we need, it's lighter, and it sidesteps a Metro
// bundling bug in supabase-js's postgrest-js sub-package on web.
//
// The URL and publishable ("anon") key are PUBLIC by design — safe to ship in
// the client bundle. Env vars override them for non-prod builds if ever needed.
// The service_role key must NEVER appear here.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://adtxjmqshckhmyziehpv.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rEpQKuZqx9u5heapE8757Q_wy7_jKGi';

const isBrowser = typeof window !== 'undefined';

// Pass-through lock. auth-js defaults to a navigator.locks-based lock that can
// hang in some webviews (leaving getSession() unresolved forever). A single-tab
// PWA doesn't need cross-tab locking, so we just run the callback directly.
const passthroughLock = async (_name, _acquireTimeout, fn) => fn();

let client = null;
export function getSupabase() {
  if (!isBrowser) return null;
  if (!client) {
    try {
      const auth = new GoTrueClient({
        url: `${SUPABASE_URL}/auth/v1`,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        storageKey: 'sb-adtxjmqshckhmyziehpv-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        lock: passthroughLock,
      });
      // Shape it like supabase.auth so the rest of the app reads naturally.
      client = { auth };
    } catch {
      client = null;
      return null;
    }
  }
  return client;
}

// Kick off Google OAuth. Redirects the page to Google, then back to the app,
// where detectSessionInUrl finishes the sign-in. redirectTo must be allow-listed
// in Supabase → Authentication → URL Configuration (localhost + the live domain).
export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) return { error: new Error('unavailable') };
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: isBrowser ? window.location.origin : undefined },
  });
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

// Current session (or null). Cheap — reads the persisted session.
export async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  } catch { return null; }
}

// Subscribe to sign-in / sign-out. Returns an unsubscribe function.
export function onAuthChange(cb) {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user || null));
  return () => data?.subscription?.unsubscribe?.();
}

// Pull the display bits Google gives us into a flat shape for the UI.
export function userProfile(user) {
  if (!user) return null;
  const m = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || m.email || '',
    name: m.full_name || m.name || (user.email ? user.email.split('@')[0] : 'Athlete'),
    avatarUrl: m.avatar_url || m.picture || '',
  };
}
