// Fit card preview: every state of the WORKOUT CARD in the real app (switch
// fitCard, docs/fit-challenge/BUILD-NOTES.md), with the owner preview on, a
// seeded athlete and a fixed clock, photographed at three phone sizes, device
// scale 2. Fails when anything overflows the viewport sideways, any text is
// cut, a state's own words are missing (or words it must not show are there),
// or a page's last line runs under the tab bar (the owner's visual rule:
// everything fits, nothing cut or squeezed).
//
//   CHROME_PATH=/opt/pw-browsers/chromium node scripts/fit-card-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>]
//
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
// (CI mode does not reload: restart it with --clear after an edit).
//
// Every state runs on Monday 23 November 2026, 10:00 (Playwright's clock), with
// a sample athlete: a profile, a week of workouts of several modes (two of them
// card runs that can go back on the card), MEDIUM on Fit, Quick Mission set to
// 20 minutes of bodyweight, full body. The run states drive the clock: GET
// READY, ticks between rounds, FINISH. Each state is shot at the phone's size
// (<state>-<w>.png: what the athlete sees first) and, for a page longer than
// the phone, whole (<state>-<w>-full.png), where its last line must end above
// the tab bar. The `off-` states are the same screens with the switch off
// (no owner preview): Fit Mode as before.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/fit-card-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[360, 780], [390, 844], [430, 932]];

