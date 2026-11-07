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
// THE SYNC GROUP (--only sync, or one of them: --only cc-sync-boxing-1): eight videos of Combo
// Coach playing, two for each of boxing, kickboxing, Muay Thai and MMA, with a guide track, so
// the owner can film themselves striking to the calls and the two be lined up from the sound
// later (tools/align-audio.mjs). Each is the app's real session screen from its own 3-2-1 to the
// end of the 10th combo's slot (no end screen): names call style, COMBO mode, warm-up OFF, one
// round of 1 minute, RUSH off. Video 1 of a discipline is a level 5 athlete (the NORMAL mix),
// video 2 a level 10 athlete (the ADVANCED mix). They are recorded in real time, because the
// calls have to land where the app lands them.
//   --cadence <s>     seconds per combo (default 4.5: a 6-strike combo is doable on a bag)
//   --calls <n>       combos per video (default 10)
//   --voice <name>    the speech engine (default: the first one installed, see tools/sync-audio.mjs)
//   --no-voice        no speech engine: beeps, bell and a tick per call (a silent-voice guide)
//   --sync-out <dir>  where the guide videos, timing sheets and the two pages are copied
//                     (default exports/cc-sync; the videos themselves go to <out>/sync)
//   --app-commit <x>  the app's commit as written in the sheets (default: read from the dist's git)
//   --probe-seeds <n|a,b,c> records nothing: tries the seeds 1 to n (or the list) for each sync clip chosen
//                     (the app's clock is run in small steps, so a seed takes about 40 s) and lists the
//                     combos each deals, to pick seeds (SYNC_SEEDS) whose videos share no combo
// The SEEDS are fixed per video (SYNC_SEEDS below) and are what makes a re-run deal the same combos.
// The app speaks with the device's speech synthesis, which a headless browser does not have: a
// stand-in (SPEECH_PAGE) takes its place, tells the app each line took as long as it really takes
// to say (so the app's own flow runs as it does with a real voice), and logs every line with its
// time; the lines are then spoken offline (tools/sync-audio.mjs) and mixed on the video's timeline.
//
// Needs ffmpeg on the PATH (npm run doctor checks it; libx264, and the fps and
// tile filters for --contact) and a built export of the app. No music. The clips are silent
// except the sync group, whose guide track is beeps, the app's bell and the coach's voice.
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
//   { tap: <target>, after: ms, hold: ms }     a finger tap (after: pause once it lands; hold: how long the finger
//                                              stays down, default about 110 ms: a longer press lets the gold ripple
//                                              show before a button that changes the screen fires)
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
import { spawnSync } from 'node:child_process';
import { REPO, RAW, EXPORTS, ffmpeg, ffprobe } from './lib.mjs';
import * as SA from './sync-audio.mjs';
import * as SS from './sync-sheet.mjs';

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

// The name is neutral on purpose (the Profile and the Level page print it in
// capitals, so it is on screen): never a real person, never a test name.
const NAME = 'Trainee';
const PERSONAS = {
  // Level 1: a new account, no sessions.
  rookie: { name: NAME, stats: null },
  // Level 3 (1,210 XP, Fit work): Quick Mission opens on MEDIUM, Combo Coach on EASY.
  lvl3: { name: NAME, stats: athlete({ fit: 1150, fitSessions: 12, other: 60 }) },
  // Level 10 (4,960 XP, 57 sessions, mostly Fit): Quick Mission opens on ADVANCED;
  // the Fight side (400 XP in full, the rest at half) is level 6, HARD.
  lvl10: { name: NAME, stats: athlete({ fit: 4500, fitSessions: 47, fight: 400, fightSessions: 10, other: 60 }) },
  // Level 10 on the Fight side (4,960 XP, mostly Fight): Combo Coach opens on ADVANCED.
  fight10: { name: NAME, stats: athlete({ fit: 350, fitSessions: 4, fight: 4550, fightSessions: 53, other: 60 }) },
  // Level 5 on the Fight side (2,350 XP, mostly Fight: 2,150 of it from Fight sessions, so the Fight
  // XP counts 2,150 in full and the other 200 at half = 2,250): Combo Coach opens on NORMAL.
  fight5: { name: NAME, stats: athlete({ fit: 150, fitSessions: 2, fight: 2150, fightSessions: 26, other: 50 }) },
};

