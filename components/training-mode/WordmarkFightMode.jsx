import { C } from './Styles';

export default function WordmarkFightMode({ height = 36 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
        fontSize: Math.round(height * 0.4), color: C.yellow,
        letterSpacing: '0.12em', lineHeight: 1,
        textShadow: '0 0 10px rgba(253,224,71,0.4)',
      }}>FIGHT MODE</div>
      <div style={{
        fontFamily: "'Press Start 2P',monospace",
        fontSize: Math.round(height * 0.18), color: C.muted,
        letterSpacing: '0.2em', lineHeight: 1,
      }}>TRAIN · FIGHT · WIN</div>
    </div>
  );
}
