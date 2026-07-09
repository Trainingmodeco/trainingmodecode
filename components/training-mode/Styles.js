export const C = {
  bg:      '#080012',
  panel:   '#180030',
  violet:  '#a855f7',
  violetBright: '#b06aff',
  neon:    '#b06aff',
  magenta: '#d946ef',
  yellow:  '#fde047',
  gold:    '#fde047',
  goldDark: '#f59e0b',
  rush:    '#ff6b00',
  red:     '#ef4444',
  green:   '#22c55e',
  cardio:  '#ff8a4a',
  text:    '#f5e9ff',
  muted:   '#c4a4d8',
  faint:   '#9a90b8',
  cardBg:  'rgba(8,2,18,0.8)',
  cardBorder: 'rgba(168,85,247,0.25)',
};

export const BOTTOM_NAV_SAFE_PADDING = 'calc(160px + env(safe-area-inset-bottom, 0px))';
export const BOTTOM_NAV_CTA_PADDING = 'calc(180px + env(safe-area-inset-bottom, 0px))';

export const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

html, body, #root, #__next {
  min-height: 100%;
  overflow-x: hidden;
}
body {
  overflow-y: auto;
  touch-action: pan-y;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #080012; color: #f5e9ff; font-family: 'Rajdhani', sans-serif; font-weight: 500; -webkit-font-smoothing: antialiased; line-height: 1.5; }

.app-bg {
  background-color: #080012;
  background-image:
    radial-gradient(ellipse at 50% 0%,   rgba(168,85,247,0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(217,70,239,0.12) 0%, transparent 60%),
    linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
  background-attachment: fixed;
}
.app-bg::before {
  content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/static/brand/background-w-logo.png') center/cover no-repeat;
  opacity: 0.2;
}
.app-bg::after {
  content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: rgba(8,2,18,0.45);
}

.fighter-silhouette {
  background:
    radial-gradient(ellipse at 50% 60%, rgba(168,85,247,0.32) 0%, transparent 45%),
    radial-gradient(ellipse at 50% 80%, rgba(217,70,239,0.22) 0%, transparent 50%);
}

.checker-bg {
  background-image:
    linear-gradient(45deg,  rgba(168,85,247,0.09) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(168,85,247,0.09) 25%, transparent 25%),
    linear-gradient(45deg,  transparent 75%, rgba(168,85,247,0.09) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(168,85,247,0.09) 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}

.scanlines::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(to bottom,
    rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px,
    transparent 1px, transparent 3px);
  mix-blend-mode: overlay; z-index: 50;
}

.grain::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.08;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>");
  z-index: 40; mix-blend-mode: overlay;
}

.neon-frame {
  border: 1px solid rgba(168,85,247,0.7);
  box-shadow: 0 0 0 1px rgba(168,85,247,0.35) inset,
              0 0 22px rgba(168,85,247,0.45),
              0 0 3px rgba(168,85,247,1);
}
.neon-frame-yellow {
  border: 1px solid rgba(253,224,71,0.8);
  box-shadow: 0 0 0 1px rgba(253,224,71,0.3) inset,
              0 0 24px rgba(253,224,71,0.45);
}

.tm-toggle {
  position: relative; width: 40px; height: 22px; flex-shrink: 0;
  background: #2a0a3e; border: 1px solid rgba(168,85,247,0.5);
  border-radius: 999px; transition: all 0.2s ease;
}
.tm-toggle.on { background: #a855f7; border-color: #fde047; box-shadow: 0 0 14px rgba(168,85,247,0.6); }
.tm-toggle-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 999px; background: #fde047; transition: transform 0.2s ease;
}
.tm-toggle.on .tm-toggle-knob { transform: translateX(18px); }

.ember {
  position: absolute; bottom: -20px; width: 6px; height: 6px; border-radius: 999px;
  background: radial-gradient(circle, #ffd27a 0%, #ff6b00 50%, transparent 70%);
  box-shadow: 0 0 8px rgba(255,107,0,0.9);
  animation: ember-rise linear infinite;
}

.rush-stripes {
  background-image: repeating-linear-gradient(-45deg,
    rgba(255,107,0,0) 0, rgba(255,107,0,0) 18px,
    rgba(255,107,0,0.18) 18px, rgba(255,107,0,0.18) 36px);
}

.danger-stripes {
  background-image: repeating-linear-gradient(-45deg,
    rgba(239,68,68,0) 0, rgba(239,68,68,0) 18px,
    rgba(239,68,68,0.18) 18px, rgba(239,68,68,0.18) 36px);
}

@keyframes glitch-skew {
  0%,90%,100% { transform: skew(0deg); }
  92% { transform: skew(2deg,-1deg); }
  94% { transform: skew(-3deg,1deg); }
  96% { transform: skew(1deg,0deg); }
}
@keyframes glitch-rgb {
  0%,90%,100% { text-shadow: 0 0 18px rgba(253,224,71,0.55), 0 2px 0 rgba(0,0,0,0.6); }
  92% { text-shadow: -2px 0 #ff00ea, 2px 0 #00fff0, 0 0 18px rgba(253,224,71,0.55); }
  94% { text-shadow:  2px 0 #ff00ea,-2px 0 #00fff0, 0 0 18px rgba(253,224,71,0.55); }
  96% { text-shadow: 0 0 18px rgba(253,224,71,0.55); }
}
@keyframes press-pulse {
  0%,100% { box-shadow: 0 0 16px rgba(253,224,71,0.6), 0 0 36px rgba(253,224,71,0.25), inset 0 0 0 2px rgba(253,224,71,0.9); }
  50%     { box-shadow: 0 0 28px rgba(253,224,71,0.95),0 0 64px rgba(253,224,71,0.5), inset 0 0 0 2px rgba(253,224,71,1); }
}
@keyframes blink-flash { 0%,100%{opacity:0} 50%{opacity:1} }
@keyframes ember-rise {
  0%   { transform: translateY(10vh) scale(0.6); opacity: 0; }
  20%  { opacity: 0.9; }
  100% { transform: translateY(-110vh) scale(1.4); opacity: 0; }
}
@keyframes rush-burst {
  0%   { transform: scale(0.85); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: scale(1.05); opacity: 1; }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes danger-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.anim-glitch-skew  { animation: glitch-skew 5s steps(1,end) infinite; }
.anim-glitch-rgb   { animation: glitch-rgb  5s steps(1,end) infinite; }
.anim-press-pulse  { animation: press-pulse 1.8s ease-in-out infinite; }
.anim-blink        { animation: blink-flash 180ms steps(2,end); }
.anim-rush-burst   { animation: rush-burst  600ms cubic-bezier(0.2,0.8,0.2,1) forwards; }
.anim-fade-up      { animation: fade-up 0.3s ease forwards; }

@keyframes title-flicker {
  0%   { opacity: 0; text-shadow: none; }
  8%   { opacity: 1;  text-shadow: 0 0 40px rgba(255,255,255,0.7), 0 0 80px rgba(168,85,247,0.4); }
  11%  { opacity: 0.08; text-shadow: none; }
  14%  { opacity: 1;  text-shadow: 0 0 30px rgba(255,255,255,0.6); }
  17%  { opacity: 0.3;  text-shadow: none; }
  22%  { opacity: 1;  text-shadow: 0 0 20px rgba(255,255,255,0.5); }
  25%  { opacity: 0.05; text-shadow: none; }
  30%  { opacity: 1; }
  100% { opacity: 1;  text-shadow: 0 0 18px rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.7); }
}
@keyframes glitch-rgb-white {
  0%,90%,100% { text-shadow: 0 0 18px rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.7); }
  92% { text-shadow: -2px 0 #ff00ea, 2px 0 #00fff0, 0 0 18px rgba(255,255,255,0.35); }
  94% { text-shadow:  2px 0 #ff00ea,-2px 0 #00fff0, 0 0 18px rgba(255,255,255,0.35); }
  96% { text-shadow: 0 0 18px rgba(255,255,255,0.35); }
}
@keyframes bar-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
.anim-glitch-rgb-white { animation: glitch-rgb-white 5s steps(1,end) infinite; }
@keyframes dash-pulse {
  0%, 100% { opacity: 0.6; box-shadow: 0 0 8px rgba(168,85,247,0.5), 0 0 16px rgba(168,85,247,0.25); }
  50%       { opacity: 1;   box-shadow: 0 0 16px rgba(168,85,247,0.9), 0 0 32px rgba(168,85,247,0.5); }
}
@keyframes stagger-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes corner-h {
  from { width: 0; }
  to   { width: 28px; }
}
@keyframes corner-v {
  from { height: 0; }
  to   { height: 28px; }
}

.anim-title-flicker { animation: title-flicker 1.4s ease forwards; }
.anim-glitch-rgb    { animation: glitch-rgb 5s steps(1,end) infinite; }
.anim-dash-pulse    { animation: dash-pulse 2.2s ease-in-out infinite; }

@keyframes accent-shimmer {
  0%   { transform: scaleX(1); opacity: 1; box-shadow: 0 0 8px var(--card-glow); }
  50%  { transform: scaleX(1.8); opacity: 0.6; box-shadow: 0 0 18px var(--card-glow), 0 0 36px var(--card-glow); }
  100% { transform: scaleX(1); opacity: 1; box-shadow: 0 0 8px var(--card-glow); }
}

.mode-card {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.mode-card:hover {
  transform: translateY(-6px) scale(1.06);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.5) inset,
    0 0 24px var(--card-glow),
    0 0 48px var(--card-glow),
    0 8px 24px rgba(0,0,0,0.4) !important;
}
.mode-card:hover .card-accent-line {
  animation: accent-shimmer 0.6s ease-out;
}
.mode-card:hover .card-watermark {
  color: var(--card-primary-30) !important;
  transition: color 0.28s ease;
}
.mode-card:active {
  transform: translateY(-2px) scale(1.02);
  transition-duration: 0.1s;
}

@keyframes scroll-bounce {
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50% { transform: translateY(3px); opacity: 1; }
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
button { -webkit-tap-highlight-color: transparent; cursor: pointer; }

input[type=range] {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px; border-radius: 999px; outline: none;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 22px; height: 22px; border-radius: 999px;
  background: #fde047; border: 2px solid #080012;
  box-shadow: 0 0 12px rgba(253,224,71,0.7); cursor: pointer;
}

@keyframes rgb-split {
  0%   { transform: translateX(0) skewX(0deg); opacity: 1; }
  100% { transform: translateX(100%) skewX(-15deg); opacity: 0; }
}
@keyframes blackout-fade {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes fb-swipe-in {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0%); }
}
@keyframes fb-scan {
  0%   { left: -45%; }
  100% { left: 110%; }
}

.fit-builder-card {
  transition: box-shadow 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
}
.fit-builder-card:hover {
  opacity: 1 !important;
  border-color: rgba(180,100,255,0.75) !important;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.5) inset,
    0 0 20px rgba(168,85,247,0.6),
    0 0 40px rgba(168,85,247,0.28),
    0 0 2px rgba(200,140,255,1) !important;
}

.fit-overlay {
  position: absolute; inset: 0;
  background: rgba(8,0,18,0.87);
  backdrop-filter: blur(3px);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 5px;
  z-index: 20;
  transform: translateX(-100%);
  pointer-events: none;
}
.fit-builder-card:hover .fit-overlay {
  animation: fb-swipe-in 0.45s cubic-bezier(0.22,1,0.36,1) forwards;
}

.fit-scan-rail {
  position: absolute; left: 0; right: 0; height: 1px;
  background: rgba(168,85,247,0.2);
  overflow: hidden;
}
.fit-scan-beam {
  position: absolute; top: 0; width: 45%; height: 100%;
  background: linear-gradient(90deg, transparent 0%, rgba(210,150,255,0.9) 50%, transparent 100%);
  left: -45%;
}
.fit-builder-card:hover .fit-scan-beam {
  animation: fb-scan 1.8s ease-in-out infinite;
}
.fit-scan-beam.delayed {
  animation-delay: 0.55s !important;
}

@keyframes shimmer-slide {
  from { left: -50px; }
  to   { left: 110%; }
}
@keyframes pulse-dot {
  0%,100% { opacity: 0.3; transform: scale(0.8); }
  50%     { opacity: 1;   transform: scale(1.2); }
}
.anim-shimmer-slide { animation: shimmer-slide 2.4s ease-in-out infinite; }
.anim-pulse-dot     { animation: pulse-dot 1.2s ease-in-out infinite; }
.dash-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.dash-btn:hover { transform: translateY(-2px); }
.dash-btn:active { transform: translateY(0px) scale(0.98); }

@keyframes pulse {
  0%,100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}
.anim-pulse { animation: pulse 1.5s ease-in-out infinite; }

@keyframes glowPulse {
  0%,100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}

@keyframes slow-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.anim-slow-rotate { animation: slow-rotate 30s linear infinite; }

.disc-card { transition: all 0.25s ease; }
.disc-card:hover { transform: scale(1.02); box-shadow: 0 0 18px rgba(168,85,247,0.3); }

.tm-nav-tab.tm-nav-enabled:hover {
  transform: translateY(-2px);
}
.tm-nav-tab.tm-nav-enabled:hover svg {
  filter: drop-shadow(0 0 6px var(--glow-color));
}
.tm-nav-tab.tm-nav-enabled:hover span {
  text-shadow: 0 0 8px var(--glow-color);
}

.profile-pill {
  transition: all 0.18s ease;
  cursor: pointer;
}
.profile-pill:hover:not(.selected) {
  background: rgba(168,85,247,0.18) !important;
  border-color: rgba(168,85,247,0.6) !important;
  box-shadow: 0 0 12px rgba(168,85,247,0.25);
  transform: translateY(-1px);
}
.profile-pill:active {
  transform: scale(0.95);
}
.profile-pill.selected {
  animation: pill-glow 0.4s ease-out;
}
@keyframes pill-glow {
  0%   { box-shadow: 0 0 0 0 rgba(168,85,247,0.6); }
  50%  { box-shadow: 0 0 0 8px rgba(168,85,247,0); }
  100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); }
}

/* Global HUD classes */
.tm-hud-card {
  background: rgba(8,2,18,0.8);
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.tm-hud-card:hover {
  border-color: rgba(168,85,247,0.55);
  box-shadow: 0 0 20px rgba(168,85,247,0.18);
}

.tm-hud-panel {
  background: rgba(8,2,18,0.8);
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: 14px;
  box-shadow: 0 0 28px rgba(168,85,247,0.12);
}

.tm-hud-button {
  background: rgba(8,2,18,0.8);
  border: 1.5px solid rgba(168,85,247,0.25);
  border-radius: 10px;
  color: rgba(255,255,255,0.8);
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.08em;
  transition: all 0.18s ease;
  cursor: pointer;
}
.tm-hud-button:hover {
  border-color: rgba(168,85,247,0.7);
  color: #f5e9ff;
  box-shadow: 0 0 16px rgba(168,85,247,0.3);
  transform: translateY(-1px);
}
.tm-hud-button:active {
  transform: scale(0.97);
}

.tm-hud-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid rgba(168,85,247,0.25);
  background: rgba(8,2,18,0.8);
  color: rgba(255,255,255,0.55);
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.07em;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.tm-hud-chip:hover:not(.tm-hud-active) {
  border-color: rgba(168,85,247,0.55);
  color: rgba(255,255,255,0.8);
}
.tm-hud-chip.tm-hud-active {
  border-color: rgba(168,85,247,0.75);
  background: rgba(168,85,247,0.18);
  color: #b87aff;
  box-shadow: 0 0 12px rgba(168,85,247,0.35);
}

.training-hub-card {
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}
.training-hub-card:hover {
  transform: translateY(-3px) scale(1.015);
  border-color: var(--hub-card-glow, rgba(253,224,71,0.55)) !important;
  box-shadow: 0 0 22px var(--hub-card-glow, rgba(253,224,71,0.3));
}
.training-hub-card:active {
  transform: scale(0.98);
  transition-duration: 0.1s;
}
`;
