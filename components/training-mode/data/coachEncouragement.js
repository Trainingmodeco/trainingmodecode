const ENCOURAGEMENT = [
  { id: 'g01', text: "Keep moving. You're still in the fight.", disciplines: ['all'], intensity: 'medium', phase: 'middle' },
  { id: 'g02', text: 'Breathe, reset, stay sharp.', disciplines: ['all'], intensity: 'low', phase: 'early' },
  { id: 'g03', text: 'You got this. One more push.', disciplines: ['all'], intensity: 'high', phase: 'final' },
  { id: 'g04', text: "Stay locked in. Don't fade now.", disciplines: ['all'], intensity: 'medium', phase: 'middle' },
  { id: 'g05', text: 'Good work. Keep the pressure on.', disciplines: ['all'], intensity: 'medium', phase: 'middle' },
  { id: 'g06', text: "You're almost there. Finish strong.", disciplines: ['all'], intensity: 'high', phase: 'final' },
  { id: 'g07', text: 'Stay loose. Stay dangerous.', disciplines: ['all'], intensity: 'low', phase: 'early' },
  { id: 'g08', text: 'Tough it out. The round is yours.', disciplines: ['all'], intensity: 'high', phase: 'final' },
  { id: 'g09', text: "Don't quit on this round.", disciplines: ['all'], intensity: 'high', phase: 'final' },
  { id: 'g10', text: 'Control your breathing. Control the fight.', disciplines: ['all'], intensity: 'low', phase: 'middle' },

  { id: 'b01', text: 'Hands up. Chin down. Keep working.', disciplines: ['Boxing'], intensity: 'medium', phase: 'middle' },
  { id: 'b02', text: 'Snap that jab. Stay busy.', disciplines: ['Boxing'], intensity: 'medium', phase: 'early' },
  { id: 'b03', text: 'Move your feet. Make them miss.', disciplines: ['Boxing'], intensity: 'low', phase: 'early' },
  { id: 'b04', text: "Touch and go. Don't stand still.", disciplines: ['Boxing'], intensity: 'medium', phase: 'middle' },
  { id: 'b05', text: "Keep your guard tight. You're doing good.", disciplines: ['Boxing'], intensity: 'low', phase: 'early' },
  { id: 'b06', text: 'Jab, breathe, reset.', disciplines: ['Boxing'], intensity: 'low', phase: 'middle' },
  { id: 'b07', text: "Don't admire your work. Exit clean.", disciplines: ['Boxing'], intensity: 'medium', phase: 'middle' },
  { id: 'b08', text: 'Stay behind the jab. Own the round.', disciplines: ['Boxing'], intensity: 'medium', phase: 'final' },
  { id: 'b09', text: 'Keep your shoulders relaxed. Let it flow.', disciplines: ['Boxing'], intensity: 'low', phase: 'early' },
  { id: 'b10', text: 'Push through. Championship pace.', disciplines: ['Boxing'], intensity: 'high', phase: 'final' },

  { id: 'k01', text: 'Punch, kick, move. Keep the rhythm.', disciplines: ['Kickboxing'], intensity: 'medium', phase: 'middle' },
  { id: 'k02', text: 'Check, fire back, stay composed.', disciplines: ['Kickboxing'], intensity: 'medium', phase: 'middle' },
  { id: 'k03', text: "Set up the kick. Don't rush it.", disciplines: ['Kickboxing'], intensity: 'low', phase: 'early' },
  { id: 'k04', text: 'Keep your range. Strike with purpose.', disciplines: ['Kickboxing'], intensity: 'medium', phase: 'middle' },
  { id: 'k05', text: 'Hands return home after every kick.', disciplines: ['Kickboxing'], intensity: 'low', phase: 'early' },
  { id: 'k06', text: 'Breathe through the combo. Keep flowing.', disciplines: ['Kickboxing'], intensity: 'low', phase: 'middle' },
  { id: 'k07', text: 'Angles win rounds. Step off and attack.', disciplines: ['Kickboxing'], intensity: 'medium', phase: 'middle' },
  { id: 'k08', text: 'Stay balanced. Power comes from control.', disciplines: ['Kickboxing'], intensity: 'low', phase: 'early' },
  { id: 'k09', text: 'Mix it up. Hands to feet.', disciplines: ['Kickboxing'], intensity: 'medium', phase: 'middle' },
  { id: 'k10', text: "Keep the pace. Don't let the round beat you.", disciplines: ['Kickboxing'], intensity: 'high', phase: 'final' },

  { id: 'm01', text: 'Long guard. Strong posture. Keep pressure.', disciplines: ['Muay Thai'], intensity: 'medium', phase: 'middle' },
  { id: 'm02', text: 'Teep them back. Own the distance.', disciplines: ['Muay Thai'], intensity: 'medium', phase: 'early' },
  { id: 'm03', text: 'Check and return. Make it count.', disciplines: ['Muay Thai'], intensity: 'medium', phase: 'middle' },
  { id: 'm04', text: 'Knees sharp. Elbows tight.', disciplines: ['Muay Thai'], intensity: 'medium', phase: 'middle' },
  { id: 'm05', text: 'Clinch strong. Breathe and work.', disciplines: ['Muay Thai'], intensity: 'low', phase: 'middle' },
  { id: 'm06', text: 'Stay heavy. Stay calm.', disciplines: ['Muay Thai'], intensity: 'low', phase: 'early' },
  { id: 'm07', text: 'Dig in. Muay Thai pace.', disciplines: ['Muay Thai'], intensity: 'high', phase: 'final' },
  { id: 'm08', text: 'Shin up. Defense first, return fire.', disciplines: ['Muay Thai'], intensity: 'medium', phase: 'middle' },
  { id: 'm09', text: "Don't back down. Break their rhythm.", disciplines: ['Muay Thai'], intensity: 'high', phase: 'final' },
  { id: 'm10', text: 'Keep marching. Strong body, strong mind.', disciplines: ['Muay Thai'], intensity: 'high', phase: 'final' },

  { id: 'x01', text: 'Strike, sprawl, reset. Stay ready.', disciplines: ['MMA'], intensity: 'medium', phase: 'middle' },
  { id: 'x02', text: 'Hands up. Hips back. Keep fighting.', disciplines: ['MMA'], intensity: 'medium', phase: 'middle' },
  { id: 'x03', text: 'Level change threat. Stay unpredictable.', disciplines: ['MMA'], intensity: 'medium', phase: 'early' },
  { id: 'x04', text: 'Move your feet before they grab.', disciplines: ['MMA'], intensity: 'low', phase: 'early' },
  { id: 'x05', text: 'Stay composed. Every range matters.', disciplines: ['MMA'], intensity: 'low', phase: 'middle' },
  { id: 'x06', text: 'Defend first. Counter fast.', disciplines: ['MMA'], intensity: 'medium', phase: 'middle' },
  { id: 'x07', text: "Scramble energy. Don't stop working.", disciplines: ['MMA'], intensity: 'high', phase: 'final' },
  { id: 'x08', text: 'Wall, ground, feet. Own the transitions.', disciplines: ['MMA'], intensity: 'medium', phase: 'middle' },
  { id: 'x09', text: 'Keep your base. Keep your breath.', disciplines: ['MMA'], intensity: 'low', phase: 'early' },
  { id: 'x10', text: "Finish the round like you're built for this.", disciplines: ['MMA'], intensity: 'high', phase: 'final' },
];

