// Multiple opponents — a round where the fighter works one target, then on
// the SWITCH call pivots to the next: a second bag, or (shadow boxing) the
// next imagined opponent. Streams of strikes, one target at a time.
//
//   • Fight Focus: a hard-tier round theme in every discipline (pool entries
//     carry `multi: true`), and any block round may set `multi: true`.
//   • Combo Coach: on Hard/Advanced with 3+ rounds, one round (the second to
//     last) is a multiple-opponents round. It is announced before it starts.

export const MULTI_TITLE = 'Multiple Opponents';
export const MULTI_PROMPT = 'Two bags: on switch, pivot to the other bag. One bag or shadow: pivot to face the next opponent.';
// Spoken at the top of a Combo Coach multi round (its intro has no prompt).
export const MULTI_ANNOUNCE = `Multiple opponents. ${MULTI_PROMPT}`;

export const SWITCH_CALLS = [
  { display: 'SWITCH!', speech: 'Switch!' },
  { display: 'PIVOT · NEXT OPPONENT', speech: 'Pivot! Next opponent!' },
  { display: 'SWITCH BAGS!', speech: 'Switch bags!' },
  { display: 'BEHIND YOU · TURN!', speech: 'Behind you! Turn!' },
];

let lastSwitch = -1;
export function nextSwitchCall(rand = Math.random) {
  let i = Math.floor(rand() * SWITCH_CALLS.length);
  if (i === lastSwitch) i = (i + 1) % SWITCH_CALLS.length;
  lastSwitch = i;
  return SWITCH_CALLS[i];
}

// Fight Focus: seconds between switch calls.
export function switchGapSec(difficulty) {
  const d = String(difficulty || 'normal').toLowerCase();
  return d === 'advanced' ? 8 : d === 'hard' ? 10 : d === 'easy' ? 14 : 12;
}

// Combo Coach: combos thrown at one target before the switch.
export function switchEveryCombos(difficulty) {
  return String(difficulty || '').toLowerCase() === 'advanced' ? 2 : 3;
}

// Combo Coach: which round (0-based) is the multiple-opponents round, or -1.
export function comboCoachMultiRound(difficulty, rounds) {
  const d = String(difficulty || '').toLowerCase();
  if (d !== 'hard' && d !== 'advanced') return -1;
  return rounds >= 3 ? rounds - 2 : -1;
}
