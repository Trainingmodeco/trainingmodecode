// The path + stars (retention feature 2, switch `path`): what the path shows
// for a saga or for Training Camp, worked out from what is stored today. Pure:
// it reads nothing and writes nothing, and it never changes how a star is
// earned or kept (data/arcadeProgress completeStage, concepts/saga).
//
// Stars per saga type (BUILD-SPEC.md §2):
//   classic (One Hundred)  time tiers, 3 (getStarTiersForStage); a stage with no tiers: a check mark
//   v2, several paths      one star per path available (FIT / FIGHT / BOTH)
//   v2, one path           1 (a clear)
//   concept saga           one star per arc cleared (FIT / FIGHT / BOTH)
//   Training Camp          no star rule: a check mark on a cleared level
import { getStarTiersForStage } from './trainingArcadeData';

export const PATH_LABEL = { fit: 'FIT', fight: 'FIGHT', both: 'BOTH' };

// The saga's own rule (before a stage's tiers are looked at).
export function sagaStarRule(series) {
  if (series?.conceptId) {
    const paths = series.modeOptions?.length ? series.modeOptions : ['fit', 'fight', 'both'];
    return { kind: 'arcs', max: paths.length, paths };
  }
  if (series?.v2Campaign) {
    const paths = series.modeOptions || [];
    return paths.length > 1 ? { kind: 'paths', max: paths.length, paths } : { kind: 'single', max: 1, paths };
  }
  return { kind: 'time', max: 3 };
}

// One stage's rule: a classic stage with no time tiers has no stars.
export function stageStarRule(series, stage) {
  const rule = sagaStarRule(series);
  if (rule.kind !== 'time') return rule;
  const tiers = getStarTiersForStage(stage);
  if (!tiers) return { kind: 'none', max: 0 };
  return { kind: 'time', max: 3, tiers: [...tiers].sort((a, b) => b.stars - a.stars) };
}

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
export const fmtTime = mmss;

// A gap in plain words: "12 s", "1:10".
export function fmtGap(sec) {
  const s = Math.max(1, Math.round(sec));
  return s < 60 ? `${s} s` : mmss(s);
}

const ORDINAL = { 1: 'first', 2: 'second', 3: 'third' };

// What a stage shows on the path and in its replay sheet.
//   entry: progress.completedStages[stage.id] (or undefined)
// → { kind, cleared, stars (null when the stage has no stars), max, check,
//     bestSec, paths (cleared), missing, all (the saga's paths, when known), next }
//   next: { stars, needs: 'under 22:00', gapSec? } for time tiers,
//         { paths: ['fight', 'both'] } for paths and arcs, null when nothing is left.
export function stageStars(series, stage, entry) {
  const rule = stageStarRule(series, stage);
  const cleared = !!entry?.completed;
  const base = { kind: rule.kind, cleared, max: rule.max, bestSec: null, paths: [], missing: [], next: null, check: false };
  if (!cleared) return { ...base, stars: rule.kind === 'none' ? null : 0 };
  const best = entry.bestTimeSeconds ?? entry.timeSeconds ?? entry.durationSeconds;
  const bestSec = Number.isFinite(best) && best > 0 ? best : null;
  if (rule.kind === 'none') return { ...base, stars: null, check: true, bestSec };
  // The ladder shows a clear as at least one star (`stars || 1`).
  const raw = Number(entry.stars) > 0 ? Math.round(Number(entry.stars)) : 1;
  const stars = Math.max(1, Math.min(rule.max, raw));
  const out = { ...base, stars, bestSec };
  if (rule.kind === 'time') {
    const tier = stars < 3 ? rule.tiers.find((t) => t.stars === stars + 1) : null;
    if (tier) {
      const needSec = tier.maxMinutes * 60;
      out.next = { stars: tier.stars, needs: `under ${mmss(needSec)}`, ...(bestSec != null && bestSec >= needSec ? { gapSec: bestSec - needSec + 1 } : {}) };
    }
    return out;
  }
  if (rule.kind === 'paths' || rule.kind === 'arcs') {
    const paths = Array.isArray(entry.paths) ? entry.paths.filter((p) => rule.paths.includes(p)) : [];
    out.paths = paths;
    // An old clear saved before paths were kept: its paths are not known.
    out.missing = Array.isArray(entry.paths) ? rule.paths.filter((p) => !paths.includes(p)) : [];
    out.all = Array.isArray(entry.paths) ? rule.paths : [];
    if (stars < rule.max) out.next = { paths: out.missing };
  }
  return out;
}

