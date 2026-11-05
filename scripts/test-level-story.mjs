// The Level page's words and maths (data/levelStory.js): every level 1 to 15
// has its own text, the numbers agree with getLevel, a brand-new athlete gets
// no fake numbers, odd stats never throw, and no string is empty, long or
// carries a franchise name. Run with `npm run test:levels`.
import fs from 'node:fs';
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { levelStory, LEVEL_STORY_CONSTANTS: K } = await import('../components/training-mode/data/levelStory.js');
const { getLevel, getLevelProgress } = await import('../components/training-mode/data/userStats.js');
const { VISIBLE_TIERS, SECRET_TIERS, SECRET_UNLOCK, getModeXp, getCurrentTier, tierIndexForLevel, sessionMode, trainingSessionCount } = await import('../components/training-mode/data/tiers.js');
const AL = await import('../components/training-mode/data/athleteLevel.js');
const CM = await import('../components/training-mode/data/comboMix.js');
const LS = await import('../components/training-mode/data/levelStory.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

// A stats object: `rows` is [type, count, xpEach] triples; xp defaults to the sum.
const mk = (rows, xp) => {
  const sessions = [];
  for (const [type, n, each = 90, extra = {}] of rows) {
    for (let i = 0; i < n; i += 1) sessions.push({ id: `${type}${i}`, type, xpEarned: each, completedAt: '2026-11-01T10:00:00.000Z', ...extra });
  }
  return { xp: xp ?? sessions.reduce((a, s) => a + s.xpEarned, 0), sessions };
};
const atXp = (xp, n = 5) => mk([['Fit Mode', n, Math.floor(xp / Math.max(n, 1))]], xp);

// Every string a story prints, depth first.
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};
// Copy only: ids, colours and state words are not sentences.
const copy = (s) => strings([s.atYourLevel.title, s.atYourLevel.rows.map((r) => [r.label, r.tag, r.line, r.sub]), s.atYourLevel.note, s.atYourLevel.nextTitle, s.atYourLevel.next.line, s.headline, s.tierLabel, s.xpInfo.barLabel, s.xpInfo.intoLabel, s.levelTitle, s.levelLine, s.levelLineParts, s.doneTitle, s.recap, s.facts, s.split.map((x) => x.label), s.promo, s.ladderNote, s.nextTitle, s.next.xpLine, s.next.paceLine, s.next.tierLine, s.ladder.map((n) => [n.name, n.label, n.levels, n.say, n.marker ? n.marker.label : []])]);
// Franchise and character names: the union of test-concepts, the content kit's
// neverSay list and the common ones, matched on whole words (so "ken" is not "taken").
const BANNED = /\b(street fighter|ryu|ken|akuma|capcom|goku|vegeta|saiyan|dragon ball|ultra instinct|ultra ego|saitama|one[- ]?punch|garou|baki|hanma|batman|dark knight|gotham|wonder woman|diana|themyscira|amazon|lasso|spider-?man|sonic|guts|berserk|sparta|tekken|mortal kombat|one piece|star wars|avengers|rocky|naruto|marvel|pokemon|zelda|mario|jedi)\b/i;

// ── the constants agree with the app ───────────────────────────────────────
check('500 XP a level', K.XP_PER_LEVEL === 500 && getLevelProgress(0).needed === 500);
check('three levels a tier', K.LEVELS_PER_TIER === 3);
check('secret band starts at level 25', K.SECRET_START_LEVEL === 25 && getLevel(SECRET_UNLOCK.xpPastChampion) === 25);

// ── level 3 (the friend's level) ───────────────────────────────────────────
{
  const s = levelStory(mk([['Fit Mode', 6], ['Fight Focus', 4], ['Quick Mission', 2]], 1250), { streak: 3 });
  check('level 3 headline', s.headline === 'LEVEL 3' && s.level === 3);
  check('level 3 is Rookie', s.tier.name === 'Rookie' && s.tierLabel === 'COMBAT ROOKIE' && !s.tier.secret);
  check('level 3 text names Rookie', /Rookie/.test(s.levelLine));
  check('level 3 text gives XP 1,000 to 1,499', /XP 1,000 to 1,499/.test(s.levelLine), s.levelLine);
  check('level 3 is the last step', /last step of Rookie/.test(s.levelLine));
  check('level 3 range matches getLevel', getLevel(1000) === 3 && getLevel(1499) === 3 && s.xpInfo.levelFrom === 1000 && s.xpInfo.levelTo === 1499);
  check('ladder note names every 3-level tier and says Champion has no end', s.ladderNote === 'Each level is 500 XP. Rookie, Novice, Warrior and Max take 3 levels each. Champion has no end.', s.ladderNote);
  check('level 3 maths: 250 in, 250 to go', s.xpInfo.into === 250 && s.xpInfo.toNext === 250 && s.xpInfo.pct === 50, JSON.stringify(s.xpInfo));
  check('bar label', s.xpInfo.barLabel === '250 XP to LEVEL 4', s.xpInfo.barLabel);
  check('level 3 title', s.levelTitle === 'WHAT LEVEL 3 MEANS');
  check('recap counts the split', s.recap === 'You have finished 12 sessions: 8 in Fit Mode and 4 in Fight Mode.', s.recap);
  check('facts carry the real numbers', s.facts.find((f) => f.key === 'sessions').value === '12' && s.facts.find((f) => f.key === 'xp').value === '1,250' && s.facts.find((f) => f.key === 'streak').value === '3');
  check('most used is Fit Mode', s.facts.find((f) => f.key === 'top').value === 'Fit Mode');
  check('level 3 promo is the last-step Rookie line (warm and true)', s.promo === 'You started from zero and you are still here. Be proud of that.', s.promo);
  check('level 3 says what the level is, not a habit claim twice', !/habit/i.test(s.levelLine + s.promo));
  check('next names Novice at level 4', s.next.nextTier.name === 'Novice' && s.next.nextTier.startLevel === 4 && s.next.nextTier.levelsAway === 1 && /Level 4 is your first step into Novice/.test(s.next.tierLine), s.next.tierLine);
  check('next xp line', s.next.xpLine === '250 XP to Level 4.', s.next.xpLine);
  check('own pace from 12 sessions (104 XP)', s.next.paceIsOwn && s.next.paceXp === 104 && s.next.sessionsToNext === 3, JSON.stringify(s.next));
  const states = s.ladder.map((n) => n.state).join();
  check('ladder: Rookie current, the rest ahead', states === 'current,ahead,ahead,ahead,ahead', states);
  check('ladder levels', s.ladder.map((n) => n.levels).join() === '1-3,4-6,7-9,10-12,13+', s.ladder.map((n) => n.levels).join());
  check('ladder marker sits on Rookie at level 3', s.ladder[0].marker.level === 3 && s.ladder[0].pips.map((p) => p.state).join() === 'done,done,here' && s.ladder.slice(1).every((n) => !n.marker));
}

