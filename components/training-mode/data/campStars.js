// Training Camp stars (retention feature 2, switch `path`; the owner's answer
// "Build the camp stars", 2026-11-23). Pure: it reads the session rows it is
// given and writes nothing. Worked out from the rows every time, so a sync, a
// row synced in late or a change of clock cannot leave a star stale.
//
//   ★    the level cleared (every clear, old or new: the camp's own record)
//   ★★   every round of the level done and verified (the end screen's "All
//        rounds verified"), in both sessions on a split level
//   ★★★  done the way the camp asks: no round cut short (SKIP ROUND, or FINISH
//        before the bell), and on a split level Session 2 started four to
//        eight hours after Session 1 ended ("Leave 4-8 hours between
//        missions"). The title fight's "good form" is not measured anywhere
//        (the form gate on its cfg is read by nothing), so its third star asks
//        what is recorded: every round to the bell.
//
// What a camp row records (App.goCampComplete / goCampFullComplete): type
// 'Training Camp', campLevel, completedCount, totalCount, completedAt. From
// this build each camp row also carries `camp`:
//   { slot: 's1' | 's2' | 'one', verified: bool, cut: n | null, startedAt: ISO | null }
// Older camp rows have no `camp`, and an arcade v2 stage writes the same row
// type with its stage number as campLevel, so an older row cannot even be told
// apart from an arcade stage. An older clear therefore shows what its record
// shows: the clear, one star. A replay can earn the rest.

export const CAMP_STAR_MAX = 3;
const HOUR = 3600000;
export const S2_GAP_MIN_MS = 4 * HOUR;
export const S2_GAP_MAX_MS = 8 * HOUR;

const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };

// 'split' (levels 4-11), 'title' (level 12), 'single' (levels 1-3), from the
// camp's own level data (protocol camp-levels: session_pattern / phase).
export function campKind(lv) {
  if (!lv) return 'single';
  if (lv.phase === 'final_boss' || lv.session_pattern === 'single_extended') return 'title';
  return lv.session_pattern === 'split_or_full' ? 'split' : 'single';
}

// The rows of one level that say how they went, oldest first. A row banked
// at the same moment as another (a FULL CAMP sitting banks S1 then S2) keeps
// the order it was banked in.
export function campRowsOf(rows, level) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.type === 'Training Camp' && Number(r.campLevel) === Number(level)
      && r.camp && typeof r.camp === 'object' && ms(r.completedAt) != null)
    .map((r, i) => [r, i])
    .sort((a, b) => (ms(a[0].completedAt) - ms(b[0].completedAt)) || (a[1] - b[1]))
    .map(([r]) => r);
}

// Every round done and verified: the integrity check passed every round and
// none is missing (what the camp asks before a session counts at all).
export const sessionDone = (r) => r?.camp?.verified === true
  && Number(r.totalCount) > 0 && Number(r.completedCount) >= Number(r.totalCount);
// Nothing stopped early: no round cut short. Unknown (null) is not clean.
export const sessionClean = (r) => r?.camp?.cut === 0;

// The level's runs, each { stars: 2 | 3, clean, onTime?, gapMs?, s1?, s2?, row? }.
// A split run is a done Session 2 after a done Session 1 (the latest one
// before it; each Session 1 counts once). A FULL CAMP sitting runs both in one
// go, so its Session 2 starts before its Session 1 is banked: never on time.
export function campRuns(kind, levelRows) {
  const runs = [];
  if (kind === 'split') {
    let s1 = null;
    for (const r of levelRows) {
      if (!sessionDone(r)) continue;
      if (r.camp.slot === 's1') { s1 = r; continue; }
      if (r.camp.slot !== 's2' || !s1) continue;
      const start = ms(r.camp.startedAt) ?? ms(r.completedAt);
      const gapMs = start - ms(s1.completedAt);
      const onTime = gapMs >= S2_GAP_MIN_MS && gapMs <= S2_GAP_MAX_MS;
      const clean = sessionClean(s1) && sessionClean(r);
      runs.push({ stars: onTime && clean ? 3 : 2, clean, onTime, gapMs, s1, s2: r });
      s1 = null;
    }
    return runs;
  }
  for (const r of levelRows) {
    if (!sessionDone(r) || r.camp.slot !== 'one') continue;
    runs.push({ stars: sessionClean(r) ? 3 : 2, clean: sessionClean(r), row: r });
  }
  return runs;
}

