import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft } from 'lucide-react';
import EmptyState from './EmptyState';
import { loadStats, getLevel, getStreak } from './data/userStats';

// Progress · Overview — pixel match of design 23a:
// PROGRESS header + OVERVIEW/TROPHIES toggle · rank card · XP-this-month trend ·
// TRAINING SPLIT bars · recent-trophies row. Trophies tab shows the rank ladder.
const RANKS = [
  { name: 'Combat Rookie', xp: 0, tier: 'rookie', color: '#b87333' },
  { name: 'Combat Adept', xp: 500, tier: 'adept', color: '#c0c0c0' },
  { name: 'Combat Veteran', xp: 1500, tier: 'veteran', color: '#fde047' },
  { name: 'Combat Elite', xp: 3500, tier: 'elite', color: '#60a5fa' },
  { name: 'Combat Champion', xp: 7000, tier: 'champion', color: '#c084fc' },
  { name: 'Apex Legend', xp: 12000, tier: 'champion', color: '#f43f5e' },
];
const getRank = (xp) => { let r = RANKS[0]; for (const x of RANKS) if (xp >= x.xp) r = x; return r; };
const rankProgress = (xp) => { const r = getRank(xp); const i = RANKS.indexOf(r); const n = RANKS[i + 1]; return n ? Math.min(1, Math.max(0, (xp - r.xp) / (n.xp - r.xp))) : 1; };

const TROPHIES = [
  { src: '/static/trophies/fight-combat-rookie.png', ring: 'rgba(176,106,255,0.7)' },
  { src: '/static/trophies/fit-gym-warrior.png', ring: 'rgba(253,224,71,0.7)' },
  { src: '/static/trophies/arcade-recruit.png', ring: 'rgba(34,197,94,0.6)' },
  { src: '/static/trophies/fit-starter-build.png', ring: 'rgba(253,224,71,0.7)' },
  { src: '/static/trophies/fight-ring-warrior.png', ring: 'rgba(176,106,255,0.7)' },
];

// Trophy ladder per mode (design 23b). Unlocked once the athlete has logged
// `need` sessions in that category.
const TROPHY_GROUPS = [
  { mode: '💪 FIT MODE', cat: 'fit', ring: 'rgba(253,224,71,0.6)', color: '#fde047', items: [
    { src: 'fit-starter-build', label: 'STARTER', need: 1 },
    { src: 'fit-gym-warrior', label: 'GYM WARRIOR', need: 3 },
    { src: 'fit-rep-master', label: 'REP MASTER', need: 8 },
    { src: 'fit-iron-legend', label: 'IRON LEGEND', need: 15 },
  ] },
  { mode: '🥊 FIGHT MODE', cat: 'fight', ring: 'rgba(176,106,255,0.6)', color: '#c9a6ff', items: [
    { src: 'fight-combat-rookie', label: 'ROOKIE', need: 1 },
    { src: 'fight-ring-warrior', label: 'RING WAR', need: 3 },
    { src: 'fight-knockout-king', label: 'KO KING', need: 8 },
    { src: 'fight-apex-champion', label: 'APEX', need: 15 },
  ] },
  { mode: '🕹 ARCADE', cat: 'arcade', ring: 'rgba(34,197,94,0.55)', color: '#8fe8ac', items: [
    { src: 'arcade-recruit', label: 'RECRUIT', need: 1 },
    { src: 'arcade-combo-hunter', label: 'COMBO', need: 3 },
    { src: 'arcade-boss-breaker', label: 'BOSS', need: 6 },
    { src: 'arcade-final-boss', label: 'FINAL', need: 10 },
  ] },
];

function category(type) {
  const t = String(type || '').toLowerCase();
  if (/fight|combo|focus|practice/.test(t)) return 'fight';
  if (/cardio/.test(t)) return 'cardio';
  if (/arcade|stage/.test(t)) return 'arcade';
  return 'fit';
}

const SPLIT = [
  { key: 'fight', label: '🥊 FIGHT', color: '#fde047' },
  { key: 'fit', label: '💪 FIT', color: '#b06aff' },
  { key: 'cardio', label: '❤ CARDIO', color: '#ff8a4a' },
  { key: 'arcade', label: '🕹 ARCADE', color: '#22c55e' },
];

