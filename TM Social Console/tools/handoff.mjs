// Hand finished app work to the app chat (HANDOFF.md on `app` explains the
// two-chat setup): a `claude/console-handoff-<date>` branch cut from
// origin/app that carries only app files, never `TM Social Console/`.
//
//   npm run handoff -- --log "3 kick tutorials" [--also <path> …] [-m "commit message"]
//
// Always carries public/static/practice/ and the two Practice data files
// (components/training-mode/practiceData.js, data/practiceLessons.js) from
// this branch, re-locks assets.lock.json for the new posters, and adds a log
// entry to HANDOFF.md. `--also` adds other app paths (app code a delivery
// needs). Refuses when origin/app has commits this branch lacks: merge app
// in first (git merge origin/app), or the copied data files would undo the
// app chat's own changes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(ROOT, '..');
const git = (args, opts = {}) => execFileSync('git', args, { cwd: APP, encoding: 'utf8', ...opts }).trim();
const ok = (args) => { try { git(args, { stdio: 'pipe' }); return true; } catch { return false; } };

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const also = argv.flatMap((a, i) => (argv[i - 1] === '--also' ? [a] : []));
const log = flag('--log');
if (!log) { console.error('usage: npm run handoff -- --log "what this delivers" [--also <path> …] [-m "message"]'); process.exit(1); }

const PATHS = ['public/static/practice', 'components/training-mode/practiceData.js', 'components/training-mode/data/practiceLessons.js', ...also];
if (PATHS.some((p) => p.startsWith('TM Social Console'))) throw new Error('the console folder never goes to app');

git(['fetch', 'origin', 'app']);
if (!ok(['merge-base', '--is-ancestor', 'origin/app', 'HEAD'])) {
  console.error('origin/app has commits this branch lacks. Merge it first (git merge origin/app), then run the handoff again.');
  process.exit(1);
}
const head = git(['rev-parse', 'HEAD']);
const date = new Date().toISOString().slice(0, 10);
let branch = `claude/console-handoff-${date}`;
for (let n = 2; git(['ls-remote', '--heads', 'origin', branch]); n++) branch = `claude/console-handoff-${date}-${n}`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-handoff-'));
git(['worktree', 'add', '-q', '-b', branch, dir, 'origin/app']);
const at = (args) => git(args, { cwd: dir });
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function deliver() {
  at(['checkout', head, '--', ...PATHS]);
  execFileSync('node', ['scripts/lock-assets.mjs', '--write'], { cwd: dir, stdio: 'inherit' });
  at(['add', '-A']);
  const changed = at(['diff', '--cached', '--name-status']).split('\n').filter(Boolean);
  if (!changed.length) { console.log('nothing to hand off: app already has all of it'); return; }

  const videos = changed.filter((l) => /\.mp4$/.test(l)).map((l) => `${l[0] === 'A' ? 'new' : 'updated'} ${path.basename(l.split('\t').pop(), '.mp4')}`);
  const other = changed.filter((l) => !/public\/static\/practice\//.test(l) && !/assets\.lock\.json$/.test(l)).map((l) => l.split('\t').pop());
  const handoff = path.join(dir, 'HANDOFF.md');
  if (fs.existsSync(handoff)) {
    const entry = [`### ${date} · console → app · ${log} (\`${branch}\`)`, '',
      ...(videos.length ? [`- **Videos:** ${videos.join(', ')}.`] : []),
      ...(other.length ? [`- **Files:** ${other.map((f) => `\`${f}\``).join(', ')}.`] : []), '', ''].join('\n');
    fs.writeFileSync(handoff, fs.readFileSync(handoff, 'utf8').replace('## Log\n\n', `## Log\n\n${entry}`));
    at(['add', 'HANDOFF.md']);
  }
  at(['commit', '-q', '-m', flag('-m') ?? `Console handoff ${date}: ${log}`]);
  for (let i = 0; ; i++) {
    try { at(['push', '-u', 'origin', branch]); break; } catch (e) {
      if (i === 3) throw e;
      pause(2000 * 2 ** i);
    }
  }
  console.log(`pushed ${branch}: ${changed.length} file(s). The app chat (or the owner) merges it into app.`);
}
try { deliver(); } finally { git(['worktree', 'remove', '--force', dir]); }
