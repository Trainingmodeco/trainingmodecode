import { useEffect, useState } from 'react';
import { createWakeLockHolder } from '../shared/lifecycleGuards';

export default function useWakeLock(active) {
  const [supported, setSupported] = useState(true);
  const [acquired, setAcquired] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      setSupported(false);
      return undefined;
    }
    if (!active) return undefined;

    // One holder per run: cleanup disposes it, and a lock that arrives after
    // that is released at once (see createWakeLockHolder).
    const holder = createWakeLockHolder(() => navigator, setAcquired);

    function handleVisibility() {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') holder.request();
    }

    holder.request();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      holder.dispose();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [active]);

  return { supported, acquired };
}
