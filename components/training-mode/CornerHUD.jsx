export default function CornerHUD({ color = 'rgba(168,85,247,0.8)', size = 28, thickness = 2, inset = 20 }) {
  const corners = [
    { top: inset, left: inset,     rotate: '0deg'   },
    { top: inset, right: inset,    rotate: '90deg'  },
    { bottom: inset, left: inset,  rotate: '270deg' },
    { bottom: inset, right: inset, rotate: '180deg' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {corners.map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible"
            style={{
              transform: `rotate(${pos.rotate})`, display: 'block',
              filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 12px ${color})`,
              animation: `corner-h 0.6s ease ${i * 0.08}s both, corner-v 0.6s ease ${i * 0.08}s both`,
            }}>
            <line x1="0" y1="0" x2={size} y2="0" stroke={color} strokeWidth={thickness} strokeLinecap="round"/>
            <line x1="0" y1="0" x2="0" y2={size} stroke={color} strokeWidth={thickness} strokeLinecap="round"/>
          </svg>
        </div>
      ))}
    </div>
  );
}
