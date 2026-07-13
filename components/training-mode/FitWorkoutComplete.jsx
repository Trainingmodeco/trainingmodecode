import MissionComplete from './shared/MissionComplete';

// Fit Mode / Workout Builder complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function FitWorkoutComplete({ cfg, completedCount, totalCount, cardioResult, onHome }) {
  const allDone = totalCount > 0 && completedCount >= totalCount;
  const xp = completedCount * 15 + (allDone ? 30 : 0);
  const exerciseLabel = totalCount > 0 ? `${completedCount}/${totalCount}` : `${completedCount}`;

  const chips = (
    <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '11px 14px' }}>
      <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 9 }}>SESSION SUMMARY</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cfg.muscleGroups.map(g => (
          <span key={g} style={{ font: "700 8px 'Orbitron',sans-serif", color: GOLD, padding: '3px 8px', borderRadius: 5, background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.2)' }}>{g.toUpperCase()}</span>
        ))}
        {cfg.addCardio && <span style={{ font: "700 8px 'Orbitron',sans-serif", color: '#ff8a4a', padding: '3px 8px', borderRadius: 5, background: 'rgba(255,138,74,0.08)', border: '1px solid rgba(255,138,74,0.25)' }}>HIIT</span>}
      </div>
    </div>
  );

  return (
    <MissionComplete
      variant={allDone ? 'success' : 'partial'}
      eyebrow={allDone ? 'WORKOUT COMPLETE' : 'SESSION ENDED'}
      title={allDone ? 'GREAT WORK' : 'GOOD EFFORT'}
      subtitle={`${cfg.muscleGroups.join(' + ')} · ${cfg.equipment} · ${cfg.difficulty}`}
      accent={GOLD}
      xp={xp}
      stats={[
        { value: exerciseLabel, label: 'EXERCISES', color: GOLD },
        { value: String(cfg.muscleGroups.length), label: 'MUSCLE FOCUS', color: '#fff' },
      ]}
      extra={chips}
      cardioResult={cardioResult}
      shareData={{ mode: 'Fit Mode', completedCount, totalCount }}
      actions={[
        { label: 'RETURN HOME', onClick: onHome, kind: 'primary' },
      ]}
    />
  );
}
