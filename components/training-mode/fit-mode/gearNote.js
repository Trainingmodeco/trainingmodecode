// The equipment tag on a library move has only five values (Bodyweight,
// Weighted, Band, Cable, Machine), so a pull-up, a box jump or a pair of
// battle ropes is filed under the nearest one and the screen read "BODYWEIGHT"
// for a move that needs a bar. This names the kit a move needs on top of its
// tag, from the move's name, so the chip on the info sheet and the swap list
// tell the truth. Filtering and timing still run on the tag; a new tag value
// would reach the plan and the weight log, which is a product call.
const GEAR_RULES = [
  [/battle rope/i, 'BATTLE ROPES'],
  [/box jumps?\b/i, 'BODYWEIGHT + BOX'],
  [/bar or rings|low bar/i, 'BODYWEIGHT + BAR OR RINGS'],
  [/pull-ups?\b|chin-ups?\b|chin-up hold|dead hangs?\b|hanging knee raises?\b|muscle-ups?\b/i, 'BODYWEIGHT + PULL-UP BAR', 'WEIGHTED + PULL-UP BAR'],
  [/parallel bar/i, 'BODYWEIGHT + PARALLEL BARS'],
  [/\b(bench|step)\b.*\bdips?\b|\bdips?\b.*\b(bench|step)\b/i, 'BODYWEIGHT + BENCH OR STEP'],
  [/\bdips?\b/i, 'BODYWEIGHT + BENCH OR BARS'],
  [/arm march|isolated tricep|bulgarian jump/i, 'BODYWEIGHT + BENCH OR STEP'],
];

// The kit label for a move, or its plain tag when the tag already tells it.
export function equipmentLabel(exercise) {
  const tag = String(exercise?.equipment || '');
  const name = String(exercise?.name || '');
  const eq = tag.toLowerCase();
  // Ropes are not a cable stack, whatever the tag says; the others only add to
  // a Bodyweight tag (a weighted or banded move names its own kit).
  // (A rule may carry a second label for a loaded move that still needs the bar: a weighted pull-up.)
  for (const [re, label, weightedLabel] of GEAR_RULES) {
    if (!re.test(name)) continue;
    if (label === 'BATTLE ROPES') return label;
    if (eq === 'bodyweight') return label;
    if (eq === 'weighted' && weightedLabel) return weightedLabel;
  }
  return tag;
}
