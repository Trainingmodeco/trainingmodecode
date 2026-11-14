import { PRACTICE_DISCIPLINES } from '../practiceData';

// Shadowboxing videos in Practice Mode (Fight Mode › Practice › SHADOWBOXING).
//
// The clips are the owner's follow-along shadowboxing footage, 10 seconds to a
// minute each, cut by the TM Social Console like the Practice tutorials. They
// reach the app as ASSETS ONLY, no code change:
//
//   public/static/practice/shadow/<name>.mp4    720p, about 1 MB, muted is fine
//   public/static/practice/shadow/<name>.webp   the poster, same name
//   public/static/practice/shadow/index.json    the list the screen reads
//
// index.json:
//   { "clips": [ { "id": "boxing-jab-cross-flow",     // unique across the whole list, any slug (a number is fine)
//                  "discipline": "Boxing",             // Boxing | Kickboxing | Muay Thai | MMA (any letter case)
//                  "group": "Combinations",            // the heading it sits under (optional; letter case does not split groups)
//                  "title": "Jab, cross, slip",        // what the tile and the card say
//                  "video": "boxing-jab-cross-flow.mp4",
//                  "seconds": 24,                      // optional, shown as 0:24
//                  "level": "Beginner",                // optional: Beginner | Intermediate | Advanced
//                  "note": "Keep your chin down." } ] } // optional, one line under the video
//
// Without that file the app shows nothing new: the screen's entry row only
// appears once the list holds a clip. The app reads the file on opening
// Practice, so a new delivery shows up on the next visit.

export const SHADOW_DIR = '/static/practice/shadow/';
export const SHADOW_INDEX = `${SHADOW_DIR}index.json`;
export const SHADOW_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
export const DEFAULT_GROUP = 'Shadowboxing';
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/i;
const LOAD_TIMEOUT_MS = 8000;

// Text from the file: trimmed, with invisible characters (zero-width, bidi marks) taken out so a title of nothing
// shows as nothing, and cut by whole characters so an emoji is never split in half.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const clean = (v, max) => (typeof v === 'string' ? Array.from(v.replace(INVISIBLE, '').trim()).slice(0, max).join('').trim() : '');

// One entry of the file, or null when it cannot be shown (a bad entry is
// dropped, never thrown: the rest of the list still plays).
export function parseShadowClip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(typeof raw.id === 'number' ? String(raw.id) : raw.id, 80);
  const title = clean(raw.title, 80);
  const video = clean(raw.video, 120);
  if (!id || !title || !FILE.test(video)) return null;
  const want = clean(raw.discipline, 20).toLowerCase();
  const discipline = PRACTICE_DISCIPLINES.find((d) => d.toLowerCase() === want);
  if (!discipline) return null;
  const seconds = Number(raw.seconds);
  const level = clean(raw.level, 20).toLowerCase();
  return {
    id, title, discipline,
    group: clean(raw.group, 40) || DEFAULT_GROUP,
    level: SHADOW_LEVELS.find((l) => l.toLowerCase() === level) || '',
    note: clean(raw.note, 140),
    seconds: Number.isFinite(seconds) && seconds > 0 && seconds < 3600 ? Math.round(seconds) : 0,
    videoUrl: `${SHADOW_DIR}${video}`,
    posterUrl: `${SHADOW_DIR}${video.replace(/\.mp4$/i, '.webp')}`,
  };
}

// The whole file: a list of clips in the file's own order, first of any
// repeated id kept. Anything that is not the expected shape gives [].
export function parseShadowIndex(json) {
  const list = Array.isArray(json?.clips) ? json.clips : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clip = parseShadowClip(raw);
    if (!clip || seen.has(clip.id)) continue;
    seen.add(clip.id);
    out.push(clip);
  }
  return out;
}

// The last list read, so a second visit to Practice shows its row on the first frame instead of popping in.
let lastClips = [];
export const cachedShadowClips = () => lastClips;
export const _resetShadowCache = () => { lastClips = []; };

// Reads the list. A phone with no file there gets the app shell back (the single-page rewrite) or an error: both mean
// "no clips yet". A request that hangs ends after a few seconds the same way, so the row never turns up at a random moment.
export async function loadShadowClips(fetchImpl = (typeof fetch === 'function' ? fetch : null), { timeoutMs = LOAD_TIMEOUT_MS } = {}) {
  if (!fetchImpl) return [];
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(SHADOW_INDEX, { cache: 'no-cache', ...(ac ? { signal: ac.signal } : {}) });
    if (!res || !res.ok) return (lastClips = []);
    return (lastClips = parseShadowIndex(await res.json()));
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const shadowClipsFor = (clips, discipline) => clips.filter((c) => c.discipline === discipline);

// [{ group, clips }] in the order each group first appears in the file. Groups that differ only in letter case are one
// group, headed with the spelling that came first.
export function shadowGroups(clips) {
  const order = [];
  const by = new Map();
  for (const c of clips) {
    const k = c.group.toLowerCase();
    if (!by.has(k)) { by.set(k, { group: c.group, clips: [] }); order.push(k); }
    by.get(k).clips.push(c);
  }
  return order.map((k) => by.get(k));
}

// The clips as the screen lists them (group by group), which is the order PREVIOUS and NEXT walk.
export const shadowOrder = (clips) => shadowGroups(clips).flatMap((g) => g.clips);

export const shadowClock = (seconds) => (seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '');
