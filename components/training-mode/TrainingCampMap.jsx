import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, Lock, Check, X } from 'lucide-react';
import { campLevels, roundTemplate, archetypesFor, isSplitAvailable } from './protocol/content';
import { loadCampProgress } from './data/campProgress';
import ReadinessSheet from './shared/ReadinessSheet';

// Phase 2 · 2.3 — TRAINING CAMP ladder (design 45a) + level modal (45b).
// CSS neon-spine ladder over the tower backdrop: nodes 01–12 climb the spine,
// {PHASE · TITLE} labels left, S1/S2 pips right. Header on top, the app's bottom
// nav (footer) below (WithNav in ScreenRouter). Everything is sized to fit above
// the nav with no scroll. Content is data-driven from protocol/content.ts;
// current level is a placeholder (tm_camp_progress, default 1) until 2.4 wires
// real session completion.
const GOLD = '#fde047';

// Tower art (converted from 04_DESIGN_ASSETS/App/Banners/Training Camp).
const BG_SRC = '/static/training-camp-tower.webp';
// Reserve room at the bottom for the fixed nav footer.
const NAV_RESERVE = 92;

const DISC_KEY = { Boxing: 'boxing', Kickboxing: 'kickboxing', 'Muay Thai': 'muay_thai', MMA: 'mma' };
const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };

