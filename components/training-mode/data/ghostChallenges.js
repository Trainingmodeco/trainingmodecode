// Ghost challenges (Simplify revamp, GhostChallenge.dc.html) — every so often
// one of your own past sessions comes back as a ghost and dares you to beat
// it. Built on the ghosts the app already records: a verified Fight Focus run
// (data/ghostBattles) or a measured run (data/runGhosts). Quick Mission and
// Build Workout record nothing a ghost could race, so Fit-side challenges are
// runs for now.
//
// One challenge is live at a time, and declining never removes it: it stays
// until beaten. The pressure is the bonus tapering — full for four days, half
// for three more, then pride only — never a block. At most one nudge a day.
//
// A friend's ghost arrives by link (?h=<code>) and becomes the live challenge,
// named, because they sent it. Ghosts of strangers need a server; there is
// none, so the design's anonymous "A Warrior, LV 22" is not built.

import { getMyBestGhost, exportGhostCode, importGhostCode } from './ghostBattles';
import { bestRunGhosts } from './runGhosts';
import { addComboBonus } from './userStats';
import { trackEvent } from './analytics';

const KEY = 'tm_ghost_challenge_v1';
const DAY = 24 * 60 * 60 * 1000;
// Fight 3–4 a month and runs about twice (the design's Fit 1–3), spread out.
const EVERY = { fight: 8 * DAY, cardio: 14 * DAY };
// A ghost has to be at least this old to come back — last night's session
// "returning" this morning is not a challenge, it's a repeat.
const MIN_AGE = 2 * DAY;
export const GHOST_HUNTER_TIERS = [1, 5, 10, 25];
const DISCIPLINES = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') return { active: null, lastOffered: {}, beaten: 0, toast: null, ...s };
  } catch { /* fresh */ }
  return { active: null, lastOffered: {}, beaten: 0, toast: null };
}
// Screens already on show (Home, under the reveal) re-read on this event.
export const GHOST_CHANGE_EVENT = 'tm-ghost-change';
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
  try { window.dispatchEvent(new Event(GHOST_CHANGE_EVENT)); } catch { /* no window */ }
}

export const dayOf = (ch, now = Date.now()) => Math.max(0, Math.floor((now - ch.offeredAt) / DAY));

// 50 for days 0–3, 25 for days 4–6, then pride only.
export function bonusFor(ch, now = Date.now()) {
  const d = dayOf(ch, now);
  return d <= 3 ? 50 : d <= 6 ? 25 : 0;
}

// The reveal's kicker line.
export function bonusLine(ch, now = Date.now()) {
  const d = dayOf(ch, now);
  if (d <= 3) return 4 - d === 1 ? 'FULL BONUS · LAST DAY' : `FULL BONUS ${4 - d} MORE DAYS`;
  if (d <= 6) return 7 - d === 1 ? 'HALF BONUS · LAST DAY' : `HALF BONUS ${7 - d} MORE DAYS`;
  return 'FOR PRIDE ONLY';
}

export function ghostHunter() {
  const beaten = load().beaten || 0;
  const next = GHOST_HUNTER_TIERS.find(t => t > beaten) || beaten;
  return { beaten, next };
}