function getPhaseForTime(elapsed, total) {
  const pct = elapsed / total;
  if (pct < 0.33) return 'early';
  if (pct < 0.7) return 'middle';
  return 'final';
}

// Encouragement frequency is an INTERVAL, not a vague amount. "LOW / NORMAL /
// HIGH" told you nothing about what you would actually hear; these say it
// outright. The ids are unchanged so existing saved profiles carry over and
// every `encouragement === 'off'` check in the players still works.
//
// Deliberately no 10s option: at that rate the coach talks over the work.
export const ENCOURAGEMENT_FREQUENCIES = [
  { id: 'off',    label: 'OFF',       seconds: 0,  blurb: 'Silence between the bells.' },
  { id: 'low',    label: 'EVERY 60s', seconds: 60, blurb: 'A nudge once a minute.' },
  { id: 'normal', label: 'EVERY 30s', seconds: 30, blurb: 'Steady corner talk.' },
  { id: 'high',   label: 'EVERY 20s', seconds: 20, blurb: 'In your ear the whole round.' },
];

/** The chosen frequency, falling back to 'normal' for anything unrecognised. */
export function encouragementFrequency(id) {
  const key = String(id || 'normal').toLowerCase();
  return ENCOURAGEMENT_FREQUENCIES.find((f) => f.id === key)
    || ENCOURAGEMENT_FREQUENCIES.find((f) => f.id === 'normal');
}

