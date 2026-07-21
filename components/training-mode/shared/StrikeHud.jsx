// 1.4 — the live STRIKES pill on the ring-timer screens. Shows the running
// count once motion is enabled, or a "COUNT STRIKES" call-to-action that opens
// the placement/permission sheet. Hidden on devices with no motion access.
const VIOLET = '#a855f7';

export default function StrikeHud({ supported, permission, count, onOpen }) {
  if (!supported || permission === 'denied' || permission === 'unsupported') return null;

  const enabled = permission === 'granted';

  return (
    <button onClick={onOpen} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
      background: enabled ? 'rgba(168,85,247,0.16)' : 'rgba(16,4,30,0.8)',
      border: `1px solid ${enabled ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.3)'}`,
    }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>👊</span>
      {enabled ? (
        <>
          <span style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', lineHeight: 1, minWidth: 14, textAlign: 'right' }}>{count}</span>
          <span style={{ font: "700 7.5px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.1em' }}>STRIKES</span>
        </>
      ) : (
        <span style={{ font: "800 8.5px 'Orbitron',sans-serif", color: VIOLET, letterSpacing: '0.08em' }}>COUNT STRIKES</span>
      )}
    </button>
  );
}
