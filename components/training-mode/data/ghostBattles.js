// Ghost Battles (specs 18 + 24) — app side, Fight-Mode-first v1.
// A "ghost" is the recorded pace of a VERIFIED past session; you race its
// replay (no live multiplayer). This module stores ghosts, records them from
// completed sessions, resolves battles via the pure engine, and moves ghosts
// between friends as paste-able challenge codes (local-only v1 — no server).
import { makeGhost, ghostCountAtTime, resolveGhostBattle, battleHeadline } from '../protocol/ghost-engine';
import { loadProfile } from './userProfile';
import { addComboBonus } from './userStats';
import { trackEvent } from './analytics';

const KEY = 'tm_ghosts_v1';
const LAST_KEY = 'tm_ghost_last_battle';
const VS_VARIANT_KEY = 'tm_ghost_vs_variant';
const VICTORY_XP = 75; // bonus on a win; a loss still keeps normal session XP

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const p = raw ? JSON.parse(raw) : null;
    if (p && p.best) return p;
  } catch { /* fresh */ }
  return { best: {}, recent: [] };
}
function save(s) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

const keyFor = (mode, disc) => `${mode}|${disc || 'any'}`;

// My best ghost for a mode/discipline (the always-available opponent).
export function getMyBestGhost(mode, discipline) {
  return load().best[keyFor(mode, discipline)] || null;
}

// Downloaded friend ghosts for a mode (newest first).
export function getRecentGhosts(mode) {
  return load().recent.filter((g) => g.source?.mode === mode);
}

// Record a ghost from a just-completed VERIFIED session; keeps MY BEST per
// mode/discipline (more total strikes wins the slot). Returns the ghost.
export function recordGhostFromSession({ mode, discipline, difficulty = 'normal', roundsConfig, strikeTimesSec, totalSec, perRoundStrikes, completionSec, verified, streak }) {
  if (!verified) return null;
  const profile = loadProfile() || {};
  const ghost = makeGhost({
    ghostId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ownerId: 'me',
    ownerName: (profile.name || 'FIGHTER').toUpperCase(),
    avatarTier: 'rookie',
    gender: (profile.sex === 'female' ? 'female' : 'male'),
    source: { mode, disciplineOrCampaign: discipline || 'Boxing', difficulty, roundsConfig },
    winMetric: 'strikes',
    bucketSec: 10,
    strikeTimesSec: strikeTimesSec || [],
    totalSec: totalSec || 60,
    perRoundStrikes: perRoundStrikes || [],
    completionSec,
    streak,
    verified: true,
    createdAt: Date.now(),
  });
  if (!ghost || ghost.totalStrikes <= 0) return null;
  const box = load();
  const k = keyFor(mode, discipline);
  const prev = box.best[k];
  if (!prev || ghost.totalStrikes > prev.totalStrikes) {
    box.best[k] = ghost;
    save(box);
    trackEvent('ghost_recorded', { mode, strikes: ghost.totalStrikes, newBest: true });
  }
  return ghost;
}

// ── Challenge codes (local v1: the code IS the ghost, compact + copyable) ──
export function exportGhostCode(ghost) {
  try { return 'TMG1.' + btoa(unescape(encodeURIComponent(JSON.stringify(ghost)))); } catch { return null; }
}
export function importGhostCode(code) {
  try {
    const raw = String(code || '').trim();
    if (!raw.startsWith('TMG1.')) return null;
    const g = JSON.parse(decodeURIComponent(escape(atob(raw.slice(5)))));
    if (!g || !Array.isArray(g.buckets) || !g.source || !g.verified) return null;
    const box = load();
    box.recent = [g, ...box.recent.filter((x) => x.ghostId !== g.ghostId)].slice(0, 5);
    save(box);
    trackEvent('ghost_imported', { mode: g.source.mode });
    return g;
  } catch { return null; }
}

// ── Battle resolution (call at session end) ────────────────────────────────
export function finishGhostBattle(ghost, you) {
  const result = resolveGhostBattle(you, ghost);
  const headline = battleHeadline(result);
  if (result.outcome === 'victory') addComboBonus(VICTORY_XP);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_KEY, JSON.stringify({ result, headline, ghost, you, at: Date.now() })); } catch { /* noop */ }
  trackEvent('ghost_battle_finished', { outcome: result.outcome, margin: result.margin });
  return { result, headline };
}

export function getLastBattle() {
  try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_KEY) : null; return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// Item 11a — which of the three VS art poses to show next. Rotates 1→2→3→1 and
// persists, so the same pose never lands two battles running.
export function nextVsVariant() {
  let prev = 0;
  try { if (typeof localStorage !== 'undefined') prev = Number(localStorage.getItem(VS_VARIANT_KEY)) || 0; } catch { /* noop */ }
  const next = (prev % 3) + 1;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(VS_VARIANT_KEY, String(next)); } catch { /* quota */ }
  return next;
}

// Re-export the live replay counter for the timer HUD.
export { ghostCountAtTime };
