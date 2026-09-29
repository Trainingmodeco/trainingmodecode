import { PROGRAMS, programDayIndex } from './workoutPrograms';

// "Continue" on Home: the last session the athlete actually started, kept with
// the settings it ran with, so Home can offer it again in one tap.
//
// Session history (userStats) only records a type and counts — not the
// discipline, rounds or preset — so it can't say "Heavy Bag · 6 × 3:00". This
// is recorded at the moment a session starts, which is when all of that is
// known.
//
// Covered: Just Train / Fight Focus, Combo Coach, Quick Mission, Build Workout
// and Programs, Combat Conditioning, Training Camp, Arcade and Cardio. Camp and
// Arcade keep their own progress, so their Continue opens the map / stage
// ladder on the next session instead of repeating the last one.
const KEY = 'tm_last_session_v1';

export function rememberSession(kind, cfg, disc) {
  if (!cfg) return;
  // A ghost battle is a race against one recorded run — replaying it as a plain
  // "continue" would silently start a race, so the ghost is never stored.
  const { ghost: _ghost, ...clean } = cfg;
  try {
    localStorage.setItem(KEY, JSON.stringify({ kind, cfg: clean, disc: disc || null, at: Date.now() }));
  } catch { /* storage is best-effort */ }
}

export function loadLastSession() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && v.kind && v.cfg ? v : null;
  } catch { return null; }
}

const CARDIO_KIND = { running: 'Run', machine: 'Machine', rounds: 'Rounds', alternate: 'Rounds', exercise: 'Rounds' };
const CARDIO_STYLE = { steady: 'Steady', intervals: 'Intervals', tabata: 'Tabata' };

const titleCase = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const roundsMinutes = (c) =>
  Math.max(1, Math.round((c.rounds * c.roundMin * 60 + Math.max(0, c.rounds - 1) * (c.restSec || 0)) / 60 + (c.warmupMin || 0)));

export function programFor(last) {
  return last?.kind === 'fit' && last.cfg.programId ? PROGRAMS.find(p => p.id === last.cfg.programId) || null : null;
}

// What the Continue card says: which side of the app it belongs to, a title,
// and the "detail · difficulty · time" line under it.
export function describeSession(last) {
  if (!last) return null;
  const c = last.cfg;
  const disc = last.disc || c.discipline || 'Boxing';
  switch (last.kind) {
    case 'timer':
      return c.mode === 'Just Train'
        ? { mode: 'fight', title: 'Just Train', sub: `${disc} · ${c.rounds} × ${mmss(c.roundMin * 60)}`, diff: null, time: `${roundsMinutes(c)} min` }
        : { mode: 'fight', title: 'Fight Focus', sub: `${disc} · ${c.rounds} rounds`, diff: c.difficulty, time: `${roundsMinutes(c)} min` };
    case 'combo':
      return { mode: 'fight', title: 'Combo Coach', sub: `${disc} · ${c.rounds} rounds`, diff: c.difficulty, time: `${roundsMinutes(c)} min` };
    case 'quick_mission':
      return { mode: 'fit', title: 'Quick Mission', sub: c.focus || 'Full Body', diff: c.difficulty, time: `${c.duration} min` };
    case 'fit': {
      const p = programFor(last);
      if (p) {
        // A program continues to its NEXT day, not a repeat of the last one.
        const day = p.days[programDayIndex(p)];
        return { mode: 'fit', title: titleCase(p.title), sub: p.days.length > 1 ? `Next: ${titleCase(day.label)} day` : 'All groups', diff: c.difficulty, time: `${p.duration} min` };
      }
      const groups = (c.muscleGroups || []).slice(0, 3).join(', ') || 'Full body';
      return { mode: 'fit', title: 'Build Workout', sub: groups, diff: c.difficulty, time: `${c.duration} min` };
    }
    case 'cc':
      return { mode: 'fight', title: 'Combat Conditioning', sub: `${c.style || disc} · ${c.rounds} rounds`, diff: c.difficulty, time: `${c.duration} min` };
    case 'camp':
      return {
        mode: 'fight', title: 'Training Camp', cta: 'CONTINUE',
        sub: `${disc}${c.level ? ` · Level ${c.level}` : ''}${c.format === 'full' ? ' · Full camp' : ''}`,
        diff: c.difficulty ? titleCase(c.difficulty) : null, time: null,
      };
    case 'arcade':
      return {
        mode: c.mode === 'fit' ? 'fit' : 'fight', title: c.title ? titleCase(c.title) : 'Training Arcade', cta: 'CONTINUE',
        sub: c.stageNumber ? `Arcade · Stage ${c.stageNumber}` : 'Arcade',
        diff: c.settings?.difficulty ? titleCase(c.settings.difficulty) : null, time: null,
      };
    case 'cardio': {
      const st = c.setup || {};
      const kind = CARDIO_KIND[st.categoryId] || 'Cardio';
      const detail = st.categoryId === 'running' && st.style === 'steady' && st.goalDistance
        ? `${st.goalDistance} ${st.distanceUnit || 'mi'}`
        : (CARDIO_STYLE[st.style] || null);
      return { mode: 'fit', title: st.walkMode ? 'Walk' : 'Cardio', sub: [st.walkMode ? null : kind, detail].filter(Boolean).join(' · ') || 'Cardio', diff: null, time: null };
    }
    default:
      return null;
  }
}
