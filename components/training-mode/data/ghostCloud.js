import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken } from './authClient';
import { loadProfile } from './userProfile';
import { loadStats, getLevel } from './userStats';

// The server side of ghost sharing (supabase/migrations/…_create_ghost_sharing):
//
// - Short haunt codes. A signed-in player's ghost becomes a 6-character code
//   (HX7K2Q) that opens that exact session for 7 days. Signed out, Haunt a
//   Friend falls back to the long link that carries the whole ghost.
// - The strangers' pool. After a verified Fight Focus session, a signed-in
//   player's ghost is offered to the pool — anonymised on the server, at most
//   2 a week (the server says no to the rest). Players are in unless they
//   switch "Let others race my ghosts" off in Profile, which also takes theirs
//   back out. Anyone can be challenged by a stranger's ghost.
//
// Every call here is best-effort: offline, signed out or server trouble just
// means the app carries on without the cloud part.

async function rpc(name, args, { needAuth = false } = {}) {
  try {
    const token = await getAccessToken();
    if (needAuth && !token) return null;
    const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args || {}) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export const HAUNT_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const cleanHauntCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Shown as HX7·K2Q so it reads in two halves.
export const prettyHauntCode = (c) => (c && c.length === 6 ? `${c.slice(0, 3)}·${c.slice(3)}` : c);

// A short code for this ghost, or null (signed out, offline, or limit hit).
export async function createHauntCode(ghost) {
  const code = await rpc('create_haunt', { p_ghost: ghost }, { needAuth: true });
  return typeof code === 'string' && HAUNT_CODE_RE.test(code) ? code : null;
}

// The ghost behind a code, or null if it doesn't exist or has expired.
export async function fetchHaunt(code) {
  const g = await rpc('get_haunt', { p_code: cleanHauntCode(code) });
  return g && typeof g === 'object' ? g : null;
}

export const sharesGhosts = (profile = loadProfile()) => profile?.shareGhosts !== false;

// Offer a just-recorded verified Fight Focus ghost to the strangers' pool.
export function shareToPool(ghost, discipline) {
  if (!ghost || !sharesGhosts()) return;
  const level = getLevel(loadStats().xp);
  rpc('add_pool_ghost', { p_ghost: ghost, p_discipline: discipline, p_level: level }, { needAuth: true });
}

// Switching sharing off takes this player's ghosts back out.
export function removeMyPoolGhosts() {
  return rpc('remove_my_pool_ghosts', {}, { needAuth: true });
}

// A stranger's ghost for a discipline, shaped like a local ghost and named
// the way the design names strangers. null if the pool has none.
export async function fetchStrangerGhost(discipline) {
  const row = await rpc('random_pool_ghost', { p_discipline: discipline });
  if (!row || typeof row !== 'object' || !row.ghost) return null;
  return {
    level: row.level,
    ghost: { ...row.ghost, ghostId: `pool-${row.id}`, ownerId: 'stranger', ownerName: 'A WARRIOR' },
  };
}
