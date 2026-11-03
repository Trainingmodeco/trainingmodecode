// Coach's Tapes — the coach's follow-along videos, played on his YouTube
// channel. The app is the shelf: pick a tape, PLAY opens YouTube, come back
// and say how it went for XP. Nothing plays in-app, so YouTube keeps the view.
//
// Owner-only for now (tapesEnabled): the shelf shows up on the phone that
// unlocked the Strike Lab, so the videos can be tested before anyone sees it.
// Flip ENABLED_FOR_EVERYONE when it goes live.
//
// XP is the honor system, capped: once per tape a day, two paid clears a day.
// It rewards the workout, never the view — nothing here keys off YouTube.
//
// Storage (tm_tapes_v1): links (owner-pasted video ids), pending (the tape
// out on YouTube: at, seen, snoozedAt), log (settles, for the daily caps),
// cleared (tape → first clear, never trimmed: it drives the shelf badges).
import { isOwnerPreview } from './concepts';
import { addTapeSession } from './userStats';
import { trackEvent } from './analytics';

const KEY = 'tm_tapes_v1';
const ENABLED_FOR_EVERYONE = false;

export const XP_PER_MIN = 3;
export const PARTIAL_SHARE = 0.5;
export const CLEAR_UNLOCK = 0.6;   // share of the tape's length before CLEARED unlocks
export const PARTIAL_UNLOCK = 0.25;
export const PENDING_TTL_MS = 6 * 3600 * 1000;
export const DAILY_PAID_CLEARS = 2;

// The shelf. `youtubeId` is empty until the video is up; the owner can paste
// a link on the phone (setTapeLink) without a release. `live` names the
// in-app session a tape is the filmed version of.
export const TAPES = [
  { id: 'shadow-01', num: '#01', kind: 'fight', title: 'Kickboxing Basics', meta: 'Shadowboxing · 3 rounds', minutes: 22, gear: 'No gear', art: '/static/revamp/hub-fight-reveal.webp', pos: '50% 25%', youtubeId: '', live: 'Live · Shadowbox Mini' },
  { id: 'bw-01', num: '#02', kind: 'fit', title: 'Deadly Seven', meta: 'Bodyweight · 7 × 7 × 7', minutes: 30, gear: 'No gear', art: '/static/revamp/hub-fit-reveal.webp', pos: '50% 22%', youtubeId: '', live: 'Live · Quick Mission' },
  { id: 'kb-01', num: '#03', kind: 'fit', title: 'One-Bell 300', meta: 'Kettlebell · 300 reps', minutes: 25, gear: '1 kettlebell', art: '/static/fitmode/banner-gym-quick.webp', pos: '40% 60%', youtubeId: '', live: 'Live · Quick Mission' },
  { id: 'bag-01', num: '#04', kind: 'fight', title: 'Heavy Bag: 6 Rounds', meta: 'Bag work · 6 rounds', minutes: 24, gear: 'Bag + gloves', art: '/static/hub/fight.webp', pos: '78% 45%', youtubeId: '' },
  { id: 'cal-01', num: '#05', kind: 'fit', title: 'Calisthenics Power', meta: 'Calisthenics · 4 rounds', minutes: 25, gear: 'Pull-up bar', art: '/static/hub/fit.webp', pos: '70% 50%', youtubeId: '' },
  { id: 'cond-01', num: '#06', kind: 'fight', title: 'Fight Conditioning', meta: 'Conditioning · 5 rounds', minutes: 20, gear: 'No gear', art: '/static/revamp/cardio-blast.webp', pos: '70% 40%', youtubeId: '' },
];

export function tapesEnabled() { return ENABLED_FOR_EVERYONE || isOwnerPreview(); }
export const tapeById = (id) => TAPES.find(t => t.id === id) || null;
export const tapeXp = (tape) => Math.round((tape?.minutes || 0) * XP_PER_MIN);

// ── storage ─────────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    return { links: p?.links || {}, pending: p?.pending || null, log: Array.isArray(p?.log) ? p.log : [], cleared: p?.cleared || {} };
  } catch { return { links: {}, pending: null, log: [], cleared: {} }; }
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  return state;
}
export const loadTapes = load;

// ── links ───────────────────────────────────────────────────────────────────
// youtu.be/ID · youtube.com/watch?v=ID · /shorts/ID · /live/ID · /embed/ID · a bare ID
export function parseYoutubeId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/(?:shorts|live|embed|v)\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
export function tapeVideoId(tape, state = load()) {
  return (tape && (state.links[tape.id] || tape.youtubeId)) || null;
}
// Returns the video id, '' when an empty input cleared the link, or null when
// the input was not a YouTube link — in which case the stored link is kept.
export function setTapeLink(id, input) {
  const raw = String(input || '').trim();
  const s = load();
  if (!raw) { delete s.links[id]; save(s); return ''; }
  const vid = parseYoutubeId(raw);
  if (!vid) return null;
  s.links[id] = vid;
  save(s);
  return vid;
}
export function youtubeUrl(videoId, startSec = 0) {
  return `https://www.youtube.com/watch?v=${videoId}${startSec > 0 ? `&t=${Math.floor(startSec)}s` : ''}`;
}