// The replay sheet's line: what the next star needs, in plain words.
export function nextStarLine(info) {
  if (!info?.cleared) return '';
  const keep = 'Replays keep your best result.';
  if (info.kind === 'none') return `This stage has no star times. ${keep}`;
  if (info.kind === 'single') return `One star for a clear on this saga. ${keep}`;
  if (info.kind === 'time') {
    if (!info.next) return `All three stars. ${keep}`;
    const which = ORDINAL[info.next.stars];
    if (info.next.gapSec != null) return `${fmtGap(info.next.gapSec)} off the ${which} star. ${keep}`;
    return `Finish ${info.next.needs} for the ${which} star. ${keep}`;
  }
  // paths / arcs
  const each = info.kind === 'arcs' ? 'One star for each arc cleared' : 'One star for each path cleared';
  if (!info.next) return `${each}: all ${info.max} done. ${keep}`;
  if (!info.next.paths.length) return `${each}. ${keep}`;
  const names = info.next.paths.map((p) => PATH_LABEL[p] || String(p).toUpperCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0];
  return `${each}. Clear ${list} for the next one.`;
}

// The ladder's own gate (ArcadeSeriesDetail StageLadder): a stage is open when
// every stage before it is cleared, and a concept gauntlet also caps it at
// series.maxUnlocked. Returns how many stages are open.
export function openStageCount(series, progress) {
  const stages = series?.stages || [];
  const done = (s) => !!progress?.completedStages?.[s.id]?.completed;
  let n = stages.length;
  for (let i = 1; i < stages.length; i++) {
    if (!done(stages[i - 1])) { n = i; break; }
  }
  return Number.isFinite(series?.maxUnlocked) ? Math.min(n, series.maxUnlocked) : n;
}

// A saga's path: one node per stage, in order.
//   stateOf(i) → 'complete' | 'current' | 'locked'  (optional: the ladder's own stageState)
// → { nodes: [{ id, index, number, title, state: 'cleared'|'current'|'locked', boss, stars, max, check }],
//     current (index, or -1), earned, total, hasStars, allCleared }
export function sagaPath(series, progress, stateOf) {
  const stages = series?.stages || [];
  const open = openStageCount(series, progress);
  const done = (s) => !!progress?.completedStages?.[s.id]?.completed;
  const state = (i) => {
    const s = stateOf ? stateOf(i) : done(stages[i]) ? 'complete' : i < open ? 'current' : 'locked';
    return s === 'complete' ? 'cleared' : s;
  };
  let earned = 0, total = 0;
  const nodes = stages.map((stage, i) => {
    const info = stageStars(series, stage, progress?.completedStages?.[stage.id]);
    total += info.max;
    if (info.cleared && info.stars) earned += info.stars;
    return {
      id: stage.id, index: i, number: stage.stageNumber || i + 1, title: stage.title || '',
      state: state(i), boss: !!stage.isFinalRound, stars: info.stars, max: info.max, check: info.check,
    };
  });
  return {
    nodes, current: nodes.findIndex((n) => n.state === 'current'), earned, total,
    hasStars: total > 0, allCleared: nodes.length > 0 && nodes.every((n) => n.state === 'cleared'),
  };
}

