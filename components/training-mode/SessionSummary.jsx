import MissionComplete from './shared/MissionComplete';
import { C } from './Styles';
import { calculatePartialXp } from './utils/missionIntegrity';

// Fight Focus / Combo Coach session complete — rendered by the shared
// design-24f screen, with a round-by-round recap as the extra card.
const GOLD = '#fde047';

export default function SessionSummary({ discipline, rounds, cfg, completedRounds, integrityResult, onAgain, onBack, onHome }) {
  const completed = typeof completedRounds === 'number' ? completedRounds : rounds.length;
  const totalPlanned = cfg.rounds || rounds.length;
  const stoppedEarly = completed < totalPlanned;
  const displayRounds = rounds.slice(0, completed);
  const totalMin = Math.round((completed * cfg.roundMin * 60 + Math.max(0, completed - 1) * cfg.restSec) / 60);

  const baseXp = completed * 20 + (completed === totalPlanned ? 50 : 0);
  const xp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const modeName = cfg.mode === 'Combo Coach' ? 'Combo Coach' : 'Fight Focus';

  const recap = displayRounds.length > 0 ? (
    <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '11px 14px' }}>
      <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 9 }}>ROUND RECAP</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {displayRounds.map((r, i) => (
          <div key={i} style={{ borderRadius: 8, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(20,0,35,0.6)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 5, background: 'rgba(10,0,20,0.8)', border: '1px solid rgba(253,224,71,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD, fontSize: 10 }}>{i + 1}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.text, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.round_title}</div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9.5, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.coach_prompt}</div>
            </div>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: '#22c55e', letterSpacing: '0.05em', flexShrink: 0 }}>DONE</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <MissionComplete
      variant={stoppedEarly ? 'partial' : 'success'}
      eyebrow={stoppedEarly ? 'SESSION STOPPED' : 'SESSION COMPLETE'}
      title={stoppedEarly ? 'GOOD EFFORT' : 'GOOD WORK'}
      subtitle={`${discipline} · ${cfg.difficulty} · ${modeName}`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fight.webp"
      integrityResult={integrityResult}
      stats={[
        { value: `${completed}/${totalPlanned}`, label: 'ROUNDS', color: GOLD },
        { value: String(totalMin), label: 'MINUTES', color: '#fff' },
      ]}
      extra={recap}
      shareData={{ mode: modeName, completedCount: completed, totalCount: totalPlanned }}
      actions={[
        { label: stoppedEarly ? 'RETRY' : 'TRAIN AGAIN', onClick: onAgain, kind: 'primary' },
        { label: 'CHANGE DISCIPLINE', onClick: onBack, kind: 'secondary' },
        { label: 'BACK TO START', onClick: onHome, kind: 'ghost' },
      ]}
    />
  );
}
