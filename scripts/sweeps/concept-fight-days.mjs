// The Concept drops' fight training days (data/concepts/index.js fightDayCfg and
// the concept definitions), played by FightFocusTimer.jsx. A concept fight day
// is handed to the timer whole as cfg.blockRounds, so every line below is built
// from the real config of a real day.
//
// The coverage tool only collected day 1: fightDayCfg ignores `day` unless the
// stored progress says that day was already done (fightReplayable). Here the
// progress store ('tm_concepts_v1') is seeded with fightDone 999 for every
// concept, which makes every day replayable, and then fightDayCfg(concept,
// { tier, day }) is called for every concept in CONCEPT_SCHEDULE, every fight
// day and every tier (easy, normal, hard). The store is put back as it was
// afterwards (fightDayCfg also writes a started mark, so the whole key is
// restored, or removed when it was empty).
//
// Lines built, per round of each config (`cur`) and the round after it (`nxt`):
//  1. Round start, FightFocusTimer.jsx:336, template copied character for
//     character, with no voice pack (a concept cfg carries no voicePack, so
//     startLine is null and the pack lead never applies).
//  2. A short round, FightFocusTimer.jsx:334, `Round ${rIdx + 1}.`. A concept
//     round has no length_sec, so it applies only when roundMin is 45 seconds
//     or less; it is built for every round number anyway, it costs nothing.
//  3. Rest and next-up, FightFocusTimer.jsx:643, with no voice pack, so the
//     lead is 'Rest.'.
//  4. Resume line after a cold restore, FightFocusTimer.jsx:749, both the rest
//     form and the round form.
//  5. Super name call, FightFocusTimer.jsx:479, `Super! ${sup.name}!`, for every
//     round that carries a super (every tier, so the easy super is used too).
//  6. Super calls, FightFocusTimer.jsx:503-506: every entry of sup.calls through
//     formatCall in both call styles (names and numbers), speech field.
//  7. Cadence combos, FightFocusTimer.jsx:557-559: every entry of the round's
//     combos through formatCall in both call styles, speech field. The tier
//     picks combos or easyCombos inside fightDayCfg, so every tier is covered.
//  8. Multiple opponent switch calls, FightFocusTimer.jsx:574, for any round
//     that has multi: true, every SWITCH_CALLS speech line (nextSwitchCall
//     picks from that list at random).
//  9. Finishers, FightFocusTimer.jsx:618, :723 (`Finisher. ...`) and :664
//     (the later finishers). A concept cfg has no finishers field today, so
//     these are built only if a config carries one.
//
// Lines of the timer that do not come from concept data (RUSH_ACTIVATION, RUSH_COMPLETE,
// the Halfway call, Clean round, the number countdown, encouragement quotes,
// rush calls) are proven by other sweeps and the bank inventory, not here.
// The rest seconds and the round count are not spoken.
import process from 'node:process';

const TIERS = ['easy', 'normal', 'hard'];
const STYLES = ['names', 'numbers'];
const KEY = 'tm_concepts_v1';

export default async () => {
  const con = await import('../../components/training-mode/data/concepts/index.js');
  const { formatCall } = await import('../../components/training-mode/data/strikeNumbering.js');
  const { SWITCH_CALLS } = await import('../../components/training-mode/data/multiOpponent.js');
  void process;

  const concepts = con.CONCEPT_SCHEDULE.map((e) => e.concept || con.entryFor(e.id)?.concept).filter(Boolean);
  const ls = globalThis.localStorage;
  const before = ls.getItem(KEY);
  const start = new Set(); const shortR = new Set(); const rest = new Set(); const resume = new Set();
  const supName = new Set(); const supCalls = new Set(); const combos = new Set(); const sw = new Set(); const fin = new Set();
  try {
    ls.setItem(KEY, JSON.stringify(Object.fromEntries(concepts.map((c) => [c.id, { fitDone: 999, fightDone: 999 }]))));
    for (const c of concepts) {
      for (const tier of TIERS) {
        (c.fight?.days || []).forEach((_, i) => {
          const cfg = con.fightDayCfg(c, { tier, day: i });
          if (!cfg.conceptReplay) throw new Error(`${c.id} day ${i} was not built as the replay day`);
          const rounds = cfg.blockRounds || [];
          rounds.forEach((cur, k) => {
            const focus = cur?.round_title || 'Free flow';
            // FightFocusTimer.jsx:336
            start.add(`Round ${k + 1}. ${focus}.${cur?.coach_prompt ? ` ${cur.coach_prompt}` : ''}`);
            // FightFocusTimer.jsx:334
            shortR.add(`Round ${k + 1}.`);
            const nxt = rounds[k + 1];
            // FightFocusTimer.jsx:643 (no voice pack: the lead is 'Rest.')
            if (nxt) rest.add(`Rest.${nxt?.round_title ? ` Up next: ${nxt.round_title}.` : ''}`);
            // FightFocusTimer.jsx:749
            resume.add('Rest.');
            resume.add(`Round ${k + 1}. ${focus}.`);
            const sup = cur?.super;
            // FightFocusTimer.jsx:479
            if (sup) supName.add(`Super! ${sup.name}!`);
            // FightFocusTimer.jsx:503-506
            for (const call of sup?.calls || []) for (const st of STYLES) supCalls.add(formatCall(call, st).speech);
            // FightFocusTimer.jsx:557-559
            for (const call of cur?.combos || []) for (const st of STYLES) combos.add(formatCall(call, st).speech);
            // FightFocusTimer.jsx:574
            if (cur?.multi) for (const s of SWITCH_CALLS) sw.add(s.speech);
          });
          // FightFocusTimer.jsx:618, :723, :664
          (cfg.finishers || []).forEach((f, j) => {
            if (j === 0) fin.add(`Finisher. ${f.movement}. ${f.work_sec} seconds. Go!`);
            else fin.add(`${f.movement}. ${f.work_sec} seconds. Go!`);
          });
        });
      }
    }
  } finally {
    if (before == null) ls.removeItem(KEY); else ls.setItem(KEY, before);
  }
  const mk = (name, set) => ({ feature: 'Concept drops', name, lines: [...set] });
  return [
    mk('Concept fight days: round start (FightFocusTimer.jsx:336)', start),
    mk('Concept fight days: short round call (FightFocusTimer.jsx:334)', shortR),
    mk('Concept fight days: rest and up next (FightFocusTimer.jsx:643)', rest),
    mk('Concept fight days: cold resume line (FightFocusTimer.jsx:749)', resume),
    mk('Concept fight days: super name call (FightFocusTimer.jsx:479)', supName),
    mk('Concept fight days: super calls, both call styles (FightFocusTimer.jsx:506)', supCalls),
    mk('Concept fight days: cadence combos, both call styles (FightFocusTimer.jsx:559)', combos),
    mk('Concept fight days: multiple opponent switch calls (FightFocusTimer.jsx:574)', sw),
    mk('Concept fight days: finishers (FightFocusTimer.jsx:618, :664, :723)', fin),
  ];
};