// Training Camp's path: the 12 levels, S1/S2 pips under the split ones, the
// title fight (level 12) as the boss. No stars: a cleared level shows a check.
//   levels: protocol camp-levels; current: the cursor 1..12; campDone: the
//   title fight is won; sessions: tm_camp_sessions { [level]: { s1, s2 } }
export function campPath({ levels = [], current = 1, campDone = false, sessions = {} }) {
  const nodes = [...levels].sort((a, b) => a.level - b.level).map((lv, i) => {
    const cleared = lv.level < current || (campDone && lv.level >= current);
    const state = cleared ? 'cleared' : lv.level === current ? 'current' : 'locked';
    const split = lv.session_pattern === 'split_or_full';
    const s = sessions?.[lv.level] || {};
    return {
      id: `camp-${lv.level}`, index: i, number: lv.level, title: lv.title || '', phase: lv.phase, phaseLabel: lv.phase_label,
      state, boss: lv.phase === 'final_boss', stars: null, max: 0, check: cleared,
      pips: split ? { s1: cleared || !!s.s1, s2: cleared || !!s.s2 } : null,
    };
  });
  return { nodes, current: nodes.findIndex((n) => n.state === 'current'), earned: 0, total: 0, hasStars: false, allCleared: nodes.length > 0 && nodes.every((n) => n.state === 'cleared') };
}

const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
// Stage titles are mixed case in the classic and v2 sagas, all caps in the
// concept sagas and the camp: the NEXT UP row reads them in title case.
export const readable = (s) => (/[a-z]/.test(String(s || '')) ? String(s) : titleCase(s));

// Home's NEXT UP row, from the last session (data/lastSession): the saga's
// current node or the camp's current level. null when there is no last
// session, it was neither, the saga cannot be played, or it is all cleared.
//   find: { series({ seriesId, conceptId }) → series | null,
//           progress(series) → progress, playable(series) → bool,
//           camp() → { levels, current, campDone, sessions } }
export function nextUpFrom(last, find) {
  if (!last?.cfg) return null;
  const c = last.cfg;
  const conceptStage = last.kind === 'timer' && c.conceptKind === 'arcade' && c.conceptId;
  if (last.kind === 'arcade' || conceptStage) {
    const conceptId = conceptStage ? c.conceptId : (String(c.seriesId || '').startsWith('concept-') ? String(c.seriesId).slice(8) : null);
    const series = find.series(conceptId ? { conceptId } : { seriesId: c.seriesId });
    if (!series || (find.playable && !find.playable(series))) return null;
    const p = sagaPath(series, find.progress(series));
    if (p.current < 0) return null;
    const node = p.nodes[p.current];
    return {
      kind: 'arcade', seriesId: series.id, conceptId: series.conceptId || null, saga: series.title || 'Arcade',
      number: node.number, title: readable(node.title), boss: node.boss,
    };
  }
  if (last.kind === 'camp') {
    const camp = find.camp();
    const p = campPath(camp);
    if (p.current < 0) return null;
    const node = p.nodes[p.current];
    return {
      kind: 'camp', disc: last.disc || c.discipline || 'Boxing', saga: 'Training Camp',
      number: node.number, title: node.boss ? 'Title Fight' : readable(node.title), boss: node.boss,
    };
  }
  return null;
}

// The row's words: eyebrow, title, and the label a screen reader says. The
// row's badge shows the stage or level number, so the title is the stage's
// name alone, without the tagline after a dash ("Loop-de-Loop — Land,
// Stabilize & Build the Base" reads "Loop-de-Loop"): the longest name keeps to
// two lines at 360 px. The label says the number and the whole title.
export function nextUpCopy(n) {
  if (!n) return null;
  const what = n.kind === 'camp' ? 'Level' : 'Stage';
  const full = String(n.title || '').trim();
  const name = full.split(/\s+[—–]\s+/)[0].trim();
  return {
    eyebrow: `NEXT UP · ${String(n.saga).toUpperCase()}`,
    title: name || `${what} ${n.number}`,
    label: `Next up in ${n.saga}: ${what} ${n.number}${full ? `, ${full}` : ''}. Start`,
  };
}

