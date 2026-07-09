import { C } from './Styles';
import { Lock } from 'lucide-react';

const MAP_STYLES = `
@keyframes constellation-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}
@keyframes constellation-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(253,224,71,0.4), 0 0 20px rgba(253,224,71,0.2); }
  50% { box-shadow: 0 0 14px rgba(253,224,71,0.7), 0 0 32px rgba(253,224,71,0.35); }
}
@keyframes boss-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(253,224,71,0.5), 0 0 28px rgba(168,85,247,0.3); transform: scale(1); }
  50% { box-shadow: 0 0 20px rgba(253,224,71,0.8), 0 0 40px rgba(168,85,247,0.5); transform: scale(1.05); }
}
@keyframes current-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.5), 0 0 18px rgba(253,224,71,0.2); }
  50% { box-shadow: 0 0 16px rgba(168,85,247,0.8), 0 0 30px rgba(253,224,71,0.4); }
}
`;

function getNodePositions(count) {
  const positions = [];
  const height = 420;
  const yStep = height / (count + 1);
  for (let i = 0; i < count; i++) {
    const y = yStep * (i + 1);
    const xOffset = Math.sin((i / (count - 1)) * Math.PI * 2.5) * 58;
    const x = 150 + xOffset;
    positions.push({ x, y });
  }
  return positions;
}

export default function ArcadeConstellationMap({ stages, currentStage, completedStageIds }) {
  const completed = new Set(completedStageIds || []);
  const positions = getNodePositions(stages.length);
  const mapHeight = 440;

  function getNodeState(stage, idx) {
    if (completed.has(stage.id)) return 'complete';
    if (stage.stageNumber === currentStage) return 'current';
    if (stage.stageNumber < currentStage) return 'complete';
    return 'locked';
  }

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
      <style dangerouslySetInnerHTML={{ __html: MAP_STYLES }}/>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto',
        height: mapHeight, background: 'radial-gradient(ellipse at center, rgba(20,0,50,0.6) 0%, rgba(5,0,16,0.9) 100%)',
        borderRadius: 14, border: '1px solid rgba(168,85,247,0.15)',
        overflow: 'hidden',
      }}>
        {/* Background stars */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.3 + (i % 5) * 0.12,
            }}/>
          ))}
        </div>

        {/* Connection lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox={`0 0 300 ${mapHeight}`} preserveAspectRatio="none">
          {positions.map((pos, i) => {
            if (i === 0) return null;
            const prev = positions[i - 1];
            const prevState = getNodeState(stages[i - 1], i - 1);
            const lineCompleted = prevState === 'complete';
            return (
              <line
                key={i}
                x1={prev.x} y1={prev.y}
                x2={pos.x} y2={pos.y}
                stroke={lineCompleted ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.2)'}
                strokeWidth={lineCompleted ? 2 : 1}
                strokeDasharray={lineCompleted ? 'none' : '4,4'}
              />
            );
          })}
        </svg>

        {/* Stage nodes */}
        {positions.map((pos, i) => {
          const stage = stages[i];
          const state = getNodeState(stage, i);
          const isBoss = stage.isFinalRound;
          const size = isBoss ? 38 : 28;

          return (
            <div key={stage.id} style={{
              position: 'absolute',
              left: pos.x - size / 2,
              top: pos.y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column',
              background: state === 'complete'
                ? 'radial-gradient(circle, rgba(253,224,71,0.25), rgba(168,85,247,0.15))'
                : state === 'current'
                  ? 'radial-gradient(circle, rgba(168,85,247,0.3), rgba(253,224,71,0.1))'
                  : 'radial-gradient(circle, rgba(30,10,60,0.8), rgba(10,0,20,0.9))',
              border: state === 'complete'
                ? '2px solid rgba(253,224,71,0.7)'
                : state === 'current'
                  ? '2px solid rgba(168,85,247,0.8)'
                  : isBoss
                    ? '2px solid rgba(253,224,71,0.4)'
                    : '1.5px solid rgba(168,85,247,0.15)',
              boxShadow: state === 'complete'
                ? '0 0 10px rgba(253,224,71,0.4), 0 0 20px rgba(253,224,71,0.15)'
                : state === 'current'
                  ? '0 0 10px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.2)'
                  : isBoss
                    ? '0 0 12px rgba(253,224,71,0.25), 0 0 22px rgba(168,85,247,0.3)'
                    : 'none',
              animation: state === 'current'
                ? (isBoss ? 'boss-pulse 2.5s ease-in-out infinite' : 'current-glow 2.5s ease-in-out infinite')
                : state === 'complete'
                  ? 'none'
                  : 'none',
              transition: 'all 0.3s ease',
              opacity: state === 'locked' ? (isBoss ? 0.8 : 0.5) : 1,
            }}>
              {state === 'locked' ? (
                <Lock size={isBoss ? 13 : 10} color={isBoss ? 'rgba(253,224,71,0.6)' : 'rgba(168,85,247,0.4)'}/>
              ) : (
                <span style={{
                  fontFamily: "'Orbitron',sans-serif",
                  fontSize: isBoss ? 12 : 10,
                  fontWeight: 900,
                  color: state === 'complete' ? C.yellow : '#c4b5fd',
                }}>
                  {isBoss ? '\u2605' : stage.stageNumber}
                </span>
              )}
            </div>
          );
        })}

        {/* Stage labels */}
        {positions.map((pos, i) => {
          const stage = stages[i];
          const state = getNodeState(stage, i);
          const statusLabel = state === 'complete' ? 'CLEAR' : state === 'current' ? 'START' : 'LOCKED';
          const labelColor = state === 'complete'
            ? 'rgba(253,224,71,0.8)'
            : state === 'current'
              ? 'rgba(196,181,253,0.9)'
              : 'rgba(168,85,247,0.3)';

          return (
            <div key={`label-${stage.id}`} style={{
              position: 'absolute',
              left: pos.x - 50,
              top: pos.y + (stage.isFinalRound ? 26 : 20),
              width: 100,
              textAlign: 'center',
            }}>
              <span style={{
                fontFamily: "'Orbitron',sans-serif",
                fontSize: 6,
                fontWeight: 700,
                color: labelColor,
                letterSpacing: '0.08em',
                display: 'block',
              }}>
                {statusLabel}
              </span>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 7,
                fontWeight: 600,
                color: state === 'locked' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                letterSpacing: '0.02em',
              }}>
                {stage.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
