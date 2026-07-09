import { loadProfile } from './userProfile';

const COPY = {
  sessionStart: {
    STANDARD: 'Quick Mission started.',
    HYPE: "Quick Mission started. Let's work.",
    DRILL: 'Quick Mission started. Move with purpose.',
    CALM: 'Quick Mission started. Control your breathing. Begin.',
  },
  sessionComplete: {
    STANDARD: 'Mission complete. Good work.',
    HYPE: "Mission complete. That's how you level up.",
    DRILL: 'Mission complete. Discipline logged.',
    CALM: 'Mission complete. Breathe. Recover. Reset.',
  },
  fightComplete: {
    STANDARD: 'Session complete. Good work.',
    HYPE: "Session complete. That's what a fighter looks like.",
    DRILL: 'Session complete. Discipline logged.',
    CALM: 'Session complete. Breathe. Recover. Reset.',
  },
};

export function getCoachCopy(key) {
  const style = (loadProfile().coachStyle || 'STANDARD').toUpperCase();
  const variants = COPY[key];
  if (!variants) return '';
  return variants[style] || variants.STANDARD;
}
