// node tools/app-broll.mjs [--only a,b] [--dist <dir>] [--chrome <exe>] [--out <dir>] [--contact <dir>]
//
// Records the app's own screens as B-roll for the social videos: portrait
// 1080x1920, 30 fps, H.264, silent, true app colours, no phone frame. It serves
// a built web export of the app (`npm run build:web` in the app, then dist/),
// opens it in Chromium at the app's phone size (412 x 732 at device scale 2.62,
// so the app fills the frame), seeds an athlete into the app's localStorage,
// plays a choreography with a finger (smooth, human-paced taps and drags, each
// touch marked by a subtle gold ripple), captures the page and encodes
// raw-footage/app/<name>.mp4. Nothing is added to the app and no dependency to
// the console: playwright-core is the app repo's own (../node_modules).
//
//   node tools/app-broll.mjs --list                  the clips and what each shows
//   node tools/app-broll.mjs                         every clip
//   node tools/app-broll.mjs --only qm-slider,hub    just those
//   --dist <dir>      the built export (default ../dist, the app root's dist/)
//   --chrome <exe>    the browser (default: CHROME_PATH, else Playwright's own,
//                     else the Chrome installed on the machine)
//   --out <dir>       where the clips go (default raw-footage/app)
//   --contact <dir>   also write <name>.jpg, a frame a second, to look at the clip
//   --seed <n>        the app's random numbers (default 7): same seed, same workouts
//   --concept-art     keep the Concept Program card's art on the hubs (see CONCEPT_CSS)
//   --keep-frames     keep the captured frames (in the temp folder) for debugging
//
// Needs ffmpeg on the PATH (npm run doctor checks it; libx264, and the fps and
// tile filters for --contact) and a built export of the app. No music, no audio.
//
// Re-run it whenever the app changes: the choreography reads the app's own
// words (`expect` and `waitText` steps stop a clip that no longer shows what it
// should), and the athletes are seeded the way the app counts levels.
//
// HOW TO ADD A CLIP: add one entry to CLIPS below, no other code.
//   { name, persona, note, clock?, prep: [steps...], steps: [steps...] }
//   prep runs first and is not recorded (get to the first screen of the clip);
//   steps are recorded, 30 fps from the first one to the last.
//   persona: a key of PERSONAS (the athlete's XP and sessions, so their level).
//   clock: true installs a fake clock so { clock: ms } can jump a long wait
//          (a countdown, a rest); time still flows on its own in between.
// A step is one object, the first key names what it does:
//   { wait: ms }                               pause
//   { tap: <target>, after: ms }               a finger tap (after: pause once it lands)
//   { tapAt: [x, y] }                          a tap at a spot (css px, 412 x 732)
//   { tapMinute: 10 }                          a tap on the Quick Mission TIME track
//   { slide: 30, ms: 1200 }                    drag the TIME knob to 30 minutes
//   { scroll: '<css>', to: px, ms }            eased scroll of an element (a slow reading pace)
//   { type: '31', delay: 170 }                 key presses (the focused field)
//   { eval: () => ... }                        run code in the page
//   { clock: ms }                              run the fake clock forward (every timer fires: a countdown ticks through)
//   { jump: ms }                               leap the fake clock forward (a stopwatch lands on the new time)
//   { waitText: /re/, timeout }                wait until the page says it
//   { expect: /re/ }                           stop the clip if the page does not say it
//   { hide: [steps...] }                       run steps off camera: the footage cuts straight past them
//   { goto: true } / { closePopups: true }     open the app / close a welcome pop-up
// A <target> is a css selector, or { text }, { role, name, exact }, { css,
// hasText }, each with { nth, in: '<css scope>' }.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { REPO, RAW, ffmpeg, ffprobe } from './lib.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// The picture: what the app is shown at.
// ─────────────────────────────────────────────────────────────────────────────
const VIEW = { width: 412, height: 732 }; // the app's phone viewport (css px)
const SCALE = 2.62;                       // x 412 = 1079, x 732 = 1918: the 1080 x 1920 frame
const OUT_SIZE = { width: 1080, height: 1920 };
const FPS = 30;
const JPEG_QUALITY = 95;

// Gold, the app's own (QuickMissionSetup GOLD #F2BE45).
const GOLD = '242,190,69';

