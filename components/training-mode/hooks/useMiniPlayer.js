import { useEffect, useRef, useState, useCallback } from 'react';
import { acquireMiniPlayer, releaseMiniPlayer, endMiniPlayer, miniPlayerSupported } from '../shared/miniPlayer';

// React wrapper around the floating mini-player (see shared/miniPlayer.js for
// why the window is a painted canvas rather than real interface).
//
// The window is shared, not owned. A session spans more than one component —
// the Workout Builder runs a 90-second warm-up gate and THEN mounts the guided
// player — and if each mount owned its own window, that hand-off would close it
// mid-session. Android needs a fresh user gesture to reopen, which the athlete
// cannot give while they are looking at another app. So each component acquires
// the shared window and releases it on unmount; the window only really closes
// if nothing claims it inside the hand-off grace period.
//
// The frame source is read through a ref, so the window always paints CURRENT
// state without the hook re-running on every tick of the clock.
//
// @param {() => object} getFrame  see drawFrame in miniPlayer.js for the shape
// @param {boolean} enabled        false ends the window outright (session over)
export default function useMiniPlayer(getFrame, enabled = true) {
  const frameRef = useRef(getFrame);
  const playerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const supported = useRef(miniPlayerSupported()).current;

  useEffect(() => { frameRef.current = getFrame; }, [getFrame]);

  useEffect(() => {
    if (!supported) return undefined;
    const source = () => frameRef.current?.();
    const player = acquireMiniPlayer(source);
    playerRef.current = player;
    if (!player) return undefined;

    // Inherit the window if a previous screen in this session already opened
    // it, so the button reads correctly straight after a hand-off.
    setOpen(player.isOpen());

    // The athlete can dismiss the window from the system UI, so the button
    // state has to follow the platform rather than assume.
    const onLeave = () => setOpen(false);
    const onEnter = () => setOpen(true);
    player.video.addEventListener('leavepictureinpicture', onLeave);
    player.video.addEventListener('enterpictureinpicture', onEnter);

    return () => {
      player.video.removeEventListener('leavepictureinpicture', onLeave);
      player.video.removeEventListener('enterpictureinpicture', onEnter);
      releaseMiniPlayer(source);
      playerRef.current = null;
    };
  }, [supported]);

  // Session over — the window must not outlive it, grace period or not.
  useEffect(() => {
    if (!enabled) {
      endMiniPlayer();
      setOpen(false);
    }
  }, [enabled]);

  const toggle = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isOpen()) {
      await player.close();
      setOpen(false);
    } else {
      const ok = await player.open();
      setOpen(ok);
    }
  }, []);

  return { supported, open, toggle };
}
