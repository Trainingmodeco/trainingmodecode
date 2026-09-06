// The floating mini-player: the active workout follows the athlete out of the
// app. Implements VARIANT A · GLANCE of PROMPT MP-D.
//
// WHY IT IS PAINTED AND NOT LAID OUT. Android floats only a <video>. Document
// Picture-in-Picture, which floats real DOM, is desktop Chrome only. So the
// window is PAINTED to a canvas, the canvas is captured as a stream, and that
// video is what floats. Every pixel here is drawn by hand.
//
// Consequences, all of which the design depends on:
//   • A web PiP frame is a video. Taps inside it do nothing, so GLANCE draws
//     ZERO buttons — a control that cannot be pressed is worse than none. The
//     OS owns tap-to-return. (VARIANT B · CONTROL, with a real control band,
//     needs the native wrapper; it cannot be built on this path.)
//   • Frames run on setInterval, NEVER requestAnimationFrame: rAF is throttled
//     to a standstill on a hidden page, which is exactly when this matters.
//   • The page is never told how large the OS drew the window, so COMPACT
//     cannot be detected on web — the layout is drawn once and scaled down by
//     the system. That is why the clock is oversized and the content is thin.
//
// Drawn in a 320x180 LOGICAL space (the spec's window) on a 2x backing canvas,
// so the numbers below match MP-D directly.

const VW = 320;   // logical window
const VH = 180;
const SCALE = 2;  // backing store: 640x360
const FPS = 10;

const GOLD = '#fde047';
const VIOLET = '#a855f7';
const BG = '#0a0014';
const WHITE = '#ffffff';
const MUTED = '#9a90b8';
const DESAT = '#6d5a8f';   // every colour collapses to this when paused

const HEAD = 'Orbitron, system-ui, sans-serif';
const BODY = 'Rajdhani, system-ui, sans-serif';

const PAD = 14;
const RING_D = 112;
const RING_STROKE = 8;
const RING_CX = PAD + RING_D / 2;
const RING_CY = VH / 2;
const COL_X = PAD + RING_D + 12;
const COL_W = VW - COL_X - PAD;

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

