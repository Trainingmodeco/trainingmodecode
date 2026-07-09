export default function PressStartButton({ barPhase, fillPct }) {
  const isLoading = barPhase === 'loading';
  const isDone    = barPhase === 'done';

  return (
    <div style={{ animation: 'stagger-in 0.5s ease 1.15s both', width: '100%' }}>
      <div style={{
        fontFamily: "'Press Start 2P',monospace",
        fontSize: 6,
        color: isDone ? 'transparent' : 'rgba(168,85,247,0.75)',
        letterSpacing: '0.28em', textAlign: 'center', marginBottom: 10,
        transition: 'color 0.3s',
      }}>
        {isLoading ? 'LOADING...' : isDone ? '' : 'TAP ANYWHERE TO ENTER'}
      </div>

      <div style={{ width: '100%', userSelect: 'none' }}>
        <div style={{
          width: '100%', height: 5, borderRadius: 999,
          background: 'rgba(20,0,40,0.85)',
          border: '1px solid rgba(168,85,247,0.55)',
          boxShadow: '0 0 0 1px rgba(168,85,247,0.2) inset, 0 0 16px rgba(168,85,247,0.3)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: `${fillPct}%`,
            background: 'linear-gradient(90deg, #5b21b6, #a855f7, #c084fc)',
            boxShadow: '0 0 14px rgba(168,85,247,0.9), 0 0 28px rgba(168,85,247,0.5)',
            position: 'relative', overflow: 'hidden',
            transition: 'width 0.02s linear',
          }}>
            {isLoading && (
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: '30%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                animation: 'bar-shimmer 1.2s linear infinite',
              }}/>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 5, opacity: isLoading || isDone ? 1 : 0,
          transition: 'opacity 0.2s',
        }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, color: 'rgba(168,85,247,0.5)', letterSpacing: '0.15em' }}>
            TRAINING MODE
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: 'rgba(168,85,247,0.8)', letterSpacing: '0.1em' }}>
            {Math.round(fillPct)}%
          </div>
        </div>
      </div>
    </div>
  );
}
