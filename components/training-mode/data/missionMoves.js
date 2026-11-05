// Quick Mission v2 · the move catalog and the coach's voice helpers.
//
// Every move a v2 mission can run (the authored base moves and every swap),
// with its count, its cues and its coach-authored alternatives. The runner,
// the setup card and SOLO all read this module; it imports nothing.
//
// Cadence is the count in ms per rep at each level (elite / standard /
// beginner). Sources:
//   · the house cadence table of the verified striking set: Hindu squat and
//     push-up, dive bomber, sprawl, lunge to teep, knee strike, one-two,
//     switch kick and roundhouse
//   · catalog2.json libraryGaps: burpees and step-back sprawls
//   · missions/data2.json (CHARGE UP 12's pace cars): the devil press and the
//     burpee over the dumbbell
//   · everything else (every kettlebell, dumbbell and barbell move, and the
//     other bodyweight moves) is a COACH ESTIMATE, as is switchMs (3000 on
//     every 'switch' move) and IRON CLOCK's setupMs in loadoutMissions
// cadence null means the coach never counts it: a timed-only move, or a
// manual one (row calories) that shows DONE and needs estMs for estimates.

export const LEVELS = ['beginner', 'standard', 'elite'];
export const LEVEL_LABEL = { beginner: 'BEGINNER', standard: 'STANDARD', elite: 'ELITE' };
export const GEAR_TAGS = ['none', 'bell', 'db', 'barbell', 'plate', 'bag', 'rower', 'box', 'bar'];
export const GEAR_LABEL = { none: 'NO GEAR', bell: 'KETTLEBELL', db: 'DUMBBELL', barbell: 'BARBELL', plate: 'PLATE', bag: 'HEAVY BAG', rower: 'ROWER', box: 'BOX', bar: 'PULL-UP BAR' };
export const GEAR_WORD = { bell: 'kettlebell', db: 'dumbbell', barbell: 'barbell', plate: 'plate', bag: 'heavy bag', rower: 'rower', box: 'box', bar: 'pull-up bar' };
export const ALT_KINDS = ['easier', 'similar', 'harder', 'no-gear'];
export const ALT_LABEL = { easier: 'EASIER', similar: 'SIMILAR', harder: 'HARDER', 'no-gear': 'NO GEAR' };
export const MANUAL_LINE = 'Your pace. Tap DONE when the set is done.';

// ── authoring helpers ───────────────────────────────────────────────────────
// mv: one catalog entry. cad = [elite, standard, beginner] in SECONDS (stored
// as ms) or null. cues are written ' | '-separated.
const mv = (id, name, say, pattern, gear, unit, cad, flags, cues, alts) => ({
  id, name, say, ...(flags.say1 ? { say1: flags.say1 } : {}), pattern, gear, unit,
  cadence: cad ? { elite: Math.round(cad[0] * 1000), standard: Math.round(cad[1] * 1000), beginner: Math.round(cad[2] * 1000) } : null,
  ...(flags.estMs ? { estMs: flags.estMs } : {}),
  ...(flags.sides ? { sides: flags.sides } : {}),
  ...(flags.sides === 'switch' ? { switchMs: 3000 } : {}), // coach estimate: time to pass the bell or bar to the other arm
  ...(flags.sideWord ? { sideWord: flags.sideWord } : {}), // an alternating move done per hand, not per leg: '10 (5/side)'
  ...(flags.timedOnly ? { timedOnly: true } : {}),
  ...(flags.repsOnly ? { repsOnly: true } : {}),
  ...(flags.callsOk ? { callsOk: true } : {}),
  ...(flags.jumps ? { jumps: true } : {}),
  ...(flags.flyingKnee ? { flyingKnee: true } : {}),
  ...(flags.maxTotalReps ? { maxTotalReps: flags.maxTotalReps } : {}),
  cues: cues.split(' | '),
  alts,
});
const easier = (id, o = {}) => ({ id, kind: 'easier', ...o });
const similar = (id, o = {}) => ({ id, kind: 'similar', ...o });
const harder = (id, o = {}) => ({ id, kind: 'harder', ...o });
const noGear = (id, o = {}) => ({ id, kind: 'no-gear', ...o });
const ALT = { sides: 'alternate' };
const SW = { sides: 'switch' };
const NONE = {};

