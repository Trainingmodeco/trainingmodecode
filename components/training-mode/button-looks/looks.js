// BUTTON LOOKS: four draw-ups of Quick Mission's flat buttons (LOOKS ONLY).
// Each look is one object here (colours per role, the shape it is drawn in).
// css(look) turns it into rules scoped to `html[data-bl="<id>"]`, which the
// /button-looks page sets, so nothing in the app changes: they restyle the
// buttons the real screens already draw, through the classes those buttons have.
//
// To APPLY a pick: the same objects feed FitSetupKit (see
// docs/quick-mission/BUTTON-LOOKS.md): GhostButton, SegRow, ChipGroup etc. read
// their role's colours instead of the flat ones.

export const GOLD = '#F2BE45';
const MUTED = '#A9A3C4';

// size: the corner cut (cut looks) and the radius (round looks), in px.
export const SIZES = { s: { c: 8, r: 9 }, m: { c: 10, r: 12 }, l: { c: 12, r: 14 } };
export const LIP = 3;

// Roles (what a button IS, not where it sits):
//   off     unpicked segment / chip / the closed +
//   on      picked segment / chip / the open +
//   ghost   quiet action beside START (PUT ON CARD, SURPRISE)
//   second  a row that opens something (MISSION LIBRARY, ADJUST)
//   end2    the end screen's secondary (BACK TO FIT MODE)
//   home    the end screen's quietest (RETURN HOME)
//   danger  stop / delete (the red combat skin)
// A role: body [top, mid, bottom] stops, lip (the darker edge under it), edge
// (a hairline), glow, text, and for the neon look frame + ticks.
const RED = { body: ['#D93A35', '#CC2D2D', '#A31515'], lip: '#6E1010', edge: 'rgba(255,170,170,0.65)', glow: 'rgba(239,68,68,0.45)', text: '#FFFFFF', frame: '#FF6B6B', glass: ['#2B0B12', '#1C070C'], ticks: 'rgba(255,200,200,0.7)' };

const raisedRoles = {
  off: { body: ['#3C3668', '#2E2954', '#231F40'], lip: '#0E0B1E', edge: 'rgba(190,170,255,0.30)', glow: 'rgba(124,92,230,0.28)', text: '#EFEBFF' },
  on: { body: ['#7E52F0', '#6A3FDD', '#5028B8'], lip: '#2A1470', edge: 'rgba(242,190,69,0.95)', glow: 'rgba(157,108,255,0.55)', text: '#FFFFFF' },
  ghost: { body: ['#221D3A', '#1A1630', '#131027'], lip: '#07050F', edge: 'rgba(242,190,69,0.75)', glow: 'rgba(242,190,69,0.20)', text: '#FFFFFF' },
  second: { body: ['#352F5E', '#2A2549', '#201C3A'], lip: '#0C0A1B', edge: 'rgba(190,170,255,0.30)', glow: 'rgba(124,92,230,0.25)', text: '#FFFFFF' },
  danger: RED,
};
raisedRoles.end2 = raisedRoles.second;
raisedRoles.home = raisedRoles.ghost;

// NEON COLOUR: the neon frame, ticks and glow on full-colour bodies. Unpicked
// is raised dark glass in a violet frame, picked is gold like START (flatter,
// small glow: START stays the loudest), the secondary actions are filled violet,
// danger is filled red.
const DARK = ['#2A2447', '#1F1A38', '#171330'];
const VIOLET_BODY = ['#7E52F0', '#6C3FE0', '#5329B8'];
const neonColourRoles = {
  off: { frame: '#9D6CFF', glass: DARK, glow: 'rgba(157,108,255,0.40)', ticks: '#C4A8FF', text: '#E6E2F5' },
  on: { frame: '#FFF0B8', fill: ['#FFE9A8', '#F2BE45', '#C98A1C'], glow: 'rgba(242,190,69,0.30)', ticks: 'rgba(90,45,0,0.6)', text: '#1A1204' },
  ghost: { frame: '#E2D2FF', fill: VIOLET_BODY, glow: 'rgba(157,108,255,0.55)', ticks: 'rgba(255,255,255,0.85)', text: '#FFFFFF' },
  second: { frame: '#B08CFF', glass: DARK, glow: 'rgba(157,108,255,0.40)', ticks: '#C4A8FF', text: '#FFFFFF' },
  home: { frame: GOLD, glass: DARK, glow: 'rgba(242,190,69,0.30)', ticks: GOLD, text: '#E6E2F5' },
  danger: { frame: '#FF9A9A', fill: RED.body, glow: 'rgba(255,90,90,0.55)', ticks: 'rgba(255,220,220,0.8)', text: '#FFFFFF' },
};
neonColourRoles.end2 = neonColourRoles.ghost;

