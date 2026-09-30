// XP verdict banners — pixel-art plates with an empty panel at the bottom
// for the amount. Three for a gain, three for a loss; the popup cycles
// through them so the same plate does not show twice in a row.
//
// `panel` is where the empty box sits, as fractions of the image: the text
// is centred on `cy` and kept inside `w` of the width.
export const XP_BANNERS = {
  gain: [
    { id: 'crown', src: '/static/xp/gain-crown.webp', panel: { cy: 0.845, w: 0.58 } },
    { id: 'blaze', src: '/static/xp/gain-blaze.webp', panel: { cy: 0.865, w: 0.66 } },
    { id: 'iron',  src: '/static/xp/gain-iron.webp',  panel: { cy: 0.848, w: 0.60 } },
  ],
  loss: [
    { id: 'blaze',  src: '/static/xp/fail-blaze.webp',  panel: { cy: 0.868, w: 0.62 } },
    { id: 'gloves', src: '/static/xp/fail-gloves.webp', panel: { cy: 0.800, w: 0.56 } },
    { id: 'reaper', src: '/static/xp/fail-reaper.webp', panel: { cy: 0.840, w: 0.60 } },
  ],
};

// The n-th verdict of a kind gets the n-th plate, round-robin.
export function xpBannerFor(kind, n = 0) {
  const list = XP_BANNERS[kind === 'loss' ? 'loss' : 'gain'];
  return list[((Number(n) || 0) % list.length + list.length) % list.length];
}

// Warm the browser cache so the first popup does not appear as an empty box.
export function preloadXpBanners() {
  if (typeof Image === 'undefined') return;
  [...XP_BANNERS.gain, ...XP_BANNERS.loss].forEach(b => { const im = new Image(); im.src = b.src; });
}
