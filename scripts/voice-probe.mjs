#!/usr/bin/env node
// voice-probe: a diagnostic harness for the spoken coach (voiceCoach.js).
//
// Serves a built web export of the app, opens it in headless Chromium at phone
// size (412x811, touch, mobile), replaces window.speechSynthesis with a
// RECORDER before the app boots, drives one screen to its start, and records
// what the app tried to say — every speak() with its text, volume, rate,
// pitch, voice and timing, every cancel(), the pause()/resume() counts, the
// getVoices() calls, and the OUTCOME of every utterance (started, ended,
// errored, dropped) under the chosen engine model.
//
// Engines (what the fake speechSynthesis does):
//   real          one en-GB female voice, 'voiceschanged' 50 ms after load; start
//                 80 ms after speak(), end after max(300, words*350, chars*70)/rate
//                 ms (30 ms for empty text); cancel() errors 'canceled' on the
//                 current and queued utterances. A well-behaved desktop Chrome.
//   android-drop  like real, but a speak() within 150 ms after a cancel() is
//                 dropped silently (no start/end/error, speaking stays false) and
//                 'start' comes 250 ms after speak(). Android Chrome + Google TTS.
//   dead          getVoices() is [] forever, no 'voiceschanged', speak() fires
//                 nothing, speaking/pending stay false. An engine that is gone.
//   novoices      real timing, but getVoices() is [] and no 'voiceschanged' (the
//                 app must still speak with voice = null).
//
// Usage:
//   node scripts/voice-probe.mjs --dist <dir> --screen <name|a,b,c|all>
//        --engine <real|android-drop|dead|novoices> --seconds <n> --out <json>
//        [--shot <png>] [--headful never]
// Defaults: --dist .claude/worktrees/app-dist/dist (a build of this commit),
// --screen fight_focus, --engine real, --seconds 25. Always exits 0 and writes
// the JSON; prints one table row per screen.
// Screens: fight_focus, fight_focus_warmup, fight_focus_resume, just_train,
// combo_coach, combat_cond, practice_round, quick_mission_guided,
// quick_mission_ayp, quick_mission_maxout, build_workout, cardio_run,
// cardio_machine, arcade_stage, camp_session (or a comma list, or all).
//
// Chrome: CHROME_PATH (default /opt/pw-browsers/chromium). playwright-core from
// the repo's node_modules. TMPDIR is forced to /tmp/claude-0/vp.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt; };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const DIST = path.resolve(opt('dist', path.join(REPO, '.claude', 'worktrees', 'app-dist', 'dist')));
const SCREEN = opt('screen', 'fight_focus');
const ENGINE = opt('engine', 'real');
const SECONDS = Math.max(5, Number(opt('seconds', 25)) || 25);
const SHOT = opt('shot', null);
const SCRATCH_DEFAULT = '/tmp/claude-0/-home-user-trainingmodecode/52346ed0-e562-5cd3-9c38-16af9f8a62dd/scratchpad/voice-audit/harness';
const OUT = path.resolve(opt('out', path.join(SCRATCH_DEFAULT, `voice-probe-${SCREEN}-${ENGINE}.json`)));
const ENGINES = ['real', 'android-drop', 'dead', 'novoices'];

const TMP = '/tmp/claude-0/vp';
fs.mkdirSync(TMP, { recursive: true });
process.env.TMPDIR = TMP;
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const results = [];
const STARTED_AT = new Date().toISOString();
// Written after every screen as well as at the end, so a run that is killed
// part-way (a timeout, a lost container) still leaves the screens it finished.
const writeJson = (partial) => {
  const payload = { meta: { dist: DIST, screen: SCREEN, engine: ENGINE, seconds: SECONDS, startedAt: STARTED_AT, node: process.version, partial: !!partial }, results };
  try { fs.writeFileSync(OUT, JSON.stringify(payload, null, 2)); } catch (e) { console.error('voice-probe: could not write', OUT, e.message); }
};
const finish = async (browser, server) => {
  try { if (browser) await browser.close(); } catch {}
  try { if (server) server.close(); } catch {}
  writeJson(false);
  printTable(results);
  console.log(`json: ${OUT}`);
  process.exit(0);
};

if (!ENGINES.includes(ENGINE)) {
  results.push({ screen: SCREEN, engine: ENGINE, verdict: 'UNREACHED', unreached: `unknown engine ${ENGINE} (use ${ENGINES.join('|')})` });
  await finish(null, null);
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  results.push({ screen: SCREEN, engine: ENGINE, verdict: 'UNREACHED', unreached: `${DIST}/index.html missing — build the web export first` });
  await finish(null, null);
}

