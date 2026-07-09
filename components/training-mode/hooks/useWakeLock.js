import { useEffect, useRef, useState } from 'react';

export default function useWakeLock(active) {
  const wakeLockRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const [acquired, setAcquired] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      setSupported(false);
      return;
    }

    async function request() {
      if (!active) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = lock;
        setAcquired(true);
        lock.addEventListener('release', () => {
          wakeLockRef.current = null;
          setAcquired(false);
        });
      } catch (_e) {
        setAcquired(false);
      }
    }

    async function release() {
      if (wakeLockRef.current) {
        try { await wakeLockRef.current.release(); } catch (_e) { /* ignored */ }
        wakeLockRef.current = null;
        setAcquired(false);
      }
    }

    function handleVisibility() {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible' && active) {
        request();
      }
    }

    if (active) {
      request();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibility);
      }
    } else {
      release();
    }

    return () => {
      release();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [active]);

  return { supported, acquired };
}
