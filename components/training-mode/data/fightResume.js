// What Fight Focus and Combo Coach keep across a phone kill. The snapshot used
// to hold only phase, round and clock, so a restored session came back with its
// strike count at 0, no clean-round credit and a fresh integrity check that
// counted the rounds already fought as never done: half the XP, or none.
// The screens report this small "carry" with every snapshot and read it back
// here on mount. Rush tallies and ghost times are not carried.

const whole = (n, max = 1e6) => Math.min(max, Math.max(0, Math.floor(Number(n)) || 0));

// raw: whatever the stash holds (maybe nothing, maybe from an older build).
export function readCarry(raw, totalRounds) {
  const total = Math.max(1, whole(totalRounds, 999));
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    valid: Math.min(total, whole(c.valid, 999)),
    thrown: whole(c.thrown),
    roundStart: whole(c.roundStart),
    clean: Math.min(total, whole(c.clean, 999)),
    perRound: Array.isArray(c.perRound) ? c.perRound.slice(0, total).map((n) => whole(n)) : [],
    called: whole(c.called),
    peak: whole(c.peak, 9999),
  };
}

// Seconds of the current round that ran before the restore. Only a work round
// carries time; a rest has no open unit.
export function carrySeconds(resume, roundSec) {
  if (!resume || resume.phase === 'rest' || !Number.isFinite(resume.remaining)) return 0;
  return Math.max(0, Math.min(roundSec, roundSec - resume.remaining));
}