// ── the sample athlete ──────────────────────────────────────────────────────
const NOW = new Date(2026, 10, 23, 10, 0, 0, 0);
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0, 0).toISOString();
const WARRIOR = {
  title: 'FULL BODY WARRIOR', workoutType: 'Bodyweight', difficulty: 'Normal', focus: 'Full Body', rounds: 5, kind: 'warrior',
  exercises: [['Dive Bomber Push-Ups', 12], ['Push-Ups', 16], ['Pull-Ups', 8], ['Inverted Rows', 16], ['Pike Push-Ups', 8], ['Air Squats', 15], ['Hanging Knee Raises', 12], ['Resistance Towel Curls', 12]]
    .map(([name, reps]) => ({ name, mode: 'reps', reps, rest: 30 })),
};
const CIRCUIT = {
  title: 'CALISTHENICS CIRCUIT', workoutType: 'Bodyweight', difficulty: 'Normal', focus: 'Full Body', rounds: 4, kind: 'deal',
  exercises: [['Decline Push-Ups', 12], ['Chin-Ups', 8], ['Walking Lunges', 16], ['Diamond Push-Ups', 10], ['Wide Inverted Rows', 12], ['Russian Twists', 14], ['Triceps Dips', 12]]
    .map(([name, reps]) => ({ name, mode: 'reps', reps, rest: 30 })),
};
const card = (id, day, h, snap, { done, of, reps, sec, xp }) => ({
  id, type: 'Quick Mission', mode: 'solo', completedAt: at(day, h), completedCount: done * snap.exercises.length, totalCount: of * snap.exercises.length,
  xpEarned: xp, elapsedSec: sec, missionId: 'generated', level: 'Normal', completed: done === of,
  title: snap.title, rounds: done, roundsOf: of, totalReps: reps, cardId: `card-${id}`,
});
const SESSIONS = [
  { id: 'q1', type: 'Quick Mission', completedAt: at(9, 18), completedCount: 24, totalCount: 24, xpEarned: 330 },
  { id: 'f1', type: 'Fight Focus', completedAt: at(12, 19), completedCount: 3, totalCount: 3, xpEarned: 90 },
  card('w1', 15, 9, CIRCUIT, { done: 4, of: 4, reps: 368, sec: 26 * 60 + 31, xp: 435 }),
  { id: 'c1', type: 'Cardio', completedAt: at(17, 7, 30), completedCount: 1, totalCount: 1, xpEarned: 120, method: 'Outdoor Run', completedTimeSeconds: 20 * 60 },
  { id: 'b1', type: 'Fit Mode', completedAt: at(19, 18), completedCount: 6, totalCount: 8, xpEarned: 90 },
  card('w2', 21, 9, WARRIOR, { done: 5, of: 5, reps: 495, sec: 38 * 60 + 12, xp: 570 }),
  { id: 'd1', type: 'Mission of the Day', completedAt: at(21, 9), completedCount: 1, totalCount: 1, xpEarned: 25 },
  { id: 'f2', type: 'Fight Focus', completedAt: at(22, 18), completedCount: 2, totalCount: 3, xpEarned: 60 },
];
const PROFILE = { name: 'TRAINEE', sex: 'male', experience: 'Some Training', goal: 'Get Fit', discipline: 'Boxing', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names' };
const SEED = (preview = true) => ({
  trainingModeOnboardingComplete: 'true',
  trainingModeTourComplete: 'true',
  ...(preview ? { tm_owner_preview: '1' } : {}),
  tm_arcade_intro_seen: '{}',
  tm_practice_invite_v1: JSON.stringify({ introShownAt: NOW.toISOString() }),
  tm_user_profile: JSON.stringify(PROFILE),
  // Level 4 with room to the next, so a finished run banks without a RANK UP.
  tm_user_stats: JSON.stringify({ xp: 1550, sessions: SESSIONS }),
  tm_qm_keys_v1: JSON.stringify({ workoutType: 'Bodyweight', difficulty: 'NORMAL', duration: 20, focus: 'FULL BODY' }),
  tm_fit_card_v1: JSON.stringify({ saved: [{ ...CIRCUIT, id: 'saved-1', savedAt: NOW.getTime() - 8 * 864e5 }], recent: [{ ...WARRIOR, id: 'card-w2' }, { ...CIRCUIT, id: 'card-w1' }], checkOff: true }),
  // Programs: PUSH / PULL / LEGS, day 2 (PULL) up next, bodyweight.
  tm_current_program: 'ppl', tm_prog_ppl: '1', tm_programs_equipment: 'Bodyweight',
});

// ── getting there ───────────────────────────────────────────────────────────
const wait = (page, ms) => page.waitForTimeout(ms);
const tap = async (page, loc) => { await loc.first().scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {}); await loc.first().click({ timeout: 4000 }); await wait(page, 450); };
const byName = (page, re) => page.getByRole('button', { name: re });
async function home(page, w) {
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
  await page.mouse.click(Math.round(w / 2), 120); await wait(page, 1800);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1200 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss reminder/ }).first().click({ timeout: 800 }).catch(() => {});
  await wait(page, 500);
}
async function qm(page, w) {
  await home(page, w);
  await tap(page, byName(page, /^FIT MODE/));
  await wait(page, 900);
  await tap(page, page.locator('[data-guide="fit-quick"]'));
  await wait(page, 1200);
}
async function programs(page, w) {
  await home(page, w);
  await tap(page, byName(page, /^FIT MODE/));
  await wait(page, 900);
  await tap(page, page.locator('[data-guide="fit-programs"]'));
  await wait(page, 1500);
}
async function progress(page, w) {
  await home(page, w);
  await tap(page, byName(page, /^PROGRESS$/));
  await wait(page, 1200);
}
const seeAll = async (page) => { await tap(page, byName(page, /^SEE ALL|^SEE MORE/)); await wait(page, 700); };
const toTop = (page) => page.evaluate(() => document.querySelectorAll('.no-scrollbar').forEach((el) => el.scrollTo({ top: 0 })));
async function warrior(page, w) {
  await qm(page, w);
  await tap(page, byName(page, /^CHOOSE$/));
  await tap(page, byName(page, /FULL BODY WARRIOR/));
  await wait(page, 600);
}
// The clock: Playwright's, paused, run on in steps.
const pause = async (page) => page.clock.pauseAt((await page.evaluate(() => Date.now())) + 300);
async function runUntil(page, done, { stepMs = 1000, max = 120 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.clock.runFor(stepMs);
    const t = await page.evaluate(() => document.body.innerText);
    if (done(t)) return t;
    const cont = byName(page, /^CONTINUE$/);
    if (/LEVEL UP|RANK UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  throw new Error('the clock ran out before the screen came');
}
// AT YOUR PACE with CHECK-OFF: START, GET READY, then `rounds` full rounds and
// `more` ticks of the next, minutes apart.
async function checkOff(page, w, { rounds = 2, more = 3, bonus = false, minutes = 20 } = {}) {
  await qm(page, w);
  if (minutes !== 20) {
    await page.locator('input[type=range][aria-label="Time"]').first().evaluate((el, v) => { el.focus(); }, minutes);
    for (let i = 0; i < 20 - minutes; i++) await page.keyboard.press('ArrowLeft');
    await wait(page, 600);
  }
  if (bonus) {
    await tap(page, byName(page, /BONUS TRAINING/));
    await tap(page, page.getByRole('checkbox', { name: /Cardio cool-down done/ }));
  }
  await toTop(page);
  await tap(page, page.getByRole('radio', { name: 'AT YOUR PACE' }));
  await pause(page);
  await tap(page, byName(page, /^START$/));
  await runUntil(page, (t) => /ROUND 1 OF/.test(t), { max: 20 });
  const tickRound = async (n) => { for (let k = 0; k < n; k++) { await page.locator('[data-look="tracker"] button[role="checkbox"][aria-checked="false"]').first().click({ timeout: 4000 }); await page.clock.runFor(35000); } };
  const per = await page.locator('[data-look="tracker"] button[role="checkbox"]').count();
  for (let r = 0; r < rounds; r++) { await tickRound(per); await page.clock.runFor(60000); }
  if (more) await tickRound(more);
  await page.clock.runFor(1000);
}
async function finishRun(page, w, opts = {}) {
  await checkOff(page, w, { rounds: 3, more: 0, ...opts });
  await tap(page, byName(page, /^FINISH$/));
  await runUntil(page, (t) => /YOUR PROGRESS|UP NEXT/.test(t), { max: 40 });
  await page.clock.resume();
  await wait(page, 2200);
}

// ── the states ──────────────────────────────────────────────────────────────
// { name, note, open(page, w), expect, absent?, overlay?, preview? (false: the switch off) }
const STATES = [
  { name: 'card-closed', note: 'Quick Mission opens on the closed card: today\'s balanced deal, SHUFFLE / CHOOSE, the rounds and the sum with − / +, the first moves, SEE ALL, GUIDED | AT YOUR PACE and START on the first screen.',
    open: qm, expect: /TODAY’S QUICK MISSION[\s\S]*SHUFFLE[\s\S]*CHOOSE[\s\S]*ROUNDS[\s\S]*reps[\s\S]*About \d+ min[\s\S]*SEE ALL[\s\S]*GUIDED[\s\S]*START[\s\S]*GEAR[\s\S]*TIME[\s\S]*BONUS TRAINING[\s\S]*YOUR WORKOUTS/, startVisible: true },
  { name: 'card-plus', note: '+ pressed once: a round more of the same moves; the sum, the time and the XP follow. TIME stays at 20 MIN (the input) and says why the card differs: "+1 round · about N min".',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /One round more/)); }, expect: /× 4 =[\s\S]*About (\d+) min[\s\S]*TIME[\s\S]*\+1 round · about \1 min[\s\S]*20 MIN/i, absent: /rounds follow/, startVisible: true },
  { name: 'card-open', note: 'SEE ALL: every move with its swap, the BALANCED line, ADJUST and the PULL-UP BAR switch, then SHOW LESS.',
    open: async (page, w) => { await qm(page, w); await seeAll(page); }, full: true, expect: /BALANCED[\s\S]*ADJUST[\s\S]*PULL-UP BAR[\s\S]*SHOW LESS[\s\S]*START/ },
  { name: 'card-shuffle', note: 'SHUFFLE: a new balanced deal at the same level, gear, focus and rounds.',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /^SHUFFLE$/)); }, expect: /Shuffled: new moves, same everything else\./, startVisible: true },
  { name: 'choose', note: 'CHOOSE: today\'s deal (ON CARD), FULL BODY WARRIOR, your saved workout, the library by body part, SURPRISE ME at the foot.',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /^CHOOSE$/)); }, overlay: true, expect: /CHOOSE A WORKOUT[\s\S]*TODAY'S DEAL[\s\S]*ON CARD[\s\S]*FULL BODY WARRIOR[\s\S]*YOUR SAVED[\s\S]*CALISTHENICS CIRCUIT[\s\S]*SURPRISE ME/i },
  { name: 'warrior', note: 'FULL BODY WARRIOR on the card, open: 99 reps a round, its rounds from the time, Inverted Rows "table or low bar", ‹ TODAY.',
    open: async (page, w) => { await warrior(page, w); await seeAll(page); }, full: true, expect: /TODAY[\s\S]*FULL BODY WARRIOR[\s\S]*99 × \d+ =[\s\S]*About (\d+) min[\s\S]*Dive Bomber Push-Ups[\s\S]*Inverted Rows[\s\S]*table or low bar[\s\S]*Resistance Towel Curls[\s\S]*BALANCED[\s\S]*3 push · 2 pull · legs · core · arms[\s\S]*TIME[\s\S]*whole rounds · about \1 min/i },
  { name: 'swap', note: 'A swap on Pull-Ups: the same pattern, easier / similar / no gear; the rounds stay and the totals update.',
    open: async (page, w) => { await warrior(page, w); await seeAll(page); await tap(page, page.getByRole('button', { name: 'Swap Pull-Ups' })); }, overlay: true, expect: /SWAP: PULL-UPS[\s\S]*NOW[\s\S]*Pull-Ups[\s\S]*EASIER[\s\S]*NO GEAR[\s\S]*rounds stay; the totals update/ },
  { name: 'nobar', note: 'PULL-UP BAR off: Pull-Ups and Hanging Knee Raises step aside for no-bar moves with the same reps, each tagged NO BAR.',
    open: async (page, w) => { await warrior(page, w); await seeAll(page); await tap(page, page.getByRole('switch', { name: 'Pull-up bar' })); }, full: true, expect: /Reverse Snow Angels[\s\S]*NO BAR[\s\S]*for Pull-Ups[\s\S]*Leg Raises[\s\S]*NO BAR[\s\S]*for Hanging Knee Raises[\s\S]*2 stand-ins/ },
  { name: 'saved-nobar', note: 'A saved workout with the PULL-UP BAR switched off on the page: it runs exactly as saved (Chin-Ups stay, no stand-in), and its card has no bar switch; a swap (NO GEAR) is the way to drop a bar move.',
    open: async (page, w) => { await qm(page, w); await seeAll(page); await tap(page, page.getByRole('switch', { name: 'Pull-up bar' })); await toTop(page); await tap(page, byName(page, /^CHOOSE$/)); await tap(page, byName(page, /CALISTHENICS CIRCUIT/)); await wait(page, 600); },
    full: true, expect: /YOUR SAVED WORKOUT[\s\S]*CALISTHENICS CIRCUIT[\s\S]*Chin-Ups[\s\S]*Wide Inverted Rows[\s\S]*ADJUST[\s\S]*SHOW LESS[\s\S]*TIME[\s\S]*for today’s deal/i, absent: /PULL-UP BAR|NO BAR|stand-in/ },
  { name: 'program', note: 'A program day on the card: PUSH / PULL / LEGS, day 2 of 3 (PULL DAY), SHUFFLE THIS DAY, the builder\'s sets × reps; START opens the list.',
    open: programs, expect: /PULL DAY[\s\S]*Push \/ Pull \/ Legs[\s\S]*Day 2 of 3[\s\S]*SHUFFLE THIS DAY[\s\S]*×[\s\S]*(?:START opens the list\.\s*START|RESUME opens the list\.\s*RESUME)/i },
  { name: 'program-open', note: 'The program day open: every exercise with its sets × reps.',
    open: async (page, w) => { await programs(page, w); await seeAll(page); }, full: true, expect: /PULL DAY[\s\S]*SHOW LESS/ },
  { name: 'bonus', note: 'BONUS TRAINING open with the cardio cool-down first, ticked: the workout goes straight into it.',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /BONUS TRAINING/)); await tap(page, page.getByRole('checkbox', { name: /Cardio cool-down done/ })); await page.locator('[data-guide="fc-bonus"]').scrollIntoViewIfNeeded(); }, full: true,
    expect: /BONUS TRAINING[\s\S]*Cardio cool-down[\s\S]*On: your workout goes straight into it\.[\s\S]*L-Sit Hold[\s\S]*Shadowboxing[\s\S]*FIGHT[\s\S]*never changes the rounds/ },
  { name: 'guided', note: 'GUIDED running: the Quick Mission runner with the card\'s moves (its own existing lines).',
    open: async (page, w) => { await qm(page, w); await pause(page); await tap(page, byName(page, /^START$/)); await page.clock.runFor(25000); }, expect: /ROUND 1\/\d/, noCheck: true },
  { name: 'checkoff', note: 'AT YOUR PACE with CHECK-OFF: rounds 1 and 2 done, round 3 with 3 ticked, the next move lit.',
    open: (page, w) => checkOff(page, w), full: true, expect: /CHECK-OFF[\s\S]*ROUND 3 OF 3[\s\S]*2 OF 3 ROUNDS[\s\S]*ROUND 1 DONE[\s\S]*ROUND 2 DONE[\s\S]*ROUND 3[\s\S]*IN PROGRESS[\s\S]*3 OF \d[\s\S]*SHUFFLE[\s\S]*ROUNDS · 3[\s\S]*STOP/ },
  { name: 'confirm', note: 'SHUFFLE mid-run with ticks: START OVER? KEEP GOING, SHUFFLE, and END at the bottom.',
    open: async (page, w) => { await checkOff(page, w); await tap(page, byName(page, /^SHUFFLE$/)); }, overlay: true, expect: /START OVER\?[\s\S]*So far: 2 rounds and 3 moves[\s\S]*KEEP GOING[\s\S]*SHUFFLE[\s\S]*END[\s\S]*keeps what you have done/ },
  { name: 'rounds', note: 'ROUNDS mid-run: − / + with the sum; fewer than started asks to start over.',
    open: async (page, w) => { await checkOff(page, w); await tap(page, byName(page, /^ROUNDS · 3$/)); await tap(page, byName(page, /One round more/)); }, overlay: true, expect: /ROUNDS[\s\S]*× 4 =[\s\S]*Your ticks stay/ },
  { name: 'cooldown', note: 'The cool-down: the cardio cool-down was ticked, so FINISH goes straight into it (the cardio finisher, an easy 10-minute walk).',
    open: (page, w) => finishRun(page, w, { bonus: true }), expect: /COOL-DOWN · UP NEXT[\s\S]*Walk/, noCheck: true },
  { name: 'results', note: 'The results (SESSION COMPLETE, as every AT YOUR PACE finish): the rounds, total reps and time, the recap with each round, REPEAT, NEW CHALLENGE and SAVE WORKOUT.',
    open: (page, w) => finishRun(page, w), full: true, expect: /SESSION COMPLETE[\s\S]*3\/3[\s\S]*TOTAL REPS[\s\S]*100% COMPLETE[\s\S]*moves ticked[\s\S]*R1[\s\S]*REPEAT[\s\S]*NEW CHALLENGE[\s\S]*SAVE WORKOUT/, absent: /SAVED/ },
  { name: 'saved', note: 'After SAVE WORKOUT: ✓ SAVED, and the recap says where to find it.',
    open: async (page, w) => { await finishRun(page, w); await tap(page, byName(page, /SAVE WORKOUT/)); }, full: true, expect: /Saved\. Find it in CHOOSE\.[\s\S]*SAVED/, absent: /SAVE WORKOUT/ },
  { name: 'workouts', note: 'YOUR WORKOUTS from Quick Mission: the last 7 days, then every mode\'s workouts newest first; card runs with an arrow go back on the card.',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /^YOUR WORKOUTS/)); }, full: true,
    expect: /YOUR WORKOUTS[\s\S]*LAST 7 DAYS[\s\S]*FIGHT FOCUS[\s\S]*FULL BODY WARRIOR[\s\S]*5 rounds · 495 reps[\s\S]*38:12[\s\S]*WORKOUT BUILDER[\s\S]*OUTDOOR RUN[\s\S]*CALISTHENICS CIRCUIT/, absent: /MISSION OF THE DAY/i },
  { name: 'workouts-repeat', note: 'A card run from YOUR WORKOUTS back on the card ("From your workouts", ‹ TODAY).',
    open: async (page, w) => { await qm(page, w); await tap(page, byName(page, /^YOUR WORKOUTS/)); await tap(page, page.getByRole('button', { name: /^FULL BODY WARRIOR, SAT/ })); }, expect: /FROM YOUR WORKOUTS[\s\S]*FULL BODY WARRIOR[\s\S]*99 × 5 = 495/i, startVisible: true },
  { name: 'progress', note: 'Progress with the YOUR WORKOUTS card (the latest three, ALL WORKOUTS).',
    open: progress, expect: /PROGRESS[\s\S]*YOUR WORKOUTS[\s\S]*FIGHT FOCUS[\s\S]*FULL BODY WARRIOR[\s\S]*ALL WORKOUTS/ },
  { name: 'progress-workouts', note: 'YOUR WORKOUTS opened from Progress.',
    open: async (page, w) => { await progress(page, w); await tap(page, byName(page, /ALL WORKOUTS/)); }, full: true, expect: /YOUR WORKOUTS[\s\S]*LAST 7 DAYS[\s\S]*FULL BODY WARRIOR/ },
  { name: 'off-quick-mission', preview: false, note: 'The switch off: Quick Mission exactly as before (TIME, SURPRISE, MISSION LIBRARY; no card).',
    open: qm, expect: /TODAY’S QUICK MISSION[\s\S]*START[\s\S]*SURPRISE[\s\S]*GEAR[\s\S]*TIME[\s\S]*MISSION LIBRARY/, absent: /SHUFFLE|CHOOSE|BONUS TRAINING|YOUR WORKOUTS/, noCheck: true },
  { name: 'off-programs', preview: false, note: 'The switch off: Programs as before.',
    open: programs, expect: /PROGRAMS[\s\S]*(Continue|Start a) program[\s\S]*Program library/i, absent: /SHUFFLE THIS DAY/, noCheck: true },
  { name: 'off-progress', preview: false, note: 'The switch off: Progress as before (no YOUR WORKOUTS).',
    open: progress, expect: /PROGRESS[\s\S]*TRAINING SPLIT/, absent: /YOUR WORKOUTS/, noCheck: true },
];

