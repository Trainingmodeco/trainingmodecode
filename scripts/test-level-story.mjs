// The Level page's words and maths (data/levelStory.js): every level 1 to 15
// has its own text, the numbers agree with getLevel, a brand-new athlete gets
// no fake numbers, odd stats never throw, and no string is empty, long or
// carries a franchise name. Run with `npm run test:levels`.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { levelStory, LEVEL_STORY_CONSTANTS: K } = await import('../components/training-mode/data/levelStory.js');
const { getLevel, getLevelProgress } = await import('../components/training-mode/data/userStats.js');
const { VISIBLE_TIERS, SECRET_TIERS, SECRET_UNLOCK, getModeXp, getCurrentTier } = await import('../components/training-mode/data/tiers.js');

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
const copy = (s) => strings([s.headline, s.tierLabel, s.xpInfo.barLabel, s.xpInfo.intoLabel, s.levelTitle, s.levelLine, s.levelLineParts, s.doneTitle, s.recap, s.facts, s.split.map((x) => x.label), s.promo, s.ladderNote, s.nextTitle, s.next.xpLine, s.next.paceLine, s.next.tierLine, s.ladder.map((n) => [n.name, n.label, n.levels, n.marker ? n.marker.label : []])]);
const BANNED = ['street fighter', 'ryu', 'goku', 'batman', 'naruto', 'dragon ball', 'marvel', 'pokemon', 'zelda', 'mario', 'saiyan', 'jedi'];

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
  check('ladder note', s.ladderNote === 'Each level is 500 XP. Each tier is 3 levels.', s.ladderNote);
  check('level 3 maths: 250 in, 250 to go', s.xpInfo.into === 250 && s.xpInfo.toNext === 250 && s.xpInfo.pct === 50, JSON.stringify(s.xpInfo));
  check('bar label', s.xpInfo.barLabel === '250 XP to LEVEL 4', s.xpInfo.barLabel);
  check('level 3 title', s.levelTitle === 'WHAT LEVEL 3 MEANS');
  check('recap counts the split', s.recap === 'You have finished 12 sessions: 8 in Fit Mode and 4 in Fight Mode.', s.recap);
  check('facts carry the real numbers', s.facts.find((f) => f.key === 'sessions').value === '12' && s.facts.find((f) => f.key === 'xp').value === '1,250' && s.facts.find((f) => f.key === 'streak').value === '3');
  check('most used is Fit Mode', s.facts.find((f) => f.key === 'top').value === 'Fit Mode');
  check('rookie promo', /habit/.test(s.promo));
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
  check('Champion is at the top: what is left, no next tier', l16.next.atTop && l16.next.nextTier === null && /top tier/.test(l16.next.tierLine) && l16.next.xpLine === '500 XP to Level 17.');
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
  check('zero sessions: the first-session line', s.recap === 'Your first session starts this level.' && s.isNew && s.sessions === 0);
  check('zero sessions: no facts, no split', s.facts.length === 0 && s.split.length === 0);
  check('zero sessions: the promo does not claim work', /first session/.test(s.promo) && !/habit|work is showing|train like/.test(s.promo));
  check('zero sessions: pace uses the typical session', !s.next.paceIsOwn && s.next.paceXp === 90 && s.next.sessionsToNext === 6 && /typical session/.test(s.next.paceLine));
  check('zero sessions: level 1 Rookie, 500 XP to Level 2', s.level === 1 && s.xpInfo.barLabel === '500 XP to LEVEL 2' && s.xpInfo.into === 0);
  check('zero-session ladder: Rookie current only', s.ladder.map((n) => n.state).join() === 'current,ahead,ahead,ahead,ahead' && s.ladder[0].pips.map((p) => p.state).join() === 'here,todo,todo');
}