export const MOVES = [
  // ── sprawl / burpee family ────────────────────────────────────────────────
  mv('sprawl', 'Sprawls', 'sprawls', 'sprawl', 'none', 'reps', [2.25, 2.5, 3.0], NONE,
    'Hands down, shoot the feet straight back. | Hips heavy to the floor, chest up. | Snap back to stance, hands up.',
    [easier('step-back-sprawl'), easier('level-change-drop', { stop: 'Wrist pain?' }), similar('squat-thrust'), harder('burpee')]),
  mv('step-back-sprawl', 'Step-Back Sprawls', 'step-back sprawls', 'sprawl', 'none', 'reps', [3.0, 3.5, 4.0], NONE,
    'Hands down, walk the feet back one at a time. | Hips to the floor. | Walk back in and stand, hands up.',
    [similar('level-change-drop'), harder('sprawl')]),
  mv('level-change-drop', 'Level-Change Drops', 'level-change drops', 'sprawl', 'none', 'reps', [1.75, 2.0, 2.5], NONE,
    'Drop your level fast: knees bend, hips back, chest up. | No hands on the floor. | Drive back up to stance, hands up.',
    [harder('step-back-sprawl'), harder('sprawl')]),
  mv('squat-thrust', 'Squat Thrusts', 'squat thrusts', 'burpee', 'none', 'reps', [2.5, 3.0, 3.5], NONE,
    'Hands down, jump the feet back to a plank. | Jump the feet in. | Stand tall. No jump at the top.',
    [easier('step-back-burpee'), similar('sprawl'), harder('burpee')]),
  mv('burpee', 'Burpees', 'burpees', 'burpee', 'none', 'reps', [2.5, 3.0, 3.5], { jumps: true },
    'Hands down, jump the feet back, chest to the floor. | Push up, jump the feet in. | Stand and jump with a clap overhead. Land soft.',
    [easier('step-back-burpee'), easier('squat-thrust'), similar('sprawl'), harder('burpee-tuck-jump')]),
  mv('step-back-burpee', 'Step-Back Burpees', 'step-back burpees', 'burpee', 'none', 'reps', [3.5, 4.0, 4.5], NONE,
    'Hands down, step back to a plank one foot at a time. | Chest to the floor, push up. | Step in and stand tall. No jump.',
    [harder('squat-thrust'), harder('burpee')]),
  mv('burpee-tuck-jump', 'Burpees with a Tuck Jump', 'tuck-jump burpees', 'burpee', 'none', 'reps', [3.0, 3.5, 4.0], { jumps: true, maxTotalReps: 100 },
    'Full burpee, chest to the floor. | Jump and pull both knees up. | Land soft and go again.',
    [easier('burpee'), easier('step-back-burpee')]),

  // ── squats ────────────────────────────────────────────────────────────────
  mv('air-squat', 'Air Squats', 'air squats', 'squat', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'Feet shoulder-width, sit the hips back and down. | Knees track over the toes. | Stand tall and squeeze at the top.',
    [easier('bench-squat'), similar('hindu-squat'), harder('jump-squat')]),
  mv('bench-squat', 'Squats to a Bench', 'bench squats', 'squat', 'none', 'reps', [2.0, 2.5, 3.0], NONE,
    "Sit back until you touch a bench, chair or bed edge. | Touch and stand, don't drop. | Chest up the whole time.",
    [harder('air-squat')]),
  mv('jump-squat', 'Jump Squats', 'jump squats', 'squat', 'none', 'reps', [1.5, 1.75, 2.25], { jumps: true },
    'Sit back to parallel, arms back. | Jump straight up, arms through. | Land soft into the next rep.',
    [easier('air-squat'), similar('squat-thrust')]),
  mv('hindu-squat', 'Hindu Squats', 'Hindu squats', 'squat', 'none', 'reps', [1.75, 2.0, 2.5], NONE,
    'Arms swing back as you sit, and the heels rise. | Sink only as deep as is comfortable. | Sweep the arms forward and up as you stand. Breathe out on the way up.',
    [easier('heels-down-hindu-squat', { stop: 'Knee pain?' }), easier('half-hindu-squat'), harder('hindu-squat-knee-strike')]),
  mv('heels-down-hindu-squat', 'Heels-Down Hindu Squats', 'heels-down Hindu squats', 'squat', 'none', 'reps', [1.75, 2.0, 2.5], NONE,
    'Same arm swing, heels stay flat. | Knees track over the toes. | Smooth rhythm, no bounce.',
    [similar('half-hindu-squat'), harder('hindu-squat')]),
  mv('half-hindu-squat', 'Half Hindu Squats', 'half Hindu squats', 'squat', 'none', 'reps', [1.5, 1.75, 2.25], NONE,
    'Stop above parallel. | Arms swing back on the way down. | Heels can stay down.',
    [similar('heels-down-hindu-squat'), harder('hindu-squat')]),
  mv('hindu-squat-knee-strike', 'Hindu Squat to Knee Strike', 'Hindu squats to knee strikes', 'squat', 'none', 'reps', [2.75, 3.0, 3.5], NONE,
    'Hindu squat down and up. | As you stand, drive one knee up and through, hands pulling down. | Alternate knees.',
    [easier('hindu-squat'), easier('heels-down-hindu-squat')]),

  // ── kicks, knees, punches ─────────────────────────────────────────────────
  mv('lunge-to-teep', 'Lunge to Teep', 'lunge to teeps', 'kick', 'none', 'reps', [2.75, 3.0, 3.5], ALT,
    'Step back into a reverse lunge, back knee just off the floor. | Drive up, knee first, then push the foot out at stomach height. | Hips forward, hands up. Count each leg.',
    [easier('reverse-lunge-knee-drive'), easier('rear-teep'), harder('lunge-teep-chamber')]),
  mv('reverse-lunge-knee-drive', 'Reverse Lunge to Knee Drive', 'lunge to knee drives', 'lunge', 'none', 'reps', [2.5, 3.0, 3.5], ALT,
    'Step back into a reverse lunge. | Drive up and bring the back knee to belt height. | Hands up. Alternate legs.',
    [easier('reverse-lunge'), harder('lunge-to-teep')]),
  mv('rear-teep', 'Rear Teeps', 'rear teeps', 'kick', 'none', 'reps', [1.75, 2.0, 2.5], ALT,
    'From stance, lift the rear knee first. | Push the ball of the foot out at stomach height. | Snap it back to stance.',
    [similar('reverse-lunge-knee-drive'), harder('lunge-to-teep')]),
  mv('lunge-teep-chamber', 'Lunge to Teep + Chamber Hold', 'lunge to teeps with a hold', 'kick', 'none', 'reps', [3.5, 3.75, 4.25], ALT,
    'Reverse lunge, then drive up. | Hold the knee at belt height for 2 seconds. | Push the teep out and step back.',
    [easier('lunge-to-teep')]),
  mv('one-two', 'One-Two', 'one-twos', 'punch', 'none', 'reps', [0.9, 1.0, 1.25], NONE,
    "Jab, cross, both hands straight back to the chin. | Turn the rear foot on the cross. | Don't snap the elbow straight.",
    [easier('seated-one-two'), harder('one-two-slip'), harder('heavy-bag-one-two')]),
  mv('seated-one-two', 'Seated One-Two', 'seated one-twos', 'punch', 'none', 'reps', [0.9, 1.0, 1.25], NONE,
    'Sit tall on a chair edge, core tight. | Jab, cross, hands back to the chin.',
    [harder('one-two')]),
  mv('one-two-slip', 'One-Two + Slip', 'one-twos with a slip', 'punch', 'none', 'reps', [1.75, 2.0, 2.5], NONE,
    'Jab, cross. | Slip your head off the centre line. | Hands up the whole time.',
    [easier('one-two')]),
  mv('heavy-bag-one-two', 'Heavy Bag One-Two', 'one-twos on the bag', 'punch', 'bag', 'reps', [0.9, 1.0, 1.25], NONE,
    'Gloves on. Snap the jab and cross into the bag. | Hands back to the chin every time.',
    [noGear('one-two')]),
  mv('knee-strike', 'Knee Strikes', 'knee strikes', 'knee', 'none', 'reps', [0.9, 1.0, 1.25], ALT,
    'Hands up as if holding a clinch. | Drive the knee up and through, hips forward. | Rise onto the toes of the standing foot. Alternate.',
    [easier('standing-knee-drive')]),
  mv('standing-knee-drive', 'Standing Knee Drives', 'knee drives', 'knee', 'none', 'reps', [1.0, 1.25, 1.5], ALT,
    'Stand tall, hands up. | Lift one knee to belt height, lower with control. | Alternate.',
    [harder('knee-strike')]),
  mv('windshield-wiper-punches', 'Windshield Wiper Punches', 'windshield wiper punches', 'punch', 'none', 'secs', null, { timedOnly: true, callsOk: true },
    'Square stance, knees soft. | Non-stop straight punches, left-right-left. | Turn through the ribs: sweep far left to far right and back, one pass every 2 seconds, on the Left / Right calls. | Chin down, hands back to the face. Never lock the elbow.',
    [easier('half-arc-wiper-punches', { stop: 'Shoulder pinch?' }), easier('seated-wiper-punches'), harder('v-sit-cross-punches'), harder('bag-speed-punches')]),
  mv('half-arc-wiper-punches', 'Half-Arc Wiper Punches', 'half-arc wipers', 'punch', 'none', 'secs', null, { timedOnly: true, callsOk: true },
    'Same punches, smaller sweep: centre to one side and back. | Shoulders down, chin tucked.',
    [harder('windshield-wiper-punches'), similar('seated-wiper-punches')]),
  mv('seated-wiper-punches', 'Seated Windshield Wiper Punches', 'seated wipers', 'punch', 'none', 'secs', null, { timedOnly: true, callsOk: true },
    'Sit tall on a chair edge. | Punch and sweep left to right with the ribs, on the calls.',
    [harder('windshield-wiper-punches')]),
  mv('v-sit-cross-punches', 'V-Sit Cross Punches', 'V-sit cross punches', 'core', 'none', 'secs', null, { timedOnly: true, callsOk: true },
    'Sit back into a V, feet up or heels down. | Twist and punch across the body, alternating sides. | Keep the chest up.',
    [easier('windshield-wiper-punches')]),
  mv('bag-speed-punches', 'Speed Punches on the Heavy Bag', 'speed punches on the bag', 'punch', 'bag', 'secs', null, { timedOnly: true },
    'Stand close to the bag. | Fast, small straight punches, hands back.',
    [noGear('windshield-wiper-punches')]),
  mv('switch-kick', 'Switch Kicks', 'switch kicks', 'kick', 'none', 'reps', [2.0, 2.5, 3.0], ALT,
    'From stance, a quick switch step brings the rear foot forward. | Turn the hip over and kick through with the shin. | Snap back to stance, hands up.',
    [easier('alt-roundhouse'), easier('alt-low-kick', { stop: 'Hamstring or groin twinge?' }), harder('bag-switch-kick')]),
  mv('alt-roundhouse', 'Alternating Roundhouse Kicks', 'roundhouse kicks', 'kick', 'none', 'reps', [2.25, 2.5, 3.0], ALT,
    'Turn on the ball of the standing foot. | Swing the shin through, hip turned over. | Hands up, back to stance. Alternate.',
    [easier('alt-low-kick'), harder('switch-kick')]),
  mv('alt-low-kick', 'Alternating Low Kicks', 'low kicks', 'kick', 'none', 'reps', [2.0, 2.5, 3.0], ALT,
    'Kick at thigh height, shin first. | Turn the hip, hands up. | Alternate sides.',
    [harder('alt-roundhouse')]),
  mv('bag-switch-kick', 'Switch Kicks on the Heavy Bag', 'switch kicks on the bag', 'kick', 'bag', 'reps', [2.0, 2.5, 3.0], ALT,
    'Switch step, then kick through the bag with the shin. | Hands up, back to stance.',
    [noGear('switch-kick')]),

  // ── push-ups ──────────────────────────────────────────────────────────────
  mv('hindu-push-up', 'Hindu Push-Ups', 'Hindu push-ups', 'push', 'none', 'reps', [2.25, 2.5, 3.0], NONE,
    "Start in down-dog, hips high. | Bend the elbows and swoop the chest low and forward into cobra. | Straighten the arms and push the hips straight back to down-dog. Don't crank the low back.",
    [easier('knee-hindu-push-up', { stop: 'Shoulder pinch or low-back pain?' }), similar('fist-hindu-push-up', { stop: 'Wrist pain?' }), harder('dive-bomber')]),
  mv('knee-hindu-push-up', 'Knee Hindu Push-Ups', 'knee Hindu push-ups', 'push', 'none', 'reps', [2.75, 3.0, 3.5], NONE,
    'Knees down, hips high. | Swoop low and forward, then push the hips back.',
    [harder('hindu-push-up')]),
  mv('fist-hindu-push-up', 'Hindu Push-Ups on Fists', 'Hindu push-ups on fists', 'push', 'none', 'reps', [2.25, 2.5, 3.0], NONE,
    'Same path on closed fists, wrists straight. | Use a mat or a folded towel.',
    [easier('knee-hindu-push-up'), similar('hindu-push-up')]),
  mv('dive-bomber', 'Dive Bomber Push-Ups', 'dive bombers', 'push', 'none', 'reps', [2.75, 3.0, 4.0], NONE,
    'From down-dog, swoop down and through to cobra. | Then bend the elbows again and reverse the same path back to down-dog. | No momentum on the way back.',
    [easier('knee-dive-bomber', { stop: 'Shoulder pinch or low-back pain?' }), easier('hindu-push-up')]),
  mv('knee-dive-bomber', 'Knee Dive Bombers', 'knee dive bombers', 'push', 'none', 'reps', [3.5, 4.0, 4.5], NONE,
    'Knees down. Swoop through to cobra. | Reverse the same path back.',
    [easier('knee-hindu-push-up'), harder('dive-bomber')]),
  mv('push-up', 'Push-Ups', 'push-ups', 'push', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'Hands under the shoulders, body in one line. | Chest to a fist off the floor. | Press the floor away.',
    [easier('knee-push-up'), easier('incline-push-up'), harder('diamond-push-up')]),
  mv('knee-push-up', 'Knee Push-Ups', 'knee push-ups', 'push', 'none', 'reps', [1.75, 2.25, 2.75], NONE,
    'Knees down, hips in line with the shoulders. | Chest to a fist off the floor.',
    [similar('incline-push-up'), harder('push-up')]),
  mv('incline-push-up', 'Incline Push-Ups', 'incline push-ups', 'push', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'Hands on a desk, counter or bench edge, not a soft bed. | Body in one line. | Chest to the edge, press away.',
    [similar('knee-push-up'), harder('push-up')]),
  mv('diamond-push-up', 'Diamond Push-Ups', 'diamond push-ups', 'push', 'none', 'reps', [1.75, 2.25, 2.75], NONE,
    'Hands together under the chest. | Elbows back, close to the ribs.',
    [easier('push-up')]),

  // ── lunges, core, cardio ──────────────────────────────────────────────────
  mv('reverse-lunge', 'Reverse Lunges', 'reverse lunges', 'lunge', 'none', 'reps', [1.75, 2.0, 2.5], ALT,
    'Step back, back knee just off the floor. | Front shin upright. | Drive through the front foot. Alternate.',
    [easier('air-squat'), similar('reverse-lunge-knee-drive'), harder('bulgarian-split-squat')]),
  mv('bulgarian-split-squat', 'Bulgarian Split Squats', 'split squats', 'lunge', 'none', 'reps', [2.25, 2.75, 3.25], ALT,
    'Rear foot on the bed edge or a fixed chair, never a chair with wheels. | Sink straight down. | Drive up through the front foot.',
    [easier('reverse-lunge')]),
  mv('mountain-climber', 'Mountain Climbers', 'mountain climbers', 'core', 'none', 'reps', [0.6, 0.8, 1.0], ALT,
    'Hands under the shoulders, hips low. | Drive the knees in, one at a time. | Count each leg.',
    [easier('slow-climber'), easier('standing-knee-drive')]),
  mv('slow-climber', 'Slow Mountain Climbers', 'slow climbers', 'core', 'none', 'reps', [1.0, 1.25, 1.5], ALT,
    'Step each knee in under control. | Hips low, shoulders over the hands.',
    [harder('mountain-climber')]),
  mv('v-up', 'V-Ups', 'V-ups', 'core', 'none', 'reps', [2.0, 2.5, 3.0], NONE,
    'Lie flat, arms overhead. | Lift arms and legs together and reach for the toes. | Lower with control.',
    [easier('crunch')]),
  mv('crunch', 'Crunches', 'crunches', 'core', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'Knees bent, feet flat. | Curl the shoulders off the floor. | Lower slowly.',
    [harder('v-up')]),
  mv('air-boxing', 'Air Boxing Combos', 'shadowbox combos', 'punch', 'none', 'secs', null, { timedOnly: true },
    'Stay in stance, hands up. | Throw 1-2s, hooks and uppercuts, non-stop. | Keep your feet moving.',
    [similar('row-cal')]),
  mv('row-cal', 'Row (calories)', 'calories on the row', 'cardio', 'rower', 'cal', null, { repsOnly: true, estMs: 3300 },
    'Legs, then lean back, then arms. | Arms, lean forward, then legs on the way back. | Watch the calorie counter and tap DONE at the target.',
    [noGear('air-boxing')]),

  // ── kettlebell / dumbbell (every 'switch' move: do half, switch arm) ─────
  mv('kb-swing', 'Kettlebell Swings', 'swings', 'hinge', 'bell', 'reps', [1.5, 1.75, 2.25], NONE,
    'Hike the bell back between the legs. | Snap the hips; the bell floats to eye level. | Arms are ropes, the hips do the work.',
    [easier('kb-deadlift'), similar('db-swing')]),
  mv('db-swing', 'Dumbbell Swings', 'dumbbell swings', 'hinge', 'db', 'reps', [1.5, 1.75, 2.25], NONE,
    'Hold one end of the dumbbell with both hands. | Same hip snap, to eye level.',
    [similar('kb-swing')]),
  mv('kb-deadlift', 'Kettlebell Deadlifts', 'deadlifts', 'hinge', 'bell', 'reps', [1.75, 2.0, 2.5], NONE,
    'Bell between the feet. | Hips back, flat back, grab the handle. | Stand tall and squeeze the glutes.',
    [harder('kb-swing')]),
  mv('kb-clean', 'Kettlebell Cleans', 'cleans', 'clean', 'bell', 'reps', [2.0, 2.5, 3.0], SW,
    'Hike the bell back and drive the hips. | Keep it close and punch the hand through. | Catch it soft in the rack, elbow on the ribs. If it bangs your forearm, clean from the hang.',
    [easier('kb-hang-clean'), similar('db-clean')]),
  mv('kb-hang-clean', 'Kettlebell Hang Cleans', 'hang cleans', 'clean', 'bell', 'reps', [2.0, 2.5, 3.0], SW,
    'Deadlift the bell to the hang, just above the knees. | Short hip pop, bell close. | Catch soft in the rack.',
    [harder('kb-clean'), similar('db-clean')]),
  mv('db-clean', 'Dumbbell Hang Cleans', 'dumbbell cleans', 'clean', 'db', 'reps', [2.0, 2.5, 3.0], SW,
    'Dumbbell at the hang outside the knee. | Pop the hips and pull it to the shoulder. | Catch with a soft dip.',
    [similar('kb-clean')]),
  mv('kb-press', 'Kettlebell Presses', 'presses', 'press', 'bell', 'reps', [2.0, 2.5, 3.0], { ...SW, say1: 'press' },
    'Start in the rack, glutes and abs tight. | Press straight up, bicep by the ear. | No leaning back. When reps slow, push-press instead.',
    [easier('kb-push-press'), similar('db-press')]),
  mv('kb-push-press', 'Kettlebell Push Presses', 'push presses', 'press', 'bell', 'reps', [1.75, 2.0, 2.5], { ...SW, say1: 'push press' },
    'Small dip at the knees. | Drive up and press to lockout. | Lower to the rack under control.',
    [harder('kb-press')]),
  mv('db-press', 'Dumbbell Shoulder Presses', 'dumbbell presses', 'press', 'db', 'reps', [2.0, 2.5, 3.0], { ...SW, say1: 'dumbbell press' },
    'Dumbbell at the shoulder, glutes tight. | Press straight up, no lean.',
    [similar('kb-press')]),
  mv('kb-row', 'Kettlebell Rows', 'rows', 'pull', 'bell', 'reps', [1.75, 2.0, 2.5], SW,
    'Brace one hand on a bench, chair or your thigh. | Flat back, pull the bell to the hip. | Lower all the way.',
    [similar('db-row'), noGear('backpack-row')]),
  mv('db-row', 'Single-Arm Dumbbell Rows', 'dumbbell rows', 'pull', 'db', 'reps', [1.75, 2.0, 2.5], SW,
    'Brace one hand, flat back. | Pull the dumbbell to the hip, lower all the way.',
    [similar('kb-row'), noGear('backpack-row')]),
  mv('kb-reverse-lunge', 'Goblet Reverse Lunges', 'reverse lunges', 'lunge', 'bell', 'reps', [2.0, 2.5, 3.0], ALT,
    'Hold the bell at the chest. | Step back, back knee just off the floor. | Drive up through the front foot. Alternate.',
    [noGear('reverse-lunge'), similar('goblet-squat')]),
  mv('goblet-squat', 'Goblet Squats', 'goblet squats', 'squat', 'bell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold the bell at the chest, elbows in. | Sit between the knees, chest up. | Stand tall.',
    [noGear('air-squat'), harder('kb-front-squat')]),
  mv('kb-front-squat', 'Kettlebell Front Squats', 'front squats', 'squat', 'bell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Bell in the rack, elbow tight to the ribs. | Sit down between the knees, chest tall. | Drive up without letting the bell pull you forward.',
    [easier('goblet-squat'), noGear('air-squat')]),
  mv('db-power-clean', 'Dumbbell Power Cleans', 'power cleans', 'clean', 'db', 'reps', [2.5, 3.0, 4.0], NONE,
    'Two dumbbells (or kettlebells) at the hang outside the knees. | Jump the hips, shrug, pull them to the shoulders. | Catch in a quarter squat and stand tall.',
    [similar('bb-power-clean')]),

  // ── barbell ───────────────────────────────────────────────────────────────
  mv('bb-deadlift', 'Deadlifts', 'deadlifts', 'hinge', 'barbell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Bar over mid-foot, shins to the bar. | Flat back, push the floor away. | Stand tall, then lower with the bar close.',
    [similar('bb-rdl'), noGear('backpack-rdl')]),
  mv('bb-rdl', 'Romanian Deadlifts', 'Romanian deadlifts', 'hinge', 'barbell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Start standing, soft knees. | Push the hips back; the bar slides down the thighs. | Stop when the back wants to round, then stand up.',
    [similar('bb-deadlift'), noGear('backpack-rdl')]),
  mv('bb-bent-over-row', 'Bent-Over Rows', 'rows', 'pull', 'barbell', 'reps', [1.75, 2.0, 2.5], NONE,
    'Hinge to about 45 degrees, flat back. | Pull the bar to the belly button. | Lower all the way.',
    [similar('bb-dead-stop-row'), noGear('backpack-row')]),
  mv('bb-dead-stop-row', 'Dead-Stop Barbell Rows', 'dead-stop rows', 'pull', 'barbell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Bar on the floor, back flat and close to level. | Pull it hard to the lower chest. | Set it down dead on the floor every rep.',
    [similar('bb-bent-over-row')]),
  mv('bb-front-squat', 'Front Squats', 'front squats', 'squat', 'barbell', 'reps', [2.25, 2.75, 3.25], NONE,
    'Bar on the front of the shoulders, elbows high. | Sit straight down, chest tall. | Clean it up on rep 1, or take it from a rack.',
    [easier('plate-goblet-squat'), similar('bb-back-squat')]),
  mv('plate-goblet-squat', 'Plate Goblet Squats', 'plate goblet squats', 'squat', 'plate', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold a plate at the chest. | Sit between the knees, chest up.',
    [harder('bb-front-squat'), noGear('air-squat'), easier('bench-squat')]),
  mv('bb-back-squat', 'Back Squats', 'back squats', 'squat', 'barbell', 'reps', [2.25, 2.75, 3.25], NONE,
    'Bar on the upper back, hands just outside the shoulders. | Sit to parallel, knees out. | Drive up, chest up.',
    [easier('bb-front-rack-lunge', { x: 2, stop: 'Sore shoulders?' }), similar('bb-front-squat')]),
  mv('bb-front-rack-lunge', 'Front-Rack Reverse Lunges', 'front-rack lunges', 'lunge', 'barbell', 'reps', [2.5, 3.0, 3.5], ALT,
    'Bar in the front rack. | Step back, knee just off the floor. | Drive up. Alternate legs.',
    [similar('bb-back-squat', { x: 0.5 })]),
  mv('bb-push-press', 'Push Press', 'push presses', 'press', 'barbell', 'reps', [1.75, 2.25, 2.75], { say1: 'push press' },
    'Bar in the front rack. | Short dip at the knees, drive up hard. | Press to lockout, head through.',
    [similar('bb-strict-press'), harder('bb-push-jerk'), noGear('pike-push-up')]),
  mv('bb-strict-press', 'Strict Press', 'strict presses', 'press', 'barbell', 'reps', [2.0, 2.5, 3.0], { say1: 'strict press' },
    'Bar in the front rack, glutes tight. | Press straight up, no knee dip. | Head through at the top.',
    [easier('bb-push-press'), noGear('pike-push-up')]),
  mv('bb-power-clean', 'Power Cleans', 'power cleans', 'clean', 'barbell', 'reps', [3.0, 4.0, 5.0], NONE,
    'Bar over mid-foot, flat back. | Push the floor, then jump and shrug. | Pull under and catch on the shoulders in a quarter squat. Never been coached on the clean? Use dumbbells.',
    [easier('db-power-clean'), similar('bb-hang-power-clean')]),
  mv('bb-hang-power-clean', 'Hang Power Cleans', 'hang power cleans', 'clean', 'barbell', 'reps', [2.5, 3.0, 4.0], NONE,
    'Bar at the hips, soft knees. | Dip, jump, shrug and pull under. | Catch on the shoulders, stand tall.',
    [easier('bb-hang-muscle-clean', { stop: 'Never been coached?' }), similar('bb-power-clean')]),
  mv('bb-hang-muscle-clean', 'Hang Muscle Cleans', 'hang muscle cleans', 'clean', 'barbell', 'reps', [2.5, 3.0, 3.5], NONE,
    'Bar at the hips. | Pull high and turn the elbows over with no dip under. | Bar on the shoulders, stand tall.',
    [easier('bb-high-pull'), harder('bb-hang-power-clean')]),
  mv('bb-clean-press', 'Clean and Press', 'clean and presses', 'clean', 'barbell', 'reps', [3.5, 4.5, 5.5], NONE,
    'Clean the bar to the shoulders. | Reset your feet, then press it overhead. | Lower to the shoulders, then the hips.',
    [easier('bb-muscle-clean-press')]),
  mv('bb-muscle-clean-press', 'Muscle Clean and Strict Press', 'muscle clean and presses', 'clean', 'barbell', 'reps', [3.5, 4.5, 5.5], NONE,
    'Deadlift the bar to the hips. | Muscle it to the shoulders with no dip, then strict-press. | Lower with control.',
    [harder('bb-clean-press')]),

  // ── the SOLO-only missions (HONOR ROUNDS → HOT LAPS) ──────────────────────
  // Every cadence here is a COACH ESTIMATE except CHARGE UP 12's devil press
  // and burpee-over (its researched pace cars; the beginner's 9 s press is
  // held at the count's 6 s ceiling). Get-ups and the run are never counted
  // (manual): estMs is one rep (one metre) for the estimates.
  // barbell
  mv('bb-push-jerk', 'Push Jerks', 'push jerks', 'press', 'barbell', 'reps', [1.75, 2.25, 2.75], { say1: 'push jerk' },
    'Bar in the front rack, elbows up. | Dip, drive, then push yourself under the bar into a quarter squat, arms locked. | Stand tall before the next rep.',
    [easier('bb-push-press', { stop: 'Never been coached?' }), similar('bb-strict-press')]),
  mv('bb-clean-jerk', 'Clean and Jerks', 'clean and jerks', 'clean', 'barbell', 'reps', [4.0, 5.0, 6.0], { say1: 'clean and jerk' },
    'Clean the bar to the shoulders and stand tall. | Dip and drive it overhead, press or jerk. | Lower to the shoulders, then the hips. Bumper plates if you drop it.',
    [easier('bb-hang-clean-push-press', { stop: 'Never been coached?' }), similar('bb-clean-press')]),
  mv('bb-hang-clean-push-press', 'Hang Power Clean + Push Press', 'hang cleans and push presses', 'clean', 'barbell', 'reps', [4.0, 5.0, 6.0], NONE,
    'Bar at the hips, soft knees. | Hang power clean to the shoulders, then push-press it overhead. | One of each is one rep. Singles are fine.',
    [easier('bb-muscle-clean-press'), harder('bb-clean-jerk')]),
  mv('bb-ground-to-overhead', 'Ground-to-Overheads', 'ground-to-overheads', 'clean', 'barbell', 'reps', [3.5, 4.5, 5.5], { say1: 'ground-to-overhead' },
    'Floor to locked out overhead, any way you like. | Clean and jerk, or clean and press. Snatch only if you are trained in it. | Feet and hips together at the top.',
    [easier('bb-g2oh-three-step', { stop: 'Never been coached?' }), similar('bb-clean-press'), similar('bb-clean-jerk')]),
  mv('bb-g2oh-three-step', 'Three-Step Ground-to-Overheads', 'three-step ground-to-overheads', 'clean', 'barbell', 'reps', [5.0, 5.5, 6.0], NONE,
    'Deadlift the bar to the hips. | Hang muscle clean it to the shoulders, no dip under. | Push-press it overhead. Three clean steps.',
    [easier('plate-ground-to-overhead'), harder('bb-ground-to-overhead'), similar('bb-muscle-clean-press')]),
  mv('bar-facing-burpee', 'Bar-Facing Burpees', 'bar-facing burpees', 'burpee', 'barbell', 'reps', [3.5, 4.0, 5.0], { jumps: true },
    'Chest to the floor, facing the bar. | Up, then a two-foot jump over the bar. | Land soft and face the bar for the next one.',
    [easier('bar-step-over-burpee', { stop: 'Clipping the bar?' }), easier('step-back-burpee'), noGear('burpee')]),
  mv('bar-step-over-burpee', 'Step-Over Burpees', 'step-over burpees', 'burpee', 'barbell', 'reps', [4.0, 4.5, 5.5], NONE,
    'Chest to the floor, facing the bar. | Stand, then step over the bar one foot at a time. No jump. | Face the bar for the next one.',
    [easier('step-back-burpee'), harder('bar-facing-burpee')]),
  mv('bb-thruster', 'Thrusters', 'thrusters', 'squat', 'barbell', 'reps', [2.0, 2.5, 3.0], { say1: 'thruster' },
    'Bar in the front rack, elbows up. | Front squat down, then drive up and press it overhead in one move. | Back arching on the press? Split it: a front squat, then a push press.',
    [easier('bb-front-squat-push-press', { stop: 'Back arching on the press?' }), similar('db-thruster'), noGear('air-squat')]),
  mv('bb-front-squat-push-press', 'Front Squat + Push Press', 'front squats and push presses', 'squat', 'barbell', 'reps', [3.5, 4.0, 4.5], NONE,
    'Front squat and stand all the way up. | Reset, then push-press the bar overhead. | One of each is one rep.',
    [harder('bb-thruster'), similar('db-thruster')]),
  mv('bb-zercher-squat', 'Zercher Squats', 'Zercher squats', 'squat', 'barbell', 'reps', [2.25, 2.75, 3.25], NONE,
    'Deadlift the bar, quarter-squat to rest it on your thighs, then scoop the elbows under it. Hands together. | Sit straight down between the knees, chest up. | No rack needed. Have one? Back squats work too.',
    [easier('plate-goblet-squat'), similar('bb-back-squat'), noGear('air-squat')]),

  // the lighter rungs under the bar (empty-bar beginners still get a swap down)
  mv('bb-high-pull', 'High Pulls', 'high pulls', 'clean', 'barbell', 'reps', [2.0, 2.5, 3.0], { say1: 'high pull' },
    'Bar at the hips, soft knees, hands just outside the thighs. | Jump the hips and shrug, then pull the elbows high and out. The bar stays close. | No catch: lower it back to the hips.',
    [harder('bb-hang-muscle-clean'), harder('bb-hang-power-clean')]),
  mv('plate-ground-to-overhead', 'Plate Ground-to-Overheads', 'plate ground-to-overheads', 'clean', 'plate', 'reps', [2.5, 3.0, 3.5], { say1: 'plate ground-to-overhead' },
    'A plate flat on the floor. Squat down and grab it by the edges, flat back. | Stand and press it overhead, arms locked, ribs down. | Lower it to the chest, then the floor.',
    [harder('bb-g2oh-three-step'), harder('bb-ground-to-overhead')]),
  mv('pike-push-up', 'Pike Push-Ups', 'pike push-ups', 'press', 'none', 'reps', [2.0, 2.5, 3.0], { say1: 'pike push-up' },
    'Hands and feet on the floor, hips high in an upside-down V. | Bend the elbows and lower the top of the head between the hands. | Press back up. Knees bent is fine.',
    [easier('incline-push-up'), harder('bb-strict-press')]),

  // kettlebell / dumbbell
  mv('kb-one-arm-swing', 'One-Arm Swings', 'one-arm swings', 'hinge', 'bell', 'reps', [1.5, 1.75, 2.25], NONE,
    'One hand on the bell, hike it back between the legs. | Snap the hips; the bell floats to chest height. Shoulders square, no twist. | Switch arms every set.',
    [easier('kb-swing'), similar('db-one-arm-swing')]),
  mv('db-one-arm-swing', 'One-Arm Dumbbell Swings', 'one-arm dumbbell swings', 'hinge', 'db', 'reps', [1.5, 1.75, 2.25], NONE,
    'Hold one dumbbell by the head. | Same hip snap, to chest height. | Switch arms every set.',
    [similar('kb-one-arm-swing'), easier('db-swing')]),
  mv('kb-american-swing', 'American Swings', 'American swings', 'hinge', 'bell', 'reps', [1.75, 2.0, 2.5], NONE,
    'The same hip snap as a swing to eye level. | Let the bell float all the way overhead, arms straight, ribs down. | Never been coached? Stop at eye level.',
    [easier('kb-swing', { stop: 'Never been coached?' }), similar('db-swing')]),
  mv('kb-turkish-get-up', 'Weighted Turkish Get-Up', 'get-ups', 'core', 'bell', 'reps', null, { estMs: 30000, say1: 'get-up' },
    'Bell locked out over the shoulder, eyes on it the whole way. | Roll to the elbow, the hand, bridge, sweep the leg, stand. | Reverse every step to the floor. Never rush.',
    [easier('half-get-up', { stop: 'Shoulder pain?' }), easier('bw-turkish-get-up'), similar('db-turkish-get-up')]),
  mv('db-turkish-get-up', 'Dumbbell Turkish Get-Up', 'dumbbell get-ups', 'core', 'db', 'reps', null, { estMs: 30000, say1: 'dumbbell get-up' },
    'A light dumbbell locked out over the shoulder, wrist straight. | The same steps up and back down, eyes on the bell.',
    [similar('kb-turkish-get-up'), easier('bw-turkish-get-up')]),
  mv('bw-turkish-get-up', 'Turkish Get-Up', 'get-ups', 'core', 'none', 'reps', null, { estMs: 25000, say1: 'get-up' },
    'No weight: balance a shoe on the fist. | The same steps up and back down, arm locked, eyes on the shoe. | Smooth every step before you add a bell.',
    [easier('half-get-up'), harder('kb-turkish-get-up')]),
  mv('half-get-up', 'Half Turkish Get-Up', 'half get-ups', 'core', 'none', 'reps', null, { estMs: 15000, say1: 'half get-up' },
    'No weight, arm locked to the ceiling. | Roll to the elbow, then up to the hand. | Reverse back to the floor, slowly.',
    [harder('bw-turkish-get-up'), harder('kb-turkish-get-up')]),
  mv('db-rdl', 'Dumbbell Romanian Deadlifts', 'Romanian deadlifts', 'hinge', 'db', 'reps', [2.0, 2.5, 3.0], NONE,
    'One dumbbell or kettlebell in both hands, soft knees. | Push the hips back; the bell slides down the thighs. | Stop when the back wants to round, then stand tall.',
    [noGear('backpack-rdl'), similar('bb-rdl')]),
  mv('backpack-rdl', 'Backpack Deadlifts', 'backpack deadlifts', 'hinge', 'none', 'reps', [2.0, 2.5, 3.0], NONE,
    'A backpack of water bottles or books, about 8-10 kg, held in front. | Hips back, flat back, then stand tall.',
    [harder('db-rdl'), easier('glute-bridge')]),
  mv('backpack-row', 'Backpack Rows', 'backpack rows', 'pull', 'none', 'reps', [1.75, 2.0, 2.5], SW,
    'A loaded backpack, about 8-10 kg, by the top handle in one hand. | Brace the other hand on the bed or the desk, flat back. | Pull it to the hip, lower all the way. All on one side, then switch.',
    [harder('db-row'), harder('kb-row'), harder('bb-bent-over-row')]),
  mv('kb-goblet-thruster', 'Goblet Thrusters', 'goblet thrusters', 'squat', 'bell', 'reps', [2.0, 2.5, 3.0], { say1: 'goblet thruster' },
    'Bell or dumbbell at the chest, elbows in. | Squat, then drive up and press it overhead in one move. | Lower it to the chest as you sit into the next rep.',
    [easier('goblet-squat'), noGear('air-squat')]),
  mv('dead-bug', 'Dead Bugs', 'dead bugs', 'core', 'none', 'reps', [2.5, 3.0, 3.5], { sides: 'alternate', sideWord: 'side' },
    'On your back, arms to the ceiling, knees over the hips. | Ribs down, low back flat. Lower the opposite arm and leg slowly. | Back to the middle, then the other side.',
    [harder('kb-dead-bug'), harder('backpack-dead-bug')]),
  mv('kb-dead-bug', 'Kettlebell Dead Bugs', 'dead bugs', 'core', 'bell', 'reps', [3.0, 3.5, 4.0], { sides: 'alternate', sideWord: 'side' },
    'On your back, the bell pressed over the chest, knees over the hips. | Ribs down, low back flat. Lower one leg slowly toward the floor. | Bring it back and switch legs.',
    [noGear('dead-bug'), noGear('backpack-dead-bug')]),
  mv('backpack-dead-bug', 'Backpack Dead Bugs', 'backpack dead bugs', 'core', 'none', 'reps', [3.0, 3.5, 4.0], { sides: 'alternate', sideWord: 'side' },
    'On your back, a loaded backpack held over the chest, knees over the hips. | Ribs down, low back flat. Lower one leg slowly. | Bring it back and switch legs.',
    [easier('dead-bug'), harder('kb-dead-bug')]),
  mv('kb-suitcase-deadlift', 'Suitcase Deadlifts', 'suitcase deadlifts', 'hinge', 'bell', 'reps', [2.0, 2.5, 3.0], SW,
    'Bell on the floor beside one foot. | Hips back, flat back, grab it and stand tall without leaning. | All on one side, then switch.',
    [noGear('backpack-suitcase-deadlift'), similar('db-rdl')]),
  mv('backpack-suitcase-deadlift', 'Backpack Suitcase Deadlifts', 'backpack suitcase deadlifts', 'hinge', 'none', 'reps', [2.0, 2.5, 3.0], SW,
    'A loaded backpack by one strap, beside one foot. | Hips back, flat back, stand tall without leaning. | All on one side, then switch.',
    [harder('kb-suitcase-deadlift'), similar('backpack-rdl')]),
  mv('kb-plank-pull-through', 'Plank Pull-Throughs', 'pull-throughs', 'core', 'bell', 'reps', [2.0, 2.5, 3.0], { sides: 'alternate', sideWord: 'side' },
    'High plank, feet wide, the bell beside one hand. | Reach under and drag it to the other side without twisting the hips. | Alternate hands.',
    [easier('kb-knee-pull-through'), noGear('backpack-pull-through')]),
  mv('kb-knee-pull-through', 'Knee Plank Pull-Throughs', 'knee plank pull-throughs', 'core', 'bell', 'reps', [2.0, 2.5, 3.0], { sides: 'alternate', sideWord: 'side' },
    'Plank on the knees, hips in line, the bell beside one hand. | Drag it under to the other side. Hips stay square. | Alternate hands.',
    [harder('kb-plank-pull-through'), noGear('backpack-pull-through')]),
  mv('backpack-pull-through', 'Backpack Pull-Throughs', 'backpack pull-throughs', 'core', 'none', 'reps', [2.0, 2.5, 3.0], { sides: 'alternate', sideWord: 'side' },
    'High plank, a loaded backpack beside one hand. | Drag it under to the other side without twisting. | Knees down if the hips sag.',
    [harder('kb-plank-pull-through'), similar('kb-knee-pull-through')]),
  mv('kb-halo', 'Kettlebell Halos', 'halos', 'core', 'bell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold the bell upside down by the horns at the chest. | Circle it slowly around the head, close to the neck. | Ribs down, glutes tight. Half one way, half the other.',
    [noGear('backpack-halo'), similar('db-halo')]),
  mv('db-halo', 'Dumbbell Halos', 'dumbbell halos', 'core', 'db', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold one dumbbell upright by the head, at the chest. | Circle it slowly around the head, close to the neck. | Ribs down. Half one way, half the other.',
    [similar('kb-halo'), noGear('backpack-halo')]),
  mv('backpack-halo', 'Backpack Halos', 'backpack halos', 'core', 'none', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold a loaded backpack by the top handle at the chest. | Circle it slowly around the head. | Ribs down. Half one way, half the other.',
    [harder('kb-halo'), harder('db-halo')]),
  mv('kb-bulgarian-split-squat', 'Goblet Bulgarian Split Squats', 'split squats', 'lunge', 'bell', 'reps', [2.5, 3.0, 3.5], SW,
    'Rear foot on the bed edge or a wall-braced sofa, never a rolling chair. | Bell at the chest, sink straight down. | All on one leg, then switch.',
    [easier('split-squat'), noGear('bulgarian-split-squat')]),
  mv('split-squat', 'Split Squats', 'split squats', 'lunge', 'none', 'reps', [2.0, 2.5, 3.0], SW,
    'Long stance, back foot on the floor, a hand on the wall. | Lower the back knee toward the floor, front shin upright. | All on one leg, then switch.',
    [harder('bulgarian-split-squat'), harder('kb-bulgarian-split-squat')]),
  mv('db-hip-thrust', 'Dumbbell Hip Thrusts', 'hip thrusts', 'hinge', 'db', 'reps', [2.0, 2.5, 3.0], NONE,
    'Shoulders on the bed edge, the dumbbell on the hips over a towel. | Drive through the heels until the hips are level with the knees. | Squeeze a second, lower with control.',
    [noGear('glute-bridge'), easier('hip-thrust')]),
  mv('hip-thrust', 'Hip Thrusts', 'hip thrusts', 'hinge', 'none', 'reps', [1.75, 2.25, 2.75], NONE,
    'Shoulders on the bed edge, no weight, feet flat. | Drive through the heels until the hips are level with the knees. | Squeeze a second, lower with control.',
    [harder('db-hip-thrust'), easier('glute-bridge')]),
  mv('glute-bridge', 'Glute Bridges', 'glute bridges', 'hinge', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'On your back, knees bent, feet flat. | Drive the hips up until the body is one line from the knees. | Squeeze, then lower slowly.',
    [harder('hip-thrust'), harder('db-hip-thrust')]),
  mv('kb-lateral-lunge', 'Goblet Lateral Lunges', 'lateral lunges', 'lunge', 'bell', 'reps', [2.25, 2.75, 3.25], ALT,
    'Bell at the chest, feet wide. | Sit back into one hip, that knee over the toes, the other leg straight. | Push back to the middle. Alternate.',
    [noGear('lateral-lunge'), similar('kb-reverse-lunge')]),
  mv('lateral-lunge', 'Lateral Lunges', 'lateral lunges', 'lunge', 'none', 'reps', [2.0, 2.5, 3.0], ALT,
    'Feet wide, hands at the chest. | Sit back into one hip, the other leg straight. | Push back to the middle. Alternate.',
    [harder('kb-lateral-lunge'), similar('reverse-lunge')]),
  mv('db-devil-press', 'Devil Presses', 'devil presses', 'burpee', 'db', 'reps', [4.0, 6.0, 6.0], { say1: 'devil press' },
    'Hand on the bell, chest to the floor, then up with a flat back. | Swing it through and punch it overhead. Switch hands every rep. | Bring it to the shoulder, then the floor. Never drop it from overhead.',
    [noGear('burpee'), noGear('backpack-devil-press'), easier('db-hang-clean-press', { stop: 'Low-back pain?' }), harder('double-db-devil-press')]),
  mv('double-db-devil-press', 'Double Devil Presses', 'double devil presses', 'burpee', 'db', 'reps', [4.5, 6.0, 6.0], { say1: 'double devil press' },
    'A second dumbbell: one in each hand. | Chest down, up with a flat back, both bells overhead in one swing. | Shoulders, then the floor.',
    [easier('db-devil-press'), easier('db-hang-clean-press')]),
  mv('backpack-devil-press', 'Backpack Devil Presses', 'backpack devil presses', 'burpee', 'none', 'reps', [4.0, 5.0, 6.0], { say1: 'backpack devil press' },
    'A loaded backpack by the top handle. | Chest down, up, then swing it overhead. | Lower it to the chest, then the floor.',
    [harder('db-devil-press'), similar('burpee')]),
  mv('db-hang-clean-press', 'Dumbbell Hang Clean & Press', 'hang clean and presses', 'clean', 'db', 'reps', [3.0, 3.5, 4.0], { say1: 'hang clean and press' },
    'Dumbbell at the hang, outside the knee. | Pop the hips, clean it to the shoulder, press it overhead. | No burpee, no pull from the floor. Switch hands every rep.',
    [harder('db-devil-press'), noGear('backpack-devil-press')]),
  mv('db-lateral-burpee-over', 'Burpees Over the Bell', 'burpees over the bell', 'burpee', 'db', 'reps', [3.0, 4.5, 6.0], { jumps: true },
    'A hex dumbbell on its side, lengthwise to you. A kettlebell? Jump a line beside it. | Chest down beside the bell, up, two-foot jump over it. | Land soft, drop on the other side.',
    [noGear('lateral-burpee', { stop: 'Feet clipping the bell?' }), easier('step-back-burpee', { stop: 'Knee pain?' }), easier('squat-thrust')]),
  mv('lateral-burpee', 'Lateral Burpees', 'lateral burpees', 'burpee', 'none', 'reps', [3.0, 4.0, 5.0], { jumps: true },
    'Chest down beside a line on the floor. | Up, then a two-foot jump over the line. | Land soft, drop on the other side.',
    [easier('step-back-burpee'), harder('db-lateral-burpee-over')]),

  // mixed: bar and bells, a pull-up bar, a run
  mv('db-thruster', 'Dumbbell Thrusters', 'dumbbell thrusters', 'squat', 'db', 'reps', [2.0, 2.5, 3.0], { say1: 'dumbbell thruster' },
    'Two dumbbells at the shoulders, elbows up. | Squat, then drive up and press them overhead in one move. | Lower to the shoulders as you sit into the next rep.',
    [similar('bb-thruster'), noGear('air-squat')]),
  mv('pull-up', 'Pull-Ups', 'pull-ups', 'pull', 'bar', 'reps', [2.0, 2.5, 3.5], { say1: 'pull-up' },
    'Dead hang, hands just outside the shoulders. | Pull the chin over the bar, then lower all the way. | Kip only if you already can: learning it tired is how shoulders get hurt.',
    [easier('jumping-pull-up'), easier('ring-row'), similar('db-bent-over-row'), similar('db-row')]),
  mv('jumping-pull-up', 'Jumping Pull-Ups', 'jumping pull-ups', 'pull', 'bar', 'reps', [2.0, 2.5, 3.0], { say1: 'jumping pull-up' },
    'A bar low enough to stand under, or a box beneath it. | Jump and pull the chin over the bar. | Lower slowly: the way down does the work.',
    [harder('pull-up'), similar('ring-row'), similar('db-bent-over-row'), similar('db-row')]),
  mv('ring-row', 'Ring Rows', 'ring rows', 'pull', 'bar', 'reps', [2.0, 2.5, 3.0], { say1: 'ring row' },
    'Rings or a sturdy low bar, body in one line. | Pull the chest to the hands, then lower all the way. | Never row under a table: it can tip.',
    [harder('pull-up'), similar('jumping-pull-up'), similar('db-bent-over-row'), similar('db-row')]),
  mv('db-bent-over-row', 'Dumbbell Bent-Over Rows', 'dumbbell rows', 'pull', 'db', 'reps', [1.75, 2.0, 2.5], NONE,
    'A dumbbell in each hand, hinge to about 45 degrees, flat back. | Pull both to the hips. | Lower all the way.',
    [easier('db-row'), harder('pull-up')]),
  mv('run', 'Run', 'metres on the run', 'cardio', 'none', 'm', null, { repsOnly: true, estMs: 375 },
    'Outside or on a treadmill. | Hard but steady: there is work waiting at the end. | Tap DONE when the distance is done.',
    [similar('row-cal', { x: 0.0625 }), noGear('high-knees', { x: 0.5 })]), // 400 m ≈ 25 cal on the rower ≈ 200 high knees
  mv('high-knees', 'High Knees', 'high knees', 'cardio', 'none', 'reps', [0.5, 0.6, 0.75], ALT,
    'Run in place, knees to hip height. | Light on the balls of the feet, arms driving. | Count each leg.',
    [easier('standing-knee-drive'), similar('mountain-climber')]),

  // ── the owner's three (BAR FIGHT, TOUCH THE SKY, NO CONTINUES) ───────────
  // Coach TM originals. Every cadence here is a COACH ESTIMATE. The bar
  // drills are speed work with a light bar: core braced, shoulders down, the
  // elbows never snapped straight. No existing move's alts changed, so no
  // earlier mission's swaps did either.
  // barbell: BAR FIGHT
  mv('bb-punch-out', 'Explosive Front Presses', 'explosive front presses', 'punch', 'barbell', 'reps', [1.0, 1.25, 1.5], { say1: 'explosive front press' },
    "Light bar at the chest, overhand grip, elbows tucked. | Punch it straight out fast, then snap it back to the chest. | Stagger the feet. Don't lean back to hold the bar out. | Core braced, shoulders down. Never lock the elbows hard.",
    [easier('plate-punch-out'), noGear('one-two', { stop: 'Shoulder pinch?' })]),
  mv('plate-punch-out', 'Plate Punch-Outs', 'plate punch-outs', 'punch', 'plate', 'reps', [1.0, 1.25, 1.5], { say1: 'plate punch-out' },
    'Hold a light plate by the edges at the chest. | Punch it straight out fast, then snap it back. | Core braced, shoulders down.',
    [harder('bb-punch-out'), noGear('one-two')]),
  mv('bb-explosive-press', 'Explosive Overhead Presses', 'explosive overhead presses', 'press', 'barbell', 'reps', [1.5, 1.75, 2.0], { say1: 'explosive overhead press' },
    'Bar on the front of the shoulders, elbows just ahead of the bar. | Dip and drive with the legs like a jump, and punch the bar overhead. | Ribs down at the top, then straight back to the shoulders. | Soft knees to catch it on the shoulders.',
    [easier('plate-push-press'), similar('bb-push-press'), noGear('pike-push-up')]),
  mv('plate-push-press', 'Plate Push Presses', 'plate push presses', 'press', 'plate', 'reps', [1.5, 1.75, 2.0], { say1: 'plate push press' },
    'Hold a plate by the edges at the chest. | Dip and drive with the legs, and punch it overhead. | Ribs down, then back to the chest.',
    [harder('bb-explosive-press'), noGear('pike-push-up')]),
  mv('bb-uppercut', 'Barbell Uppercuts', 'barbell uppercuts', 'punch', 'barbell', 'reps', [1.25, 1.5, 2.0], { say1: 'barbell uppercut' },
    'Light bar at the chest, underhand grip, hands narrow. | Turn the hip and drive the bar up and out in an uppercut path, to chin height. | Back to the chest, then turn the other hip. Core braced.',
    [easier('plate-uppercut'), noGear('alt-uppercut')]),
  mv('plate-uppercut', 'Plate Uppercuts', 'plate uppercuts', 'punch', 'plate', 'reps', [1.25, 1.5, 2.0], { say1: 'plate uppercut' },
    'Hold a light plate by the edges at the chest. | Turn the hip and drive it up and out to chin height. | Alternate the hip turn. Core braced.',
    [harder('bb-uppercut'), noGear('alt-uppercut')]),
  mv('alt-uppercut', 'Uppercuts', 'uppercuts', 'punch', 'none', 'reps', [0.9, 1.0, 1.25], { sides: 'alternate', sideWord: 'side', say1: 'uppercut' },
    'Stance, hands up, knees soft. | Dip, turn the hip and drive the fist up to chin height. | Hand back to the chin. Alternate sides.',
    [similar('one-two'), harder('plate-uppercut'), harder('bb-uppercut')]),
  mv('bb-explosive-front-squat', 'Explosive Front Squats', 'explosive front squats', 'squat', 'barbell', 'reps', [1.75, 2.0, 2.5], { say1: 'explosive front squat' },
    'Bar in the front rack, elbows high. | Sit down under control, then drive up fast onto the toes. | Heels back down, chest tall. No hop below ELITE.',
    [easier('plate-goblet-squat'), similar('bb-front-squat'), harder('bb-front-squat-hop'), noGear('air-squat')]),
  mv('bb-front-squat-hop', 'Front Squat Hops', 'front squat hops', 'squat', 'barbell', 'reps', [2.0, 2.25, 2.5], { jumps: true, say1: 'front squat hop' },
    'The same explosive front squat, then a small hop off the toes. | Elbows high, the bar stays on the shoulders. | Land soft and quiet into the next rep.',
    [easier('bb-explosive-front-squat'), noGear('jump-squat')]),
  mv('explosive-shadowbox', 'Explosive Shadowboxing', 'explosive shadowboxing', 'punch', 'none', 'secs', null, { timedOnly: true },
    'Set the bar down first and step away from it. | Fast 1-2s, hooks and uppercuts, full speed, hands back to the chin. | Keep the feet moving. Never snap the elbow straight.',
    [easier('air-boxing'), similar('one-two'), harder('bag-speed-punches')]),
  // barbell: TOUCH THE SKY
  mv('bb-front-rack-good-morning', 'Front-Rack Good Mornings', 'good mornings', 'hinge', 'barbell', 'reps', [2.5, 3.0, 3.5], { say1: 'good morning' },
    'The bar stays in the front rack, elbows up. | Soft knees, push the hips back, chest up, back flat. Stop at about 45 degrees. | Low back rounding? Stop the round and set the bar down.',
    [easier('bb-rdl', { stop: 'Low back rounding?' }), noGear('backpack-rdl')]),
  // kettlebell: NO CONTINUES (none of them sets the bell down)
  mv('kb-two-hand-row', 'Two-Hand Rows', 'two-hand rows', 'pull', 'bell', 'reps', [1.75, 2.0, 2.5], { say1: 'two-hand row' },
    'Both hands on the handle, hinge to about 45 degrees, back flat. | Row the bell to the belly button, elbows back. | Lower it to arm length. It never touches the floor.',
    [similar('db-row'), noGear('backpack-row')]),
  mv('kb-two-hand-high-pull', 'Two-Hand High Pulls', 'two-hand high pulls', 'clean', 'bell', 'reps', [1.75, 2.0, 2.5], { say1: 'two-hand high pull' },
    'Both hands on the handle. Hike it back like a swing. | Snap the hips, then pull the elbows high and wide. The bell stops at the chest. | Let it fall back into the next hike.',
    [easier('db-rdl'), similar('kb-one-arm-high-pull'), noGear('backpack-rdl')]),
  mv('kb-horn-press', 'Two-Hand Presses', 'two-hand presses', 'press', 'bell', 'reps', [2.0, 2.5, 3.0], { say1: 'two-hand press' },
    'Hold the bell by the horns at the chest, elbows in. | Press it straight up, biceps by the ears, glutes tight. | No leaning back. Lower to the chest under control.',
    [easier('kb-halo'), similar('db-press'), noGear('pike-push-up')]),
  mv('kb-snatch', 'Kettlebell Snatches', 'snatches', 'clean', 'bell', 'reps', [1.75, 2.25, 2.75], { say1: 'snatch' },
    'Hike the bell back, snap the hips, and pull it close up the body. | Punch the hand through at the top so it lands soft on the forearm, arm locked. | Drop it back into the hike. Bell banging the wrist? High pulls.',
    [easier('kb-one-arm-high-pull', { stop: 'Bell banging the wrist?' }), easier('kb-clean'), similar('db-snatch')]),
  mv('db-snatch', 'Dumbbell Snatches', 'dumbbell snatches', 'clean', 'db', 'reps', [1.75, 2.25, 2.75], { say1: 'dumbbell snatch' },
    'Dumbbell at the hang between the knees, back flat. | Jump the hips, pull it close, and punch it overhead, arm locked. | Lower it to the shoulder, then the hang.',
    [similar('kb-snatch'), easier('kb-one-arm-high-pull')]),
  mv('kb-one-arm-high-pull', 'One-Arm High Pulls', 'one-arm high pulls', 'clean', 'bell', 'reps', [1.75, 2.0, 2.5], { say1: 'one-arm high pull' },
    'One hand on the bell. Hike it back like a swing. | Snap the hips, then pull the elbow high and back. The bell stops at the chest. | Let it fall back into the next hike.',
    [easier('db-rdl'), harder('kb-snatch'), noGear('backpack-rdl')]),

  // ── UPPER LOWER DIPS and OVERTIME 20 ──────────────────────────────────────
  // Every dip stops at 90° at the elbow. A shoulder pinch is the stop rule:
  // incline push-ups, offered first on every dip row. NO GEAR: a fixed bench,
  // a sturdy chair against a wall, or parallel bars. Coach estimates.
  mv('bench-dip-bent', 'Bent-Knee Bench Dips', 'bench dips', 'push', 'none', 'reps', [1.75, 2.0, 2.5], { say1: 'bench dip' },
    'Hands on the edge of a fixed bench, or a sturdy chair against a wall. Fingers forward. | Knees bent, feet flat, hips close to the edge. | Shoulders down and back, chest up. | Lower until the elbows reach 90°, no deeper. Press back up.',
    [easier('incline-push-up', { stop: 'Shoulder pinch?' }), harder('bench-dip')]),
  mv('bench-dip', 'Bench Dips', 'bench dips', 'push', 'none', 'reps', [1.75, 2.0, 2.5], { say1: 'bench dip' },
    'Hands on the edge of a fixed bench, or a sturdy chair against a wall. Fingers forward. | Legs out straight, heels down, hips close to the edge. | Shoulders down and back, chest up. | Lower until the elbows reach 90°, no deeper. Press back up.',
    [easier('incline-push-up', { stop: 'Shoulder pinch?' }), easier('bench-dip-bent'), harder('parallel-bar-dip')]),
  mv('parallel-bar-dip', 'Parallel-Bar Dips', 'dips', 'push', 'none', 'reps', [1.75, 2.25, 2.75], { say1: 'dip' },
    'A dip station or parallel bars only. Never between two chairs. | Straight arms, shoulders down. Lean a little forward and lower until the elbows reach 90°. No deeper. | Press back to straight arms.',
    [easier('incline-push-up', { stop: 'Shoulder pinch?' }), easier('bench-dip')]),
  // A no-bar pull. Only OVERTIME 20 offers it (its own extra alts), so no
  // other mission's swaps change.
  mv('door-frame-row', 'Door Frame Rows', 'door frame rows', 'pull', 'none', 'reps', [2.0, 2.5, 3.0], { say1: 'door frame row' },
    'A solid frame only. Never pull on the door itself. No vest on door frame rows. | A hand on each side at chest height, gripping with the whole hand, not the fingertips. | Start nearly upright and keep the lean shallow: if a hand slips, you fall backward. | Body in one line. Pull the chest to the frame, lower slowly.',
    [harder('jumping-pull-up'), harder('pull-up')]),

  // ── MAX OUT: the two moves the five max-rep workouts needed ───────────────
  // Coach estimates. Neither is listed as an alt by an older move, so no
  // earlier mission's swap sheet changed.
  mv('sit-up', 'Sit-Ups', 'sit-ups', 'core', 'none', 'reps', [1.5, 2.0, 2.5], NONE,
    'Feet flat, knees bent, hands crossed on the chest. | Curl all the way up to the knees, then lower slowly.',
    [easier('crunch'), harder('v-up')]),
  mv('db-floor-press', 'Dumbbell Floor Presses', 'floor presses', 'push', 'db', 'reps', [2.0, 2.5, 3.0], NONE,
    'Lie on the floor, a dumbbell in each hand, elbows at 45 degrees. | Press straight up, lower until the upper arms touch the floor.',
    [easier('push-up')]),
];