// ── levels 1, 4, 10, 15, 16 ────────────────────────────────────────────────
{
  const l1 = levelStory(atXp(0, 0));
  check('level 1: first step of Rookie, XP 0 to 499', l1.level === 1 && /first step of Rookie: XP 0 to 499/.test(l1.levelLine), l1.levelLine);
  const l4 = levelStory(atXp(1500));
  check('level 4: first step of Novice, XP 1,500 to 1,999', l4.level === 4 && l4.tier.name === 'Novice' && /first step of Novice: XP 1,500 to 1,999/.test(l4.levelLine), l4.levelLine);
  check('level 4 ladder: Rookie ticked, Novice current', l4.ladder[0].ticked && l4.ladder[0].state === 'passed' && l4.ladder[1].current && !l4.ladder[2].ticked);
  const l10 = levelStory(atXp(4960, 57), { streak: 2 });
  check('level 10 is Max (Combat Max)', l10.level === 10 && l10.tier.name === 'Max' && l10.tierLabel === 'COMBAT MAX' && l10.tier.id === 'elite');
  check('level 10 text', /first step of Max: XP 4,500 to 4,999/.test(l10.levelLine), l10.levelLine);
  check('level 10 bar: 40 XP to LEVEL 11', l10.xpInfo.barLabel === '40 XP to LEVEL 11' && l10.xpInfo.into === 460, l10.xpInfo.barLabel);
  check('level 10 ladder: three ticked, Max current, Champion ahead', l10.ladder.map((n) => n.state).join() === 'passed,passed,passed,current,ahead');
  check('level 10 next: Champion at 13, 3 levels away', l10.next.nextTier.name === 'Champion' && l10.next.nextTier.startLevel === 13 && l10.next.nextTier.levelsAway === 3 && l10.next.nextTier.xpAway === 6000 - 4960, JSON.stringify(l10.next.nextTier));
  check('level 10 pace: 87 XP a session, 1 session', l10.next.paceXp === 87 && l10.next.sessionsToNext === 1);
  const l15 = levelStory(atXp(7000));
  check('level 15: Champion, XP 7,000 to 7,499', l15.level === 15 && l15.tier.name === 'Champion' && /Champion level: XP 7,000 to 7,499/.test(l15.levelLine), l15.levelLine);
  const l16 = levelStory(atXp(7500));
  check('level 16 reuses the Champion wording with its own numbers', l16.level === 16 && /Level 16 is a Champion level: XP 7,500 to 7,999/.test(l16.levelLine) && /Champion levels/.test(l16.levelLine), l16.levelLine);
  check('Champion is at the top: what is left, no next tier', l16.next.atTop && l16.next.nextTier === null && /What is left is more levels/.test(l16.next.tierLine) && l16.next.xpLine === '500 XP to Level 17.');
  check('Champion copy never says elite or top tier (a secret tier is beyond it)', !/elite|top tier/i.test(copy(l16).join(' ') + copy(levelStory(atXp(6000))).join(' ')));
  check('Champion ladder: all four ticked, Champion current, still 13+', l16.ladder.map((n) => n.state).join() === 'passed,passed,passed,passed,current' && l16.ladder[4].levels === '13+');
  check('Champion does not mention a secret tier', !/secret|Peak|Ascendant|Final/i.test(copy(l16).join(' ')));
  const l13 = levelStory(atXp(6000));
  check('level 13: first step of Champion', /first step of Champion: XP 6,000 to 6,499/.test(l13.levelLine), l13.levelLine);
}

// ── every level 1 to 15 has its own two sentences ──────────────────────────
{
  const seen = new Set();
  let ok = true;
  for (let lv = 1; lv <= 18; lv += 1) {
    const s = levelStory(atXp((lv - 1) * 500 + 7));
    const parts = s.levelLineParts;
    const sentences = s.levelLine.split(/(?<=\.)\s+/);
    if (s.level !== lv || parts.length !== 2 || sentences.length !== 2 || !parts[1] || !s.levelLine.includes(`Level ${lv} `)) { ok = false; console.log('   level', lv, JSON.stringify(s.levelLine)); }
    if (lv <= 15) seen.add(parts[1]);
  }
  check('levels 1-18: two sentences each, the right level in the text', ok);
  check('levels 1-15: fifteen different second sentences', seen.size === 15, String(seen.size));
  // Each level's XP range is exactly what getLevel says.
  let rangeOk = true;
  for (let lv = 1; lv <= 40; lv += 1) {
    const s = levelStory(atXp((lv - 1) * 500));
    const { levelFrom: a, levelTo: b } = s.xpInfo;
    if (getLevel(a) !== lv || getLevel(b) !== lv || getLevel(b + 1) !== lv + 1) rangeOk = false;
  }
  check('XP range of every level 1-40 agrees with getLevel', rangeOk);
}

// ── secret tiers ────────────────────────────────────────────────────────────
{
  const fitLean = levelStory(mk([['Fit Mode', 30, 300], ['Fight Focus', 10, 200], ['Combat Conditioning', 5, 100]], 13000), {});
  check('secret band: Peak Physique when Fit leans', fitLean.tier.secret && fitLean.tier.id === 'peak-physique' && fitLean.level === 27, fitLean.tier.id);
  check('Peak Physique text', /Level 27 is a Peak Physique level: XP 13,000 to 13,499/.test(fitLean.levelLine) && /Fit Mode/.test(fitLean.levelLine), fitLean.levelLine);
  check('secret ladder: five visible ticked plus the secret tier as current', fitLean.ladder.length === 6 && fitLean.ladder.slice(0, 5).every((n) => n.ticked) && fitLean.ladder[5].current && fitLean.ladder[5].secret && fitLean.ladder[4].levels === '13-24' && fitLean.ladder[5].levels === '25+', JSON.stringify(fitLean.ladder.map((n) => [n.name, n.levels, n.state])));
  const fightLean = levelStory(mk([['Fit Mode', 10, 200], ['Combo Coach', 30, 300]], 12010), {});
  check('secret band: Fight Ascendant when Fight leans', fightLean.tier.id === 'fight-ascendant' && /Fight Mode/.test(fightLean.levelLine));
  const hint = levelStory(mk([['Fit Mode', 3, 100]], 20500), { tier: SECRET_TIERS.finalForm });
  check('the athlete\'s own tier wins past the secret line (Final Form)', hint.tier.id === 'final-form' && /cleared a full saga/.test(hint.levelLine) && /unlocked every tier/.test(hint.next.tierLine));
  const badHint = levelStory(atXp(3000), { tier: SECRET_TIERS.finalForm });
  check('a secret hint is ignored below the secret line', badHint.tier.id === 'warrior' && !badHint.tier.secret);
  check('secret tiers have their own promo', /secret tier/.test(fitLean.promo) && /secret tier/.test(fightLean.promo) && /last tier/.test(hint.promo));
  check('secret tiers: what is left, no next tier', fitLean.next.atTop && fitLean.next.nextTier === null && /secret tier/.test(fitLean.next.tierLine));
  // The page's tier and the app's tier are the same engine.
  const appTier = getCurrentTier(fitLean.level >= 25 ? mk([['Fit Mode', 30, 300], ['Fight Focus', 10, 200], ['Combat Conditioning', 5, 100]], 13000) : null);
  check('agrees with getCurrentTier below Final Form', appTier.id === fitLean.tier.id);
}