// ── the checks (scripts/fit-looks-preview.mjs's, plus START in view) ────────
function measure({ checkSelectors, navClear, startVisible }) {
  const vw = window.innerWidth;
  const fails = [], warns = [];
  const name = (el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`;
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clips = (cs) => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  const clippers = (el) => { const out = []; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (clips(getComputedStyle(e))) out.push(e); return out; };
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  if (document.documentElement.scrollWidth > vw + 1) fails.push(`the page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !clippers(el).length && getComputedStyle(el).position !== 'fixed') fails.push(`past the viewport: ${name(el)} (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
  }
  const roots = checkSelectors.flatMap((s) => [...document.querySelectorAll(s)]).filter(shown);
  const inScope = (el) => roots.some((root) => root.contains(el));
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el) || !ownText(el)) continue;
    const out = inScope(el) ? fails : warns;
    const cs = getComputedStyle(el);
    if (clips(cs) && el.scrollWidth > el.clientWidth + 1) out.push(`text cut sideways: ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + Math.max(1, lineH / 2)) out.push(`lines hidden: ${name(el)}`);
    const r = el.getBoundingClientRect();
    let pastScroller = false;
    for (const c of clippers(el)) {
      const cr = c.getBoundingClientRect(), ccs = getComputedStyle(c);
      const scrollsY = ccs.overflowY === 'auto' || ccs.overflowY === 'scroll';
      const outX = r.left < cr.left - 1 || r.right > cr.right + 1;
      const outY = !pastScroller && !scrollsY && (r.top < cr.top - 1 || r.bottom > cr.bottom + 1);
      if (outX || outY) { out.push(`text outside the box that clips it: ${name(el)}`); break; }
      if (scrollsY) pastScroller = true;
    }
  }
  if (checkSelectors.length && !roots.length) fails.push(`none of ${checkSelectors.join(', ')} is on screen`);
  const nav = document.querySelector('[data-guide="nav-tabs"]');
  const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
  // START on the first screen: the card's START ends above the tab bar.
  if (startVisible) {
    const st = document.querySelector('[data-guide="fc-start"]');
    const r = st?.getBoundingClientRect();
    if (!r || r.bottom > navTop - 4) fails.push(`START is not on the first screen (ends ${r ? Math.round(r.bottom) : '?'}, tab bar at ${Math.round(navTop)})`);
  }
  // The whole page in one window: its last text or button ends above the tab bar.
  if (navClear && nav) {
    for (const root of roots) {
      for (const el of root.querySelectorAll('button, a, h1, span, div, li')) {
        if (nav.contains(el) || !shown(el) || !(ownText(el) || el.tagName === 'BUTTON')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > navTop + 1 && r.top < window.innerHeight) { fails.push(`under the tab bar: ${name(el)} (ends ${Math.round(r.bottom)}, bar at ${Math.round(navTop)})`); break; }
      }
    }
  }
  return { fails: [...new Set(fails)], warns: [...new Set(warns)] };
}
const overflowY = () => Math.max(0, ...[...document.querySelectorAll('body *')].map((el) => {
  const cs = getComputedStyle(el);
  return cs.overflowY === 'auto' || cs.overflowY === 'scroll' ? el.scrollHeight - el.clientHeight : 0;
}));