// Run in the page before the app boots, once per capture: the finished
// onboarding of a real user (a profile, no tour, no first-run invites) and the
// athlete. The combo-streak record is written up to date so the app does not
// replay the history and pay out milestone XP on the first load. The saved
// Quick Mission choices are the app's own defaults, so every run starts alike.
function seedPage({ stats, name, seed, profile }) {
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
  // `profile` overrides a few of the app's own settings for the clips that need them (the sync videos:
  // the discipline, and the coach's between-combo encouragement turned OFF, the app's own setting).
  set('tm_user_profile', { name, sex: 'male', age: '', heightVal: '', heightUnit: 'FT/IN', weightVal: '', weightUnit: 'LBS', experience: 'Some Training', goal: 'Train Like a Fighter', specialty: '', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names', discipline: 'Boxing', ...(profile || {}) });
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
  // SEE ALL opens the whole list: the reps are the level (Lunges 6 at EASY,
  // 18 at ADVANCED), so it holds for a good look before ADJUST opens.
  { tap: SEE_ALL, after: 1700 },
  { tap: ADJUST_ROW, after: 450 },
  { waitText: /YOUR LEVEL/, timeout: 6000 },
  { wait: 1700 },
  ...(pick ? [{ tap: { role: 'radio', name: pick, exact: true }, after: 1300 }] : []),
  { tap: SHEET_DONE, after: 900 },
];

// The Level page: a tap on the portrait (its LEVEL > tag), then a slow reading
// scroll from the hero down to the end.
const levelPageSteps = ({ level, stops }) => [
  { wait: 900 },
  { tap: 'button[aria-label="View your level"]', hold: 320, after: 300 },
  { waitText: /WHAT LEVEL \d+ MEANS/, timeout: 8000 },
  { expect: new RegExp(`LEVEL ${level}\\n`) },
  { wait: 1500 },
  ...stops.flatMap(([to, ms, hold]) => [{ scroll: '[data-screen="level"]', to, ms }, { wait: hold }]),
];

// Where the Level page stops: the hero card (after the tap), the ladder, then
// AT YOUR LEVEL with its block clear of the HUD at the top and of the caption
// panel below (about y 410 to 1050 of the 1920 frame), then the end of the page.
const LEVEL_STOPS = [[300, 1700, 1300], [640, 1500, 3200], [1000, 1500, 1000]];

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
    note: 'AT YOUR PACE: START, the 5-second get-ready and the timer in real time, the list of moves, then (one jump of the clock) one ROUND tap',
    prep: [...QM_PAGE, { tapMinute: 10, after: 800 }],
    steps: [
      { wait: 700 },
      { tap: AT_YOUR_PACE, after: 900 },
      { tap: START, after: 200 },
      { waitText: /GET READY/, timeout: 12000 },
      // The 5-second GET READY and the first seconds of the stopwatch run in
      // real time: no fast-forward is ever on camera. Only the long wait for the
      // end of round 1 is leapt (one jump; the stopwatch lands on the new time).
      { wait: 5400 },
      { wait: 2800 },
      { jump: 128000 },
      { wait: 900 },
      { tap: { role: 'button', name: 'ROUND', exact: true }, after: 1800 },
    ],
  },
  {
    name: 'qm-adjust', persona: 'rookie',
    note: 'ADJUST: LEVEL EASY / MEDIUM / HARD / ADVANCED with YOUR LEVEL under the athlete\'s (a level 1 athlete: EASY), a tap on another',
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
    name: 'qm-start-8', persona: 'lvl3',
    note: '8 minutes picked: the START button, a tap on it (GUIDED, the default), then PREPARING',
    prep: [...QM_PAGE, { tapMinute: 8, after: 800 }],
    steps: [
      { expect: /\n8 MIN\n/ },
      { wait: 1000 },
      // A deliberate press: the finger stays down so the ripple shows before the screen changes.
      { tap: START, hold: 380, after: 200 },
      { waitText: /PREPARING/, timeout: 8000 },
      { wait: 1300 },
    ],
  },
  {
    name: 'qm-gear', persona: 'lvl3',
    note: 'GEAR (8 minutes): taps WEIGHTED, then HYBRID, then back to BODYWEIGHT; the card rebuilds for each kit',
    prep: [...QM_PAGE, { tapMinute: 8, after: 800 }],
    steps: [
      { expect: /\n8 MIN\n/ },
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
    steps: levelPageSteps({ level: 3, stops: LEVEL_STOPS }),
  },
  {
    name: 'lvl10-level-page', persona: 'lvl10',
    note: 'The same for the level 10 athlete (Max on the ladder, Quick Missions start at ADVANCED)',
    prep: [...PROFILE, { expect: /LVL 10 / }],
    steps: levelPageSteps({ level: 10, stops: LEVEL_STOPS }),
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
      { wait: 400 },
      { tap: { text: /^MAX OUT/ }, after: 1200 },
      { expect: /BOSS RUSH/ },
      // The list is the only part of the sheet that scrolls: slide it so all
      // five MAX OUT rows pass (BOSS RUSH, HEALTH BAR, COMBO METER, TANK MODE,
      // DUAL WIELD), then back up to BOSS RUSH.
      { scroll: '[role="radiogroup"][aria-label="Missions"]', to: 400, ms: 1700 }, { wait: 900 },
      { scroll: '[role="radiogroup"][aria-label="Missions"]', to: 0, ms: 900 }, { wait: 500 },
      { tap: { role: 'button', name: /PUT ON CARD/ }, after: 1100 },
      { tap: START, after: 200 },
      { waitText: /PREPARING/, timeout: 8000 },
      { wait: 600 },
      // The get-ready is fast-forwarded off camera: the footage cuts from
      // PREPARING straight to the set (no clock leap is ever on screen).
      { hide: [
        { clock: 3600 },
        { waitText: /GET READY/, timeout: 8000 },
        { wait: 1000 },
        { clock: 9000 },
        { waitText: /TAP DONE/, timeout: 8000 },
      ] },
      { wait: 800 },
      { jump: 38000 }, // the stopwatch sits under the HUD, so the leap is not seen
      { wait: 700 },
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
// The sync group: Combo Coach playing, with a guide track (see the header).
// ─────────────────────────────────────────────────────────────────────────────
// Video 1 of a discipline is a level 5 Fight athlete (Combo Coach opens on NORMAL), video 2 a level
// 10 one (ADVANCED). The SEED is the app's random numbers, set just before START: same seed, same
// combos (the dealer takes its random numbers from it), so a re-run deals the same ones. The pool of a
// discipline is 68 combos (MMA 74); a video uses ten. The seeds below were picked with --probe-seeds 8
// (every seed 1 to 8 for every video, nothing recorded) as, for each discipline, the pair whose two
// videos share NO combo, with mostly mid-length combos (3 to 5 pieces) at level 5 and longer ones at
// level 10. Change a seed and the video deals other combos.
const SYNC_DISCIPLINES = [
  { slug: 'boxing', name: 'Boxing' },
  { slug: 'kickboxing', name: 'Kickboxing' },
  { slug: 'muaythai', name: 'Muay Thai' },
  { slug: 'mma', name: 'MMA' },
];
const SYNC_LEVELS = [
  { n: 1, persona: 'fight5', level: 5, difficulty: 'NORMAL', line: /NORMAL: Longer combos/ },
  { n: 2, persona: 'fight10', level: 10, difficulty: 'ADVANCED', line: /ADVANCED: Singles to the hardest/ },
];
const SYNC_SEEDS = {
  'cc-sync-boxing-1': 1, 'cc-sync-boxing-2': 7,
  'cc-sync-kickboxing-1': 8, 'cc-sync-kickboxing-2': 2,
  'cc-sync-muaythai-1': 1, 'cc-sync-muaythai-2': 7,
  'cc-sync-mma-1': 5, 'cc-sync-mma-2': 4,
};

// The app's random numbers from a seed (mulberry32, as the dealer's own). Run in the page.
const RESEED = (seed) => `(() => { let a = ${seed} >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`;

// The setup screen as the guide needs it, checked in the page: a mistake here would record the
// wrong session. `want` = { rounds, roundMin, cadence, difficulty }.
const SETUP_OK = (want) => `((want) => {
  const val = (l) => (document.querySelector('input[aria-label="' + l + '"]') || {}).value;
  const on = (g) => [...document.querySelectorAll('[role="radiogroup"][aria-label="' + g + '"] [role="radio"][aria-checked="true"]')];
  const bad = [];
  if (val('WARM-UP') !== 'OFF') bad.push('WARM-UP is ' + val('WARM-UP'));
  if (val('ROUNDS') !== String(want.rounds)) bad.push('ROUNDS is ' + val('ROUNDS'));
  if (val('ROUND LENGTH') !== '1:00') bad.push('ROUND LENGTH is ' + val('ROUND LENGTH'));
  if (Number(val('CADENCE')) !== want.cadence) bad.push('CADENCE is ' + val('CADENCE'));
  const mode = on('MODE').map((b) => b.textContent.trim());
  if (mode[0] !== 'COMBO') bad.push('MODE is ' + mode[0]);
  const call = on('CALL STYLE').map((b) => b.textContent.trim());
  if (call[0] !== 'NAMES') bad.push('CALL STYLE is ' + call[0]);
  const diff = on('Difficulty')[0];
  if (!diff || !new RegExp('^' + want.difficulty, 'i').test(diff.getAttribute('aria-label') || '')) bad.push('DIFFICULTY is not ' + want.difficulty);
  else if (!diff.querySelector('[data-your-level]')) bad.push('DIFFICULTY is not the own level of the athlete');
  if (!/Tap to add all-out surges/.test(document.body.innerText)) bad.push('RUSH MODE is on');
  if (bad.length) throw new Error('the setup is not what the guide needs: ' + bad.join(', '));
})(${JSON.stringify(want)})`;

// The speech stand-in, run in the page before the app boots (see the header). The app calls
// speechSynthesis.speak(utterance); this asks the recorder (window.__tmSay) how long the line takes
// to say, tells the app it started, and tells it it ended that long after: the app's own flow (it
// waits for each call to be spoken) runs exactly as it does with a real voice. Every line is logged
// with the time it began. A MutationObserver logs every element that fades up (the 3-2-1, ROUND 1,
// GO, each combo call) with the time it was added: the moment its text shows. Both clocks are
// epoch milliseconds, the clock the screencast's frames are stamped with.
function speechPage() {
  const now = () => performance.timeOrigin + performance.now();
  const log = [], events = [];
  window.__tmSpeechLog = log;
  window.__tmEvents = events;
  const watch = () => {
    new MutationObserver((muts) => {
      const t = now();
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const hit = n.classList && n.classList.contains('anim-fade-up') ? n : (n.querySelector && n.querySelector('.anim-fade-up'));
          if (hit) events.push({ t, text: (hit.textContent || '').replace(/\s+/g, ' ').trim() });
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);

  class Utter {
    constructor(text = '') {
      this.text = String(text); this.lang = ''; this.voice = null; this.volume = 1; this.rate = 1; this.pitch = 1;
      this.onstart = this.onend = this.onerror = this.onboundary = this.onpause = this.onresume = this.onmark = null;
      this._l = {};
    }
    addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); }
    removeEventListener(type, fn) { this._l[type] = (this._l[type] || []).filter((f) => f !== fn); }
    dispatchEvent() { return true; }
  }
  const fire = (u, type, extra) => {
    const e = Object.assign({ type, utterance: u, charIndex: 0, charLength: 0, elapsedTime: 0, name: '' }, extra || {});
    try { if (typeof u['on' + type] === 'function') u['on' + type](e); } catch (err) { console.error(err); }
    for (const f of u._l[type] || []) { try { f(e); } catch (err) { console.error(err); } }
  };
  const voices = [{ name: 'Google UK English Female', lang: 'en-GB', default: true, localService: true, voiceURI: 'Google UK English Female' }];
  let queue = [], current = null, timer = null, paused = false;
  const startNext = async () => {
    if (current || !queue.length) return;
    const u = (current = queue.shift());
    let info;
    try { info = await window.__tmSay(u.text, u.rate, u.volume); } catch (err) { info = { ms: 500 }; }
    if (current !== u) return; // cancelled while the recorder was working out how long it takes
    const entry = { text: u.text, rate: u.rate, volume: u.volume, t: now(), ms: info.ms };
    log.push(entry);
    fire(u, 'start');
    timer = setTimeout(() => {
      if (current !== u) return;
      current = null; timer = null;
      fire(u, 'end', { elapsedTime: info.ms / 1000 });
      startNext();
    }, info.ms);
    u.__entry = entry;
  };
  const synth = {
    speak(u) { queue.push(u); startNext(); },
    cancel() {
      const q = queue; queue = [];
      const u = current;
      if (u) {
        current = null; clearTimeout(timer); timer = null;
        if (u.__entry) u.__entry.cut = Math.round(now() - u.__entry.t); // stopped early: the sound is cut there
        fire(u, 'error', { error: 'canceled' });
      }
      for (const x of q) fire(x, 'error', { error: 'canceled' });
    },
    pause() { paused = true; }, resume() { paused = false; },
    getVoices() { return voices; },
    get speaking() { return !!current; }, get pending() { return queue.length > 0; }, get paused() { return paused; },
    onvoiceschanged: null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utter, configurable: true, writable: true });
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true });
}

