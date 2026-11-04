// The Level page's words and maths, in one pure module.
//
// levelStory(stats, opts) returns everything the page prints: the headline,
// the tier, the XP numbers, what this exact level means, what the athlete
// has really done, a promotion line, what is next and the tier ladder. The
// page (LevelView.jsx) only lays it out.
//
// Pure and deterministic: no localStorage, no clock. The two things that need
// them come in through `opts`:
//   opts.streak  the current streak in days (userStats getStreak reads the clock)
//   opts.tier    the athlete's tier (tiers getCurrentTier; its Final Form check
//                reads saga progress from storage). Without it the tier comes
//                from XP alone, and past the secret line from the Fit / Fight
//                lean, never Final Form.
//
// Tolerant of whatever is in storage: null stats, NaN or negative XP, a
// missing sessions list, rows that are not objects, unknown session types and
// absurdly large XP all give a sensible page. Nothing is invented: with no
// sessions the recap says so and no session numbers are shown.
//
// What counts as a session: every row except the award rows (Mission of the
// Day, Hybrid bonus, Start Here lessons), the same rule Profile's SESSIONS
// counter uses (tiers.trainingSessionCount). Award XP still counts in XP.
//
// Copy rules: second person, short plain sentences, one idea each, no
// franchise or character names, no medical claims, at most one exclamation
// mark on the whole page (the promotion line).
import { getLevel, getLevelProgress } from './userStats';
import { VISIBLE_TIERS, SECRET_TIERS, SECRET_UNLOCK, tierIndexForLevel, getModeXp, sessionMode, trainingSessionCount } from './tiers';

// Levels per visible tier and XP per level come from the same code the rest
// of the app uses, so a change there cannot leave this page behind.
const LEVELS_PER_TIER = (() => { let n = 1; while (tierIndexForLevel(n + 1) === 0 && n < 100) n += 1; return n; })();
const XP_PER_LEVEL = getLevelProgress(0).needed;
// What a typical session earns, used for the pace until the athlete has three
// sessions of their own to average.
const DEFAULT_SESSION_XP = 90;
const MIN_SESSIONS_FOR_PACE = 3;
// Beyond this the numbers are not real any more; keeps every string short.
const MAX_XP = 1e12;

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

const SECRET_LIST = Object.values(SECRET_TIERS);
const SECRET_START_LEVEL = getLevel(SECRET_UNLOCK.xpPastChampion);
// Final Form is the last secret tier and needs more XP than the other two.
const FINAL_FORM_START_LEVEL = getLevel(SECRET_UNLOCK.finalForm.totalXp);
const secretStartLevel = (tier) => (tier.id === 'final-form' ? FINAL_FORM_START_LEVEL : SECRET_START_LEVEL);
const LAST_VISIBLE = VISIBLE_TIERS.length - 1;

// ── what a level means ──────────────────────────────────────────────────────
// Second sentence for levels 1 to 15 (index = level - 1). The first sentence
// (where the level sits and its XP range) is built from the numbers. One
// sentence each, and none repeats a phrase the promotion lines use: the page
// shows both, so test:levels checks they do not echo each other.
const MEANING = [
  'Everyone on the ladder starts here, and the first sessions are for learning the moves.',
  'The moves feel less new, and you keep coming back.',
  'Training has moved from something new to something you do.',
  'You cleared Rookie, and training is now part of your week.',
  'Sessions run smoother now that you are past the basics.',
  'You know the work now, and the next tier is close.',
  'Novice is behind you, and Warrior is where you train now.',
  'The routine is carrying you now, and the sessions keep adding up.',
  'You are one level from Max, and you earned every step.',
  'You made it out of Warrior, and Max is your tier now.',
  'Max is where you live now, and there is still room to climb.',
  'Champion is one level away, and you have earned the climb.',
  'You reached Champion, the last step of the main ladder.',
  'You are settled in Champion, and you keep adding to it.',
  'Fifteen levels is a long road, and you keep walking it.',
];
const MEANING_CHAMPION = 'You keep stacking Champion levels, one session at a time.';
// Secret tiers are unlocked by XP. The lean is only claimed when the athlete's
// own sessions show it; an exact tie (or no rows) gets the neutral line.
const MEANING_SECRET = {
  'peak-physique': 'Your XP leans toward Fit Mode training, and that unlocked this tier.',
  'fight-ascendant': 'Your XP leans toward Fight Mode training, and that unlocked this tier.',
  'final-form': 'You trained hard in Fit, Fight and Conditioning, and you cleared a full saga.',
};
const MEANING_SECRET_NEUTRAL = 'You passed Champion, and that unlocked this tier.';

