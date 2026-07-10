import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SharePromptModal from './SharePromptModal';
import MissionIntegrityBanner from './MissionIntegrityBanner';
import SafeImage from './SafeImage';
import { MessageSquare } from 'lucide-react';
import { C } from './Styles';
import { loadStats, getStreak, getLevel } from './data/userStats';
import { calculatePartialXp } from './utils/missionIntegrity';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from './data/links';

function Stat({ label, value }) {
  return (
    <div className="neon-frame" style={{ borderRadius: 10, padding: '10px 6px', textAlign: 'center', background: 'rgba(20,0,35,0.7)' }}>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: C.yellow, fontSize: 14, letterSpacing: '0.1em', marginTop: 3 }}>{value}</div>
    </div>
  );
}

export default function SessionSummary({ discipline, rounds, cfg, completedRounds, integrityResult, onAgain, onBack, onHome }) {
  const completed = typeof completedRounds === 'number' ? completedRounds : rounds.length;
  const totalPlanned = cfg.rounds || rounds.length;
  const stoppedEarly = completed < totalPlanned;
  const displayRounds = rounds.slice(0, completed);

  const totalMin = Math.round(
    (completed * cfg.roundMin * 60 + Math.max(0, completed - 1) * cfg.restSec) / 60
  );

  const [stats] = useState(() => loadStats());
  const streak = getStreak(stats);
  const level = getLevel(stats.xp);
  const xpPerRound = 20;
  const sessionBonus = completed === totalPlanned ? 50 : 0;
  const baseXp = completed * xpPerRound + sessionBonus;
  const xpEarned = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const modeName = cfg.mode === 'Combo Coach' ? 'Combo Coach' : 'Fight Focus';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes trophy-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(253,224,71,0.5), 0 0 40px rgba(253,224,71,0.2); }
          50% { transform: scale(1.06); box-shadow: 0 0 28px rgba(253,224,71,0.7), 0 0 56px rgba(253,224,71,0.3); }
        }
      `}}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '18px 18px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', background: C.panel,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'visible',
            boxShadow: stoppedEarly
              ? '0 0 16px rgba(168,85,247,0.4)'
              : '0 0 20px rgba(253,224,71,0.5), 0 0 40px rgba(253,224,71,0.2)',
            animation: stoppedEarly ? 'none' : 'trophy-pulse 2.5s ease-in-out infinite',
          }}>
            <SafeImage
              src="/rewards/trophy-fight-mode.png"
              fallbackSrc="/rewards/trophy-fight-mode.svg"
              alt="Trophy"
              style={{ width: 82, height: 82, objectFit: 'contain', display: 'block', opacity: stoppedEarly ? 0.5 : 1 }}
            />
          </div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: C.neon, letterSpacing: '0.25em', marginTop: 4 }}>
            {stoppedEarly ? '✦ SESSION STOPPED ✦' : '✦ SESSION COMPLETE ✦'}
          </div>
          <h1 style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: C.yellow,
            fontSize: 26, letterSpacing: '0.12em',
            textShadow: '0 0 12px rgba(253,224,71,0.4)',
          }}>
            {stoppedEarly ? 'GOOD EFFORT' : 'GOOD WORK'}
          </h1>

          {/* Mid-session stop banner */}
          {stoppedEarly && (
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
              color: C.text, letterSpacing: '0.1em', marginTop: 2,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
            }}>
              {completed} of {totalPlanned} complete
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <Stat label="DISCIPLINE" value={discipline.slice(0, 3).toUpperCase()}/>
          <Stat label="ROUNDS" value={`${completed}/${totalPlanned}`}/>
          <Stat label="MINUTES" value={totalMin}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          <Stat label="DIFFICULTY" value={cfg.difficulty.slice(0, 3).toUpperCase()}/>
          <Stat label="MODE" value={cfg.mode.slice(0, 5).toUpperCase()}/>
        </div>

        {/* Integrity Banner */}
        {integrityResult && (
          <div style={{ marginBottom: 12 }}>
            <MissionIntegrityBanner integrityResult={integrityResult} xpAwarded={xpEarned} />
          </div>
        )}

        {/* Round Recap */}
        <div className="no-scrollbar" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.yellow, fontSize: 10, letterSpacing: '0.25em', marginBottom: 6 }}>ROUND RECAP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {displayRounds.map((r, i) => (
              <div key={i} className="neon-frame" style={{
                borderRadius: 8, padding: '8px 10px', display: 'flex',
                alignItems: 'center', gap: 10, background: 'rgba(20,0,35,0.6)',
              }}>
                <div style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: 5,
                  background: 'rgba(10,0,20,0.8)', border: '1px solid rgba(253,224,71,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: C.yellow, fontSize: 11 }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.text, fontSize: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.round_title}</div>
                  <div style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.35)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.coach_prompt}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: '0.05em' }}>
                    {r.session_type.slice(0, 5).toUpperCase()}
                  </span>
                  <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: '#22c55e', letterSpacing: '0.05em' }}>
                    COMPLETE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {stoppedEarly && (
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: C.yellow,
                letterSpacing: '0.15em',
                textShadow: '0 0 10px rgba(253,224,71,0.5)',
              }}>Continue?</div>
            </div>
          )}
          <button onClick={onAgain} style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: C.yellow, color: C.bg, border: 'none',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: '0.2em',
            boxShadow: '0 0 20px rgba(253,224,71,0.5)', transition: 'transform 0.15s',
          }}>
            {stoppedEarly ? 'RETRY' : 'TRAIN AGAIN'}
          </button>
          <button onClick={onBack}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: 'rgba(20,0,35,0.7)', color: C.text,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.18em',
              transition: 'transform 0.15s',
            }}
            className="neon-frame">
            CHANGE DISCIPLINE
          </button>
          <button onClick={onHome} style={{
            width: '100%', padding: '6px 0', background: 'transparent', border: 'none',
            color: C.muted, fontSize: 12, letterSpacing: '0.18em',
            fontFamily: "'Rajdhani',sans-serif",
          }}>
            Back to Start
          </button>
        </div>

        <SharePromptModal placement="inline" shareData={{ mode: modeName, xpEarned, streak, level, completedCount: completed, totalCount: totalPlanned }}/>

        <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'rgba(253,224,71,0.06)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <MessageSquare size={12} color={C.yellow}/>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.yellow, letterSpacing: '0.08em' }}>GIVE BETA FEEDBACK</span>
        </button>

        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: C.muted, letterSpacing: '0.25em' }}>TRAIN · FIGHT · WIN</div>
        </div>
      </div>

    </PhoneFrame>
  );
}
