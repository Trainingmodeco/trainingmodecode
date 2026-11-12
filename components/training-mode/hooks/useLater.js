import { useEffect, useRef } from 'react';
import { createTimerBag } from '../shared/lifecycleGuards';

// Returns a stable `later(fn, ms)` (like setTimeout) whose pending timeouts
// are all cleared when the screen unmounts.
export default function useLater() {
  const bag = useRef(null);
  if (!bag.current) bag.current = createTimerBag();
  useEffect(() => {
    const b = bag.current;
    return () => b.clearAll();
  }, []);
  return bag.current.later;
}
