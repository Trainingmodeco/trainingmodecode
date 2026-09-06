// The floating mini-player: the round clock kept visible over other apps when
// the athlete leaves mid-session (a call, a text, checking a message).
//
// WHY IT IS DRAWN AND NOT LAID OUT. Android will only float a <video>. There is
// no way to put live interface in that window — Document Picture-in-Picture,
// which floats real DOM, is desktop Chrome only. So the timer is PAINTED to a
// canvas, the canvas is captured as a video stream, and that video is what
// floats. Everything the window shows has to be drawn here by hand.
//
// Consequences worth knowing before changing this:
//   • Nothing in the window is tappable. Tapping it just returns to the app.
//     Do not add anything that looks like a button (see PROMPT MP-D).
//   • Entering PiP needs a user gesture on Android, so a session cannot pop the
//     window on its own when backgrounded. `autoPictureInPicture` is set for
//     the platforms that do allow automatic entry (installed PWAs, Safari);
//     everywhere else the athlete taps the button once and the window persists
//     across the app being backgrounded.
//   • Frames are driven by setInterval, never requestAnimationFrame — rAF is
//     throttled to a standstill on a hidden page, which is exactly when this
//     window matters most.

const W = 640;
const H = 360;
const FPS = 10;

// Tones map to the app's own language: violet = working, blue = rest,
// red = the last ten seconds, gold = the live numerals throughout.
const TONES = {
  work: { accent: '#a855f7', ring: 'rgba(168,85,247,0.55)' },
  rest: { accent: '#4f8cff', ring: 'rgba(79,140,255,0.55)' },
  final: { accent: '#ef4444', ring: 'rgba(239,68,68,0.6)' },
};

export function miniPlayerSupported() {
  if (typeof document === 'undefined') return false;
  if (!document.pictureInPictureEnabled) return false;
  const probe = document.createElement('video');
  return typeof probe.requestPictureInPicture === 'function'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export function isMiniPlayerOpen() {
  return typeof document !== 'undefined' && !!document.pictureInPictureElement;
}

function drawFrame(ctx, frame, tick) {
  const tone = TONES[frame.tone] || TONES.work;

  ctx.fillStyle = '#0a0014';
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 6;
  ctx.strokeStyle = tone.ring;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.textAlign = 'center';

  // Round position, small and quiet at the top.
  if (frame.eyebrow) {
    ctx.fillStyle = tone.accent;
    ctx.font = '700 30px Orbitron, system-ui, sans-serif';
    ctx.fillText(frame.eyebrow.toUpperCase(), W / 2, 62);
  }

  // The clock is the hero — this window gets glanced at for a second from
  // arm's length, sometimes shrunk to half size, so it is deliberately huge.
  ctx.fillStyle = '#fde047';
  ctx.font = '900 138px Orbitron, system-ui, sans-serif';
  ctx.fillText(frame.clock || '', W / 2, 196);

  // The current call, if there is room for it.
  if (frame.label) {
    const label = String(frame.label).slice(0, 26).toUpperCase();
    ctx.fillStyle = '#e7ddf7';
    ctx.font = `700 ${label.length > 18 ? 28 : 34}px Orbitron, system-ui, sans-serif`;
    ctx.fillText(label, W / 2, 258);
  }

  // Proof of life. A frozen window and a paused session look identical
  // otherwise, and the athlete has no way to tell which they are looking at.
  const cx = W / 2;
  const cy = 310;
  const span = 150;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - span, cy);
  ctx.lineTo(cx + span, cy);
  ctx.stroke();

  if (frame.paused) {
    ctx.fillStyle = '#9a90b8';
    ctx.font = '700 26px Orbitron, system-ui, sans-serif';
    ctx.fillText('PAUSED', cx, cy + 10);
  } else {
    const t = (tick % 40) / 40;
    const x = cx - span + Math.abs(Math.sin(t * Math.PI)) * (span * 2);
    ctx.beginPath();
    ctx.arc(x, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
  }
}

/**
 * Create a mini-player bound to a frame source.
 * @param {() => {clock:string, eyebrow?:string, label?:string, tone?:string, paused?:boolean}} getFrame
 */
export function createMiniPlayer(getFrame) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  // Honoured where automatic entry is allowed; ignored elsewhere, which is why
  // the button below exists.
  try { video.autoPictureInPicture = true; } catch { /* not supported */ }

  // The element has to live in the document: a detached <video> is accepted by
  // some engines and refused by others, and this has to work on a phone, not
  // just wherever it was last tested. Parked invisibly — it is never the thing
  // the athlete looks at; the floating window is.
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);

  let timer = null;
  let stream = null;
  let tick = 0;
  let destroyed = false;

  const paint = () => {
    if (destroyed) return;
    try { drawFrame(ctx, getFrame() || {}, tick++); } catch { /* a bad frame must never kill the session */ }
  };

  const startPainting = () => {
    if (timer) return;
    paint();
    timer = setInterval(paint, Math.round(1000 / FPS));
  };

  const stopPainting = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  return {
    /** Open the floating window. MUST be called from a user gesture. */
    async open() {
      if (destroyed || !miniPlayerSupported()) return false;
      startPainting();
      if (!stream) {
        stream = canvas.captureStream(FPS);
        video.srcObject = stream;
      }
      try {
        await video.play();
        await video.requestPictureInPicture();
        return true;
      } catch {
        // Refused (no gesture, permission, or unsupported). Stop burning
        // frames for a window that never opened.
        if (!isMiniPlayerOpen()) stopPainting();
        return false;
      }
    },

    async close() {
      try {
        if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      } catch { /* already gone */ }
      stopPainting();
    },

    isOpen() {
      return document.pictureInPictureElement === video;
    },

    destroy() {
      destroyed = true;
      stopPainting();
      try {
        if (document.pictureInPictureElement === video) document.exitPictureInPicture();
      } catch { /* ignore */ }
      try { stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
      video.srcObject = null;
      try { video.remove(); } catch { /* ignore */ }
    },

    /** The element, so callers can listen for the window being closed. */
    video,
  };
}