export const LOOKS = [
  { id: 'raised', n: 1, name: 'RAISED · CUT CORNERS', shape: 'cut', roles: raisedRoles,
    blurb: 'The kit’s cut corners kept. Gradient body, light top edge, darker lip, soft glow. Picked is brighter violet with a gold hairline; quiet buttons are a gold-edged raised dark.' },
  { id: 'round', n: 2, name: 'RAISED · ROUNDED', shape: 'round', roles: raisedRoles,
    blurb: 'The same raised depth on rounded corners, like Home START.' },
  { id: 'neon', n: 3, name: 'NEON COLOUR', shape: 'neon', roles: neonColourRoles,
    blurb: 'Neon frame, corner ticks and glow on full-colour bodies: unpicked raised dark glass in a violet frame, picked gold like START (flatter), secondary actions filled violet, danger filled red.' },
];
export const NOW = { id: 'now', n: 0, name: 'NOW', blurb: 'The app as it is today.' };
export const lookById = (id) => LOOKS.find((l) => l.id === id) || null;

// ── the CSS ────────────────────────────────────────────────────────────────
const SEG = '[role="radiogroup"][style*="clip-path"]';
// The end screen's own buttons carry no class: found by their inline border.
const END2 = 'button[style*="rgba(176, 106, 255, 0.4)"]';
const HOME = 'button[style*="height: 38px"]';
const DROP = 'button[aria-controls^="ml-drop-"]';
const CHECKED = '[aria-checked="true"]';

// group: selectors, role by state, size, hit-area inset (iy: the button is 44
// px tall, drawn shorter, so the tap target stays 44 with no layout change).
const GROUPS = [
  { sel: ['.fk-seg'], off: 'off', on: 'on', on_: CHECKED, size: 'm' },
  { sel: ['.fk-chip:not(.ml-chip)'], off: 'off', on: 'on', on_: CHECKED, size: 's', iy: 4 },
  { sel: ['.fk-chip.ml-chip'], off: 'off', on: 'on', on_: CHECKED, size: 's', iy: 5 },
  { sel: [DROP], off: 'off', on: 'on', on_: '[aria-expanded="true"]', size: 's' },
  { sel: ['.fk-ghost', '.bl-quiet'], off: 'ghost', size: 'm' },
  { sel: ['.qm-lib', '[data-guide="qm-adjust"]'], off: 'second', size: 'l' },
  { sel: [END2], off: 'end2', size: 'm', h: 44 },
  { sel: [HOME], off: 'home', size: 'm', h: 44 },
  { sel: ['.bl-danger'], off: 'danger', size: 'm' },
];

const poly = (c) => `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;
const grad = (b) => (typeof b === 'string' ? b : b.length === 2 ? `linear-gradient(180deg,${b[0]},${b[1]})` : `linear-gradient(180deg,${b[0]} 0%,${b[1]} 55%,${b[2]} 100%)`);
const tick = (c, side, v) => `linear-gradient(${c},${c}) ${side[0]} ${v}px ${side[1]} ${v}px/9px 2px no-repeat,linear-gradient(${c},${c}) ${side[0]} ${v}px ${side[1]} ${v}px/2px 9px no-repeat`;

function roleRule(look, role, sels, size, iy, big) {
  const R = look.roles[role];
  const { c, r } = SIZES[size];
  const shapeOuter = look.shape === 'round' ? `border-radius:${r}px` : `clip-path:${poly(c)}`;
  const S = sels.join(',');
  const inset = `top:${iy || 0}px;bottom:${iy || 0}px`;
  let out = '';
  if (look.shape === 'neon') {
    const t = 1.5;
    const inner = `clip-path:${poly(+(c - 0.586 * t).toFixed(2))}`;
    const fill = R.fill ? grad(R.fill) : grad(R.glass);
    // Ticks like TrainingCTA, on big buttons only, and only at the two square
    // corners (a tick at a cut corner would cross the cut).
    const sq = big ? `${tick(R.ticks, ['right', 'top'], 6)},${tick(R.ticks, ['left', 'bottom'], 6)},` : '';
    out += `${S}{filter:drop-shadow(0 0 5px ${R.glow}) drop-shadow(0 0 12px ${R.glow}) !important;color:${R.text} !important}\n`;
    out += `${sels.map((s) => `${s}::before`).join(",")}{${inset};left:0;right:0;background:${R.frame};${shapeOuter}}\n`;
    out += `${sels.map((s) => `${s}::after`).join(",")}{top:${(iy || 0) + t}px;bottom:${(iy || 0) + t}px;left:${t}px;right:${t}px;background:${sq}${fill};box-shadow:inset 0 0 14px ${R.glow};${inner}}\n`;
    return out;
  }
  const body = grad(R.body);
  const radius = look.shape === 'round' ? `border-radius:${r}px` : `clip-path:${poly(c)}`;
  out += `${S}{filter:drop-shadow(0 0 7px ${R.glow}) !important;color:${R.text} !important}\n`;
  out += `${sels.map((s) => `${s}::before`).join(",")}{top:${(iy || 0) + LIP}px;bottom:${(iy || 0) - LIP}px;left:0;right:0;background:${R.lip};${radius}}\n`;
  out += `${sels.map((s) => `${s}::after`).join(",")}{${inset};left:0;right:0;background:${body};box-shadow:inset 0 1.5px 0 rgba(255,255,255,0.38),inset 0 0 0 1px ${R.edge};${radius}}\n`;
  return out;
}

export function css(look) {
  if (!look) return '';
  const P = `html[data-bl="${look.id}"] `;
  const px = (list) => list.map((s) => P + s);
  let out = `
