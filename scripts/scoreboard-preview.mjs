// The world score board in the real app (switch `scores`, the owner preview
// on), photographed at three phone sizes. Every network call to the board's
// server is answered here by Playwright (route()), with replies shaped like
// the migration's functions: nothing reaches the live database.
//
//   node --import ./scripts/extensionless-loader-register.mjs scripts/scoreboard-preview.mjs <out-dir> [--base http://localhost:8086] [--only <regex>]
//
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8086 --clear
// (restart it with --clear after an edit). Chrome: CHROME_PATH, or
// Playwright's "chrome" channel, or /usr/bin/google-chrome.
//
// Each end-screen state plays a real Fight Focus session (Home's CONTINUE: 3 ×
// 3 min, 60 s rest, Normal, Boxing, the board setting) on Playwright's clock,
// with the phone's motion played in (a punch every 0.6 s of work), signed in
// with a stand-in session. Then, at 360 × 780, 390 × 844 and 430 × 932: the
// page never scrolls sideways, nothing passes the viewport's sides, no text
// in the state's own elements is cut, and the state's words are on screen. A
// state that opens a full-screen board is photographed once more as tall as
// that board (<state>-<width>-full.png).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { composeBoard, HOUSE_NAMES, HOUSE_LEVELS } = await import(path.join(root, 'components/training-mode/retention/scoreBoards.js'));
const { boardRules } = await import(path.join(root, 'components/training-mode/data/scoreBoardRules.js'));

const args = process.argv.slice(2);
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8086').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: scripts/scoreboard-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[360, 780], [390, 844], [430, 932]];

// ── the athlete ──────────────────────────────────────────────────────────────
const NOW = new Date(2026, 10, 19, 10, 0, 0, 0); // a Thursday morning, local time
const NOW_MS = NOW.getTime();
const DAY = 86400000;
const row = (i, xp = 120) => ({ id: `p${i}`, type: 'Fight Focus', completedAt: new Date(NOW_MS - i * DAY - 3 * 3600000).toISOString(), completedCount: 3, totalCount: 3, xpEarned: xp });
const ROWS = Array.from({ length: 14 }, (_, i) => row(i + 1));
const FIGHTER = { name: 'Rafa K', sex: 'male', experience: 'Some Training', goal: 'Train Like a Fighter', discipline: 'Boxing', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names' };
const BOARD = 'ff:boxing:3x3r60:normal';
const FF_LAST = { kind: 'timer', cfg: { difficulty: 'Normal', mode: 'Technical', rounds: 3, roundMin: 3, restSec: 60, voiceOn: false, rushMode: false, encouragement: 'off', warmupMin: 0 }, disc: 'Boxing', at: NOW_MS - DAY };
const SESSION = {
  access_token: 'preview-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(NOW_MS / 1000) + 30 * 86400, refresh_token: 'preview-refresh',
  user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'athlete@example.com', user_metadata: { full_name: 'Sample Athlete' } },
};
// The phone's board state carries the account it belongs to (another one's is not shown).
const seed = ({ preview = true, signedIn = true, joined = false, optIn = null, uid = SESSION.user.id } = {}) => ({
  trainingModeOnboardingComplete: 'true',
  trainingModeTourComplete: 'true',
  ...(preview ? { tm_owner_preview: '1' } : {}),
  tm_arcade_intro_seen: '{}',
  tm_practice_invite_v1: JSON.stringify({ introShownAt: NOW.toISOString() }),
  tm_user_profile: JSON.stringify(FIGHTER),
  // Level 14 with 490 XP to go, so the session's XP opens no level-up screen first.
  tm_user_stats: JSON.stringify({ xp: 6510, sessions: ROWS }),
  tm_last_session_v1: JSON.stringify(FF_LAST),
  tm_motion_granted: 'true',
  ...(signedIn ? { 'sb-adtxjmqshckhmyziehpv-auth-token': JSON.stringify(SESSION) } : {}),
  ...(joined ? { tm_score_board_v1: JSON.stringify({ uid, optIn: 'joined', name: 'Rafa_K', country: 'US' }) } : optIn ? { tm_score_board_v1: JSON.stringify({ uid, optIn }) } : {}),
});

