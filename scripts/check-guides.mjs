// Every step of every guide — the intro tour and each screen's "?" guide —
// must land on something that exists: a routed screen (tour steps) and a
// data-guide anchor. A missing anchor stalls the guide ~6s then skips the
// step, and neither tsc nor lint can see it.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Resolved from this script, so it runs the same locally and in CI.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'components', 'training-mode');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const src = walk(ROOT).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const router = fs.readFileSync(path.join(ROOT, 'ScreenRouter.jsx'), 'utf8');
const screens = new Set([...router.matchAll(/screen === '([a-z_0-9]+)'/g)].map((m) => m[1]));

const anchors = new Set();
const add = (re) => { for (const m of src.matchAll(re)) anchors.add(m[1]); };
add(/data-guide="([a-z0-9-]+)"/gi);
add(/dataGuide="([a-z0-9-]+)"/gi);
add(/\bguide: '([a-z0-9-]+)'/gi);
add(/\bguide="([a-z0-9-]+)"/gi);
add(/\bhelpGuide="([a-z0-9-]+)"/gi);
// Set through a spread: {...(cond ? { 'data-guide': 'tc-current' } : {})}
add(/'data-guide': '([a-z0-9-]+)'/gi);
for (const line of src.split('\n')) {
  if (!/data-guide=\{/.test(line)) continue;
  for (const m of line.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/gi)) anchors.add(m[1]);
}
// Built from templates: FitModeHub rows ('fit-' + key) and ModeTabs (mode-${id}).
['fit-quick', 'fit-builder', 'fit-programs', 'mode-fit', 'mode-fight'].forEach((a) => anchors.add(a));

const { SCREEN_GUIDES } = await import(pathToFileURL(path.join(ROOT, 'shared/screenGuides.js')).href);

let bad = 0, steps = 0;
for (const [key, list] of Object.entries(SCREEN_GUIDES)) {
  list.forEach((s, i) => {
    steps++;
    const missScreen = s.screen && !screens.has(s.screen);
    const missAnchor = s.target && !anchors.has(s.target);
    if (missScreen || missAnchor) {
      bad++;
      console.log(`BROKEN  ${key}[${i}] "${s.title}"${missScreen ? `  screen=${s.screen}?` : ''}${missAnchor ? `  target=${s.target}?` : ''}`);
    }
  });
}
console.log(`${Object.keys(SCREEN_GUIDES).length} guides, ${steps} steps — ${bad ? `${bad} BROKEN` : 'every screen and anchor resolves'}`);
process.exit(bad ? 1 : 0);
