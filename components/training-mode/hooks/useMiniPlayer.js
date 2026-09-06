import { useEffect, useRef, useState, useCallback } from 'react';
import { createMiniPlayer, miniPlayerSupported } from '../shared/miniPlayer';

// React wrapper around the floating mini-player (see shared/miniPlayer.js for
// why the window is a painted canvas rather than real interface).
//
// The frame source is read through a ref, so the player always paints the
// CURRENT round state without the hook re-running on every tick of the clock —
// a session re-renders once a second and rebuilding the capture stream that
// often would tear the window down mid-glance.
//
// @param {() => object} getFrame  returns {clock, eyebrow, label, tone, paused}
// @param {boolean} enabled        false tears the window down (session ended)
export default function useMiniPlayer(getFrame, enabled = true) {
  const frameRef = useRef(getFrame);
  const playerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const supported = useRef(miniPlayerSupported()).current;

  useEffect(() => { frameRef.current = getFrame; }, [getFrame]);

  useEffect(() => {
    if (!supported) return undefined;
    const player = createMiniPlayer(() => frameRef.current?.());
    playerRef.current = player;
    if (!player) return undefined;

    // The athlete can dismiss the window from the system UI, so the button
    // state has to follow the platform rather than assume.
    const onLeave = () => setOpen(false);
    const onEnter = () => setOpen(true);
    player.video.addEventListener('leavepictureinpicture', onLeave);
    player.video.addEventListener('enterpictureinpicture', onEnter);

    return () => {
      player.video.removeEventListener('leavepictureinpicture', onLeave);
      player.video.removeEventListener('enterpictureinpicture', onEnter);
      player.destroy();
      playerRef.current = null;
    };
  }, [supported]);

  // Session over — the window must not outlive it.
  useEffect(() => {
    if (!enabled && playerRef.current) {
      playerRef.current.close();
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
