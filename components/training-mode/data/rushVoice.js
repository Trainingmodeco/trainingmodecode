// LT-2 — Rush mode used to say "Rush! Go!" on every activation and nothing
// else, so a session with several surges just repeated the same two words.
// Now: one activation call, then a shuffled pool of push cues while the surge
// runs, and a close-out line when it ends mid-session.

export const RUSH_ACTIVATION = 'Rush mode — go!';
export const RUSH_COMPLETE = 'Rush mode complete.';

const PUSH_LINES = [
  "Give it everything you've got!",
  'Strike hard and fast!',
  'Empty the tank!',
  'Push the pace — faster!',
  "Don't slow down now!",
  'Finish strong!',
  'Hands up — keep firing!',
  'Leave nothing behind!',
];

// Push cues land every 8–10s so they punctuate the surge instead of nagging.
const CUE_MIN_SEC = 8;
const CUE_MAX_SEC = 10;

export function nextCueDelaySec() {
  return CUE_MIN_SEC + Math.floor(Math.random() * (CUE_MAX_SEC - CUE_MIN_SEC + 1));
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle-bag rather than plain random: every line is heard once before any
// repeats, and a reshuffle never puts the same line back-to-back.
export function createRushVoice() {
  let bag = [];
  let lastLine = null;

  function refill() {
    bag = shuffled(PUSH_LINES);
    if (bag.length > 1 && bag[0] === lastLine) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }

  return {
    nextLine() {
      if (bag.length === 0) refill();
      const line = bag.shift();
      lastLine = line;
      return line;
    },
    reset() {
      bag = [];
      lastLine = null;
    },
  };
}