// The end screen's stars line (an arcade v2 or concept stage just cleared).
export function endStarsLine(info) {
  if (!info?.cleared) return '';
  if (info.kind === 'single') return 'One star for a clear on this saga.';
  if (info.kind === 'paths' || info.kind === 'arcs') {
    const per = info.kind === 'arcs' ? 'One star per arc' : 'One star per path';
    const all = info.all || [];
    if (!all.length) return `${per} cleared.`;
    return `${per}: ${all.map((p) => `${PATH_LABEL[p] || String(p).toUpperCase()}${info.paths.includes(p) ? ' ✓' : ''}`).join(' · ')}`;
  }
  if (info.kind === 'time') return info.next ? `Next star: ${info.next.needs}.` : 'All three stars.';
  return '';
}

// Where the path's nodes sit (retention/ui/PathMap), from the real width of
// its box: a road that winds side to side and climbs, node 0 at the bottom.
// Every node, the biggest (the boss) included, keeps PATH_EDGE from the sides.
export const PATH_SIZE = { node: 58, current: 70, boss: 78 };
export const PATH_EDGE = 16;
const PATH_GAP = 100;     // between two nodes, top to top
const PATH_END = 70;      // room above the last node and below the first
export function pathLayout(count, width) {
  const w = Math.max(240, width || 360);
  const amp = Math.max(0, Math.min(92, (w - 2 * PATH_EDGE - PATH_SIZE.boss) / 2));
  const height = PATH_END * 2 + Math.max(0, count - 1) * PATH_GAP;
  const pts = Array.from({ length: count }, (_, i) => ({ x: w / 2 + Math.sin(i * 0.9) * amp, y: height - PATH_END - i * PATH_GAP }));
  return { width: w, height, pts };
}

// The label under a node (its stars, or the camp's S1/S2 pips) hangs on the
// side away from the road that comes up from the node below, so the road never
// runs through it: the label's edge nearest the road keeps PATH_LABEL_CLEAR
// from the road's stroke, and the label moves off centre only as far as that
// needs. Where the road comes straight up, the label takes the side towards
// the middle of the box. If that side has no room the label tries the other;
// only where neither fits does it stay over the road (its backdrop is solid).
// The first node has no road below it and keeps its label centred.
//   pts: pathLayout's points · i: the node · top: the label's top, px below the
//   node's centre · w, h: the label's size · width: the box's width
// → the label's left, px from the box's left.
export const PATH_LABEL_GAP = 10;  // the node's edge to the label's top
export const PATH_ROAD_HALF = 3;   // half the road's widest stroke, rounded up
export const PATH_LABEL_CLEAR = 5; // the road's stroke to the label's edge
export const PATH_LABEL_EDGE = 8;  // the box's sides to the label
export function pathLabelLeft(pts, i, { top, w, h, width }) {
  const p = pts[i];
  const centred = p.x - w / 2;
  const min = PATH_LABEL_EDGE, max = width - PATH_LABEL_EDGE - w;
  const fits = (left) => left >= min - 0.01 && left <= max + 0.01;
  const clamp = (left) => Math.max(min, Math.min(max, left));
  const below = pts[i - 1];
  if (!below || !(below.y > p.y)) return clamp(centred);
  const dx = below.x - p.x;
  const at = (t) => (dx * t) / (below.y - p.y); // the road's x offset, t px below the centre
  const a = at(top), b = at(top + h);
  const roadL = p.x + Math.min(a, b) - PATH_ROAD_HALF - PATH_LABEL_CLEAR;
  const roadR = p.x + Math.max(a, b) + PATH_ROAD_HALF + PATH_LABEL_CLEAR;
  const left = Math.min(centred, roadL - w); // all of it left of the road
  const right = Math.max(centred, roadR);    // all of it right of the road
  const first = Math.abs(dx) < 1 ? (p.x > width / 2 ? left : right) : dx > 0 ? left : right;
  const second = first === left ? right : left;
  if (fits(first)) return first;
  if (fits(second)) return second;
  return clamp(first);
}
