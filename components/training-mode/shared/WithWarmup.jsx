import { useState } from 'react';
import WarmupTimer from './WarmupTimer';

// LT-3 — puts a warm-up in front of a session without touching that session's
// phase machine. `children` is a JSX element, so it isn't mounted (and its
// timers/voice don't start) until the warm-up hands over.
//
// Skipped entirely when resuming a paused session — you already warmed up.
export default function WithWarmup({ minutes = 0, title, enabled = true, children }) {
  const [warming, setWarming] = useState(enabled && minutes > 0);
  if (warming) {
    return (
      <WarmupTimer
        minutes={minutes}
        title={title}
        onDone={() => setWarming(false)}
        onSkip={() => setWarming(false)}
      />
    );
  }
  return children;
}
