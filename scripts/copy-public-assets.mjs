import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Copy the FULL public/ folder (including public/assets) into dist so that
// every static image referenced by the app is available in the web build.
// expo export writes to dist first; this runs afterwards and merges public/
// on top of it without clobbering the generated bundle.

const publicDir = join(process.cwd(), 'public');
const distDir = join(process.cwd(), 'dist');

if (!existsSync(publicDir)) {
  console.error(`[copy-public-assets] Missing public folder: ${publicDir}`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.warn(`[copy-public-assets] dist folder not found, creating it: ${distDir}`);
  mkdirSync(distDir, { recursive: true });
}

// Copy each top-level entry under public/ into dist/, recursively.
const entries = readdirSync(publicDir, { withFileTypes: true });
let copied = 0;

for (const entry of entries) {
  const src = join(publicDir, entry.name);
  const dest = join(distDir, entry.name);
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-public-assets] Copied ${entry.name} -> dist/${entry.name}`);
  copied += 1;
}

console.log(`[copy-public-assets] Done. Copied ${copied} top-level entr${copied === 1 ? 'y' : 'ies'} from public/ into dist/ (including public/static).`);

// Collect every generated bundle file so sw.js can precache the WHOLE build
// atomically at install. A running session then always lazy-loads its own
// chunks from its own cache, even after a newer deploy replaced the files on
// the server — this is the fix for mixed-build "Requiring unknown module N".
function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
const expoDir = join(distDir, '_expo');
const precache = existsSync(expoDir)
  ? walk(expoDir).filter((p) => /\.(js|css)$/i.test(p)).map((p) => `/_expo/${p}`)
  : [];

// Stamp a per-build id into dist/sw.js so every deploy ships a byte-new
// worker: the browser installs it, it WAITS (no mid-session takeover), and
// the update activates with a fresh cache on the next app launch.
const swPath = join(distDir, 'sw.js');
if (existsSync(swPath)) {
  const buildId = Date.now().toString(36);
  let sw = readFileSync(swPath, 'utf8').replace('__TM_BUILD_ID__', buildId);
  if (precache.length) {
    sw = sw.replace("'__TM_PRECACHE__'", precache.map((p) => JSON.stringify(p)).join(','));
  }
  writeFileSync(swPath, sw);
  console.log(`[copy-public-assets] Stamped sw.js build id ${buildId} + ${precache.length} precache bundle file(s).`);
}

// PWA: inject the manifest link, theme-color, and service-worker registration
// into the Expo-generated index.html (idempotent).
const indexPath = join(distDir, 'index.html');
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8');
  if (!html.includes('rel="manifest"')) {
    const headTags = '<link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#080012" /><link rel="apple-touch-icon" href="/static/brand/icon-192.png" />';
    html = html.replace('</head>', `${headTags}</head>`);
  }
  if (!html.includes('tm-self-heal')) {
    // Last-resort recovery for a client that still hits a stale-chunk /
    // mixed-build error ("Requiring unknown module", failed dynamic import):
    // purge caches and reload ONCE per session, which pulls a fresh,
    // self-consistent build. Registered in <head> so it's armed before the
    // bundle runs; the one-shot flag auto-clears after 15s of healthy runtime.
    const healScript = '<script id="tm-self-heal">(function(){var K="tm-self-healed";function heal(m){if(!/Requiring unknown module|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i.test(String(m||"")))return;try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,"1")}catch(e){}var r=function(){location.reload()};if(window.caches&&caches.keys){caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).then(r,r)}else{r()}}addEventListener("error",function(e){heal(e&&e.message)},true);addEventListener("unhandledrejection",function(e){var x=e&&e.reason;heal(x&&(x.message||x))});addEventListener("load",function(){setTimeout(function(){try{sessionStorage.removeItem(K)}catch(e){}},15000)});})();</script>';
    html = html.replace('</head>', `${healScript}</head>`);
  }
  // Beta TM-26 / TM-22 / ND-12 — real title, meta description, Open Graph and
  // Twitter cards, and a modern viewport. app/+html.tsx carries the same tags
  // but the export provably ignores it (dist shipped a generic title and the
  // legacy shrink-to-fit viewport), so they are injected here, in the pipeline
  // that demonstrably reaches production.
  if (!html.includes('property="og:title"')) {
    const SITE = 'https://apptrainingmode.com';
    const TITLE = 'Training Mode — Fight & Fit Workout Trainer';
    const DESC = 'Training Mode turns combat and strength training into a game. Build custom workouts, run Fight Mode and Fit Mode sessions, and level up with every rep.';
    const IMAGE = `${SITE}/social/training-mode-share-card-template.png`;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
    html = html.replace(
      /<meta name="viewport"[^>]*>/,
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    );
    const seoTags = [
      `<meta name="description" content="${DESC}" />`,
      `<link rel="canonical" href="${SITE}/" />`,
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="Training Mode" />',
      `<meta property="og:title" content="${TITLE}" />`,
      `<meta property="og:description" content="${DESC}" />`,
      `<meta property="og:url" content="${SITE}/" />`,
      `<meta property="og:image" content="${IMAGE}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${TITLE}" />`,
      `<meta name="twitter:description" content="${DESC}" />`,
      `<meta name="twitter:image" content="${IMAGE}" />`,
    ].join('');
    html = html.replace('</head>', `${seoTags}</head>`);
  }
  if (!html.includes('serviceWorker.register')) {
    // updateViaCache:'none' + an explicit update() make installed PWAs check
    // for a new worker on every launch; the new worker then waits until the
    // next launch to activate (no skipWaiting in sw.js).
    const swScript = '<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(function(reg){reg.update().catch(function(){});}).catch(function(){});});}</script>';
    html = html.replace('</body>', `${swScript}</body>`);
  }
  writeFileSync(indexPath, html);
  console.log('[copy-public-assets] Injected PWA manifest + service worker into index.html.');
}
