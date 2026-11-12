// Live XP verdicts: the shared stakes table, rush verdicts (blind when the
// phone cannot see the athlete), clean-round bonus, negative splits, and the
// fight settle with a bonus riding it. Run with `npm run test:xp`.
import { XP_STAKES_BY_TIER, stakesFor, tierKey, cleanRoundXp, CLEAN_ROUND_XP, NEGATIVE_SPLIT_XP } from '../components/training-mode/data/xpStakes.js';
import { judgeRush, tallyRush, newRushTally, rushSummary, RUSH_MIN_BASELINE_SEC } from '../components/training-mode/data/rushVerdict.js';
import { judgeNegativeSplit } from '../components/training-mode/data/negativeSplit.js';
import { chaseXp, CHASE_XP } from '../components/training-mode/data/chase.js';
import { pickXpBanner } from '../components/training-mode/data/xpBanners.js';
import { judgeRoundIntensity } from '../components/training-mode/data/roundIntensity.js';
import { createMicStrikeDetector } from '../components/training-mode/data/micStrikeDetector.js';
import { quickMissionXp, addFitModeSession, loadStats } from '../components/training-mode/data/userStats.js';
import { canFinishEarly, finishPrompt, finishOnResume } from '../components/training-mode/data/builderFinish.js';
import { resolveOutcome, xpForOutcome } from '../components/training-mode/shared/sessionOutcome.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

// ── stakes ────────────────────────────────────────────────────────────────
check('three tiers', Object.keys(XP_STAKES_BY_TIER).length === 3);
check('every tier: win pays more than loss costs', Object.values(XP_STAKES_BY_TIER).every(t => t.win > t.loss));
check('NORMAL is 10 / 5', stakesFor('normal').win === 10 && stakesFor('normal').loss === 5);
check('HARD raises both', stakesFor('hard').win > stakesFor('normal').win && stakesFor('hard').loss > stakesFor('normal').loss);
check('fight difficulty names map', tierKey('Easy') === 'easy' && tierKey('Normal') === 'normal' && tierKey('Hard') === 'hard' && tierKey('Advanced') === 'hard');
check('unknown tier is NORMAL', tierKey('savage') === 'hard' && tierKey(undefined) === 'normal' && tierKey('???') === 'normal');
check('chase stakes are the shared table', chaseXp('hard').win === stakesFor('hard').win && CHASE_XP === 10);
check('clean round bonus', cleanRoundXp(3) === 3 * CLEAN_ROUND_XP && cleanRoundXp(0) === 0 && cleanRoundXp(-2) === 0);

