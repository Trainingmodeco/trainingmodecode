// Fit · THE WORKOUT CARD's own storage (switch `fitCard`): one key, synced
// with the rest of the athlete's progress (data/cloudSync SYNC_KEYS).
//
//   saved     SAVE WORKOUT's workouts (newest first, at most MAX_SAVED): a
//             snapshot of the moves, doses, rests and rounds (data/fitCard
//             snapshotOf), listed in CHOOSE under YOUR SAVED. Saving never
//             writes stats or XP: the run was banked once already, when it
//             ended.
//   recent    the last MAX_RECENT card runs, by the id their session row
//             carries (cardId), so YOUR WORKOUTS can put one back on the card.
//   checkOff  AT YOUR PACE's CHECK-OFF: the athlete's remembered choice (on
//             unless they turned it off).
//
// Nothing here is read or written with the switch off.
export const FIT_CARD_KEY = 'tm_fit_card_v1';
export const MAX_SAVED = 10;
export const MAX_RECENT = 20;

const empty = () => ({ saved: [], recent: [], checkOff: true });

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function loadFitCard() {
  try {
    const raw = storage()?.getItem(FIT_CARD_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return empty();
    return {
      saved: Array.isArray(v.saved) ? v.saved.filter((s) => s && s.id && Array.isArray(s.exercises)) : [],
      recent: Array.isArray(v.recent) ? v.recent.filter((s) => s && s.id && Array.isArray(s.exercises)) : [],
      checkOff: v.checkOff !== false,
    };
  } catch { return empty(); }
}

function write(next) {
  try { storage()?.setItem(FIT_CARD_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  return next;
}

export const checkOffOn = () => loadFitCard().checkOff;
export const setCheckOff = (on) => write({ ...loadFitCard(), checkOff: !!on }).checkOff;

// Two snapshots are the same workout when their moves, doses and rounds match.
export const workoutSignature = (s) => JSON.stringify([s.rounds, (s.exercises || []).map((e) => [e.name, e.mode, e.reps ?? e.work])]);

// SAVE WORKOUT. The same workout saved twice is kept once (the newer on top);
// a full shelf drops the oldest. Returns the saved entry.
export function saveCardWorkout(snapshot, now = Date.now()) {
  const cur = loadFitCard();
  const sig = workoutSignature(snapshot);
  const entry = { ...snapshot, id: `saved-${now.toString(36)}`, savedAt: now };
  const saved = [entry, ...cur.saved.filter((s) => workoutSignature(s) !== sig)].slice(0, MAX_SAVED);
  write({ ...cur, saved });
  return entry;
}
export const loadSavedWorkouts = () => loadFitCard().saved;
export const isSaved = (snapshot) => loadFitCard().saved.some((s) => workoutSignature(s) === workoutSignature(snapshot));

// A finished card run, kept for YOUR WORKOUTS' repeat.
export function rememberCardRun(id, snapshot) {
  if (!id || !snapshot) return;
  const cur = loadFitCard();
  write({ ...cur, recent: [{ ...snapshot, id }, ...cur.recent.filter((s) => s.id !== id)].slice(0, MAX_RECENT) });
}
export const cardRunById = (id) => (id ? loadFitCard().recent.find((s) => s.id === id) || null : null);