// ── the server's answers ─────────────────────────────────────────────────────
// A board as get_board lays it out (the migration's merge is the app's
// composeBoard, proven by scripts/test-scoreboard-sql.mjs).
const RULES = boardRules(BOARD);
const HOUSE = RULES.house.map((value, i) => ({ name: HOUSE_NAMES.fight[i], level: HOUSE_LEVELS[i], value }));
function boardReply(real, players) {
  const rows = composeBoard({ real: real.map((r, i) => ({ ...r, at: r.at ?? i })), house: HOUSE, players });
  return { board: BOARD, direction: 'more', unit: 'strikes', players, rows: rows.map((r) => ({ place: r.place, rank: r.cpu ? null : r.rank, name: r.name, country: r.cc || null, level: r.level, value: r.value, cpu: !!r.cpu, you: !!r.you })) };
}
// get_my_place for the same board: my place among every row (not only the ten).
const mineOf = (reply, real) => {
  const allRows = composeBoard({ real: real.map((r, i) => ({ ...r, at: r.at ?? i })), house: HOUSE, players: real.length, size: 100 });
  const me = allRows.find((r) => r.you);
  if (!me) return null;
  const above = allRows.filter((r) => r.place < me.place);
  return { value: me.value, level: me.level, rank: me.rank, place: me.place, players: real.length, next_value: above.length ? above.at(-1).value : null };
};
const OTHERS = (v) => [
  { name: 'Kenji.T', level: 31, value: v + 139, cc: 'JP' },
  { name: 'Noor', level: 26, value: v + 56 },
  { name: 'Dre', level: 7, value: Math.max(10, v - 172), cc: 'US' },
];
// Each state: what the server answers to each function.
const SERVER = {
  // Never asked: the first eligible finish (signed in, a ticket, no player row).
  first: (v) => ({ profile: null, submit: { status: 'new_best', first: true, was: null }, real: [...OTHERS(v), { name: 'Rafa_K', you: true, level: 14, value: v, at: 9 }] }),
  // A new best that moves up two places.
  newBest: (v) => ({ profile: true, submit: { status: 'new_best', first: false, was: v - 68, placeBefore: 8 }, real: [...OTHERS(v), { name: 'Rafa_K', you: true, level: 14, value: v, at: 9 }] }),
  // Not a best: the board keeps the best (40 more than today).
  notBest: (v) => ({ profile: true, submit: { status: 'not_best', best: v + 40 }, real: [...OTHERS(v + 40), { name: 'Rafa_K', you: true, level: 14, value: v + 40, at: 9 }] }),
};
function busyReply(v) {
  const real = Array.from({ length: 10 }, (_, i) => ({ name: ['Kenji.T', 'Noor', 'Ola', 'Sam W', 'Tess', 'Big Lu', 'Iker', 'Mina', 'Dre', 'Ada'][i], level: [31, 26, 24, 19, 21, 16, 12, 17, 9, 22][i], value: 1460 - i * 52, cc: ['JP', null, 'NG', 'GB', null, 'PH', 'MX', null, 'US', null][i] }));
  return { reply: boardReply(real, 2310), mine: { value: v + 22, level: 14, rank: 143, place: 143, players: 2310, next_value: v + 25 } };
}