// ── the recap ──────────────────────────────────────────────────────────────
{
  check('one session', levelStory(mk([['Fit Mode', 1, 40]])).recap === 'You have finished 1 session, all in Fit Mode.');
  check('all one mode', levelStory(mk([['Fight Focus', 4]])).recap === 'You have finished 4 sessions, all in Fight Mode.');
  const mix = levelStory(mk([['Fit Mode', 3], ['Quick Mission', 2], ['Cardio', 1], ['Fight Focus', 2], ['Combo Coach', 1], ['Practice', 1], ['Combat Conditioning', 2], ['Training Camp', 1], ['Start Here', 1]]));
  check('the buckets are the tier buckets (Quick Mission and Cardio are Fit; Practice is Fight)', mix.recap === 'You have finished 14 sessions: 6 in Fit Mode, 4 in Fight Mode, 2 in Combat Conditioning and 2 in other training.', mix.recap);
  const tapes = levelStory(mk([["Coach's Tapes", 2, 50, { kind: 'fight' }], ["Coach's Tapes", 1, 50, { kind: 'fit' }]]));
  check("Coach's Tapes follow their shelf", tapes.split.find((x) => x.key === 'fight').count === 2 && tapes.split.find((x) => x.key === 'fit').count === 1);
  const stats = mk([['Fit Mode', 5, 70], ['Fight Focus', 3, 90], ['Combat Conditioning', 2, 60], ["Coach's Tapes", 2, 40, { kind: 'fight' }], ['Cardio', 1, 30], ['Mission of the Day', 2, 25]]);
  const s = levelStory(stats);
  const bucketCount = Object.fromEntries(s.split.map((x) => [x.key, x.count]));
  const m = getModeXp(stats);
  check('the split agrees with getModeXp on which rows land where', bucketCount.fit === 6 && bucketCount.fight === 5 && bucketCount.cc === 2 && bucketCount.other === 2 && m.fitXp === 5 * 70 + 30 && m.fightXp === 3 * 90 + 80 && m.ccXp === 120, JSON.stringify([bucketCount, m]));
  check('split percentages add to about 100', Math.abs(s.split.reduce((a, x) => a + x.pct, 0) - 100) <= 2);
  check('most used is the biggest of Fit, Fight, Conditioning', s.facts.find((f) => f.key === 'top').value === 'Fit Mode');
  const tie = levelStory(mk([['Fit Mode', 3], ['Fight Focus', 3]]));
  check('a tie has no winner', tie.facts.find((f) => f.key === 'top').value === 'Even split');
  const onlyOther = levelStory(mk([['Start Here', 2]]));
  check('only other rows: no most-used, no mode named', onlyOther.recap === 'You have finished 2 sessions.' && !onlyOther.facts.some((f) => f.key === 'top'));
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

// ── copy rules ─────────────────────────────────────────────────────────────
{
  const sample = [];
  for (const xp of [0, 250, 700, 1250, 1500, 2600, 3200, 4100, 4960, 5500, 6100, 7050, 7600, 9999, 13000, 20500, 1e9]) {
    sample.push(levelStory(mk([['Fit Mode', 6], ['Fight Focus', 4], ['Combat Conditioning', 1], ['Training Camp', 1]], xp), { streak: 5 }));
    sample.push(levelStory({ xp, sessions: [] }, { streak: 0 }));
  }
  sample.push(levelStory(mk([['Fit Mode', 3]], 20500), { tier: SECRET_TIERS.finalForm }));
  const every = sample.flatMap(copy);
  check('copy is not empty', every.length > 100 && every.every((t) => t.trim().length > 0));
  check('every string is under 160 characters', every.every((t) => t.length < 160), every.filter((t) => t.length >= 160).join(' | '));
  check('every sentence in the page text is under 140 characters', sample.every((s) => [...s.levelLineParts, s.recap, s.promo, s.next.xpLine, s.next.paceLine, s.next.tierLine].every((t) => t.length < 140)));
  const banned = every.filter((t) => BANNED.some((w) => t.toLowerCase().includes(w)));
  check('no franchise or character names', banned.length === 0, banned.join(' | '));
  check('no medical claims', every.every((t) => !/\b(cure|heal|disease|doctor|injury|diagnos|treat|prescri|medical)/i.test(t)));
  check('no more than one exclamation mark per screen', sample.every((s) => copy(s).join('').split('!').length - 1 <= 1));
  check('the exclamation mark lives only in the promotion line', sample.every((s) => !copy(s).filter((t) => t !== s.promo).some((t) => t.includes('!'))));
  check('no double spaces or stray punctuation', every.every((t) => !/\s{2,}|\.\.|,,|\s[.,]/.test(t)), every.filter((t) => /\s{2,}|\.\.|,,|\s[.,]/.test(t)).join(' | '));
  check('second person: no "the athlete"', every.every((t) => !/the athlete/i.test(t)));
  check('promo is always present', sample.every((s) => s.promo && s.promo.length > 20));
  check('the secret tiers only show to people in one', sample.filter((s) => !s.tier.secret).every((s) => !/secret|Peak Physique|Fight Ascendant|Final Form/.test(copy(s).join(' '))));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
