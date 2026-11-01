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
    [easier('air-squat')]),
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
    [easier('slow-climber')]),
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
    [similar('db-row')]),
  mv('db-row', 'Single-Arm Dumbbell Rows', 'dumbbell rows', 'pull', 'db', 'reps', [1.75, 2.0, 2.5], SW,
    'Brace one hand, flat back. | Pull the dumbbell to the hip, lower all the way.',
    [similar('kb-row')]),
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
    [similar('bb-rdl')]),
  mv('bb-rdl', 'Romanian Deadlifts', 'Romanian deadlifts', 'hinge', 'barbell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Start standing, soft knees. | Push the hips back; the bar slides down the thighs. | Stop when the back wants to round, then stand up.',
    [similar('bb-deadlift')]),
  mv('bb-bent-over-row', 'Bent-Over Rows', 'rows', 'pull', 'barbell', 'reps', [1.75, 2.0, 2.5], NONE,
    'Hinge to about 45 degrees, flat back. | Pull the bar to the belly button. | Lower all the way.',
    [similar('bb-dead-stop-row')]),
  mv('bb-dead-stop-row', 'Dead-Stop Barbell Rows', 'dead-stop rows', 'pull', 'barbell', 'reps', [2.0, 2.5, 3.0], NONE,
    'Bar on the floor, back flat and close to level. | Pull it hard to the lower chest. | Set it down dead on the floor every rep.',
    [similar('bb-bent-over-row')]),
  mv('bb-front-squat', 'Front Squats', 'front squats', 'squat', 'barbell', 'reps', [2.25, 2.75, 3.25], NONE,
    'Bar on the front of the shoulders, elbows high. | Sit straight down, chest tall. | Clean it up on rep 1, or take it from a rack.',
    [easier('plate-goblet-squat'), similar('bb-back-squat')]),
  mv('plate-goblet-squat', 'Plate Goblet Squats', 'plate goblet squats', 'squat', 'plate', 'reps', [2.0, 2.5, 3.0], NONE,
    'Hold a plate at the chest. | Sit between the knees, chest up.',
    [harder('bb-front-squat'), noGear('air-squat')]),
  mv('bb-back-squat', 'Back Squats', 'back squats', 'squat', 'barbell', 'reps', [2.25, 2.75, 3.25], NONE,
    'Bar on the upper back, hands just outside the shoulders. | Sit to parallel, knees out. | Drive up, chest up.',
    [easier('bb-front-rack-lunge', { x: 2, stop: 'Sore shoulders?' }), similar('bb-front-squat')]),
  mv('bb-front-rack-lunge', 'Front-Rack Reverse Lunges', 'front-rack lunges', 'lunge', 'barbell', 'reps', [2.5, 3.0, 3.5], ALT,
    'Bar in the front rack. | Step back, knee just off the floor. | Drive up. Alternate legs.',
    [similar('bb-back-squat', { x: 0.5 })]),
  mv('bb-push-press', 'Push Press', 'push presses', 'press', 'barbell', 'reps', [1.75, 2.25, 2.75], { say1: 'push press' },
    'Bar in the front rack. | Short dip at the knees, drive up hard. | Press to lockout, head through.',
    [similar('bb-strict-press')]),
  mv('bb-strict-press', 'Strict Press', 'strict presses', 'press', 'barbell', 'reps', [2.0, 2.5, 3.0], { say1: 'strict press' },
    'Bar in the front rack, glutes tight. | Press straight up, no knee dip. | Head through at the top.',
    [easier('bb-push-press')]),
  mv('bb-power-clean', 'Power Cleans', 'power cleans', 'clean', 'barbell', 'reps', [3.0, 4.0, 5.0], NONE,
    'Bar over mid-foot, flat back. | Push the floor, then jump and shrug. | Pull under and catch on the shoulders in a quarter squat. Never been coached on the clean? Use dumbbells.',
    [easier('db-power-clean'), similar('bb-hang-power-clean')]),
  mv('bb-hang-power-clean', 'Hang Power Cleans', 'hang power cleans', 'clean', 'barbell', 'reps', [2.5, 3.0, 4.0], NONE,
    'Bar at the hips, soft knees. | Dip, jump, shrug and pull under. | Catch on the shoulders, stand tall.',
    [easier('bb-hang-muscle-clean'), similar('bb-power-clean')]),
  mv('bb-hang-muscle-clean', 'Hang Muscle Cleans', 'hang muscle cleans', 'clean', 'barbell', 'reps', [2.5, 3.0, 3.5], NONE,
    'Bar at the hips. | Pull high and turn the elbows over with no dip under. | Bar on the shoulders, stand tall.',
    [harder('bb-hang-power-clean')]),
  mv('bb-clean-press', 'Clean and Press', 'clean and presses', 'clean', 'barbell', 'reps', [3.5, 4.5, 5.5], NONE,
    'Clean the bar to the shoulders. | Reset your feet, then press it overhead. | Lower to the shoulders, then the hips.',
    [easier('bb-muscle-clean-press')]),
  mv('bb-muscle-clean-press', 'Muscle Clean and Strict Press', 'muscle clean and presses', 'clean', 'barbell', 'reps', [3.5, 4.5, 5.5], NONE,
    'Deadlift the bar to the hips. | Muscle it to the shoulders with no dip, then strict-press. | Lower with control.',
    [harder('bb-clean-press')]),
];

const BY_ID = new Map(MOVES.map(m => [m.id, m]));
// Test-only: fixture moves (a flying knee, a box move) the unit tests inject.
// Never listed in MOVES, so the catalog checks only ever see the real 80.
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
  if (isTimed(slot)) {
    if (hasList(slot)) return mmss(slot.work);
    return slot.work < 60 ? `${slot.work}s` : mmss(slot.work);
  }
  if (hasList(slot)) return slot.list.map(slotDose).join(' + ');
  const reps = slot.reps;
  let out = slot.unit ? `${reps} ${slot.unit}` : `${reps}`;
  if (slot.sides && reps % 2 === 0) out += slot.sides === 'switch' ? ` (${reps / 2}/side)` : ` (${reps / 2}/leg)`;
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
    // DROP-A NOTE: a complex with a manual step is never counted, so it gets the manual line (no Drop A complex has one).
    const tail = isCounted(slot) ? 'Ready? On my count.' : MANUAL_LINE;
    return `${prefix}${cap(listSpoken(slot.list))}. ${side}${tail}`;
  }
  if (isTimed(slot)) return `${prefix}${cap(spokenMove(slot))}. ${spokenDuration(slot.work)}.`;
  if (isCounted(slot, { legacyCounted })) return `${prefix}${cap(spokenMove(slot))}. Ready? On my count.`;
  return `${prefix}${cap(spokenMove(slot))}. ${MANUAL_LINE}`;
}
// The start line when no lead or short line named this slot (after a chain or a tiny rest).
export function chainedLine(slot, { legacyCounted = false } = {}) {
  if (isTimed(slot)) return `${cap(spokenMove(slot))}.${hasCallAt0(slot) ? '' : ' Go.'}`;
  if (isCounted(slot, { legacyCounted })) return `${cap(spokenMove(slot))}.`;
  return `${cap(spokenMove(slot))}. ${MANUAL_LINE}`;
}
export function shortRestLine(next) { return `Next: ${spokenMove(next)}.`; }
export function restOpener({ restSec, roundEnd, completedRound, format, tip = null }) {
  const base = format !== 'emom' && roundEnd
    ? `Round ${completedRound} complete. Rest. ${secondsPhrase(restSec)}.`
    : `Rest. ${secondsPhrase(restSec)}.`;
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