// The prep and steps of one sync video. They read the options (cadence, calls) when the clip is
// recorded, so a clip is only data until then.
const SYNC_ROUNDS = 1, SYNC_ROUND_MIN = 1;
function syncClip(d, lv) {
  const name = `cc-sync-${d.slug}-${lv.n}`;
  return {
    name, group: 'sync', persona: lv.persona,
    note: `Combo Coach, ${d.name}, level ${lv.level} (${lv.difficulty}): the 3-2-1, then 10 combos by voice, with the guide track`,
    profile: { discipline: d.name, encouragement: 'off', callStyle: 'names' },
    sync: { discipline: d.name, slug: d.slug, level: lv.level, difficulty: lv.difficulty, seed: SYNC_SEEDS[name] },
    build: (o) => ({
      prep: [
        ...FIGHT_HUB,
        { tap: '[data-guide="fh-combo"]' }, { waitText: /STARTS AT YOUR LEVEL/, timeout: 20000 }, { wait: 700 },
        { expect: lv.line },
        { stepTo: 'ROUNDS', value: SYNC_ROUNDS, parse: 'num' },
        { stepTo: 'ROUND LENGTH', value: SYNC_ROUND_MIN, parse: 'mmss' },
        { stepTo: 'CADENCE', value: o.cadence, parse: 'num' },
        { wait: 500 },
        { eval: SETUP_OK({ rounds: SYNC_ROUNDS, cadence: o.cadence, difficulty: lv.difficulty }) },
        { wait: 400 },
      ],
      steps: [
        { eval: RESEED(SYNC_SEEDS[name]) },
        { tap: { role: 'button', name: /START COMBOS/ }, hold: 140, after: 0 },
        { syncWait: o.calls },
        { wait: 500 }, // frames after the last event, so the picture of it is found
      ],
    }),
  };
}
for (const d of SYNC_DISCIPLINES) for (const lv of SYNC_LEVELS) CLIPS.push(syncClip(d, lv));

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
  for (const c of CLIPS) console.log(`${c.name.padEnd(22)} ${c.persona.padEnd(8)} ${c.note}`);
  console.log('\n"--only sync" records the eight cc-sync-* videos (see --help).');
  process.exit(0);
}