// ── Static server (as scripts/smoke-web.mjs) ────────────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

// ── Browser (as smoke-web.mjs; CHROME_PATH defaults to the installed Chromium) ──
const launchOpts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
launchOpts.executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
let browser;
try { browser = await chromium.launch(launchOpts); } catch (e) {
  results.push({ screen: SCREEN, engine: ENGINE, verdict: 'UNREACHED', unreached: `could not launch Chromium at ${launchOpts.executablePath}: ${String(e.message).split('\n')[0]}` });
  await finish(null, server);
}

// ── Init scripts: the recorder (first), then the storage seed ───────────────
// The recorder runs in the page at document start, before any app code.
function recorderInit({ engine }) {
  const now = () => Math.round(performance.now() * 10) / 10;
  const speaks = [], cancels = [], events = [];
  const vp = {
    engine, speaks, cancels, events, resumes: 0, pauses: 0, voicesCalls: 0,
    voiceschangedFired: false, voiceschangedAt: null, outcomes: [],
    get speaking() { return synth.speaking; }, get pending() { return synth.pending; },
  };
  Object.defineProperty(window, '__vp', { value: vp, configurable: true, writable: true });

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
    events.push({ t: now(), i: u.__entry ? u.__entry.i : -1, type, error: extra && extra.error });
    try { if (typeof u['on' + type] === 'function') u['on' + type](e); } catch (err) { console.error('[vp] handler threw', type, err); }
    for (const f of u._l[type] || []) { try { f(e); } catch (err) { console.error('[vp] listener threw', type, err); } }
  };

  const hasVoices = engine === 'real' || engine === 'android-drop';
  const VOICES = hasVoices ? [{ name: 'Google UK English Female', lang: 'en-GB', default: true, localService: true, voiceURI: 'Google UK English Female' }] : [];
  let voicesAvailable = false;
  const listeners = {};
  let queue = [], current = null, startTimer = null, endTimer = null, paused = false, lastCancelAt = -Infinity;
  const START_DELAY = engine === 'android-drop' ? 250 : 80;
  const durationMs = (u) => {
    const text = String(u.text);
    if (!text.trim()) return 30;
    const words = text.trim().split(/\s+/).length;
    const rate = Math.min(10, Math.max(0.1, Number(u.rate) || 1));
    return Math.max(300, words * 350, text.length * 70) / rate;
  };
  const startNext = () => {
    if (current || !queue.length) return;
    const u = (current = queue.shift());
    const e = u.__entry;
    e.outcome = 'current';
    startTimer = setTimeout(() => {
      if (current !== u) return;
      startTimer = null;
      e.startedAt = now(); e.outcome = 'started';
      fire(u, 'start');
      const ms = durationMs(u);
      endTimer = setTimeout(() => {
        if (current !== u) return;
        current = null; endTimer = null;
        e.endedAt = now(); e.outcome = 'ended';
        fire(u, 'end', { elapsedTime: ms / 1000 });
        startNext();
      }, ms);
    }, START_DELAY);
  };
  const synth = {
    speak(u) {
      const t = now();
      const since = Number.isFinite(lastCancelAt) ? Math.round((t - lastCancelAt) * 10) / 10 : null;
      const entry = {
        i: speaks.length, t, text: String(u.text), volume: u.volume, rate: u.rate, pitch: u.pitch,
        voice: u.voice ? u.voice.name : null, lang: u.lang || '', sinceCancelMs: since,
        wasSpeaking: !!current, pendingBefore: queue.length, outcome: 'queued',
      };
      u.__entry = entry; speaks.push(entry);
      if (!(u instanceof Utter)) { entry.note = 'not a SpeechSynthesisUtterance'; }
      if (engine === 'dead') { entry.outcome = 'dropped'; entry.why = 'dead engine: no events ever'; return; }
      if (engine === 'android-drop' && since !== null && since < 150) { entry.outcome = 'dropped'; entry.why = `speak() ${since} ms after cancel()`; return; }
      queue.push(u); startNext();
    },
    cancel() {
      const t = now();
      cancels.push({ t, wasSpeaking: !!current, pendingCount: queue.length });
      lastCancelAt = t;
      const q = queue; queue = [];
      const u = current;
      if (u) {
        current = null; clearTimeout(startTimer); clearTimeout(endTimer); startTimer = null; endTimer = null;
        u.__entry.outcome = 'errored'; u.__entry.error = 'canceled'; u.__entry.cancelledAt = t;
        if (u.__entry.startedAt != null) u.__entry.heardMs = Math.round(t - u.__entry.startedAt);
        fire(u, 'error', { error: 'canceled' });
      }
      for (const x of q) { x.__entry.outcome = 'errored'; x.__entry.error = 'canceled'; x.__entry.cancelledAt = t; fire(x, 'error', { error: 'canceled' }); }
    },
    pause() { vp.pauses += 1; paused = true; },
    resume() { vp.resumes += 1; paused = false; },
    getVoices() { vp.voicesCalls += 1; return voicesAvailable ? VOICES.slice() : []; },
    get speaking() { return !!current; },
    get pending() { return queue.length > 0; },
    get paused() { return paused; },
    onvoiceschanged: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    dispatchEvent() { return true; },
  };
  if (hasVoices) {
    setTimeout(() => {
      voicesAvailable = true; vp.voiceschangedFired = true; vp.voiceschangedAt = now();
      const ev = { type: 'voiceschanged', target: synth };
      try { if (typeof synth.onvoiceschanged === 'function') synth.onvoiceschanged(ev); } catch (err) { console.error(err); }
      for (const f of listeners.voiceschanged || []) { try { f(ev); } catch (err) { console.error(err); } }
    }, 50);
  }
  Object.defineProperty(vp, 'outcomes', { get: () => speaks.map((s) => ({ i: s.i, text: s.text, outcome: s.outcome, error: s.error || null, why: s.why || null })) });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utter, configurable: true, writable: true });
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true });
}