// ── rush verdicts ─────────────────────────────────────────────────────────
const live = { motionSeen: true, baselineStrikes: 60, baselineSec: 60 }; // 1 strike/s before the call
check('blind without motion', judgeRush({ ...live, motionSeen: false, rushStrikes: 20, rushSec: 10 }).verdict === 'blind');
check('blind on a thin baseline', judgeRush({ ...live, baselineSec: RUSH_MIN_BASELINE_SEC - 1, baselineStrikes: 20, rushStrikes: 20, rushSec: 10 }).verdict === 'blind');
check('blind when the phone barely saw anything', judgeRush({ motionSeen: true, baselineStrikes: 3, baselineSec: 60, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
check('blind on a tiny window', judgeRush({ ...live, rushStrikes: 5, rushSec: 3 }).verdict === 'blind');
check('pass at 1.5× the baseline', judgeRush({ ...live, rushStrikes: 15, rushSec: 10 }).verdict === 'pass');
check('pass exactly at the factor', judgeRush({ ...live, rushStrikes: 12, rushSec: 10 }).verdict === 'pass');
check('hold in the neutral band', judgeRush({ ...live, rushStrikes: 10, rushSec: 10 }).verdict === 'hold');
check('fail when they slow down', judgeRush({ ...live, rushStrikes: 6, rushSec: 10 }).verdict === 'fail');
check('a standing athlete with a live phone fails', judgeRush({ ...live, rushStrikes: 0, rushSec: 10 }).verdict === 'fail');
check('phone on the floor never fails', judgeRush({ motionSeen: false, baselineStrikes: 0, baselineSec: 120, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
check('phone on the floor with motion flag but nothing counted never fails', judgeRush({ motionSeen: true, baselineStrikes: 0, baselineSec: 120, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
{
  const t = newRushTally();
  const a = tallyRush(t, judgeRush({ ...live, rushStrikes: 15, rushSec: 10 }), 'normal');
  const b = tallyRush(t, judgeRush({ ...live, rushStrikes: 6, rushSec: 10 }), 'normal');
  const c = tallyRush(t, judgeRush({ ...live, rushStrikes: 10, rushSec: 10 }), 'normal');
  const d = tallyRush(t, judgeRush({ ...live, motionSeen: false, rushStrikes: 10, rushSec: 10 }), 'normal');
  check('win-only: tally deltas +10 / 0 / 0 / 0', a === 10 && b === 0 && c === 0 && d === 0, `${a} ${b} ${c} ${d}`);
  const s = rushSummary(t, 'normal');
  check('summary counts', s.passes === 1 && s.fails === 1 && s.held === 1 && s.blind === 1 && s.attempts === 3);
  check('win-only: a slowed rush costs nothing', s.xp === 10 && s.won === 10 && s.lost === 0);
  check('summary at HARD pays the HARD win', rushSummary(t, 'hard').xp === 15);
  check('empty summary is zero', rushSummary(null).xp === 0 && rushSummary(newRushTally()).attempts === 0);
}

// ── negative splits ───────────────────────────────────────────────────────
const trace = (segments) => { // [[secondsForHalf1], ...] → even-paced trace points
  const out = [{ t: 0, d: 0 }]; let t = 0, d = 0;
  segments.forEach(([sec, dist]) => { for (let i = 1; i <= 10; i++) { t += sec / 10; d += dist / 10; out.push({ t: +t.toFixed(1), d: +d.toFixed(4) }); } });
  return out;
};
{
  const neg = trace([[600, 1.5], [540, 1.5]]); // 10:00 then 9:00 for 1.5 mi each
  const r = judgeNegativeSplit({ trace: neg, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: true });
  check('negative split passes', r.eligible && r.pass && r.xp === NEGATIVE_SPLIT_XP, JSON.stringify(r));
  check('halves measured', r.firstHalfSec === 600 && r.secondHalfSec === 540, `${r.firstHalfSec} ${r.secondHalfSec}`);
  const pos = trace([[540, 1.5], [600, 1.5]]);
  const p = judgeNegativeSplit({ trace: pos, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: true });
  check('positive split: eligible, no pass, no loss', p.eligible && !p.pass && p.xp === 0);
  const even = trace([[600, 1.5], [598, 1.5]]);
  check('inside the 1% margin is not a pass', !judgeNegativeSplit({ trace: even, totalDistance: 3, totalSec: 1198, unit: 'mi', gps: true }).pass);
  check('too short is ineligible', !judgeNegativeSplit({ trace: trace([[300, 0.75], [270, 0.75]]), totalDistance: 1.5, totalSec: 570, unit: 'mi', gps: true }).eligible);
  check('machine runs are ineligible', !judgeNegativeSplit({ trace: neg, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: false }).eligible);
  check('km threshold is 3 km', judgeNegativeSplit({ trace: trace([[600, 1.6], [540, 1.6]]), totalDistance: 3.2, totalSec: 1140, unit: 'km', gps: true }).eligible);
  check('no trace is ineligible', !judgeNegativeSplit({ trace: [], totalDistance: 5, totalSec: 3000, unit: 'mi', gps: true }).eligible);
}

// ── round intensity (strong finish) ───────────────────────────────────────
{
  const ok = { roundSec: 180, motionSeen: true, tier: 'normal' };
  check('strong finish passes at 1.2× the first two rounds', judgeRoundIntensity({ ...ok, perRoundStrikes: [100, 100, 90, 120] }).verdict === 'pass');
  check('strong finish pays the tier win', judgeRoundIntensity({ ...ok, perRoundStrikes: [100, 100, 120], tier: 'hard' }).xp === 15);
  check('a fade is a hold, never a loss', (() => { const r = judgeRoundIntensity({ ...ok, perRoundStrikes: [100, 100, 80] }); return r.verdict === 'hold' && r.xp === 0; })());
  check('needs three rounds', judgeRoundIntensity({ ...ok, perRoundStrikes: [100, 130] }).verdict === 'blind');
  check('blind without motion', judgeRoundIntensity({ ...ok, motionSeen: false, perRoundStrikes: [100, 100, 130] }).verdict === 'blind');
  check('blind when the phone barely counted', judgeRoundIntensity({ ...ok, perRoundStrikes: [10, 10, 40] }).verdict === 'blind');
  check('baseline is the mean of the first two', judgeRoundIntensity({ ...ok, perRoundStrikes: [80, 120, 116] }).baseline === 100);
  const t = newRushTally(); tallyRush(t, judgeRush({ ...live, rushStrikes: 15, rushSec: 10 }), 'normal', { round: 2 });
  check('rush results carry the round for the log', rushSummary(t).results[0].round === 2 && rushSummary(t).results[0].verdict === 'pass');
}

// ── mic bag-hit detector ──────────────────────────────────────────────────
{
  // Synthetic mic frames every 10 ms: gym noise ~0.02, a thud = 0.5 decaying over ~60 ms.
  const run = (hitTimesMs, totalMs, noise = 0.02, loud = 0.5) => {
    const d = createMicStrikeDetector();
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let t = 0; t <= totalMs; t += 10) {
      let p = noise * (0.6 + rnd() * 0.8);
      hitTimesMs.forEach(h => { const dt = t - h; if (dt >= 0 && dt < 60) p = Math.max(p, loud * Math.exp(-dt / 20)); });
      d.onFrame(p, t);
    }
    return d.count;
  };
  const steady = Array.from({ length: 20 }, (_, i) => 1000 + i * 700);    // ~86/min
  const flurry = Array.from({ length: 50 }, (_, i) => 1000 + i * 180);    // ~333/min, continuous
  check('mic: quiet gym noise makes no hits', run([], 10000) === 0);
  check('mic: counts steady hits exactly', run(steady, 16000) === 20, String(run(steady, 16000)));
  check('mic: keeps counting a continuous flurry', run(flurry, 11000) >= 48, String(run(flurry, 11000)));
  check('mic: one thud is one hit', run([1000], 3000) === 1);
  check('mic: loud music floor does not trigger', run([], 10000, 0.15) === 0);
  const d = createMicStrikeDetector();
  for (let t = 0; t < 1000; t += 10) d.onFrame(0.02, t);
  d.mute(1000, 300);
  for (let t = 1000; t < 1300; t += 10) d.onFrame(0.6, t);
  check('mic: muted window ignores the phone beep', d.count === 0);
}

// ── plate picks ───────────────────────────────────────────────────────────
check('fight gain is the crown', pickXpBanner('gain', { mode: 'fight' }).id === 'crown');
check('cardio gain is iron', pickXpBanner('gain', { mode: 'cardio' }).id === 'iron');
check('fight loss is the gloves', pickXpBanner('loss', { mode: 'fight' }).id === 'gloves');
check('camp stage loss is the reaper', pickXpBanner('loss', { mode: 'fight', camp: true }).id === 'reaper');
check('HARD loss is the reaper', pickXpBanner('loss', { mode: 'cardio', tier: 'hard' }).id === 'reaper');

// Quick Mission: the finish bonus pays only when nothing was skipped.
check('quick mission: full run pays the bonus', quickMissionXp(10, 10, true) === 180);
check('quick mission: skipped last move, no bonus', quickMissionXp(9, 10, true) === 135);
check('quick mission: skipped middle move, no bonus', quickMissionXp(9, 10, true) === 9 * 15);
check('quick mission: early stop, no bonus', quickMissionXp(4, 10, false) === 60);

// Build Workout: FINISH WORKOUT shows once something is done and something is
// left; with all of it done COMPLETE WORKOUT takes over. The confirm's copy.
check('build workout: FINISH WORKOUT needs one done', !canFinishEarly(0, 8) && canFinishEarly(1, 8));
check('build workout: FINISH WORKOUT goes when all are done', canFinishEarly(7, 8) && !canFinishEarly(8, 8) && !canFinishEarly(0, 0));
{
  const p = finishPrompt(6, 8);
  check('build workout: the confirm names the count', p.title === 'Finish with 6 of 8 done?' && p.line === "The 2 left won't count.", JSON.stringify(p));
  check('build workout: one left', finishPrompt(7, 8).line === "The 1 left won't count.");
}
// A session that comes back with every row done (killed in the done toast's
// beat after the last move) goes to the summary, not to COMPLETE WORKOUT.
{
  const rows = [{ _uid: 'a' }, { _uid: 'b' }, { _uid: 'c' }];
  check('build workout: resumed with all done finishes', finishOnResume(true, rows, { a: true, b: true, c: true }));
  check('build workout: resumed with one open stays on the list', !finishOnResume(true, rows, { a: true, b: true }));
  check('build workout: a fresh list never finishes itself', !finishOnResume(false, rows, { a: true, b: true, c: true }));
  check('build workout: an empty list never finishes', !finishOnResume(true, [], {}) && !finishOnResume(true, rows, null));
}
// What a finish banks (App's goFitComplete → addFitModeSession), on a
// throwaway storage: 15 per exercise done, +30 only when all are done, one
// session row per call. FitWorkoutComplete shows completedCount × 15 (+30
// when all done), so the summary and the bank agree.
{
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true,
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  });
  const partial = addFitModeSession(6, 8, 'Intermediate');
  check('build workout: 6 of 8 banks 15 each, no +30', partial === 90, String(partial));
  check('build workout: one session row, 90 XP', loadStats().sessions.length === 1 && loadStats().xp === 90 && loadStats().sessions[0].completedCount === 6);
  const full = addFitModeSession(8, 8, 'Intermediate');
  check('build workout: 8 of 8 adds the +30', full === 150, String(full));
  check('build workout: two finishes, two rows', loadStats().sessions.length === 2 && loadStats().xp === 240);
  delete globalThis.localStorage;
}

// Quick Mission's fourth level. ADVANCED asks for more work, never a stricter
// verdict: Quick Mission passes advancedAs: 'hard', and then for every completion
// it resolves exactly as HARD does, so it is never harder to pass than HARD (and
// XP is the same fair per-exercise figure the other levels bank).
{
  const ratios = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  const qm = (completed, d) => resolveOutcome({ completed, total: 24, difficulty: d, advancedAs: 'hard' });
  const same = ratios.every(r => ['advanced', 'Advanced', 'ADVANCED'].every(d => {
    const a = qm(Math.round(r * 24), d);
    const h = qm(Math.round(r * 24), 'Hard');
    return a.outcome === h.outcome && a.failType === h.failType && a.completionRatio === h.completionRatio;
  }));
  check('quick mission: ADVANCED resolves exactly as HARD at every completion', same);
  const rank = { fail: 0, validation_failed: 0, partial: 1, pass: 2 };
  check('quick mission: ADVANCED is never harder to pass than HARD, or than NORMAL on a clean finish', ratios.every(r => {
    const o = (d) => rank[qm(Math.round(r * 24), d).outcome];
    return o('Advanced') >= o('Hard');
  }) && qm(24, 'Advanced').outcome === 'pass');
  check('quick mission: a finished ADVANCED mission banks the full XP, a stopped one keeps its exercises', xpForOutcome('pass', quickMissionXp(24, 24, true)) === 24 * 15 + 30
    && xpForOutcome(qm(12, 'Advanced').outcome, quickMissionXp(12, 24, false)) === 12 * 15);
}

// Every other mode that already has an Advanced level (Combo Coach, Combat
// Conditioning) keeps judging it as it did before Quick Mission got one: as
// NORMAL. A finish at 92% is a pass there, and only a Quick Mission (HARD rules)
// reads it as partial.
{
  const at = (done, opts) => resolveOutcome({ completed: done, total: 100, difficulty: 'Advanced', ...opts }).outcome;
  const same = ['advanced', 'Advanced', 'ADVANCED'].every(d => [0, 25, 50, 90, 92, 95, 100].every(n => {
    const a = resolveOutcome({ completed: n, total: 100, difficulty: d });
    const nrm = resolveOutcome({ completed: n, total: 100, difficulty: 'Normal' });
    return a.outcome === nrm.outcome && a.failType === nrm.failType;
  }));
  check('Combo Coach and Combat Conditioning: ADVANCED is judged as NORMAL at every completion (as before Quick Mission had one)', same);
  check('a 92% finish at ADVANCED is a pass for them, and partial only when judged as HARD', at(92) === 'pass' && at(92, { advancedAs: 'hard' }) === 'partial'
    && resolveOutcome({ completed: 92, total: 100, difficulty: 'Hard' }).outcome === 'partial' && resolveOutcome({ completed: 92, total: 100, difficulty: 'Normal' }).outcome === 'pass');
  check('advancedAs touches nothing but ADVANCED', ['Easy', 'Normal', 'Hard'].every(d => [0, 50, 92, 100].every(n => resolveOutcome({ completed: n, total: 100, difficulty: d }).outcome === resolveOutcome({ completed: n, total: 100, difficulty: d, advancedAs: 'hard' }).outcome)));
}

// ── audit fixes: cardio minutes, once-only ends, reload guard, share, auto-pause
import { readFileSync } from 'node:fs';
{
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true,
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  });
  const { addCardioSession, XP_CARDIO_MAX_MINUTES } = await import('../components/training-mode/data/userStats.js');
  const ok = addCardioSession({ completedTimeSeconds: 30 * 60 });
  const huge = addCardioSession({ completedTimeSeconds: 99999 * 60 });
  const edge = addCardioSession({ completedTimeSeconds: XP_CARDIO_MAX_MINUTES * 60 });
  check('cardio: 30 real minutes still pay 20 + 5 a minute', ok === 170, String(ok));
  check('cardio: a typed 99999 minutes pays the cap, not 500015', huge === 20 + XP_CARDIO_MAX_MINUTES * 5 && huge === edge, `${huge} ${edge}`);
  delete globalThis.localStorage;
}
{
  const src = (f) => readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
  const app = src('App.jsx');
  const first = (head) => { const i = app.indexOf(head); return i < 0 ? '' : app.slice(i + head.length, i + head.length + 140); };
  // Each run is banked once, and a finish that threw can be retried: the
  // four end handlers go through bankOnce, and none returns early on its own
  // (an early return set before the write made a failed finish unrepeatable).
  const wrapped = /for \(const name of \['goSummary', 'goComboEnd', 'goFitComplete', 'goCombatCondComplete'\]\) \{\s*actions\[name\] = bankOnce\(bankedScreenRef, screen, actions\[name\]\);/.test(app);
  check('once-only: the four session-end handlers in App are banked once through bankOnce', wrapped && !/if \(endedScreenRef\.current === screen\) return;/.test(app), first('goSummary:     ('));
  check('once-only: a new session on the screen clears the banked mark', /endedScreenRef\.current = null;[^\n]*\n\s*bankedScreenRef\.current = null;/.test(app));
  {
    const { bankOnce } = await import('../components/training-mode/shared/lifecycleGuards.js');
    const ref = { current: null }; let banked = 0; let fail = true;
    const end = bankOnce(ref, 'fit_workout', () => { if (fail) throw new Error('quota'); banked += 1; return 'summary'; });
    let threw = false; try { end(); } catch { threw = true; }
    check('once-only: a finish that throws banks nothing and leaves the run open', threw && banked === 0 && ref.current === null);
    fail = false;
    const out = end();
    check('once-only: the retry banks the run', out === 'summary' && banked === 1 && ref.current === 'fit_workout');
    end(); end();
    check('once-only: further calls for the same run bank nothing more', banked === 1);
    ref.current = null; // what the app does when a new session mounts on the screen
    end();
    check('once-only: a new session on the same screen is banked again', banked === 2);
  }
  const cc = src('ComboCoachActive.jsx');
  check('combo coach: the final-bell hand-off runs from a timer cleared on unmount, not a bare setTimeout',
    /later\(\(\) => \{ stopVoiceSession\(\{ graceful: true \}\); onEnd\(/.test(cc) && !/setTimeout\(\(\) => \{ stopVoiceSession\(\{ graceful: true \}\); onEnd\(/.test(cc));
  check('combo coach: a round rest of 0 is kept (?? not ||) and skips the rest phase', /const restSec = cfg\.restSec \?\? 60;/.test(cc) && /if \(restSec <= 0\) \{/.test(cc) && !/cfg\.restSec \|\| 60/.test(cc));
}
{
  // The stale-bundle reload guard, through 20 loads of a chunk that keeps
  // failing. React mounts the fallback (componentDidMount) BEFORE
  // componentDidCatch in the same commit, so mount must not clear the flag.
  const { createStaleReloadGuard, STALE_BUNDLE } = await import('../components/training-mode/data/staleBundleGuard.js');
  const sess = new Map();
  const storage = { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)), removeItem: (k) => sess.delete(k) };
  let reloads = 0;
  for (let load = 0; load < 20; load++) {
    const timers = [];
    const g = createStaleReloadGuard({ storage, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, reload: () => { reloads++; } });
    let error = null;
    error = new Error('Requiring unknown module 42'); // first render throws
    g.onMount(() => !!error);
    g.onCatch(error.message);
    // The page reloads after 60 ms; the 15 s re-arm timer dies with it.
    timers.filter(t => t.ms === 60).forEach(t => t.fn());
  }
  check('reload guard: a chunk that fails on every load reloads once, not 20 times', reloads === 1, String(reloads));
  // A clean load that stays up 15 s re-arms it for a later deploy.
  const t2 = [];
  const g2 = createStaleReloadGuard({ storage, setTimer: (fn, ms) => { t2.push({ fn, ms }); return t2.length; }, reload: () => { reloads++; } });
  g2.onMount(() => false);
  t2.filter(t => t.ms === 15000).forEach(t => t.fn());
  check('reload guard: a screen that stays up clears the flag, so the next stale deploy reloads once more', sess.size === 0 && g2.onCatch('Loading chunk 7 failed') === true && reloads === 1 && (t2.filter(t => t.ms === 60).forEach(t => t.fn()), reloads === 2));
  const g3 = createStaleReloadGuard({ storage, setTimer: (fn) => fn(), reload: () => {} });
  check('reload guard: a real crash is not a reload', g3.onCatch('x is undefined') === false && STALE_BUNDLE.test('Importing a module script failed'));
}
{
  // Sharing the card: every rejection ends in the fallback, a dismissed sheet in nothing.
  const { shareCardCanvas } = await import('../components/training-mode/data/shareUtils.js');
  globalThis.File = globalThis.File || class { constructor(parts, name, o) { this.name = name; this.type = o?.type; } };
  const canvas = { toBlob: (cb) => cb({ size: 1 }) };
  const run = async (nav, c = canvas) => { let fell = 0; await shareCardCanvas(c, 'cap', { nav, onFallback: () => { fell++; } }); return fell; };
  const named = (name) => Object.assign(new Error(name), { name });
  check('share: a NotAllowedError from the share sheet falls back (no unhandled rejection)', await run({ canShare: () => true, share: async () => { throw named('NotAllowedError'); } }) === 1);
  check('share: a dismissed sheet (AbortError) is quiet', await run({ canShare: () => true, share: async () => { throw named('AbortError'); } }) === 0);
  check('share: a canvas that gives no blob falls back', await run({ canShare: () => true, share: async () => {} }, { toBlob: (cb) => cb(null) }) === 1);
  check('share: no share API falls back, a good share does not', await run({}) === 1 && await run({ canShare: () => true, share: async () => {} }) === 0);
}
{
  // Auto-pause when the page is hidden while a count-in ends.
  const { createHiddenPauseWatcher } = await import('../components/training-mode/shared/lifecycleGuards.js');
  const doc = { hidden: false, pictureInPictureElement: null };
  let running = false, pauses = 0, honest = 0;
  const timers = [];
  const w = createHiddenPauseWatcher({ doc, isRunning: () => running, pause: () => { pauses++; }, noteHonestPause: () => { honest++; }, setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  const flush = () => { while (timers.length) timers.shift()(); };
  doc.hidden = true; w.check(); flush(); // hidden during the count-in: nothing runs yet
  check('auto-pause: hidden while not running does nothing', pauses === 0);
  running = true; w.check(); flush(); // the count-in ends with the page still hidden
  check('auto-pause: the session turning running while hidden pauses it', pauses === 1 && honest === 1);
  running = true; doc.hidden = true; doc.pictureInPictureElement = {}; w.check(); flush();
  check('auto-pause: a picture-in-picture clock is left running', pauses === 1 && honest === 2);
  doc.pictureInPictureElement = null; doc.hidden = false; w.check(); flush();
  check('auto-pause: visible pages never pause', pauses === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
