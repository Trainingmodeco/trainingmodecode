import { WEBP_FILES } from '../data/webpManifest';

// Warms the browser cache for art the user is about to see (hub banners,
// saga posters, shared backdrops) so screens open with images already
// loaded. Runs once, shortly after first paint, at low priority.
const WEBP_SET = new Set(WEBP_FILES);

function preferWebp(src) {
  const m = src.match(/^(.+)\.(png|jpe?g)$/i);
  const webp = m ? `${m[1]}.webp` : null;
  return webp && WEBP_SET.has(webp) ? webp : src;
}

// Ordered by how soon the user is likely to hit them.
const CRITICAL_ART = [
  // Every screen (PhoneFrame backdrop)
  '/static/app-bg.png',
  // Home hero cards (first screen after splash)
  '/static/bout-bg.png',
  '/static/hub/arcade-continue-bg.webp',
  '/static/logo-mark.png',
  // Train hub banners
  '/static/hub/fight.png',
  '/static/hub/fit.png',
  '/static/hub/arcade.png',
  '/static/hub/combat.png',
  // Fight-mode ring backdrop (setups)
  '/static/fight-ring-bg.png',
  // Saga carousel posters
  '/static/series/posters/one-punch.png',
  '/static/series/posters/dark-knight.png',
  '/static/series/posters/demon-back.png',
  '/static/series/posters/ultra-instinct.png',
  '/static/series/posters/ultra-ego.png',
  '/static/series/posters/hyperbolic-gravity.png',
  '/static/series/posters/blue-blur.png',
];

let started = false;

export function preloadCriticalArt() {
  if (started || typeof window === 'undefined') return;
  started = true;

  let i = 0;
  const loadNext = () => {
    if (i >= CRITICAL_ART.length) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => setTimeout(loadNext, 60); // stagger, stay off the main path
    img.src = preferWebp(CRITICAL_ART[i++]);
  };

  const kickoff = () => { loadNext(); loadNext(); }; // two lanes
  if ('requestIdleCallback' in window) window.requestIdleCallback(kickoff, { timeout: 4000 });
  else setTimeout(kickoff, 1200);
}
