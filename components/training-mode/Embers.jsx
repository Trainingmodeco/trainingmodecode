export default function Embers({ count = 18 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ember" style={{
          left: `${(i * 17) % 100}%`,
          animationDuration: `${5 + (i % 5)}s`,
          animationDelay: `${(i * 0.4) % 6}s`,
          opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}