// ── a brand-new athlete: no fake numbers ───────────────────────────────────
{
  const s = levelStory({ xp: 0, sessions: [] }, { streak: 0 });
  check('zero sessions: an invitation, not a claim', s.recap === 'You have not trained yet. Your first session is the first step.' && s.isNew && s.sessions === 0, s.recap);
  check('zero sessions: no facts, no split', s.facts.length === 0 && s.split.length === 0);
  check('zero sessions: the promo does not claim work', /first session/.test(s.promo) && !/habit|work is showing|train like|building/.test(s.promo));
  check('level 1 meaning is an invitation for the first sessions', /starts here/.test(s.levelLine) && !/you are learning|finding your feet/i.test(s.levelLine), s.levelLine);
  check('zero sessions: pace uses the typical session', !s.next.paceIsOwn && s.next.paceXp === 90 && s.next.sessionsToNext === 6 && /typical session/.test(s.next.paceLine));
  check('zero sessions: level 1 Rookie, 500 XP to Level 2', s.level === 1 && s.xpInfo.barLabel === '500 XP to LEVEL 2' && s.xpInfo.into === 0);
  check('zero-session ladder: Rookie current only', s.ladder.map((n) => n.state).join() === 'current,ahead,ahead,ahead,ahead' && s.ladder[0].pips.map((p) => p.state).join() === 'here,todo,todo');
}

// ── the recap ──────────────────────────────────────────────────────────────
{
  check('one session', levelStory(mk([['Fit Mode', 1, 40]])).recap === 'You have finished 1 session, all in Fit Mode.');
  check('all one mode', levelStory(mk([['Fight Focus', 4]])).recap === 'You have finished 4 sessions, all in Fight Mode.');
  const mix = levelStory(mk([['Fit Mode', 3], ['Quick Mission', 2], ['Cardio', 1], ['Fight Focus', 2], ['Combo Coach', 1], ['Practice', 1], ['Combat Conditioning', 2], ['Training Camp', 1], ['Start Here', 1]]));
  check('the buckets are the tier buckets (Quick Mission and Cardio are Fit; Practice is Fight); Camp is named; a Start Here lesson is not a session', mix.recap === 'You have finished 13 sessions: 6 in Fit Mode, 4 in Fight Mode, 2 in Combat Conditioning and 1 in Training Camp.', mix.recap);
  const tapes = levelStory(mk([["Coach's Tapes", 2, 50, { kind: 'fight' }], ["Coach's Tapes", 1, 50, { kind: 'fit' }]]));
  check("Coach's Tapes follow their shelf", tapes.split.find((x) => x.key === 'fight').count === 2 && tapes.split.find((x) => x.key === 'fit').count === 1);
  const stats = mk([['Fit Mode', 5, 70], ['Fight Focus', 3, 90], ['Combat Conditioning', 2, 60], ["Coach's Tapes", 2, 40, { kind: 'fight' }], ['Cardio', 1, 30], ['Mission of the Day', 2, 25]]);
  const s = levelStory(stats);
  const bucketCount = Object.fromEntries(s.split.map((x) => [x.key, x.count]));
  const m = getModeXp(stats);
  check('the split agrees with getModeXp on which rows land where; award rows are in no bucket', bucketCount.fit === 6 && bucketCount.fight === 5 && bucketCount.cc === 2 && bucketCount.other === undefined && bucketCount.camp === undefined && m.fitXp === 5 * 70 + 30 && m.fightXp === 3 * 90 + 80 && m.ccXp === 120 && s.sessions === 13, JSON.stringify([bucketCount, m, s.sessions]));
  check('split percentages add to about 100', Math.abs(s.split.reduce((a, x) => a + x.pct, 0) - 100) <= 2);
  check('most sessions is the biggest of Fit, Fight, Conditioning', s.facts.find((f) => f.key === 'top').value === 'Fit Mode' && s.facts.find((f) => f.key === 'top').label === 'MOST SESSIONS');
  const tie = levelStory(mk([['Fit Mode', 3], ['Fight Focus', 3]]));
  check('a tie has no winner', tie.facts.find((f) => f.key === 'top').value === 'Even split');
  const onlyOther = levelStory(mk([['Mystery', 2]]));
  check('only unknown rows: no most-used, no mode named', onlyOther.recap === 'You have finished 2 sessions.' && !onlyOther.facts.some((f) => f.key === 'top'));
  const mixOther = levelStory(mk([['Fit Mode', 2], ['Mystery', 1]]));
  check('unknown rows are "other training"', mixOther.recap === 'You have finished 3 sessions: 2 in Fit Mode and 1 in other training.', mixOther.recap);
  check('no streak given: no streak fact', !levelStory(mk([['Fit Mode', 2]])).facts.some((f) => f.key === 'streak'));
  check('a streak of 0 is shown as 0', levelStory(mk([['Fit Mode', 2]]), { streak: 0 }).facts.find((f) => f.key === 'streak').value === '0');
}

// ── pace ───────────────────────────────────────────────────────────────────
{
  const two = levelStory(mk([['Fit Mode', 2, 200]], 400));
  check('under 3 sessions uses 90 XP', !two.next.paceIsOwn && two.next.paceXp === 90 && two.next.sessionsToNext === Math.ceil(100 / 90));
  const three = levelStory(mk([['Fit Mode', 3, 200]], 600));
  check('3 sessions uses their own average', three.next.paceIsOwn && three.next.paceXp === 200 && three.next.sessionsToNext === 2 && /usual 200 XP/.test(three.next.paceLine));
  check('sessions to next is a whole number of at least 1', levelStory(mk([['Fit Mode', 9, 55]], 499)).next.sessionsToNext >= 1);
  const slow = levelStory(mk([['Fit Mode', 10, 1]], 10));
  check('a slow pace stays honest', slow.next.paceXp === 1 && slow.next.sessionsToNext === 490, JSON.stringify(slow.next));
}

