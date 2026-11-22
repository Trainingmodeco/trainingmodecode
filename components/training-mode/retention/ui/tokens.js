// The retention features' shared tokens: Home's own palette (HomeDashboard.jsx)
// and the few animations the real screens use. The gallery (retention/looksKit)
// takes its palette from here too, so a look and what ships cannot drift.
export const HOME = {
  gold: '#F2BE45',
  chip: '#15110A',
  tile: '#0E0B18',
  track: '#1B1730',
  muted: '#A9A3C4',
  green: '#8fe8ac',
  red: '#ff7a7a',
  ice: '#9ad8ff',
  fit: '#9D6CFF',
  fight: '#3D7BFF',
  font: "'Chakra Petch',sans-serif",
};

export const head = (size, weight = 700, extra = {}) => ({ font: `${weight} ${size}px ${HOME.font}`, letterSpacing: '0.08em', ...extra });

export const GOLD_BUTTON = 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)';

// Prefixed rt- so they never meet the app's or the gallery's own keyframes.
export const RETENTION_CSS = `
@keyframes rt-dot { 0% { transform: scale(0); background: #fff } 60% { transform: scale(1.4) } 100% { transform: scale(1) } }
@keyframes rt-rise { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes rt-shine { 0% { transform: translateX(-120%) skewX(-20deg) } 100% { transform: translateX(900%) skewX(-20deg) } }
@keyframes rt-pop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
.rt-go { transition: filter .18s ease, transform .1s ease; }
.rt-go:hover, .rt-go:focus-visible { filter: brightness(1.08); }
.rt-go:active { transform: scale(0.985); }
@media (prefers-reduced-motion: reduce) { .rt-anim, .rt-anim * { animation: none !important; } }
`;