/** Seconds between lines; 0 means off. */
export function encouragementIntervalSec(id) {
  return encouragementFrequency(id).seconds;
}

/**
 * Plain-language preview for the settings screen — the number of lines the
 * athlete will actually hear, so the dial is not guesswork.
 */
export function describeEncouragement(id, roundSec = 180) {
  const f = encouragementFrequency(id);
  if (!f.seconds) return f.blurb;
  const n = scheduleEncouragements(roundSec, f.id).length;
  const mins = Math.round((roundSec / 60) * 10) / 10;
  return `${f.blurb} About ${n} line${n === 1 ? '' : 's'} in a ${mins}-minute round.`;
}

/**
 * Times (seconds into the round) at which to speak a line.
 *
 * Spaced by the chosen interval, with the opening call and the final push left
 * clear, plus a little jitter so it never feels metronomic.
 */
export function scheduleEncouragements(roundSec, frequency) {
  const interval = encouragementIntervalSec(frequency);
  if (!interval || !(roundSec > 0)) return [];

  const startAfter = Math.min(Math.max(12, Math.round(roundSec * 0.15)), Math.max(1, roundSec - 1));
  const endBefore = Math.max(8, Math.round(roundSec * 0.08));
  const last = roundSec - endBefore;
  // Too short to space anything out — one line at the midpoint, or none.
  if (last <= startAfter) return roundSec >= 30 ? [Math.round(roundSec / 2)] : [];

  const times = [];
  const jitterMax = Math.min(6, Math.round(interval * 0.25));
  for (let t = startAfter + interval; t <= last; t += interval) {
    const jitter = Math.round((Math.random() - 0.5) * 2 * jitterMax);
    times.push(Math.min(last, Math.max(startAfter + 1, t + jitter)));
  }
  if (!times.length) times.push(Math.round((startAfter + last) / 2));
  return [...new Set(times)].sort((a, b) => a - b);
}

export function pickEncouragement(discipline, elapsed, roundSec, usedIds) {
  const phase = getPhaseForTime(elapsed, roundSec);
  const mine = ENCOURAGEMENT.filter(
    (q) => q.disciplines.includes('all') || q.disciplines.includes(discipline)
  );
  if (!mine.length) return null;

  let pool = mine.filter((q) => !usedIds.has(q.id));
  // Only ~20 lines apply to any one discipline. At EVERY 20s a three-round
  // session asks for more than that, and the old code returned null once the
  // pool ran dry — the coach simply went quiet for the rest of the session,
  // which is the opposite of what a higher frequency is for. Recycle instead:
  // a line heard twice beats a corner that stops talking.
  if (!pool.length) {
    usedIds.clear();
    pool = mine;
  }

  const phaseMatches = pool.filter((q) => q.phase === phase);
  const source = phaseMatches.length > 0 ? phaseMatches : pool;
  return source[Math.floor(Math.random() * source.length)];
}
