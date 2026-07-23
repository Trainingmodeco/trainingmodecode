import { useState, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft } from 'lucide-react';
import { getCampaign, arcadeStage, stageFormats, stageEquipment, resolveArcadeRounds } from './protocol/campaigns';
import { humanizeGoal } from './protocol/content';
import { canAccessStage, GATES } from './data/entitlements';

// Phase 2 · 2.10 slice 2 — S6 Arcade stage-selection screen (DESIGN-SPEC S6).
// Stacked config blocks over one campaign stage: HEADER · PATH · FORMAT (full arc)
// · DIFFICULTY · EQUIPMENT chips · WARNINGS · LIVE PREVIEW · START. Everything is
// data-driven from protocol/campaigns.ts; the preview re-renders as selectors
// change. START hands a launch context up (readiness → gear → runner is slice 3).
const GOLD = '#fde047';
const PHASE_C = { foundation: '#22c55e', development: '#a855f7', hard_camp: '#f59e0b', taper: '#2dd4bf', final_boss: '#ef4444' };
const PATHS = [['fit', 'FIT'], ['fight', 'FIGHT'], ['full_arc', 'FULL ARC']];
const DIFFS = [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']];

// Equipment id → icon. Broad map; unknown ids fall back to a dot.
const EQUIP_ICON = {
  OPEN_SPACE: '🧍', TIMER_PHONE: '⏱', WATER: '💧', ROPE: '🪢', JUMP_ROPE: '🪢',
  GLOVES: '🧤', HEAVY_BAG: '🥊', LIGHT_WEIGHTS: '🏋', KETTLEBELL: '🏋', BAND: '🧵',
  MAT: '🧘', PADS: '🎯', THAI_PADS: '🎯', PULLUP_BAR: '🏗', GRIP_TRAINER: '✊',
  SANDBAG: '🎒', MEDBALL: '⚽', ROAD: '🛣', FLOOR_SPACE: '🧘', DOORWAY_ROW: '🚪', BAND_ROW: '🧵',
};
const equipLabel = (id) => humanizeGoal(id);

function mmss(s) { return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`; }

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children, accent = GOLD, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: '1 1 0', minWidth: 62, padding: '7px 4px', borderRadius: 8,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      background: on ? `${accent}22` : 'rgba(8,2,18,0.5)',
      border: `1px solid ${on ? accent : 'rgba(168,85,247,0.28)'}`,
      font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.05em', color: on ? accent : '#c4a4d8',
    }}>{children}</button>
  );
}

export default function ArcadeStageSelect({ campaignId, stageId, onBack, onStart, onPaywall }) {
  const campaign = getCampaign(campaignId);
  const stage = arcadeStage(campaignId, stageId);
  const fmts = stageFormats(campaignId, stageId);
  const equip = stageEquipment(campaignId, stageId);

  const availablePaths = PATHS.filter(([p]) => (p === 'full_arc' ? fmts.fullArc : p === 'fit' ? fmts.fit : fmts.fight));
  const [path, setPath] = useState(() => (fmts.defaultFormat === 'fit' ? 'fit' : availablePaths[0]?.[0] || 'fight'));
  const [format, setFormat] = useState(fmts.split ? 'split' : 'full');
  const [fitDiff, setFitDiff] = useState('normal');
  const [fightDiff, setFightDiff] = useState('normal');

  const stageNum = stage?.stage_number || 1;
  const gated = !canAccessStage(stageNum);

  // Live preview — recomputed whenever path/difficulty change.
  const preview = useMemo(() => {
    const blocks = [];
    if (path === 'fit' || path === 'full_arc') {
      const p = resolveArcadeRounds(campaignId, stageId, 'fit', fitDiff);
      if (p) blocks.push({ kind: 'CONDITIONING', diff: fitDiff, ...p });
    }
    if (path === 'fight' || path === 'full_arc') {
      const p = resolveArcadeRounds(campaignId, stageId, 'fight', fightDiff);
      if (p) blocks.push({ kind: 'SKILL', diff: fightDiff, ...p });
    }
    return blocks;
  }, [campaignId, stageId, path, fitDiff, fightDiff]);

  const totalMin = preview.reduce((a, b) => a + (b.durationMin || Math.round((b.rounds * (b.roundSec + b.restSec)) / 60)), 0);

  const warnings = [];
  if (fightDiff === 'hard' || fitDiff === 'hard') warnings.push('Hard mode — experienced athletes; drop a level anytime.');
  if (equip.required?.length && !equip.required.every((id) => ['OPEN_SPACE', 'TIMER_PHONE', 'WATER'].includes(id))) {
    warnings.push('No kit? Every stage completes bodyweight — swaps show in the gear check.');
  }
  warnings.push('Stop on sharp pain, dizziness, or chest symptoms.');

  const start = () => {
    if (gated) { onPaywall?.(); return; }
    onStart?.({ campaignId, stageId, path, format: path === 'full_arc' ? format : 'single', fitDifficulty: fitDiff, fightDifficulty: fightDiff });
  };

  const accent = PHASE_C[stage?.phase] || '#a855f7';

  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0, background:
        `radial-gradient(120% 55% at 50% 0%, ${accent}33, transparent 55%), linear-gradient(180deg,#1a0a2e 0%,#10061f 50%,#0a0416 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 5, padding: '10px 14px 28px' }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><ChevronLeft size={20} color="#d7c9ee" /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 7px 'Orbitron',sans-serif", color: accent, letterSpacing: '0.1em' }}>{(campaign?.name || campaignId).split('—')[0].trim()}</div>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>STAGE {stageNum} · {stage?.title || ''}</div>
          </div>
        </div>

        {/* HEADER card — phase · duration · xp · mission */}
        <div style={{ background: 'rgba(16,7,32,0.7)', border: `1px solid ${accent}55`, borderRadius: 13, padding: '11px 13px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ font: "800 7px 'Orbitron',sans-serif", color: accent, letterSpacing: '0.08em', background: `${accent}1f`, border: `1px solid ${accent}55`, borderRadius: 5, padding: '2px 6px' }}>{String(stage?.phase || '').replace('_', ' ').toUpperCase()}</span>
            <span style={{ font: "700 8px 'Rajdhani',sans-serif", color: '#b9a9d8' }}>~{totalMin} min · +{totalMin * 10} XP</span>
            {stage?.persona && <span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#8b7fb0' }}>· {stage.persona}</span>}
          </div>
          <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#e6d9ff', lineHeight: 1.3 }}>{stage?.mission_target || stage?.purpose || ''}</div>
        </div>

        {/* PATH */}
        <Row label="PATH">
          {availablePaths.map(([p, lbl]) => <Pill key={p} on={path === p} onClick={() => setPath(p)} accent={accent}>{lbl}</Pill>)}
        </Row>

        {/* FORMAT (full arc only) */}
        {path === 'full_arc' && fmts.split && (
          <Row label="FORMAT">
            <Pill on={format === 'split'} onClick={() => setFormat('split')} accent="#2dd4bf">SPLIT · 2 DAYS</Pill>
            <Pill on={format === 'full'} onClick={() => setFormat('full')} accent="#2dd4bf">FULL · 1 SITTING</Pill>
          </Row>
        )}

        {/* DIFFICULTY — one row per active path */}
        {(path === 'fit' || path === 'full_arc') && (
          <Row label={path === 'full_arc' ? 'FIT DIFFICULTY' : 'DIFFICULTY'}>
            {DIFFS.map(([d, lbl]) => <Pill key={d} on={fitDiff === d} onClick={() => setFitDiff(d)} accent="#2dd4bf">{lbl}</Pill>)}
          </Row>
        )}
        {(path === 'fight' || path === 'full_arc') && (
          <Row label={path === 'full_arc' ? 'FIGHT DIFFICULTY' : 'DIFFICULTY'}>
            {DIFFS.map(([d, lbl]) => <Pill key={d} on={fightDiff === d} onClick={() => setFightDiff(d)} accent={GOLD}>{lbl}</Pill>)}
          </Row>
        )}

        {/* EQUIPMENT chips */}
        <Row label="EQUIPMENT">
          {equip.required.map((id) => (
            <span key={id} title={equipLabel(id)} style={{ font: "700 8px 'Rajdhani',sans-serif", color: '#e6d9ff', background: 'rgba(168,85,247,0.16)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 6, padding: '3px 7px' }}>{EQUIP_ICON[id] || '•'} {equipLabel(id)}</span>
          ))}
          {equip.recommended.map((id) => (
            <span key={id} title={`${equipLabel(id)} (recommended)`} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', background: 'rgba(8,2,18,0.5)', border: '1px solid rgba(168,85,247,0.22)', borderRadius: 6, padding: '3px 7px' }}>{EQUIP_ICON[id] || '•'} {equipLabel(id)}</span>
          ))}
        </Row>

        {/* WARNINGS */}
        <div style={{ marginBottom: 11 }}>
          {warnings.map((w, i) => <div key={i} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#8b7fb0', lineHeight: 1.35 }}>⚠ {w}</div>)}
        </div>

        {/* LIVE PREVIEW */}
        <div style={{ background: 'rgba(8,2,18,0.55)', border: '1px solid rgba(168,85,247,0.28)', borderRadius: 10, padding: '10px 12px', marginBottom: 13 }}>
          <div style={{ font: "700 7px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.12em', marginBottom: 7 }}>PREVIEW</div>
          {preview.map((b, i) => (
            <div key={i} style={{ marginBottom: i < preview.length - 1 ? 9 : 0 }}>
              <div style={{ font: "800 9px 'Orbitron',sans-serif", color: b.kind === 'SKILL' ? GOLD : '#2dd4bf', letterSpacing: '0.04em' }}>{b.kind} · {b.diff.toUpperCase()}</div>
              <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff', margin: '2px 0 4px' }}>{b.rounds} × {mmss(b.roundSec)}{b.restSec ? ` · ${b.restSec}s rest` : ''}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {b.goals.slice(0, 6).map((g, k) => <span key={k} style={{ font: "600 7.5px 'Rajdhani',sans-serif", color: '#d7c9ee', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 5, padding: '2px 6px' }}>{humanizeGoal(g)}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* START */}
        {gated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 9px', borderRadius: 8, background: 'rgba(253,224,71,0.09)', border: '1px solid rgba(253,224,71,0.4)' }}>
            <span style={{ fontSize: 12 }}>👑</span>
            <span style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#facc15', lineHeight: 1.25 }}>Stages 1–{GATES.freeArcadeStages} are free. Go Pro for the full campaign.</span>
          </div>
        )}
        <button onClick={start} style={{ width: '100%', height: 42, borderRadius: 11, border: 'none', background: gated ? 'linear-gradient(135deg,#fde047,#f59e0b)' : `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#0a0014', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.07em', cursor: 'pointer', boxShadow: '0 0 18px rgba(253,224,71,0.35)' }}>
          {gated ? '👑 UNLOCK WITH PRO' : '▶ START'}
        </button>
      </div>
    </PhoneFrame>
  );
}
