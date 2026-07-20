// LT-4 — renders the result card as a real IMAGE instead of sharing plain text.
//
// PWA constraint, stated plainly: Instagram/Facebook/TikTok "share to Stories"
// SDKs are native-app mechanisms. From the web we can produce the real card and
// hand it to the OS share sheet as a file (which those apps accept as a normal
// share target) or save it to the camera roll. Direct Stories composition
// arrives with the native wrapper; nothing here has to change when it does.

const GOLD = '#fde047';
const VIOLET = '#b06aff';
const TEAL = '#2dd4bf';

// Both cards are designed posters — wordmark, characters, QR, mode cards and
// footer are baked into the art. We only fill the empty panel each one leaves
// near the bottom. Panel bounds were measured by sampling the assets rather
// than eyeballed, and are normalised so a re-export at any resolution drops
// straight in. A trophy sits in each panel's top-right; nothing centred
// reaches it, but keep that in mind before widening the first line.
const TEMPLATES = {
  story: {
    src: '/social/training_mode_share_story_1.webp',
    panel: { left: 0.0616, right: 0.9394, top: 0.7075, bottom: 0.8816 },
  },
  post: {
    src: '/social/training_mode_share_post_2.webp',
    panel: { left: 0.0446, right: 0.9403, top: 0.7454, bottom: 0.9037 },
  },
};

// The two panels are very different shapes — story gets ~334px of height at
// export size, post only ~214px — so each gets its own type scale rather than
// one set of numbers stretched across both.
const PANEL_SCALE = {
  story: { head: 38, sub: 22, headDrop: 34, subDrop: 30, bandDrop: 20, cellH: 100, val: 38, lab: 14, verGap: 16, verScale: 0.85 },
  post:  { head: 30, sub: 18, headDrop: 26, subDrop: 24, bandDrop: 14, cellH: 76,  val: 30, lab: 12, verGap: 10, verScale: 0.70 },
};

// Sizes follow the artwork: the story asset is 9:16 and the post asset is 4:5
// (1122x1402), not square — so POST exports at 1080x1350, which is also the
// tallest shape Instagram's feed accepts without cropping.
export const FORMATS = {
  story: { w: 1080, h: 1920, label: 'STORY', sub: '9:16 · IG / TikTok' },
  post: { w: 1080, h: 1350, label: 'POST', sub: '4:5 · Feed' },
};

// Every vertical measurement in one place per format. The first cut scattered
// story/post ternaries through the draw code and the 1:1 stack silently ran
// past the canvas — the stats row landed on top of the footer.
const LAYOUT = {
  story: {
    // 1920 tall, but IG's own chrome covers roughly the top and bottom 250px.
    safeTop: 250, footerUp: 200,
    wordmark: 34, wordmarkGap: 92,
    eyebrow: 68, eyebrowGap: 46,
    title: 52, titleGap: 46,
    avatarR: 210, avatarGapBefore: 78, avatarGapAfter: 82,
    tier: 44, tierGap: 52,
    subtitle: 34, subtitleGap: 70,
    xpW: 560, xpH: 150, xpGap: 46, xpNum: 96, xpLabel: 26,
    pillW: 300, pillH: 140, pillGap: 48,
    verifiedScale: 1, verifiedGap: 100,
    footer: 34, footerSub: 26, footerSubGap: 48,
  },
  post: {
    safeTop: 60, footerUp: 74,
    wordmark: 30, wordmarkGap: 56,
    eyebrow: 56, eyebrowGap: 34,
    title: 44, titleGap: 38,
    avatarR: 120, avatarGapBefore: 34, avatarGapAfter: 44,
    tier: 38, tierGap: 40,
    subtitle: 28, subtitleGap: 46,
    xpW: 460, xpH: 104, xpGap: 26, xpNum: 68, xpLabel: 20,
    pillW: 250, pillH: 104, pillGap: 24,
    verifiedScale: 0.85, verifiedGap: 60,
    footer: 28, footerSub: 20, footerSubGap: 38,
  },
};

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, { font, color, align = 'center', letterSpacing, shadow }) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing;
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 28;
  }
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Draw the shared background: near-black violet, two radial glows, a faint grid.
function drawBackground(ctx, w, h) {
  ctx.fillStyle = '#080012';
  ctx.fillRect(0, 0, w, h);

  const top = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.62);
  top.addColorStop(0, 'rgba(168,85,247,0.30)');
  top.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);

  const bottom = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.55);
  bottom.addColorStop(0, 'rgba(217,70,239,0.20)');
  bottom.addColorStop(1, 'rgba(217,70,239,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(168,85,247,0.07)';
  ctx.lineWidth = 2;
  const grid = 72;
  ctx.beginPath();
  for (let x = 0; x <= w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}

function drawAvatar(ctx, img, cx, cy, r) {
  // Glow ring behind the portrait.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.shadowColor = 'rgba(253,224,71,0.65)';
  ctx.shadowBlur = 46;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#150a26';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    // cover-fit, biased to the upper part of the portrait (faces sit high)
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - r - (dh - r * 2) * 0.18, dw, dh);
  }
  ctx.restore();
}