// One tier-voice line per level (first, middle and last step of the tier), so
// a friend at level 3 and one at level 1 hear different things. Never claims
// more than the tier says is true. The one exclamation mark on the page lives
// here (Max, first step).
const PROMO = {
  rookie: [
    'You are on the ladder now. Each session takes you one step higher.',
    'You are past level one and still training. That is how a base gets built.',
    'You started from zero and you are still here. Be proud of that.',
  ],
  novice: [
    'Welcome to Novice. You earned this step, so enjoy it.',
    'Novice is where the routine takes root, and you are in the middle of it.',
    'A whole tier of sessions is behind you. Make this last level count.',
  ],
  warrior: [
    'You are a Warrior now. That is a real step up, and you earned it.',
    'You train like it matters. That is what a Warrior does.',
    'You have trained like a Warrior all tier long. Go and finish it.',
  ],
  elite: [
    'You reached Max. That takes real, steady work, and you did it!',
    'Max is where steady work pays off, and you are the proof.',
    'Max asked a lot of you, and you gave it. Finish this tier your way.',
  ],
  champion: [
    'Welcome to Champion. You climbed the whole main ladder to get here.',
    'Champion is as high as the main ladder goes, and you are standing on it.',
  ],
};
const PROMO_SECRET = {
  'peak-physique': 'Peak Physique is a secret tier, and your Fit Mode work unlocked it.',
  'fight-ascendant': 'Fight Ascendant is a secret tier, and your Fight Mode work unlocked it.',
  'final-form': 'You unlocked the last tier there is. Be proud of that.',
};
const PROMO_SECRET_NEUTRAL = {
  'peak-physique': 'Peak Physique is a secret tier. You passed Champion and unlocked it.',
  'fight-ascendant': 'Fight Ascendant is a secret tier. You passed Champion and unlocked it.',
};
// Level 1, no XP and no sessions: an invitation. One or two sessions: a nudge.
// Neither claims work the athlete has not done.
const PROMO_FIRST = 'Every athlete on the ladder started here. Your first session is your first step up.';
const PROMO_STARTED = 'You have started. Come back and do it again.';

const MODES = [
  { key: 'fit', label: 'Fit Mode', short: 'Fit', color: '#4ade80' },
  { key: 'fight', label: 'Fight Mode', short: 'Fight', color: '#f43f5e' },
  { key: 'cc', label: 'Combat Conditioning', short: 'Conditioning', color: '#60a5fa' },
  { key: 'camp', label: 'Training Camp', short: 'Camp', color: '#f59e0b' },
  { key: 'other', label: 'other training', short: 'Other', color: '#9a90b8' },
];

// ── helpers ─────────────────────────────────────────────────────────────────
function cleanStats(stats) {
  const raw = stats && typeof stats === 'object' ? stats : {};
  let xp = Number(raw.xp);
  if (!Number.isFinite(xp) || xp < 0) xp = 0;
  xp = Math.min(Math.floor(xp), MAX_XP);
  const rows = Array.isArray(raw.sessions) ? raw.sessions.filter((s) => s && typeof s === 'object') : [];
  return { xp, rows };
}

function resolveTier(xp, rows, hint) {
  if (xp >= SECRET_UNLOCK.xpPastChampion) {
    const hinted = hint && SECRET_LIST.find((t) => t.id === hint.id);
    if (hinted) return hinted;
    const { fitXp, fightXp } = getModeXp({ sessions: rows });
    return fitXp >= fightXp ? SECRET_TIERS.peakPhysique : SECRET_TIERS.fightAscendant;
  }
  return VISIBLE_TIERS[tierIndexForLevel(getLevel(xp))];
}