const BY_ID = new Map(MOVES.map(m => [m.id, m]));
// Test-only: fixture moves (a flying knee, a box move) the unit tests inject.
// Never listed in MOVES, so the catalog checks only ever see the real ones.
const TEST_MOVES = new Map();
export function _registerTestMoves(list) { (list || []).forEach(m => TEST_MOVES.set(m.id, m)); }

// ── catalog and doses ───────────────────────────────────────────────────────
export function moveById(id) { return BY_ID.get(id) || TEST_MOVES.get(id) || null; }
export function cadenceFor(moveId, level) {
  const m = moveById(moveId);
  const ms = m?.cadence?.[level];
  return typeof ms === 'number' ? ms : null;
}
export function estMsFor(moveId, level = 'standard') {
  const m = moveById(moveId);
  return m?.cadence?.[level] ?? m?.estMs ?? 2500;
}
export function secondsPhrase(n) { return n === 1 ? '1 second' : `${n} seconds`; }
export function spokenDuration(sec) {
  if (sec >= 60 && sec % 60 === 0) { const m = sec / 60; return m === 1 ? '1 minute' : `${m} minutes`; }
  return secondsPhrase(sec);
}
export function mmss(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const isTimed = (slot) => slot?.mode === 'timed';
const hasList = (slot) => Array.isArray(slot?.list);
// A slot is catalog-driven iff it names a catalog move or carries a step list.
// The runner relies on exactly this test.
export function isCatalogSlot(slot) { return typeof slot?.moveId === 'string' || hasList(slot); }

// The dose a v2 card prints: '20s', '3:00', '12 CAL', '10 (5/side)', '2 + 1 + 3'.
export function slotDose(slot) {
  if (!slot) return '';
  if (slot.max === true) return 'MAX'; // a MAX REPS station: no count, the athlete's own set
  if (isTimed(slot)) {
    if (hasList(slot)) return mmss(slot.work);
    return slot.work < 60 ? `${slot.work}s` : mmss(slot.work);
  }
  if (hasList(slot)) return slot.list.map(slotDose).join(' + ');
  const reps = slot.reps;
  let out = slot.unit ? `${reps} ${slot.unit}` : `${reps}`;
  if (slot.sides && reps % 2 === 0) out += slot.sides === 'switch' ? ` (${reps / 2}/side)` : ` (${reps / 2}/${moveById(slot.moveId)?.sideWord || 'leg'})`;
  return out;
}
// The ungated UP NEXT card: today's format plus the unit ('1 MILE', '10 reps', '60s').
export function legacyDose(ex) {
  if (!ex) return '';
  return isTimed(ex) ? `${ex.work}s` : `${ex.reps} ${ex.unit || 'reps'}`;
}

// ── speech building blocks ──────────────────────────────────────────────────
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const lower = (s) => String(s || '').toLowerCase();

// What the coach calls the move: '10 cleans', '1 press', 'mile run', 'sprawls'.
export function spokenMove(slot) {
  if (!slot) return '';
  if (hasList(slot)) return slot.say || (isTimed(slot) ? 'the AMRAP' : 'the complex');
  // A MAX REPS station is never counted: the move's word, with no number.
  if (slot.max === true) return slot.say || moveById(slot.moveId)?.say || lower(slot.name);
  const move = typeof slot.moveId === 'string' ? moveById(slot.moveId) : null;
  if (isTimed(slot)) return slot.say || move?.say || lower(slot.name);
  if (move) {
    if (move.unit === 'cal') return `${slot.reps} ${slot.say || move.say}`;
    const word = slot.say
      ? (slot.reps === 1 ? (slot.say1 || slot.say) : slot.say)
      : (slot.reps === 1 ? (move.say1 || move.say) : move.say);
    return `${slot.reps} ${word}`;
  }
  if (slot.unit) return lower(slot.name);
  return `${slot.reps} ${lower(slot.name)}`;
}
export function listSpoken(list) { return (list || []).map(spokenMove).join(', '); }
// Rough seconds to speak a line: 0.42 s a word, rounded up, plus a breath.
export function speechSeconds(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return Math.ceil(t.split(/\s+/).length * 0.42 + 0.5);
}
export function sameMove(a, b) {
  if (!a || !b) return false;
  return (a.moveId || a.name) === (b.moveId || b.name);
}
export function hasCallAt0(slot) { return slot?.calls?.some(c => c.t === 0) === true; }
export function isCounted(slot, { legacyCounted = false } = {}) {
  if (!slot) return false;
  return isCatalogSlot(slot) ? countBeats(slot) !== null : !!legacyCounted;
}

// ── lines ───────────────────────────────────────────────────────────────────
export function leadLine(slot, ctx = {}) {
  const { round = 1, idx = 0, rounds = 1, slotsPerRound = 1, format, legacyCounted = false } = ctx;
  const prefix = format === 'emom' ? `Minute ${(round - 1) * slotsPerRound + idx + 1}. `
    : idx === 0 && rounds > 1 ? `Round ${round}. ` : '';
  if (hasList(slot)) {
    if (isTimed(slot)) return `${prefix}${slot.sayLead || 'AMRAP'}. ${spokenDuration(slot.work)}. ${cap(listSpoken(slot.list))}.`;
    const side = slot.sideSay ? `${cap(slot.sideSay)}. ` : '';
    // A complex with a manual step is never counted, so it gets the manual line (no Drop A complex has one).
    const tail = isCounted(slot) ? 'Ready? On my count.' : MANUAL_LINE;
    return `${prefix}${cap(listSpoken(slot.list))}. ${side}${tail}`;
  }
  if (isTimed(slot)) return `${prefix}${cap(spokenMove(slot))}. ${spokenDuration(slot.work)}.`;
  if (slot.max === true) return `${prefix}${cap(spokenMove(slot))}. ${maxWord(slot)}`;
  if (isCounted(slot, { legacyCounted })) return `${prefix}${cap(spokenMove(slot))}. Ready? On my count.`;
  return `${prefix}${cap(spokenMove(slot))}. ${MANUAL_LINE}`;
}
// The start line when no lead or short line named this slot (after a chain or a tiny rest).
export function chainedLine(slot, { legacyCounted = false } = {}) {
  if (slot?.max === true) return `${cap(spokenMove(slot))}. ${maxWord(slot)} Go.`;
  if (isTimed(slot)) return `${cap(spokenMove(slot))}.${hasCallAt0(slot) ? '' : ' Go.'}`;
  if (isCounted(slot, { legacyCounted })) return `${cap(spokenMove(slot))}.`;
  return `${cap(spokenMove(slot))}. ${MANUAL_LINE}`;
}
export function shortRestLine(next) { return `Next: ${spokenMove(next)}.`; }
// A block that chains straight on from the last one in an until-the-bell-is-
// down mission (NO CONTINUES): 'Switch: left arm.'
export function switchLine(slot) { return `Switch: ${spokenMove(slot)}.`; }
// The same chain when the run counts rounds (UPPER LOWER DIPS): 'Round 4.'
export function roundLine(n) { return `Round ${n}.`; }
// A rest of 2:00 or more is said in minutes ('Rest. 2 minutes.'); a shorter
// one in seconds, as every mission before TOUCH THE SKY says it.
const restPhrase = (sec) => (sec >= 120 ? spokenDuration(sec) : secondsPhrase(sec));
export function restOpener({ restSec, roundEnd, completedRound, format, tip = null }) {
  const base = format !== 'emom' && roundEnd
    ? `Round ${completedRound} complete. Rest. ${restPhrase(restSec)}.`
    : `Rest. ${restPhrase(restSec)}.`;
  return tip ? `${base} ${tip}` : base;
}
// 'Swapped in: Knee Dive Bombers, Step-Back Sprawls.' for the intro, or null.
export function swappedInLine(mission) {
  const names = [];
  rowItems(mission).forEach(({ item }) => {
    if (item.moveId !== item.baseMoveId) {
      const name = moveById(item.moveId)?.name || item.name;
      if (!names.includes(name)) names.push(name);
    }
  });
  return names.length ? `Swapped in: ${names.join(', ')}.` : null;
}
// The card's row order: one slot or step per swapKey, first appearance across
// round 1 (slots, then the steps inside them). A list slot's own key never
// gets a row. → [{ item, parent }] (parent = the list slot of a step, or null).
export function rowItems(mission) {
  const seen = new Set();
  const out = [];
  (mission?.exercises || []).forEach(slot => {
    const items = hasList(slot) ? slot.list.map(item => ({ item, parent: slot })) : [{ item: slot, parent: null }];
    items.forEach(it => {
      const key = it.item?.swapKey;
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(it);
    });
  });
  return out;
}

// ── timing ──────────────────────────────────────────────────────────────────
export function restPlan(sec) {
  if (!(sec > 0)) return 'chain';
  if (sec <= 2) return 'tiny';
  if (sec <= 10) return 'short';
  return 'long';
}
export function windowRest(slot, workSec) { return Math.max(5, Math.round(slot.window - workSec)); }
// When the lead line starts (remaining seconds): it ends ≥ 4 s before work,
// so ≥ 1 s before the spoken "3". null → the rest falls back to the short plan.
export function announceAt(restSec, lead, opener = '') {
  const at = Math.max(6, 4 + speechSeconds(lead));
  return restSec - speechSeconds(opener) >= at ? at : null;
}
// The intro's GET READY rest: the lead fires 1 s in.
export function getReadySeconds(lead) { return Math.max(7, 5 + speechSeconds(lead)); }
export function restScript({ restSec, kind = 'rest', roundEnd = false, completedRound = 0, format, tips = [], lead, short }) {
  if (kind === 'lead') return { plan: 'long', opener: null, leadAt: announceAt(restSec, lead), lead, short: null, countdown: true };
  const plan = restPlan(restSec);
  if (plan === 'chain' || plan === 'tiny') return { plan, opener: null, leadAt: null, lead: null, short: null, countdown: false };
  if (plan === 'long') {
    const list = tips || [];
    const tip = restSec >= 30 && list.length ? list[completedRound >= 1 ? (completedRound - 1) % list.length : 0] : null;
    const tries = tip ? [tip, null] : [null];
    for (const t of tries) {
      const opener = restOpener({ restSec, roundEnd, completedRound, format, tip: t });
      const leadAt = announceAt(restSec, lead, opener);
      if (leadAt !== null) return { plan: 'long', opener, leadAt, lead, short: null, countdown: true };
    }
  }
  return { plan: 'short', opener: null, leadAt: null, lead: null, short, countdown: restSec >= 3 + speechSeconds(short) };
}
// The line at work start. announcedBy: 'lead' | 'short' | null.
export function workStartLine(slot, { announcedBy = null, legacyCounted = false } = {}) {
  // A MAX REPS station: the lead or the short line named it, so just "Go.".
  if (slot?.max === true) return announcedBy ? 'Go.' : chainedLine(slot);
  if (!announcedBy) return chainedLine(slot, { legacyCounted });
  if (isTimed(slot)) return hasCallAt0(slot) ? null : 'Go.';
  if (isCounted(slot, { legacyCounted })) return null;
  return announcedBy === 'lead' ? 'Go.' : `Go. ${MANUAL_LINE}`;
}
// SKIP in a rest jumps here: room for the short line, then the 3-2-1.
export function skipRestTarget(next) { return Math.max(4, 3 + speechSeconds(shortRestLine(next))); }

// The coach's count for a reps slot. Beat = { n, say, ms, step? }; ms is the
// wait BEFORE the beat (null = a legacy slot: the runner uses the slider).
export function countBeats(slot, { next = null } = {}) {
  if (!slot || slot.mode !== 'reps') return null;
  const catalog = isCatalogSlot(slot);
  const upNext = next && !sameMove(slot, next) ? ` Up next: ${spokenMove(next)}.` : '';
  const setup = slot.setupMs ?? 0;

  if (hasList(slot)) {
    const steps = slot.list.filter(s => s && s.reps > 0);
    if (!steps.length || steps.some(s => typeof s.cadenceMs !== 'number')) return null;
    const beats = [];
    steps.forEach((step, si) => {
      const following = steps[si + 1];
      for (let k = 1; k <= step.reps; k += 1) {
        const ms = step.cadenceMs + (beats.length === 0 ? setup : 0);
        let say = String(k);
        if (k === step.reps && following) say = `${k}. ${cap(stepWord(following))}.`;
        beats.push({ n: beats.length + 1, say, ms, step: si });
      }
    });
    if (upNext) { const last = beats[beats.length - 1]; last.say = `${String(last.say).replace(/\.$/, '')}.${upNext}`; }
    return beats;
  }

  if (catalog && typeof slot.cadenceMs !== 'number') return null; // manual: DONE, never counted
  const reps = slot.reps;
  if (!(reps >= 1)) return null;
  const base = catalog ? slot.cadenceMs : null;
  const extra = Array.from({ length: reps + 1 }, () => []);
  const ms = Array.from({ length: reps + 1 }, () => base);
  if (base != null) ms[1] += setup;
  if (slot.sides === 'switch' && reps % 2 === 0 && reps >= 4) {
    extra[reps / 2].push(' Switch.');
    if (base != null) ms[reps / 2 + 1] += moveById(slot.moveId)?.switchMs ?? 0;
  }
  const tail = reps >= 5 ? reps - 2 : reps >= 3 ? reps - 1 : reps;
  if (reps >= 5) extra[tail].push(' Two more.');
  else if (reps >= 3) extra[tail].push(' One more.');
  if (upNext) extra[tail].push(upNext);
  const beats = [];
  for (let n = 1; n <= reps; n += 1) {
    beats.push({ n, say: extra[n].length ? `${n}.${extra[n].join('')}` : String(n), ms: ms[n] });
  }
  return beats;
}
// A step's word after its number: 'press' for 1, 'front squats' for 3.
function stepWord(step) {
  const move = moveById(step.moveId);
  if (step.reps === 1) return step.say1 || step.say || move?.say1 || move?.say || lower(step.name);
  return step.say || move?.say || lower(step.name);
}

// A pace count for a timed catalog slot: beat i lands at (i − 0.5) × ms.
export function paceBeats(slot) {
  if (!slot || !isTimed(slot) || hasList(slot) || typeof slot.moveId !== 'string') return null;
  if (typeof slot.cadenceMs !== 'number' || slot.cadenceMs <= 0 || slot.count === false || slot.calls?.length) return null;
  return { ms: slot.cadenceMs, n: Math.floor((slot.work * 1000) / slot.cadenceMs) };
}
// The `remaining` second at which the coach calls the next move during a timed slot.
export function nearEndUpNextAt(slot, next) {
  if (!slot || !isTimed(slot) || !(slot.work >= 15) || slot.calls?.length) return null;
  if (!next || sameMove(slot, next)) return null;
  return Math.min(8, Math.floor(slot.work / 2));
}

// ── MAX REPS (MAX OUT) ──────────────────────────────────────────────────────
// A station slot carries `max: true`: the athlete does clean reps until the
// form breaks, taps DONE and enters the reps. Nothing here changes a slot
// without the flag. Region, stop rule, rep cap and the words the coach says.

// The muscle region a move works, from its pattern. A swap inside a MAX REPS
// station must stay in its region (data/loadoutMissions altAllowed rule 10),
// so the move after it never shares a prime mover with the one before.
// null: not a station move (cardio, strikes, cleans, burpees).
const REGION_OF_PATTERN = { push: 'chest', press: 'shoulders', pull: 'back', squat: 'quads', lunge: 'quads', hinge: 'hinge', core: 'core' };
export function regionOf(moveId) { return REGION_OF_PATTERN[moveById(moveId)?.pattern] || null; }

// A move with a load in the hands, on the shoulders or on the back, so its set says
// CLEAN reps. A backpack is no gear in the catalog but it is a load; a pull-up bar is
// not (the body is the load).
const LOAD_GEAR = new Set(['bell', 'db', 'barbell', 'plate']);
export function isLoadedMove(moveId) {
  const m = moveById(moveId);
  return !!m && (LOAD_GEAR.has(m.gear) || /^backpack-/.test(m.id));
}

// The cues a MAX OUT screen shows for a move: the catalog's, less the lines that do not suit a
// set taken tired to failure (a kip, a box to jump off, a weight that is the loadout line's to
// state). The catalog itself is unchanged: the earlier missions show these lines as they did.
// weightWord: what a workout calls its weight ('dumbbell' for DUAL WIELD, whose kettlebell moves
// are done with a dumbbell); the catalog's 'bell' becomes that word.
export function maxCues(moveId, weightWord = null) {
  const m = moveById(moveId);
  if (!m) return [];
  return m.cues
    .filter(c => !/^Kip only/.test(c))
    .map(c => c
      .replace(', or a box beneath it.', ', feet on the floor.')
      .replace(', about 8-10 kg, held in front.', ', held in front of the thighs.'))
    .map(c => (weightWord ? c.replace(/\bbell\b/g, weightWord) : c));
}

// One sentence each: when to stop the set. The default is the catalog-wide rule.
export const DEFAULT_STOP_RULE = 'Stop when your form breaks.';
const STOP_FAMILIES = [
  [['push-up', 'knee-push-up', 'incline-push-up', 'diamond-push-up'], 'Stop when your hips sag or you cannot lower to within a fist of the floor.'],
  [['air-squat', 'bench-squat', 'heels-down-hindu-squat'], 'Stop when your heels lift, your knees cave or your chest drops.'],
  // The Hindu squat lifts the heels on purpose, so its rule never mentions them.
  [['hindu-squat', 'half-hindu-squat', 'hindu-squat-knee-strike'], 'Stop when your knees cave or your chest drops.'],
  [['sit-up', 'crunch', 'v-up'], 'Stop when you have to swing or pull on your neck.'],
  [['pull-up', 'jumping-pull-up'], 'Stop when your chin cannot clear the bar. Step down to the floor. No swinging.'],
  [['backpack-rdl'], 'Stop when your back wants to round. Grip going? Hug the pack to your chest.'],
  [['backpack-suitcase-deadlift', 'db-rdl', 'kb-deadlift', 'bb-rdl'], 'Stop when your back wants to round.'],
  [['glute-bridge', 'hip-thrust', 'db-hip-thrust'], 'Stop when your hips cannot reach a straight line.'],
  [['mountain-climber', 'slow-climber'], 'Stop when your hips pike up or you cannot hold the plank.'],
  [['kb-swing', 'db-swing', 'kb-one-arm-swing', 'db-one-arm-swing', 'kb-american-swing'], 'Stop when the bell stops floating to chest height or your back wants to round.'],
  [['kb-horn-press'], 'Stop when you have to lean back. Never press through a stall.'],
  [['goblet-squat', 'kb-front-squat'], 'Stop when your chest drops or your heels lift.'],
  [['dead-bug', 'kb-dead-bug', 'backpack-dead-bug'], 'Stop when your low back lifts off the floor.'],
  [['bb-bent-over-row', 'bb-dead-stop-row', 'db-bent-over-row', 'ring-row'], 'Stop when your back wants to round or you start to heave.'],
  [['plate-goblet-squat'], 'Stop when your elbows drop or your chest folds.'],
  // No rack and no spotter: a front squat that stalls goes forward off the shoulders.
  [['bb-front-squat'], 'Stop when your elbows drop or your chest folds. If the bar slides, let it go forward.'],
  [['db-floor-press'], 'Stop when a rep stalls. Lower both dumbbells to your sides.'],
  [['kb-reverse-lunge', 'reverse-lunge', 'reverse-lunge-knee-drive', 'bulgarian-split-squat'], 'Stop at the first wobble or when your front knee caves.'],
  [['kb-plank-pull-through', 'kb-knee-pull-through', 'backpack-pull-through'], 'Stop when your hips twist or sag.'],
];
export const STOP_RULES = Object.fromEntries(STOP_FAMILIES.flatMap(([ids, rule]) => ids.map(id => [id, rule])));

// The most reps one set may be entered with, or null for no cap. A loaded set
// is a rule, not a failure test (a hinge cap is lower: its risk is form fade
// before failure); a sit-up or a crunch caps at 60. Bodyweight push, pull and
// squat have none (the reps-per-second ceiling in data/missionSolo bounds them).
// Climbers count each leg, so they have no cap here either: the ceiling does it.
const SWING_IDS = new Set(['kb-swing', 'db-swing', 'kb-one-arm-swing', 'db-one-arm-swing', 'kb-american-swing']);
const CLIMBER_IDS = new Set(['mountain-climber', 'slow-climber']);
export function repCapFor(moveId, level = 'standard') {
  const m = moveById(moveId);
  if (!m) return null;
  const beginner = level === 'beginner';
  if (SWING_IDS.has(m.id)) return beginner ? 12 : 15;
  if (m.pattern === 'hinge' && isLoadedMove(m.id)) return beginner ? 10 : 12;
  if (m.pattern === 'core') return CLIMBER_IDS.has(m.id) ? null : 60;
  if (!isLoadedMove(m.id)) return null;
  return m.pattern === 'lunge' ? 30 : 25;
}

// The moves no MAX OUT swap may reach (data/loadoutMissions altAllowed rule 11): balance
// work on a raised or moving back foot, and dead bugs with a bell or a pack held over
// the face, all of it taken tired to failure. A base station is never filtered.
export const MAX_OUT_BANNED = new Set(['kb-dead-bug', 'backpack-dead-bug', 'hindu-squat-knee-strike', 'bulgarian-split-squat', 'kb-bulgarian-split-squat', 'reverse-lunge-knee-drive']);

const NUMBER_WORD = { 1: 'one', 2: 'two', 3: 'three' };
// The stop line a set shows: the move's rule, then "Stop 2 reps before
// that." when the station leaves some in the tank, then the cap if it has one.
export function maxStopLine(slot, level = 'standard') {
  if (!slot) return DEFAULT_STOP_RULE;
  let out = STOP_RULES[slot.moveId] || DEFAULT_STOP_RULE;
  if (slot.leave > 0) out += ` Stop ${slot.leave} ${slot.leave === 1 ? 'rep' : 'reps'} before that.`;
  const cap = repCapFor(slot.moveId, level);
  if (cap != null) out += ` Most reps: ${cap}.`;
  return out;
}
// What the coach says after the move: 'Max reps.', 'Max clean reps.' for a
// loaded move, the stop-short line when the station leaves some in the tank, and
// the move's cap when it has one ('Never more than 15.'): a voice-only athlete
// hears the limit the screen prints. A station carries its own `cap` (set at
// the level it was built for, and again by a swap).
export function maxWord(slot) {
  const tail = slot?.cap != null ? ` Never more than ${slot.cap}.` : '';
  if (slot?.leave > 0) return `Max clean reps. Stop ${NUMBER_WORD[slot.leave] || slot.leave} short.${tail}`;
  return `${isLoadedMove(slot?.moveId) ? 'Max clean reps.' : 'Max reps.'}${tail}`;
}
// A hinge or swing set is a rule, not a failure test, and nothing counts its reps:
// the coach calls "Stop. Set it down." once this many seconds into the set (the cap
// at the pace of the level). null for any other set.
export function maxCapCallSec(slot, level = 'standard') {
  const cap = slot?.cap;
  const m = moveById(slot?.moveId);
  if (cap == null || !m || m.pattern !== 'hinge') return null;
  return Math.round((cap * estMsFor(m.id, level)) / 1000);
}
export const MAX_CAP_CALL = 'Stop. Set it down.';
// The last SAVE: 'Done. 214 reps.'
export function maxFinishLine(total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  return `Done. ${n} ${n === 1 ? 'rep' : 'reps'}.`;
}
