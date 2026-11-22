import { useEffect, useRef, useState } from 'react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';
import { HOME, head, orb, goldText, Look, Feature, Stars, Btn, Sparks, HomeHeader } from './looksKit';
import { WeekChip } from './lookStreak';

// 2 · The path + stars. One path component for the Arcade sagas and Training
// Camp: it opens on the current node; cleared nodes show 1 to 3 stars.

const SAGA = [
  { n: 1, stars: 3 }, { n: 2, stars: 3 }, { n: 3, stars: 2 }, { n: 4, stars: 1 }, { n: 5, stars: 3 },
  { n: 6, current: true }, { n: 7 }, { n: 8 }, { n: 9 }, { n: 10 }, { n: 11 }, { n: 12, boss: true },
];
const CAMP = [
  { n: 'D1', stars: 3 }, { n: 'D2', stars: 2 }, { n: 'D3', current: true }, { n: 'D4' }, { n: 'D5' }, { n: 'REST', rest: true }, { n: 'FIGHT\nNIGHT', boss: true },
];

const GAP = 104, TOP = 70;
const xAt = (i) => 180 + Math.sin(i * 0.9) * 92;

function Node({ s, i, onPick }) {
  const x = xAt(i), y = TOP + i * GAP;
  const cleared = s.stars != null;
  const size = s.boss ? 78 : s.current ? 70 : 58;
  const style = {
    position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: s.boss ? 18 : size / 2,
    display: 'grid', placeItems: 'center', cursor: cleared || s.current ? 'pointer' : 'default',
    fontFamily: ARCADE.fontHead, fontWeight: 900, whiteSpace: 'pre', textAlign: 'center', lineHeight: 1.05,
  };
  let look;
  if (s.current) look = { background: 'radial-gradient(circle at 50% 35%, #3b1670, #14052a)', border: `2px solid ${ARCADE.goldBright}`, color: C.text, animation: 'rl-pulse 1.8s infinite', fontSize: 11 };
  else if (cleared) look = { background: 'rgba(253,224,71,0.08)', border: '2px solid rgba(253,224,71,0.6)', color: ARCADE.gold, fontSize: 16 };
  else if (s.boss) look = { background: 'rgba(253,224,71,0.06)', border: '2px solid rgba(253,224,71,0.35)', color: 'rgba(253,224,71,0.6)', fontSize: 9 };
  else if (s.rest) look = { background: 'rgba(143,232,172,0.08)', border: '1.5px dashed rgba(143,232,172,0.5)', color: HOME.green, fontSize: 9 };
  else look = { background: 'rgba(10,0,20,0.8)', border: '1.5px solid rgba(168,85,247,0.22)', color: 'rgba(196,164,216,0.5)', fontSize: 14 };
  return (
    <>
      {s.current && <span style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, border: `2px solid ${ARCADE.goldBright}`, animation: 'rl-ring 1.8s infinite', pointerEvents: 'none' }}/>}
      <button type="button" onClick={() => onPick?.(s)} style={{ ...style, ...look }}>
        {s.current ? <span><span style={{ fontSize: 9, color: HOME.muted, display: 'block' }}>{typeof s.n === 'number' ? `STAGE ${s.n}` : s.n}</span><span style={{ fontSize: 15, ...goldText }}>START</span></span>
          : s.boss ? <span><span style={{ fontSize: 22, display: 'block' }}>👑</span>{typeof s.n === 'number' ? 'BOSS' : s.n}</span>
          : cleared ? s.n : s.rest ? '💤\nREST' : <span>🔒<span style={{ display: 'block', fontSize: 10 }}>{s.n}</span></span>}
      </button>
      {cleared && <div style={{ position: 'absolute', left: x - 30, top: y + size / 2 + 2, width: 60, textAlign: 'center' }}><Stars n={s.stars} size={13}/></div>}
    </>
  );
}

function PathView({ nodes, title, sub, total, onPick }) {
  const ref = useRef(null);
  const h = TOP + nodes.length * GAP;
  const ci = nodes.findIndex((s) => s.current);
  // Opens on the current node.
  useEffect(() => { if (ref.current) ref.current.scrollTop = Math.max(0, TOP + ci * GAP - 260); }, [ci]);
  const pts = nodes.map((_, i) => `${xAt(i)},${TOP + i * GAP}`);
  const done = pts.slice(0, ci + 1).join(' ');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at 50% 30%, rgba(30,0,70,.8), #050010 75%)' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(168,85,247,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: HOME.muted, fontSize: 18 }}>‹</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...orb(13), ...goldText }}>{title}</div>
          <div style={{ ...head(10, 600), color: HOME.muted }}>{sub}</div>
        </div>
        <span style={{ ...head(12), color: ARCADE.gold }}>★ {total}</span>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'relative', height: h }}>
          <svg width="360" height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
            <polyline points={pts.join(' ')} fill="none" stroke="rgba(168,85,247,0.25)" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round"/>
            <polyline points={done} fill="none" stroke="rgba(253,224,71,0.7)" strokeWidth="5" strokeLinecap="round"/>
          </svg>
          {nodes.map((s, i) => <Node key={i} s={s} i={i} onPick={onPick}/>)}
        </div>
      </div>
    </div>
  );
}

