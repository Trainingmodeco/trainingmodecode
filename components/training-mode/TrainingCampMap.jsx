import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, Lock, Check, X } from 'lucide-react';
import { campLevels, roundTemplate, archetypesFor, isSplitAvailable } from './protocol/content';

// Phase 2 · 2.3 — TRAINING CAMP ladder (design 45a) + level modal (45b).
// A CSS neon-spine ladder over the tower backdrop: nodes 01–12 climb the spine,
// {PHASE · TITLE} labels on the left, S1/S2 session pips on the right, and the
// whole thing is LOCKED to one viewport (no scroll). Content is data-driven from
// protocol/content.ts. Progress (current level) is a placeholder until session
// completion is wired (2.4) — reads tm_camp_progress, defaults to L1.
const GOLD = '#fde047';

// Background art the user supplies — drop the tower image at this path
// (public/static/training-camp-tower.webp). Until then a palette-matched CSS
// gradient stands in so the screen never looks broken.
const BG_SRC = '/static/training-camp-tower.webp';

const DISC_KEY = { Boxing: 'boxing', Kickboxing: 'kickboxing', 'Muay Thai': 'muay_thai', MMA: 'mma' };
const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };

// Phase accents tuned to the mockup: foundation green, development violet,
// hard camp amber, taper teal, title fight red.
const PHASE = {
  foundation: '#22c55e',
  development: '#a855f7',
  hard_camp: '#f59e0b',
  taper: '#2dd4bf',
  final_boss: '#ef4444',
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pad2 = (n) => String(n).padStart(2, '0');

function loadProgress() {
  try { return Math.max(1, Math.min(12, parseInt(localStorage.getItem('tm_camp_progress') || '1', 10) || 1)); }
  catch { return 1; }
}

function NodeCircle({ level, state, boss }) {
  const size = boss ? 42 : 30;
  const c = state === 'done' ? '#22c55e'
    : state === 'current' ? GOLD
    : boss ? '#ef4444'
    : 'rgba(168,85,247,0.45)';
  const num = state === 'done' ? 'rgba(120,230,160,0.9)'
    : state === 'current' ? GOLD
    : boss ? '#ff6b6b'
    : 'rgba(190,170,225,0.8)';
  const glow = state === 'current' ? '0 0 18px rgba(253,224,71,0.55)'
    : boss ? '0 0 18px rgba(239,68,68,0.5)' : 'none';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${c}`, boxShadow: glow,
      background: 'radial-gradient(circle at 50% 35%, rgba(20,8,40,0.92), rgba(6,1,14,0.96))',
    }}>
      <span style={{ font: `800 ${boss ? 15 : 12}px 'Orbitron',sans-serif`, color: num }}>{pad2(level)}</span>
    </div>
  );
}

function Pip({ label, tone }) {
  const map = {
    done:  { c: '#22c55e', bg: 'rgba(34,197,94,0.14)', b: 'rgba(34,197,94,0.5)' },
    next:  { c: GOLD,      bg: 'rgba(253,224,71,0.12)', b: 'rgba(253,224,71,0.5)' },
    dim:   { c: '#9a90b8', bg: 'rgba(168,85,247,0.06)', b: 'rgba(168,85,247,0.3)' },
  }[tone] || {};
  return (
    <span style={{
      font: "700 7px 'Orbitron',sans-serif", color: map.c, letterSpacing: '0.04em',
      background: map.bg, border: `1px solid ${map.b}`, borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function NodePips({ level, state }) {
  if (level === 12) return <Lock size={12} color={state === 'done' ? '#22c55e' : '#ff6b6b'} />;
  const split = isSplitAvailable(level);      // L4–11
  if (state === 'done') return <Check size={14} color="#22c55e" strokeWidth={3} />;
  if (state === 'current') {
    if (split) return <><Pip label="S1" tone="next" /><Pip label="S2" tone="dim" /></>;
    return <><Pip label="R1 ✓" tone="done" /><Pip label="R2 ▶" tone="next" /></>;
  }
  if (split) return <><Pip label="S1" tone="dim" /><Pip label="S2" tone="dim" /></>;
  return null;
}

export default function TrainingCampMap({ discipline = 'Boxing', onBack, onHome }) {
  const discKey = DISC_KEY[discipline] || 'boxing';
  const [difficulty, setDifficulty] = useState('normal');
  const [openLevel, setOpenLevel] = useState(null);
  const [current] = useState(loadProgress);

  const archetype = archetypesFor(discKey)[0];   // 2.2 will make this a picker
  const curPhase = campLevels.find((l) => l.level === current) || campLevels[0];

  // Top → bottom = level 12 → 1.
  const topDown = [...campLevels].sort((a, b) => b.level - a.level);

  // Spine gradient: green up to the current node, then violet→red above it.
  const frac = ((current - 1) / 11) * 100;
  const spine = `linear-gradient(to top,
    #22c55e 0%, #22c55e ${Math.max(0, frac - 4)}%,
    ${GOLD} ${frac}%, #a855f7 ${Math.min(100, frac + 8)}%, #ef4444 100%)`;

  const open = openLevel != null ? campLevels.find((l) => l.level === openLevel) : null;
  const openRt = open ? roundTemplate(discKey, open.level, difficulty) : null;
  const previewLine = openRt
    ? (openRt.activeMinutesTarget ? `~${openRt.activeMinutesTarget} active min · objective rounds`
       : `${openRt.rounds} × ${mmss(openRt.roundSec)} · ${openRt.restSec}s rest`)
    : '';

  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Background: CSS fallback → tower art on top → legibility overlay. */}
        <div style={{ position: 'absolute', inset: 0, background:
          'radial-gradient(120% 55% at 50% 0%, rgba(239,68,68,0.28), transparent 55%),' +
          'radial-gradient(90% 40% at 50% 100%, rgba(45,212,191,0.16), transparent 60%),' +
          'linear-gradient(180deg, #1a0a2e 0%, #10061f 45%, #0a0416 100%)' }} />
        <img src={BG_SRC} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background:
          'linear-gradient(180deg, rgba(4,0,10,0.55) 0%, rgba(4,0,10,0.35) 30%, rgba(4,0,10,0.55) 100%)' }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <ChevronLeft size={22} color="#d7c9ee" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#e879f9', letterSpacing: '0.04em', textShadow: '0 0 14px rgba(232,121,249,0.5)' }}>
              TRAINING CAMP · {discipline.toUpperCase()}
            </div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#b9a9d8', letterSpacing: '0.04em', marginTop: 1 }}>
              Level {current} of 12 · {curPhase.phase_label} · {archetype?.name}
            </div>
          </div>
        </div>

        {/* Ladder — locked to the remaining height, distributed, no scroll. */}
        <div style={{ position: 'relative', zIndex: 5, flex: 1, minHeight: 0, padding: '2px 12px 8px' }}>
          {/* neon spine */}
          <div style={{ position: 'absolute', left: '50%', top: 10, bottom: 10, width: 3, transform: 'translateX(-50%)', background: spine, borderRadius: 2, boxShadow: '0 0 12px rgba(168,85,247,0.6)', filter: 'blur(0.2px)' }} />
          {/* base portal glow */}
          <div style={{ position: 'absolute', left: '50%', bottom: 2, width: 60, height: 22, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.5), transparent 70%)' }} />

          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {topDown.map((lv) => {
              const state = lv.level < current ? 'done' : lv.level === current ? 'current' : 'locked';
              const boss = lv.phase === 'final_boss';
              const accent = PHASE[lv.phase];
              const labelColor = state === 'current' ? GOLD : boss ? '#ff8a8a' : state === 'done' ? '#8be6a8' : accent;
              return (
                <button key={lv.level} onClick={() => setOpenLevel(lv.level)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                  display: 'grid', gridTemplateColumns: '1fr 44px 1fr', alignItems: 'center',
                }}>
                  {/* left: label */}
                  <div style={{ textAlign: 'right', paddingRight: 10, minWidth: 0 }}>
                    <div style={{ font: "800 9px 'Orbitron',sans-serif", color: labelColor, letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      {boss ? '🏆 TITLE FIGHT' : `${lv.phase_label} · ${lv.title}`}
                    </div>
                    {boss && <div style={{ font: "600 7.5px 'Rajdhani',sans-serif", color: '#c9a6ff', marginTop: 1 }}>final test · the belt</div>}
                    {state === 'current' && <div style={{ font: "700 7px 'Press Start 2P',monospace", color: GOLD, marginTop: 3, letterSpacing: '0.02em' }}>you are here</div>}
                  </div>
                  {/* center: node on the spine */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <NodeCircle level={lv.level} state={state} boss={boss} />
                  </div>
                  {/* right: session pips */}
                  <div style={{ paddingLeft: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <NodePips level={lv.level} state={state} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Level modal (45b) */}
      {open && (
        <div onClick={() => setOpenLevel(null)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,0,10,0.74)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', background: 'linear-gradient(180deg, rgba(22,10,40,0.98), rgba(8,2,18,0.98))',
            borderTop: `1px solid ${PHASE[open.phase]}66`, borderRadius: '16px 16px 0 0', padding: '15px 18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
              <NodeCircle level={open.level} state={open.level < current ? 'done' : open.level === current ? 'current' : 'locked'} boss={open.phase === 'final_boss'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 8px 'Orbitron',sans-serif", color: PHASE[open.phase], letterSpacing: '0.14em' }}>{open.phase_label}</div>
                <div style={{ font: "900 16px 'Orbitron',sans-serif", color: '#fff' }}>{open.phase === 'final_boss' ? 'TITLE FIGHT' : open.title}</div>
                <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#b9a9d8', marginTop: 1 }}>
                  {isSplitAvailable(open.level) ? '2 sessions · AM/PM split' : open.phase === 'final_boss' ? 'one extended mission' : 'single session'} · unlocks L{Math.min(12, open.level + 1)}
                </div>
              </div>
              <button onClick={() => setOpenLevel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#9a90b8" /></button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {DIFFS.map((d) => {
                const on = d === difficulty;
                return (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                    background: on ? 'rgba(253,224,71,0.12)' : 'rgba(8,2,18,0.6)',
                    border: `1px solid ${on ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.25)'}`,
                    font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.06em', color: on ? GOLD : '#c4a4d8',
                  }}>{DIFF_LABEL[d]}</button>
                );
              })}
            </div>

            <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '9px 11px', textAlign: 'center', marginBottom: 11 }}>
              <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff' }}>{previewLine}</div>
              <div style={{ font: "600 6.5px 'Press Start 2P',monospace", color: '#c4a4d8', letterSpacing: '0.08em', marginTop: 3 }}>ROUND PLAN{openRt?.taperApplied ? ' · TAPER' : ''}</div>
            </div>

            <div style={{ marginBottom: 5, font: "700 8px 'Orbitron',sans-serif", color: '#e879f9', letterSpacing: '0.12em' }}>COMBAT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
              {open.combat_emphasis.map((c, i) => <span key={i} style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#d7c9ee', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 6, padding: '3px 8px' }}>{c}</span>)}
            </div>
            <div style={{ marginBottom: 5, font: "700 8px 'Orbitron',sans-serif", color: '#7fd6c8', letterSpacing: '0.12em' }}>PHYSICAL</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {open.physical_emphasis.map((c, i) => <span key={i} style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#bfe9e1', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.22)', borderRadius: 6, padding: '3px 8px' }}>{c}</span>)}
            </div>

            <button disabled style={{ width: '100%', height: 42, borderRadius: 11, border: '1px dashed rgba(253,224,71,0.4)', background: 'rgba(253,224,71,0.06)', color: 'rgba(253,224,71,0.75)', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.09em', cursor: 'not-allowed' }}>
              ▶ START — RUNNER COMING SOON
            </button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