// A Session 1 done and waiting for its Session 2 (a split level's run under
// way): { endedAt (ms), clean } or null.
export function pendingSession1(levelRows) {
  let s1 = null;
  for (const r of levelRows) {
    if (!sessionDone(r)) continue;
    if (r.camp.slot === 's1') s1 = r;
    else if (r.camp.slot === 's2' && s1) s1 = null;
  }
  return s1 ? { endedAt: ms(s1.completedAt), clean: sessionClean(s1) } : null;
}

// One level's stars.
// → { level, kind, cleared, stars (0 when not cleared), max: 3, best (run | null),
//     older (cleared, no run on record), next ({ stars } | null), pending (split only) }
export function campLevelStars({ level, kind = 'single', cleared = false, rows = [] }) {
  const own = campRowsOf(rows, level);
  let best = null;
  for (const run of campRuns(kind, own)) if (!best || run.stars > best.stars) best = run;
  const stars = cleared ? Math.max(1, best?.stars || 0) : 0;
  return {
    level, kind, cleared, stars, max: CAMP_STAR_MAX, best,
    older: cleared && !best,
    next: cleared && stars < CAMP_STAR_MAX ? { stars: stars + 1 } : null,
    pending: kind === 'split' ? pendingSession1(own) : null,
  };
}

// Every level's stars for the path: { [level]: stars }, cleared levels only.
//   levels: protocol camp-levels; current: the cursor 1..12; campDone: the title is won
export function campStarsMap({ levels = [], current = 1, campDone = false, rows = [] }) {
  const out = {};
  for (const lv of levels) {
    const cleared = lv.level < current || (campDone && lv.level >= current);
    if (!cleared) continue;
    out[lv.level] = campLevelStars({ level: lv.level, kind: campKind(lv), cleared, rows }).stars;
  }
  return out;
}

// Which session a replay of a cleared split level runs next: Session 2 when a
// replayed Session 1 waits for it, else Session 1 (a run is S1 then S2).
export function campReplaySlot(level, rows) {
  return pendingSession1(campRowsOf(rows, level)) ? 's2' : 's1';
}

// What the next star needs, in plain words.
const NEED = {
  2: { split: 'both sessions, every round done and verified', other: 'every round done and verified' },
  3: { split: 'Session 2 four to eight hours after Session 1, no round cut short', other: 'every round to the bell, none cut short' },
};
const needFor = (stars, kind) => NEED[stars]?.[kind === 'split' ? 'split' : 'other'] || '';
const WHICH = { 2: 'Second', 3: 'Third' };

// The replay sheet's line.
export function campNextStarLine(info) {
  if (!info?.cleared) return '';
  if (!info.next) return 'All three stars. Replays keep your best.';
  if (info.kind === 'split' && info.pending?.clean && info.next.stars >= 2) {
    return 'Session 1 replayed: Session 2 four to eight hours after it, no round cut short, for all three stars.';
  }
  const older = info.older ? 'Cleared before camp stars were kept. ' : '';
  return `${older}${WHICH[info.next.stars]} star: ${needFor(info.next.stars, info.kind)}.`;
}

// The end screen's stars row for a valid camp session on a cleared level:
// the level's stars now (best of its runs) and one short line. A replayed
// Session 1 (a run under way) says when Session 2 counts.
//   info: campLevelStars after this session · justS1: this session was Session 1 of a replay
export function campEndStars(info, { justS1 = false } = {}) {
  if (!info?.cleared) return null;
  let line;
  if (!info.next) line = 'All three stars.';
  else if (justS1 && info.kind === 'split' && info.pending?.clean) line = 'Session 2 four to eight hours from now, no round cut short: all three stars.';
  else line = `Next star: ${needFor(info.next.stars, info.kind)}.`;
  return { stars: info.stars, max: info.max, line };
}