${px(['.fk-seg', '.fk-chip', '.fk-ghost', '.bl-quiet', '.bl-danger', '.qm-lib', '[data-guide="qm-adjust"]', END2, HOME, DROP]).join(',')}{position:relative !important;isolation:isolate;background:none !important;border:0 !important;box-shadow:none !important;clip-path:none !important;transition:transform .08s ease}
${px(['.fk-seg', '.fk-chip', '.fk-ghost', '.bl-quiet', '.bl-danger', '.qm-lib', '[data-guide="qm-adjust"]', END2, HOME, DROP].map((s) => `${s}::before`)).join(',')},${px(['.fk-seg', '.fk-chip', '.fk-ghost', '.bl-quiet', '.bl-danger', '.qm-lib', '[data-guide="qm-adjust"]', END2, HOME, DROP].map((s) => `${s}::after`)).join(',')}{content:"";position:absolute;z-index:-1;pointer-events:none;transition:none}
${px(['.fk-seg:active', '.fk-chip:active', '.fk-ghost:active', '.bl-quiet:active', '.bl-danger:active', '.qm-lib:active', END2 + ':active', HOME + ':active', DROP + ':active']).join(',')}{transform:translateY(2px)}
${P}${SEG}{clip-path:none !important;background:none !important;box-shadow:none !important;border:0 !important;padding:0 0 ${LIP + 1}px !important;gap:6px !important;height:auto !important}
${px(['.fk-chip']).join(',')}{height:44px !important;margin-top:-4px !important;margin-bottom:-4px !important}
${px(['.fk-chip']).join(',')}{min-width:44px}
${px(['.fk-chip.ml-chip']).join(',')}{margin-top:-5px !important;margin-bottom:-5px !important;padding:0 6px !important}
${px(['.fk-seg']).join(',')}{min-height:44px}
${px([END2, HOME]).join(',')}{height:44px !important;border-radius:0 !important}
`;
  for (const g of GROUPS) {
    const big = g.size !== 's';
    const sel = (extra) => px(g.sel.map((s) => (extra ? s + extra : s)));
    if (g.on) {
      out += roleRule(look, g.off, px(g.sel.map((s) => (g.on_ === CHECKED ? `${s}:not(${CHECKED})` : `${s}:not(${g.on_})`))), g.size, g.iy, big);
      out += roleRule(look, g.on, px(g.sel.map((s) => s + g.on_)), g.size, g.iy, big);
    } else {
      out += roleRule(look, g.off, sel(''), g.size, g.iy, big);
    }
  }
  return out;
}

// Contrast of every label against every stop of its body (WCAG): the preview
// script fails below 4.5.
export function contrastPairs(look) {
  const out = [];
  for (const [role, R] of Object.entries(look.roles)) {
    const bgs = R.fill || R.body || R.glass;
    for (const b of bgs) out.push({ role, fg: R.text, bg: b });
    if (role === 'second') for (const b of bgs) out.push({ role: 'second (sub line)', fg: MUTED, bg: b });
  }
  return out;
}
