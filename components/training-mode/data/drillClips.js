import CALL_CLIPS from './callClips.json';
import { NUMBERED } from './strikeNumbering';
import { disciplineSlug } from './arsenal';
import { STANCE_GROUP } from './practiceMoves';

// The video of the strike being called, for the Practice drill.
//
// data/callClips.json lists the short cuts the app has, one strike each:
//   { "dir": "/static/practice/calls/",
//     "clips": { "jab": { "file": "jab.mp4", "ms": 1100 },
//                "stance:boxing": { "file": "stance-boxing.mp4", "ms": 4500 } } }
// A key is a strike name in lower case, as the Technique Library spells it,
// or "stance:<discipline>". More cuts are added over time, so nothing here
// knows which keys exist.
//
// planCall turns one call of a drill into the clips to play in order:
//   "JAB"            the jab clip, looped
//   "JAB → CROSS"    the jab clip, then the cross clip, looped
//   "JAB × 2"        the jab clip twice
//   "1-2-3"          jab, cross, lead hook (data/strikeNumbering)
//   "3 TO THE BODY"  the body hook
//   "RESET STANCE"   the discipline's stance clip, once
// A call with any part the app has no clip for gets no plan (the screen shows
// the call as text), so the picture never shows a strike that was not called.

const MAX_HOLD_MS = 9000;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/i;
// Said alone, a hook is the lead hook and an uppercut the lead uppercut.
const ALONE = { hook: 'lead hook', uppercut: 'lead uppercut' };
// '1' is the jab, '3B' the body hook.
const BY_NUMBER = Object.fromEntries(Object.values(NUMBERED).map((n) => [n.num, n.name.toUpperCase()]));

// The strikes of a call, in order, in capitals. null for a call that cannot
// be read (an empty part, a number with no punch).
export function callParts(call) {
  const out = [];
  for (const raw of String(call ?? '').split('→')) {
    let part = raw.replace(/\s+/g, ' ').trim().toUpperCase();
    let times = 1;
    const twice = part.match(/^(.+) × 2$/);
    if (twice) { part = twice[1].trim(); times = 2; }
    if (!part) return null;
    let names = [part];
    const body = part.match(/^(\d) TO THE BODY$/);
    if (body) names = [BY_NUMBER[`${body[1]}B`]];
    else if (/^\d(-\d)*$/.test(part)) names = part.split('-').map((d) => BY_NUMBER[d]);
    if (names.some((n) => !n)) return null;
    for (let i = 0; i < times; i++) out.push(...names);
  }
  return out.length ? out : null;
}

const isStanceFocus = (focus) => !!focus && focus.group === STANCE_GROUP;

function clipOf(table, key) {
  const c = table && table.clips ? table.clips[key] : null;
  if (!c || typeof c.file !== 'string' || !FILE.test(c.file)) return null;
  const ms = Number(c.ms);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const dir = typeof table.dir === 'string' && table.dir ? table.dir.replace(/\/?$/, '/') : '/static/practice/calls/';
  return { src: `${dir}${c.file}`, ms: Math.round(ms) };
}

// The focus move's own single call: its name ("REAR KNEE"), a shorter word
// its lesson uses for it ("KNEE", "ROUNDHOUSE"), or one of them doubled.
// Never a combination, and never another strike ("LEAD KNEE" in the Rear
// Knee drill).
function isOwnCall(call, focus) {
  if (!focus || !focus.name || String(call).includes('→')) return false;
  const words = (t) => String(t).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const said = words(String(call).replace(/ × 2$/, ''));
  const name = words(focus.name);
  if (!said.length) return false;
  if (said.join(' ') === name.join(' ')) return true;
  return (focus.calls || []).includes(call) && said.every((w) => name.includes(w));
}

// One call of a drill as clips, or null when it is shown as text only.
//   discipline  the discipline being drilled (picks the stance clip)
//   focus       the move being drilled: { name, calls, group }
//               (data/practiceMoves drillFor or groupDrill)
//   watch       that move's watch video (data/practiceMoves watchFor), if any
//   callMs      how long the round holds a call with no video (3500 or 3000)
// Returns { clips: [{ src, ms, label }], holdMs }. `label` names the strike
// on the picture. `holdMs` is how long the call stays up: a stance clip plays
// once, one strike loops three times, a combination twice, and it is never
// shorter than callMs or longer than 9 seconds.
// When a part has no clip but the call is the focus move's own, the move's
// watch video is played whole instead: { src, ms: null, whole: true }.
export function planCall(call, options, table = CALL_CLIPS) {
  const { discipline, focus, watch, callMs = 3000 } = options || {};
  const parts = callParts(call);
  if (!parts) return null;
  const floor = Math.min(MAX_HOLD_MS, Math.max(0, Number(callMs) || 0));
  const stanceKey = `stance:${disciplineSlug(discipline)}`;
  // Every call of a stance move is the stance: STEP FORWARD, HANDS HIGH.
  const stanceCall = isStanceFocus(focus) && (focus.calls || []).includes(call);
  const clips = parts.map((part) => {
    const stance = stanceCall || /STANCE|GUARD/.test(part);
    const key = stance ? stanceKey : (ALONE[part.toLowerCase()] || part.toLowerCase());
    const clip = clipOf(table, key);
    return clip ? { ...clip, label: stance ? 'STANCE' : key.toUpperCase(), stance } : null;
  });

  if (clips.every(Boolean)) {
    const once = clips.reduce((sum, c) => sum + c.ms, 0);
    const loops = clips.length > 1 ? 2 : clips[0].stance ? 1 : 3;
    return {
      clips: clips.map(({ src, ms, label }) => ({ src, ms, label })),
      holdMs: Math.min(MAX_HOLD_MS, Math.max(floor, once * loops)),
    };
  }
  if (watch && watch.src && isOwnCall(call, focus)) {
    return { clips: [{ src: watch.src, ms: null, whole: true, label: focus.name.toUpperCase() }], holdMs: floor };
  }
  return null;
}

// Every video a set of calls can play, each once: what the drill fetches up
// front so the picture changes at once.
export function drillSources(calls, options, table = CALL_CLIPS) {
  const out = [];
  for (const call of calls || []) {
    for (const c of planCall(call, options, table)?.clips || []) if (!out.includes(c.src)) out.push(c.src);
  }
  return out;
}