// Progress detail (design 22b): range tabs + XP trend + weekly activity bars +
// training split. Full-screen modal via portal.
function ProgressDetail({ stats, rankName, level, onClose }) {
  const [range, setRange] = useState('month');
  const sessions = stats.sessions || [];
  const now = new Date();
  const inRange = (iso) => {
    const d = new Date(iso);
    if (range === 'week') return (now - d) <= 7 * 864e5;
    if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return true;
  };
  const rs = sessions.filter(s => inRange(s.completedAt));
  const rangeXp = rs.reduce((a, s) => a + (s.xpEarned || 0), 0);

  const buckets = [0, 0, 0, 0];
  rs.forEach(s => { const wk = Math.min(3, Math.floor((new Date(s.completedAt).getDate() - 1) / 7)); buckets[wk] += 1; });
  const maxB = Math.max(1, ...buckets);

  let cum = 0;
  const cpts = rs.map(s => (cum += (s.xpEarned || 0)));
  const maxCum = Math.max(1, ...cpts);
  const pts = cpts.length >= 2
    ? cpts.map((v, i) => ({ x: 6 + i * (286 / (cpts.length - 1)), y: 76 - (v / maxCum) * 62 }))
    : [{ x: 6, y: 74 }, { x: 292, y: 74 }];
  const trend = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const counts = { fight: 0, fit: 0, cardio: 0, arcade: 0 };
  rs.forEach(s => { counts[category(s.type)] += 1; });
  const totalC = Math.max(1, rs.length);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 200, background: '#080012', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 6px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#c4a4d8', cursor: 'pointer', display: 'flex', padding: 2 }}><ChevronLeft size={22}/></button>
        <div><div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>PROGRESS DETAIL</div><div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>{rankName} · Level {level}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '2px 14px 10px' }}>
        {['week', 'month', 'all'].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ font: "800 8px 'Orbitron',sans-serif", color: range === r ? '#0a0014' : '#d9d1ef', background: range === r ? '#fde047' : 'rgba(16,4,30,0.8)', border: range === r ? 'none' : '1px solid rgba(168,85,247,0.3)', borderRadius: 99, padding: '6px 14px', cursor: 'pointer' }}>{r.toUpperCase()}</button>
        ))}
      </div>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px calc(20px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ background: 'rgba(8,2,18,0.82)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '13px 14px', marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}><span style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em' }}>XP EARNED</span><span style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fde047' }}>{rangeXp.toLocaleString()}</span></div>
          <svg viewBox="0 0 300 90" style={{ width: '100%', height: 74, display: 'block' }}>
            <defs><linearGradient id="xpfill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" stopOpacity="0.3"/><stop offset="1" stopColor="#fde047" stopOpacity="0"/></linearGradient></defs>
            <polygon points={`${trend} 292,84 6,84`} fill="url(#xpfill2)"/>
            <polyline points={trend} fill="none" stroke="#fde047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(253,224,71,.4))' }}/>
          </svg>
        </div>
        <div style={{ background: 'rgba(8,2,18,0.82)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '13px 14px', marginBottom: 11 }}>
          <div style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em', marginBottom: 12 }}>SESSIONS · {rs.length} {range === 'week' ? 'THIS WEEK' : range === 'month' ? 'THIS MONTH' : 'ALL TIME'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
            {buckets.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: Math.max(6, (b / maxB) * 62), borderRadius: 4, background: i === 3 ? 'linear-gradient(180deg,#fde047,#f59e0b)' : 'linear-gradient(180deg,#b06aff,#7c3aed)' }}/>
                <span style={{ font: "600 7px 'Orbitron',sans-serif", color: i === 3 ? '#fde047' : '#6d5a8f' }}>W{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(8,2,18,0.82)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '13px 14px' }}>
          <div style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em', marginBottom: 12 }}>TRAINING SPLIT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SPLIT.map(s => { const p = Math.round((counts[s.key] / totalC) * 100); return (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 9px 'Orbitron',sans-serif", color: '#fff', marginBottom: 4 }}><span>{s.label}</span><span style={{ color: s.color }}>{p}%</span></div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: s.color }}/></div>
              </div>
            ); })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Card({ children, style, ...rest }) {
  return <div {...rest} style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 11, ...style }}>{children}</div>;
}