const PHASE = {
  foundation: '#22c55e',
  development: '#a855f7',
  hard_camp: '#f59e0b',
  taper: '#2dd4bf',
  final_boss: '#ef4444',
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const pad2 = (n) => String(n).padStart(2, '0');

function NodeCircle({ level, state, boss }) {
  const size = boss ? 34 : 26;
  const c = state === 'done' ? '#22c55e'
    : state === 'current' ? GOLD
    : boss ? '#ef4444'
    : 'rgba(168,85,247,0.45)';
  const num = state === 'done' ? 'rgba(120,230,160,0.9)'
    : state === 'current' ? GOLD
    : boss ? '#ff6b6b'
    : 'rgba(190,170,225,0.8)';
  const glow = state === 'current' ? '0 0 16px rgba(253,224,71,0.55)'
    : boss ? '0 0 16px rgba(239,68,68,0.5)' : 'none';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${c}`, boxShadow: glow,
      background: 'radial-gradient(circle at 50% 35%, rgba(20,8,40,0.92), rgba(6,1,14,0.96))',
    }}>
      <span style={{ font: `800 ${boss ? 13 : 11}px 'Orbitron',sans-serif`, color: num }}>{pad2(level)}</span>
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
      font: "700 6.5px 'Orbitron',sans-serif", color: map.c, letterSpacing: '0.03em',
      background: map.bg, border: `1px solid ${map.b}`, borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function NodePips({ level, state }) {
  if (level === 12) return <Lock size={11} color={state === 'done' ? '#22c55e' : '#ff6b6b'} />;
  const split = isSplitAvailable(level);      // L4–11
  if (state === 'done') return <Check size={13} color="#22c55e" strokeWidth={3} />;
  if (state === 'current') {
    if (split) return <><Pip label="S1" tone="next" /><Pip label="S2" tone="dim" /></>;
    return <><Pip label="R1 ✓" tone="done" /><Pip label="R2 ▶" tone="next" /></>;
  }
  if (split) return <><Pip label="S1" tone="dim" /><Pip label="S2" tone="dim" /></>;
  return null;
}

export default function TrainingCampMap({ discipline = 'Boxing', onBack, onStartSession }) {
  const discKey = DISC_KEY[discipline] || 'boxing';
  const [difficulty, setDifficulty] = useState('normal');
  const [openLevel, setOpenLevel] = useState(null);
  const [openAtY, setOpenAtY] = useState(0);
  const [readinessCtx, setReadinessCtx] = useState(null);   // 2.6 — {level, difficulty}
  const [current] = useState(loadCampProgress);

  const archetype = archetypesFor(discKey)[0];   // 2.2 will make this a picker
  const curPhase = campLevels.find((l) => l.level === current) || campLevels[0];
  const topDown = [...campLevels].sort((a, b) => b.level - a.level);

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

  const tapLevel = (level, e) => {
    setOpenAtY(e?.clientY ?? 0);
    setOpenLevel(level);
  };

  // You can play the level you're on (or replay a cleared one); locked levels
  // wait their turn. Build the round cfg from the engine and hand it up.
  const canStart = open != null && open.level <= current;
  const buildCfg = (level, diff) => {
    const rt = roundTemplate(discKey, level, diff);
    const rounds = rt.rounds || 1;
    const roundMin = rt.activeMinutesTarget ? rt.activeMinutesTarget : (rt.roundSec / 60);
    return { difficulty: diff, rounds, roundMin, restSec: rt.restSec ?? 60, voiceOn: true, encouragement: 'normal', rushMode: false, warmupMin: 0 };
  };
  const launch = (level, diff) => onStartSession?.({ discipline, level, difficulty: diff, cfg: buildCfg(level, diff) });
  // 45b START runs the readiness check (2.6) first; the sheet launches on 'go'.
  const requestStart = () => {
    if (!open || !canStart) return;
    setReadinessCtx({ level: open.level, difficulty });
    setOpenLevel(null);
  };

  // Modal lands near the tapped node, clamped to stay fully on screen.
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const modalTop = Math.min(Math.max(openAtY, 200), winH - 210);

  return (
    <PhoneFrame>
      {/* Full-bleed background: CSS fallback → tower art → legibility overlay. */}
      <div style={{ position: 'absolute', inset: 0, background:
        'radial-gradient(120% 55% at 50% 0%, rgba(239,68,68,0.28), transparent 55%),' +
        'radial-gradient(90% 40% at 50% 100%, rgba(45,212,191,0.16), transparent 60%),' +
        'linear-gradient(180deg, #1a0a2e 0%, #10061f 45%, #0a0416 100%)' }} />
      <img src={BG_SRC} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background:
        'linear-gradient(180deg, rgba(4,0,10,0.5) 0%, rgba(4,0,10,0.3) 30%, rgba(4,0,10,0.5) 100%)' }} />

      {/* Header + ladder, bounded above the nav footer. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: NAV_RESERVE, zIndex: 5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px 6px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <ChevronLeft size={20} color="#d7c9ee" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#e879f9', letterSpacing: '0.04em', textShadow: '0 0 14px rgba(232,121,249,0.5)' }}>
              TRAINING CAMP · {discipline.toUpperCase()}
            </div>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#b9a9d8', letterSpacing: '0.04em', marginTop: 1 }}>
              Level {current} of 12 · {curPhase.phase_label} · {archetype?.name}
            </div>
          </div>
        </div>

        {/* Ladder */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, padding: '2px 12px 4px' }}>
          <div style={{ position: 'absolute', left: '50%', top: 8, bottom: 8, width: 3, transform: 'translateX(-50%)', background: spine, borderRadius: 2, boxShadow: '0 0 12px rgba(168,85,247,0.6)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 54, height: 18, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.5), transparent 70%)' }} />

          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {topDown.map((lv) => {
              const state = lv.level < current ? 'done' : lv.level === current ? 'current' : 'locked';
              const boss = lv.phase === 'final_boss';
              const accent = PHASE[lv.phase];
              const labelColor = state === 'current' ? GOLD : boss ? '#ff8a8a' : state === 'done' ? '#8be6a8' : accent;
              return (
                <button key={lv.level} onClick={(e) => tapLevel(lv.level, e)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                  display: 'grid', gridTemplateColumns: '1fr 40px 1fr', alignItems: 'center',
                }}>
                  <div style={{ textAlign: 'right', paddingRight: 9, minWidth: 0 }}>
                    <div style={{ font: "800 8.5px 'Orbitron',sans-serif", color: labelColor, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}>
                      {boss ? '🏆 TITLE FIGHT' : `${lv.phase_label} · ${lv.title}`}
                    </div>
                    {boss && <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#c9a6ff', marginTop: 1 }}>final test · the belt</div>}
                    {state === 'current' && <div style={{ font: "700 6.5px 'Press Start 2P',monospace", color: GOLD, marginTop: 2 }}>you are here</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <NodeCircle level={lv.level} state={state} boss={boss} />
                  </div>
                  <div style={{ paddingLeft: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <NodePips level={lv.level} state={state} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Level modal (45b) — small, translucent, lands near the tapped node. */}
      {open && (
        <div onClick={() => setOpenLevel(null)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,0,10,0.3)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', left: '50%', top: modalTop, transform: 'translate(-50%, -50%)',
            width: '86%', maxWidth: 286,
            background: 'rgba(16,7,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${PHASE[open.phase]}66`, borderRadius: 15, padding: '12px 14px 14px',
            boxShadow: `0 16px 44px rgba(0,0,0,0.55), 0 0 26px ${PHASE[open.phase]}22`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <NodeCircle level={open.level} state={open.level < current ? 'done' : open.level === current ? 'current' : 'locked'} boss={open.phase === 'final_boss'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 7px 'Orbitron',sans-serif", color: PHASE[open.phase], letterSpacing: '0.12em' }}>{open.phase_label}</div>
                <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff' }}>{open.phase === 'final_boss' ? 'TITLE FIGHT' : open.title}</div>
                <div style={{ font: "600 7.5px 'Rajdhani',sans-serif", color: '#b9a9d8', marginTop: 1 }}>
                  {isSplitAvailable(open.level) ? '2 sessions · AM/PM' : open.phase === 'final_boss' ? 'extended mission' : 'single session'} · unlocks L{Math.min(12, open.level + 1)}
                </div>
              </div>
              <button onClick={() => setOpenLevel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}><X size={15} color="#9a90b8" /></button>
            </div>

            <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
              {DIFFS.map((d) => {
                const on = d === difficulty;
                return (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer',
                    background: on ? 'rgba(253,224,71,0.14)' : 'rgba(8,2,18,0.4)',
                    border: `1px solid ${on ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.25)'}`,
                    font: "800 8px 'Orbitron',sans-serif", letterSpacing: '0.05em', color: on ? GOLD : '#c4a4d8',
                  }}>{DIFF_LABEL[d]}</button>
                );
              })}
            </div>

            <div style={{ background: 'rgba(8,2,18,0.45)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, padding: '7px 10px', textAlign: 'center', marginBottom: 9 }}>
              <div style={{ font: "900 12px 'Orbitron',sans-serif", color: '#fff' }}>{previewLine}</div>
              <div style={{ font: "600 5.5px 'Press Start 2P',monospace", color: '#c4a4d8', letterSpacing: '0.06em', marginTop: 3 }}>ROUND PLAN{openRt?.taperApplied ? ' · TAPER' : ''}</div>
            </div>

            <div style={{ marginBottom: 4, font: "700 7px 'Orbitron',sans-serif", color: '#e879f9', letterSpacing: '0.1em' }}>COMBAT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
              {open.combat_emphasis.map((c, i) => <span key={i} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#d7c9ee', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 5, padding: '2px 6px' }}>{c}</span>)}
            </div>
            <div style={{ marginBottom: 4, font: "700 7px 'Orbitron',sans-serif", color: '#7fd6c8', letterSpacing: '0.1em' }}>PHYSICAL</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {open.physical_emphasis.map((c, i) => <span key={i} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#bfe9e1', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.22)', borderRadius: 5, padding: '2px 6px' }}>{c}</span>)}
            </div>

            {canStart ? (
              <button onClick={requestStart} style={{ width: '100%', height: 38, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 0 18px rgba(253,224,71,0.35)' }}>
                ▶ START {isSplitAvailable(open.level) ? 'SESSION 1' : open.phase === 'final_boss' ? 'TITLE FIGHT' : 'SESSION'}
              </button>
            ) : (
              <button disabled style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.5)', color: '#8b7fb0', font: "900 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'not-allowed' }}>
                🔒 CLEAR L{open.level - 1} FIRST
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2.6 — readiness gate before the session actually launches. */}
      {readinessCtx && (
        <ReadinessSheet
          onGo={({ easy }) => {
            const diff = easy ? 'easy' : readinessCtx.difficulty;
            launch(readinessCtx.level, diff);
            setReadinessCtx(null);
          }}
          onClose={() => setReadinessCtx(null)}
        />
      )}
    </PhoneFrame>
  );
}
