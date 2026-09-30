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

// Which plate for which moment:
//   gain  · fit / cardio → iron (dumbbells); fight → crown; anything else → blaze
//   loss  · fight → gloves; fit / cardio → blaze; a HARD-tier loss or a camp
//           stage fail → reaper, the dramatic one
export function pickXpBanner(kind, { mode = 'fit', tier = 'normal', camp = false } = {}) {
  const fight = mode === 'fight';
  const byId = (list, id) => list.find(b => b.id === id) || list[0];
  if (kind === 'loss') {
    if (camp || String(tier).toLowerCase() === 'hard') return byId(XP_BANNERS.loss, 'reaper');
    return byId(XP_BANNERS.loss, fight ? 'gloves' : 'blaze');
  }
  if (fight) return byId(XP_BANNERS.gain, 'crown');
  if (mode === 'fit' || mode === 'cardio') return byId(XP_BANNERS.gain, 'iron');
  return byId(XP_BANNERS.gain, 'blaze');
}

// Warm the browser cache so the first popup does not appear as an empty box.
export function preloadXpBanners() {
  if (typeof Image === 'undefined') return;
  [...XP_BANNERS.gain, ...XP_BANNERS.loss].forEach(b => { const im = new Image(); im.src = b.src; });
}
