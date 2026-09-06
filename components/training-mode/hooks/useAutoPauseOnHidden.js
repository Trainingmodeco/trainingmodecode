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
// How long automatic picture-in-picture gets to come up before we decide the
// athlete has really gone. Chrome resolves the request well inside this.
const PIP_SETTLE_MS = 400;

export default function useAutoPauseOnHidden(isRunning, onAutoPause, integrity) {
  const runningRef = useRef(isRunning);
  const pauseRef = useRef(onAutoPause);
  const integrityRef = useRef(integrity);
  useEffect(() => { runningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { pauseRef.current = onAutoPause; }, [onAutoPause]);
  useEffect(() => { integrityRef.current = integrity; }, [integrity]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    // The floating mini-player changes what 'hidden' means. If the session's
    // clock is up in a picture-in-picture window, the athlete has NOT left it -
    // they are looking at it from another app - so pausing would freeze the
    // very thing they opened the window to watch. Automatic entry is asked for
    // in the same visibilitychange tick (shared/miniPlayer.js) and resolves a
    // few frames later, so the decision waits briefly and then checks whether
    // a window exists. Where the platform refused the window, this pauses
    // exactly as before.
    let pending = null;
    const onVisibility = () => {
      clearTimeout(pending);
      if (!document.hidden || !runningRef.current) return;
      pending = setTimeout(() => {
        if (!document.hidden || !runningRef.current) return;
        if (document.pictureInPictureElement) {
          // Still an honest background event, not a cheat signal.
          integrityRef.current?.noteHonestPause?.();
          return;
        }
        cancelSpeech();
        pauseRef.current?.();
        integrityRef.current?.noteHonestPause?.();
      }, PIP_SETTLE_MS);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(pending); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
}
