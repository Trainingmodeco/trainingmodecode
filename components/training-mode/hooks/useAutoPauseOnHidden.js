import { useEffect, useRef } from 'react';
import { cancelSpeech } from '../voiceCoach';

// Auto-pause a running session when the app is backgrounded or the tab loses
// visibility (`visibilitychange` → `document.hidden`). It does exactly what
// pressing PAUSE does — halts the timer and cancels speech — so the user
// returns to the normal paused state with RESUME (we never auto-resume).
//
// Usage in a player:
//   useAutoPauseOnHidden(isRunning, onAutoPause, integrity)
//     - isRunning:    true only while the session is actively ticking (not
//                     already paused, done, or in the intro countdown). Prevents
//                     toggling a paused session back on.
//     - onAutoPause:  the player's pause action (e.g. its PAUSE handler). Called
//                     once when the app goes hidden while running.
//     - integrity:    (optional) the useIntegritySession handle. IMPORTANT —
//                     missionIntegrity's own visibility listener tallies a
//                     background event; we call integrity.noteHonestPause() to
//                     undo it so an honest auto-pause is NOT double-penalized as
//                     a cheat signal. Pausing on backgrounding is the behavior
//                     we want.
export default function useAutoPauseOnHidden(isRunning, onAutoPause, integrity) {
  const runningRef = useRef(isRunning);
  const pauseRef = useRef(onAutoPause);
  const integrityRef = useRef(integrity);
  useEffect(() => { runningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { pauseRef.current = onAutoPause; }, [onAutoPause]);
  useEffect(() => { integrityRef.current = integrity; }, [integrity]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      if (!document.hidden || !runningRef.current) return;
      cancelSpeech();
      pauseRef.current?.();
      integrityRef.current?.noteHonestPause?.();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
