import { useState, useRef, useEffect, useCallback } from 'react';
import { createStrikeDetector } from '../data/strikeCounter';

// 1.4 — React glue for the strike detector. Owns the DeviceMotion subscription
// and the iOS permission flow, and only samples while `active` (the WORK phase),
// so body movement during rest doesn't inflate the count.
//
// permission: 'unsupported' | 'prompt' | 'granted' | 'denied'.
// motionSeen becomes true once real (non-null) samples arrive, so callers can
// tell "granted but the phone was on a table" (0 real motion) from a genuine
// zero. The remembered grant is persisted so we don't re-prompt every session.
const GRANT_KEY = 'tm_motion_granted';

function detectSupport() {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
}
function needsPrompt() {
  return typeof window !== 'undefined'
    && typeof window.DeviceMotionEvent !== 'undefined'
    && typeof window.DeviceMotionEvent.requestPermission === 'function';
}

export default function useStrikeCounter({ active }) {
  const [supported] = useState(detectSupport);
  const [permission, setPermission] = useState(() => {
    if (!detectSupport()) return 'unsupported';
    if (!needsPrompt()) {
      // Android/desktop: no explicit permission. Remembered grant, else prompt
      // once so we can show the placement hint before counting.
      try { return localStorage.getItem(GRANT_KEY) === 'true' ? 'granted' : 'prompt'; } catch { return 'prompt'; }
    }
    try { return localStorage.getItem(GRANT_KEY) === 'true' ? 'granted' : 'prompt'; } catch { return 'prompt'; }
  });
  const [count, setCount] = useState(0);
  const [motionSeen, setMotionSeen] = useState(false);

  const detectorRef = useRef(null);
  if (!detectorRef.current) detectorRef.current = createStrikeDetector();

  const requestPermission = useCallback(async () => {
    if (!detectSupport()) { setPermission('unsupported'); return 'unsupported'; }
    if (needsPrompt()) {
      try {
        const res = await window.DeviceMotionEvent.requestPermission();
        setPermission(res === 'granted' ? 'granted' : 'denied');
        if (res === 'granted') { try { localStorage.setItem(GRANT_KEY, 'true'); } catch { /* quota */ } }
        return res;
      } catch {
        setPermission('denied');
        return 'denied';
      }
    }
    // No prompt API — treat as granted and remember it.
    setPermission('granted');
    try { localStorage.setItem(GRANT_KEY, 'true'); } catch { /* quota */ }
    return 'granted';
  }, []);

  const reset = useCallback(() => {
    detectorRef.current.reset();
    setCount(0);
    setMotionSeen(false);
  }, []);

  useEffect(() => {
    if (!active || permission !== 'granted' || !supported) return undefined;

    const det = detectorRef.current;
    let seen = false;
    const handler = (e) => {
      const lin = e.acceleration;              // gravity-excluded, if the device provides it
      const raw = e.accelerationIncludingGravity;
      const src = (lin && lin.x != null) ? lin : raw;
      if (!src || src.x == null) return;
      if (!seen) { seen = true; setMotionSeen(true); }
      const t = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
      const n = det.onSample(src.x, src.y, src.z, src === raw, t);
      setCount(n);
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [active, permission, supported]);

  return { supported, permission, count, motionSeen, requestPermission, reset };
}