// CSS put on every page of the capture. The floating BETA chip (and the note it
// pops up) sits over the bottom-left of nearly every screen, so it is hidden.
const BASE_CSS = `
button[aria-label="Report beta feedback"] { display: none !important; }
`;
// The hubs' Concept Program card is drawn over a poster in the app's own art,
// which reads as a famous fighter. It is not what these reels are about, so the
// poster is hidden by default (the card, its words and its layout stay).
// --concept-art keeps it.
const CONCEPT_CSS = `
[data-guide="fit-concept"] img, [data-guide="fight-concept"] img { visibility: hidden !important; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// The athletes. The app's level comes from tm_user_stats: xp is the bank, the
// sessions' xpEarned are each side's own XP (Fit Mode, Quick Mission and Cardio
// are Fit; Fight Focus, Combo Coach and Practice are Fight). A side's level
// counts its own XP in full and the other half (data/athleteLevel.js); the Level
// page's level and the header's LV are the bank's (XP / 500 + 1).
// ─────────────────────────────────────────────────────────────────────────────
const DAY = 86400000;
function athlete({ fit = 0, fitSessions = 0, fight = 0, fightSessions = 0, other = 0 }) {
  const now = Date.now();
  const made = [];
  // i counts from the newest. The newest Fit row is a Quick Mission, so the Fit
  // hub's Today's Mission card reads "Build Workout" (the app's own rule) and
  // names no level of its own.
  for (let i = 0; i < fitSessions; i++) made.push({ type: i % 3 === 0 ? 'Quick Mission' : 'Fit Mode', xp: Math.round(fit / fitSessions) });
  for (let i = 0; i < fightSessions; i++) made.push({ type: i % 4 === 0 ? 'Combo Coach' : 'Fight Focus', xp: Math.round(fight / fightSessions) });
  // Spread over the last weeks, newest first at yesterday and the days before
  // it (so the streak is real), the two sides mixed.
  const mixed = [];
  const fits = made.filter((m) => /Fit|Quick/.test(m.type));
  const fights = made.filter((m) => !/Fit|Quick/.test(m.type));
  while (fits.length || fights.length) {
    if (fits.length) mixed.push(fits.shift());
    if (fights.length) mixed.push(fights.shift());
  }
  const sessions = mixed.map((m, k) => ({
    id: `b${k}`, type: m.type, completedAt: new Date(now - (Math.floor(k * 1.3) + 1) * DAY).toISOString(),
    completedCount: 6, totalCount: 6, xpEarned: m.xp,
  })).reverse();
  return { xp: fit + fight + other, sessions };
}

const PERSONAS = {
  // Level 1: a new account, no sessions.
  rookie: { name: 'ALEX', stats: null },
  // Level 3 (1,210 XP, Fit work): Quick Mission opens on MEDIUM, Combo Coach on EASY.
  lvl3: { name: 'ALEX', stats: athlete({ fit: 1150, fitSessions: 12, other: 60 }) },
  // Level 10 (4,960 XP, 57 sessions, mostly Fit): Quick Mission opens on ADVANCED;
  // the Fight side (400 XP in full, the rest at half) is level 6, HARD.
  lvl10: { name: 'ALEX', stats: athlete({ fit: 4500, fitSessions: 47, fight: 400, fightSessions: 10, other: 60 }) },
  // Level 10 on the Fight side (4,960 XP, mostly Fight): Combo Coach opens on ADVANCED.
  fight10: { name: 'ALEX', stats: athlete({ fit: 350, fitSessions: 4, fight: 4550, fightSessions: 53, other: 60 }) },
};

// Run in the page before the app boots, once per capture: the finished
// onboarding of a real user (a profile, no tour, no first-run invites) and the
// athlete. The combo-streak record is written up to date so the app does not
// replay the history and pay out milestone XP on the first load. The saved
// Quick Mission choices are the app's own defaults, so every run starts alike.
function seedPage({ stats, name, seed }) {
  // The app's random numbers (which workout a minute deals) from a seed, so a
  // re-run shows the same workouts. Set on every page load.
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (localStorage.getItem('__tm_broll')) return;
  const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  set('trainingModeOnboardingComplete', 'true');
  set('trainingModeTourComplete', 'true');
  set('tm_user_profile', { name, sex: 'male', age: '', heightVal: '', heightUnit: 'FT/IN', weightVal: '', weightUnit: 'LBS', experience: 'Some Training', goal: 'Train Like a Fighter', specialty: '', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names', discipline: 'Boxing' });
  set('tm_arcade_intro_seen', {});
  set('tm_camp_parq', { done: true, anyYes: false, ts: Date.now() });
  set('tm_practice_invite_v1', { introShownAt: new Date().toISOString() });
  set('tm_combo_v1', { state: { currentCombo: 0, longestCombo: 0, guardsHeld: 0, lastTrainedDate: null, history: [] }, lastProcessed: today, copyIdx: 0, flash: null });
  set('tm_qm_keys_v1', { workoutType: 'Bodyweight', difficulty: 'NORMAL', duration: 20, focus: 'FULL BODY' });
  set('tm_qm_card_open_v1', '0');
  if (stats) set('tm_user_stats', stats);
  set('__tm_broll', '1');
}

// Run in the page: the style sheet above, and the finger. A touch leaves a
// gold ripple where it lands and, while it is held (a drag), a small ring that
// follows it. Removal rides animationend, so a fake clock never strands one.
function fxPage({ css, rgb }) {
  const ensure = () => {
    const root = document.documentElement;
    if (!root) return null;
    if (!document.getElementById('__tmfx_css')) {
      const st = document.createElement('style');
      st.id = '__tmfx_css';
      st.textContent = `${css}
