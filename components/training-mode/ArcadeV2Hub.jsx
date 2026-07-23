import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, Lock, Check } from 'lucide-react';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { arcadeCampaigns, campaignStages } from './protocol/campaigns';
import { highestCleared } from './data/arcadeCampaignProgress';

// Phase 2 · 2.10 slice 2 — Arcade v2 entry: pick a campaign (the five original
// protocols), then a stage. Tapping a playable stage opens the S6 stage-select
// (ArcadeStageSelect). Themed skins over the camp engine; names stay original.
const GOLD = '#fde047';
const PHASE_C = { foundation: '#22c55e', development: '#a855f7', hard_camp: '#f59e0b', taper: '#2dd4bf', final_boss: '#ef4444' };
const CAMP_ACCENT = {
  ARC_BAKI: '#ef4444', ARC_DARKKNIGHT: '#f59e0b', ARC_BERSERK: '#a855f7',
  ARC_ULTRAINSTINCT: '#38bdf8', ARC_ULTRAEGO: '#c084fc',
};
const shortName = (name) => (name || '').split('—')[0].trim();

export default function ArcadeV2Hub({ onBack, onHome, onSelectStage }) {
  const [campaignId, setCampaignId] = useState(arcadeCampaigns[0]?.id);
  const [helpOpen, setHelpOpen] = useState(false);
  const stages = campaignStages(campaignId);
  const cleared = highestCleared(campaignId);
  const current = Math.min(12, cleared + 1);
  const accent = CAMP_ACCENT[campaignId] || '#a855f7';
  const meta = arcadeCampaigns.find((c) => c.id === campaignId);

  return (
    <PhoneFrame>
      <div style={{ position: 'absolute', inset: 0, background:
        `radial-gradient(120% 50% at 50% 0%, ${accent}30, transparent 55%), linear-gradient(180deg,#160a26 0%,#0d0519 55%,#08030f 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px 6px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><ChevronLeft size={20} color="#d7c9ee" /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#5eead4', letterSpacing: '0.05em', textShadow: '0 0 14px rgba(94,234,212,0.4)' }}>TRAINING ARCADE</div>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#b9a9d8', letterSpacing: '0.03em', marginTop: 1 }}>Themed protocols · train like a legend, safely.</div>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)} />
        </div>

        {/* campaign selector — horizontal chips */}
        <div className="no-scrollbar" style={{ flexShrink: 0, display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 14px 8px' }}>
          {arcadeCampaigns.map((c) => {
            const on = c.id === campaignId;
            const ac = CAMP_ACCENT[c.id] || '#a855f7';
            return (
              <button key={c.id} onClick={() => setCampaignId(c.id)} style={{
                flexShrink: 0, minWidth: 118, textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                background: on ? `${ac}1f` : 'rgba(8,2,18,0.55)', border: `1px solid ${on ? ac : 'rgba(168,85,247,0.25)'}`,
                boxShadow: on ? `0 0 14px ${ac}33` : 'none',
              }}>
                <div style={{ font: "800 9px 'Orbitron',sans-serif", color: on ? ac : '#d7c9ee', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{shortName(c.name)}</div>
                <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b7fb0', marginTop: 2 }}>{c.stageCount} stages · {c.paths.length} paths</div>
              </button>
            );
          })}
        </div>

        {/* tagline */}
        {meta?.tagline && <div style={{ flexShrink: 0, padding: '0 16px 6px', font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', fontStyle: 'italic' }}>“{meta.tagline}”</div>}

        {/* stage grid */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 12px calc(96px + env(safe-area-inset-bottom,0px))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stages.map((s) => {
              const n = s.stage_number;
              const state = n < current ? 'done' : n === current ? 'current' : 'locked';
              const pc = PHASE_C[s.phase] || '#a855f7';
              const boss = s.phase === 'final_boss';
              const locked = state === 'locked';
              return (
                <button key={s.stage_id} disabled={locked} onClick={() => onSelectStage?.(campaignId, s.stage_id)} style={{
                  textAlign: 'left', padding: '10px 11px', borderRadius: 11, cursor: locked ? 'not-allowed' : 'pointer',
                  background: 'rgba(16,7,32,0.66)', border: `1px solid ${state === 'current' ? GOLD : boss ? '#ef4444' : `${pc}44`}`,
                  opacity: locked ? 0.55 : 1, position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ font: "900 13px 'Orbitron',sans-serif", color: state === 'current' ? GOLD : boss ? '#ff6b6b' : '#e6d9ff' }}>{boss ? '🏆' : String(n).padStart(2, '0')}</span>
                    {state === 'done' ? <Check size={13} color="#22c55e" strokeWidth={3} /> : locked ? <Lock size={11} color="#8b7fb0" /> : <span style={{ font: "700 6px 'Press Start 2P',monospace", color: GOLD }}>GO</span>}
                  </div>
                  <div style={{ font: "700 8.5px 'Orbitron',sans-serif", color: state === 'current' ? '#fff' : '#c4a4d8', letterSpacing: '0.02em', lineHeight: 1.25, minHeight: 22 }}>{s.title}</div>
                  <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: pc, marginTop: 3, letterSpacing: '0.04em' }}>{String(s.phase || '').replace('_', ' ').toUpperCase()}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.arcade_saga_select} onClose={() => setHelpOpen(false)} />}
    </PhoneFrame>
  );
}
