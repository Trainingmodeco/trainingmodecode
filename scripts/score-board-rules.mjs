// The score board's server rows, generated from the app's own data
// (data/scoreBoardRules.js allBoards(), retention/scoreBoards.js house names):
//
//   - board_rules: one row per board the server accepts (key, more/less, unit,
//     cap, min_seconds, the twelve house scores and which names they use);
//   - board_house: the house names and levels (CPU rows: gym gear, never people);
//   - board_name_blocklist: the reserved names (every house name, CPU, YOU,
//     COACH: exact) and the words no display name may contain.
//
//   node --import ./scripts/extensionless-loader-register.mjs scripts/score-board-rules.mjs [--check] [--out <file.sql>]
//
// With no option it rewrites the generated block of the migration
// (supabase/migrations/*_create_score_boards.sql, between the BEGIN/END
// GENERATED lines). Once that migration is applied on the live database, run
// it with --out supabase/migrations/<new timestamp>_update_score_board_rules.sql
// instead: every row is an upsert, so a new migration of these lines brings the
// server up to date with new missions or changed paces. --check exits 1 when
// the migration's block differs from what the app's data gives now (the unit
// test runs it, so content drift fails `npm run test:scoreboard`).
import fs from 'node:fs';
import path from 'node:path';

globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage, addEventListener() {}, removeEventListener() {} };

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = await import(path.join(root, 'components/training-mode/data/scoreBoardRules.js'));
const SB = await import(path.join(root, 'components/training-mode/retention/scoreBoards.js'));

export const BEGIN = '-- BEGIN GENERATED (scripts/score-board-rules.mjs: do not edit by hand)';
export const END = '-- END GENERATED';

// The name filter's key for a word: lower case, look-alikes mapped (0 o, 1 i,
// 3 e, 4 a, 5 s, 7 t, @ a, $ s), everything but a to z dropped. The SQL
// function public.board_name_key does exactly this to a display name.
export const nameKey = (s) => String(s).toLowerCase().replace(/[013457@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' })[c]).replace(/[^a-z]/g, '');

// Reserved whole names, and the words a name may not contain anywhere. A
// short list to start with, kept clear of words that sit inside ordinary
// names (no "rape" for Grape, no "cock" for Hancock): moderation adds to it
// from the dashboard (board_name_blocklist, service role only).
const RESERVED_EXACT = ['CPU', 'YOU', 'COACH'];
const RESERVED_WITHIN = ['trainingmode', 'admin', 'official', 'support', 'moderator', 'staff'];
const BLOCKED_WITHIN = [
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'porn', 'rapist',
  'nazi', 'hitler', 'kkk', 'nigg', 'fagg', 'retard', 'tranny', 'chink', 'kike', 'wetback', 'dyke', 'twat', 'wank',
  'bastard', 'asshole', 'molest', 'pedo', 'killyou', 'suicide',
];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function generatedSql() {
  const rules = R.allBoards();
  const lines = [BEGIN, `-- ${rules.length} boards, generated from the app's data.`];
  lines.push('insert into public.board_house (kind, rung, name, level) values');
  const house = [];
  for (const kind of Object.keys(SB.HOUSE_NAMES)) SB.HOUSE_NAMES[kind].forEach((name, i) => house.push(`  (${q(kind)}, ${i + 1}, ${q(name)}, ${SB.HOUSE_LEVELS[i]})`));
  lines.push(`${house.join(',\n')}\non conflict (kind, rung) do update set name = excluded.name, level = excluded.level;`);
  lines.push('insert into public.board_rules (board, direction, unit, cap, min_seconds, house, house_kind) values');
  lines.push(`${rules.map((r) => `  (${q(r.board)}, ${q(r.direction)}, ${q(r.unit)}, ${r.cap}, ${r.minSeconds}, '{${r.house.join(',')}}', ${q(r.houseKind)})`).join(',\n')}`);
  lines.push('on conflict (board) do update set direction = excluded.direction, unit = excluded.unit, cap = excluded.cap,\n  min_seconds = excluded.min_seconds, house = excluded.house, house_kind = excluded.house_kind;');
  const words = new Map();
  for (const n of [...RESERVED_EXACT, ...Object.values(SB.HOUSE_NAMES).flat()]) words.set(nameKey(n), true);
  for (const w of [...RESERVED_WITHIN, ...BLOCKED_WITHIN]) if (!words.has(nameKey(w))) words.set(nameKey(w), false);
  lines.push('insert into public.board_name_blocklist (word, exact) values');
  lines.push(`${[...words].map(([w, exact]) => `  (${q(w)}, ${exact})`).join(',\n')}\non conflict (word) do nothing;`);
  lines.push(END);
  return lines.join('\n');
}

export function migrationPath() {
  const dir = path.join(root, 'supabase/migrations');
  const f = fs.readdirSync(dir).find((n) => /_create_score_boards\.sql$/.test(n));
  return f ? path.join(dir, f) : null;
}

export function spliced(sql, block) {
  const a = sql.indexOf(BEGIN), b = sql.indexOf(END);
  if (a < 0 || b < a) throw new Error('the migration has no generated block');
  return sql.slice(0, a) + block + sql.slice(b + END.length);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const block = generatedSql();
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  if (out) {
    fs.writeFileSync(out, `-- The score board's rules, regenerated from the app's data (scripts/score-board-rules.mjs).\n-- Every row is an upsert: apply after _create_score_boards.\n\n${block}\n`);
    console.log(`wrote ${out}`);
  } else {
    const file = migrationPath();
    if (!file) { console.error('no *_create_score_boards.sql migration'); process.exit(2); }
    const sql = fs.readFileSync(file, 'utf8');
    const next = spliced(sql, block);
    if (args.includes('--check')) {
      if (next !== sql) { console.error(`${path.basename(file)}: the generated block is out of date (run scripts/score-board-rules.mjs)`); process.exit(1); }
      console.log(`${path.basename(file)}: generated block up to date (${R.allBoards().length} boards)`);
    } else {
      fs.writeFileSync(file, next);
      console.log(`${path.basename(file)}: generated block written (${R.allBoards().length} boards)`);
    }
  }
}