#__tmfx { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: hidden; }
#__tmfx .r { position: absolute; width: 74px; height: 74px; margin: -37px 0 0 -37px; border-radius: 50%; border: 3px solid rgba(${rgb},.9); background: rgba(${rgb},.16); box-shadow: 0 0 16px rgba(${rgb},.5); transform: scale(.22); opacity: 1; animation: __tmr .6s cubic-bezier(.15,.7,.3,1) forwards; }
#__tmfx .d { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 2px solid rgba(${rgb},.85); background: rgba(${rgb},.22); box-shadow: 0 0 12px rgba(${rgb},.45); }
#__tmfx .n { position: absolute; right: 0; bottom: 0; width: 2px; height: 2px; background: rgba(0,0,0,.01); }
@keyframes __tmr { to { transform: scale(1); opacity: 0; } }`;
      root.appendChild(st);
    }
    let layer = document.getElementById('__tmfx');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = '__tmfx';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<div class="n"></div>';
      root.appendChild(layer);
    }
    return layer;
  };
  const dots = new Map();
  const at = (e) => ({ x: e.clientX, y: e.clientY });
  addEventListener('pointerdown', (e) => {
    const layer = ensure();
    if (!layer) return;
    const { x, y } = at(e);
    const r = document.createElement('div');
    r.className = 'r'; r.style.left = `${x}px`; r.style.top = `${y}px`;
    r.addEventListener('animationend', () => r.remove());
    layer.appendChild(r);
    if (e.pointerType !== 'mouse') {
      const dot = document.createElement('div');
      dot.className = 'd'; dot.style.left = `${x}px`; dot.style.top = `${y}px`;
      layer.appendChild(dot); dots.set(e.pointerId, dot);
    }
  }, true);
  addEventListener('pointermove', (e) => {
    const dot = dots.get(e.pointerId);
    if (dot) { const { x, y } = at(e); dot.style.left = `${x}px`; dot.style.top = `${y}px`; }
  }, true);
  const lift = (e) => { const dot = dots.get(e.pointerId); if (dot) { dot.remove(); dots.delete(e.pointerId); } };
  addEventListener('pointerup', lift, true);
  addEventListener('pointercancel', lift, true);
  document.addEventListener('DOMContentLoaded', ensure);
  addEventListener('load', ensure);
  // A one-pixel, all-but-invisible mark whose colour flips: it makes the
  // compositor draw a frame on demand (see Recorder.nudge).
  window.__tmNudge = () => { const l = ensure(); const n = l && l.firstChild; if (n) n.style.background = n.style.background.endsWith('.01)') ? 'rgba(0,0,0,.02)' : 'rgba(0,0,0,.01)'; };
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps shared by the clips.
// ─────────────────────────────────────────────────────────────────────────────
// From a cold start to the Home screen, its concept pop-up closed.
const HOME = [
  { goto: true }, { waitText: /TAP ANYWHERE TO ENTER/, timeout: 20000 }, { wait: 1200 },
  { tapAt: [206, 366] }, { waitText: /FIT MODE/, timeout: 15000 }, { wait: 900 },
  { closePopups: true }, { wait: 500 },
];
const FIT_HUB = [...HOME, { tap: 'button[aria-label="FIT MODE"]' }, { waitText: /Short notice/, timeout: 10000 }, { wait: 800 }];
const FIGHT_HUB = [...HOME, { tap: 'button[aria-label="FIGHT MODE"]' }, { waitText: /COMBO COACH/, timeout: 10000 }, { wait: 800 }];
const QM_PAGE = [...FIT_HUB, { tap: '[data-guide="fit-quick"]' }, { waitText: /TODAY.S QUICK MISSION/, timeout: 10000 }, { wait: 800 }];
const PROFILE = [...HOME, { tap: { role: 'button', name: 'PROFILE', exact: true, nth: -1 } }, { waitText: /YOUR STATS/, timeout: 10000 }, { wait: 800 }];

// Taps on the page's own buttons.
const GUIDED = { role: 'radio', name: 'GUIDED', exact: true };
const AT_YOUR_PACE = { role: 'radio', name: 'AT YOUR PACE', exact: true };
const START = { role: 'button', name: /^START$/ };
const SEE_ALL = { text: /^SEE ALL \d+ MOVES$/ };
const ADJUST_ROW = { text: /^ADJUST$/ };
const SHEET_DONE = { css: '[role="dialog"] button', hasText: /DONE/ };

// The TIME knob through a list of minutes: one drag per stop, a breath between,
// each as long as the distance asks.
function knobTour(stops, { pause = 480 } = {}) {
  const out = [];
  for (let i = 1; i < stops.length; i++) {
    const ms = Math.min(1500, Math.max(620, 520 + 32 * Math.abs(stops[i] - stops[i - 1])));
    out.push({ slide: stops[i], ms }, { wait: pause });
  }
  return out;
}

// A Quick Mission page for an athlete, then ADJUST: the level they open on,
// marked YOUR LEVEL, and a tap on another.
const quickLevelSteps = ({ level, pick }) => [
  { wait: 450 },
  { tap: '[data-guide="fit-quick"]', after: 350 },
  { waitText: /TODAY.S QUICK MISSION/, timeout: 10000 },
  { expect: new RegExp(`\\n${level}\\n`) },
  { wait: 1500 },
  { tap: SEE_ALL, after: 750 },
  { tap: ADJUST_ROW, after: 450 },
  { waitText: /YOUR LEVEL/, timeout: 6000 },
  { wait: 1700 },
  ...(pick ? [{ tap: { role: 'radio', name: pick, exact: true }, after: 1300 }] : []),
  { tap: SHEET_DONE, after: 900 },
];

// The Level page: a slow reading scroll from the portrait down to the end.
const levelPageSteps = ({ level, stops }) => [
  { wait: 900 },
  { tap: 'button[aria-label="Avatar and level"]', after: 300 },
  { waitText: /WHAT LEVEL \d+ MEANS/, timeout: 8000 },
  { expect: new RegExp(`LEVEL ${level}\\n`) },
  { wait: 1500 },
  ...stops.flatMap(([to, ms, hold]) => [{ scroll: '[data-screen="level"]', to, ms }, { wait: hold }]),
];

// Combo Coach from the Fight hub: the setup on the athlete's level, START, the
// countdown and the first combos. The screen loads on first use, so prep opens
// it once and comes back: the recorded tap then opens it at once.
const COMBO_PREP = [
  ...FIGHT_HUB,
  { tap: '[data-guide="fh-combo"]' }, { waitText: /STARTS AT YOUR LEVEL/, timeout: 20000 }, { wait: 600 },
  { tap: { role: 'button', name: /^Back to Fight Mode$/ } }, { waitText: /SKILLS & CONDITIONING/, timeout: 8000 }, { wait: 800 },
];
const comboSteps = ({ line, hold = 3600 }) => [
  { wait: 600 },
  { tap: '[data-guide="fh-combo"]', after: 300 },
  { waitText: /STARTS AT YOUR LEVEL/, timeout: 10000 },
  { expect: new RegExp(line) },
  { wait: 1700 },
  { tap: { role: 'button', name: /START COMBOS/ }, after: 250 },
  { waitText: /ROUND 1/, timeout: 6000 },
  { wait: 500 },
  { clock: 2600 },
  { waitText: /STREAK/, timeout: 12000 },
  { wait: hold },
];

// ─────────────────────────────────────────────────────────────────────────────
// The clips. (names and what each shows: the B-roll contract)
// ─────────────────────────────────────────────────────────────────────────────
const CLIPS = [
  {
    name: 'qm-slider', persona: 'lvl3',
    note: 'Quick Mission: the TIME knob dragged 20 > 5 > 8 > 30 > 45 > 60 > 10; the card follows live',
    prep: QM_PAGE,
    steps: [
      { expect: /\n20 MIN\n/ }, { wait: 1000 },
      ...knobTour([20, 5, 8, 30, 45, 60, 10]),
      { wait: 700 },
    ],
  },
  {
    name: 'qm-start-guided', persona: 'lvl3', clock: true,
    note: '10 minutes, START on GUIDED: the get-ready, then the first move on the coach screen',
    prep: QM_PAGE,
    steps: [
      { wait: 500 },
      { tapMinute: 10, after: 800 },
      { expect: /\n10 MIN\n/ },
      { tap: GUIDED, after: 400 },
      { tap: START, after: 200 },
      { waitText: /PREPARING/, timeout: 8000 },
      { wait: 700 },
      { clock: 3600 },
      { waitText: /GET READY/, timeout: 8000 },
      { wait: 1200 },
      { clock: 5600 },
      { waitText: /REP \d+ \/ \d+/, timeout: 8000 },
      { wait: 3000 },
    ],
  },
  {
    name: 'qm-at-your-pace', persona: 'lvl3', clock: true,
    note: 'AT YOUR PACE: START, the list of moves and the timer, one ROUND tap',
    prep: [...QM_PAGE, { tapMinute: 10, after: 800 }],
    steps: [
      { wait: 700 },
      { tap: AT_YOUR_PACE, after: 900 },
      { tap: START, after: 200 },
      { waitText: /GET READY/, timeout: 12000 },
      { wait: 1400 },
      { clock: 3800 },
      { waitText: /ROUND 1/, timeout: 8000 },
      { wait: 1000 },
      { jump: 128000 },
      { wait: 900 },
      { tap: { role: 'button', name: 'ROUND', exact: true }, after: 1800 },
    ],
  },
  {
    name: 'qm-adjust', persona: 'lvl3',
    note: 'ADJUST: LEVEL EASY / MEDIUM / HARD / ADVANCED with YOUR LEVEL under the athlete\'s, a tap on another',
    prep: QM_PAGE,
    steps: [
      { wait: 700 },
      { tap: SEE_ALL, after: 800 },
      { tap: ADJUST_ROW, after: 450 },
      { waitText: /YOUR LEVEL/, timeout: 6000 },
      { wait: 1700 },
      { tap: { role: 'radio', name: 'HARD', exact: true }, after: 1400 },
      { tap: SHEET_DONE, after: 1200 },
    ],
  },
  {
    name: 'qm-mode-toggle', persona: 'lvl3',
    note: 'GUIDED | AT YOUR PACE: the switch above START flips to AT YOUR PACE and back; the line under it follows',
    prep: [...QM_PAGE, { tapMinute: 10, after: 800 }],
    steps: [
      { expect: /\n10 MIN\n/ },
      { wait: 1000 },
      { tap: AT_YOUR_PACE, after: 1700 },
      { expect: /Beeps, no coach voice/ },
      { tap: GUIDED, after: 1700 },
      { expect: /coach calls every move/i },
      { tap: AT_YOUR_PACE, after: 1500 },
      { wait: 300 },
    ],
  },
  {
    name: 'qm-gear', persona: 'lvl3',
    note: 'GEAR: taps WEIGHTED, then HYBRID, then back to BODYWEIGHT; the card rebuilds for each kit',
    prep: [...QM_PAGE, { tapMinute: 10, after: 800 }],
    steps: [
      { expect: /\n10 MIN\n/ },
      { wait: 900 },
      { tap: { role: 'radio', name: 'WEIGHTED', exact: true }, after: 1500 },
      { tap: { role: 'radio', name: 'HYBRID', exact: true }, after: 1500 },
      { tap: { role: 'radio', name: 'BODYWEIGHT', exact: true }, after: 1500 },
      { wait: 300 },
    ],
  },
  {
    name: 'cc-pick-level', persona: 'rookie',
    note: 'Combo Coach setup for a level 1 athlete: a tap on NORMAL, HARD, then ADVANCED; the line under the levels follows (FOR TODAY ONLY)',
    prep: COMBO_PREP,
    steps: [
      { wait: 600 },
      { tap: '[data-guide="fh-combo"]', after: 300 },
      { waitText: /STARTS AT YOUR LEVEL/, timeout: 10000 },
      { expect: /EASY: Single strikes/ },
      { wait: 1500 },
      { tap: { role: 'radio', name: /^Normal$/ }, after: 1400 },
      { expect: /NORMAL: Longer combos/ },
      { tap: { role: 'radio', name: /^Hard$/ }, after: 1400 },
      { tap: { role: 'radio', name: /^Advanced$/ }, after: 1700 },
      { expect: /ADVANCED: Singles to the hardest/ },
    ],
  },
  {
    name: 'lvl1-quick', persona: 'rookie',
    note: 'A level 1 athlete opens Quick Mission: it opens on EASY; ADJUST shows YOUR LEVEL under EASY',
    prep: FIT_HUB,
    steps: quickLevelSteps({ level: 'EASY' }),
  },
  {
    name: 'lvl10-quick', persona: 'lvl10',
    note: 'A level 10 athlete opens Quick Mission on ADVANCED; ADJUST shows YOUR LEVEL under ADVANCED',
    prep: FIT_HUB,
    steps: quickLevelSteps({ level: 'ADVANCED' }),
  },
  {
    name: 'lvl3-level-page', persona: 'lvl3',
    note: 'Profile of a level 3 athlete, tap the avatar: the Level page scrolls slowly (ladder, what it means, AT YOUR LEVEL, what you have done)',
    prep: [...PROFILE, { expect: /LVL 3 / }],
    steps: levelPageSteps({ level: 3, stops: [[300, 1700, 900], [610, 1700, 2400], [1000, 2400, 1300]] }),
  },
  {
    name: 'lvl10-level-page', persona: 'lvl10',
    note: 'The same for the level 10 athlete (Max on the ladder, Quick Missions start at ADVANCED)',
    prep: [...PROFILE, { expect: /LVL 10 / }],
    steps: levelPageSteps({ level: 10, stops: [[300, 1700, 900], [610, 1700, 2400], [1000, 2400, 1300]] }),
  },
  {
    name: 'cc-lvl1', persona: 'rookie', clock: true,
    note: 'A level 1 Fight athlete opens Combo Coach: EASY with YOUR LEVEL, START, the first short combos',
    prep: COMBO_PREP,
    steps: comboSteps({ line: 'EASY: Single strikes', hold: 9000 }), // the 4.0 s cadence: three combos
  },
  {
    name: 'cc-lvl10', persona: 'fight10', clock: true,
    note: 'A level 10 Fight athlete opens Combo Coach on ADVANCED: its longer, mixed combos',
    prep: COMBO_PREP,
    steps: comboSteps({ line: 'ADVANCED', hold: 9000 }), // the 2.5 s cadence: four combos
  },
  {
    name: 'max-out', persona: 'lvl3', clock: true,
    note: 'Mission Library > MAX OUT (five workouts), BOSS RUSH on the card, START, a set with DONE, HOW MANY REPS?, the rest, then the finish with total reps',
    prep: QM_PAGE,
    steps: [
      { wait: 500 },
      { tap: { text: /^MISSION LIBRARY$/ }, after: 900 },
      { tap: { text: /^MAX OUT/ }, after: 1400 },
      { expect: /BOSS RUSH/ },
      { tap: { role: 'button', name: /PUT ON CARD/ }, after: 1100 },
      { tap: START, after: 200 },
      { waitText: /PREPARING/, timeout: 8000 },
      { wait: 600 },
      { clock: 3600 },
      { waitText: /GET READY/, timeout: 8000 },
      { wait: 1000 },
      { clock: 9000 },
      { waitText: /TAP DONE/, timeout: 8000 },
      { wait: 900 },
      { jump: 38000 },
      { wait: 400 },
      { tap: { css: 'button', hasText: /^DONE$/ }, after: 800 },
      { waitText: /HOW MANY REPS/, timeout: 6000 },
      { tap: { css: '[role="dialog"] button, button', hasText: /^\d+$/ }, after: 300 },
      { eval: () => document.activeElement && document.activeElement.select && document.activeElement.select() },
      { type: '31', delay: 190 }, { wait: 500 },
      { tap: { role: 'button', name: 'SAVE' }, after: 900 },
      { waitText: /REST/, timeout: 6000 },
      { wait: 1500 },
      // The other eight sets, off camera, up to the finish. (The finish screen
      // offers a share sheet about 2.5 s in: the clip ends before it.)
      { hide: [...finishBossRush([24, 19, 40, 38, 30, 40, 33, 27]), { waitText: /SESSION COMPLETE/, timeout: 20000 }] },
      { wait: 2000 },
    ],
  },
  {
    name: 'hub', persona: 'rookie',
    note: 'The Fit Mode screen (Today\'s Mission card), then a tap on the Quick Mission row',
    prep: FIT_HUB,
    steps: [
      { wait: 2000 },
      { tap: '[data-guide="fit-quick"]', after: 200 },
      { waitText: /TODAY.S QUICK MISSION/, timeout: 10000 },
      { wait: 2000 },
    ],
  },
];

// BOSS RUSH has nine sets (three moves, three rounds); the first is on camera.
// Off camera: jump through each rest and get-ready, finish each set after a
// real-looking time on the clock, enter its reps.
function finishBossRush(reps) {
  return reps.flatMap((n) => [
    { untilText: /TAP DONE/, jump: 5000, max: 40 },
    { clock: 36000 }, { wait: 150 },
    { tap: { css: 'button', hasText: /^DONE$/ }, after: 500 },
    { waitText: /HOW MANY REPS/, timeout: 6000 },
    { tap: { css: '[role="dialog"] button, button', hasText: /^\d+$/ }, after: 250 },
    { eval: () => document.activeElement && document.activeElement.select && document.activeElement.select() },
    { type: String(n), delay: 30 },
    { tap: { role: 'button', name: 'SAVE' }, after: 500 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plumbing: arguments, the file server, the browser.
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const has = (name) => argv.includes(name);
const die = (msg) => { console.error(`app-broll: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A path as the owner reads it: relative to where they ran this, unless that climbs out.
const shown = (p) => { const r = path.relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; };

