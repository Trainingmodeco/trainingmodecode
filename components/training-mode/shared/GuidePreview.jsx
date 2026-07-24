import { ChevronLeft, Volume2 } from 'lucide-react';

// 2.10 — how-to walkthrough props. A faithful, NON-interactive replica of the
// two screens the guide can't spotlight in place: the PATH + DIFFICULTY select
// modal and the round timer. The ScreenGuide overlay (higher z-index) dims this
// and spotlights each element in turn via its data-guide anchor. Nothing here is
// clickable — it exists only so "change to the timer page" shows the real layout
// without launching an actual session. Returns to the ladder when the guide ends.

const GOLD = '#fde047';
const TEAL = '#2dd4bf';

const chip = (label, on, ac) => ({
  flex: 1, padding: '9px 4px', borderRadius: 9, textAlign: 'center',
  background: on ? `${ac}22` : 'rgba(8,2,18,0.5)',
  border: `1px solid ${on ? ac : 'rgba(168,85,247,0.28)'}`,
  font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.04em',
  color: on ? ac : '#c4a4d8',
});

function SelectReplica({ series, stageTitle, stageNumber }) {
  const modes = series?.modeOptions || ['fight'];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div data-guide="ht-select" style={{ width: '92%', maxWidth: 320, background: 'rgba(16,7,32,0.96)', border: `1px solid ${GOLD}66`, borderRadius: 16, padding: '15px 16px 16px', boxShadow: '0 18px 50px rgba(0,0,0,0.65)' }}>
        <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em' }}>STAGE {stageNumber || 1} · SETUP</div>
        <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', marginBottom: 12 }}>{stageTitle || 'STAGE'}</div>

        <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 6 }}>PATH</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {modes.map((m, i) => {
            const lbl = m === 'both' ? 'FULL ARC' : m.toUpperCase();
            const ac = m === 'fit' ? TEAL : m === 'both' ? '#a855f7' : GOLD;
            return <div key={m} style={chip(lbl, i === 0, ac)}>{lbl}</div>;
          })}
        </div>

        <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 6 }}>DIFFICULTY</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 15 }}>
          {['easy', 'normal', 'hard'].map((d) => {
            const ac = d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#3b82f6';
            return <div key={d} style={chip(d.toUpperCase(), d === 'normal', ac)}>{d.toUpperCase()}</div>;
          })}
        </div>

        <div style={{ width: '100%', height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶ START</div>
      </div>
    </div>
  );
}

function TimerReplica() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar — back + title + volume */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <div data-guide="ht-back" style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e7ddf7' }}>
          <ChevronLeft size={22} />
        </div>
        <div style={{ font: "900 13px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.1em' }}>CONDITIONING</div>
        <div data-guide="ht-volume" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(45,212,191,0.14)', border: `1px solid ${TEAL}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL }}>
          <Volume2 size={20} />
        </div>
      </div>

      {/* Round chips */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 9px 'Orbitron',sans-serif", color: n === 1 ? '#041210' : '#c4a4d8', background: n === 1 ? TEAL : 'rgba(45,212,191,0.1)', border: `1px solid ${TEAL}44` }}>{n}</div>
        ))}
      </div>

      {/* Ring / timer */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div data-guide="ht-timer" style={{ width: 230, height: 230, borderRadius: '50%', border: `4px solid ${TEAL}`, boxShadow: `0 0 40px ${TEAL}44, inset 0 0 30px ${TEAL}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ font: "700 11px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.18em', marginBottom: 4 }}>WORK</div>
          <div style={{ font: "900 46px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em' }}>02:00</div>
        </div>
      </div>

      {/* Controls */}
      <div data-guide="ht-controls" style={{ padding: '0 16px calc(24px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ width: '100%', height: 48, borderRadius: 12, background: 'rgba(45,212,191,0.12)', border: `1px solid ${TEAL}66`, color: TEAL, font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>❚❚ PAUSE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, height: 44, borderRadius: 11, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', color: '#c9a6ff', font: "800 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▷ SKIP</div>
          <div style={{ flex: 1, height: 44, borderRadius: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.45)', color: '#fca5a5', font: "800 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☐ END</div>
        </div>
      </div>
    </div>
  );
}

export default function GuidePreview({ screen, series, stageTitle, stageNumber }) {
  if (!screen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'linear-gradient(180deg,#0a0016,#12061f 60%,#0a0016)' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', margin: '0 auto' }}>
        {screen === 'select'
          ? <SelectReplica series={series} stageTitle={stageTitle} stageNumber={stageNumber} />
          : <TimerReplica />}
      </div>
    </div>
  );
}