function stub(state) {
  const calls = [];
  const posted = { value: null };
  const handler = async (route) => {
    const req = route.request();
    const url = req.url();
    if (!/supabase\.co/.test(url)) return route.continue();
    if (/\/rest\/v1\/rpc\//.test(url)) {
      const name = url.split('/rpc/')[1].split('?')[0];
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { body = {}; }
      calls.push(name);
      if (state.offline && ['start_board_run', 'submit_score', 'get_board', 'get_my_place', 'get_board_profile'].includes(name)) return route.abort('internetdisconnected');
      const json = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      const v = posted.value ?? 812;
      const plan = state.server ? state.server(v) : null;
      if (name === 'start_board_run') return json('5b0c1f3e-2d4a-4c6b-9e8f-0a1b2c3d4e5f');
      if (name === 'get_board_profile') return json(plan?.profile ? { name: 'Rafa_K', country: 'US', level: 14, joined_at: NOW.toISOString(), rename_at: null } : state.joinedProfile ? { name: 'Rafa_K', country: 'US', level: 14, joined_at: NOW.toISOString(), rename_at: null } : null);
      if (name === 'join_boards') return json({ ok: true, name: body.p_name, country: body.p_country || null });
      if (name === 'set_board_profile') return json({ ok: true, name: body.p_name, country: body.p_country || null });
      if (name === 'submit_score' && state.submitStatus) return route.fulfill({ status: state.submitStatus, contentType: 'application/json', body: '{"message":"server error"}' });
      if (name === 'submit_score') {
        posted.value = body.p_value;
        console.log(`     the session posted ${body.p_value} strikes`);
        const p = state.server(body.p_value);
        if (state.busy) return json({ status: 'not_best', board: BOARD, value: body.p_value, best: body.p_value + 22, was: null, first: false, place: 143, rank: 143, players: 2310, place_before: 143 });
        const reply = boardReply(p.real, p.real.length);
        const mine = mineOf(reply, p.real);
        return json({ status: p.submit.status, board: BOARD, value: body.p_value, best: p.submit.best ?? body.p_value, was: p.submit.was ?? null, first: !!p.submit.first, place: mine.place, rank: mine.rank, players: p.real.length, place_before: p.submit.first ? null : (p.submit.placeBefore ?? mine.place) });
      }
      if (name === 'get_board') {
        if (state.busy) return json(busyReply(v).reply);
        const p = plan || SERVER.notBest(v);
        return json(boardReply(p.real, p.real.length));
      }
      if (name === 'get_my_place') {
        if (state.busy) return json(busyReply(v).mine);
        const p = plan || SERVER.notBest(v);
        return json(mineOf(boardReply(p.real, p.real.length), p.real));
      }
      return json(null); // ghost sharing's own calls: nothing in the pool
    }
    if (/\/auth\/v1\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/user/.test(url) ? SESSION.user : {}) });
    if (/\/rest\/v1\/progress_snapshots/.test(url)) return route.fulfill({ status: req.method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' });
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 404, body: '' });
  };
  return { calls, handler };
}

// ── the phone in a fist: a punch every 0.6 s while a round runs ─────────────
const MOTION = () => {
  let n = 0;
  setInterval(() => {
    n += 1;
    const hit = n % 2 === 0;
    const a = hit ? { x: 24, y: 6, z: 3 } : { x: 0.3, y: 0.2, z: 0.1 };
    try {
      const ev = new DeviceMotionEvent('devicemotion', { acceleration: a, accelerationIncludingGravity: { x: a.x, y: a.y + 9.8, z: a.z }, interval: 16 });
      // The counter reads the event's time: the page's clock (Playwright's), not the real one.
      Object.defineProperty(ev, 'timeStamp', { value: performance.now() });
      window.dispatchEvent(ev);
    } catch { /* no DeviceMotionEvent */ }
  }, 300);
};