const firstLevelOf = (i) => i * LEVELS_PER_TIER + 1;
const xpRangeOf = (level) => ({ from: (level - 1) * XP_PER_LEVEL, to: level * XP_PER_LEVEL - 1 });

// Which way the athlete's XP leans, by the same rule that picks the secret tier.
function xpLean(rows) {
  const { fitXp, fightXp } = getModeXp({ sessions: rows });
  return fitXp > fightXp ? 'fit' : fightXp > fitXp ? 'fight' : null;
}
const leanMatches = (tier, lean) => (tier.id === 'peak-physique' && lean === 'fit') || (tier.id === 'fight-ascendant' && lean === 'fight');

function levelText(level, tier, idx, lean) {
  const { from, to } = xpRangeOf(level);
  const range = `XP ${fmt(from)} to ${fmt(to)}.`;
  if (tier.secret) {
    const claim = tier.id === 'final-form' || leanMatches(tier, lean);
    return [`Level ${fmt(level)} is a ${tier.name} level: ${range}`, claim ? MEANING_SECRET[tier.id] : MEANING_SECRET_NEUTRAL];
  }
  if (idx === LAST_VISIBLE) {
    const lead = level === firstLevelOf(LAST_VISIBLE) ? 'the first step of Champion' : 'a Champion level';
    return [`Level ${fmt(level)} is ${lead}: ${range}`, level <= MEANING.length ? MEANING[level - 1] : MEANING_CHAMPION];
  }
  const step = ['first', 'middle', 'last'][(level - 1) % LEVELS_PER_TIER];
  return [`Level ${fmt(level)} is the ${step} step of ${tier.name}: ${range}`, MEANING[level - 1]];
}

// The tier-voice line for this level (see PROMO).
function promoFor({ level, tier, idx, total, xp, lean }) {
  if (tier.secret) {
    if (tier.id === 'final-form' || leanMatches(tier, lean)) return PROMO_SECRET[tier.id];
    return PROMO_SECRET_NEUTRAL[tier.id];
  }
  if (level === 1 && total === 0 && xp === 0) return PROMO_FIRST;
  if (level === 1 && total > 0 && total < MIN_SESSIONS_FOR_PACE) return PROMO_STARTED;
  if (idx === LAST_VISIBLE) return PROMO.champion[level === firstLevelOf(LAST_VISIBLE) ? 0 : 1];
  return PROMO[tier.id][(level - 1) % LEVELS_PER_TIER];
}

function splitSessions(rows) {
  const counts = { fit: 0, fight: 0, cc: 0, camp: 0, other: 0 };
  for (const s of rows) {
    const mode = sessionMode(s);
    if (mode !== 'bonus') counts[mode] += 1;
  }
  return counts;
}

function buildRecap(total, counts, xp) {
  if (total === 0) return xp > 0 ? 'No sessions are recorded on this device.' : 'You have not trained yet. Your first session is the first step.';
  const lead = `You have finished ${plural(total, 'session', 'sessions')}`;
  const parts = MODES.filter((m) => counts[m.key] > 0);
  const named = parts.filter((m) => m.key !== 'other');
  if (named.length === 0) return `${lead}.`;
  if (parts.length === 1) return `${lead}, all in ${parts[0].label}.`;
  const bits = parts.map((m) => `${fmt(counts[m.key])} in ${m.label}`);
  const list = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
  return `${lead}: ${list}.`;
}

