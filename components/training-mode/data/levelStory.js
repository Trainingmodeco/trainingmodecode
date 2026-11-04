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
// sessions the recap says so and no numbers are shown.
//
// Copy rules: second person, short plain sentences, one idea each, no
// franchise or character names, no medical claims, at most one exclamation
// mark on the whole page (the promotion line).
import { getLevel, getLevelProgress } from './userStats';
import { VISIBLE_TIERS, SECRET_TIERS, SECRET_UNLOCK, tierIndexForLevel, getModeXp, sessionMode } from './tiers';

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
const LAST_VISIBLE = VISIBLE_TIERS.length - 1;

// ── what a level means ──────────────────────────────────────────────────────
// Second sentence for levels 1 to 15 (index = level - 1). The first sentence
// (where the level sits and its XP range) is built from the numbers.
const MEANING = [
  'You are learning the moves and finding your feet.',
  'The moves feel less new, and you keep coming back.',
  'You have built the habit of showing up.',
  'You cleared Rookie, and training is now part of your week.',
  'You are past the basics, and your sessions are getting smoother.',
  'You know the work now, and Warrior is one level away.',
  'You trained your way out of Novice, and the work is showing.',
  'You train like it matters, and the routine is carrying you.',
  'You are one level from Max, and you earned every step.',
  'You made it out of Warrior, and the serious work shows.',
  'You are settled in Max, and the sessions keep stacking up.',
  'Champion is one level away, and you put in a lot of work to get here.',
  'You reached Champion, the top tier of the main ladder.',
  'You are living at Champion level, and you keep adding to it.',
  'You keep showing up as a Champion, one session at a time.',
];
const MEANING_CHAMPION = 'You keep stacking Champion levels, one session at a time.';
const MEANING_SECRET = {
  'peak-physique': 'Your XP leans toward Fit Mode training, and that unlocked this tier.',
  'fight-ascendant': 'Your XP leans toward Fight Mode training, and that unlocked this tier.',
  'final-form': 'You trained hard in Fit, Fight and Conditioning, and you cleared a full saga.',
};

// One tier-voice line each. Never claims more than the tier says is true.
const PROMO = {
  rookie: 'You are building the habit, and that is the hardest part. Keep showing up.',
  novice: 'The work is showing. You keep coming back, and every session counts.',
  warrior: 'You train like it matters. That is what a Warrior does.',
  elite: 'You reached Max. That takes real, steady work, and you did it!',
  champion: 'Champion is elite. You stand at the top of the main ladder.',
  'peak-physique': 'Peak Physique is a secret tier, and your Fit Mode work unlocked it.',
  'fight-ascendant': 'Fight Ascendant is a secret tier, and your Fight Mode work unlocked it.',
  'final-form': 'You unlocked the last tier there is. Be proud of that.',
};
const PROMO_FIRST = 'Every athlete on the ladder started here. Your first session is your first step up.';