// The newest tape that has a video, else the first on the shelf.
export function featuredTape(state = load()) {
  const linked = [...TAPES].reverse().find(t => tapeVideoId(t, state));
  return linked || TAPES[0];
}

// ── the session ─────────────────────────────────────────────────────────────
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

// Written inside the PLAY tap, before YouTube opens: the one record that
// survives the app being killed while the video plays.
export function startTape(id, now = Date.now()) {
  const s = load();
  s.pending = { id, at: now };
  save(s);
  trackEvent('tape_play', { tape: id });
  return s.pending;
}
export function clearPending() { const s = load(); s.pending = null; save(s); }
// The comeback bar was shown once: App stops routing to the shelf on every
// return (a cold boot still does).
export function markPendingSeen() { const s = load(); if (s.pending && !s.pending.seen) { s.pending.seen = true; save(s); } }
// NOT YET: hide the bar until the athlete comes back again. The tape stays
// pending, so finishing it later still pays.
export function snoozePending(now = Date.now()) { const s = load(); if (s.pending) { s.pending.seen = true; s.pending.snoozedAt = now; save(s); } }

export function pendingTape(now = Date.now()) {
  const s = load();
  const p = s.pending;
  if (!p || !tapeById(p.id)) return null;
  if (now - p.at > PENDING_TTL_MS) { s.pending = null; save(s); return null; }
  return p;
}

// What the comeback bar may offer, from how long the athlete was away.
export function returnState(pending, now = Date.now()) {
  const tape = tapeById(pending?.id);
  if (!tape) return null;
  const elapsedMs = Math.max(0, now - pending.at);
  const lenMs = tape.minutes * 60 * 1000;
  const clearAt = pending.at + Math.round(lenMs * CLEAR_UNLOCK);
  const partialAt = pending.at + Math.round(lenMs * PARTIAL_UNLOCK);
  return {
    tape, elapsedMs,
    awayMin: Math.round(elapsedMs / 60000),
    canClear: now >= clearAt, canPartial: now >= partialAt,
    clearInMin: Math.max(0, Math.ceil((clearAt - now) / 60000)),
    partialInMin: Math.max(0, Math.ceil((partialAt - now) / 60000)),
  };
}

// Why the next settle would pay nothing: 'repeat' (this tape already paid
// today), 'daily_cap' (two tapes already paid today), or null.
export function capReason(id, now = Date.now(), state = load()) {
  const today = dayKey(now);
  const todays = state.log.filter(e => e.xp > 0 && dayKey(e.at) === today);
  if (todays.some(e => e.id === id)) return 'repeat';
  if (todays.length >= DAILY_PAID_CLEARS) return 'daily_cap';
  return null;
}
// XP the next settle would pay, after the daily rules.
export function quoteTape(id, verdict, now = Date.now(), state = load()) {
  const tape = tapeById(id);
  if (!tape || verdict === 'skip' || capReason(id, now, state)) return 0;
  const full = tapeXp(tape);
  return verdict === 'cleared' ? full : Math.round(full * PARTIAL_SHARE);
}

// verdict: 'cleared' | 'partial' | 'skip'. Pays the XP (bonus lane, logged
// as a Coach's Tapes session so it counts for level, streak and the split),
// clears the pending record, returns what happened. 'skip' ("didn't do it")
// only drops the pending record.
export function settleTape(id, verdict, now = Date.now()) {
  const s = load();
  const tape = tapeById(id);
  s.pending = null;
  if (!tape || verdict === 'skip') { save(s); return tape ? { tape, verdict: 'skip', xp: 0, reason: null } : null; }
  const reason = capReason(id, now, s);
  const xp = quoteTape(id, verdict, now, s);
  s.log.push({ id, at: now, verdict, xp });
  if (s.log.length > 400) s.log = s.log.slice(-400);
  if (verdict === 'cleared' && !s.cleared[id]) s.cleared[id] = now;
  save(s);
  addTapeSession(tape, verdict, xp, now);
  trackEvent('tape_clear', { tape: id, verdict, xp });
  return { tape, verdict, xp, reason: xp === 0 ? reason : null };
}

// Cleared tapes per shelf, for the set bars and badges.
export function tapeCounts(state = load()) {
  const cleared = new Set(Object.keys(state.cleared));
  const by = (kind) => { const all = TAPES.filter(t => t.kind === kind); return { done: all.filter(t => cleared.has(t.id)).length, total: all.length }; };
  return { fit: by('fit'), fight: by('fight'), cleared };
}
export const clearedToday = (id, now = Date.now(), state = load()) =>
  state.log.some(e => e.id === id && e.xp > 0 && dayKey(e.at) === dayKey(now));
