import { PRACTICE_DISCIPLINES } from '../practiceData';
import { basicsProgress, anyBasicsDone, getLearned } from './practiceMoves';

// When to show the Practice posters (PracticeInvite.dc.html):
//
// - The intro poster, once, at the end of first-run setup — only for someone
//   who said they are new to training or want to learn the basics.
// - The weekly reminder, at most once a week, until the basics of at least
//   one discipline are done. It goes to the same new learners, plus anyone
//   who has finished a Practice Round: people who have shown they want the
//   lessons. Experienced fighters who never practise are not nagged.
//
// The basics of a discipline are its stance and every Beginner-level strike,
// each learned by finishing one drill (data/practiceMoves basicMoves). The old
// seven-lesson path held lessons that are no longer shown, so it could never
// be finished; someone who did finish it still counts as done.
//
// Finishing a lesson within a week of the reminder pays WEEKLY_BONUS_XP,
// once per reminder — the "+100 XP" the poster promises.

const KEY = 'tm_practice_invite_v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_BONUS_XP = 100;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function save(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* best-effort */ }
}

// Onboarding's "Beginner" (new to training) or the Learn Combat Basics goal.
export function isNewLearner(profile) {
  const exp = String(profile?.experience || '').toLowerCase();
  const goal = String(profile?.goal || '').toLowerCase();
  return exp === 'beginner' || goal === 'learn combat basics';
}

export function shouldShowIntro(profile) {
  return isNewLearner(profile) && !load().introShownAt && !anyBasicsDone();
}

export function markIntroShown() {
  save({ introShownAt: new Date().toISOString() });
}

export function notePracticed() {
  if (!load().practiced) save({ practiced: true });
}

export function shouldShowWeekly(profile, now = Date.now()) {
  const s = load();
  if (!isNewLearner(profile) && !s.practiced) return false;
  if (anyBasicsDone()) return false;
  // The intro poster counts as this week's nudge.
  const last = Math.max(Date.parse(s.introShownAt || 0) || 0, Date.parse(s.weeklyShownAt || 0) || 0);
  return now - last >= WEEK_MS;
}

export function markWeeklyShown() {
  save({ weeklyShownAt: new Date().toISOString(), bonusPaid: false });
}

// Called when a lesson is newly completed. Returns the XP to bank (0 when no
// reminder is live or its bonus was already paid).
export function claimWeeklyBonus(now = Date.now()) {
  const s = load();
  const shown = Date.parse(s.weeklyShownAt || 0) || 0;
  if (!shown || s.bonusPaid || now - shown > WEEK_MS) return 0;
  save({ bonusPaid: true });
  return WEEKLY_BONUS_XP;
}

// What the weekly poster shows: every discipline's basics, and the one to
// continue — the athlete's own discipline, unless another is further along.
// The poster reads each basic move as a lesson: `lessons` and `next` carry
// the move with its name as `title`.
export function weeklySummary(preferred = 'Boxing') {
  const learned = getLearned();
  const asLesson = (m) => (m ? { ...m, title: m.name } : null);
  const discs = PRACTICE_DISCIPLINES.map(d => {
    const p = basicsProgress(d, learned);
    return { disc: d, lessons: p.moves.map(asLesson), done: p.done, total: p.total, nextIndex: p.nextIndex, next: asLesson(p.next) };
  });
  const own = discs.find(d => d.disc === preferred) || discs[0];
  const lead = discs.reduce((best, d) => (d.done > best.done ? d : best), own);
  return { discs, focus: lead };
}
