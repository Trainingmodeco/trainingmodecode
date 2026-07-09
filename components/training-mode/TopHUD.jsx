export default function TopHUD() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      <div style={{
        position: 'absolute', top: '22%', left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.55), transparent)',
        transform: 'rotate(-4deg)',
      }}/>
      <div style={{
        position: 'absolute', top: '30%', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.35), transparent)',
        transform: 'rotate(-3deg)',
      }}/>
      <div style={{
        position: 'absolute', top: '36%', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.22), transparent)',
        transform: 'rotate(-2deg)',
      }}/>
    </div>
  );
}