// Step a font down until it fits the width it's given. The panels are fixed
// and the strings are user data (a long tier name, a four-digit XP number), so
// nothing here is allowed to assume it fits.
function fitSize(ctx, str, maxW, size, weight, family, letterSpacing) {
  let s = size;
  ctx.save();
  for (; s > 8; s--) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing;
    if (ctx.measureText(str).width <= maxW) break;
  }
  ctx.restore();
  return s;
}

function drawStatPill(ctx, x, y, w, h, value, label, opts = {}) {
  const { highlight = false, valueSize, labelSize } = opts;
  ctx.save();
  roundRect(ctx, x, y, w, h, Math.min(22, h * 0.22));
  ctx.fillStyle = highlight ? 'rgba(253,224,71,0.12)' : 'rgba(8,2,18,0.86)';
  ctx.fill();
  ctx.strokeStyle = highlight ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.35)';
  ctx.lineWidth = highlight ? 3 : 2;
  ctx.stroke();
  ctx.restore();

  const vSize = valueSize || Math.round(h * 0.34);
  const lSize = labelSize || Math.round(h * 0.16);
  const pad = w * 0.12;
  const v = fitSize(ctx, value, w - pad, vSize, 900, 'Orbitron, sans-serif');
  const l = fitSize(ctx, label, w - pad, lSize, 700, 'Orbitron, sans-serif', '2px');

  text(ctx, value, x + w / 2, y + h * 0.52, {
    font: `900 ${v}px Orbitron, sans-serif`,
    color: highlight ? GOLD : '#fff',
    shadow: highlight ? 'rgba(253,224,71,0.45)' : undefined,
  });
  text(ctx, label, x + w / 2, y + h * 0.80, {
    font: `700 ${l}px Orbitron, sans-serif`,
    color: highlight ? '#facc15' : '#c4a4d8', letterSpacing: '2px',
  });
}