const DIST = path.resolve(arg('--dist') || path.join(REPO, 'dist'));
const OUT = path.resolve(arg('--out') || path.join(RAW, 'app'));
const CONTACT = arg('--contact') ? path.resolve(arg('--contact')) : null;
const SEED = Number(arg('--seed') ?? 7);
const GROUPS = Object.fromEntries([...new Set(CLIPS.map((c) => c.group).filter(Boolean))].map((g) => [g, CLIPS.filter((c) => c.group === g).map((c) => c.name)]));
const chosen = arg('--only') ? arg('--only').split(',').map((s) => s.trim()).filter(Boolean).flatMap((n) => GROUPS[n] || [n]) : null;
if (chosen) for (const n of chosen) if (!CLIPS.some((c) => c.name === n)) die(`no clip "${n}". Clips: ${CLIPS.map((c) => c.name).join(', ')}. Groups: ${Object.keys(GROUPS).join(', ')}`);
const todo = CLIPS.filter((c) => !chosen || chosen.includes(c.name));
// The sync group's options.
const CADENCE = Number(arg('--cadence') ?? 4.5);
const CALLS = Number(arg('--calls') ?? 10);
if (!(CADENCE >= 2 && CADENCE <= 8 && Math.round(CADENCE * 2) === CADENCE * 2)) die('--cadence is in seconds, from 2 to 8 in steps of 0.5 (the app\'s own CADENCE stepper).');
if (!(Number.isInteger(CALLS) && CALLS >= 1 && CALLS <= 12)) die('--calls is the number of combos per sync video, 1 to 12.');
const SYNC_OUT = path.resolve(arg('--sync-out') || path.join(EXPORTS, 'cc-sync'));
if (todo.some((c) => c.sync) && CALLS * CADENCE + 9 > 57) die(`${CALLS} combos at ${CADENCE} s do not fit in the one-minute round (the coach goes quiet in its last 3 s). Use fewer --calls or a shorter --cadence.`);
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
      return { t: f.ts - shift - this.t0, ts: f.ts, file: f.file };
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

// What the screen showed in a sync clip, from the page's log of every element that faded up:
// the count-in digits, ROUND 1, GO and each call (a combo, or a slip / roll / check / pivot / sprawl
// call, which the app writes in capitals with a "!").
const SYNC_NOT_CALL = /^([123]|ROUND \d+|GO|MULTIPLE OPPONENTS)$/;
const SYNC_DEFENCE = /^[A-Z ]+!$/;
function syncEvents(events) {
  const out = { count: [], round: null, go: null, calls: [] };
  for (const e of events) {
    if (/^[123]$/.test(e.text)) { if (!out.count.some((x) => x.text === e.text)) out.count.push(e); }
    else if (/^ROUND \d+$/.test(e.text)) out.round = out.round || e;
    else if (e.text === 'GO') out.go = out.go || e;
    else if (SYNC_NOT_CALL.test(e.text)) continue;
    else {
      // The first combo is added twice, a few ms apart (when the count-in clears, then when the call
      // loop starts): the first one is when it shows.
      const prev = out.calls[out.calls.length - 1];
      if (prev && prev.text === e.text && e.t - prev.t < 250) continue;
      out.calls.push({ ...e, defence: SYNC_DEFENCE.test(e.text) });
    }
  }
  return out;
}