// ── the flows ────────────────────────────────────────────────────────────────
const wait = (page, ms) => page.waitForTimeout(ms);
async function home(page, w) {
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
  await page.mouse.click(Math.round(w / 2), 120); await wait(page, 1800);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1200 }).catch(() => {});
  await wait(page, 900);
}
async function runClock(page, done, { stepMs = 2000, max = 600 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.clock.runFor(stepMs);
    const t = await page.evaluate(() => document.body.innerText);
    if (done(t)) return t;
    const cont = page.getByRole('button', { name: /^CONTINUE$/ });
    if (/LEVEL UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  throw new Error('the clock ran out before the end screen came');
}
// Home's CONTINUE runs the last session (the board setting); the clock plays
// it to the final bell; the end screen opens.
async function playSession(page, w) {
  await home(page, w);
  // Started in the page now, so its interval runs on the page's (Playwright's) clock.
  await page.evaluate(MOTION);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-guide="home-continue"] button.hm-go').first().click({ timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t));
  await page.clock.resume();
  await wait(page, 3500);
}
const scrollTo = (sel) => async (page) => {
  await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
  await wait(page, 500);
};

const STATES = [
  {
    name: 'optin', note: 'The first eligible finish, signed in, never asked: the opt-in over the end screen (JOIN posts this session; NOT NOW goes on).',
    seed: seed(), server: SERVER.first, open: playSession, check: ['[data-retention="board-optin"]'], overlay: true,
    expect: /◈ NEW ◈[\s\S]*HIGH SCORES[\s\S]*FIGHT FOCUS · BOXING[\s\S]*BETA[\s\S]*Put your best scores on the world board\?[\s\S]*Show my country \(US\)[\s\S]*NOT NOW[\s\S]*JOIN/,
  },
  {
    name: 'optin-joined', note: 'JOIN on the opt-in: the session goes up, the first score on the board, so the full GAME OVER board opens (CONTINUE to the end screen).',
    seed: seed(), server: SERVER.first, overlay: true,
    open: async (page, w) => { await playSession(page, w); await page.getByRole('button', { name: /^JOIN$/ }).first().click({ timeout: 4000 }); await wait(page, 2500); },
    check: ['[data-retention="game-over"]'], expect: /HIGH SCORES[\s\S]*YOUR SCORE[\s\S]*NEW\s*BEST[\s\S]*FIRST|HIGH SCORES[\s\S]*YOUR SCORE[\s\S]*NEW\s*BEST/,
  },
  {
    name: 'optin-join-retry', note: "JOIN on the opt-in, but the server errs on the post: the overlay closes on a line that says they are on the board and the score tries again (it waits on the phone).",
    seed: seed(), server: SERVER.first, submitStatus: 500,
    open: async (page, w) => { await playSession(page, w); await page.getByRole('button', { name: /^JOIN$/ }).first().click({ timeout: 4000 }); await wait(page, 2500); },
    after: scrollTo('[data-retention="board-line"]'),
    check: ['[data-retention="board-line"]'], expect: /You're on the world board\. This score tries again next time you open the app\./, absent: /◈ GAME OVER ◈|Put your best scores on the world board\?/,
  },
  {
    name: 'new-best', note: 'Joined; a new best that moves up two places: the full board opens straight away, NEW BEST, WAS, the place and the rank.',
    seed: seed({ joined: true }), server: SERVER.newBest, open: playSession, overlay: true,
    check: ['[data-retention="game-over"]'], expect: /◈ GAME OVER ◈[\s\S]*HIGH SCORES[\s\S]*BETA[\s\S]*YOUR SCORE[\s\S]*STRIKES ✓[\s\S]*PLACE · \d+(ST|ND|RD|TH) OF 4 PLAYERS[\s\S]*NEW\s*BEST[\s\S]*WAS[\s\S]*CONTINUE/,
  },
  {
    name: 'end-card', note: 'Joined; not a new best: the end screen with its HIGH SCORES card (top 3, your row, VIEW BOARD). No full board.',
    seed: seed({ joined: true }), server: SERVER.notBest, open: playSession, after: scrollTo('[data-retention="high-scores-card"]'),
    check: ['[data-retention="high-scores-card"]'], expect: /HIGH SCORES[\s\S]*3 × 3 MIN · 60 S REST · NORMAL[\s\S]*YOU[\s\S]*Today: \d+\. Your best \(\d+\) stays on the board\.[\s\S]*VIEW BOARD/, absent: /◈ GAME OVER ◈/,
  },
  {
    name: 'busy-card', note: 'A busy board (2,310 players), you outside the top 10: the card pins your row (#143 of 2,310) and what the next place needs.',
    seed: seed({ joined: true }), server: SERVER.notBest, busy: true, open: playSession, after: scrollTo('[data-retention="high-scores-card"]'),
    check: ['[data-retention="high-scores-card"]'], expect: /HIGH SCORES[\s\S]*#143[\s\S]*of 2,310 players[\s\S]*Next place: 4 more strikes[\s\S]*Today: \d+\. Your best \(\d+\) stays on the board\.[\s\S]*VIEW BOARD/,
  },
  {
    name: 'busy-board', note: 'The same, VIEW BOARD: the full board, ten real players, your row pinned under them, YOUR SCORE says how far short of your best.',
    seed: seed({ joined: true }), server: SERVER.notBest, busy: true, overlay: true,
    open: async (page, w) => { await playSession(page, w); await page.getByRole('button', { name: /^VIEW BOARD$/ }).first().click({ timeout: 4000 }); await wait(page, 1200); },
    check: ['[data-retention="game-over"]'], expect: /HIGH SCORES[\s\S]*22 STRIKES SHORT OF YOUR BEST[\s\S]*YOUR BEST[\s\S]*#143[\s\S]*of 2,310 players[\s\S]*CONTINUE/,
  },
  {
    name: 'offline', note: 'Started offline (the ticket could not be asked for): the end screen as ever, and one plain line where the card would be.',
    seed: seed({ joined: true }), server: SERVER.notBest, offline: true, open: playSession, after: scrollTo('[data-retention="board-line"]'),
    check: ['[data-retention="board-line"]'], expect: /Started offline, so it can't go on the board\./,
  },
  {
    name: 'profile-row', note: "Profile with the switch on: the SCORE BOARD row under the account card (the name it is on the board as).",
    seed: seed({ joined: true }), server: SERVER.notBest, joinedProfile: true,
    open: async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1800); },
    after: scrollTo('[data-retention="board-profile-row"]'),
    check: ['[data-retention="board-profile-row"]'], expect: /SCORE BOARD[\s\S]*On the world board as Rafa_K/,
  },
  {
    name: 'profile-row-other', note: "Profile after another account used the phone: that account's board name is not shown (the row reads as not on the board until this account joins or its page is opened).",
    seed: seed({ joined: true, uid: '00000000-0000-4000-8000-0000000000ff' }), server: SERVER.notBest,
    open: async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1800); },
    after: scrollTo('[data-retention="board-profile-row"]'),
    check: ['[data-retention="board-profile-row"]'], expect: /SCORE BOARD[\s\S]*Not on the world board/, absent: /On the world board as Rafa_K/,
  },
  {
    name: 'profile-page', note: "Profile's SCORE BOARD page: the display name (once a week), the country switch, LEAVE BOARDS.",
    seed: seed({ joined: true }), server: SERVER.notBest, joinedProfile: true,
    open: async (page, w) => {
      await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1500);
      await page.locator('[data-retention="board-profile-row"]').click({ timeout: 4000 }); await wait(page, 1800);
    },
    check: ['[data-retention="board-profile"]'], expect: /SCORE BOARD[\s\S]*BETA[\s\S]*WORLD BOARD[\s\S]*DISPLAY NAME[\s\S]*Show my country \(US\)[\s\S]*LEAVE BOARDS/,
  },
  {
    name: 'profile-leave', note: 'LEAVE BOARDS asks once: every score comes off every board, now. STAY or LEAVE.',
    seed: seed({ joined: true }), server: SERVER.notBest, joinedProfile: true,
    open: async (page, w) => {
      await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1500);
      await page.locator('[data-retention="board-profile-row"]').click({ timeout: 4000 }); await wait(page, 1800);
      await page.getByRole('button', { name: /^LEAVE BOARDS$/ }).click({ timeout: 4000 }); await wait(page, 600);
    },
    after: scrollTo('[data-retention="board-leave"]'),
    check: ['[data-retention="board-leave"]'], expect: /Leave the world board\?[\s\S]*STAY[\s\S]*LEAVE/,
  },
  {
    name: 'switch-off', note: 'The switch off (no owner preview), signed in: the same session ends on the end screen as before. No ticket, no network call to the board, no new UI.',
    seed: seed({ preview: false, joined: true }), server: SERVER.newBest, open: playSession,
    check: ['body'], expect: /YOUR PROGRESS[\s\S]*TRAIN AGAIN/, absent: /HIGH SCORES|WORLD BOARD|GAME OVER/, noCalls: true,
  },
];