function drawVerified(ctx, cx, y, scale = 1) {
  const label = 'VERIFIED SESSION';
  const fontSize = Math.round(24 * scale);
  const h = 62 * scale;
  const shieldBox = 52 * scale;   // room for the glyph + its breathing space
  const padX = 30 * scale;

  // Size the pill to its contents — a fixed width clipped the label and let
  // the shield sit on top of the first letter.
  ctx.save();
  ctx.font = `800 ${fontSize}px Orbitron, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  const textW = ctx.measureText(label).width;
  ctx.restore();

  const w = shieldBox + textW + padX * 2;
  const x = cx - w / 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(45,212,191,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,212,191,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // shield glyph, centred in its own box at the left of the pill
  const sx = x + padX + shieldBox / 2;
  const sy = y + h / 2;
  const s = 15 * scale;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx, sy - s);
  ctx.lineTo(sx + s * 0.85, sy - s * 0.55);
  ctx.lineTo(sx + s * 0.85, sy + s * 0.2);
  ctx.quadraticCurveTo(sx + s * 0.85, sy + s * 0.9, sx, sy + s);
  ctx.quadraticCurveTo(sx - s * 0.85, sy + s * 0.9, sx - s * 0.85, sy + s * 0.2);
  ctx.lineTo(sx - s * 0.85, sy - s * 0.55);
  ctx.closePath();
  ctx.fillStyle = TEAL;
  ctx.fill();
  ctx.restore();

  text(ctx, label, x + padX + shieldBox, y + h * 0.64, {
    font: `800 ${fontSize}px Orbitron, sans-serif`, color: TEAL, letterSpacing: '2px', align: 'left',
  });
}

// Fill the poster's empty panel. Everything else on these cards is artwork, so
// this is the only place session data appears.
//
// The panels are wide and short — the post one is barely 214px tall at export
// size — so XP rides in the stat band as a highlighted cell rather than
// getting its own hero block. That keeps the whole readout to three bands and
// lets the same shape serve both cards.
function drawPanel(ctx, W, H, data, fmt) {
  const t = TEMPLATES[fmt];
  const s = PANEL_SCALE[fmt];
  const box = {
    x: t.panel.left * W,
    y: t.panel.top * H,
    w: (t.panel.right - t.panel.left) * W,
    h: (t.panel.bottom - t.panel.top) * H,
  };
  const cx = box.x + box.w / 2;

  const verH = 62 * s.verScale;
  const contentH = s.headDrop + s.subDrop + s.bandDrop + s.cellH + s.verGap + (data.verified ? verH : 0);
  let y = box.y + Math.max(8, (box.h - contentH) / 2);

  // Headline
  const headline = (data.eyebrow || 'MISSION COMPLETE').toUpperCase();
  const headSize = fitSize(ctx, headline, box.w * 0.72, s.head, 900, 'Orbitron, sans-serif', '3px');
  y += s.headDrop;
  text(ctx, headline, cx, y, {
    font: `900 ${headSize}px Orbitron, sans-serif`, color: GOLD,
    letterSpacing: '3px', shadow: 'rgba(253,224,71,0.55)',
  });

  // One line for what was trained and who you are now — two separate lines
  // don't fit the post panel.
  const bits = [data.subtitle, `LEVEL ${data.level ?? 1}`, (data.tierLabel || '').toUpperCase()].filter(Boolean);
  const subline = bits.join('  ·  ');
  const subSize = fitSize(ctx, subline, box.w * 0.9, s.sub, 600, 'Rajdhani, sans-serif');
  y += s.subDrop;
  text(ctx, subline, cx, y, { font: `600 ${subSize}px Rajdhani, sans-serif`, color: '#c4a4d8' });

  // Band: XP first and highlighted, then the running totals.
  y += s.bandDrop;
  const gap = Math.round(box.w * 0.016);
  const cellW = (box.w - gap * 3) / 4;
  let px = box.x;
  const cell = (value, label, highlight) => {
    drawStatPill(ctx, px, y, cellW, s.cellH, value, label, { highlight, valueSize: s.val, labelSize: s.lab });
    px += cellW + gap;
  };
  cell(`+${data.xp ?? 0}`, 'XP EARNED', true);
  cell(String(data.level ?? 1), 'LEVEL');
  cell(String(data.streak ?? 0), 'DAY STREAK');
  cell(String(data.sessions ?? 0), 'SESSIONS');

  y += s.cellH + s.verGap;
  if (data.verified) drawVerified(ctx, cx, y, s.verScale);
}

/**
 * Render the share card. Returns a Blob (image/png).
 * data: { eyebrow, title, subtitle, xp, level, tierLabel, tierImg, streak, sessions, verified }
 */
export async function renderShareCard({ format = 'story', data = {} }) {
  const F = FORMATS[format] || FORMATS.story;
  const { w, h } = F;
  const story = format === 'story';

  // Fonts must be resolved before measuring/drawing or canvas silently
  // substitutes a system face.
  try { await document.fonts.ready; } catch { /* no font API — proceed */ }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Both formats ride their designed poster. If the art ever fails to load we
  // fall through to the generated layout rather than shipping a blank card.
  const tpl = TEMPLATES[format];
  if (tpl) {
    const template = await loadImage(tpl.src);
    if (template) {
      ctx.drawImage(template, 0, 0, w, h);
      drawPanel(ctx, w, h, data, format);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }
  }

  drawBackground(ctx, w, h);

  const avatar = await loadImage(data.tierImg);
  const cx = w / 2;
  const L = LAYOUT[story ? 'story' : 'post'];

  let y = L.safeTop;

  text(ctx, 'TRAINING MODE', cx, y, { font: `800 ${L.wordmark}px Orbitron, sans-serif`, color: '#c4a4d8', letterSpacing: '10px' });
  y += L.wordmarkGap;

  text(ctx, (data.eyebrow || 'MISSION COMPLETE').toUpperCase(), cx, y, {
    font: `900 ${L.eyebrow}px Orbitron, sans-serif`, color: GOLD, letterSpacing: '3px', shadow: 'rgba(253,224,71,0.55)',
  });
  y += L.eyebrowGap;

  if (data.title) {
    text(ctx, data.title, cx, y + L.titleGap, { font: `900 ${L.title}px Orbitron, sans-serif`, color: '#fff' });
    y += L.titleGap;
  }

  y += L.avatarR + L.avatarGapBefore;
  drawAvatar(ctx, avatar, cx, y, L.avatarR);
  y += L.avatarR + L.avatarGapAfter;

  text(ctx, `LEVEL ${data.level ?? 1} · ${(data.tierLabel || 'FIGHTER').toUpperCase()}`, cx, y, {
    font: `900 ${L.tier}px Orbitron, sans-serif`, color: GOLD, letterSpacing: '2px',
  });
  y += L.tierGap;

  if (data.subtitle) {
    text(ctx, data.subtitle, cx, y, { font: `600 ${L.subtitle}px Rajdhani, sans-serif`, color: '#c4a4d8' });
    y += L.subtitleGap;
  }

  // XP hero
  ctx.save();
  roundRect(ctx, cx - L.xpW / 2, y, L.xpW, L.xpH, 28);
  const g = ctx.createLinearGradient(cx - L.xpW / 2, y, cx + L.xpW / 2, y + L.xpH);
  g.addColorStop(0, 'rgba(253,224,71,0.20)');
  g.addColorStop(1, 'rgba(8,2,18,0.6)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(253,224,71,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  text(ctx, `+${data.xp ?? 0}`, cx, y + L.xpH * 0.62, {
    font: `900 ${L.xpNum}px Orbitron, sans-serif`, color: GOLD, shadow: 'rgba(253,224,71,0.5)',
  });
  text(ctx, 'XP EARNED', cx, y + L.xpH * 0.88, { font: `700 ${L.xpLabel}px Orbitron, sans-serif`, color: '#facc15', letterSpacing: '5px' });
  y += L.xpH + L.xpGap;

  // Stats row
  const gap = 20;
  const rowW = L.pillW * 3 + gap * 2;
  let px = cx - rowW / 2;
  drawStatPill(ctx, px, y, L.pillW, L.pillH, String(data.level ?? 1), 'LEVEL');
  px += L.pillW + gap;
  drawStatPill(ctx, px, y, L.pillW, L.pillH, `${data.streak ?? 0}`, 'DAY STREAK');
  px += L.pillW + gap;
  drawStatPill(ctx, px, y, L.pillW, L.pillH, String(data.sessions ?? 0), 'SESSIONS');
  y += L.pillH + L.pillGap;

  if (data.verified) {
    drawVerified(ctx, cx, y, L.verifiedScale);
    y += L.verifiedGap;
  }

  // Footer sits on the baseline, clear of IG's bottom chrome.
  const footY = h - L.footerUp;
  text(ctx, 'apptrainingmode.com', cx, footY, {
    font: `800 ${L.footer}px Orbitron, sans-serif`, color: VIOLET, letterSpacing: '4px',
  });
  text(ctx, 'TRAIN · FIGHT · WIN', cx, footY + L.footerSubGap, {
    font: `700 ${L.footerSub}px Orbitron, sans-serif`, color: '#6f6590', letterSpacing: '8px',
  });

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function blobToFile(blob, format) {
  return new File([blob], `training-mode-${format}.png`, { type: 'image/png' });
}

// True only when the browser will actually accept this file in the share sheet.
export function canShareFile(file) {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