export default function ProgressScreen({ onHome, profile }) {
  const [stats, setStats] = useState(() => loadStats());
  const [tab, setTab] = useState('overview');
  const [detailOpen, setDetailOpen] = useState(false);
  void onHome;

  useEffect(() => {
    const refresh = () => setStats(loadStats());
    refresh();
    window.addEventListener('training-mode-stats-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('training-mode-stats-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const totalXp = stats.xp || 0;
  const level = getLevel(totalXp);
  const streak = getStreak(stats);
  const rank = getRank(totalXp);
  const sessions = stats.sessions || [];

  // XP this month + a simple trend from recent sessions.
  const now = new Date();
  const inMonth = (iso, mOff = 0) => { const d = new Date(iso); const ref = new Date(now.getFullYear(), now.getMonth() - mOff, 1); return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth(); };
  const monthXp = sessions.filter(s => inMonth(s.completedAt)).reduce((a, s) => a + (s.xpEarned || 0), 0);
  const lastMonthXp = sessions.filter(s => inMonth(s.completedAt, 1)).reduce((a, s) => a + (s.xpEarned || 0), 0);
  const pct = lastMonthXp > 0 ? Math.round(((monthXp - lastMonthXp) / lastMonthXp) * 100) : null;

  const recent = [...sessions].slice(-7);
  let cum = 0;
  const cumPts = recent.map(s => (cum += (s.xpEarned || 0)));
  const maxCum = Math.max(1, ...cumPts);
  const ptCoords = cumPts.length >= 2
    ? cumPts.map((v, i) => ({ x: 6 + (i * (286 / (cumPts.length - 1))), y: 60 - (v / maxCum) * 48 }))
    : [{ x: 6, y: 58 }, { x: 292, y: 58 }];
  const trend = ptCoords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Training split.
  const counts = { fight: 0, fit: 0, cardio: 0, arcade: 0 };
  sessions.forEach(s => { counts[category(s.type)] += 1; });
  const totalC = Math.max(1, sessions.length);

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom,0px))' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px 8px' }}><div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>PROGRESS</div></div>

        {/* Sub-tab toggle */}
        <div style={{ display: 'flex', gap: 6, padding: '2px 16px 10px' }}>
          {['overview', 'trophies'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: 'center', font: "800 9px 'Orbitron',sans-serif", color: tab === t ? '#0a0014' : '#d9d1ef', background: tab === t ? '#fde047' : 'rgba(16,4,30,0.8)', border: tab === t ? 'none' : '1px solid rgba(168,85,247,0.3)', borderRadius: 9, padding: '9px 0', cursor: 'pointer' }}>{t.toUpperCase()}</button>
          ))}
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px' }}>
          {tab === 'overview' ? (
            <>
              {/* Rank card */}
              <Card data-tour="rank-card" style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)', flexShrink: 0 }}>
                  <SafeImage src={`/static/tiers/${rank.tier}-${sex}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "800 11px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.05em' }}>{rank.name.toUpperCase()} · LV {level}</div>
                  <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 5 }}><div style={{ width: `${Math.round(rankProgress(totalXp) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/></div>
                </div>
                <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#ff8a4a' }}>🔥{streak}</div>
              </Card>

              {sessions.length === 0 ? (
                <EmptyState preset="firstRun" onPrimary={onHome} style={{ marginTop: 10 }}/>
              ) : (<>

              {/* XP trend */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em' }}>XP · THIS MONTH</span>
                  <span style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fde047' }}>{monthXp.toLocaleString()} {pct !== null && <span style={{ font: "700 8px 'Orbitron',sans-serif", color: pct >= 0 ? '#8fe8ac' : '#f87171' }}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct)}%</span>}</span>
                </div>
                <svg viewBox="0 0 300 70" style={{ width: '100%', height: 60, display: 'block' }}>
                  <defs><linearGradient id="xpfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" stopOpacity="0.22"/><stop offset="1" stopColor="#fde047" stopOpacity="0"/></linearGradient></defs>
                  {[12, 32, 52].map(y => <line key={y} x1="6" y1={y} x2="292" y2={y} stroke="rgba(168,85,247,0.12)" strokeWidth="1"/>)}
                  <polygon points={`${trend} 292,64 6,64`} fill="url(#xpfill)"/>
                  <polyline points={trend} fill="none" stroke="#fde047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(253,224,71,.4))' }}/>
                  {ptCoords.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === ptCoords.length - 1 ? 3 : 2} fill={i === ptCoords.length - 1 ? '#fff' : '#fde047'} stroke="#fde047" strokeWidth="1"/>)}
                </svg>
                <button onClick={() => setDetailOpen(true)} style={{ width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#c9a6ff', font: "700 8px 'Orbitron',sans-serif", letterSpacing: '0.1em', cursor: 'pointer' }}>FULL STATS · TRENDS &amp; BREAKDOWN ›</button>
              </Card>

              {/* Training split */}
              <Card>
                <div style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em', marginBottom: 11 }}>TRAINING SPLIT</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {SPLIT.map(s => {
                    const p = Math.round((counts[s.key] / totalC) * 100);
                    return (
                      <div key={s.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 9px 'Orbitron',sans-serif", color: '#fff', marginBottom: 3 }}><span>{s.label}</span><span style={{ color: s.color }}>{p}%</span></div>
                        <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: s.color }}/></div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Recent trophies */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em' }}>RECENT TROPHIES</span>
                <button onClick={() => setTab('trophies')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: "700 8px 'Orbitron',sans-serif", color: '#b06aff' }}>VIEW ALL ›</button>
              </div>
              <div style={{ display: 'flex', gap: 9, justifyContent: 'center' }}>
                {TROPHIES.map(t => (
                  <button key={t.src} onClick={() => setTab('trophies')} style={{ width: '19%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${t.ring}`, padding: 0, cursor: 'pointer', background: 'none' }}>
                    <SafeImage src={t.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </button>
                ))}
              </div>
              </>)}
            </>
          ) : (
            <>
              {/* Current + next rank (kept from the ladder) */}
              <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', margin: '2px 0 8px' }}>RANK</div>
              <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                {[{ r: rank, cur: true }, { r: RANKS[Math.min(RANKS.indexOf(rank) + 1, RANKS.length - 1)], cur: false }].map(({ r, cur }, i) => {
                  const nextXp = RANKS[RANKS.indexOf(r)]?.xp ?? 0;
                  const isMax = !cur && r === rank;
                  return (
                    <div key={i} style={{ flex: 1, borderRadius: 12, border: `1.5px solid ${cur ? r.color : `${r.color}55`}`, background: cur ? `radial-gradient(circle at 30% 25%, ${r.color}22, rgba(10,0,20,0.9))` : 'rgba(10,0,20,0.6)', boxShadow: cur ? `0 0 16px ${r.color}44` : 'none', padding: '11px 8px', textAlign: 'center' }}>
                      <div style={{ font: "700 7px 'Orbitron',sans-serif", color: cur ? '#8fe8ac' : '#8b83a8', letterSpacing: '0.14em', marginBottom: 6 }}>{cur ? 'CURRENT' : isMax ? 'MAX' : 'NEXT'}</div>
                      <div style={{ width: 46, height: 56, margin: '0 auto 6px', borderRadius: 7, overflow: 'hidden', border: `1px solid ${r.color}66`, filter: cur ? 'none' : 'grayscale(0.5)' }}>
                        <SafeImage src={`/static/tiers/${r.tier}-${sex}.png`} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
                      </div>
                      <div style={{ font: "800 8px 'Orbitron',sans-serif", color: r.color, letterSpacing: '0.03em', lineHeight: 1.2 }}>{r.name.toUpperCase()}</div>
                      <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 2 }}>{cur ? `LV ${level}` : isMax ? 'TOP RANK' : `${nextXp.toLocaleString()} XP`}</div>
                    </div>
                  );
                })}
              </div>

              {/* Trophy grid by mode (design 23b) */}
              {TROPHY_GROUPS.map(g => {
                const catCount = counts[g.cat] || 0;
                const unlockedCount = g.items.filter(it => catCount >= it.need).length;
                return (
                  <div key={g.cat} style={{ marginBottom: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.2em' }}>{g.mode}</span>
                      <span style={{ font: "700 8px 'Orbitron',sans-serif", color: '#6d5a8f' }}>{unlockedCount}/{g.items.length}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
                      {g.items.map(it => {
                        const unlocked = catCount >= it.need;
                        return (
                          <div key={it.src} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${unlocked ? g.ring : 'rgba(255,255,255,0.1)'}`, opacity: unlocked ? 1 : 0.45 }}>
                            <SafeImage src={`/static/trophies/${it.src}.png`} alt={it.label} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', filter: unlocked ? 'none' : 'grayscale(1)' }}/>
                            {!unlocked && <span style={{ position: 'absolute', top: 3, right: 3, fontSize: 10 }}>🔒</span>}
                            <div style={{ padding: 3, textAlign: 'center', background: 'rgba(8,2,18,0.92)' }}><div style={{ font: "800 6.5px 'Orbitron',sans-serif", color: unlocked ? g.color : '#9a90b8' }}>{it.label}</div></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      {detailOpen && <ProgressDetail stats={stats} rankName={rank.name} level={level} onClose={() => setDetailOpen(false)}/>}
    </PhoneFrame>
  );
}
