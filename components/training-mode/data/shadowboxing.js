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
//   { "clips": [ { "id": "boxing-jab-cross-flow",     // unique, any slug
//                  "discipline": "Boxing",             // Boxing | Kickboxing | Muay Thai | MMA
//                  "group": "Combinations",            // the heading it sits under (optional)
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
const DEFAULT_GROUP = 'Shadowboxing';
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/;

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// One entry of the file, or null when it cannot be shown (a bad entry is
// dropped, never thrown: the rest of the list still plays).
export function parseShadowClip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.id, 80);
  const title = clean(raw.title, 80);
  const video = clean(raw.video, 120);
  if (!id || !title || !FILE.test(video)) return null;
  if (!PRACTICE_DISCIPLINES.includes(raw.discipline)) return null;
  const seconds = Number(raw.seconds);
  return {
    id, title,
    discipline: raw.discipline,
    group: clean(raw.group, 40) || DEFAULT_GROUP,
    level: SHADOW_LEVELS.includes(raw.level) ? raw.level : '',
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

// Reads the list. A phone with no file there gets the app shell back (the
// single-page rewrite) or an error: both mean "no clips yet".
export async function loadShadowClips(fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  if (!fetchImpl) return [];
  try {
    const res = await fetchImpl(SHADOW_INDEX, { cache: 'no-cache' });
    if (!res || !res.ok) return [];
    return parseShadowIndex(await res.json());
  } catch {
    return [];
  }
}

export const shadowClipsFor = (clips, discipline) => clips.filter((c) => c.discipline === discipline);

// [{ group, clips }] in the order each group first appears in the file.
export function shadowGroups(clips) {
  const order = [];
  const by = new Map();
  for (const c of clips) {
    if (!by.has(c.group)) { by.set(c.group, []); order.push(c.group); }
    by.get(c.group).push(c);
  }
  return order.map((group) => ({ group, clips: by.get(group) }));
}

export const shadowClock = (seconds) => (seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '');