const MODES = [
  { key: 'fit', label: 'Fit Mode', short: 'Fit', color: '#4ade80' },
  { key: 'fight', label: 'Fight Mode', short: 'Fight', color: '#f43f5e' },
  { key: 'cc', label: 'Combat Conditioning', short: 'Conditioning', color: '#60a5fa' },
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

function levelText(level, tier, idx) {
  const { from, to } = xpRangeOf(level);
  const range = `XP ${fmt(from)} to ${fmt(to)}.`;
  if (tier.secret) {
    return [`Level ${level} is a ${tier.name} level: ${range}`, MEANING_SECRET[tier.id]];
  }
  if (idx === LAST_VISIBLE) {
    const lead = level === firstLevelOf(LAST_VISIBLE) ? 'the first step of Champion' : 'a Champion level';
    return [`Level ${level} is ${lead}: ${range}`, level <= MEANING.length ? MEANING[level - 1] : MEANING_CHAMPION];
  }
  const step = ['first', 'middle', 'last'][(level - 1) % LEVELS_PER_TIER];
  return [`Level ${level} is the ${step} step of ${tier.name}: ${range}`, MEANING[level - 1]];
}

function splitSessions(rows) {
  const counts = { fit: 0, fight: 0, cc: 0, other: 0 };
  for (const s of rows) counts[sessionMode(s)] += 1;
  return counts;
}

function buildRecap(total, counts) {
  if (total === 0) return 'Your first session starts this level.';
  const lead = `You have finished ${plural(total, 'session', 'sessions')}`;
  const parts = MODES.filter((m) => counts[m.key] > 0);
  const named = parts.filter((m) => m.key !== 'other');
  if (named.length === 0) return `${lead}.`;
  if (parts.length === 1) return `${lead}, all in ${parts[0].label}.`;
  const bits = parts.map((m) => (m.key === 'other' ? `${fmt(counts.other)} in other training` : `${fmt(counts[m.key])} in ${m.label}`));
  const list = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
  return `${lead}: ${list}.`;
}

// The mode used most. 'other' is not a mode, and an exact tie has no winner.
function mostUsed(counts) {
  const ranked = MODES.filter((m) => m.key !== 'other' && counts[m.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && counts[ranked[0].key] === counts[ranked[1].key]) return { tie: true, label: 'Even split' };
  return { tie: false, key: ranked[0].key, label: ranked[0].label };
}

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
    return {
      id: t.id, name: t.name, label: t.label, color: t.color, secret: false,
      firstLevel: first, lastLevel: closedAt,
      levels: closedAt == null ? `${first}+` : `${first}-${closedAt}`,
      state, ticked: state === 'passed', current: state === 'current', pips,
      marker: state === 'current' ? { level, label: `LVL ${fmt(level)}` } : null,
    };
  });
  if (inSecret) {
    nodes.push({
      id: tier.id, name: tier.name, label: tier.label, color: tier.color, secret: true,
      firstLevel: SECRET_START_LEVEL, lastLevel: null, levels: `${SECRET_START_LEVEL}+`,
      state: 'current', ticked: false, current: true, pips: [],
      marker: { level, label: `LVL ${fmt(level)}` },
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
    out.tierLine = 'You are in the top tier. What is left is more levels, and each one adds to your record.';
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

// ── the story ───────────────────────────────────────────────────────────────
export function levelStory(stats, opts = {}) {
  const { xp, rows } = cleanStats(stats);
  const level = getLevel(xp);
  const into = getLevelProgress(xp).current;
  const toNext = XP_PER_LEVEL - into;
  const tier = resolveTier(xp, rows, opts?.tier);
  const idx = tier.secret ? LAST_VISIBLE + 1 : tierIndexForLevel(level);
  const total = rows.length;
  const counts = splitSessions(rows);
  const streak = Number.isFinite(opts?.streak) && opts.streak >= 0 ? Math.floor(opts.streak) : null;

  const [rangeLine, meaningLine] = levelText(level, tier, idx);
  const top = mostUsed(counts);

  // Pace: the athlete's own average once there are three sessions to average.
  const own = total >= MIN_SESSIONS_FOR_PACE && xp > 0;
  const pace = { own, xp: own ? Math.max(1, Math.round(xp / total)) : DEFAULT_SESSION_XP };

  const facts = [];
  if (total > 0) {
    facts.push({ key: 'sessions', label: 'SESSIONS', value: fmt(total) });
    facts.push({ key: 'xp', label: 'TOTAL XP', value: fmt(xp) });
    if (streak != null) facts.push({ key: 'streak', label: 'DAY STREAK', value: fmt(streak) });
    if (top) facts.push({ key: 'top', label: 'MOST USED', value: top.label });
  }
  const split = total === 0 ? [] : MODES.filter((m) => counts[m.key] > 0).map((m) => ({
    key: m.key, label: m.short, count: counts[m.key], pct: Math.round((counts[m.key] / total) * 100), color: m.color,
  }));

  const promo = total === 0 && level === 1 ? PROMO_FIRST : (PROMO[tier.id] || PROMO.champion);

  return {
    level,
    xp,
    headline: `LEVEL ${fmt(level)}`,
    tier: {
      id: tier.id, name: tier.name, label: tier.label, color: tier.color, secret: !!tier.secret,
      index: tier.secret ? -1 : idx,
      levels: tier.secret ? `${SECRET_START_LEVEL}+` : (idx === LAST_VISIBLE ? `${firstLevelOf(idx)}+` : `${firstLevelOf(idx)}-${firstLevelOf(idx) + LEVELS_PER_TIER - 1}`),
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
    isNew: total === 0,
    sessions: total,
    facts,
    split,
    recap: buildRecap(total, counts),
    promo,
    nextTitle: 'NEXT',
    next: buildNext({ level, xp, toNext, tier, idx, pace }),
    ladder: buildLadder(level, tier, idx),
    ladderNote: `Each level is ${fmt(XP_PER_LEVEL)} XP. ${VISIBLE_TIERS[0].name} to ${VISIBLE_TIERS[LAST_VISIBLE - 1].name} are ${LEVELS_PER_TIER} levels each.`,
  };
}

export const LEVEL_STORY_CONSTANTS = { XP_PER_LEVEL, LEVELS_PER_TIER, DEFAULT_SESSION_XP, SECRET_START_LEVEL };