// Names ellipsize, never wrap (MP-D). One line or nothing.
function ellipsize(ctx, text, maxWidth) {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(str.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return str.slice(0, lo).trimEnd() + '…';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Phase drives colour, and colour is the whole state language:
// gold = rest/done/primary, violet = work/structure. Paused desaturates all of
// it — the ABSENCE of colour and motion is the paused signal.
function palette(phase) {
  if (phase === 'paused') return { arc: DESAT, accent: DESAT, text: DESAT, sub: DESAT };
  if (phase === 'work') return { arc: VIOLET, accent: VIOLET, text: WHITE, sub: MUTED };
  return { arc: GOLD, accent: GOLD, text: WHITE, sub: MUTED };  // rest + chain
}

function drawRing(ctx, f, p, tick) {
  const r = (RING_D - RING_STROKE) / 2;

  ctx.lineWidth = RING_STROKE;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(RING_CX, RING_CY, r, 0, Math.PI * 2);
  ctx.stroke();

  const pct = Math.max(0, Math.min(1, Number(f.progress) || 0));
  if (pct > 0) {
    ctx.save();
    if (f.phase !== 'paused') {
      ctx.shadowColor = p.arc;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = p.arc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(RING_CX, RING_CY, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Proof of life #1: a breathing dot riding the head of the arc, 1.1s cycle.
  // Stops dead when paused — that stillness IS the paused signal.
  if (f.phase !== 'paused') {
    const cycle = (tick % (1.1 * FPS)) / (1.1 * FPS);
    const grow = 1 + Math.sin(cycle * Math.PI * 2) * 0.35;
    const a = -Math.PI / 2 + pct * Math.PI * 2;
    ctx.save();
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(RING_CX + Math.cos(a) * r, RING_CY + Math.sin(a) * r, 3.5 * grow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Centre: the clock is the hero. WORK swaps it for the live rep count in the
  // SAME frame — no re-layout, only the content and the colour change.
  ctx.textAlign = 'center';
  const showReps = f.phase === 'work' && Number.isFinite(f.reps);
  ctx.fillStyle = f.phase === 'paused' ? DESAT : WHITE;
  ctx.font = `900 30px ${HEAD}`;
  ctx.fillText(showReps ? String(f.reps) : (f.clock || '—'), RING_CX, RING_CY + 9);

  const label = f.phase === 'paused' ? 'PAUSED'
    : f.phase === 'work' ? (showReps ? (f.repsLabel || 'REPS') : 'WORK')
      : f.phase === 'chain' ? 'GO IN'
        : 'REST';
  ctx.fillStyle = p.accent;
  ctx.font = `700 7px ${HEAD}`;
  ctx.fillText(label, RING_CX, RING_CY + 24);

  if (f.phase === 'paused') {
    ctx.fillStyle = MUTED;
    ctx.font = `600 6.5px ${BODY}`;
    ctx.fillText('tap to resume', RING_CX, RING_CY + 36);
  }
}

function drawColumn(ctx, f, p, y) {
  ctx.textAlign = 'left';

  // Eyebrow — position in the workout. CHAIN replaces the set line with the
  // chain pill, because during a hand-off the set number is not the story.
  if (f.phase === 'chain' && f.chainLabel) {
    const text = `⛓ ${f.chainLabel}`;
    ctx.font = `700 7px ${HEAD}`;
    const w = Math.min(COL_W, ctx.measureText(text).width + 12);
    ctx.fillStyle = 'rgba(253,224,71,0.14)';
    roundRect(ctx, COL_X, y.eyebrow - 8, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillText(text, COL_X + 6, y.eyebrow);
  } else {
    const bits = [];
    if (Number.isFinite(f.exIdx) && Number.isFinite(f.exTotal)) bits.push(`EXERCISE ${f.exIdx}/${f.exTotal}`);
    if (Number.isFinite(f.setIdx) && Number.isFinite(f.setTotal)) bits.push(`SET ${f.setIdx}/${f.setTotal}`);
    if (bits.length) {
      ctx.fillStyle = f.phase === 'paused' ? DESAT : VIOLET;
      ctx.font = `700 7px ${HEAD}`;
      ctx.fillText(bits.join(' · '), COL_X, y.eyebrow);
    }
  }

  // Exercise name — the second-loudest thing in the window.
  if (f.name) {
    ctx.fillStyle = f.phase === 'paused' ? DESAT : WHITE;
    ctx.font = `900 14px ${HEAD}`;
    ctx.fillText(ellipsize(ctx, String(f.name).toUpperCase(), COL_W), COL_X, y.name);
  }

  // Prescription + working weight.
  if (f.prescription) {
    ctx.fillStyle = p.sub;
    ctx.font = `600 9px ${BODY}`;
    ctx.fillText(ellipsize(ctx, f.prescription, COL_W), COL_X, y.presc);
  }

  // Segmented progress — one cell per exercise. Done gold, current half-filled
  // violet, queued faint. The same language the guided player's own bar uses.
  const segs = Array.isArray(f.segments) ? f.segments : [];
  if (segs.length) {
    const gap = 2;
    const cw = Math.max(2, (COL_W - gap * (segs.length - 1)) / segs.length);
    segs.forEach((state, i) => {
      const x = COL_X + i * (cw + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y.segs, cw, 3);
      if (f.phase === 'paused') return;
      if (state === 'done') { ctx.fillStyle = GOLD; ctx.fillRect(x, y.segs, cw, 3); }
      else if (state === 'current') { ctx.fillStyle = VIOLET; ctx.fillRect(x, y.segs, cw / 2, 3); }
    });
  }

  // Up next.
  if (f.nextName) {
    ctx.fillStyle = f.phase === 'paused' ? DESAT : 'rgba(168,85,247,0.85)';
    ctx.font = `700 7px ${HEAD}`;
    ctx.fillText('UP NEXT', COL_X, y.upNextLabel);
    ctx.fillStyle = p.sub;
    ctx.font = `700 9px ${HEAD}`;
    ctx.fillText(ellipsize(ctx, String(f.nextName).toUpperCase(), COL_W), COL_X, y.upNext);
  }
}

function drawFrame(ctx, frame, tick) {
  const f = frame || {};
  const p = palette(f.phase);

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, VW, VH);

  // Window: rounded, violet-bordered, everything clipped inside it.
  ctx.save();
  roundRect(ctx, 0.5, 0.5, VW - 1, VH - 1, 14);
  ctx.clip();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, VW, VH);

  // Proof of life #2: a scan line sweeping the top edge on a 1s loop. Between
  // this and the breathing dot, a live window can never be mistaken for a
  // frozen screenshot — which is the actual design problem here.
  if (f.phase !== 'paused') {
    const t = (tick % FPS) / FPS;
    const w = 90;
    const x = -w + t * (VW + w);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(168,85,247,0)');
    grad.addColorStop(0.5, 'rgba(168,85,247,0.85)');
    grad.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, 2);
  }

  drawRing(ctx, f, p, tick);
  drawColumn(ctx, f, p, {
    eyebrow: 42, name: 62, presc: 78, segs: 88, upNextLabel: 112, upNext: 126,
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(154,144,184,0.65)';
  ctx.font = `700 6.5px ${HEAD}`;
  ctx.fillText('TRAINING MODE', VW - PAD, VH - 10);

  ctx.restore();

  ctx.strokeStyle = 'rgba(168,85,247,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, VW - 1, VH - 1, 14);
  ctx.stroke();
}

/**
 * Create a mini-player bound to a frame source.
 * @param {() => object} getFrame  see drawFrame for the shape
 */
export function createMiniPlayer(getFrame) {
  if (typeof document === 'undefined') return null;

  let source = getFrame;

  const canvas = document.createElement('canvas');
  canvas.width = VW * SCALE;
  canvas.height = VH * SCALE;
  const ctx = canvas.getContext('2d');

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  // Honoured where automatic entry is allowed; ignored elsewhere, which is why
  // the button exists.
  try { video.autoPictureInPicture = true; } catch { /* not supported */ }

  // The element has to live in the document: a detached <video> is accepted by
  // some engines and refused by others, and this has to work on a phone.
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);

  let timer = null;
  let stream = null;
  let tick = 0;
  let destroyed = false;

  const paint = () => {
    if (destroyed) return;
    try { drawFrame(ctx, source?.(), tick++); } catch { /* a bad frame must never kill the session */ }
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

  // Get the video PLAYING before anyone asks for a window. Every automatic
  // route into picture-in-picture - Android's autoPictureInPicture for an
  // installed PWA, desktop Chrome's Auto-PiP through the Media Session action
  // - fires only for a video that is already playing when the page is hidden.
  // A muted captured stream may play without a gesture, so this can run the
  // moment a session acquires the window.
  const prime = async () => {
    if (destroyed || !miniPlayerSupported()) return false;
    startPainting();
    if (!stream) {
      stream = canvas.captureStream(FPS);
      video.srcObject = stream;
    }
    try { await video.play(); return true; } catch { return false; }
  };

  // Desktop Chrome enters picture-in-picture BY ITSELF on a tab switch when the
  // page registers this action and the video is playing (Auto-PiP, M120+).
  // Without the handler the browser never offers it.
  const enterFromSession = async () => {
    if (destroyed || isMiniPlayerOpen()) return;
    try { await prime(); await video.requestPictureInPicture(); } catch { /* platform said no - the button remains */ }
  };
  try { navigator.mediaSession?.setActionHandler?.('enterpictureinpicture', enterFromSession); } catch { /* unsupported action */ }

  return {
    /** Paint + play without opening. Called on acquire so automatic entry can work. */
    prime,

    /** Best-effort automatic entry (visibilitychange / pagehide). Fails quietly where a gesture is required. */
    enterFromSession,

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
        // Keep painting: a refused request (no gesture yet) must not stop the
        // primed video, or automatic entry has nothing playing to float.
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
      try { navigator.mediaSession?.setActionHandler?.('enterpictureinpicture', null); } catch { /* ignore */ }
      try {
        if (document.pictureInPictureElement === video) document.exitPictureInPicture();
      } catch { /* ignore */ }
      try { stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
      video.srcObject = null;
      try { video.remove(); } catch { /* ignore */ }
    },

    /** Exposed for tests: paint one frame and hand back a data URL. */
    _snapshot() { paint(); return canvas.toDataURL('image/png'); },

    /** Swap the live frame source without disturbing the open window. */
    setSource(fn) { source = fn; },

    /** The element, so callers can listen for the window being closed. */
    video,
  };
}

// ── One window for the whole app ───────────────────────────────────────────
//
// A session is not one component. The Workout Builder runs a 90-second warm-up
// gate and THEN mounts the guided player, and each is a separate mount. If the
// mini-player belonged to a component, that hand-off would tear the floating
// window down at exactly the moment the athlete is mid-session — and Android
// needs a fresh user gesture to reopen it, which they cannot give while looking
// at another app.
//
// So the window is a singleton. Components ACQUIRE it (swapping the frame
// source) and RELEASE it on unmount; the window itself only closes if nothing
// claims it within a short grace period, which is what distinguishes a hand-off
// from the session actually ending.
const HANDOFF_GRACE_MS = 2500;

let shared = null;
let currentSource = null;
let idleTimer = null;

// Automatic entry: when the athlete leaves the app mid-session, ask for the
// window right there. Android requires a user gesture for this and will refuse
// it - that is why the button exists - but an installed PWA with
// autoPictureInPicture, and desktop Chrome with the Media Session action, can
// say yes. Asking costs nothing where the answer is no.
let hideListener = null;
function watchForExit() {
  if (hideListener || typeof document === 'undefined') return;
  hideListener = () => {
    if (!document.hidden || !shared || !currentSource) return;
    shared.enterFromSession();
  };
  document.addEventListener('visibilitychange', hideListener);
  window.addEventListener('pagehide', hideListener);
}
function unwatchForExit() {
  if (!hideListener) return;
  document.removeEventListener('visibilitychange', hideListener);
  window.removeEventListener('pagehide', hideListener);
  hideListener = null;
}

export function acquireMiniPlayer(getFrame) {
  if (typeof document === 'undefined') return null;
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!shared) shared = createMiniPlayer(() => currentSource?.());
  currentSource = getFrame;
  // Primed from the first acquire, so leaving the app finds a playing video.
  shared.prime();
  watchForExit();
  return shared;
}

export function releaseMiniPlayer(getFrame) {
  if (currentSource === getFrame) currentSource = null;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Nobody picked the window up — the session is over, not handing off.
    if (currentSource) return;
    shared?.destroy();
    shared = null;
    unwatchForExit();
  }, HANDOFF_GRACE_MS);
}

/** End the session's window immediately, hand-off grace or not. */
export function endMiniPlayer() {
  clearTimeout(idleTimer);
  idleTimer = null;
  currentSource = null;
  shared?.destroy();
  shared = null;
  unwatchForExit();
}
