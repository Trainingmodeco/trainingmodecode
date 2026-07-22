import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import TrainingHeader from './TrainingHeader';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { Lock, ChevronRight, Trophy, X } from 'lucide-react';
import { campLevels, roundTemplate, archetypesFor, isSplitAvailable } from './protocol/content';

// Phase 2 · 2.3 (v0) — TRAINING CAMP map. Renders the 12-level / 5-phase camp
// straight from the integrated protocol content (protocol/content.ts), and the
// session card previews REAL round timing from the engine (roundTemplate) — so
// this screen is the live proof that 2.0 (engine integration) is wired. The
// session runner, archetype picker, and readiness gate are the next slices
// (2.2 / 2.4 / 2.6); nodes are a scaffold (L1 = up next, rest preview-only).
const GOLD = '#fde047';
const VIOLET = '#b06aff';

// Hub passes the discipline id ("Muay Thai"); the engine keys on "muay_thai".
const DISC_KEY = { Boxing: 'boxing', Kickboxing: 'kickboxing', 'Muay Thai': 'muay_thai', MMA: 'mma' };
const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };

// Per-phase accent so the ladder reads its arc at a glance.
const PHASE_ACCENT = {
  foundation: '#4f8cff',
  development: '#a855f7',
  hard_camp: '#ef4444',
  taper: '#2dd4bf',
  final_boss: GOLD,
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function previewLine(rt) {
  if (rt.activeMinutesTarget) return `~${rt.activeMinutesTarget} active min · objective rounds`;
  return `${rt.rounds} × ${mmss(rt.roundSec)} · ${rt.restSec}s rest`;
}

export default function TrainingCampMap({ discipline = 'Boxing', onBack, onHome }) {
  const discKey = DISC_KEY[discipline] || 'boxing';
  const [difficulty, setDifficulty] = useState('normal');
  const [openLevel, setOpenLevel] = useState(null);

  const archetype = archetypesFor(discKey)[0];   // 2.2 will make this a picker
  const phases = campLevels.reduce((acc, lv) => {
    (acc[acc.length - 1]?.phase === lv.phase ? acc[acc.length - 1].levels : acc[acc.push({ phase: lv.phase, phase_label: lv.phase_label, levels: [] }) - 1].levels).push(lv);
    return acc;
  }, []);

  const open = openLevel != null ? campLevels.find((l) => l.level === openLevel) : null;
  const openRt = open ? roundTemplate(discKey, open.level, difficulty) : null;

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.2} />
      <Embers count={3} />

      <TrainingHeader
        title="TRAINING CAMP"
        subtitle={`${discipline.toUpperCase()} · ${archetype?.name || ''}`}
        onHome={onHome}
        showBack
        onBack={onBack}
        rightSlot={<div style={{ font: "700 8px 'Press Start 2P',monospace", color: GOLD, letterSpacing: '0.08em' }}>1/12</div>}
      />

      <div style={{ position: 'relative', zIndex: 10, padding: '10px 16px 24px' }}>
        {/* Difficulty selector — changing it re-previews every session card. */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {DIFFS.map((d) => {
            const on = d === difficulty;
            return (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: '8px 0', borderRadius: 9, cursor: 'pointer',
                background: on ? 'rgba(253,224,71,0.12)' : 'rgba(8,2,18,0.7)',
                border: `1px solid ${on ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.25)'}`,
                font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.08em',
                color: on ? GOLD : '#c4a4d8',
              }}>{DIFF_LABEL[d]}</button>
            );
          })}
        </div>
        <div style={{ font: "500 9.5px 'Rajdhani',sans-serif", color: '#9a90b8', textAlign: 'center', marginBottom: 14 }}>
          {archetype?.tagline} — {archetype?.variants?.[difficulty]}
        </div>

        {/* Phase-grouped 12-level ladder */}
        {phases.map((ph) => {
          const accent = PHASE_ACCENT[ph.phase] || VIOLET;
          return (
            <div key={ph.phase} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ font: "700 8px 'Orbitron',sans-serif", color: accent, letterSpacing: '0.18em' }}>{ph.phase_label}</span>
                <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
                <span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#6f6690' }}>L{ph.levels[0].level}–{ph.levels[ph.levels.length - 1].level}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ph.levels.map((lv) => {
                  const isNext = lv.level === 1;            // v0: L1 up next, rest locked
                  const isBoss = lv.phase === 'final_boss';
                  const rt = roundTemplate(discKey, lv.level, difficulty);
                  return (
                    <button key={lv.level} onClick={() => setOpenLevel(lv.level)} style={{
                      display: 'flex', alignItems: 'center', gap: 11, borderRadius: 11, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                      background: isNext ? 'rgba(253,224,71,0.07)' : 'rgba(12,4,24,0.7)',
                      border: `1px solid ${isNext ? 'rgba(253,224,71,0.5)' : isBoss ? 'rgba(253,224,71,0.28)' : 'rgba(168,85,247,0.22)'}`,
                      opacity: isNext || isBoss ? 1 : 0.62,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isNext ? 'rgba(253,224,71,0.14)' : 'rgba(168,85,247,0.08)',
                        border: `1px solid ${isNext ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.3)'}`,
                        boxShadow: isNext ? '0 0 12px rgba(253,224,71,0.3)' : 'none',
                      }}>
                        {isBoss ? <Trophy size={16} color={GOLD} />
                          : isNext ? <span style={{ font: "800 13px 'Orbitron',sans-serif", color: GOLD }}>{lv.level}</span>
                          : <Lock size={13} color="#6f6690" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ font: "800 12px 'Orbitron',sans-serif", color: isNext ? GOLD : '#d7c9ee', letterSpacing: '0.04em' }}>
                            {isBoss ? 'TITLE FIGHT' : `LEVEL ${lv.level}`}
                          </span>
                          {isNext && <span style={{ font: "700 6.5px 'Press Start 2P',monospace", color: '#0a0014', background: GOLD, borderRadius: 4, padding: '3px 5px' }}>UP NEXT</span>}
                          {isSplitAvailable(lv.level) && <span style={{ font: "700 7px 'Orbitron',sans-serif", color: '#7fd6c8', border: '1px solid rgba(45,212,191,0.35)', borderRadius: 4, padding: '1px 5px' }}>AM/PM</span>}
                        </div>
                        <div style={{ font: "500 9.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rt.activeMinutesTarget ? `~${rt.activeMinutesTarget} min` : `${rt.rounds}×${mmss(rt.roundSec)}`} · {lv.combat_emphasis[0]}
                        </div>
                      </div>
                      <ChevronRight size={15} color="#6f6690" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ font: "500 9px 'Rajdhani',sans-serif", color: '#6f6690', textAlign: 'center', marginTop: 4, lineHeight: 1.4 }}>
          Session runner, archetype picker & readiness check are next.<br />Timers below are live from the camp engine.
        </div>
      </div>

      {/* Session card — previews real engine output for the tapped level. */}
      {open && (
        <div onClick={() => setOpenLevel(null)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,0,10,0.72)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', background: 'linear-gradient(180deg, rgba(20,8,36,0.98), rgba(8,2,18,0.98))',
            borderTop: `1px solid ${PHASE_ACCENT[open.phase] || VIOLET}66`, borderRadius: '16px 16px 0 0', padding: '16px 18px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ font: "700 8px 'Orbitron',sans-serif", color: PHASE_ACCENT[open.phase] || VIOLET, letterSpacing: '0.16em' }}>{open.phase_label}</div>
                <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.03em' }}>{open.phase === 'final_boss' ? 'TITLE FIGHT' : `LEVEL ${open.level}`}</div>
              </div>
              <button onClick={() => setOpenLevel(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#9a90b8" /></button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 9, padding: '9px 10px', textAlign: 'center' }}>
                <div style={{ font: "900 13px 'Orbitron',sans-serif", color: GOLD }}>{DIFF_LABEL[difficulty]}</div>
                <div style={{ font: "600 6.5px 'Press Start 2P',monospace", color: '#c4a4d8', letterSpacing: '0.08em', marginTop: 3 }}>DIFFICULTY</div>
              </div>
              <div style={{ flex: 2, background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '9px 10px', textAlign: 'center' }}>
                <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff' }}>{previewLine(openRt)}</div>
                <div style={{ font: "600 6.5px 'Press Start 2P',monospace", color: '#c4a4d8', letterSpacing: '0.08em', marginTop: 3 }}>ROUND PLAN{openRt.taperApplied ? ' · TAPER' : ''}</div>
              </div>
            </div>

            <div style={{ marginBottom: 6, font: "700 8px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.12em' }}>COMBAT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {open.combat_emphasis.map((c, i) => <span key={i} style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#d7c9ee', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 6, padding: '3px 8px' }}>{c}</span>)}
            </div>
            <div style={{ marginBottom: 6, font: "700 8px 'Orbitron',sans-serif", color: '#7fd6c8', letterSpacing: '0.12em' }}>PHYSICAL</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              {open.physical_emphasis.map((c, i) => <span key={i} style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#bfe9e1', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.22)', borderRadius: 6, padding: '3px 8px' }}>{c}</span>)}
            </div>

            <button disabled style={{ width: '100%', height: 44, borderRadius: 11, border: '1px dashed rgba(253,224,71,0.4)', background: 'rgba(253,224,71,0.06)', color: 'rgba(253,224,71,0.75)', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.1em', cursor: 'not-allowed' }}>
              ▶ START — RUNNER COMING SOON
            </button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
