import { CARDIO_METHODS } from './cardioProtocolData';
import { CAMPAIGN_SERIES, CAMPAIGN_SERIES_BY_ID } from './arcadeCampaignSeries';

const DEMON_BACK_STAGES = [
  {
    id: 'db-s1', stageNumber: 1, title: 'Foundation Pull',
    focus: 'Back activation, grip, core, basic shadowboxing',
    isFinalRound: false,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'db1-f1', type: 'sets', title: 'Pull-ups or Assisted Pull-ups', instructions: 'Full range of motion. Controlled descent.', reps: 5, sets: 3, restSeconds: 60, equipment: 'Pull-up bar' },
        { id: 'db1-f2', type: 'sets', title: 'Inverted Rows', instructions: 'Squeeze shoulder blades together at top.', reps: 10, sets: 3, restSeconds: 45, equipment: 'Bar or table' },
        { id: 'db1-f3', type: 'timer', title: 'Dead Hang', instructions: 'Grip the bar. Relax shoulders. Breathe.', durationSeconds: 30, sets: 3, restSeconds: 30, equipment: 'Pull-up bar' },
        { id: 'db1-f4', type: 'sets', title: 'Superman Holds', instructions: 'Lift arms and legs off the ground. Hold 3 seconds.', reps: 10, sets: 3, restSeconds: 30, equipment: 'None' },
        { id: 'db1-f5', type: 'sets', title: 'Push-ups', instructions: 'Full range. Chest to floor.', reps: 12, sets: 3, restSeconds: 45, equipment: 'None' },
        { id: 'db1-f6', type: 'timer', title: 'Hollow Body Hold', instructions: 'Lower back pressed to floor. Arms overhead.', durationSeconds: 20, sets: 3, restSeconds: 30, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'db1-g1', type: 'rounds', title: 'Shadowboxing - Jab Cross', instructions: 'Stay relaxed. Focus on form and breathing.', rounds: 2, durationSeconds: 60, restSeconds: 30, equipment: 'None' },
        { id: 'db1-g2', type: 'rounds', title: 'Slip and Roll Drill', instructions: 'Slip left, slip right, roll under. Keep hands up.', rounds: 2, durationSeconds: 45, restSeconds: 20, equipment: 'None' },
        { id: 'db1-g3', type: 'rounds', title: 'Defensive Movement Round', instructions: 'Footwork only. Move angles. No punches.', rounds: 1, durationSeconds: 60, restSeconds: 0, equipment: 'None' },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'db-s2', stageNumber: 2, title: 'Grip and Guard',
    focus: 'Pulling endurance, loaded carries, boxing guard endurance',
    isFinalRound: false,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'db2-f1', type: 'sets', title: 'Pull-ups', instructions: 'Go to failure each set. Rest fully.', reps: 6, sets: 4, restSeconds: 90, equipment: 'Pull-up bar' },
        { id: 'db2-f2', type: 'timer', title: 'Farmer Carries', instructions: 'Heavy dumbbells. Walk with tight core.', durationSeconds: 40, sets: 3, restSeconds: 45, equipment: 'Dumbbells' },
        { id: 'db2-f3', type: 'sets', title: 'Dumbbell Rows', instructions: 'One arm at a time. Squeeze at top.', reps: 10, sets: 3, restSeconds: 45, equipment: 'Dumbbell' },
        { id: 'db2-f4', type: 'timer', title: 'Dead Hang', instructions: 'Overhand grip. Breathe through it.', durationSeconds: 40, sets: 3, restSeconds: 30, equipment: 'Pull-up bar' },
        { id: 'db2-f5', type: 'sets', title: 'Bodyweight Squats', instructions: 'Full depth. Drive through heels.', reps: 15, sets: 3, restSeconds: 30, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'db2-g1', type: 'rounds', title: 'Boxing Guard Endurance', instructions: 'Hold guard position. Throw 1-2 every 10 seconds.', rounds: 3, durationSeconds: 60, restSeconds: 30, equipment: 'None' },
        { id: 'db2-g2', type: 'rounds', title: 'Jab-Cross Volume Round', instructions: 'Non-stop 1-2 combinations at moderate pace.', rounds: 2, durationSeconds: 60, restSeconds: 30, equipment: 'None' },
        { id: 'db2-g3', type: 'rounds', title: 'Sprawl to Stance Reset', instructions: 'Sprawl, stand, reset stance. Repeat.', rounds: 2, durationSeconds: 45, restSeconds: 30, equipment: 'None' },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'db-s3', stageNumber: 3, title: 'Demon Volume',
    focus: 'High-rep back work, calisthenics, fight conditioning',
    isFinalRound: false,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'db3-f1', type: 'sets', title: 'Wide-Grip Pull-ups', instructions: 'Wide grip. Control the negative.', reps: 5, sets: 5, restSeconds: 60, equipment: 'Pull-up bar' },
        { id: 'db3-f2', type: 'sets', title: 'Inverted Rows', instructions: 'Feet elevated if possible.', reps: 12, sets: 4, restSeconds: 45, equipment: 'Bar or table' },
        { id: 'db3-f3', type: 'sets', title: 'Dumbbell Rows', instructions: 'Heavy. Strict form.', reps: 8, sets: 4, restSeconds: 60, equipment: 'Dumbbell' },
        { id: 'db3-f4', type: 'timer', title: 'Dead Hang', instructions: 'Aim for max time.', durationSeconds: 45, sets: 3, restSeconds: 30, equipment: 'Pull-up bar' },
        { id: 'db3-f5', type: 'sets', title: 'Push-ups', instructions: 'Vary hand position each set.', reps: 15, sets: 4, restSeconds: 30, equipment: 'None' },
        { id: 'db3-f6', type: 'sets', title: 'Lunges', instructions: 'Alternate legs. Keep torso upright.', reps: 12, sets: 3, restSeconds: 30, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'db3-g1', type: 'rounds', title: 'Shadowboxing Freestyle', instructions: 'Mix up combos. Use head movement.', rounds: 3, durationSeconds: 90, restSeconds: 30, equipment: 'None' },
        { id: 'db3-g2', type: 'rounds', title: 'Fight Focus Pressure Round', instructions: 'Non-stop output. No rest between punches.', rounds: 2, durationSeconds: 60, restSeconds: 30, equipment: 'None' },
        { id: 'db3-g3', type: 'rounds', title: 'Bag Work (Optional)', instructions: 'If bag available: 3-piece combos, constant movement.', rounds: 2, durationSeconds: 60, restSeconds: 30, equipment: 'Bag optional' },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'db-s4', stageNumber: 4, title: 'Pressure Round',
    focus: 'Back, shoulders, core, and nonstop striking pace',
    isFinalRound: false,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'db4-f1', type: 'sets', title: 'Pull-ups', instructions: 'Mix grips: overhand, underhand, neutral.', reps: 6, sets: 5, restSeconds: 75, equipment: 'Pull-up bar' },
        { id: 'db4-f2', type: 'timer', title: 'Farmer Carries', instructions: 'Heavy. Walk until grip fails.', durationSeconds: 50, sets: 3, restSeconds: 45, equipment: 'Dumbbells' },
        { id: 'db4-f3', type: 'sets', title: 'Superman Holds', instructions: 'Hold 5 seconds at top.', reps: 12, sets: 4, restSeconds: 30, equipment: 'None' },
        { id: 'db4-f4', type: 'sets', title: 'Dumbbell Rows', instructions: 'Heavier than last stage.', reps: 8, sets: 4, restSeconds: 60, equipment: 'Dumbbell' },
        { id: 'db4-f5', type: 'timer', title: 'Hollow Body Hold', instructions: 'Full extension. Tight core.', durationSeconds: 30, sets: 4, restSeconds: 20, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'db4-g1', type: 'rounds', title: 'Combo Coach Sequence', instructions: 'Follow combo prompts. No breaks between.', rounds: 3, durationSeconds: 90, restSeconds: 30, equipment: 'None' },
        { id: 'db4-g2', type: 'rounds', title: 'Defensive Movement Round', instructions: 'Slip, roll, pivot. Stay light on feet.', rounds: 2, durationSeconds: 60, restSeconds: 20, equipment: 'None' },
        { id: 'db4-g3', type: 'rounds', title: 'Fight Focus Pressure', instructions: 'Max output. Coach intensity.', rounds: 2, durationSeconds: 90, restSeconds: 30, equipment: 'None' },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'db-s5', stageNumber: 5, title: 'Break the Limit',
    focus: 'Heavy pulling, conditioning, and advanced combat movement',
    isFinalRound: false,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'db5-f1', type: 'sets', title: 'Weighted Pull-ups or Max Rep Pull-ups', instructions: 'Add weight if possible, otherwise max reps.', reps: 5, sets: 5, restSeconds: 90, equipment: 'Pull-up bar' },
        { id: 'db5-f2', type: 'sets', title: 'Dumbbell Rows (Heavy)', instructions: 'Go heavy. Strict form.', reps: 6, sets: 5, restSeconds: 60, equipment: 'Dumbbell' },
        { id: 'db5-f3', type: 'timer', title: 'Dead Hang Challenge', instructions: 'One set. Max time. No letting go.', durationSeconds: 60, sets: 1, restSeconds: 0, equipment: 'Pull-up bar' },
        { id: 'db5-f4', type: 'timer', title: 'Farmer Carries (Heavy)', instructions: 'Heaviest weight available. Walk until failure.', durationSeconds: 60, sets: 3, restSeconds: 60, equipment: 'Dumbbells' },
        { id: 'db5-f5', type: 'sets', title: 'Push-ups (Close Grip)', instructions: 'Elbows tight. Full depth.', reps: 15, sets: 4, restSeconds: 30, equipment: 'None' },
        { id: 'db5-f6', type: 'sets', title: 'Bodyweight Squats', instructions: 'Deep. Explosive on the way up.', reps: 20, sets: 3, restSeconds: 30, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'db5-g1', type: 'rounds', title: 'Shadowboxing Advanced', instructions: 'Full arsenal. Level changes. Feints.', rounds: 3, durationSeconds: 120, restSeconds: 30, equipment: 'None' },
        { id: 'db5-g2', type: 'rounds', title: 'Sprawl and Strike', instructions: 'Sprawl, get up, throw 3-piece combo. Repeat.', rounds: 3, durationSeconds: 60, restSeconds: 30, equipment: 'None' },
        { id: 'db5-g3', type: 'rounds', title: 'Bag Work Finisher', instructions: 'All out on the bag. Empty the tank.', rounds: 2, durationSeconds: 90, restSeconds: 30, equipment: 'Bag optional' },
      ],
    },
    rewards: { xp: 100 },
  },
  {
    id: 'db-final', stageNumber: 6, title: 'Final Round',
    focus: 'Extreme back endurance, grip, core, and hybrid fight conditioning',
    isFinalRound: true,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'dbf-f1', type: 'sets', title: 'Pull-ups to Failure', instructions: 'Max reps. Rest 90 seconds. Repeat.', reps: 0, sets: 5, restSeconds: 90, equipment: 'Pull-up bar' },
        { id: 'dbf-f2', type: 'sets', title: 'Inverted Rows (Max)', instructions: 'Feet elevated. Go to failure each set.', reps: 0, sets: 4, restSeconds: 60, equipment: 'Bar or table' },
        { id: 'dbf-f3', type: 'timer', title: 'Dead Hang Challenge', instructions: 'Max hold. Beat your record.', durationSeconds: 90, sets: 2, restSeconds: 60, equipment: 'Pull-up bar' },
        { id: 'dbf-f4', type: 'timer', title: 'Farmer Carry Gauntlet', instructions: 'Heavy carries. Walk until you physically cannot.', durationSeconds: 90, sets: 3, restSeconds: 45, equipment: 'Dumbbells' },
        { id: 'dbf-f5', type: 'sets', title: 'Superman Holds', instructions: 'Hold 5 seconds. No rest between reps.', reps: 15, sets: 4, restSeconds: 30, equipment: 'None' },
        { id: 'dbf-f6', type: 'timer', title: 'Hollow Body Hold', instructions: 'Full extension. Max duration.', durationSeconds: 45, sets: 3, restSeconds: 20, equipment: 'None' },
        { id: 'dbf-f7', type: 'sets', title: 'Core Finisher - Mountain Climbers', instructions: 'Fast pace. 30 seconds per set.', reps: 30, sets: 3, restSeconds: 15, equipment: 'None' },
      ],
    },
    fightBlock: {
      mode: 'fight',
      tasks: [
        { id: 'dbf-g1', type: 'rounds', title: 'Championship Shadowboxing', instructions: '3 minutes straight. Fight like the title is on the line.', rounds: 3, durationSeconds: 180, restSeconds: 30, equipment: 'None' },
        { id: 'dbf-g2', type: 'rounds', title: 'Sprawl and Strike Gauntlet', instructions: 'Sprawl, get up, 5-piece combo. Non-stop.', rounds: 3, durationSeconds: 90, restSeconds: 30, equipment: 'None' },
        { id: 'dbf-g3', type: 'rounds', title: 'Fight Focus Final Push', instructions: 'Max output. Leave everything in the ring.', rounds: 2, durationSeconds: 120, restSeconds: 20, equipment: 'None' },
        { id: 'dbf-g4', type: 'rounds', title: 'Defensive Burnout', instructions: 'Slip, roll, pivot. Stay moving the entire round.', rounds: 1, durationSeconds: 120, restSeconds: 0, equipment: 'None' },
      ],
    },
    rewards: { xp: 500, badge: 'Demon Back Badge', title: 'Back Breaker' },
  },
];