// The storage seed (smoke-web.mjs seedStorage), plus per-screen extras applied
// on every document start (the warm-up preference, the AT YOUR PACE choice, the
// owner preview flag). A `?__reset` on the URL wipes storage first.
function seedStorage({ extras }) {
  if (location.search.includes('__reset')) {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    history.replaceState(null, '', location.pathname);
  }
  try {
    const seed = sessionStorage.getItem('__smoke_seed');
    if (seed) { sessionStorage.removeItem('__smoke_seed'); localStorage.setItem('trainingModePausedSession', seed); }
  } catch {}
  try { for (const [k, v] of Object.entries(extras || {})) localStorage.setItem(k, v); } catch {}
  if (localStorage.getItem('__smoke')) return;
  localStorage.setItem('trainingModeOnboardingComplete', 'true');
  localStorage.setItem('trainingModeTourComplete', 'true');
  localStorage.setItem('tm_user_profile', JSON.stringify({ name: 'SMOKE', sex: 'male', age: '', heightVal: '', heightUnit: 'FT/IN', weightVal: '', weightUnit: 'LBS', experience: 'Some Training', goal: 'Train Like a Fighter', specialty: '', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names', discipline: 'Boxing' }));
  localStorage.setItem('tm_arcade_intro_seen', '{}');
  localStorage.setItem('tm_camp_parq', JSON.stringify({ done: true, anyYes: false, ts: Date.now() }));
  localStorage.setItem('tm_practice_invite_v1', JSON.stringify({ introShownAt: new Date().toISOString() }));
  localStorage.setItem('__smoke', '1');
}

// ── Screens ─────────────────────────────────────────────────────────────────
// Each screen: extras (localStorage seeded at document start), expected (regexes
// over the NORMALISED lowercase text the app hands to speak()), and drive(api),
// which taps its way to the start and then calls api.record(ms) one or more
// times (mid-window taps such as SKIP or RESUME sit between the record calls).
const COUNT_IN = [/^3$/, /^2$/, /^1$/, /^round 1\b/i, /^go!?$/i];
const SCREENS = {
  fight_focus: {
    expected: COUNT_IN,
    async drive(a) { await a.fight(); await a.tile('FIGHT FOCUS'); await a.tap(a.btn(/START SESSION/), 'START SESSION'); await a.record(a.seconds); },
  },
  fight_focus_warmup: {
    extras: { tm_warmup_fightFocus: '1' }, // shared/WarmupRow.jsx:10 — loadWarmup('fightFocus') reads tm_warmup_fightFocus (minutes)
    expected: [/^warm up\b/, ...COUNT_IN],
    async drive(a) {
      await a.fight(); await a.tile('FIGHT FOCUS');
      await a.tap(a.btn(/START SESSION/), 'START SESSION');
      await a.record(4000);
      await a.tap(a.btn(/^SKIP/), 'SKIP (warm-up)');
      await a.record(a.seconds - 4000);
    },
  },
  fight_focus_resume: {
    expected: [],
    async drive(a) {
      await a.fight(); await a.tile('FIGHT FOCUS');
      await a.tap(a.btn(/START SESSION/), 'START SESSION');
      await a.record(8000);
      await a.reload();
      await a.wait(2500);
      // App.jsx:548-556 — a 'lifecycle' stash boots straight back INTO the player,
      // paused; its PAUSE/RESUME button (FightFocusTimer.jsx:1062) reads RESUME.
      // Without one (the stash was not written), the Home card offers RESUME.
      if (!(await a.has(/RESUME/))) { await a.page.mouse.click(206, 120); await a.log('tap splash'); await a.wait(1800); }
      // The player's button is a TrainingCTA whose accessible name is "▶ RESUME".
      await a.tapAny([/^▶?\s*RESUME$/, /RESUME/, /CONTINUE/], 'RESUME after reload', 10000);
      await a.wait(1200);
      if (await a.btn(/^▶?\s*RESUME$/).count()) await a.tap(a.btn(/^▶?\s*RESUME$/), 'RESUME (player, second tap)').catch(() => {});
      await a.record(Math.max(6000, a.seconds - 8000));
    },
  },
  just_train: {
    // JustTrainSetup.jsx:101 — voiceOn = cfg.rush.on, so the coach only speaks with RUSH MODE on.
    expected: COUNT_IN,
    async drive(a) {
      await a.fight(); await a.tile('JUST TRAIN');
      await a.tap(a.page.locator('[data-guide="jt-rush"]'), 'RUSH MODE row');
      await a.wait(500);
      await a.tap(a.btn(/ACTIVATE/), 'ACTIVATE (rush)');
      await a.wait(400);
      await a.tap(a.btn(/START TIMER|^START/), 'START TIMER');
      await a.record(a.seconds);
    },
  },
  combo_coach: {
    expected: COUNT_IN,
    async drive(a) { await a.fight(); await a.tile('COMBO COACH'); await a.tap(a.btn(/START COMBOS/), 'START COMBOS'); await a.record(a.seconds); },
  },
  combat_cond: {
    expected: [/^combat conditioning started/],
    async drive(a) {
      await a.fight(); await a.tap(a.page.locator('.ft.cond'), 'COMBAT CONDITIONING tile'); await a.wait(1500);
      await a.tap(a.page.locator('text=GAS TANK').first(), 'GAS TANK'); await a.wait(600);
      await a.tap(a.btn(/START CIRCUIT/), 'START CIRCUIT');
      await a.record(a.seconds);
    },
  },
  practice_round: {
    // PracticeMode.jsx:429 opens the current basic lesson; :192 READ ALOUD; :258 START PRACTICE ROUND; PracticeRound.jsx:228 START ROUND 1.
    expected: [/^1\. /],
    async drive(a) {
      await a.fight(); await a.tap(a.page.locator('.ft.prac'), 'PRACTICE tile'); await a.wait(1500);
      await a.tap(a.page.locator('[data-guide="pm-continue"]'), 'CONTINUE LEARNING (lesson card)'); await a.wait(700);
      await a.tap(a.page.getByRole('button', { name: /Play the step-by-step guide/ }), 'READ ALOUD');
      await a.record(Math.min(9000, Math.floor(a.seconds / 2)));
      await a.tap(a.page.locator('[data-guide="pm-start-round"]'), 'START PRACTICE ROUND'); await a.wait(700);
      await a.tap(a.page.locator('[data-guide="pr-start"]'), 'START ROUND 1');
      await a.record(a.seconds - Math.min(9000, Math.floor(a.seconds / 2)));
    },
  },
  quick_mission_guided: {
    extras: { tm_qm_shelf_v1: JSON.stringify({ mode: 'guided' }) },
    expected: [/^quick mission started/],
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-quick"]'), 'Quick Mission'); await a.wait(1200);
      await a.tap(a.page.getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'GUIDED', exact: true }), 'GUIDED').catch(() => {});
      await a.wait(300);
      await a.tap(a.btn(/^START$/), 'START');
      await a.record(a.seconds);
    },
  },
  quick_mission_ayp: {
    extras: { tm_qm_shelf_v1: JSON.stringify({ mode: 'solo' }) },
    expected: [], // AT YOUR PACE: "The moves and a timer. Beeps, no coach voice." (QuickMissionSolo.jsx never imports voiceCoach)
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-quick"]'), 'Quick Mission'); await a.wait(1200);
      await a.tap(a.page.getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }), 'AT YOUR PACE').catch(() => {});
      await a.wait(300);
      await a.tap(a.btn(/^START$/), 'START');
      await a.record(a.seconds);
    },
  },
  quick_mission_maxout: {
    extras: { tm_owner_preview: '1', tm_qm_shelf_v1: JSON.stringify({ mode: 'guided' }) },
    expected: [/^quick mission started/],
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-quick"]'), 'Quick Mission'); await a.wait(1200);
      await a.tap(a.page.locator('[data-guide="qm-library"]'), 'MISSION LIBRARY'); await a.wait(700);
      const sheet = a.page.getByRole('dialog', { name: 'Mission library' });
      await a.tap(sheet.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: /^MAX OUT/ }), 'MAX OUT chip'); await a.wait(400);
      await a.tap(sheet.getByRole('radio', { name: /^BOSS RUSH/ }), 'BOSS RUSH row'); await a.wait(300);
      await a.tap(sheet.getByRole('button', { name: 'PUT ON CARD' }), 'PUT ON CARD'); await a.wait(600);
      await a.tap(a.btn(/^START$/), 'START');
      await a.record(a.seconds);
    },
  },
  build_workout: {
    expected: [/^warm up\b/, /^3$/, /^2$/, /^1$/],
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-builder"]'), 'Build Workout'); await a.wait(1200);
      await a.tap(a.btn(/GENERATE WORKOUT/), 'GENERATE WORKOUT'); await a.wait(2000);
      await a.tap(a.btn(/^START/), 'START');
      await a.page.getByText('WARM UP · WORKOUT').first().waitFor({ timeout: 8000 }).catch(() => a.log('warm-up screen did not appear'));
      await a.record(4000);
      await a.tap(a.btn(/^SKIP/), 'SKIP → START WORKOUT').catch(() => {});
      await a.wait(1500);
      // The guided player opens on its map; its START (tap-to-start) closes it into the 3-2-1.
      await a.tap(a.btn(/^START/), 'START (guided map)').catch(() => a.log('no START on the guided map'));
      await a.record(a.seconds - 5500);
    },
  },
  cardio_run: {
    expected: [/^cardio mode\.?$/, /^ready\.?$/],
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-cardio"]'), 'Cardio'); await a.wait(1800);
      await a.tap(a.page.getByRole('radiogroup', { name: 'Activity' }).getByRole('radio', { name: /^RUN/ }), 'RUN').catch(() => {});
      await a.wait(400);
      await a.tap(a.btn(/START RUN|^START/), 'START RUN');
      await a.record(a.seconds);
    },
  },
  cardio_machine: {
    expected: [/^cardio mode\.?$/],
    async drive(a) {
      await a.fit(); await a.tap(a.page.locator('[data-guide="fit-cardio"]'), 'Cardio'); await a.wait(1800);
      await a.tap(a.page.getByRole('radiogroup', { name: 'Activity' }).getByRole('radio', { name: /^MACHINE/ }), 'MACHINE'); await a.wait(800);
      const dlg = a.page.getByRole('dialog', { name: 'Choose a machine' });
      await a.tap(dlg.locator('button', { hasText: /BIKE|TREADMILL|ROW/ }).first(), 'a machine'); await a.wait(500);
      await a.tap(dlg.locator('button', { hasText: 'INTERVAL TRAINING' }).first(), 'INTERVAL TRAINING'); await a.wait(500);
      // SURPRISE ME applies a programme and closes the modal by itself; a picked row needs USE THIS.
      await a.tap(dlg.locator('button', { hasText: /SURPRISE ME|MIN/ }).first(), 'a programme').catch(() => a.log('no programme button'));
      await a.wait(300);
      await a.tap(dlg.getByRole('button', { name: /USE THIS/ }), 'USE THIS').catch(() => a.log('modal already closed (no USE THIS)'));
      await a.wait(700);
      await a.tap(a.btn(/START MACHINE|^START/), 'START MACHINE');
      await a.record(a.seconds);
    },
  },
  arcade_stage: {
    expected: [/.+/],
    async drive(a) {
      await a.home(); await a.tap(a.page.locator('[data-guide="home-arcade"]').first(), 'ARCADE'); await a.wait(3000);
      let hit = false;
      for (let i = 0; i < 8 && !hit; i++) {
        hit = await a.page.evaluate(() => { const b = [...document.querySelectorAll('button,[role="button"]')].find((x) => /\bSTART\b[\s\S]*CLEARED/.test(x.innerText)); if (b) b.click(); return !!b; });
        if (!hit) { await a.page.locator('button[aria-label="Next saga"]').click({ force: true, timeout: 3000 }); await a.wait(900); }
      }
      if (!hit) throw new Error('no START badge on the saga carousel');
      await a.log('saga START badge'); await a.wait(2500);
      await a.page.locator('button').filter({ hasText: /GOT IT|LET'S GO|CLOSE/ }).first().click({ force: true, timeout: 1500 }).catch(() => {});
      await a.wait(500);
      await a.tap(a.page.locator('.ladder-node').last(), 'stage node (last = first stage)'); await a.wait(800);
      await a.page.locator('button').filter({ hasText: /^BOTH$|^FIGHT$/ }).last().click({ force: true, timeout: 1500 }).catch(() => {});
      await a.tap(a.btn(/ENTER STAGE/), 'ENTER STAGE'); await a.wait(1500);
      await a.tap(a.btn(/^START|^BEGIN|^ENTER|^GO$/), 'START (stage setup)').catch(() => a.log('no second START after ENTER STAGE'));
      // The stage announces itself; the Hero Entry Test (stage 1) then waits for
      // COUNT FOR ME (the coach counts every rep) or ON MY OWN — take the voice.
      await a.record(6000);
      await a.tapAny([/COUNT FOR ME/, /^START|^BEGIN|^GO$/], 'COUNT FOR ME / START', 4000).catch(() => a.log('no choice button after the announcement'));
      await a.record(a.seconds - 6000);
    },
  },
  camp_session: {
    expected: COUNT_IN,
    async drive(a) {
      await a.fight(); await a.tile('TRAINING CAMP'); await a.wait(1000);
      await a.tap(a.page.locator('[data-guide="tc-current"]'), 'current level'); await a.wait(700);
      await a.tap(a.btn(/▶ START/), '▶ START SESSION'); await a.wait(700);
      // ReadinessSheet: answer NO to the red-flag question, then CHECK IN & START.
      await a.tap(a.page.locator('button', { hasText: /^NO$/ }).first(), 'NO (readiness red flags)').catch(() => a.log('no readiness sheet'));
      await a.wait(200);
      await a.tap(a.btn(/CHECK IN/), 'CHECK IN & START').catch(() => {});
      await a.wait(700);
      await a.tap(a.btn(/START ANYWAY|START EASY/), 'START ANYWAY').catch(() => {});
      await a.tap(a.btn(/CONTINUE/), '▶ CONTINUE (gear)').catch(() => a.log('no gear sheet'));
      await a.wait(1500);
      if (await a.has(/^SKIP/m) || (await a.btn(/^SKIP/).count())) { await a.record(4000); await a.tap(a.btn(/^SKIP/), 'SKIP (warm-up)').catch(() => {}); await a.record(a.seconds - 4000); }
      else await a.record(a.seconds);
    },
  },
};
const SCREEN_NAMES = Object.keys(SCREENS);
const names = SCREEN === 'all' ? SCREEN_NAMES : SCREEN.split(',').map((s) => s.trim()).filter(Boolean);

// ── Driving one screen ──────────────────────────────────────────────────────
async function runScreen(name) {
  const spec = SCREENS[name];
  const res = { screen: name, engine: ENGINE, seconds: SECONDS, expected: spec.expected.map((r) => r.source), extras: spec.extras || {}, taps: [], snapshots: [], pageErrors: [], consoleErrors: [], docs: [], notes: [] };
  const ctx = await browser.newContext({ viewport: { width: 412, height: 811 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: 40, longitude: -74, accuracy: 8 } });
  await ctx.addInitScript(recorderInit, { engine: ENGINE });
  await ctx.addInitScript(seedStorage, { extras: spec.extras || {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => res.pageErrors.push({ t: Date.now() - t0, message: String(e.message).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') res.consoleErrors.push({ t: Date.now() - t0, text: m.text().slice(0, 300) }); });
  const t0 = Date.now();
  let recordStart = null; // wall-clock ms when the first record() began
  const S = (ms) => page.waitForTimeout(ms);
  const text = () => page.evaluate(() => document.body.innerText).catch(() => '');
  const btn = (re) => page.getByRole('button', { name: re }).first();
  // Each tap is stamped with wall-clock ms since the screen began, ms since the
  // recording began, and the page's own clock (pt, the clock the speak log uses).
  const log = async (what) => { const pt = await page.evaluate(() => Math.round(performance.now())).catch(() => null); res.taps.push({ t: Date.now() - t0, rec: recordStart ? Date.now() - recordStart : null, pt, what }); };
  const pullVp = async () => page.evaluate(() => {
    const v = window.__vp; if (!v) return null;
    return { engine: v.engine, speaks: v.speaks, cancels: v.cancels, events: v.events, resumes: v.resumes, pauses: v.pauses, voicesCalls: v.voicesCalls, voiceschangedFired: v.voiceschangedFired, voiceschangedAt: v.voiceschangedAt, speaking: v.speaking, pending: v.pending };
  }).catch(() => null);
  const stashDoc = async (why) => { const v = await pullVp(); res.docs.push({ why, pulledAt: Date.now() - t0, vp: v }); };
  const api = {
    page, seconds: SECONDS * 1000, btn, log, wait: S,
    has: async (re) => re.test(await text()),
    async tap(loc, label) {
      await loc.click({ timeout: 4000 });
      await log(label);
    },
    // Poll for the first button whose name matches one of `res` (in order of
    // preference), up to `ms`; logs the button's text and the screen's first line.
    async tapAny(res, label, ms = 6000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        for (const re of res) {
          const b = btn(re);
          if (await b.count()) {
            const name = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
            const first = (await text()).split('\n').find((l) => l.trim()) || '';
            await b.click({ timeout: 4000 });
            await log(`${label}: tapped "${name}" (screen: ${first.slice(0, 40)})`);
            return name;
          }
        }
        await S(400);
      }
      throw new Error(`${label}: no button matched ${res.map((r) => r.source).join(' | ')} within ${ms} ms`);
    },
    async boot() {
      await page.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await S(2000);
      await page.mouse.click(206, 120); await S(1800);
      await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
      await S(400);
      await log("boot (home)");
    },
    async home() { await api.boot(); },
    async fit() { await api.boot(); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200); await log("FIT MODE"); },
    async fight() { await api.boot(); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200); await log("FIGHT MODE"); },
    async tile(label) { await page.locator('.fb', { hasText: label }).first().click({ timeout: 5000 }); await S(1200); await log(`${label} tile`); },
    async reload() {
      await stashDoc('before reload');
      await page.reload({ waitUntil: 'networkidle' });
      await log("reload");
    },
    // Record for ms: a 1 Hz snapshot of the screen text (first 400 chars) plus a
    // hash of the whole text, with the recorder's state pulled at the end.
    async record(ms) {
      if (!recordStart) recordStart = Date.now();
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const snap = await page.evaluate(() => {
          const t = document.body.innerText || '';
          let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
          return { pt: Math.round(performance.now()), text: t.slice(0, 400), h, len: t.length, speaking: !!(window.__vp && window.__vp.speaking) };
        }).catch(() => null);
        if (snap) res.snapshots.push({ t: Date.now() - recordStart, ...snap });
        await S(Math.max(0, Math.min(1000, end - Date.now())));
      }
    },
  };
  try {
    await spec.drive(api);
  } catch (e) {
    res.unreached = String(e.message).split('\n')[0].slice(0, 240);
    res.notes.push(`drive failed: ${res.unreached}`);
  }
  await stashDoc('end');
  if (SHOT) { const p = names.length > 1 ? SHOT.replace(/(\.png)?$/, `-${name}$1`) : SHOT; await page.screenshot({ path: p }).catch(() => {}); res.shot = p; }
  res.recordedMs = recordStart ? Date.now() - recordStart : 0;
  await ctx.close().catch(() => {});
  analyse(res);
  return res;
}

// ── Analysis ────────────────────────────────────────────────────────────────
function analyse(res) {
  // Flatten the documents (a reload starts a fresh recorder).
  const speaks = [], cancels = [];
  let resumes = 0, pauses = 0, voicesCalls = 0, voiceschanged = false;
  res.docs.forEach((d, di) => {
    const v = d.vp; if (!v) return;
    for (const s of v.speaks) speaks.push({ doc: di, ...s });
    for (const c of v.cancels) cancels.push({ doc: di, ...c });
    resumes += v.resumes; pauses += v.pauses; voicesCalls += v.voicesCalls; voiceschanged = voiceschanged || v.voiceschangedFired;
  });
  res.speaks = speaks; res.cancels = cancels; res.resumes = resumes; res.pauses = pauses; res.voicesCalls = voicesCalls; res.voiceschangedFired = voiceschanged;
  const lines = speaks.filter((s) => s.text.trim() !== '');
  const primers = speaks.filter((s) => s.text.trim() === '');
  const heard = (s) => s.outcome === 'ended' || s.outcome === 'started' || (s.outcome === 'errored' && s.heardMs > 0);
  const expected = res.expected.map((src) => new RegExp(src, 'i'));
  const attempted = expected.map((re) => lines.some((s) => re.test(s.text)));
  const heardOk = expected.map((re) => lines.some((s) => re.test(s.text) && heard(s)));
  const missingAttempt = res.expected.filter((_, i) => !attempted[i]);
  const missingHeard = res.expected.filter((_, i) => attempted[i] && !heardOk[i]);
  const fast = speaks.filter((s) => s.sinceCancelMs !== null && s.sinceCancelMs < 150);
  const dropped = speaks.filter((s) => s.outcome === 'dropped');
  const badVolume = lines.filter((s) => !(s.volume > 0)).length;
  const outOfRange = speaks.filter((s) => s.rate < 0.1 || s.rate > 10 || s.pitch < 0 || s.pitch > 2 || s.volume < 0 || s.volume > 1).length;
  // Stall: the same screen text for the last 6 snapshots, or a countdown digit held 6 s+.
  const snaps = res.snapshots;
  let stalled = false, stallWhy = null;
  if (snaps.length >= 6) {
    const last = snaps.slice(-6);
    if (last.every((s) => s.h === last[0].h)) { stalled = true; stallWhy = `screen text unchanged for the last ${last.length} s`; }
    // The count-in overlay renders first, so its digit is the FIRST line of the
    // body text ("3\nFIGHT FOCUS\n…"); the round squares ("1\n2\n3") sit lower.
    const digit = (s) => { const first = s.text.split('\n').map((l) => l.trim()).find((l) => l); return first && /^[123]$/.test(first) ? first : null; };
    const d0 = digit(last[0]);
    if (!stalled && d0 && last.every((s) => digit(s) === d0) && last[last.length - 1].t >= 12000) { stalled = true; stallWhy = `countdown digit "${d0}" still on screen after ${Math.round(last[last.length - 1].t / 1000)} s`; }
  }
  const lastText = snaps.length ? snaps[snaps.length - 1].text : '';
  const crash = /Training Mode runtime error/.test(lastText);
  const m = {
    linesSpoken: lines.length, primerCalls: primers.length, cancels: cancels.length, cancelThenSpeakUnder150ms: fast.length,
    dropped: dropped.length, heardLines: lines.filter(heard).length, zeroVolumeLines: badVolume, outOfRangeParams: outOfRange,
    expectedMissing: [...missingAttempt, ...missingHeard], expectedNotAttempted: missingAttempt, expectedNotHeard: missingHeard,
    stalled, stallWhy, pageErrors: res.pageErrors.length, crashScreen: crash,
    firstLines: lines.slice(0, 8).map((s) => `t=${(s.t / 1000).toFixed(1)}s ${JSON.stringify(s.text)} [${s.outcome}${s.error ? ':' + s.error : ''}${s.why ? ' ' + s.why : ''}]`),
  };
  res.metrics = m;
  let verdict;
  if (res.unreached) verdict = 'UNREACHED';
  else if (crash) verdict = 'CRASH_SCREEN';
  else if (stalled) verdict = 'STALLED';
  else if (missingAttempt.length) verdict = 'NOT_ATTEMPTED';
  else if (missingHeard.length) verdict = 'DROPPED';
  else if (res.pageErrors.length) verdict = 'OK_WITH_PAGE_ERRORS';
  else verdict = 'OK';
  res.verdict = verdict;
  res.lastScreenText = lastText;
}

function printTable(rows) {
  const cols = ['screen', 'engine', 'lines', 'cancels', 'c→s<150', 'exp.missing', 'stalled', 'pageErr', 'verdict'];
  const data = rows.map((r) => {
    const m = r.metrics || {};
    return [r.screen, r.engine, String(m.linesSpoken ?? '-'), String(m.cancels ?? '-'), String(m.cancelThenSpeakUnder150ms ?? '-'), (m.expectedMissing || []).join(' | ') || (r.unreached ? `(unreached: ${r.unreached})` : '-'), m.stalled ? `yes (${m.stallWhy})` : 'no', String(m.pageErrors ?? '-'), r.verdict || '-'];
  });
  const widths = cols.map((c, i) => Math.min(60, Math.max(c.length, ...data.map((d) => String(d[i]).length))));
  const fmt = (row) => row.map((c, i) => String(c).slice(0, widths[i]).padEnd(widths[i])).join('  ');
  console.log(fmt(cols)); console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const d of data) console.log(fmt(d));
}

// ── Main ────────────────────────────────────────────────────────────────────
for (const name of names) {
  if (!SCREENS[name]) { results.push({ screen: name, engine: ENGINE, verdict: 'UNREACHED', unreached: `unknown screen (one of: ${SCREEN_NAMES.join(', ')}, all)` }); continue; }
  try { results.push(await runScreen(name)); } catch (e) { results.push({ screen: name, engine: ENGINE, verdict: 'UNREACHED', unreached: String(e.message).split('\n')[0].slice(0, 240) }); }
  writeJson(true);
}
await finish(browser, server);
