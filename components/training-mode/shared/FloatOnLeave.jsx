import { useLayoutEffect } from 'react';
import { positionMiniPreview } from './miniPlayer';

// Keeps the floating timer ready to pop up the moment the athlete leaves the
// app, with NOTHING showing inside the timer (owner call: the old in-timer ⧉
// chip was distracting and ugly; the window should be gone until they leave).
//
// Why a component at all: Android's automatic picture-in-picture only
// considers a video that is playing AND inside the viewport, so the painted
// mini-player video cannot be parked off-screen. This parks it as a tiny,
// all-but-transparent square in the bottom corner instead: in the viewport for
// the platform, invisible to the athlete, and never in the way of a tap.
//
// The window itself opens from shared/miniPlayer.js on visibilitychange /
// pagehide and the Media Session action. Where a platform insists on a tap
// before it will float anything, it simply does not appear.
const SIZE = { width: 32, height: 18 };

export default function FloatOnLeave({ supported }) {
  useLayoutEffect(() => {
    if (!supported || typeof window === 'undefined') return undefined;
    const park = () => positionMiniPreview({
      left: 0,
      top: Math.max(0, window.innerHeight - SIZE.height),
      ...SIZE,
      radius: 0,
      zIndex: 1,
      opacity: 0.01,
    });
    park();
    window.addEventListener('resize', park);
    return () => {
      window.removeEventListener('resize', park);
      positionMiniPreview(null);
    };
  }, [supported]);

  return null;
}
