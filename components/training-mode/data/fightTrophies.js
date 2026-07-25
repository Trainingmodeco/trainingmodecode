// Fight Mode trophies (design 40f). The first four come from the ghost-battles
// spec ("wire to their real trigger events"); the five extras arrived as art
// ahead of any spec, so their triggers below are EDUCATED SPECS — each one is
// grounded in a stat the app already records (no phantom counters), named to
// match its art, and tiered so the set forms a progression. Tune freely.
import { loadFightStats } from './fightStats';
import { loadStats } from './userStats';
import { loadCampProgress } from './campProgress';

const ART = (n) => `/static/trophies/fight/${n}.webp`;

// ── The nine trophies ────────────────────────────────────────────────────────
// need/valueOf give each trophy a measurable trigger + progress readout.
export const FIGHT_TROPHIES = [
  {
    id: 'CAMP_CHAMPION', label: 'Camp Champion', art: ART('camp-champion'),
    desc: 'Win the belt — clear Training Camp Level 12, the Title Fight.',
    need: 12, valueOf: (c) => c.campLevel - 1, fmt: (c) => `Camp L${Math.min(c.campLevel - 1, 12)}/12 cleared`,
  },
  {
    id: 'COMBO_MACHINE', label: 'Combo Machine', art: ART('combo-machine'),
    desc: 'Throw 1,000 called strikes across your fight sessions.',
    need: 1000, valueOf: (c) => c.fight.strikes,
  },
  {
    id: 'SWEET_SCIENCE', label: 'Sweet Science', art: ART('sweet-science'),
    desc: 'Study the craft — complete 5 Start Here technique lessons.',
    need: 5, valueOf: (c) => c.lessons,
  },
  {
    id: 'IRON_ROUNDS', label: 'Iron Rounds', art: ART('iron-rounds'),
    desc: 'Go the distance — 100 total fight rounds on the bell.',
    need: 100, valueOf: (c) => c.fight.rounds,
  },
  // ── The five extras (educated specs) ──────────────────────────────────────
  {
    // Finisher archetype: a "knockout" here = a session you FINISHED — every
    // round completed, nothing abandoned. Rewards closing, not starting.
    id: 'KNOCKOUT_KING', label: 'Knockout King', art: ART('knockout-king'),
    desc: 'Finish what you start — 25 fight sessions with every round completed.',
    need: 25, valueOf: (c) => c.finishedFights,
  },
  {
    // Burst-output archetype: the strike STREAK is the app's power-burst stat
    // (peak unbroken run in one session). One explosive surge, not volume.
    id: 'POWER_SURGE', label: 'Power Surge', art: ART('power-surge'),
    desc: 'Hit a 50-strike streak in a single session.',
    need: 50, valueOf: (c) => c.fight.bestStreak,
  },
  {
    // Tempo-switch archetype: breaking rhythm = training BOTH cadence styles.
    // Requires real time in each of the two fight formats, not just one.
    id: 'RHYTHM_BREAKER', label: 'Rhythm Breaker', art: ART('rhythm-breaker'),
    desc: 'Own every tempo — 10 Combo Coach and 10 Fight Focus sessions.',
    need: 10, valueOf: (c) => Math.min(c.comboSessions, c.focusSessions),
    fmt: (c) => `${Math.min(c.comboSessions, 10)}/10 combo · ${Math.min(c.focusSessions, 10)}/10 focus`,
  },
  {
    // Ring-command archetype: generalship is earned with rounds in the bank —
    // the veteran tier above Iron Rounds (5× its requirement).
    id: 'RING_GENERAL', label: 'Ring General', art: ART('ring-general'),
    desc: 'Run the ring — 500 total fight rounds.',
    need: 500, valueOf: (c) => c.fight.rounds,
  },
  {
    // Shadow-work archetype: pure striking volume across all sessions — the
    // long-haul mirror of Power Surge's single burst (5× Combo Machine).
    id: 'SHADOW_STRIKER', label: 'Shadow Striker', art: ART('shadow-striker'),
    desc: 'Live in the shadow work — 5,000 total strikes thrown.',
    need: 5000, valueOf: (c) => c.fight.strikes,
  },
];

// Snapshot of every stat the triggers read, computed once per render.
export function fightTrophyContext() {
  const sessions = loadStats().sessions || [];
  const count = (type) => sessions.filter((s) => s.type === type).length;
  return {
    fight: loadFightStats(),
    campLevel: loadCampProgress(),
    lessons: count('Start Here'),
    comboSessions: count('Combo Coach'),
    focusSessions: count('Fight Focus'),
    finishedFights: sessions.filter(
      (s) => (s.type === 'Fight Focus' || s.type === 'Combo Coach') &&
        s.totalCount > 0 && s.completedCount >= s.totalCount,
    ).length,
  };
}

// [{ ...trophy, earned, progressText }] for the Progress trophies tab.
export function fightTrophyStates() {
  const ctx = fightTrophyContext();
  return FIGHT_TROPHIES.map((t) => {
    const v = Math.max(0, t.valueOf(ctx) || 0);
    return {
      ...t,
      earned: v >= t.need,
      progressText: t.fmt ? t.fmt(ctx) : `${Math.min(v, t.need).toLocaleString()}/${t.need.toLocaleString()}`,
    };
  });
}