if (has('--help') || has('-h')) {
  const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n');
  console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
if (has('--list')) {
  for (const c of CLIPS) console.log(`${c.name.padEnd(18)} ${c.persona.padEnd(8)} ${c.note}`);
  process.exit(0);
}

const DIST = path.resolve(arg('--dist') || path.join(REPO, 'dist'));
const OUT = path.resolve(arg('--out') || path.join(RAW, 'app'));
const CONTACT = arg('--contact') ? path.resolve(arg('--contact')) : null;
const SEED = Number(arg('--seed') ?? 7);
const chosen = arg('--only') ? arg('--only').split(',').map((s) => s.trim()).filter(Boolean) : null;
if (chosen) for (const n of chosen) if (!CLIPS.some((c) => c.name === n)) die(`no clip "${n}". Clips: ${CLIPS.map((c) => c.name).join(', ')}`);
const todo = CLIPS.filter((c) => !chosen || chosen.includes(c.name));
if (!fs.existsSync(path.join(DIST, 'index.html'))) die(`${path.join(DIST, 'index.html')} not found. Build the app first (npm run build:web in the app) or pass --dist <dir>.`);

// playwright-core: the app repo's, found from the console folder's parent.
function loadPlaywright() {
  for (const base of [path.join(REPO, 'package.json'), import.meta.url]) {
    try { return createRequire(base)('playwright-core'); } catch { /* try the next place */ }
  }
  die('playwright-core is not installed. Run npm install in the app folder (it is one of the app\'s dev dependencies).');
}
const { chromium } = loadPlaywright();

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

async function launch() {
  const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'];
  const exe = arg('--chrome') || process.env.CHROME_PATH;
  if (exe) return chromium.launch({ headless: true, executablePath: exe, args });
  try { return await chromium.launch({ headless: true, args }); } catch (first) {
    try { return await chromium.launch({ headless: true, channel: 'chrome', args }); } catch { /* fall through */ }
    const guess = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((g) => fs.existsSync(g));
    if (guess) return chromium.launch({ headless: true, executablePath: guess, args });
    throw new Error(`no browser: ${String(first.message).split('\n')[0]}\nPass --chrome <exe> or set CHROME_PATH (Chrome, or the Chrome Headless Shell Remotion downloaded).`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The finger: touches sent to the page the way a phone would.
// ─────────────────────────────────────────────────────────────────────────────
// A small deterministic wobble, so taps do not all land on the exact centre.
const rng = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2);

class Finger {
  constructor(cdp) { this.cdp = cdp; this.id = 1; }
  touch(type, x, y) {
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: this.id, radiusX: 11, radiusY: 11, force: 0.6 }] });
  }
  async tap(x, y, hold = 90) {
    await this.touch('touchStart', x, y);
    await sleep(hold + Math.round(rng() * 40));
    await this.touch('touchEnd', x, y);
  }
  // Down at (x0, y0), a smooth eased path to (x1, y1) over ms, a beat, up.
  async drag(x0, y0, x1, y1, ms) {
    await this.touch('touchStart', x0, y0);
    await sleep(110);
    const t0 = Date.now();
    for (;;) {
      const p = Math.min(1, (Date.now() - t0) / ms);
      await this.touch('touchMove', x0 + (x1 - x0) * ease(p), y0 + (y1 - y0) * ease(p));
      if (p >= 1) break;
      await sleep(8);
    }
    await sleep(160);
    await this.touch('touchEnd', x1, y1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The recorder: the page's frames (CDP screencast, a JPEG per change with the
// time the compositor drew it), laid on a 30 fps clock.
// ─────────────────────────────────────────────────────────────────────────────
class Recorder {
  constructor(page, cdp, dir) {
    this.page = page; this.cdp = cdp; this.dir = dir;
    this.frames = []; this.paused = false; this.shift = 0; this.pausedAt = 0; this.n = 0; this.seen = 0;
    cdp.on('Page.screencastFrame', (f) => this.onFrame(f));
  }
  onFrame({ data, metadata, sessionId }) {
    this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    this.seen = metadata.timestamp;
    if (this.paused || this.stopped) return;
    const file = path.join(this.dir, `f${String(this.n++).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    this.frames.push({ ts: metadata.timestamp, file });
  }
  async start() {
    this.frames = []; this.stopped = false;
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: JPEG_QUALITY, maxWidth: OUT_SIZE.width, maxHeight: OUT_SIZE.height, everyNthFrame: 1 });
    await this.nudge();
    this.t0 = this.frames[0].ts;
  }
  // Make the page draw one frame and wait for it, so there is always a frame
  // that is "now" (a still screen draws nothing).
  async nudge() {
    const before = this.frames.length;
    for (let i = 0; i < 40 && this.frames.length === before; i++) {
      await this.page.evaluate(() => window.__tmNudge && window.__tmNudge()).catch(() => {});
      await sleep(50);
    }
    if (this.frames.length === before) throw new Error('the page drew no frames (is the browser headless and the page loaded?)');
  }
  // Off camera: frames stop counting. The footage goes straight from the last
  // frame before to the first after.
  async pause() {
    await this.nudge();
    this.pausedAt = this.frames[this.frames.length - 1].ts;
    this.paused = true;
  }
  async resume() {
    this.paused = false;
    const before = this.frames.length;
    await this.nudge();
    const first = this.frames[before];
    this.shift += first.ts - (this.pausedAt + 1 / FPS);
    // Every frame kept from here on is moved back over the gap.
    for (let i = before; i < this.frames.length; i++) this.frames[i].cut = this.shift;
  }
  async stop() {
    await this.nudge();
    this.stopped = true;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
  }
  // The frames with the off-camera gaps closed: [{ t (seconds from the start), file }].
  timeline() {
    let shift = 0;
    return this.frames.map((f) => {
      if (f.cut !== undefined) shift = f.cut;
      return { t: f.ts - shift - this.t0, file: f.file };
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps.
// ─────────────────────────────────────────────────────────────────────────────
const bodyText = (page) => page.evaluate(() => document.body.innerText);

function locate(page, t) {
  if (typeof t === 'string') return page.locator(t);
  const scope = t.in ? page.locator(t.in) : page;
  let loc;
  if (t.role) loc = scope.getByRole(t.role, { name: t.name, exact: t.exact });
  else if (t.css) loc = scope.locator(t.css, t.hasText ? { hasText: t.hasText } : undefined);
  else if (t.text) loc = scope.getByText(t.text, { exact: t.exact });
  else throw new Error(`unknown target ${JSON.stringify(t)}`);
  return loc;
}
async function pick(page, t) {
  let loc = locate(page, t).filter({ visible: true });
  const nth = typeof t === 'object' && t.nth !== undefined ? t.nth : 0;
  loc = loc.nth(nth);
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error(`no box for ${JSON.stringify(t)}`);
  return b;
}
const jitter = (size) => (rng() - 0.5) * Math.min(12, size * 0.3);

async function minuteX(page, minutes) {
  const r = await page.locator('input.qm-range').boundingBox();
  if (!r) throw new Error('the TIME slider is not on screen');
  const MIN = 5, MAX = 60, KNOB = 28; // QM_TIME_MIN, QM_TIME_MAX, THUMB
  return { x: r.x + KNOB / 2 + ((minutes - MIN) / (MAX - MIN)) * (r.width - KNOB), y: r.y + r.height / 2 };
}

const OPS = {
  wait: (c, ms) => sleep(ms),
  goto: (c) => c.page.goto(BASE, { waitUntil: 'networkidle' }),
  closePopups: async (c) => {
    await c.page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  },
  tap: async (c, target, s) => { const b = await pick(c.page, target); await c.finger.tap(b.x + b.width / 2 + jitter(b.width), b.y + b.height / 2 + jitter(b.height)); },
  tapAt: (c, [x, y]) => c.finger.tap(x, y),
  tapMinute: async (c, m) => { const { x, y } = await minuteX(c.page, m); await c.finger.tap(x, y); },
  slide: async (c, to, s) => {
    const from = Number(await c.page.locator('input.qm-range').inputValue());
    const a = await minuteX(c.page, from), b = await minuteX(c.page, to);
    await c.finger.drag(a.x, a.y, b.x, b.y, s.ms || 1000);
    const now = Number(await c.page.locator('input.qm-range').inputValue());
    if (now !== to) throw new Error(`the TIME knob ended on ${now}, not ${to}`);
  },
  scroll: (c, sel, s) => c.page.evaluate(({ sel, to, ms }) => new Promise((done) => {
    const el = document.querySelector(sel);
    const from = el.scrollTop, t0 = performance.now();
    const f = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.scrollTop = from + (to - from) * (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);
      if (p < 1) requestAnimationFrame(f); else done();
    };
    requestAnimationFrame(f);
  }), { sel, to: s.to, ms: s.ms }),
  type: async (c, text, s) => { await c.page.keyboard.type(text, { delay: s.delay || 120 }); },
  eval: (c, fn) => c.page.evaluate(fn),
  clock: (c, ms) => c.page.clock.runFor(ms),     // runs every timer on the way: counters tick through
  jump: (c, ms) => c.page.clock.fastForward(ms), // one leap: a clock that reads Date.now() lands on the new time
  waitText: async (c, re, s) => {
    const until = Date.now() + (s.timeout || 8000);
    let t = '';
    while (Date.now() < until) { t = await bodyText(c.page); if (re.test(t)) return; await sleep(100); }
    throw new Error(`waited for ${re} and the screen says: ${t.replace(/\n+/g, ' | ').slice(0, 300)}`);
  },
  expect: async (c, re) => {
    const t = await bodyText(c.page);
    if (!re.test(`\n${t}\n`)) throw new Error(`expected ${re} on screen, it says: ${t.replace(/\n+/g, ' | ').slice(0, 300)}`);
  },
  // Jump the clock in steps until the text shows (rests and get-readies).
  untilText: async (c, re, s) => {
    for (let i = 0; i < (s.max || 30); i++) {
      if (re.test(await bodyText(c.page))) return;
      await c.page.clock.runFor(s.jump || 3000); await sleep(120);
    }
    throw new Error(`jumped the clock and never saw ${re}`);
  },
  hide: async (c, steps) => {
    if (c.rec) await c.rec.pause();
    try { await run(c, steps); } finally { if (c.rec) await c.rec.resume(); }
  },
};
const TAPS = new Set(['tap', 'tapAt', 'tapMinute']);

async function run(c, steps) {
  for (const step of steps) {
    const op = Object.keys(step).find((k) => OPS[k]);
    if (!op) throw new Error(`unknown step ${JSON.stringify(step)}`);
    try { await OPS[op](c, step[op], step); } catch (e) { throw new Error(`step ${op} ${typeof step[op] === 'function' ? '' : String(step[op]).slice(0, 60)}: ${String(e.message).split('\n')[0]}`); }
    const after = step.after ?? (TAPS.has(op) ? (c.rec ? 650 : 350) : 0);
    if (after) await sleep(after);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One clip: capture, then encode.
// ─────────────────────────────────────────────────────────────────────────────
async function recordClip(browser, clip) {
  const persona = PERSONAS[clip.persona];
  if (!persona) throw new Error(`persona ${clip.persona}?`);
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'en-US' });
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), `tm-broll-${clip.name}-`));
  try {
    await ctx.addInitScript(seedPage, { stats: persona.stats, name: persona.name, seed: SEED });
    await ctx.addInitScript(fxPage, { css: BASE_CSS + (has('--concept-art') ? '' : CONCEPT_CSS), rgb: GOLD });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    const cdp = await ctx.newCDPSession(page);
    if (clip.clock) await page.clock.install();
    const c = { page, cdp, finger: new Finger(cdp), rec: null };
    await run(c, clip.prep || []);
    const rec = new Recorder(page, cdp, frames);
    await rec.start();
    c.rec = rec;
    await run(c, clip.steps);
    await rec.stop();
    if (errors.length) console.log(`   (page errors: ${[...new Set(errors)].join(' / ')})`);
    return encode(clip, rec.timeline(), frames);
  } finally {
    await ctx.close().catch(() => {});
    if (!has('--keep-frames')) fs.rmSync(frames, { recursive: true, force: true });
    else console.log(`   frames kept in ${frames}`);
  }
}

// The captured frames onto a constant 30 fps (each output tick takes the latest
// frame drawn by then), through ffmpeg's concat list, to 1080x1920 H.264.
function encode(clip, timeline, dir) {
  const last = timeline[timeline.length - 1].t + 1 / FPS;
  // The longest wait between two drawn frames that is not a still screen (a gap
  // over 0.4 s is a screen holding still): a high number is a stutter.
  let stall = 0;
  for (let i = 1; i < timeline.length; i++) { const g = timeline[i].t - timeline[i - 1].t; if (g < 0.4) stall = Math.max(stall, g); }
  const count = Math.max(1, Math.round(last * FPS));
  const picks = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = i / FPS + 0.5 / FPS;
    while (j + 1 < timeline.length && timeline[j + 1].t <= t) j++;
    picks.push(timeline[j].file);
  }
  const list = [];
  for (let i = 0; i < picks.length;) {
    let k = i;
    while (k < picks.length && picks[k] === picks[i]) k++;
    list.push(`file '${path.basename(picks[i])}'`, `duration ${((k - i) / FPS).toFixed(6)}`);
    i = k;
  }
  list.push(`file '${path.basename(picks[picks.length - 1])}'`);
  const listFile = path.join(dir, 'frames.txt');
  fs.writeFileSync(listFile, list.join('\n') + '\n');
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${clip.name}.mp4`);
  // JPEG frames are full-range BT.601; the video is limited-range BT.709 and says so.
  ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `scale=${OUT_SIZE.width}:${OUT_SIZE.height}:flags=lanczos+accurate_rnd+full_chroma_int:in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-an', '-movflags', '+faststart', out,
  ]);
  const info = ffprobe(['-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration,size', '-of', 'default=nw=1', out]);
  const get = (k) => (info.match(new RegExp(`${k}=(.*)`)) || [])[1];
  console.log(`   wrote ${shown(out)}  ${Number(get('duration')).toFixed(1)} s  ${get('width')}x${get('height')}  ${get('nb_frames')} frames  ${(get('size') / 1e6).toFixed(1)} MB  (${timeline.length} captured, ${(timeline.length / last).toFixed(0)}/s, longest stall in motion ${Math.round(stall * 1000)} ms)`);
  if (CONTACT) {
    fs.mkdirSync(CONTACT, { recursive: true });
    const cols = 6, rows = Math.ceil(Math.ceil(Number(get('duration'))) / cols);
    ffmpeg(['-i', out, '-vf', `fps=1,scale=270:480,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', path.join(CONTACT, `${clip.name}.jpg`)]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
const browser = await launch();
const failed = [];
try {
  for (const clip of todo) {
    console.log(`${clip.name}: ${clip.note}`);
    try { await recordClip(browser, clip); } catch (e) { failed.push(clip.name); console.error(`   FAILED ${clip.name}: ${e.message}`); }
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
console.log(failed.length ? `\n${todo.length - failed.length} of ${todo.length} clips written; failed: ${failed.join(', ')}` : `\n${todo.length} clip${todo.length === 1 ? '' : 's'} written to ${shown(OUT)}`);
process.exit(failed.length ? 1 : 0);
