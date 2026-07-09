const BLUE = '#60a5fa';

export default function WordmarkFitMode({ height = 36 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
        fontSize: Math.round(height * 0.4), color: BLUE,
        letterSpacing: '0.12em', lineHeight: 1,
        textShadow: '0 0 10px rgba(96,165,250,0.4)',
      }}>FIT MODE</div>
      <div style={{
        fontFamily: "'Press Start 2P',monospace",
        fontSize: Math.round(height * 0.18), color: 'rgba(96,165,250,0.5)',
        letterSpacing: '0.2em', lineHeight: 1,
      }}>BUILD · GROW · WIN</div>
    </div>
  );
}
