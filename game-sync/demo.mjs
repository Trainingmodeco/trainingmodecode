// Sanity demo: run `node game-sync/demo.mjs`
// Verifies the founder's canonical builds come out as designed.
import { computeFighterProfile } from './fighterProfile.js';

const usage = (min, sessions = Math.ceil(min / 30)) => ({
  sessions, activeMinutes: min, xpEarned: min * 10,
});
const empty = () => usage(0, 0);

const base = (userId, features) => ({
  userId, totalXp: 12000, level: 3, tier: 'veteran',
  discipline: 'boxing', streakDays: 3,
  features: {
    workoutBuilder: empty(), quickMission: empty(), cardio: empty(),
    combatConditioning: empty(), fightFocus: empty(), comboCoach: empty(),
    practiceMode: { ...empty(), lessonsCompleted: [] },
    arcade: { ...empty(), stagesCleared: 0, bossStagesCleared: 0, seriesCleared: [] },
    ...features,
  },
});

// Founder example 1: Workout Builder heavy, declines cardio, no fight training
// → great strength, gasses out quickly, limited strikes.
const lifter = computeFighterProfile(base('lifter', {
  workoutBuilder: usage(900),
  quickMission: usage(60),
}));

// Founder example 2: fight-mode student — combo coach + practice + arcade
// → long combos, hit XP, unlocked strikes and specials, but weaker raw damage.
const striker = computeFighterProfile(base('striker', {
  cardio: usage(300),
  fightFocus: usage(400),
  comboCoach: usage(500),
  practiceMode: {
    ...usage(200),
    lessonsCompleted: ['jab', 'cross', 'lead_hook', 'rear_uppercut', 'slip', 'teep', 'low_kick'],
  },
  arcade: { ...usage(150), stagesCleared: 11, bossStagesCleared: 2, seriesCleared: ['s1'] },
}));

for (const p of [lifter, striker]) {
  console.log(`\n=== ${p.userId} (LV${p.level} ${p.tier}) ===`);
  console.log('stats   ', p.stats);
  console.log('derived ', p.derived);
  console.log('moves   ', p.moveList.join(', '));
  console.log('specials', p.specials);
  console.log('perks   ', p.perks, ' weaknesses', p.weaknesses);
}

// Hard assertions — the product promise, encoded.
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } };
assert(lifter.stats.strength >= 70, 'lifter has great strength');
assert(lifter.stats.stamina <= 35, 'lifter gasses out (low stamina)');
assert(lifter.weaknesses.includes('GASSES_OUT'), 'lifter flagged GASSES_OUT');
assert(lifter.weaknesses.includes('LIMITED_ARSENAL'), 'lifter has limited strikes');
assert(lifter.perks.includes('GLASS_CANNON'), 'lifter is a glass cannon');
assert(striker.derived.maxComboLength > lifter.derived.maxComboLength, 'striker combos longer');
assert(striker.derived.hitXpMultiplier > lifter.derived.hitXpMultiplier, 'striker earns more hit XP');
assert(striker.moveList.length > lifter.moveList.length, 'striker unlocked more strikes');
assert(striker.specials.slotsUnlocked >= 3 && striker.specials.ultimateUnlocked, 'arcade unlocks specials + ult');
assert(lifter.specials.slotsUnlocked === 0, 'no arcade → no specials');
console.log(process.exitCode ? '\nASSERTIONS FAILED' : '\nAll assertions passed ✔');