// Single source of truth: Training Arcade cardio options are derived from the
// shared CARDIO_METHODS list so swimming, assault bike, manual cardio, etc.
// stay in sync everywhere without a second hand-maintained list.
const CARDIO_OPTIONS = CARDIO_METHODS.map(m => ({ id: m.id, label: m.label }));

const BACK_BALANCE_OPTIONS = [
  { id: 'pull-ups', label: 'Pull-Ups', reps: 5, equipment: 'Pull-up bar' },
  { id: 'assisted-pull-ups', label: 'Assisted Pull-Ups', reps: 8, equipment: 'Pull-up bar' },
  { id: 'inverted-rows', label: 'Inverted Rows', reps: 10, equipment: 'Low bar or table' },
  { id: 'dead-hangs', label: 'Dead Hangs', durationSeconds: 30, equipment: 'Pull-up bar' },
  { id: 'scapular-pulls', label: 'Scapular Pulls', reps: 10, equipment: 'Pull-up bar' },
  { id: 'superman-pulls', label: 'Superman Pulls', reps: 15, equipment: 'None' },
  { id: 'prone-swimmers', label: 'Prone Swimmers', reps: 15, equipment: 'None' },
  { id: 'reverse-snow-angels', label: 'Reverse Snow Angels', reps: 12, equipment: 'None' },
];

