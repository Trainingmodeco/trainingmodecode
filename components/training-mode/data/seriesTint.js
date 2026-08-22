// Per-saga colour identity for the Arcade ladder — a STOPGAP for the missing
// campaign-specific stage art.
//
// Every campaign's ladder draws from the same ten images
// (/static/series/stages/stage-1..10.webp), keyed only on the stage's position,
// so climbing The Grappler is pixel-identical to climbing Blue Blur. Until each
// saga gets its own art, a hue shift on the shared art at least makes each
// ladder read as a different PLACE. Zero new assets, and every value here drops
// out the moment real art lands.
//
// Deliberately NOT applied to borders, badges or stars: those encode STATE
// (locked / current / cleared / boss / elite), and state legibility outranks
// flavour. The tint only touches the artwork behind them and the branch lines.
//
// The shared art is violet (~275°), and hue-rotate is relative, so the numbers
// below are "degrees away from violet" — e.g. +130 lands on gold, -60 on blue.

const VIOLET_FALLBACK = { deg: 0, sat: 1, line: 'rgba(168,85,247,0.3)', wash: 'rgba(5,0,12,0.75)' };

export const SERIES_TINT = {
  // Gold / heroic
  'one-punch-protocol':        { deg: 130, sat: 1.2,  line: 'rgba(253,224,71,0.30)',  wash: 'rgba(14,9,0,0.75)' },
  'the-dragon':                { deg: 125, sat: 1.05, line: 'rgba(250,204,21,0.28)',  wash: 'rgba(14,9,0,0.75)' },
  'hyperbolic-time-chamber':   { deg: 115, sat: 1.1,  line: 'rgba(251,191,36,0.28)',  wash: 'rgba(16,8,0,0.75)' },
  // Orange / ember
  'the-contender':             { deg: 110, sat: 1.2,  line: 'rgba(249,115,22,0.30)',  wash: 'rgba(18,6,0,0.75)' },
  // Red / crimson
  'baki-grappler':             { deg: 95,  sat: 1.15, line: 'rgba(239,68,68,0.30)',   wash: 'rgba(18,2,4,0.75)' },
  'the-wall-crawler':          { deg: 90,  sat: 1.2,  line: 'rgba(244,63,94,0.30)',   wash: 'rgba(18,2,6,0.75)' },
  'hero-hunter-protocol':      { deg: 85,  sat: 1.25, line: 'rgba(220,38,38,0.32)',   wash: 'rgba(16,1,3,0.78)' },
  'berserk-struggler':         { deg: 80,  sat: 0.9,  line: 'rgba(153,27,27,0.32)',   wash: 'rgba(12,1,2,0.8)' },
  // Magenta
  'ultra-ego-style':           { deg: 35,  sat: 1.3,  line: 'rgba(217,70,239,0.30)',  wash: 'rgba(16,2,20,0.75)' },
  // Cool / blue / silver
  'dark-knight-protocol':      { deg: -55, sat: 0.85, line: 'rgba(96,165,250,0.26)',  wash: 'rgba(2,6,16,0.8)' },
  'blue-blur-speed-protocol':  { deg: -60, sat: 1.3,  line: 'rgba(59,130,246,0.32)',  wash: 'rgba(0,5,18,0.75)' },
  'ultra-instinct-protocol':   { deg: -85, sat: 0.7,  line: 'rgba(165,243,252,0.26)', wash: 'rgba(2,10,14,0.75)' },
  // Green
  'demon-back-protocol':       { deg: -145, sat: 1.15, line: 'rgba(34,197,94,0.28)',  wash: 'rgba(1,12,5,0.75)' },
};

export function seriesTint(id) {
  return SERIES_TINT[id] || VIOLET_FALLBACK;
}

// The CSS filter for a saga's stage art. Returns undefined for the untinted
// fallback so the style prop stays clean on sagas with no entry.
export function tintFilter(id) {
  const t = seriesTint(id);
  if (!t.deg && t.sat === 1) return undefined;
  return `hue-rotate(${t.deg}deg) saturate(${t.sat})`;
}