export function getActiveChallenge() {
  return load().active;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Called on app open. Returns a NEW challenge to reveal, or null. A live
// challenge is never replaced by a scheduled one.
export function maybeOfferChallenge(discipline = 'Boxing', now = Date.now()) {
  const s = load();
  if (s.active) return null;
  const waited = (k) => now - (s.lastOffered[k] || 0);
  const options = [];

  // The current discipline's ghost first; any other discipline's otherwise,
  // so switching tabs never hides the ghosts you already made.
  const discs = [discipline, ...DISCIPLINES.filter(d => d !== discipline)];
  const fight = discs.map(d => ({ d, g: getMyBestGhost('fight_focus', d) }))
    .find(x => x.g && now - (x.g.createdAt || now) >= MIN_AGE);
  if (fight && waited('fight') >= EVERY.fight) {
    options.push({ kind: 'fight', ghost: fight.g, disc: fight.d, wait: waited('fight') });
  }
  const run = bestRunGhosts().filter(g => now - (g.createdAt || now) >= MIN_AGE).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (run && waited('cardio') >= EVERY.cardio) {
    options.push({ kind: 'cardio', run: { unit: run.unit, goal: run.goal, surface: run.surface, totalSec: run.totalSec, createdAt: run.createdAt, ghostId: run.ghostId }, wait: waited('cardio') });
  }
  if (!options.length) return null;
  // Whichever kind has waited longer goes first.
  const pick = options.sort((a, b) => b.wait - a.wait)[0];
  const { wait: _wait, ...rest } = pick;
  const ch = { id: newId(), from: 'self', offeredAt: now, ...rest };
  s.active = ch;
  s.lastOffered = { ...s.lastOffered, [ch.kind]: now };
  save(s);
  trackEvent('ghost_challenge_offered', { kind: ch.kind });
  return ch;
}

// A haunt opened before the app was ready (first run, splash) is revealed on
// the next open, once.
export function unseenHaunt() {
  const ch = load().active;
  return ch && ch.from === 'friend' && ch.seen === false ? ch : null;
}
export function markChallengeSeen() {
  const s = load();
  if (s.active) { s.active = { ...s.active, seen: true }; save(s); }
}

// NOT NOW. The ghost stays; Home says so once.
export function declineChallenge() {
  const s = load();
  if (!s.active) return;
  s.active = { ...s.active, declinedAt: Date.now() };
  s.toast = 'declined';
  save(s);
  trackEvent('ghost_challenge_declined', { kind: s.active.kind });
}

// Home's toast slot. The decline line once, then at most one nudge a day:
// the last full-bonus day and the last half-bonus day.
export function consumeGhostNudge(now = Date.now()) {
  const s = load();
  if (s.toast === 'declined') {
    s.toast = null;
    save(s);
    return { text: 'IT’LL WAIT. IT ALWAYS DOES.', auto: true };
  }
  const ch = s.active;
  if (!ch || !ch.declinedAt) return null;
  const d = dayOf(ch, now);
  const text = d === 3 ? 'STILL HAUNTED · BONUS XP DROPS TOMORROW' : d === 6 ? 'STILL HAUNTED · LAST DAY FOR BONUS XP' : null;
  if (!text || ch.nudgedDay === d) return null;
  s.active = { ...ch, nudgedDay: d };
  save(s);
  return { text, auto: false };
}

// A finished race. Only a win against THE challenge ghost settles it; a loss
// leaves it waiting. Returns { bonus, hunter } on a settle, else null.
export function settleChallenge(kind, match, outcome) {
  const s = load();
  const ch = s.active;
  if (!ch || ch.kind !== kind || outcome !== 'victory') return null;
  const same = kind === 'fight'
    ? match?.ghostId && match.ghostId === ch.ghost?.ghostId
    : match && match.unit === ch.run.unit && Number(match.goal) === Number(ch.run.goal) && (match.surface || 'gps') === (ch.run.surface || 'gps');
  if (!same) return null;
  const bonus = bonusFor(ch);
  if (bonus) addComboBonus(bonus);
  s.active = null;
  s.beaten = (s.beaten || 0) + 1;
  save(s);
  trackEvent('ghost_challenge_beaten', { kind, bonus, from: ch.from });
  return { bonus, hunter: ghostHunter() };
}

// ── Haunts: a friend's ghost by link ────────────────────────────────────────
export function hauntURL(ghost) {
  const code = exportGhostCode(ghost);
  if (!code || typeof window === 'undefined') return null;
  return `${window.location.origin}/?h=${encodeURIComponent(code)}`;
}

// Reads ?h=, imports the ghost, clears the URL. Returns the ghost or null.
// The URL can come back (the dev router restores it), so a haunt already
// taken is never taken again — a reload must not reset its clock, or bring a
// beaten ghost back.
export function hauntFromLocation() {
  try {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('h');
    if (!code) return null;
    params.delete('h');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + (window.location.hash || ''));
    const ghost = importGhostCode(code);
    return ghost && !(load().hauntsTaken || []).includes(ghost.ghostId) ? ghost : null;
  } catch { return null; }
}

// An opened haunt becomes the live challenge, named after its sender.
export function takeHaunt(ghost, now = Date.now()) {
  const s = load();
  s.hauntsTaken = [...(s.hauntsTaken || []), ghost.ghostId].slice(-50);
  const disc = ghost?.source?.disciplineOrCampaign || 'Boxing';
  s.active = { id: newId(), kind: 'fight', from: 'friend', ghost, disc, offeredAt: now, seen: false };
  save(s);
  trackEvent('ghost_haunt_opened', {});
  return s.active;
}