const STAGE_1_SCORING = [
  { rank: 'S', label: 'S-Rank', maxMinutes: 15, points: 500 },
  { rank: 'A', label: 'A-Rank', maxMinutes: 25, points: 400 },
  { rank: 'B', label: 'B-Rank', maxMinutes: 40, points: 300 },
  { rank: 'C', label: 'C-Rank', maxMinutes: 60, points: 200 },
  { rank: 'Clear', label: 'Clear', maxMinutes: Infinity, points: 100 },
];

const BOSS_SCORING = [
  { rank: 'S', label: 'S-Rank', maxMinutes: 60 },
  { rank: 'A', label: 'A-Rank', maxMinutes: 90 },
  { rank: 'B', label: 'B-Rank', maxMinutes: 120 },
  { rank: 'Partial', label: 'Partial Clear', minCompletionRatio: 0.5 },
  { rank: 'Retry', label: 'Retry Recommended', minCompletionRatio: 0 },
];

const ONE_PUNCH_STAGES = [
  {
    id: 'op-stage-1', stageNumber: 1, title: 'Hero Entry Test',
    focus: 'Baseline benchmark: self-paced 100 push-ups, 100 squats, 100 sit-ups',
    announcerIntro: 'Stage 1. Hero Entry Test. Complete 100 push-ups, 100 squats, and 100 sit-ups. Your pace. Get ready.',
    stageType: 'benchmark',
    scoringType: 'timeRank',
    isFinalRound: false,
    isLocked: false,
    basePoints: 500,
    requiresFullCompletionToUnlockNext: true,
    minValidSeconds: 180,
    maxValidSeconds: null,
    scoringTiers: STAGE_1_SCORING,
    fitBlock: {
      mode: 'fit',
      tasks: [
        { id: 'op1-f1', type: 'benchmark', title: 'Push-Ups', instructions: 'Complete 100 push-ups. Full range of motion. Chest to floor.', reps: 100, cadenceMs: 2000, equipment: 'None', category: 'push' },
        { id: 'op1-f2', type: 'benchmark', title: 'Squats', instructions: 'Complete 100 squats. Full depth. No partial reps.', reps: 100, cadenceMs: 2000, equipment: 'None', category: 'legs' },
        { id: 'op1-f3', type: 'benchmark', title: 'Sit-Ups', instructions: 'Complete 100 sit-ups. Full range of motion.', reps: 100, cadenceMs: 2000, equipment: 'None', category: 'core' },
      ],
    },
    fightBlock: null,
    cardioBlock: null,
    backBalanceBlock: null,
    rewards: { xp: 200, statRewards: { strength: 20, endurance: 30, discipline: 10 } },
  },
  {
    id: 'op-stage-2', stageNumber: 2, title: '10x10 Foundation',
    focus: 'Introduce cadence training with 10 rounds of 10 reps each exercise',
    announcerIntro: 'Stage 2. Ten by ten foundation. Push-ups, squats, and sit-ups. 10 rounds of 10 reps. Follow the count.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 200,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // Rep circuit at pure cadence ≈ 22 min (10 rounds × 60s work + 70s rest).
    starTiers: [
      { stars: 3, maxMinutes: 22 },
      { stars: 2, maxMinutes: 28 },
      { stars: 1, maxMinutes: 36 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 10,
      tasksPerRound: [
        { id: 'op2-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: 'Chest to floor. Full lockout. Move with the cadence.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'push' },
        { id: 'op2-f2', type: 'cadenceReps', title: 'Squats', instructions: 'Full depth. Drive through heels. Keep chest up.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'legs' },
        { id: 'op2-f3', type: 'cadenceReps', title: 'Sit-Ups', instructions: 'Full sit-up. Controlled on the way down.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 30, equipment: 'None', category: 'core' },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: false,
      durationMinutes: 12,
      distanceEquivalent: '3.3 km / 2 miles',
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: false },
    },
    backBalanceBlock: null,
    rewards: { xp: 200, statRewards: { strength: 25, endurance: 35, discipline: 15 } },
  },
  {
    id: 'op-stage-3', stageNumber: 3, title: 'Pull Balance Foundation',
    focus: 'Add bodyweight pulling and shoulder balance to prevent imbalance',
    announcerIntro: 'Stage 3. Pull Balance Foundation. Adding back work to prevent imbalance. Follow the cadence.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 200,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // 5 rounds × ~165s (3×10 reps + 5 pulls + rests) ≈ 14 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 15 },
      { stars: 2, maxMinutes: 20 },
      { stars: 1, maxMinutes: 26 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 5,
      tasksPerRound: [
        { id: 'op3-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: 'Controlled cadence. Full range of motion.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'push' },
        { id: 'op3-f2', type: 'cadenceReps', title: 'Squats', instructions: 'Full depth. Keep core tight.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'legs' },
        { id: 'op3-f3', type: 'cadenceReps', title: 'Sit-Ups', instructions: 'Full sit-up. Hands behind head.', reps: 10, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'core' },
        { id: 'op3-f4', type: 'cadenceReps', title: 'Pull-Ups or Inverted Rows', instructions: 'Pull-ups if bar available. Otherwise inverted rows or prone swimmers.', reps: 5, cadence: 'slow', cadenceMs: 3000, restSeconds: 30, equipment: 'Pull-up bar optional', category: 'back' },
      ],
      totalReps: { pushUps: 50, sitUps: 50, squats: 50, backWork: 25 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: false,
      durationMinutes: 12,
      distanceEquivalent: null,
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: false },
    },
    backBalanceBlock: {
      type: 'integrated',
      options: BACK_BALANCE_OPTIONS,
      noPullUpBarAlternatives: ['superman-pulls', 'prone-swimmers', 'reverse-snow-angels'],
    },
    rewards: { xp: 200, statRewards: { strength: 25, endurance: 30, discipline: 15, balance: 20 } },
  },
  {
    id: 'op-stage-4', stageNumber: 4, title: '5x20 Conditioning',
    focus: 'Move from smaller sets to bigger chunks with 5 rounds of 20',
    announcerIntro: 'Stage 4. Five by twenty conditioning. Bigger sets, steady cadence. Control your breathing.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 250,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // 5 rounds × ~196s (3×20 reps + rests) ≈ 16.5 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 17 },
      { stars: 2, maxMinutes: 22 },
      { stars: 1, maxMinutes: 29 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 5,
      tasksPerRound: [
        { id: 'op4-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: 'Steady rhythm. 20 reps non-stop.', reps: 20, cadence: 'moderate', cadenceMs: 2000, restSeconds: 25, equipment: 'None', category: 'push' },
        { id: 'op4-f2', type: 'cadenceReps', title: 'Squats', instructions: 'Full depth. No half-reps.', reps: 20, cadence: 'moderate', cadenceMs: 1800, restSeconds: 25, equipment: 'None', category: 'legs' },
        { id: 'op4-f3', type: 'cadenceReps', title: 'Sit-Ups', instructions: 'Full range. Keep the rhythm.', reps: 20, cadence: 'moderate', cadenceMs: 2000, restSeconds: 30, equipment: 'None', category: 'core' },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: true,
      durationMinutes: 20,
      distanceEquivalent: null,
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: true, minBoosts: 3, maxBoosts: 4, minDurationSeconds: 20, maxDurationSeconds: 40 },
    },
    backBalanceBlock: null,
    rewards: { xp: 250, statRewards: { strength: 30, endurance: 40, discipline: 20 } },
  },
  {
    id: 'op-stage-5', stageNumber: 5, title: '2x50 Protocol',
    focus: 'Build toward the full protocol with 2 rounds of 50 reps',
    announcerIntro: 'Stage 5. Two by fifty protocol. 50 reps per set. Push through the fatigue.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 300,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // 2 rounds × ~450s (3×50 reps + long rests) ≈ 15 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 16 },
      { stars: 2, maxMinutes: 21 },
      { stars: 1, maxMinutes: 28 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 2,
      tasksPerRound: [
        { id: 'op5-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: '50 reps. Micro-breaks allowed but timer runs.', reps: 50, cadence: 'moderate', cadenceMs: 2000, restSeconds: 45, equipment: 'None', category: 'push' },
        { id: 'op5-f2', type: 'cadenceReps', title: 'Squats', instructions: '50 reps. Full depth every rep.', reps: 50, cadence: 'moderate', cadenceMs: 2000, restSeconds: 45, equipment: 'None', category: 'legs' },
        { id: 'op5-f3', type: 'cadenceReps', title: 'Sit-Ups', instructions: '50 reps. Keep going. Breathe through it.', reps: 50, cadence: 'moderate', cadenceMs: 2000, restSeconds: 60, equipment: 'None', category: 'core' },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: true,
      durationMinutes: 28,
      distanceEquivalent: '5 km',
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: true, minBoosts: 3, maxBoosts: 5, minDurationSeconds: 20, maxDurationSeconds: 45 },
    },
    backBalanceBlock: null,
    rewards: { xp: 300, statRewards: { strength: 35, endurance: 45, discipline: 25 } },
  },
  {
    id: 'op-stage-6', stageNumber: 6, title: 'Standard One Punch Protocol',
    focus: 'The true base protocol: 100 push-ups, 100 squats, 100 sit-ups, 10km cardio',
    announcerIntro: 'Stage 6. Standard One Punch Protocol. The full base protocol. 100 push-ups, 100 squats, 100 sit-ups, and a 10 kilometer run.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 350,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // Straight 100/100/100 at cadence ≈ 13 min; slower structures add rest.
    starTiers: [
      { stars: 3, maxMinutes: 15 },
      { stars: 2, maxMinutes: 20 },
      { stars: 1, maxMinutes: 27 },
    ],
    allowStructureChoice: true,
    structureOptions: [
      { id: 'straight', label: 'Straight Set', description: '100 / 100 / 100', rounds: 1, repsPerRound: 100 },
      { id: '5x20', label: '5x20', description: '5 rounds of 20', rounds: 5, repsPerRound: 20 },
      { id: '10x10', label: '10x10', description: '10 rounds of 10', rounds: 10, repsPerRound: 10 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 1,
      tasksPerRound: [
        { id: 'op6-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: '100 total. Choose your structure. Complete every rep.', reps: 100, cadence: 'moderate', cadenceMs: 2000, restSeconds: 60, equipment: 'None', category: 'push' },
        { id: 'op6-f2', type: 'cadenceReps', title: 'Squats', instructions: '100 total. Full depth. No shortcuts.', reps: 100, cadence: 'moderate', cadenceMs: 2000, restSeconds: 60, equipment: 'None', category: 'legs' },
        { id: 'op6-f3', type: 'cadenceReps', title: 'Sit-Ups', instructions: '100 total. Full sit-ups. Keep rhythm.', reps: 100, cadence: 'moderate', cadenceMs: 2000, restSeconds: 60, equipment: 'None', category: 'core' },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: true,
      durationMinutes: 50,
      distanceEquivalent: '10 km / 6.2 miles',
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: true, minBoosts: 4, maxBoosts: 6, minDurationSeconds: 25, maxDurationSeconds: 60 },
    },
    backBalanceBlock: null,
    rewards: { xp: 350, statRewards: { strength: 40, endurance: 50, discipline: 30, cardio: 30 } },
  },
  {
    id: 'op-stage-7', stageNumber: 7, title: 'Push-Up Style Protocol',
    focus: 'Variation training with mixed push-up, core, and squat styles at 100 reps each',
    announcerIntro: 'Stage 7. Push-Up Style Protocol. Variations by round. Adapt to each style.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 350,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'choice',
    // 12 variation sets of 25 (mixed cadences) ≈ 12.5 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 14 },
      { stars: 2, maxMinutes: 18 },
      { stars: 1, maxMinutes: 24 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 4,
      tasksPerRound: [
        { id: 'op7-push-1', type: 'cadenceReps', title: 'Standard Push-Ups', instructions: 'Full range. Strict form.', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 15, equipment: 'None', category: 'push', roundNumber: 1 },
        { id: 'op7-push-2', type: 'cadenceReps', title: 'Wide Push-Ups', instructions: 'Hands wide. Chest stretch at bottom.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'push', roundNumber: 2 },
        { id: 'op7-push-3', type: 'cadenceReps', title: 'Diamond Push-Ups', instructions: 'Hands together. Elbows tight.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'push', roundNumber: 3 },
        { id: 'op7-push-4', type: 'cadenceReps', title: 'Hindu Push-Ups', instructions: 'Smooth wave motion. Full extension.', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 4 },
        { id: 'op7-core-1', type: 'cadenceReps', title: 'Sit-Ups', instructions: 'Full sit-up. Controlled.', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 15, equipment: 'None', category: 'core', roundNumber: 1 },
        { id: 'op7-core-2', type: 'cadenceReps', title: 'Crunches', instructions: 'Shoulders off ground. Squeeze.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'core', roundNumber: 2 },
        { id: 'op7-core-3', type: 'cadenceReps', title: 'Reverse Crunches', instructions: 'Lift hips off floor. Controlled.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'core', roundNumber: 3 },
        { id: 'op7-core-4', type: 'cadenceReps', title: 'Bicycle Crunches', instructions: 'Elbow to opposite knee. Alternate.', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 4 },
        { id: 'op7-squat-1', type: 'cadenceReps', title: 'Bodyweight Squats', instructions: 'Full depth. Controlled.', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 15, equipment: 'None', category: 'legs', roundNumber: 1 },
        { id: 'op7-squat-2', type: 'cadenceReps', title: 'Narrow Squats', instructions: 'Feet together. Knees track over toes.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'legs', roundNumber: 2 },
        { id: 'op7-squat-3', type: 'cadenceReps', title: 'Sumo Squats', instructions: 'Wide stance. Toes out. Squeeze glutes.', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 15, equipment: 'None', category: 'legs', roundNumber: 3 },
        { id: 'op7-squat-4', type: 'cadenceReps', title: 'Pulse Squats', instructions: 'Pulse 3x at bottom before standing.', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 4 },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'choice',
      cardioRequired: true,
      durationMinutes: 40,
      distanceEquivalent: '10 km',
      options: CARDIO_OPTIONS,
      speedBoosts: { enabled: true, minBoosts: 4, maxBoosts: 6, minDurationSeconds: 25, maxDurationSeconds: 50 },
    },
    backBalanceBlock: null,
    rewards: { xp: 350, statRewards: { strength: 40, endurance: 45, discipline: 25, cardio: 25 } },
  },
  {
    id: 'op-stage-8', stageNumber: 8, title: 'Slow Burn Protocol',
    focus: 'Slow tempo for maximum time under tension. Circuit cardio and back-balance finisher.',
    announcerIntro: 'Stage 8. Slow Burn Protocol. Maximum time under tension. Every rep counts.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 400,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'circuit',
    // Slow-tempo circuit: 4 rounds × ~375s ≈ 25 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 27 },
      { stars: 2, maxMinutes: 33 },
      { stars: 1, maxMinutes: 42 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 4,
      tasksPerRound: [
        { id: 'op8-f1', type: 'cadenceReps', title: 'Slow Push-Ups', instructions: 'Slow descent. Slow press. Feel every second.', reps: 25, cadence: 'slow', cadenceMs: 3500, restSeconds: 30, equipment: 'None', category: 'push' },
        { id: 'op8-f2', type: 'cadenceReps', title: 'Slow Sit-Ups', instructions: 'Controlled curl up. Slow lower.', reps: 25, cadence: 'slow', cadenceMs: 3500, restSeconds: 30, equipment: 'None', category: 'core' },
        { id: 'op8-f3', type: 'cadenceReps', title: 'Slow Squats', instructions: '3-second descent. Pause at bottom. Drive up.', reps: 25, cadence: 'slow', cadenceMs: 4000, restSeconds: 40, equipment: 'None', category: 'legs' },
      ],
      totalReps: { pushUps: 100, sitUps: 100, squats: 100 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'circuit',
      cardioRequired: true,
      rounds: 5,
      circuitTasks: [
        { id: 'op8-c1', type: 'cardioTimer', title: 'Fast Run / High Knees / Jump Rope', durationSeconds: 120, intensity: 'high' },
        { id: 'op8-c2', type: 'cardioTimer', title: 'Walk or Shadowboxing Footwork', durationSeconds: 60, intensity: 'low' },
        { id: 'op8-c3', type: 'cardioTimer', title: 'Mountain Climbers', durationSeconds: 30, intensity: 'high' },
      ],
    },
    backBalanceBlock: {
      type: 'finisher',
      label: 'Back-Balance Finisher',
      chooseOne: [
        { id: 'bb8-1', title: 'Pull-Ups', reps: 30, equipment: 'Pull-up bar' },
        { id: 'bb8-2', title: 'Inverted Rows', reps: 60, equipment: 'Low bar or table' },
        { id: 'bb8-3', title: 'Prone Swimmers', reps: 60, equipment: 'None' },
        { id: 'bb8-4', title: 'Dead Hangs', sets: 3, durationSeconds: 30, equipment: 'Pull-up bar' },
      ],
    },
    rewards: { xp: 400, statRewards: { strength: 45, endurance: 50, discipline: 35, balance: 25 } },
  },
  {
    id: 'op-stage-9', stageNumber: 9, title: '150 Rep Ascension',
    focus: 'Increased volume to 150 reps per exercise with variation by round',
    announcerIntro: 'Stage 9. 150 Rep Ascension. Higher volume. Variations by round. Stay disciplined.',
    stageType: 'cadenceCircuit',
    scoringType: 'completion',
    isFinalRound: false,
    isLocked: true,
    basePoints: 450,
    requiresFullCompletionToUnlockNext: true,
    cardioMode: 'circuit',
    // 18 variation sets of 25 (450 reps, mixed cadences) ≈ 21 min at cadence.
    starTiers: [
      { stars: 3, maxMinutes: 23 },
      { stars: 2, maxMinutes: 29 },
      { stars: 1, maxMinutes: 37 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 6,
      variationByRound: true,
      tasksPerRound: [
        { id: 'op9-r1-push', type: 'cadenceReps', title: 'Standard Push-Ups', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 1 },
        { id: 'op9-r2-push', type: 'cadenceReps', title: 'Wide Push-Ups', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 2 },
        { id: 'op9-r3-push', type: 'cadenceReps', title: 'Diamond Push-Ups', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 3 },
        { id: 'op9-r4-push', type: 'cadenceReps', title: 'Hindu Push-Ups', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 4 },
        { id: 'op9-r5-push', type: 'cadenceReps', title: 'Decline or Pike Push-Ups', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'push', roundNumber: 5 },
        { id: 'op9-r6-push', type: 'cadenceReps', title: 'Burnout Push-Ups', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 25, equipment: 'None', category: 'push', roundNumber: 6 },
        { id: 'op9-r1-core', type: 'cadenceReps', title: 'Sit-Ups', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 1 },
        { id: 'op9-r2-core', type: 'cadenceReps', title: 'Crunches', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 2 },
        { id: 'op9-r3-core', type: 'cadenceReps', title: 'Reverse Crunches', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 3 },
        { id: 'op9-r4-core', type: 'cadenceReps', title: 'Flutter Kicks', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 4 },
        { id: 'op9-r5-core', type: 'cadenceReps', title: 'Leg Raises', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'core', roundNumber: 5 },
        { id: 'op9-r6-core', type: 'cadenceReps', title: 'Bicycle Crunches', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 25, equipment: 'None', category: 'core', roundNumber: 6 },
        { id: 'op9-r1-legs', type: 'cadenceReps', title: 'Standard Squats', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 1 },
        { id: 'op9-r2-legs', type: 'cadenceReps', title: 'Sumo Squats', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 2 },
        { id: 'op9-r3-legs', type: 'cadenceReps', title: 'Pulse Squats', reps: 25, cadence: 'slow', cadenceMs: 3000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 3 },
        { id: 'op9-r4-legs', type: 'cadenceReps', title: 'Split Squats', reps: 25, cadence: 'moderate', cadenceMs: 2000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 4 },
        { id: 'op9-r5-legs', type: 'cadenceReps', title: 'Jump Squats', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 20, equipment: 'None', category: 'legs', roundNumber: 5 },
        { id: 'op9-r6-legs', type: 'cadenceReps', title: 'Standard Squats', reps: 25, cadence: 'fast', cadenceMs: 1000, restSeconds: 25, equipment: 'None', category: 'legs', roundNumber: 6 },
      ],
      totalReps: { pushUps: 150, sitUps: 150, squats: 150 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'circuit',
      cardioRequired: true,
      rounds: 6,
      circuitTasks: [
        { id: 'op9-c1', type: 'cardioTimer', title: 'Run / Jump Rope / High Knees', durationSeconds: 90, intensity: 'high' },
        { id: 'op9-c2', type: 'cardioTimer', title: 'Mountain Climbers', durationSeconds: 30, intensity: 'high' },
        { id: 'op9-c3', type: 'cardioTimer', title: 'Shadowboxing Footwork', durationSeconds: 30, intensity: 'moderate' },
        { id: 'op9-c4', type: 'cardioTimer', title: 'Rest', durationSeconds: 30, intensity: 'rest' },
      ],
    },
    backBalanceBlock: null,
    rewards: { xp: 450, statRewards: { strength: 50, endurance: 60, discipline: 35, cardio: 30 } },
  },
  {
    id: 'op-stage-10', stageNumber: 10, title: 'Final Boss — One Punch Gauntlet',
    focus: '200 push-ups, 200 squats, 200 sit-ups, 60 minutes cardio, back-balance inserts',
    announcerIntro: 'Final Boss. One Punch Gauntlet. 200 push-ups, 200 squats, 200 sit-ups, and 40 minutes of cardio. Survive the rounds. Control your pace.',
    stageType: 'bossCircuit',
    scoringType: 'partialCompletion',
    isFinalRound: true,
    isLocked: true,
    basePoints: 500,
    requiresFullCompletionToUnlockNext: false,
    cardioMode: 'choice',
    scoringTiers: BOSS_SCORING,
    // ~21 min reps (mixed cadences) + 8 min rests + 40 min cardio + inserts ≈ 73 min.
    starTiers: [
      { stars: 3, maxMinutes: 75 },
      { stars: 2, maxMinutes: 85 },
      { stars: 1, maxMinutes: 100 },
    ],
    fitBlock: {
      mode: 'fit',
      rounds: 8,
      cadenceByRound: [
        { rounds: [1, 2], cadence: 'moderate', cadenceMs: 2000 },
        { rounds: [3, 4], cadence: 'fast', cadenceMs: 1000 },
        { rounds: [5, 6], cadence: 'slow', cadenceMs: 3500 },
        { rounds: [7, 8], cadence: 'survival', cadenceMs: null },
      ],
      tasksPerRound: [
        { id: 'op10-f1', type: 'cadenceReps', title: 'Push-Ups', instructions: '25 reps per round. Cadence changes every 2 rounds.', reps: 25, restSeconds: 20, equipment: 'None', category: 'push' },
        { id: 'op10-f2', type: 'cadenceReps', title: 'Sit-Ups / Core', instructions: '25 reps per round. Controlled.', reps: 25, restSeconds: 20, equipment: 'None', category: 'core' },
        { id: 'op10-f3', type: 'cadenceReps', title: 'Squats', instructions: '25 reps per round. Full depth.', reps: 25, restSeconds: 20, equipment: 'None', category: 'legs' },
        { id: 'op10-f4', type: 'cardioTimer', title: 'Cardio', instructions: '5 minutes cardio of your choice.', durationSeconds: 300, equipment: 'None', category: 'cardio' },
      ],
      backBalanceInsertAfterRounds: [2, 4, 6, 8],
      backBalanceInsert: {
        chooseOne: [
          { id: 'bb10-1', title: 'Pull-Ups', reps: 8, equipment: 'Pull-up bar' },
          { id: 'bb10-2', title: 'Inverted Rows', reps: 12, equipment: 'Low bar or table' },
          { id: 'bb10-3', title: 'Prone Swimmers', reps: 20, equipment: 'None' },
          { id: 'bb10-4', title: 'Dead Hang', durationSeconds: 30, equipment: 'Pull-up bar' },
        ],
      },
      totalReps: { pushUps: 200, sitUps: 200, squats: 200, cardioMinutes: 40, backBalanceSets: 4 },
    },
    fightBlock: null,
    cardioBlock: {
      type: 'integrated',
      cardioRequired: true,
      totalDurationMinutes: 40,
      perRoundDurationSeconds: 300,
      options: CARDIO_OPTIONS,
    },
    backBalanceBlock: {
      type: 'integrated',
      insertAfterRounds: [2, 4, 6, 8],
      options: BACK_BALANCE_OPTIONS,
    },
    rewards: { xp: 500, badge: 'One Punch Badge', title: 'Endurance Hero', statRewards: { strength: 60, endurance: 80, discipline: 50, cardio: 40, balance: 30 } },
  },
];

const MYTHIC_BOSS_STAGE = {
  id: 'op-mythic', stageNumber: 11, title: 'Mythic Boss: Limit Break Protocol',
  focus: '500 push-ups, 500 squats, 500 sit-ups, 20 km cardio',
  announcerIntro: 'Mythic Boss. Limit Break Protocol. 500 push-ups, 500 squats, 500 sit-ups, and a 20 kilometer run. This is the ultimate test.',
  stageType: 'bossCircuit',
  scoringType: 'partialCompletion',
  isFinalRound: true,
  isLocked: true,
  isMythic: true,
  isEliteChallenge: true,
  displayLabel: 'Elite challenge. Not required for series completion.',
  basePoints: 1000,
  requiresFullCompletionToUnlockNext: false,
  // 1500 reps (~50 min at cadence) + rests + 20 km cardio (~120 min) ≈ 190 min.
  starTiers: [
    { stars: 3, maxMinutes: 195 },
    { stars: 2, maxMinutes: 220 },
    { stars: 1, maxMinutes: 250 },
  ],
  fitBlock: {
    mode: 'fit',
    rounds: 20,
    tasksPerRound: [
      { id: 'mythic-f1', type: 'cadenceReps', title: 'Push-Ups', reps: 25, equipment: 'None', category: 'push' },
      { id: 'mythic-f2', type: 'cadenceReps', title: 'Sit-Ups / Core', reps: 25, equipment: 'None', category: 'core' },
      { id: 'mythic-f3', type: 'cadenceReps', title: 'Squats', reps: 25, equipment: 'None', category: 'legs' },
    ],
    totalReps: { pushUps: 500, sitUps: 500, squats: 500 },
  },
  cardioBlock: {
    type: 'choice',
    cardioRequired: true,
    durationMinutes: 120,
    distanceEquivalent: '20 km',
    options: CARDIO_OPTIONS,
    speedBoosts: { enabled: true, minBoosts: 5, maxBoosts: 6, minDurationSeconds: 30, maxDurationSeconds: 60 },
  },
  rewards: { xp: 1000, badge: 'Limit Breaker Badge', title: 'One Punch Legend', statRewards: { strength: 100, endurance: 120, discipline: 80, cardio: 60 } },
};

export const TRAINING_ARCADE_SERIES = [
  {
    id: 'one-punch-protocol',
    title: 'One Punch Protocol',
    subtitle: 'Cadence Rep Endurance Challenge',
    description: 'A bodyweight arcade series built around high-rep discipline, controlled cadence, cardio, and mental toughness. Complete each stage by following the rep count, pacing, rest intervals, and cardio demands.',
    status: 'active',
    isActive: true,
    isImported: true,
    type: 'Fit',
    difficultyStars: 3,
    equipment: 'None required. Pull-up bar optional.',
    durationType: 'Stage-based endurance series',
    availableModes: ['fit'],
    bannerImage: '/banners/arcade/one-punch-regiment.webp',
    qrSlug: 'one-punch-protocol',
    sourceWorkout: null,
    phases: [],
    baseWorkoutDescription: 'The base workout includes push-ups, squats, sit-ups, cardio, and periodic back-balance work. The protocol scales from a self-paced benchmark into cadence-controlled workouts, tempo variations, cardio circuits, and boss-level endurance challenges.',
    trainingFormat: 'Benchmark testing, cadence reps, timed cardio, controlled rest, stage progression, and circuit-based boss rounds.',
    seriesFocus: ['Bodyweight Strength', 'Muscular Endurance', 'Cardio', 'Discipline', 'Rep Cadence', 'Mental Toughness'],
    improves: ['Strength', 'Endurance', 'Cardio', 'Discipline', 'Mental Toughness', 'Bodyweight Control'],
    difficultyOptions: ['rookie', 'standard', 'heroic', 'boss'],
    cadenceOptions: ['fast', 'moderate', 'slow'],
    restOptions: ['short', 'normal', 'extended'],
    soundOptions: ['on', 'off'],
    statRewards: { endurance: 3, discipline: 2, strength: 2 },
    rewards: { badge: 'One Punch Badge', title: 'Endurance Rookie', statBoost: 'Strength + Endurance + Cardio', xp: 500 },
    stages: ONE_PUNCH_STAGES,
    mythicBoss: MYTHIC_BOSS_STAGE,
    cardioOptions: CARDIO_OPTIONS,
    backBalanceOptions: BACK_BALANCE_OPTIONS,
  },
  {
    id: 'dark-knight-protocol',
    title: 'Dark Knight Protocol',
    subtitle: 'Tactical Conditioning',
    description: 'Hybrid tactical conditioning with strength, mobility, combat basics, and endurance. Train like an elite vigilante.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Hybrid',
    difficultyStars: 4,
    equipment: 'Bodyweight, optional equipment',
    durationType: 'Stage-based series',
    availableModes: ['fit', 'fight', 'both'],
    bannerImage: '/banners/arcade/dark-knight-protocol.webp',
    qrSlug: 'dark-knight-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { strength: 2, agility: 3, endurance: 2 },
    rewards: { badge: 'Dark Knight Badge', title: 'Tactical Operator', statBoost: 'Agility + Strength' },
    stages: [],
  },
  {
    id: 'demon-back-protocol',
    title: 'Demon Back Protocol',
    subtitle: 'Hybrid Strength + Combat',
    description: 'A hybrid strength and combat-conditioning workout series inspired by extreme anime-style training. Build pulling strength, grip, back endurance, core durability, and fight-ready conditioning.',
    status: 'active',
    isActive: true,
    isImported: true,
    type: 'Hybrid',
    difficultyStars: 5,
    equipment: 'Pull-up bar, dumbbells optional, gym optional, bag optional',
    durationType: 'Stage-based series',
    availableModes: ['fit', 'fight', 'both'],
    bannerImage: '/banners/arcade/demon-back-protocol.webp',
    qrSlug: 'demon-back-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { strength: 4, grip: 3, endurance: 3 },
    rewards: { badge: 'Demon Back Badge', title: 'Back Breaker', statBoost: 'Strength + Endurance' },
    stages: DEMON_BACK_STAGES,
  },
  {
    id: 'ultra-instinct-protocol',
    title: 'Ultra Instinct Protocol',
    subtitle: 'Speed + Flow',
    description: 'Speed, mobility, reaction, shadowboxing, footwork, and flow-based conditioning. Move before you think.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Hybrid / Fight',
    difficultyStars: 4,
    equipment: 'None',
    durationType: 'Stage-based series',
    availableModes: ['fight', 'both'],
    bannerImage: '/banners/arcade/ultra-instinct-banner.webp',
    qrSlug: 'ultra-instinct-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { speed: 4, agility: 3, reflexes: 3 },
    rewards: { badge: 'Ultra Instinct Badge', title: 'Untouchable', statBoost: 'Speed + Reflexes' },
    stages: [],
  },
  {
    id: 'ultra-ego-style',
    title: 'Ultra Ego Style',
    subtitle: 'Power Training',
    description: 'Strength-focused power training built around heavy lifts, durability, legs, shoulders, and intensity. Embrace the damage.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Fit / Hybrid',
    difficultyStars: 5,
    equipment: 'Full gym recommended',
    durationType: 'Stage-based series',
    availableModes: ['fit', 'both'],
    bannerImage: '/banners/arcade/ultra-ego-style.webp',
    qrSlug: 'ultra-ego-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { power: 4, durability: 3, strength: 3 },
    rewards: { badge: 'Ultra Ego Badge', title: 'Destruction Incarnate', statBoost: 'Power + Durability' },
    stages: [],
  },
  {
    id: 'strikers-path',
    title: "Striker's Path",
    subtitle: 'Striking Mastery',
    description: 'Progressive striking development from fundamentals to advanced combinations. Develop knockout power and fight IQ.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Fight',
    difficultyStars: 3,
    equipment: 'Bag optional',
    durationType: 'Stage-based series',
    availableModes: ['fight'],
    bannerImage: null,
    qrSlug: 'strikers-path',
    sourceWorkout: null,
    phases: [],
    statRewards: { striking: 4, fightIQ: 2, power: 2 },
    rewards: { badge: "Striker's Badge", title: 'Knockout Artist', statBoost: 'Striking + Fight IQ' },
    stages: [],
  },
  {
    id: 'kick-demon-protocol',
    title: 'Kick Demon Protocol',
    subtitle: 'Leg Power + Kicks',
    description: 'Leg strength, kick technique, flexibility, and devastating lower-body combat conditioning.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Hybrid / Fight',
    difficultyStars: 4,
    equipment: 'Bag optional, space for kicking',
    durationType: 'Stage-based series',
    availableModes: ['fit', 'fight', 'both'],
    bannerImage: null,
    qrSlug: 'kick-demon-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { legPower: 4, flexibility: 3, striking: 2 },
    rewards: { badge: 'Kick Demon Badge', title: 'Leg Destroyer', statBoost: 'Leg Power + Flexibility' },
    stages: [],
  },
  {
    id: 'combat-conditioning-gauntlet',
    title: 'Combat Conditioning Gauntlet',
    subtitle: 'Total Fight Fitness',
    description: 'Full-body combat conditioning combining strength, cardio, striking, and mental toughness. The ultimate fighter fitness test.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Hybrid',
    difficultyStars: 5,
    equipment: 'Bodyweight, dumbbells optional',
    durationType: 'Stage-based series',
    availableModes: ['fit', 'fight', 'both'],
    bannerImage: null,
    qrSlug: 'combat-conditioning-gauntlet',
    sourceWorkout: null,
    phases: [],
    statRewards: { endurance: 4, strength: 3, mentalToughness: 3 },
    rewards: { badge: 'Gauntlet Badge', title: 'Iron Will', statBoost: 'Endurance + Mental Toughness' },
    stages: [],
  },
  {
    id: 'hyperbolic-time-chamber',
    title: 'Hyperbolic Gravity Chamber',
    subtitle: 'Tempo-based time-under-tension training',
    description: 'Slow eccentric and controlled concentric training designed to create fatigue through time under tension.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Fit',
    difficultyStars: 3,
    equipment: 'None',
    durationType: 'Stage-based series',
    availableModes: ['fit'],
    bannerImage: '/static/series/posters/hyperbolic-gravity.png',
    qrSlug: 'hyperbolic-time-chamber',
    sourceWorkout: null,
    phases: [],
    statRewards: { endurance: 3, strength: 2, discipline: 3 },
    rewards: { badge: 'Time Chamber Badge', title: 'Tempo Master', statBoost: 'Endurance + Discipline' },
    stages: [],
  },
  {
    id: 'blue-blur-speed-protocol',
    title: 'Blue Blur Speed Protocol',
    subtitle: 'Sprint, speed, and cardio training',
    description: 'Original speed-inspired cardio series built around intervals, sprints, jump rope, and conditioning.',
    status: 'comingSoon',
    isActive: false,
    isImported: false,
    type: 'Fit / Cardio',
    difficultyStars: 3,
    equipment: 'None',
    durationType: 'Stage-based series',
    availableModes: ['fit'],
    bannerImage: '/static/series/posters/blue-blur.png',
    qrSlug: 'blue-blur-speed-protocol',
    sourceWorkout: null,
    phases: [],
    statRewards: { speed: 4, agility: 3, endurance: 3 },
    rewards: { badge: 'Blue Blur Badge', title: 'Speed Demon', statBoost: 'Speed + Agility' },
    stages: [],
  },
];

export function getSeriesById(id) {
  return TRAINING_ARCADE_SERIES.find(s => s.id === id) || null;
}

export function isSeriesPlayable(series) {
  return (
    series.status === 'active' &&
    series.isActive === true &&
    series.isImported === true &&
    Array.isArray(series.stages) &&
    series.stages.length > 0
  );
}

// 2.10 — fold the 5 v2 campaigns into the base list: real data replaces the
// matching "coming soon" placeholders (same id → keeps poster + carousel slot);
// the two brand-new campaigns are appended. Done in place so the exports +
// VISIBLE filter below pick them up.
for (let i = 0; i < TRAINING_ARCADE_SERIES.length; i++) {
  const cs = CAMPAIGN_SERIES_BY_ID[TRAINING_ARCADE_SERIES[i].id];
  if (cs) TRAINING_ARCADE_SERIES[i] = cs;
}
CAMPAIGN_SERIES.forEach((cs) => {
  if (!TRAINING_ARCADE_SERIES.some((s) => s.id === cs.id)) TRAINING_ARCADE_SERIES.push(cs);
});

const VISIBLE_SERIES_IDS = [
  'one-punch-protocol',
  'baki-grappler',
  'dark-knight-protocol',
  'berserk-struggler',
  'ultra-instinct-protocol',
  'ultra-ego-style',
  'demon-back-protocol',
  'hyperbolic-time-chamber',
  'blue-blur-speed-protocol',
];

export const VISIBLE_ARCADE_SERIES = TRAINING_ARCADE_SERIES.filter(
  s => VISIBLE_SERIES_IDS.includes(s.id)
);

// --- Star ratings -----------------------------------------------------------

// Time-based star tiers for a stage, fastest first. Prefers the hand-tuned
// `starTiers`; falls back to deriving them from time-ranked scoring tiers
// (stage 1 benchmark and the boss), where tier order is fastest → slowest.
export function getStarTiersForStage(stage) {
  if (Array.isArray(stage?.starTiers) && stage.starTiers.length) return stage.starTiers;
  const timeTiers = (stage?.scoringTiers || []).filter(t => Number.isFinite(t.maxMinutes));
  if (timeTiers.length >= 3) {
    return [
      { stars: 3, maxMinutes: timeTiers[0].maxMinutes },
      { stars: 2, maxMinutes: timeTiers[1].maxMinutes },
      { stars: 1, maxMinutes: timeTiers[2].maxMinutes },
    ];
  }
  return null;
}

// Stars earned for a completion time. Clearing a stage always earns at
// least 1 star; beating the tier cutoffs earns 2 or 3.
export function getStarsForTime(stage, timeSeconds) {
  const tiers = getStarTiersForStage(stage);
  if (!tiers || !Number.isFinite(timeSeconds) || timeSeconds <= 0) return 1;
  const minutes = timeSeconds / 60;
  let best = 1;
  tiers.forEach(t => { if (minutes < t.maxMinutes) best = Math.max(best, t.stars); });
  return best;
}
