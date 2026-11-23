// Dust for the RUSTY and REVIVE art (retention, switch `power`). Plain CSS
// animation over the picture, nothing clickable, nothing spoken:
//
//   <DustDrift/>  a few motes of dust floating up through the light and two
//                 soft clouds of it drifting by: the fighter left standing a
//                 month. Loops while the RUSTY pop-up is open.
//   <DustBurst/>  the dust and flakes of rust blown off the whole fighter in
//                 one burst, soft clouds of it blowing away: REVIVE. Plays once.
//
// Both sit in a box that is position: relative (the art's own box) and keep
// to it (overflow hidden). Positions come from fixed tables, not a random
// draw, so the look is the same on every open and in the preview photos.
// With reduced motion the drift stands still at a low opacity and the burst
// shows nothing.

const CSS = `
@keyframes dfx-mote {
  0% { transform: translate(0, 0); opacity: 0 }
  15% { opacity: var(--a) }
  50% { transform: translate(var(--sx), -28px) }
  85% { opacity: var(--a) }
  100% { transform: translate(calc(var(--sx) * -0.4), -58px); opacity: 0 }
}
@keyframes dfx-cloud {
  0% { transform: translateX(-18%) scale(1); opacity: 0 }
  30% { opacity: var(--a) }
  70% { opacity: var(--a) }
  100% { transform: translateX(18%) scale(1.15); opacity: 0 }
}
@keyframes dfx-fly {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0 }
  8% { opacity: 1 }
  70% { opacity: .85 }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(.6); opacity: 0 }
}
@keyframes dfx-cloudout {
  0% { transform: translate(0, 0) scale(.5); opacity: 0 }
  15% { opacity: .8 }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.9); opacity: 0 }
}
@media (prefers-reduced-motion: reduce) {
  .dfx-drift, .dfx-drift * { animation: none !important; }
  .dfx-drift [data-mote] { opacity: .35 !important; }
  .dfx-burst { display: none !important; }
}
`;

