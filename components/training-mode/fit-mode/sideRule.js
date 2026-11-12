// One-sided moves: the reps (or seconds) written on the card are for ONE side,
// so the athlete does the set on the left and again on the right. The library
// has no side field and the coach does not say it, so the screens add "each
// side" after the prescription. Found from the name, so it also reaches a
// workout row that was copied from the library or saved earlier.
//
// Alternating moves (Alternating Dumbbell Press, Alt One Leg Wall Sit) count
// both sides inside the one set and are left out on purpose.
const ONE_SIDED = /single[- ](arm|leg)|one[- ](arm|leg)|pistol|bulgarian|split squat|step-?ups?\b|concentration curls|kickbacks|donkey kicks|clamshells|fire hydrants|side plank|archer push-ups/i;
const ALTERNATING = /^(alternating|alt)\b/i;

export function isPerSide(name) {
  const n = String(name || '');
  return ONE_SIDED.test(n) && !ALTERNATING.test(n);
}

// " each side" to put after "8-12 reps" or "3 × 8-12"; empty for two-sided work.
export function sideSuffix(name) {
  return isPerSide(name) ? ' each side' : '';
}