// ── odd stats never throw and never print junk ─────────────────────────────
{
  const odd = [
    ['null', null], ['undefined', undefined], ['empty object', {}], ['string', 'nope'], ['number', 42],
    ['NaN xp', { xp: NaN, sessions: [] }], ['negative xp', { xp: -50, sessions: [] }], ['Infinity xp', { xp: Infinity, sessions: [] }],
    ['string xp', { xp: '1200', sessions: [] }], ['junk xp', { xp: 'abc', sessions: [{ type: 'Fit Mode' }] }],
    ['sessions not an array', { xp: 600, sessions: 'x' }], ['null rows', { xp: 600, sessions: [null, undefined, 5, 'a', { type: 'Fit Mode' }] }],
    ['unknown types', { xp: 900, sessions: [{ type: 'Mystery' }, { type: 123 }, {}] }], ['NaN xpEarned', { xp: 900, sessions: [{ type: 'Fit Mode', xpEarned: NaN }, { type: 'Fight Focus', xpEarned: 'x' }] }],
    ['huge xp', { xp: 1e30, sessions: [] }], ['huge but finite', { xp: 123456789012, sessions: [{ type: 'Fit Mode' }] }], ['float xp', { xp: 1234.9, sessions: [] }],
  ];
  for (const [name, input] of odd) {
    let s, threw = null;
    try { s = levelStory(input, { streak: NaN, tier: 'garbage' }); } catch (e) { threw = e; }
    const all = s ? copy(s) : [];
    const sane = s && Number.isInteger(s.level) && s.level >= 1 && all.length > 0 && all.every((t) => t.trim() && !/NaN|undefined|null|Infinity|\[object|e\+\d/.test(t));
    check(`odd stats: ${name}`, !threw && sane, threw ? String(threw) : JSON.stringify(all.filter((t) => /NaN|undefined|null|Infinity|\[object|e\+/.test(t))));
  }
  check('NaN xp reads as level 1', levelStory({ xp: NaN, sessions: [] }).level === 1);
  check('negative xp reads as level 1', levelStory({ xp: -50, sessions: [] }).level === 1);
  check('a numeric string reads as its number', levelStory({ xp: '1200', sessions: [] }).level === 3);
  check('a float floors', levelStory({ xp: 1499.9, sessions: [] }).level === 3);
  check('null rows are not sessions', levelStory({ xp: 600, sessions: [null, undefined, 5, { type: 'Fit Mode' }] }).sessions === 1);
  check('a NaN streak shows no streak', !levelStory({ xp: 1, sessions: [{ type: 'Fit Mode' }] }, { streak: NaN }).facts.some((f) => f.key === 'streak'));
  const huge = levelStory({ xp: 1e30, sessions: [] });
  check('huge XP is capped to a real level', huge.level > 1e6 && Number.isFinite(huge.level) && /^LEVEL [\d,]+$/.test(huge.headline), huge.headline);
}

// ── the maths over a sweep ─────────────────────────────────────────────────
{
  let ok = true;
  for (let xp = 0; xp <= 30000; xp += 137) {
    const s = levelStory(atXp(xp, 4));
    const lp = getLevelProgress(xp);
    if (s.level !== getLevel(xp) || s.xpInfo.into !== lp.current || s.xpInfo.toNext !== lp.needed - lp.current || s.xpInfo.into + s.xpInfo.toNext !== 500) { ok = false; console.log('   xp', xp); break; }
    if (s.next.xpToNext !== s.xpInfo.toNext || s.next.nextLevel !== s.level + 1) { ok = false; console.log('   next at', xp); break; }
    if (s.xpInfo.pct < 0 || s.xpInfo.pct > 100) { ok = false; break; }
    const cur = s.ladder.filter((n) => n.current);
    if (cur.length !== 1) { ok = false; console.log('   ladder at', xp); break; }
    if (!s.tier.secret && (s.level < VISIBLE_TIERS.length * 3 + 1) && s.ladder.findIndex((n) => n.current) !== Math.min(Math.floor((s.level - 1) / 3), 4)) { ok = false; console.log('   ladder idx at', xp); break; }
    if (s.ladder.some((n) => n.ticked && (n.current || n.state !== 'passed'))) { ok = false; break; }
  }
  check('level, XP in/to-go, next and ladder are right every 137 XP up to 30,000', ok);
  // Deterministic: the same stats give the same story, byte for byte.
  const a = JSON.stringify(levelStory(mk([['Fit Mode', 7], ['Fight Focus', 2]]), { streak: 4 }));
  const b = JSON.stringify(levelStory(mk([['Fit Mode', 7], ['Fight Focus', 2]]), { streak: 4 }));
  check('deterministic', a === b);
  // It never mutates what it is given.
  const input = mk([['Fit Mode', 3]]);
  const before = JSON.stringify(input);
  levelStory(input, { streak: 1 });
  check('does not mutate the stats', JSON.stringify(input) === before);
  check('does not touch storage', store.size === 0);
}

// ── review fixes: one rule for the tier, everywhere ───────────────────────
{
  // The Progress tab, the content kit and the Level page all rank by the level's
  // tier. VISIBLE_TIERS[].xp is where each tier's band starts, so they cannot differ.
  check('VISIBLE_TIERS[].xp is where each tier\'s level band starts', VISIBLE_TIERS.every((t, i) => t.xp === (i * K.LEVELS_PER_TIER) * K.XP_PER_LEVEL && getLevel(t.xp) === i * K.LEVELS_PER_TIER + 1), JSON.stringify(VISIBLE_TIERS.map((t) => t.xp)));
  let agree = true;
  for (let xp = 0; xp <= 9000; xp += 37) {
    // What ProgressScreen's rank did before it used the level: the last tier whose xp is reached.
    const byXp = VISIBLE_TIERS.reduce((r, t, i) => (xp >= t.xp ? i : r), 0);
    const byLevel = tierIndexForLevel(getLevel(xp));
    const page = levelStory(atXp(xp, 3)).tier.index;
    if (byXp !== byLevel || byLevel !== page) { agree = false; console.log('   xp', xp, byXp, byLevel, page); break; }
  }
  check('rank by XP, rank by level and the Level page agree at every 37 XP to 9,000', agree);
  const prog = fs.readFileSync(new URL('../components/training-mode/ProgressScreen.jsx', import.meta.url), 'utf8');
  check('ProgressScreen ranks by the level\'s tier (tierIndexForLevel(getLevel(xp)))', /const getRank = \(xp\) => RANKS\[tierIndexForLevel\(getLevel\(xp\)\)\]/.test(prog));
  const kit = JSON.parse(fs.readFileSync(new URL('../content-kit/content-kit.json', import.meta.url), 'utf8'));
  check('the content kit\'s ranks start where the app\'s tiers start (run npm run content:kit)', kit.ranks.every((r, i) => r.xpFrom === VISIBLE_TIERS[i].xp), JSON.stringify(kit.ranks.map((r) => r.xpFrom)));
  // The friend at level 3 and the owner at level 10, by name.
  check('level 3 is Rookie and level 4 is Novice on the page, as on Profile', levelStory(atXp(1260)).tier.name === 'Rookie' && levelStory(atXp(1520)).tier.name === 'Novice' && getCurrentTier(atXp(1260)).name === 'Rookie' && getCurrentTier(atXp(1520)).name === 'Novice');
}

// ── review fixes: what counts as a session ────────────────────────────────
{
  const rows = mk([['Fit Mode', 3], ['Mission of the Day', 3, 25], ['Hybrid Training Bonus', 1, 40], ['Start Here', 2, 20], ['Training Camp', 2], ['Mystery', 1]]);
  const s = levelStory(rows, { streak: 1 });
  check('award rows (Mission of the Day, Hybrid bonus, Start Here) are not sessions', trainingSessionCount(rows) === 6 && s.sessions === 6 && s.facts.find((f) => f.key === 'sessions').value === '6', String(s.sessions));
  check('Profile and the Level page count the same', trainingSessionCount(rows) === s.sessions && ['Mission of the Day', 'Hybrid Training Bonus', 'Start Here'].every((t) => sessionMode({ type: t }) === 'bonus'));
  check('award XP still counts in the XP total', s.xp === rows.xp && s.facts.find((f) => f.key === 'xp').value === String(rows.xp).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  check('Training Camp is named, not "other training"', /2 in Training Camp/.test(s.recap) && /1 in other training/.test(s.recap), s.recap);
  check('trainingSessionCount tolerates junk', trainingSessionCount(null) === 0 && trainingSessionCount({ sessions: 'x' }) === 0 && trainingSessionCount({ sessions: [null, 3, { type: 'Fit Mode' }, { type: 'Start Here' }] }) === 1);
  const pace = levelStory(mk([['Fit Mode', 2, 100], ['Mission of the Day', 2, 25]], 250));
  check('pace counts sessions, not award rows (2 sessions: still the typical 90 XP)', pace.sessions === 2 && !pace.next.paceIsOwn && pace.next.paceXp === 90);
}

// ── review fixes: XP but no (real) sessions ───────────────────────────────
{
  const noRows = levelStory({ xp: 3000, sessions: [] });
  check('level 7 with no rows: not "your first session"', noRows.level === 7 && noRows.recap === 'No sessions are recorded on this device.' && !noRows.isNew, noRows.recap);
  check('level 7 with no rows: the Warrior promo, the XP fact, no session numbers', noRows.promo === 'You are a Warrior now. That is a real step up, and you earned it.' && noRows.facts.map((f) => f.key).join() === 'xp' && noRows.split.length === 0);
  const bonusOnly = levelStory(mk([['Mission of the Day', 1, 150]]));
  check('a bonus-only history is not "1 session"', bonusOnly.sessions === 0 && bonusOnly.recap === 'No sessions are recorded on this device.' && !/finished/.test(bonusOnly.recap), bonusOnly.recap);
  const one = levelStory(mk([['Fit Mode', 1, 90]]));
  check('level 1 with one session: a nudge, no claim of a habit', one.promo === 'You have started. Come back and do it again.' && !/habit|building/.test(one.promo + one.levelLine), one.promo);
  const two = levelStory(mk([['Fit Mode', 2, 90]]));
  check('level 1 with two sessions: the same nudge', two.promo === one.promo);
  const three = levelStory(mk([['Fit Mode', 3, 90]]));
  check('level 1 with three sessions: the Rookie line', three.promo === 'You are on the ladder now. Each session takes you one step higher.', three.promo);
  check('XP with no rows is not "new"', levelStory({ xp: 1, sessions: [] }).isNew === false && levelStory({ xp: 0, sessions: [] }).isNew === true);
}

// ── review fixes: secret-tier copy is true to the numbers ─────────────────
{
  const lean = (fit, fight, n = 5) => mk([['Fit Mode', n, fit], ['Fight Focus', n, fight]], 13000);
  const fitWins = levelStory(lean(300, 100), { tier: SECRET_TIERS.peakPhysique });
  check('Peak Physique by Fit XP: says Fit leans', /Fit Mode training/.test(fitWins.levelLine) && /Fit Mode work/.test(fitWins.promo));
  const tie = levelStory(lean(200, 200), { tier: SECRET_TIERS.peakPhysique });
  check('Peak Physique on an exact tie: no lean claimed', !/Fit Mode|leans/.test(tie.levelLine + tie.promo) && /passed Champion/.test(tie.levelLine) && /passed Champion/.test(tie.promo), tie.levelLine + ' | ' + tie.promo);
  const none = levelStory({ xp: 13000, sessions: [] });
  check('Peak Physique with 0 vs 0 XP: no lean claimed', none.tier.id === 'peak-physique' && !/Fit Mode|leans/.test(none.levelLine + none.promo));
  const fightWins = levelStory(mk([['Fit Mode', 10, 100], ['Fight Focus', 5, 400]], 12500));
  check('Fight Ascendant by Fight XP: says Fight leans', fightWins.tier.id === 'fight-ascendant' && /Fight Mode training/.test(fightWins.levelLine) && /Fight Mode work/.test(fightWins.promo));
  check('the lean is by XP, and the session fact is labelled by sessions (10 Fit vs 5 Fight sessions)', fightWins.facts.find((f) => f.key === 'top').label === 'MOST SESSIONS' && fightWins.facts.find((f) => f.key === 'top').value === 'Fit Mode' && /XP leans/.test(fightWins.levelLine));
  const wrongHint = levelStory(lean(300, 100), { tier: SECRET_TIERS.fightAscendant });
  check('a hint that disagrees with the rows gets the neutral line, not a false lean', !/Fight Mode training/.test(wrongHint.levelLine) && /passed Champion/.test(wrongHint.levelLine));
  const ff = levelStory(mk([['Fit Mode', 3, 100]], 20500), { tier: SECRET_TIERS.finalForm });
  check('Final Form starts at its own level (20,000 XP), not the secret band\'s', ff.ladder.at(-1).levels === `${K.FINAL_FORM_START_LEVEL}+` && K.FINAL_FORM_START_LEVEL === getLevel(SECRET_UNLOCK.finalForm.totalXp) && ff.tier.levels === '41+' && K.FINAL_FORM_START_LEVEL === 41, ff.ladder.at(-1).levels);
  check('Peak Physique still starts at 25', levelStory(lean(300, 100), { tier: SECRET_TIERS.peakPhysique }).ladder.at(-1).levels === '25+');
}

// ── review fixes: numbers over 999 read the same everywhere ──────────────
{
  const big = levelStory({ xp: 5000000, sessions: [] });
  check('level 10,001 is written with its comma in every string', big.headline === 'LEVEL 10,001' && big.levelLine.startsWith('Level 10,001 ') && !/\b10001\b/.test(copy(big).join(' ')), big.levelLine);
}

// ── review fixes: the ladder speaks ───────────────────────────────────────
{
  const s = levelStory(atXp(1260));
  check('every ladder step says its state in words', s.ladder.every((n) => /\.$/.test(n.say)) && s.ladder[0].say === 'Rookie, levels 1 to 3, you are here at level 3.' && s.ladder[1].say === 'Novice, levels 4 to 6, still ahead.' && s.ladder[4].say === 'Champion, level 13 and up, still ahead.', JSON.stringify(s.ladder.map((n) => n.say)));
  const l10 = levelStory(atXp(4960));
  check('passed steps say passed', l10.ladder[0].say === 'Rookie, levels 1 to 3, passed.' && l10.ladder[3].say === 'Max, levels 10 to 12, you are here at level 10.');
  const sec = levelStory(mk([['Fit Mode', 30, 300]], 13000));
  check('a secret tier is said as a secret tier, and Champion closes at 24', sec.ladder.at(-1).say === 'Peak Physique, secret tier, level 25 and up, you are here at level 27.' && sec.ladder[4].say === 'Champion, levels 13 to 24, passed.', JSON.stringify(sec.ladder.map((n) => n.say)));
  const view = fs.readFileSync(new URL('../components/training-mode/LevelView.jsx', import.meta.url), 'utf8');
  check('LevelView: cards are headed sections, the ladder is a list, the heading takes focus', /<h2 id=\{id\}/.test(view) && /aria-labelledby=\{id\}/.test(view) && /<ol /.test(view) && /<li /.test(view) && /<h1 ref=\{headingRef\} tabIndex=\{-1\}/.test(view) && /\{n\.say\}/.test(view) && /\{secret\.say\}/.test(view));
}

// ── review fixes: no two lines on one screen say the same thing ───────────
{
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const shingles = (t, n) => { const w = words(t); const out = new Set(); for (let i = 0; i + n <= w.length; i += 1) out.add(w.slice(i, i + n).join(' ')); return out; };
  // Words that carry the ladder itself, not an idea.
  const COMMON = new Set(['level', 'levels', 'tier', 'ladder', 'main', 'session', 'sessions', 'training', 'train', 'trained', 'champion', 'rookie', 'novice', 'warrior', 'peak', 'physique', 'fight', 'ascendant', 'final', 'form', 'unlocked', 'passed', 'there', 'where', 'their', 'still', 'those', 'these', 'every', 'which', 'again', 'start', 'starts', 'steps', 'record', 'earned', 'secret']);
  const content = (t) => new Set(words(t).filter((w) => w.length >= 5 && !COMMON.has(w)));
  let bad = [];
  const screens = [];
  for (let lv = 1; lv <= 30; lv += 1) {
    for (const n of [0, 1, 5]) screens.push([`L${lv}/${n}`, levelStory(mk([['Fit Mode', n, 90]], (lv - 1) * 500 + 7), { streak: 2 })]);
  }
  for (const kind of ['fit', 'fight', 'tie']) screens.push([`secret-${kind}`, levelStory(mk([['Fit Mode', 5, kind === 'fight' ? 50 : kind === 'fit' ? 300 : 200], ['Fight Focus', 5, kind === 'fight' ? 300 : kind === 'fit' ? 50 : 200]], 13000))]);
  for (const [name, st] of screens) {
    const parts = { meaning: st.levelLineParts[1], promo: st.promo, recap: st.recap, tier: st.next.tierLine, note: st.ladderNote };
    const pairs = [['meaning', 'promo'], ['meaning', 'tier'], ['promo', 'tier'], ['promo', 'recap'], ['meaning', 'recap'], ['promo', 'note']];
    for (const [x, y] of pairs) {
      const echo = [...shingles(parts[x], 5)].filter((g) => shingles(parts[y], 5).has(g));
      const ideas = [...content(parts[x])].filter((w) => content(parts[y]).has(w));
      if (echo.length || ideas.length) bad.push(`${name} ${x}/${y}: ${[...echo, ...ideas].join(', ')}`);
    }
  }
  check('on one screen, the meaning, promo, recap and next lines share no 5-word phrase and no idea word', bad.length === 0, bad.slice(0, 6).join(' | '));
  // Across the fifteen levels, no phrase is the standard line twice.
  const pool = new Set();
  for (let lv = 1; lv <= 15; lv += 1) { const st = levelStory(mk([['Fit Mode', 5, 90]], (lv - 1) * 500 + 7)); pool.add(st.levelLineParts[1]); pool.add(st.promo); }
  const seen = new Map(); const repeats = [];
  [...pool].forEach((line, i) => shingles(line, 4).forEach((g) => { if (seen.has(g) && seen.get(g) !== i) repeats.push(g); else seen.set(g, i); }));
  check('across levels 1-15 no 4-word phrase is reused (no "showing up" / "one session at a time" / "serious work" twice)', repeats.length === 0, [...new Set(repeats)].join(' | '));
  const promos = new Set(); for (let lv = 1; lv <= 13; lv += 1) promos.add(levelStory(mk([['Fit Mode', 5, 90]], (lv - 1) * 500 + 7)).promo);
  check('levels 1-13 each have their own promotion line', promos.size === 13, String(promos.size));
}

// ── copy rules ─────────────────────────────────────────────────────────────
{
  const sample = [];
  // Every level 1 to 30 (with sessions, with none and with a few), and the XP a
  // level starts and ends on.
  for (let lv = 1; lv <= 30; lv += 1) {
    for (const xp of [(lv - 1) * 500, lv * 500 - 1]) {
      sample.push(levelStory(mk([['Fit Mode', 6], ['Fight Focus', 4], ['Combat Conditioning', 1], ['Training Camp', 1]], xp), { streak: 5 }));
      sample.push(levelStory({ xp, sessions: [] }, { streak: 0 }));
    }
    sample.push(levelStory(mk([['Fit Mode', 1, 90]], (lv - 1) * 500 + 7)));
  }
  for (const xp of [0, 250, 1e9]) sample.push(levelStory({ xp, sessions: [] }, { streak: 0 }));
  // All three secret tiers, with each lean and with the neutral line.
  const secretStats = [
    mk([['Fit Mode', 30, 300], ['Fight Focus', 10, 200]], 13000),
    mk([['Fit Mode', 10, 100], ['Fight Focus', 30, 300]], 13000),
    mk([['Fit Mode', 5, 200], ['Fight Focus', 5, 200]], 13000),
    mk([['Fit Mode', 3, 100]], 20500),
  ];
  for (const st of secretStats) for (const tier of [undefined, SECRET_TIERS.peakPhysique, SECRET_TIERS.fightAscendant, SECRET_TIERS.finalForm]) sample.push(levelStory(st, { streak: 5, tier }));
  const every = sample.flatMap(copy);
  check('copy is not empty', every.length > 500 && every.every((t) => t.trim().length > 0), String(every.length));
  check('every string is under 160 characters', every.every((t) => t.length < 160), every.filter((t) => t.length >= 160).join(' | '));
  check('every sentence in the page text is under 140 characters', sample.every((s) => [...s.levelLineParts, s.recap, s.promo, s.next.xpLine, s.next.paceLine, s.next.tierLine].every((t) => t.length < 140)));
  const banned = every.filter((t) => BANNED.test(t));
  check('no franchise or character names', banned.length === 0, banned.join(' | '));
  check('no medical claims', every.every((t) => !/\b(cure|heal|disease|doctor|injury|diagnos|treat|prescri|medical)/i.test(t)));
  check('no more than one exclamation mark per screen', sample.every((s) => copy(s).join('').split('!').length - 1 <= 1));
  check('the exclamation mark lives only in the promotion line', sample.every((s) => !copy(s).filter((t) => t !== s.promo).some((t) => t.includes('!'))));
  check('no double spaces or stray punctuation', every.every((t) => !/\s{2,}|\.\.|,,|\s[.,]/.test(t)), every.filter((t) => /\s{2,}|\.\.|,,|\s[.,]/.test(t)).join(' | '));
  check('second person: no "the athlete"', every.every((t) => !/the athlete/i.test(t)));
  check('promo is always present', sample.every((s) => s.promo && s.promo.length > 20));
  check('no copy line says "elite" (Max was Elite once)', every.every((t) => !/\belite\b/i.test(t)));
  check('the secret tiers only show to people in one', sample.filter((s) => !s.tier.secret).every((s) => !/secret|Peak Physique|Fight Ascendant|Final Form/.test(copy(s).join(' '))));
  check('no secret copy claims a lean the rows do not show', sample.filter((s) => s.tier.secret && s.tier.id !== 'final-form').every((s) => !/leans toward Fit/.test(s.levelLine) || /Peak Physique/.test(s.levelLine)));

  // The words that are written in the page itself, not in levelStory: every
  // string literal and JSX text in LevelView.jsx and the Level tags on Profile.
  const lits = (file) => {
    const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const out = [];
    for (const m of src.matchAll(/'([^'\n]{3,})'|"([^"\n]{3,})"|>\s*([A-Za-z0-9⚔️·›★ ,.'’!?&:%+-]{3,}?)\s*</g)) out.push(m[1] || m[2] || m[3]);
    return out.map((t) => t.trim()).filter(Boolean);
  };
  const pageLits = [...lits('../components/training-mode/LevelView.jsx'), ...lits('../components/training-mode/Profile.jsx').filter((t) => /LEVEL|AVATAR|level/i.test(t))];
  check('literal strings in LevelView.jsx and the Profile entry points were found', pageLits.length > 15 && pageLits.some((t) => /CHANGE AVATAR/.test(t)) && pageLits.some((t) => /LEVEL ›/.test(t)), String(pageLits.length));
  check('no franchise or character names in the page text', pageLits.every((t) => !BANNED.test(t)), pageLits.filter((t) => BANNED.test(t)).join(' | '));
  check('the page text has no exclamation mark (the promo line is the only one)', pageLits.every((t) => !t.includes('!')));
}

