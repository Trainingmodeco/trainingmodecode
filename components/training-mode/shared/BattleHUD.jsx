import { Pause, Play, Square, Check } from 'lucide-react';

// 31a — Battle HUD: the arcade live-stage skin. Purely presentational; the
// hosting player owns all timers, counting and voice. The stage is framed as a
// boss with an HP bar that drains as reps land.
const GOLD = '#fde047';

const HUD_STYLES = `
@keyframes hud-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes hud-rep-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes hud-pace-blink { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
`;

export default function BattleHUD({
  stageNumber, stageTitle,
  hp,                    // 0..1 stage HP remaining
  move, rep, target,
  combo, paceLabel,
  elapsedLabel, targetLabel, barFrac, ahead, starsInReach,
  paceStatusLabel,       // optional override for the "AHEAD OF PACE" line
  nextLabel, nextSub,
  announcerText, paused,
  onSetComplete, onPauseToggle, onStop,
  extras,
}) {
  const hpPct = Math.round(Math.max(0, Math.min(1, hp)) * 100);

  return (
    <div style={{
      position: 'relative', zIndex: 10, flex: 1, minHeight: 0, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      padding: '8px 14px 8px',
      animation: 'hud-fade-in 0.3s ease',
    }}>
      <style dangerouslySetInnerHTML={{ __html: HUD_STYLES }} />

      {/* Top: stage chip + HP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: '1px solid rgba(253,224,71,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11, color: '#fff', boxShadow: '0 0 8px rgba(168,85,247,0.5)' }}>
          {stageNumber}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9.5, color: GOLD, letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              STAGE {stageNumber} · {String(stageTitle || '').toUpperCase()}
            </span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: hpPct <= 25 ? '#fca5a5' : '#f5e9ff', marginLeft: 8 }}>{hpPct}%</span>
          </div>
          <div style={{ height: 9, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div style={{ width: `${hpPct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)', boxShadow: '0 0 10px rgba(249,115,22,0.6)', transition: 'width .35s ease' }} />
          </div>
          <div style={{ textAlign: 'right', marginTop: 2, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8, color: 'rgba(200,170,255,0.6)', letterSpacing: '0.08em' }}>
            STAGE HP · every rep hits
          </div>
        </div>
        <button onClick={onStop} aria-label="End stage" style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, alignSelf: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Square size={10} color="#ef4444" />
        </button>
      </div>

      {/* Centre: watermark + current move + counter */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Ghost stage watermark */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.05)' }}>STAGE</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 110, lineHeight: 0.9, color: 'rgba(255,255,255,0.055)' }}>{stageNumber}</div>
        </div>

        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 99, background: 'rgba(253,224,71,0.07)', border: '1px solid rgba(253,224,71,0.3)', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, color: GOLD, letterSpacing: '0.22em', marginBottom: 8 }}>
            CURRENT MOVE
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26, color: '#fff', letterSpacing: '0.04em', textShadow: '0 0 18px rgba(168,85,247,0.5)' }}>
            {String(move || '').toUpperCase()}
          </div>
          <div key={rep} style={{ marginTop: 2, animation: rep > 0 ? 'hud-rep-pop 0.2s ease-out' : 'none' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 52, color: GOLD, textShadow: '0 0 20px rgba(253,224,71,0.55)' }}>{rep}</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22, color: 'rgba(230,215,255,0.45)' }}>/{target}</span>
          </div>

          {/* Combo + pace pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '5px 13px', borderRadius: 99, background: 'rgba(10,2,20,0.75)', border: '1px solid rgba(253,224,71,0.3)' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: '#fff', letterSpacing: '0.06em' }}>
              x{combo} <span style={{ fontWeight: 700, fontSize: 7.5, color: 'rgba(200,170,255,0.75)', letterSpacing: '0.12em' }}>REP COMBO</span>
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(200,170,255,0.5)' }} />
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: paused ? '#fca5a5' : GOLD, letterSpacing: '0.1em' }}>
              {paused ? 'PAUSED' : paceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Pace panel */}
      <div style={{ flexShrink: 0, padding: '8px 12px 9px', borderRadius: 12, background: 'rgba(10,2,20,0.8)', border: '1px solid rgba(168,85,247,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff' }}>⏱ {elapsedLabel}</span>
          {targetLabel && <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: GOLD, letterSpacing: '0.08em' }}>TARGET {targetLabel}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ width: `${Math.round(Math.max(0, Math.min(1, barFrac)) * 100)}%`, height: '100%', borderRadius: 99, background: ahead ? 'linear-gradient(90deg,#22c55e,#a3e635)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)', boxShadow: ahead ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(245,158,11,0.5)', transition: 'width .4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, letterSpacing: '0.1em', color: ahead ? '#86efac' : '#fcd34d', animation: 'hud-pace-blink 2s ease-in-out infinite' }}>
            {paceStatusLabel || (ahead ? 'AHEAD OF PACE ▲' : 'BEHIND PACE ▼')}
          </span>
          {starsInReach && (
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, letterSpacing: '0.08em', color: GOLD }}>
              {starsInReach} within reach
            </span>
          )}
        </div>
      </div>

      {/* Announcer line */}
      <div style={{ flexShrink: 0, minHeight: 18, textAlign: 'center', margin: '6px 0 2px', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: paused ? GOLD : 'rgba(230,220,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {announcerText}
      </div>

      {/* Host-specific extras (cadence slider, backup controls, …) */}
      {extras}

      {/* Next up */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(14,3,26,0.85)', border: '1px solid rgba(168,85,247,0.22)', margin: '8px 0' }}>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: 'rgba(200,170,255,0.7)', letterSpacing: '0.14em', flexShrink: 0 }}>NEXT ▶</span>
        <span style={{ flex: 1, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: '#fff', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextLabel}</span>
        {nextSub && <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: 'rgba(200,170,255,0.6)', flexShrink: 0 }}>{nextSub}</span>}
      </div>

      {/* Set complete + pause */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
        <button onClick={onSetComplete} style={{
          flex: 1, height: 52, borderRadius: 13, cursor: 'pointer',
          background: 'linear-gradient(180deg,#ffe574 0%,#f7c33f 55%,#eaa62a 100%)',
          border: '1.5px solid rgba(255,238,150,0.9)',
          boxShadow: '0 0 18px rgba(253,224,71,0.35), 0 5px 0 #a9741a',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#2a1400', letterSpacing: '0.12em',
        }}>
          <Check size={16} strokeWidth={3} /> SET COMPLETE
        </button>
        <button onClick={onPauseToggle} aria-label={paused ? 'Resume' : 'Pause'} style={{
          width: 52, height: 52, borderRadius: 13, cursor: 'pointer', flexShrink: 0,
          background: paused ? 'rgba(253,224,71,0.14)' : 'rgba(16,4,30,0.85)',
          border: `1.5px solid ${paused ? GOLD : 'rgba(168,85,247,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {paused ? <Play size={20} color={GOLD} /> : <Pause size={20} color="#e6d4ff" />}
        </button>
      </div>
    </div>
  );
}