// ── run ────────────────────────────────────────────────────────────────────
const launchOpts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
let browser;
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
for (const t of tries) { try { browser = await chromium.launch({ ...launchOpts, ...t }); break; } catch (e) { if (t === tries.at(-1)) throw e; } }

let failures = 0;
const report = [];
for (const st of STATES) {
  if (ONLY && !ONLY.test(st.name)) continue;
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(({ seed, today }) => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
      if (localStorage.getItem('__fc')) return;
      localStorage.clear();
      localStorage.setItem('tm_reminder_card_dismissed', today);
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('__fc', '1');
    }, { seed: SEED(st.preview !== false), today: NOW.toDateString() });
    const page = await ctx.newPage();
    await page.clock.install({ time: NOW.getTime() });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const file = path.join(OUT, `${st.name}-${w}.png`);
    let res = { fails: [], warns: [] };
    try {
      await st.open(page, w);
      await page.evaluate(() => document.fonts?.ready);
      await wait(page, 900);
      const check = st.noCheck ? [] : st.overlay ? ['[data-look]'] : ['[data-fc]'];
      res = await page.evaluate(measure, { checkSelectors: check, navClear: false, startVisible: !!st.startVisible });
      const t = await page.evaluate(() => document.body.innerText);
      if (st.expect && !st.expect.test(t)) res.fails.unshift(`expected ${st.expect} on screen`);
      if (st.absent && st.absent.test(t)) res.fails.unshift(`not expected on screen: ${st.absent} (${t.match(st.absent)[0]})`);
      await page.screenshot({ path: file });
      let more = st.full ? await page.evaluate(overflowY) : 0;
      if (more > 0) {
        await toTop(page);
        // A taller window can drop a short phone's compact rules (the page
        // grows): grow until nothing scrolls.
        let tallH = h;
        for (let k = 0; k < 4 && more > 0; k++) {
          tallH = Math.min(9000, tallH + more);
          await page.setViewportSize({ width: w, height: tallH });
          await wait(page, 700);
          more = await page.evaluate(overflowY);
        }
        const tall = await page.evaluate(measure, { checkSelectors: check, navClear: true, startVisible: false });
        res.fails.push(...tall.fails.filter((f) => !res.fails.includes(f)));
        res.warns.push(...tall.warns.filter((f) => !res.warns.includes(f)));
        await page.screenshot({ path: path.join(OUT, `${st.name}-${w}-full.png`), fullPage: true });
      }
    } catch (e) {
      res.fails.push(`could not open: ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: file }).catch(() => {});
    }
    if (errors.length) res.fails.push(`page errors: ${errors.join(' | ')}`);
    const ok = !res.fails.length;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${st.name} @${w}x${h}  → ${file}`);
    for (const f of res.fails) console.log(`       ✗ ${f}`);
    for (const f of res.warns.slice(0, 4)) console.log(`       · warn: ${f}`);
    report.push({ state: st.name, size: `${w}x${h}`, file, fails: res.fails, warns: res.warns });
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), states: STATES.map((s) => ({ name: s.name, note: s.note })), results: report }, null, 2));
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall states fit');
process.exit(failures ? 1 : 0);