const BOARD_FNS = ['start_board_run', 'submit_score', 'get_board', 'get_my_place', 'get_board_profile', 'join_boards', 'set_board_profile', 'leave_boards'];

// ── the checks (the retention preview's, kept short) ─────────────────────────
function measure({ checkSelectors }) {
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
  // Every board row stays one line (a name never wraps under its score).
  for (const r of document.querySelectorAll('[data-sb-row]')) if (shown(r) && r.getBoundingClientRect().height > 40) fails.push(`a board row takes two lines: ${name(r)}`);
  if (!roots.length) fails.push(`none of ${checkSelectors.join(', ')} is on screen`);
  return { fails: [...new Set(fails)], warns: [...new Set(warns)] };
}

// ── run ──────────────────────────────────────────────────────────────────────
let browser;
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
for (const t of tries) { try { browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'], ...t }); break; } catch (e) { if (t === tries.at(-1)) throw e; } }

let failures = 0;
const report = [];
for (const st of STATES) {
  if (ONLY && !ONLY.test(st.name)) continue;
  const ctx = await browser.newContext({ viewport: { width: SIZES[0][0], height: SIZES[0][1] }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ s }) => {
    try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
    if (!localStorage.getItem('__sp')) {
      localStorage.clear();
      localStorage.setItem('tm_reminder_card_dismissed', new Date(Date.now()).toDateString());
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      localStorage.setItem('__sp', '1');
    }
  }, { s: st.seed });
  const { calls, handler } = stub(st);
  await ctx.route(/supabase\.co/, handler);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.clock.install({ time: NOW_MS });
  try {
    for (let i = 0; i < SIZES.length; i++) {
      const [w, h] = SIZES[i];
      if (i === 0) await st.open(page, w);
      else { await page.setViewportSize({ width: w, height: h }); await wait(page, 800); }
      if (st.after) await st.after(page);
      await wait(page, 500);
      const t = await page.evaluate(() => document.body.innerText);
      const res = await page.evaluate(measure, { checkSelectors: st.check });
      if (st.expect && !st.expect.test(t)) res.fails.unshift(`expected ${st.expect} on screen`);
      if (st.absent && st.absent.test(t)) res.fails.unshift(`not expected on screen: ${t.match(st.absent)[0]}`);
      const boardCalls = calls.filter((c) => BOARD_FNS.includes(c));
      if (st.noCalls && boardCalls.length) res.fails.unshift(`the switch is off but the board's server was called: ${[...new Set(boardCalls)].join(', ')}`);
      const file = path.join(OUT, `${st.name}-${w}.png`);
      await page.screenshot({ path: file });
      if (st.overlay) {
        // The full-screen layer as tall as its content, in one photo.
        const tall = await page.locator('[role="dialog"]').first().evaluate((el) => el.scrollHeight).catch(() => 0);
        if (tall > h) {
          await page.setViewportSize({ width: w, height: tall }); await wait(page, 600);
          await page.screenshot({ path: path.join(OUT, `${st.name}-${w}-full.png`) });
          await page.setViewportSize({ width: w, height: h }); await wait(page, 400);
        }
      }
      const ok = !res.fails.length;
      if (!ok) failures++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${st.name} @${w}x${h}  → ${file}`);
      for (const f of res.fails) console.log(`       ✗ ${f}`);
      for (const f of res.warns.slice(0, 4)) console.log(`       · warn (not new): ${f}`);
      report.push({ state: st.name, note: st.note, size: `${w}x${h}`, file, fails: res.fails, warns: res.warns, calls: [...new Set(calls)] });
    }
    if (errors.length) { failures++; console.log(`FAIL ${st.name}: page errors: ${errors.join(' | ')}`); }
  } catch (e) {
    failures++;
    console.log(`FAIL ${st.name}: ${e.message}`);
    await page.screenshot({ path: path.join(OUT, `${st.name}-error.png`) }).catch(() => {});
  }
  console.log(`     board calls: ${[...new Set(calls)].join(', ') || 'none'}`);
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), states: STATES.map((s) => ({ name: s.name, note: s.note })), results: report }, null, 2));
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall states fit');
process.exit(failures ? 1 : 0);
