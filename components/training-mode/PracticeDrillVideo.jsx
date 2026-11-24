import { useState, useEffect, useRef, useCallback } from 'react';
import { PLATE } from './PracticeParts';

// The picture in the Practice drill: the clip of the strike being called.
//
// data/drillClips planCall turns a call into clips ("JAB → CROSS" is the jab
// clip, then the cross clip). DrillVideo plays them in order and goes round
// again until the next call. Two <video> elements are stacked: one plays, the
// other already holds the next clip, and they swap when a clip ends, so there
// is no black frame between two strikes.
//
// Every clip a drill can use is fetched once, up front, into memory
// (warmClips), so a switch is instant. A clip that will not load is never
// shown: its call stays as text and the drill carries on.

// ── the clips in memory ────────────────────────────────────────────────────
// src → { url } once loaded, { failed } when it will not load. Call clips are
// a second or two each and every drill reuses them, so they are kept for the
// visit. A whole watch video is let go when its drill closes (releaseClips).
const cache = new Map();

export function warmClips(srcs) {
  if (typeof fetch !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) return;
  for (const src of srcs || []) {
    const had = cache.get(src);
    if (had && !had.failed) continue;
    const entry = { url: null, failed: false };
    cache.set(src, entry);
    fetch(src)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('missing'))))
      .then((blob) => {
        // A host that has no such file answers with the app's own page.
        if (!blob.size || /^text\//.test(blob.type)) throw new Error('not a video');
        const video = /^video\//.test(blob.type) ? blob : new Blob([blob], { type: 'video/mp4' });
        if (cache.get(src) === entry) entry.url = URL.createObjectURL(video);
      })
      .catch(() => { entry.failed = true; });
  }
}

// The in-memory address of a clip, or null while it is not there.
export const clipUrl = (src) => cache.get(src)?.url || null;

export function failClip(src) {
  const entry = cache.get(src);
  if (entry?.url) { try { URL.revokeObjectURL(entry.url); } catch { /* already gone */ } }
  cache.set(src, { url: null, failed: true });
}

export function releaseClips(srcs) {
  for (const src of srcs || []) {
    const entry = cache.get(src);
    if (entry?.url) { try { URL.revokeObjectURL(entry.url); } catch { /* already gone */ } }
    cache.delete(src);
  }
}

// ── the player ─────────────────────────────────────────────────────────────
//   plan      { clips: [{ src, url, label, whole? }] } for the call on screen,
//             or null when the call is text only (and during a rest)
//   paused    the drill is paused
//   onFail    (src) a clip would not play
//   children  what the box shows when there is no clip
const READY = ['loadeddata', 'canplay', 'seeked'];
// A strike clip is square and fills the box. A whole watch video is wide: it sits in the middle, on the plate.
const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0 };

export default function DrillVideo({ plan, paused, onFail, children }) {
  const a = useRef(null);
  const b = useRef(null);
  const el = useCallback((i) => (i === 0 ? a.current : b.current), []);
  // front: which element is showing (-1: neither). i: its place in the
  // sequence. token: goes up with every call, so a late event of the last
  // call does nothing.
  const state = useRef({ front: -1, i: 0, clips: [], token: 0, paused: false, arriving: false });
  const [at, setAt] = useState(null); // the clip on screen

  // Put clip k of the sequence into an element, ready at its first frame.
  const cue = useCallback((which, k) => {
    const v = el(which), c = state.current.clips[k];
    if (!v || !c) return;
    v.loop = !!c.whole;
    v.dataset.clip = c.src;
    if (v.dataset.url !== c.url) { v.dataset.url = c.url; v.src = c.url; v.load(); }
    else { try { v.currentTime = 0; } catch { /* not seekable yet */ } }
  }, [el]);

  // Bring an element (already holding clip k) to the front and play it, then
  // load the clip after it into the other one. It waits for the first frame,
  // so the picture changes from one strike straight to the next.
  const show = useCallback((which, k, token) => {
    const st = state.current, v = el(which), other = el(1 - which);
    if (!v) return;
    let done = false;
    let timer = 0;
    const go = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const name of READY) v.removeEventListener(name, go);
      if (token !== st.token) return;
      st.front = which;
      st.i = k;
      st.arriving = false;
      v.style.opacity = '1';
      v.style.zIndex = '2';
      if (other) { other.style.opacity = '0'; other.style.zIndex = '1'; other.pause(); }
      if (!st.paused) v.play().catch(() => { /* muted, so it plays; if not, the call text is there */ });
      setAt(st.clips[k]);
      if (!st.clips[k].whole) cue(1 - which, (k + 1) % st.clips.length);
    };
    // A clip in memory is ready in a few milliseconds. Should the browser
    // never say so, it is played anyway.
    timer = setTimeout(go, 600);
    if (v.readyState >= 2 && !v.seeking) go(); else for (const name of READY) v.addEventListener(name, go);
  }, [el, cue]);

  // A new call: its first clip goes into the element that is not showing.
  useEffect(() => {
    const st = state.current;
    st.token += 1;
    st.clips = plan?.clips || [];
    if (!st.clips.length) {
      for (const v of [a.current, b.current]) if (v) { v.pause(); v.style.opacity = '0'; }
      st.front = -1;
      st.arriving = false;
      setAt(null);
      return;
    }
    // The same whole video called again carries on from where it is.
    const first = st.clips[0];
    const showing = st.front >= 0 ? el(st.front) : null;
    if (first.whole && showing && showing.dataset.url === first.url) {
      st.i = 0;
      st.arriving = false;
      setAt(first);
      if (!st.paused) showing.play().catch(() => { /* see show */ });
      return;
    }
    const back = st.front === 0 ? 1 : 0;
    // Until it shows, the clip still playing belongs to the last call: its
    // end must not start this one twice.
    st.arriving = true;
    cue(back, 0);
    show(back, 0, st.token);
  }, [plan, el, cue, show]);

  useEffect(() => {
    const st = state.current;
    st.paused = !!paused;
    const v = st.front >= 0 ? el(st.front) : null;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => { /* see above */ });
  }, [paused, el]);

  useEffect(() => {
    const va = a.current, vb = b.current;
    return () => { va?.pause(); vb?.pause(); };
  }, []);

  const ended = (which) => {
    const st = state.current;
    if (which !== st.front || !st.clips.length || st.arriving) return;
    show(1 - which, (st.i + 1) % st.clips.length, st.token);
  };
  const failed = (which) => {
    const src = el(which)?.dataset.clip;
    if (src) onFail?.(src);
  };

  return (
    <div data-testid="drill-video" data-clip={at ? at.src : ''} style={{ position: 'absolute', inset: 0, background: PLATE }}>
      <video ref={a} muted playsInline preload="auto" tabIndex={-1} aria-hidden="true" onEnded={() => ended(0)} onError={() => failed(0)} style={layer}/>
      <video ref={b} muted playsInline preload="auto" tabIndex={-1} aria-hidden="true" onEnded={() => ended(1)} onError={() => failed(1)} style={layer}/>
      {at ? (
        <span data-testid="drill-clip-label" style={{
          position: 'absolute', zIndex: 3, left: 8, top: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(7,10,24,.78)',
          border: '1px solid rgba(242,190,69,.6)', color: '#F2BE45', font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
        }}>{at.label}</span>
      ) : (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>{children}</div>
      )}
    </div>
  );
}