// ── AT YOUR LEVEL: the proof that progress means something ─────────────────
// The block reads Quick Mission's start from the Fit side's tier and Combo
// Coach's mix from the Fight side's, by the rule in data/athleteLevel. No number
// is typed in the page: every one here is checked against the tables.
{
  const fitOnly = (level) => mk([['Fit Mode', 1, (level - 1) * 500]]);
  const fightOnly = (level) => mk([['Fight Focus', 1, (level - 1) * 500]]);
  const both = (level) => mk([['Fit Mode', 1, (level - 1) * 250], ['Fight Focus', 1, (level - 1) * 250]]);
  const kicksText = (t) => { const m = CM.COMBO_MIX[t].maxHardKicks; return m === null ? 'with no limit on difficult kicks' : m === 0 ? 'with no difficult kicks' : `with up to ${m} difficult kick${m === 1 ? '' : 's'} per round`; };

  // The block is on the story, for every level 1 to 30 and for each way the XP can lean.
  let shape = true, quickOk = true, comboOk = true, tagOk = true, nextOk = true, levelsSeen = 0;
  const lines = [];
  for (let level = 1; level <= 30; level += 1) {
    for (const [name, st] of [['fit', fitOnly(level)], ['fight', fightOnly(level)], ['both', both(level)], ['no rows', { xp: (level - 1) * 500, sessions: [] }]]) {
      const a = levelStory(st).atYourLevel;
      const fit = AL.athleteStart(st, 'fit'), fight = AL.athleteStart(st, 'fight');
      if (!a || a.title !== 'AT YOUR LEVEL' || a.nextTitle !== 'NEXT TIER' || a.rows.length !== 2 || a.rows[0].key !== 'quick' || a.rows[1].key !== 'combo') { shape = false; console.log('   shape', level, name); continue; }
      levelsSeen += 1;
      // Quick Missions start at the tier the Fit side sets, in the word the Quick Mission page prints.
      if (a.rows[0].line !== `Quick Missions start at ${AL.QUICK_MISSION_WORD[AL.tierForLevel(fit.level)]}.` || a.rows[0].tier !== AL.tierForLevel(fit.level) || a.rows[0].level !== fit.level) { quickOk = false; console.log('   quick', level, name, a.rows[0].line); }
      // Combo Coach: the number is the longest combo the tier can really deal, the kicks are the table's.
      const tier = AL.tierForLevel(fight.level);
      const m = a.rows[1].line.match(/^Combo Coach deals up to (\d+)-strike combos, (.+)\.$/);
      if (!m || Number(m[1]) !== CM.comboReach(tier).strikes || m[2] !== kicksText(tier) || a.rows[1].tier !== tier || a.rows[1].level !== fight.level) { comboOk = false; console.log('   combo', level, name, a.rows[1].line); }
      if (a.rows[0].tag !== `FIT LEVEL ${fit.level}` || a.rows[1].tag !== `FIGHT LEVEL ${fight.level}`) { tagOk = false; console.log('   tag', level, name, a.rows.map((r) => r.tag).join()); }
      // NEXT TIER: whichever cutoff is nearer (Quick Mission on a tie), at the cutoff's own level.
      const qn = AL.nextTierAfter(fit.level), cn = AL.nextTierAfter(fight.level);
      const want = !qn && !cn ? 'top' : qn && (!cn || qn.levelsAway <= cn.levelsAway) ? 'quick' : 'combo';
      const n = a.next;
      const okNext = want === 'top'
        ? n.atTop && /^You are on the top tier\./.test(n.line)
        : want === 'quick'
          ? n.key === 'quick' && n.level === qn.level && n.tier === qn.tier && n.line === `At Fit level ${qn.level}, Quick Missions start at ${AL.QUICK_MISSION_WORD[qn.tier]}.`
          : n.key === 'combo' && n.level === cn.level && n.tier === cn.tier && n.line.startsWith(`At Fight level ${cn.level}, Combo Coach `) && n.line.endsWith('.');
      if (!okNext) { nextOk = false; console.log('   next', level, name, want, n.line); }
      if (name === 'both') lines.push(`${level}: ${a.rows[0].line} | ${a.rows[1].line} | ${a.next.line}`);
    }
  }
  check('AT YOUR LEVEL is on the story at every level 1 to 30, Fit-heavy, Fight-heavy, balanced and with no rows', shape && levelsSeen === 120, String(levelsSeen));
  check('Quick Missions start at the tier the Fit side sets (level 1-2 EASY, 3-5 MEDIUM, 6-9 HARD, 10+ ADVANCED), in the Quick Mission page\'s own words', quickOk);
  check('Combo Coach: "up to N-strike combos" is the tier\'s real longest combo and the difficult kicks are the table\'s', comboOk);
  check('each row names the level it reads (FIT LEVEL n, FIGHT LEVEL n)', tagOk);
  check('NEXT TIER is the nearer cutoff, with its own level and new start; the top tier says so', nextOk);

  // The numbers on the page are true: deal thousands of calls and nothing is longer than the page says.
  for (const t of AL.TIERS) {
    const claimed = CM.comboReach(t).strikes;
    let longest = 0, hardWorst = 0;
    for (const d of CM.DISCIPLINES) for (let r = 0; r < 60; r += 1) {
      let seed = 7 * r + 13 + t.length; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const round = CM.dealMixItems({ prepared: CM.preparedPool()[d], tier: t, count: 40, rng });
      longest = Math.max(longest, ...round.map((c) => c.strikes));
      hardWorst = Math.max(hardWorst, round.filter((c) => c.hard).length);
    }
    const cap = CM.COMBO_MIX[t].maxHardKicks;
    check(`${t}: the page's "${claimed}-strike" is the longest dealt (no longer, and one that long does come up); the kick cap holds`, longest === claimed && (cap === null || hardWorst <= cap), `dealt ${longest}, page ${claimed}, kicks ${hardWorst}/${cap}`);
  }
  check('the numbers climb with the tier: Easy deals shorter combos than Normal, and the kick cap goes none, some, no limit',
    CM.comboReach('EASY').strikes < CM.comboReach('NORMAL').strikes && CM.COMBO_MIX.EASY.maxHardKicks === 0 && CM.COMBO_MIX.NORMAL.maxHardKicks > 0 && CM.COMBO_MIX.HARD.maxHardKicks === null);

  // Plain examples (the words the owner can post).
  const l = (level, st = fitOnly) => levelStory(st(level)).atYourLevel;
  check('level 1: Quick Missions start at EASY; Combo Coach deals up to 3-strike combos, with no difficult kicks', l(1).rows[0].line === 'Quick Missions start at EASY.' && l(1).rows[1].line === 'Combo Coach deals up to 3-strike combos, with no difficult kicks.', l(1).rows[1].line);
  check('level 7 (Fit work): Quick Missions start at HARD; Combo Coach is on Fight level 4 and caps difficult kicks at 2', l(7).rows[0].line === 'Quick Missions start at HARD.' && l(7).rows[1].tag === 'FIGHT LEVEL 4' && l(7).rows[1].line === 'Combo Coach deals up to 6-strike combos, with up to 2 difficult kicks per round.', l(7).rows[1].line);
  check('level 10 (Fit work): Quick Missions start at ADVANCED', l(10).rows[0].line === 'Quick Missions start at ADVANCED.');
  check('a balanced level 10 (half Fit, half Fight) reads Fit level 7 and Fight level 7: HARD for both, since the other side counts at half',
    l(10, both).rows[0].tag === 'FIT LEVEL 7' && l(10, both).rows[1].tag === 'FIGHT LEVEL 7' && l(10, both).rows[0].line === 'Quick Missions start at HARD.' && l(10, both).next.line === 'At Fit level 10, Quick Missions start at ADVANCED.', JSON.stringify(l(10, both).rows.map((r) => r.tag)));
  check('a Fit-only athlete at level 12 has Quick Missions at ADVANCED and Combo Coach still climbing (NEXT TIER names Fight level 10)', l(12).rows[0].line === 'Quick Missions start at ADVANCED.' && /^At Fight level 10, Combo Coach swings from single strikes to the hardest combos/.test(l(12).next.line), l(12).next.line);
  check('the very top says so', /^You are on the top tier\. Quick Missions start at ADVANCED, and Combo Coach deals its full mix\.$/.test(levelStory(both(30)).atYourLevel.next.line), levelStory(both(30)).atYourLevel.next.line);
  check('Combo Coach\'s second line: Easy is singles and short combos; the rest say how many in 10 are advanced, the top swings',
    l(1).rows[1].sub === 'You get single strikes and short combos.' && /^About 1 in 10 combos is advanced\.$/.test(levelStory(fightOnly(3)).atYourLevel.rows[1].sub) && /^About 2 in 10 combos are advanced\.$/.test(levelStory(fightOnly(6)).atYourLevel.rows[1].sub)
    && /^Rounds swing from single strikes to the hardest combos\. About 5 in 10 combos are advanced\.$/.test(levelStory(fightOnly(10)).atYourLevel.rows[1].sub), levelStory(fightOnly(6)).atYourLevel.rows[1].sub);
  check('the block is the same in the helper and in the story', JSON.stringify(levelStory(fitOnly(7)).atYourLevel) === JSON.stringify(LS.atYourLevel(fitOnly(7))));
  check('Quick Mission\'s word for a tier is one table (the page, the Quick Mission page and the kit read it)', AL.QUICK_MISSION_WORD.NORMAL === 'MEDIUM' && AL.QUICK_MISSION_WORD.ADVANCED === 'ADVANCED');

  // Secret tiers, empty and odd stats: still a sane block.
  const secret = [mk([['Fit Mode', 30, 300], ['Fight Focus', 10, 200]], 13000), mk([['Fit Mode', 10, 100], ['Fight Focus', 30, 300]], 13000), mk([['Fit Mode', 3, 100]], 20500)];
  for (const [i, st] of secret.entries()) {
    const a = levelStory(st, { tier: [SECRET_TIERS.peakPhysique, SECRET_TIERS.fightAscendant, SECRET_TIERS.finalForm][i] }).atYourLevel;
    const all = strings(a);
    check(`secret tier ${i + 1}: the block is whole, plain and not empty`, all.length > 8 && all.every((t) => t.trim().length > 0 && !/NaN|undefined|null|\[object|e\+\d/.test(t)) && a.rows.every((r) => /^FIT LEVEL \d|^FIGHT LEVEL \d/.test(r.tag)), all.join(' | '));
  }
  const emptyBlock = levelStory({ xp: 0, sessions: [] }).atYourLevel;
  check('no stats: level 1 on both sides, EASY, and the first cutoff is level 3', emptyBlock.rows.map((r) => r.level).join() === '1,1' && emptyBlock.rows[0].line === 'Quick Missions start at EASY.' && emptyBlock.next.line === 'At Fit level 3, Quick Missions start at MEDIUM.', emptyBlock.next.line);
  for (const bad of [null, undefined, {}, 'x', { xp: NaN, sessions: 'x' }, { xp: -1, sessions: [null] }, { xp: 1e30, sessions: [] }]) {
    let ok = true; try { const a = levelStory(bad).atYourLevel; ok = strings(a).every((t) => t.trim() && !/NaN|undefined|null|Infinity|\[object|e\+\d/.test(t)); } catch { ok = false; }
    if (!ok) check(`odd stats ${JSON.stringify(bad)}: the block is sane`, false);
  }
  check('odd stats never break the block', true);

  // Copy rules for the block: short, plain, one idea each, no names, no exclamation marks, no medical claims.
  const blocks = [];
  for (let level = 1; level <= 30; level += 1) for (const mkx of [fitOnly, fightOnly, both]) blocks.push(levelStory(mkx(level)).atYourLevel);
  const words = blocks.flatMap((b) => strings(b));
  check('every line of the block is under 140 characters and every sentence ends in a full stop (labels aside)', blocks.every((b) => [b.note, b.next.line, ...b.rows.flatMap((r) => [r.line, r.sub].filter(Boolean))].every((t) => t.length < 140 && /\.$/.test(t))), words.filter((t) => t.length >= 140).join(' | '));
  check('the block has no exclamation mark, no franchise name, no medical claim', words.every((t) => !t.includes('!') && !BANNED.test(t) && !/\b(cure|heal|disease|doctor|injury|diagnos|treat|prescri|medical)/i.test(t)));
  check('the block is second person and says nothing about "the athlete"', words.every((t) => !/the athlete/i.test(t)));
  check('the block says "strike", never "punch" for a combo that may hold a kick', words.every((t) => !/punch/i.test(t)));
  check('the four tiers read differently (Quick Mission line, Combo Coach line and mix line all change from Easy up)',
    new Set(AL.TIERS.map((t) => `${LS.quickLine(t)}|${LS.comboLine(t)}|${LS.comboMixLine(t)}`)).size === 4);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
