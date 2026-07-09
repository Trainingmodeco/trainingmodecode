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

function getPromptCount(roundSec, frequency) {
  const mult = frequency === 'high' ? 1.5 : frequency === 'low' ? 0.5 : 1;
  if (roundSec <= 120) return Math.max(1, Math.round(1 * mult));
  if (roundSec <= 180) return Math.max(1, Math.round(1.5 * mult));
  return Math.max(1, Math.round(2.5 * mult));
}

export function scheduleEncouragements(roundSec, frequency) {
  if (frequency === 'off') return [];
  const count = getPromptCount(roundSec, frequency);
  const startAfter = Math.max(15, Math.floor(roundSec * 0.2));
  const endBefore = Math.max(10, Math.floor(roundSec * 0.08));
  const available = roundSec - startAfter - endBefore;
  if (available < 30) return [Math.floor(roundSec * 0.5)];

  const times = [];
  const spacing = Math.floor(available / (count + 1));
  for (let i = 1; i <= count; i++) {
    const t = startAfter + spacing * i;
    const jitter = Math.floor((Math.random() - 0.5) * 8);
    times.push(Math.min(roundSec - endBefore, Math.max(startAfter, t + jitter)));
  }
  return times;
}

export function pickEncouragement(discipline, elapsed, roundSec, usedIds) {
  const phase = getPhaseForTime(elapsed, roundSec);
  const pool = ENCOURAGEMENT.filter(q => {
    if (usedIds.has(q.id)) return false;
    return q.disciplines.includes('all') || q.disciplines.includes(discipline);
  });

  const phaseMatches = pool.filter(q => q.phase === phase);
  const source = phaseMatches.length > 0 ? phaseMatches : pool;
  if (source.length === 0) return null;

  return source[Math.floor(Math.random() * source.length)];
}