const OPS = {
  wait: (c, ms) => sleep(ms),
  goto: (c) => c.page.goto(BASE, { waitUntil: 'networkidle' }),
  closePopups: async (c) => {
    await c.page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  },
  tap: async (c, target, s) => { const b = await pick(c.page, target); await c.finger.tap(b.x + b.width / 2 + jitter(b.width), b.y + b.height / 2 + jitter(b.height), s.hold); },
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
  // A stepper row (ROUNDS, ROUND LENGTH, CADENCE) to a value, by its own - and + buttons.
  stepTo: async (c, label, s) => {
    const read = async () => {
      const v = await c.page.locator(`input[aria-label="${label}"]`).inputValue();
      const m = /^(\d+):(\d\d)$/.exec(v);
      return s.parse === 'mmss' && m ? Number(m[1]) + Number(m[2]) / 60 : Number(v);
    };
    let v = await read();
    for (let i = 0; i < 40 && Math.abs(v - s.value) > 1e-6; i++) {
      await OPS.tap(c, { role: 'button', name: `${v < s.value ? 'Increase' : 'Decrease'} ${label.toLowerCase()}`, exact: true }, {});
      await sleep(260);
      v = await read();
    }
    if (Math.abs(v - s.value) > 1e-6) throw new Error(`${label} would not reach ${s.value}: it says ${v}`);
  },
  // The sync videos: wait (in real time) until the n-th combo has had its whole slot, that is until
  // the call after it has appeared on screen (the next combo, or a slip / roll call).
  syncWait: async (c, n) => {
    const until = Date.now() + (n + 4) * CADENCE * 1000 + 30000;
    for (;;) {
      const { calls } = syncEvents(await c.page.evaluate(() => window.__tmEvents));
      let k = 0, at = -1;
      calls.forEach((x, i) => { if (!x.defence && ++k === n && at < 0) at = i; });
      if (at >= 0 && calls.length > at + 1) return;
      if (Date.now() > until) throw new Error(`waited for ${n} combos and the screen showed ${k}`);
      await sleep(100);
    }
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
    await ctx.addInitScript(seedPage, { stats: persona.stats, name: persona.name, seed: clip.sync ? clip.sync.seed : SEED, profile: clip.profile });
    await ctx.addInitScript(fxPage, { css: BASE_CSS + (has('--concept-art') ? '' : CONCEPT_CSS), rgb: GOLD });
    if (clip.sync) await startSync(ctx, clip, persona);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    const cdp = await ctx.newCDPSession(page);
    if (clip.clock) await page.clock.install();
    const c = { page, cdp, finger: new Finger(cdp), rec: null };
    const built = clip.build ? clip.build({ cadence: CADENCE, calls: CALLS }) : null;
    await run(c, built ? built.prep : clip.prep || []);
    const rec = new Recorder(page, cdp, frames);
    await rec.start();
    c.rec = rec;
    await run(c, built ? built.steps : clip.steps);
    await rec.stop();
    if (errors.length) console.log(`   (page errors: ${[...new Set(errors)].join(' / ')})`);
    if (clip.sync) return await finishSync(clip, persona, rec, page, frames);
    return encode(clip, rec.timeline(), frames);
  } finally {
    await ctx.close().catch(() => {});
    if (!has('--keep-frames')) fs.rmSync(frames, { recursive: true, force: true });
    else console.log(`   frames kept in ${frames}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The sync videos: the speech stand-in's bridge, and what is made once the session is captured.
// ─────────────────────────────────────────────────────────────────────────────
let VOICE = null, BANK = null; // the speech engine and its phrases (set in main, null with --no-voice)

// The athlete's Fight level, by the app's rule (data/athleteLevel.js): the Fight XP in full, every
// other XP at half, 500 XP a level. A check on the persona; the setup screen's own YOUR LEVEL is the proof.
function fightLevel(stats) {
  const total = Number(stats?.xp) || 0;
  let own = 0;
  for (const r of stats?.sessions || []) if (/Combo Coach|Fight Focus|Practice/.test(r.type)) own += Number(r.xpEarned) || 0;
  own = Math.min(own, total);
  return Math.floor((own + (total - own) * 0.5) / 500) + 1;
}

// How fast a line is said: the app's rate, and the round announcement a little quicker (a call is
// the coach's job at the pace of the cadence, "Round 1. Boxing. 4.5 second cadence." is patter).
const lineRate = (text, rate) => (rate || 1) * (/^round \d/i.test(String(text).trim()) ? 1.15 : 1);

// The page asks how long a line takes to say. The count-in digits and the primer are not mixed.
function syncSay(text, rate) {
  const t = String(text || '').trim();
  if (!t) return { ms: 30 };                // the silent line that wakes the engine
  if (/^[123]$/.test(t)) return { ms: 300 }; // the app's spoken 3 - 2 - 1: the guide has beeps instead
  if (!BANK) return { ms: Math.round(Math.max(500, t.split(/\s+/).length * 420) / Math.max(0.5, lineRate(t, rate))) };
  return { ms: BANK.say(t, lineRate(t, rate)).ms };
}

async function startSync(ctx, clip, persona) {
  const level = fightLevel(persona.stats);
  if (level !== clip.sync.level) throw new Error(`persona ${clip.persona} is a level ${level} Fight athlete; ${clip.name} needs level ${clip.sync.level}`);
  await ctx.addInitScript(speechPage);
  await ctx.exposeFunction('__tmSay', syncSay);
}

// The app's commit as written in the sheets: the git commit of the folder the export was built in.
function appCommit() {
  if (arg('--app-commit')) return arg('--app-commit');
  for (const dir of [DIST, path.dirname(DIST), REPO]) {
    const r = spawnSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return 'unknown';
}

// Of the captured frames around an event (epoch seconds), the index of the first whose picture is
// different from the one before, in the part of the screen the change is in (the ring and the count-in
// number: the top 55% under the title bar). Each frame is read as a 90 x 160 gray picture.
function firstChangedFrame(timeline, sec) {
  const lo0 = timeline.findIndex((f) => f.ts >= sec - 0.04);
  if (lo0 < 1) return null;
  let hi = timeline.findIndex((f) => f.ts >= sec + 0.3);
  if (hi < 0) hi = timeline.length - 1;
  const lo = lo0 - 1, n = hi - lo + 1;
  if (n < 3) return null;
  const first = path.basename(timeline[lo].file);
  const m = /^(.*?)(\d+)\.jpg$/.exec(first);
  const W = 90, H = 160;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-start_number', String(Number(m[2])), '-i', path.join(path.dirname(timeline[lo].file), `${m[1]}%0${m[2].length}d.jpg`), '-frames:v', String(n), '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
  if (r.status !== 0 || r.stdout.length < n * W * H) return null;
  const px = r.stdout;
  const diff = [];
  for (let k = 1; k < n; k++) {
    let s = 0, c = 0;
    for (let y = Math.floor(H * 0.1); y < Math.floor(H * 0.55); y++) for (let x = 0; x < W; x++) { s += Math.abs(px[k * W * H + y * W + x] - px[(k - 1) * W * H + y * W + x]); c++; }
    diff.push(s / c);
  }
  const top = Math.max(...diff);
  if (top < 0.5) return null;
  return lo + 1 + diff.findIndex((d) => d >= top * 0.5);
}

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim();
const r3 = (x) => Math.round(x * 1000) / 1000;

async function finishSync(clip, persona, rec, page, frames) {
  const { events, speech } = await page.evaluate(() => ({ events: window.__tmEvents, speech: window.__tmSpeechLog }));
  if (has('--keep-frames')) fs.writeFileSync(path.join(frames, 'events.json'), JSON.stringify({ events, speech, frames: rec.timeline().map((f) => [f.ts, f.t]) }));
  const ev = syncEvents(events);
  if (ev.count.length < 3 || !ev.round || !ev.go) throw new Error(`the count-in did not show 3, 2, 1, ROUND, GO (the screen showed ${events.map((e) => e.text).slice(0, 8).join(' | ')})`);
  const timeline = rec.timeline();
  // The capture second of the first frame that SHOWS what the page changed at epoch ms `ms`. A change
  // reaches a captured frame one to four 60 Hz frames after the page makes it (and not by a fixed
  // amount), so the frames near the event are looked at: the first whose picture changed.
  let byTime = 0;
  const visible = (ms) => {
    let i = firstChangedFrame(timeline, ms / 1000);
    if (i === null) {
      // The pixels gave no answer (a gap in the captured frames, a change too small to measure): fall back
      // to the usual delay, 40 ms, and say so.
      i = timeline.findIndex((f) => f.ts >= ms / 1000 + 0.04);
      if (i < 0) throw new Error(`no captured frame after the page's change at ${((ms - events[0].t) / 1000).toFixed(2)} s ("${(events.find((e) => e.t === ms) || {}).text}")`);
      byTime++;
    }
    return timeline[i].t;
  };
  const t0 = visible(ev.count[0].t);
  // The video second at which that frame starts to show: the first 30 fps tick that picks it.
  const at = (ms) => Math.ceil((visible(ms) - t0) * FPS - 0.5 - 1e-6) / FPS;

  // The calls: the first CALLS combos, with the defence calls between, and the call after the last
  // one, where the video ends (so the last combo has its whole slot).
  let k = 0, last = -1;
  ev.calls.forEach((c, i) => { if (!c.defence && ++k === CALLS && last < 0) last = i; });
  if (last < 0 || ev.calls.length <= last + 1) throw new Error(`only ${k} combos were dealt`);
  const length = at(ev.calls[last + 1].t);
  const used = ev.calls.slice(0, last + 1).map((c) => ({ ...c, startSec: at(c.t) }));
  const dealt = used.filter((c) => !c.defence).map((c) => c.text);
  if (new Set(dealt).size !== dealt.length) throw new Error(`a combo came twice in one video: ${dealt.join(' / ')}`);

  // Every line the app spoke, matched to the screen event it belongs to.
  const lines = [];
  const free = [...used];
  for (const e of speech) {
    const t = norm(e.text);
    if (!t || /^[123]$/.test(t)) continue;
    let place = null, kind = 'other';
    if (/^round \d/.test(t)) { place = at(ev.round.t); kind = 'round'; }
    else if (/^go$/.test(t)) { place = at(ev.go.t); kind = 'go'; }
    else {
      const i = free.findIndex((c) => norm(c.text) === t && e.t - c.t >= -50 && e.t - c.t < 1500);
      if (i >= 0) { place = free[i].startSec; kind = 'call'; free[i].spoken = e.text; free[i].lineMs = e.cut ?? e.ms; free.splice(i, 1); }
    }
    if (place === null) continue; // a line outside the video (after its end) or not part of it
    if (place >= length) continue;
    lines.push({ at: place, text: e.text, rate: e.rate, ms: e.cut ?? e.ms, kind });
  }

  // The count-in beeps sit where the app says "3", "2", "1" (one a second, exactly: the first digit
  // is spoken a moment after its number shows), measured on the page's own clock from the first number.
  const said = speech.filter((e) => /^[123]$/.test(String(e.text).trim())).slice(0, 3);
  if (said.length < 3) throw new Error('the app did not count 3, 2, 1');
  const beeps = said.map((e) => r3((e.t - ev.count[0].t) / 1000));

  // The sheet.
  const calls = [];
  for (let i = 0; i < used.length; i++) {
    const c = used[i], next = i + 1 < used.length ? used[i + 1].startSec : length;
    const counts = c.defence ? { pieceCount: 1, strikeCount: 0 } : await SS.countOf(c.text);
    const strikes = c.defence ? [SS.plainPiece(c.text.replace(/!$/, '').toLowerCase())] : await SS.plainStrikes(c.text);
    const ms = c.lineMs ?? 0;
    calls.push({
      index: i + 1, kind: c.defence ? 'defence' : 'combo', text: c.text, spoken: c.spoken ?? null,
      strikeCount: counts.strikeCount, pieceCount: counts.pieceCount,
      startSec: r3(c.startSec), speechEndSec: r3(c.startSec + ms / 1000), nextCallSec: r3(next), windowSec: r3(next - c.startSec),
      strikes, plain: strikes.join(', '),
    });
  }
  const sheet = {
    name: clip.name, discipline: clip.sync.discipline, athleteLevel: clip.sync.level, difficulty: clip.sync.difficulty,
    cadenceSec: CADENCE, seed: clip.sync.seed, appCommit: appCommit(),
    durationSec: r3(length), goAtSec: r3(at(ev.go.t)), countInBeepsAtSec: beeps,
    roundAnnouncementAtSec: r3(at(ev.round.t)),
    voice: VOICE ? { id: VOICE.name, engine: VOICE.label } : null,
    calls,
  };

  // The picture, then the guide track, then both in one file.
  const dir = path.join(OUT, 'sync');
  const silent = path.join(frames, `${clip.name}.silent.mp4`);
  const tl = timeline.filter((f) => f.t >= t0 - 1e-9).map((f) => ({ ...f, t: f.t - t0 }));
  encode(clip, tl, frames, { length, out: silent, quiet: true, exact: true });
  const final = path.join(dir, `${clip.name}.mp4`);
  // Every sound is placed so that the moment it is HEARD (SA.onsetOf: the loudness reaching a fifth of its
  // peak) is the moment on the sheet; a bell strike takes about 40 ms to reach that, a beep 3 ms.
  const placed = (pcm, want, what) => ({ at: r3(Math.max(0, want - (SA.onsetOf(pcm) ?? 0))), want, pcm, what });
  const elements = [
    ...sheet.countInBeepsAtSec.map((x) => placed(SA.beepPcm(), x, 'beep')),
    placed(SA.bellPcm(), sheet.goAtSec, 'bell'),
  ];
  // The bell rings on GO and its tail runs on for two seconds, under the first call, which comes about
  // half a second after it. A real mixer would duck the bell for the voice; so does this: it drops 20 dB over
  // 150 ms, finishing as the first call starts (its strike and its first half second are untouched).
  const first = lines.find((l) => l.kind === 'call');
  if (first) {
    const bell = elements.find((el) => el.what === 'bell');
    const ramp = Math.round(0.15 * SA.SR), from = Math.round((first.at - bell.at - 0.15) * SA.SR);
    if (from > 0 && from < bell.pcm.length) {
      for (let i = from; i < bell.pcm.length; i++) bell.pcm[i] *= 1 - 0.9 * Math.min(1, (i - from) / ramp);
    }
  }
  for (const l of lines) {
    if (BANK) {
      const said = BANK.say(l.text, lineRate(l.text, l.rate));
      let pcm = said.pcm;
      if (l.ms < pcm.length / SA.SR * 1000 - 5) { // stopped early: cut there with a short fade
        pcm = pcm.slice(0, Math.round((l.ms / 1000) * SA.SR));
        const f = Math.min(pcm.length, Math.round(0.01 * SA.SR));
        for (let i = 0; i < f; i++) pcm[pcm.length - 1 - i] *= i / f;
      }
      // the voice starts early by its own soft attack, so the moment it SOUNDS is the moment the words show
      const early = l.kind === 'go' ? 0 : Math.min(l.at, said.onset ?? 0); // "Go!" starts with the bell
      elements.push({ at: r3(l.at - early), want: l.at, pcm, what: l.kind, text: l.text });
    } else if (l.kind === 'call') elements.push({ at: l.at, want: l.at, pcm: SA.tickPcm(), what: 'tick', text: l.text });
  }
  fs.mkdirSync(dir, { recursive: true });
  const wav = path.join(frames, `${clip.name}.guide.wav`);
  const mix = SA.mixGuide(elements, length, wav);
  ffmpeg(['-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', String(length), '-movflags', '+faststart', final]);

  // The check, on the finished file (AAC and all): every sound is read back and found where the sheet says.
  // (1) cross-correlated against the sound that was put there (placement, to a sample); (2) its onset, the
  // way a person hears it begin (SA.onsetOf), within 30 ms of the moment the words show (AAC smears a sharp
  // start, "Check!", up to about 20 ms early; the placement above is exact). A sound that
  // another one plays over (the "Go!" on the bell, and the bell's own first moments) cannot be found on its
  // own and is skipped.
  const pcm = SA.decodeTrack(final);
  const spans = elements.map((el) => [el.at, el.at + el.pcm.length / SA.SR]);
  let worst = 0, worstLag = 0, n = 0, weak = null;
  const late = [];
  for (const [i, el] of elements.entries()) {
    const over = elements.filter((o, j) => j !== i && spans[j][0] < spans[i][1] && spans[j][1] > spans[i][0]);
    // (the bell, ducked, is under the first call and the "Go!"; the bell itself is found over them)
    if (over.some((o) => !(el.what === 'call' && o.what === 'bell') && !(el.what === 'bell' && o.what !== 'bell'))) continue;
    const { lag, match } = SA.lagOf(pcm, el.pcm, el.at);
    if (match < 0.5) weak = weak || `${el.what}${el.text ? ` "${el.text}"` : ''} at ${el.at} s (match ${match.toFixed(2)})`;
    worstLag = Math.max(worstLag, Math.abs(lag));
    const from = Math.max(0, el.at - 0.02); // the same window the sound's own onset was measured in (its first 0.6 s)
    const on = SA.onsetNear(pcm, from, 0.62);
    if (on === null) throw new Error(`no sound where the guide has a ${el.what}${el.text ? ` "${el.text}"` : ''} at ${el.want} s`);
    if (on - from < 0.004 && from > 0) continue; // a sound is already playing there (the bell's tail under the first call): the placement check above stands
    el.heard = on;
    worst = Math.max(worst, Math.abs(on - el.want)); n++;
    if (Math.abs(on - el.want) > 0.03) late.push(`${el.what}${el.text ? ` "${el.text}"` : ''} wanted ${el.want} heard ${on.toFixed(3)}`);
  }
  if (weak) throw new Error(`the finished file does not hold the sound the guide put at ${weak}`);
  if (worstLag > 0.01) throw new Error(`the sound in the file is ${Math.round(worstLag * 1000)} ms from where it was placed (limit 10 ms)`);
  if (late.length) throw new Error(`a sound is heard more than 30 ms from the moment its words show: ${late.join('; ')}`);
  // Back into the sheet: where each call's voice ends on the track, and (measured on the finished file) where it
  // is heard to begin.
  for (const c of calls) {
    const el = elements.find((x) => x.what === 'call' && Math.abs(x.want - c.startSec) < 0.001);
    if (!el) continue;
    c.speechEndSec = r3(el.at + el.pcm.length / SA.SR);
    if (el.heard !== undefined) c.audioOnsetSec = r3(el.heard);
  }
  sheet.durationSec = r3(length);
  sheet.loudness = SA.measureLoudness(final);
  SS.writeSheet(SYNC_OUT, sheet);
  fs.mkdirSync(SYNC_OUT, { recursive: true });
  fs.copyFileSync(final, path.join(SYNC_OUT, `${clip.name}.mp4`));
  if (byTime) console.log(`   (${byTime} of the picture times were found by the usual delay, not by the pixels)`);
  console.log(`   wrote ${shown(final)}  ${length.toFixed(2)} s  ${calls.filter((c) => c.kind === 'combo').length} combos${calls.some((c) => c.kind === 'defence') ? ` + ${calls.filter((c) => c.kind === 'defence').length} defence calls` : ''}  bell at ${sheet.goAtSec.toFixed(2)} s, first call ${calls[0].startSec.toFixed(2)} s, ${sheet.loudness.integratedLufs} LUFS  (guide sound heard within ${Math.max(1, Math.round(worst * 1000))} ms of the words over ${n} sounds)`);
  for (const c of calls) console.log(`     ${String(c.index).padStart(2)}  ${c.startSec.toFixed(2).padStart(6)} s  ${c.kind === 'defence' ? '(defence) ' : ''}${c.text}`);
  return final;
}

