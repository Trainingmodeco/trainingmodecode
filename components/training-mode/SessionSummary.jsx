import MissionComplete from './shared/MissionComplete';
import { C } from './Styles';
import { calculatePartialXp } from './utils/missionIntegrity';
import { disciplineSlug } from './data/arsenal';
import { loadProfile } from './data/userProfile';

// GOOD EFFORT hero = the discipline's fighter portrait (by sex), framed on the
// stopped-session screen. Files use underscores (muay_thai), the slug uses a
// hyphen (muay-thai).
function partialPortraitFor(discipline) {
  const disc = disciplineSlug(discipline).replace('-', '_');
  const sex = String(loadProfile()?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  return `/discipline-cards/${disc}_${sex}.webp`;
}

// Fight Focus / Combo Coach session complete — rendered by the shared
// design-24f screen, with a round-by-round recap as the extra card.
const GOLD = '#fde047';

export default function SessionSummary({ discipline, rounds, cfg, completedRounds, integrityResult, fightStats, onAgain, onBack, onHome }) {
  const completed = typeof completedRounds === 'number' ? completedRounds : rounds.length;
  const totalPlanned = cfg.rounds || rounds.length;
  const stoppedEarly = completed < totalPlanned;
  const displayRounds = rounds.slice(0, completed);
  const totalMin = Math.round((completed * cfg.roundMin * 60 + Math.max(0, completed - 1) * cfg.restSec) / 60);

  const baseXp = completed * 20 + (completed === totalPlanned ? 50 : 0);
  const xp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const isCombo = cfg.mode === 'Combo Coach';
  const modeName = isCombo ? 'Combo Coach' : 'Fight Focus';

  // 1.5 — Combo Coach knows how many strikes it called and the best streak, so
  // it shows ROUNDS · STRIKES · STREAK. Fight Focus has no combo call-outs, so
  // it keeps ROUNDS · MINUTES.
  const statRow = isCombo
    ? [
        { value: `${completed}/${totalPlanned}`, label: 'ROUNDS', color: GOLD },
        { value: String(fightStats?.strikes ?? 0), label: 'STRIKES', color: '#fff' },
        { value: `${fightStats?.peakStreak ?? 0}`, label: 'BEST STREAK', color: '#fff' },
      ]
    : [
        { value: `${completed}/${totalPlanned}`, label: 'ROUNDS', color: GOLD },
        { value: String(totalMin), label: 'MINUTES', color: '#fff' },
      ];

  // LT-5 — one tight line per round, capped, so a 12-round session can't push
  // the outcome screen past a single viewport.
  const RECAP_MAX = 3;
  const recap = displayRounds.length > 0 ? (
    <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 11, padding: '9px 12px' }}>
      <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 6 }}>ROUND RECAP</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {displayRounds.slice(0, RECAP_MAX).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, background: 'rgba(10,0,20,0.8)', border: '1px solid rgba(253,224,71,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ font: "900 9px 'Orbitron',sans-serif", color: GOLD }}>{i + 1}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, font: "700 10.5px 'Orbitron',sans-serif", color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.round_title}</div>
            <span style={{ font: "6px 'Press Start 2P',monospace", color: '#22c55e', letterSpacing: '0.05em', flexShrink: 0 }}>DONE</span>
          </div>
        ))}
        {displayRounds.length > RECAP_MAX && (
          <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#9a90b8', paddingLeft: 26 }}>
            +{displayRounds.length - RECAP_MAX} more round{displayRounds.length - RECAP_MAX === 1 ? '' : 's'} completed
          </div>
        )}
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
      partialPortrait={partialPortraitFor(discipline)}
      integrityResult={integrityResult}
      stats={statRow}
      extra={recap}
      shareData={{ mode: modeName, completedCount: completed, totalCount: totalPlanned, difficulty: cfg.difficulty }}
      actions={[
        { label: stoppedEarly ? 'RETRY' : 'TRAIN AGAIN', onClick: onAgain, kind: 'primary' },
        { label: 'CHANGE DISCIPLINE', onClick: onBack, kind: 'secondary' },
        { label: 'BACK TO START', onClick: onHome, kind: 'ghost' },
      ]}
    />
  );
}