// The mode with the most sessions. 'other' is not a mode, and an exact tie has no winner.
function mostUsed(counts) {
  const ranked = MODES.filter((m) => m.key !== 'other' && counts[m.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && counts[ranked[0].key] === counts[ranked[1].key]) return { tie: true, label: 'Even split' };
  return { tie: false, key: ranked[0].key, label: ranked[0].label };
}

const spokenLevels = (first, last) => (last == null ? `level ${fmt(first)} and up` : `levels ${fmt(first)} to ${fmt(last)}`);

function buildLadder(level, tier, idx) {
  const inSecret = !!tier.secret;
  const current = inSecret ? VISIBLE_TIERS.length : idx;
  const nodes = VISIBLE_TIERS.map((t, i) => {
    const first = firstLevelOf(i);
    const open = i === LAST_VISIBLE;
    const last = open ? null : first + LEVELS_PER_TIER - 1;
    // With the secret band started, Champion has a visible end.
    const closedAt = open && inSecret ? SECRET_START_LEVEL - 1 : last;
    const state = i < current ? 'passed' : i === current ? 'current' : 'ahead';
    const pips = [];
    for (let k = 0; k < LEVELS_PER_TIER; k += 1) {
      const lv = first + k;
      pips.push({ level: lv, state: level > lv ? 'done' : level === lv ? 'here' : 'todo' });
    }
    const spoken = `${t.name}, ${spokenLevels(first, closedAt)}`;
    return {
      id: t.id, name: t.name, label: t.label, color: t.color, secret: false,
      firstLevel: first, lastLevel: closedAt,
      levels: closedAt == null ? `${first}+` : `${first}-${closedAt}`,
      state, ticked: state === 'passed', current: state === 'current', pips,
      marker: state === 'current' ? { level, label: `LVL ${fmt(level)}` } : null,
      // What a screen reader says for this step (the page hides the drawing).
      say: `${spoken}, ${state === 'passed' ? 'passed' : state === 'current' ? `you are here at level ${fmt(level)}` : 'still ahead'}.`,
    };
  });
  if (inSecret) {
    const from = secretStartLevel(tier);
    nodes.push({
      id: tier.id, name: tier.name, label: tier.label, color: tier.color, secret: true,
      firstLevel: from, lastLevel: null, levels: `${from}+`,
      state: 'current', ticked: false, current: true, pips: [],
      marker: { level, label: `LVL ${fmt(level)}` },
      say: `${tier.name}, secret tier, ${spokenLevels(from, null)}, you are here at level ${fmt(level)}.`,
    });
  }
  return nodes;
}

function buildNext({ level, xp, toNext, tier, idx, pace }) {
  const nextLevel = level + 1;
  const sessionsToNext = Math.max(1, Math.ceil(toNext / pace.xp));
  const xpLine = `${fmt(toNext)} XP to Level ${fmt(nextLevel)}.`;
  const paceLine = pace.own
    ? `At your usual ${fmt(pace.xp)} XP a session, that is about ${plural(sessionsToNext, 'session', 'sessions')}.`
    : `A typical session earns about ${fmt(pace.xp)} XP, so that is about ${plural(sessionsToNext, 'session', 'sessions')}.`;
  const out = { nextLevel, xpToNext: toNext, sessionsToNext, paceXp: pace.xp, paceIsOwn: pace.own, xpLine, paceLine, nextTier: null, atTop: false, tierLine: '' };
  if (tier.secret) {
    out.atTop = true;
    out.tierLine = tier.id === 'final-form'
      ? 'You have unlocked every tier. What is left is more levels.'
      : 'You are in a secret tier. What is left is more levels.';
  } else if (idx === LAST_VISIBLE) {
    out.atTop = true;
    out.tierLine = 'What is left is more levels, and each one adds to your record.';
  } else {
    const nt = VISIBLE_TIERS[idx + 1];
    const start = firstLevelOf(idx + 1);
    const away = start - level;
    out.nextTier = { id: nt.id, name: nt.name, label: nt.label, color: nt.color, startLevel: start, levelsAway: away, xpAway: Math.max(0, (start - 1) * XP_PER_LEVEL - xp) };
    out.tierLine = away === 1
      ? `Level ${start} is your first step into ${nt.name}.`
      : `${nt.name} starts at Level ${start}, ${plural(away, 'level', 'levels')} away.`;
  }
  return out;
}

// "Rookie, Novice, Warrior and Max take 3 levels each. Champion has no end."
function ladderNote() {
  const names = VISIBLE_TIERS.slice(0, LAST_VISIBLE).map((t) => t.name);
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Each level is ${fmt(XP_PER_LEVEL)} XP. ${list} take ${LEVELS_PER_TIER} levels each. ${VISIBLE_TIERS[LAST_VISIBLE].name} has no end.`;
}

// ── the story ───────────────────────────────────────────────────────────────
export function levelStory(stats, opts = {}) {
  const { xp, rows } = cleanStats(stats);
  const level = getLevel(xp);
  const into = getLevelProgress(xp).current;
  const toNext = XP_PER_LEVEL - into;
  const tier = resolveTier(xp, rows, opts?.tier);
  const idx = tier.secret ? LAST_VISIBLE + 1 : tierIndexForLevel(level);
  const total = trainingSessionCount({ sessions: rows });
  const counts = splitSessions(rows);
  const lean = tier.secret ? xpLean(rows) : null;
  const streak = Number.isFinite(opts?.streak) && opts.streak >= 0 ? Math.floor(opts.streak) : null;

  const [rangeLine, meaningLine] = levelText(level, tier, idx, lean);
  const top = mostUsed(counts);

  // Pace: the athlete's own average once there are three sessions to average.
  const own = total >= MIN_SESSIONS_FOR_PACE && xp > 0;
  const pace = { own, xp: own ? Math.max(1, Math.round(xp / total)) : DEFAULT_SESSION_XP };

  // XP is shown whenever there is some; the session numbers only when there
  // are sessions. MOST SESSIONS counts sessions (the tier's lean is by XP).
  const facts = [];
  if (total > 0) facts.push({ key: 'sessions', label: 'SESSIONS', value: fmt(total) });
  if (total > 0 || xp > 0) facts.push({ key: 'xp', label: 'TOTAL XP', value: fmt(xp) });
  if (total > 0) {
    if (streak != null) facts.push({ key: 'streak', label: 'DAY STREAK', value: fmt(streak) });
    if (top) facts.push({ key: 'top', label: 'MOST SESSIONS', value: top.label });
  }
  const split = total === 0 ? [] : MODES.filter((m) => counts[m.key] > 0).map((m) => ({
    key: m.key, label: m.short, count: counts[m.key], pct: Math.round((counts[m.key] / total) * 100), color: m.color,
  }));

  const promo = promoFor({ level, tier, idx, total, xp, lean });

  return {
    level,
    xp,
    headline: `LEVEL ${fmt(level)}`,
    tier: {
      id: tier.id, name: tier.name, label: tier.label, color: tier.color, secret: !!tier.secret,
      index: tier.secret ? -1 : idx,
      levels: tier.secret ? `${secretStartLevel(tier)}+` : (idx === LAST_VISIBLE ? `${firstLevelOf(idx)}+` : `${firstLevelOf(idx)}-${firstLevelOf(idx) + LEVELS_PER_TIER - 1}`),
    },
    tierLabel: tier.label.toUpperCase(),
    xpInfo: {
      total: xp, into, needed: XP_PER_LEVEL, toNext,
      pct: Math.round((into / XP_PER_LEVEL) * 100),
      levelFrom: xpRangeOf(level).from, levelTo: xpRangeOf(level).to,
      barLabel: `${fmt(toNext)} XP to LEVEL ${fmt(level + 1)}`,
      intoLabel: `${fmt(into)} / ${fmt(XP_PER_LEVEL)} XP`,
    },
    levelTitle: `WHAT LEVEL ${fmt(level)} MEANS`,
    levelLine: `${rangeLine} ${meaningLine}`,
    levelLineParts: [rangeLine, meaningLine],
    doneTitle: "WHAT YOU'VE DONE",
    isNew: total === 0 && xp === 0,
    sessions: total,
    facts,
    split,
    recap: buildRecap(total, counts, xp),
    promo,
    nextTitle: 'NEXT',
    next: buildNext({ level, xp, toNext, tier, idx, pace }),
    ladder: buildLadder(level, tier, idx),
    ladderNote: ladderNote(),
  };
}

export const LEVEL_STORY_CONSTANTS = { XP_PER_LEVEL, LEVELS_PER_TIER, DEFAULT_SESSION_XP, SECRET_START_LEVEL, FINAL_FORM_START_LEVEL };