function CountUp({ to, ms = 900, delay = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const id = setTimeout(() => {
      const tick = (now) => { t0 = t0 || now; const p = Math.min(1, (now - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [to, ms, delay]);
  return <>{v}</>;
}
export { CountUp };

function ReplaySheet() {
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, filter: 'brightness(.35)' }}><PathView nodes={SAGA} title="IRON PATH" sub="SAGA 2 · STAGE 6 OF 12" total="12 / 36"/></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', background: '#0E0B18', borderTop: '1px solid rgba(253,224,71,.4)', padding: 18, animation: 'rl-rise .4s both' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', margin: '-6px auto 12px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>STAGE 3 · CLEARED</div>
            <div style={{ ...head(18), color: C.text, letterSpacing: '0.02em' }}>Ladder Push 6×6</div>
          </div>
          <Stars n={2} size={22}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <div style={{ background: HOME.tile, borderRadius: 10, padding: 10 }}><div style={{ ...head(9, 600), color: HOME.muted }}>YOUR BEST</div><div style={{ ...head(18), color: HOME.gold }}>6:42</div></div>
          <div style={{ background: 'rgba(253,224,71,.08)', border: '1px solid rgba(253,224,71,.35)', borderRadius: 10, padding: 10 }}><div style={{ ...head(9, 600), color: HOME.muted }}>★★★ NEEDS</div><div style={{ ...head(18), color: C.text }}>under 6:30</div></div>
        </div>
        <div style={{ fontSize: 13, color: HOME.muted, marginTop: 10 }}>12 seconds off the third star. Replays keep your best result.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><Btn>↻ REPLAY</Btn><Btn tone="ghost">CLOSE</Btn></div>
      </div>
    </div>
  );
}

function StarsLanding() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative', textAlign: 'center', padding: 22,
      background: 'radial-gradient(ellipse at center, rgba(34,197,94,.18) 0%, rgba(8,0,18,1) 65%)' }}>
      <Sparks/>
      <div style={{ ...orb(12), color: HOME.muted, animation: 'rl-rise .4s both' }}>STAGE 5</div>
      <div style={{ ...orb(44), ...goldText, animation: 'rl-slam .6s .15s both' }}>CLEAR</div>
      <Stars n={3} size={46} land gap={10} delay={0.8}/>
      <div style={{ ...head(12), color: HOME.green, animation: 'rl-rise .4s 2.3s both' }}>★★★ UNDER 5:00 · NEW BEST 4:51</div>
      <div style={{ ...orb(26), color: ARCADE.gold, animation: 'rl-rise .4s 2.5s both' }}>+<CountUp to={180} delay={2500}/> XP</div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, animation: 'rl-rise .4s 3s both' }}>
        <Btn>NEXT: STAGE 6 ▶</Btn><Btn tone="ghost">BACK TO THE PATH</Btn>
      </div>
    </div>
  );
}

export default function LookPath() {
  return (
    <Feature id="f2" num="FEATURE 2" title="THE PATH + STARS"
      reuse="ArcadeConstellationMap's pulsing current node, boss node and gold-for-cleared colours; the stage stars on ArcadeStageClearOverlay; the arcade gold title type."
      isNew="from the constellation map: nodes become big tap targets on a winding road that scrolls, opens on the current node, shows 1 to 3 stars under each cleared node and START on the current one. One component serves sagas and Training Camp.">

      <Look name="The path: a saga" note="Opens on the current node (stage 6). Gold road behind, dashed road ahead. Tap a cleared node for its replay sheet." height={640}>
        <PathView nodes={SAGA} title="IRON PATH" sub="SAGA 2 · STAGE 6 OF 12" total="12 / 36"/>
      </Look>

      <Look name="The path: Training Camp" note="The same component for a camp week: days as nodes, a rest day that is part of the plan, fight night as the boss." height={640}>
        <PathView nodes={CAMP} title="TRAINING CAMP" sub="WEEK 2 · DAY 3 OF 7" total="5 / 15"/>
      </Look>

      <Look name="Home: NEXT UP" note="One row on home that jumps straight onto the current node." height={170}>
        <HomeHeader right={<WeekChip/>}/>
        <div style={{ margin: '8px 14px', height: 64, borderRadius: 14, background: HOME.tile, border: '1px solid rgba(253,224,71,.35)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px' }}>
          <span style={{ width: 42, height: 42, borderRadius: 21, display: 'grid', placeItems: 'center', border: `2px solid ${ARCADE.goldBright}`, animation: 'rl-pulse 1.8s infinite', ...orb(12), color: C.text }}>6</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>NEXT UP · IRON PATH</div>
            <div style={{ ...head(15), color: C.text, letterSpacing: '0.02em' }}>Stage 6: Burpee Ladder</div>
          </div>
          <span style={{ ...head(12), color: HOME.gold }}>START ▶</span>
        </div>
      </Look>

      <Look name="Replay sheet (a cleared node)" note="Best stars, best result, and in plain words what the third star needs." height={560} animated>
        <ReplaySheet/>
      </Look>

      <Look name="Stage clear: stars land one by one" note="Each star slams in with its own beat (sound cue per star), then the XP counts up." height={560} animated>
        <StarsLanding/>
      </Look>
    </Feature>
  );
}
