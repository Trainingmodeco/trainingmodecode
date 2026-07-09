import { PUBLIC_SITE_URL } from './links';
import { trackEvent } from './analytics';

export const PUBLIC_APP_URL = PUBLIC_SITE_URL;

const APP_URL = PUBLIC_APP_URL;

const MOTIVATIONAL_LINES = [
  'Workout cleared. New level unlocked.',
  'Training Mode complete. Run it back tomorrow.',
  'Another session locked in. Keep building.',
  'The grind never stops. Level up.',
  'Session done. Momentum gained.',
];

function getMotivationalLine() {
  return MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)];
}

export function buildShareText({ mode, xpEarned, streak, level, completedCount, totalCount, style, difficulty, duration, workoutName }) {
  const modeDisplay = style ? `${mode} (${style})` : (mode || 'Training');
  const name = workoutName || modeDisplay;
  const lines = [
    `I just completed a Training Mode workout: ${name}`,
    `Mode: ${modeDisplay}`,
    difficulty ? `Difficulty: ${difficulty}` : null,
    totalCount ? `Exercises: ${completedCount ?? 0}/${totalCount}` : null,
    duration ? `Duration: ${duration} min` : null,
    `XP earned: +${xpEarned ?? 0}`,
    streak > 0 ? `Streak: ${streak} days` : null,
    '',
    getMotivationalLine(),
    '',
    `Start your training arc at ${APP_URL}`,
    '#TrainingMode #FightFit #CombatComplete #FitnessJourney',
  ];
  return lines.filter(l => l !== null).join('\n');
}

export function shareTrainingResult(shareData) {
  const text = buildShareText(shareData);
  trackEvent('share', { mode: shareData.mode || 'unknown' });

  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ text }).catch(() => {
      copyShareText(text);
    });
  } else {
    copyShareText(text);
  }
}

export function shareRankUp({ rank, level, totalXp, streak }) {
  const lines = [
    `Just unlocked ${rank || 'a new rank'} in Training Mode \u{1F94A}`,
    `Level ${level ?? 1} \u00B7 ${totalXp ?? 0} XP total`,
    streak > 0 ? `${streak}-day streak \u{1F525} \u2014 the grind continues` : 'New rank achieved',
    `Train with me \u2192 ${APP_URL}`,
    '',
    '#TrainingMode #FightFit #LevelUp #CombatComplete',
  ];

  const text = lines.join('\n');

  try {
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible('Share', { props: { type: 'rank_up', rank: rank || 'unknown' } });
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    const encoded = encodeURIComponent(text);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
  }
}

export function copyShareText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showShareToast('Workout share copied.');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showShareToast('Workout share copied.');
}

export function showShareToast(message) {
  const existing = document.getElementById('tm-share-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'tm-share-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '180px', left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: '10px', zIndex: '9999',
    background: 'rgba(12,2,24,0.95)', border: '1px solid rgba(253,224,71,0.4)',
    color: '#fde047', fontFamily: "'Orbitron', sans-serif", fontWeight: '700',
    fontSize: '11px', letterSpacing: '0.08em',
    boxShadow: '0 0 20px rgba(253,224,71,0.2)',
    animation: 'toast-in 0.3s ease forwards',
  });

  const style = document.createElement('style');
  style.textContent = `@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`;
  toast.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2200);
  setTimeout(() => toast.remove(), 2600);
}