const BOX = { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' };

// [left %, top %, size px, seconds, delay s, sway px, opacity]
const MOTES = [
  [8, 62, 2.5, 7.5, -1.2, 10, 0.7], [17, 28, 2, 8.6, -5.1, -8, 0.55], [24, 80, 3, 6.8, -3.4, 12, 0.6],
  [31, 46, 1.6, 9.2, -0.4, -6, 0.5], [39, 14, 2.2, 7.9, -6.6, 9, 0.6], [46, 70, 1.8, 8.3, -2.2, -11, 0.55],
  [54, 36, 2.8, 7.1, -4.8, 7, 0.65], [61, 88, 2, 9.6, -7.3, -9, 0.5], [68, 22, 1.6, 8.0, -1.9, 10, 0.5],
  [74, 58, 3.2, 6.5, -3.9, -7, 0.6], [81, 40, 2, 8.8, -6.0, 8, 0.55], [88, 76, 2.4, 7.4, -0.9, -10, 0.6],
  [93, 18, 1.8, 9.0, -4.2, 6, 0.5], [13, 90, 2.2, 7.7, -2.8, 8, 0.55], [50, 52, 1.5, 8.9, -8.1, -6, 0.45],
  [35, 8, 2, 7.2, -5.6, 9, 0.5],
];
// [left %, top %, width %, seconds, delay s, opacity]
const CLOUDS = [[-10, 58, 70, 14, -3, 0.32], [40, 30, 75, 17, -10, 0.24], [10, 82, 85, 19, -7, 0.3]];

export function DustDrift({ style }) {
  return (
    <span aria-hidden className="dfx-drift" data-retention="dust-drift" style={{ ...BOX, ...style }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      {CLOUDS.map(([l, t, w, s, d, a], i) => (
        <span key={`c${i}`} style={{
          position: 'absolute', left: `${l}%`, top: `${t}%`, width: `${w}%`, aspectRatio: '2 / 1', borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(214,200,178,.55), rgba(214,200,178,0))', filter: 'blur(6px)',
          '--a': a, opacity: 0, animation: `dfx-cloud ${s}s ${d}s ease-in-out infinite`,
        }}/>
      ))}
      {MOTES.map(([l, t, sz, s, d, sx, a], i) => (
        <span key={`m${i}`} data-mote="" style={{
          position: 'absolute', left: `${l}%`, top: `${t}%`, width: sz * 1.25, height: sz * 1.25, borderRadius: '50%',
          background: 'rgb(236,224,204)', boxShadow: `0 0 ${sz * 2}px rgba(236,224,204,.6)`,
          '--a': Math.min(1, a + 0.15), '--sx': `${sx}px`, opacity: 0, animation: `dfx-mote ${s}s ${d}s linear infinite`,
        }}/>
      ))}
    </span>
  );
}

// The burst: dust lifting off the whole fighter at once and blowing away.
// Soft clouds (PUFFS) and grains of dust and flakes of rust (GRAINS) start
// spread over the figure and fly out from its middle, a little more to the
// sides than up, falling a touch as they go. The tables come from a fixed
// sequence (lcg), so every burst is the same.
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const CENTRE = [50, 48];
const outFrom = (x, y, r) => {
  const ang = Math.atan2((y - CENTRE[1]) * 0.6, x - CENTRE[0]) + (r() - 0.5) * 0.9;
  return [Math.cos(ang), Math.sin(ang)];
};
// [left %, top %, dx px, dy px, size px, delay ms]
const PUFFS = (() => {
  const r = lcg(11);
  return Array.from({ length: 9 }, () => {
    const x = 24 + r() * 52; const y = 18 + r() * 62;
    const [cx, cy] = outFrom(x, y, r); const d = 50 + r() * 70;
    return [x, y, Math.round(cx * d * 1.3), Math.round(cy * d + 14), Math.round(70 + r() * 60), Math.round(r() * 160)];
  });
})();
// [left %, top %, dx px, dy px, size px, delay ms, rust?]
const GRAINS = (() => {
  const r = lcg(29);
  return Array.from({ length: 44 }, (_, i) => {
    const x = 22 + r() * 56; const y = 14 + r() * 70;
    const [cx, cy] = outFrom(x, y, r); const d = 70 + r() * 110;
    return [x, y, Math.round(cx * d * 1.3), Math.round(cy * d + 30), +(1.6 + r() * 2.6).toFixed(1), Math.round(r() * 220), i % 3 === 0];
  });
})();

export const BURST_MS = 1100;

export function DustBurst({ style }) {
  return (
    <span aria-hidden className="dfx-burst" data-retention="dust-burst" style={{ ...BOX, ...style }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      {PUFFS.map(([l, t, dx, dy, sz, delay], i) => (
        <span key={`p${i}`} style={{
          position: 'absolute', left: `${l}%`, top: `${t}%`, width: sz, height: sz * 0.7, marginLeft: -sz / 2, marginTop: -sz * 0.35, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(222,208,186,.75), rgba(190,160,128,.3) 60%, rgba(190,160,128,0))', filter: 'blur(3px)',
          '--dx': `${dx}px`, '--dy': `${dy}px`, opacity: 0, animation: `dfx-cloudout ${BURST_MS - delay}ms ${delay}ms cubic-bezier(.2,.6,.35,1) both`,
        }}/>
      ))}
      {GRAINS.map(([l, t, dx, dy, sz, delay, rust], i) => (
        <span key={`g${i}`} style={{
          position: 'absolute', left: `${l}%`, top: `${t}%`, width: rust ? sz * 1.7 : sz, height: sz,
          borderRadius: rust ? 1 : '50%', background: rust ? '#C2682F' : 'rgb(222,210,192)',
          '--dx': `${dx}px`, '--dy': `${dy}px`, '--r': `${rust ? (i % 2 ? 240 : -220) : 0}deg`,
          opacity: 0, animation: `dfx-fly ${BURST_MS - delay}ms ${delay}ms cubic-bezier(.15,.7,.3,1) both`,
        }}/>
      ))}
    </span>
  );
}