// The captured frames onto a constant 30 fps (each output tick takes the latest
// frame drawn by then), through ffmpeg's concat list, to 1080x1920 H.264.
function encode(clip, timeline, dir, opts = {}) {
  // opts.length: an exact length in seconds (the sync videos); opts.out: the file to write.
  const last = opts.length ?? timeline[timeline.length - 1].t + 1 / FPS;
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
  // How the frames go to ffmpeg. Normally a concat list with each picture's duration (a still screen is
  // one entry). The sync videos need every tick on its own picture, to the frame: ffmpeg's constant frame
  // rate conversion of a concat list with 0.033333 s durations adds a frame near the start and the
  // whole clip slips by one, so there one file per tick is linked into a numbered sequence.
  let input;
  if (opts.exact) {
    const seq = path.join(dir, 'ticks');
    fs.mkdirSync(seq, { recursive: true });
    picks.forEach((f, i) => {
      const to = path.join(seq, `t${String(i).padStart(6, '0')}.jpg`);
      try { fs.linkSync(f, to); } catch { fs.copyFileSync(f, to); }
    });
    input = ['-framerate', String(FPS), '-i', path.join(seq, 't%06d.jpg')];
  } else {
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
    input = ['-f', 'concat', '-safe', '0', '-i', listFile];
  }
  const out = opts.out || path.join(OUT, `${clip.name}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // JPEG frames are full-range BT.601; the video is limited-range BT.709 and says so.
  ffmpeg([
    ...input,
    '-vf', `scale=${OUT_SIZE.width}:${OUT_SIZE.height}:flags=lanczos+accurate_rnd+full_chroma_int:in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    ...(opts.length ? ['-frames:v', String(count)] : []),
    '-an', '-movflags', '+faststart', out,
  ]);
  const info = ffprobe(['-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration,size', '-of', 'default=nw=1', out]);
  const get = (k) => (info.match(new RegExp(`${k}=(.*)`)) || [])[1];
  if (!opts.quiet) console.log(`   wrote ${shown(out)}  ${Number(get('duration')).toFixed(1)} s  ${get('width')}x${get('height')}  ${get('nb_frames')} frames  ${(get('size') / 1e6).toFixed(1)} MB  (${timeline.length} captured, ${(timeline.length / last).toFixed(0)}/s, longest stall in motion ${Math.round(stall * 1000)} ms)`);
  if (opts.quiet) return { out, frames: Number(get('nb_frames')), stall };
  if (CONTACT) {
    fs.mkdirSync(CONTACT, { recursive: true });
    const cols = 6, rows = Math.ceil(Math.ceil(Number(get('duration'))) / cols);
    ffmpeg(['-i', out, '-vf', `fps=1,scale=270:480,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', path.join(CONTACT, `${clip.name}.jpg`)]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// --probe-seeds: the combos a seed deals, without recording. The app's clock is the fake one and is run in
// small steps (the speech stand-in answers in real time between them), so the whole count-in and ten
// combos take seconds. The combos come from the seed only, as in a recording.
async function probeSeed(browser, clip, seed) {
  const persona = PERSONAS[clip.persona];
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'en-US' });
  try {
    await ctx.addInitScript(seedPage, { stats: persona.stats, name: persona.name, seed, profile: clip.profile });
    await ctx.addInitScript(fxPage, { css: BASE_CSS + CONCEPT_CSS, rgb: GOLD });
    await startSync(ctx, clip, persona);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.clock.install();
    const c = { page, cdp, finger: new Finger(cdp), rec: null };
    const built = clip.build({ cadence: CADENCE, calls: CALLS });
    await run(c, built.prep);
    await page.evaluate(RESEED(seed));
    await run(c, [{ tap: { role: 'button', name: /START COMBOS/ }, hold: 140 }]);
    let combos = [];
    for (let i = 0; i < 1500 && combos.length < CALLS; i++) {
      await page.clock.runFor(100);
      await sleep(6);
      combos = syncEvents(await page.evaluate(() => window.__tmEvents)).calls.filter((x) => !x.defence).map((x) => x.text);
    }
    return combos.slice(0, CALLS);
  } finally { await ctx.close().catch(() => {}); }
}

// The guide's voice, once, for the whole group.
if (todo.some((c) => c.sync) && !has('--no-voice') && !arg('--probe-seeds')) {
  try { VOICE = SA.findVoice(arg('--voice')); } catch (e) { die(e.message); }
  if (VOICE) { BANK = new SA.VoiceBank(VOICE); console.log(`guide voice: ${VOICE.label}`); }
  else console.error(`\n!!! NO TEXT-TO-SPEECH ENGINE FOUND. The sync videos will have the beeps, the bell and a tick per call, and NO VOICE.\n!!! ${SA.installHint()}\n`);
}
const browser = await launch();
const failed = [];
if (arg('--probe-seeds')) {
  const v = arg('--probe-seeds');
  const list = v.includes(',') ? v.split(',').map(Number) : Array.from({ length: Number(v) }, (_, i) => i + 1);
  const jobs = todo.filter((c) => c.sync).flatMap((c) => list.map((seed) => ({ clip: c, seed })));
  const results = [];
  const worker = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      try {
        const combos = await probeSeed(browser, j.clip, j.seed);
        results.push({ clip: j.clip.name, seed: j.seed, combos });
        console.log(`${j.clip.name} seed ${j.seed}: ${combos.join(' / ')}`);
      } catch (e) { console.error(`${j.clip.name} seed ${j.seed}: FAILED ${e.message}`); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(path.join(os.tmpdir(), 'tm-sync-probe.json'), JSON.stringify(results, null, 1));
  console.log(`\nthe combos of every seed are in ${path.join(os.tmpdir(), 'tm-sync-probe.json')}`);
  await browser.close().catch(() => {});
  server.close();
  process.exit(0);
}
try {
  for (const clip of todo) {
    console.log(`${clip.name}: ${clip.note}`);
    try { await recordClip(browser, clip); } catch (e) { failed.push(clip.name); console.error(`   FAILED ${clip.name}: ${e.message}`); }
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
// The two pages the owner reads, from every sheet in the sync folder.
if (todo.some((c) => c.sync) && todo.some((c) => c.sync && !failed.includes(c.name))) {
  const sheets = SS.readSheets(SYNC_OUT);
  if (sheets.length) {
    fs.writeFileSync(path.join(SYNC_OUT, 'CALLS.md'), SS.callsPage(sheets));
    fs.writeFileSync(path.join(SYNC_OUT, 'FILM-GUIDE.md'), SS.filmGuide(sheets));
    console.log(`\nthe film guide and the call tables for ${sheets.length} video${sheets.length === 1 ? '' : 's'}: ${shown(SYNC_OUT)}`);
  }
}
console.log(failed.length ? `\n${todo.length - failed.length} of ${todo.length} clips written; failed: ${failed.join(', ')}` : `\n${todo.length} clip${todo.length === 1 ? '' : 's'} written to ${shown(OUT)}`);
process.exit(failed.length ? 1 : 0);
