import { useMemo } from 'react';
import { qrMatrix } from '../data/qrCode';

// Renders a scannable QR for `value` as a crisp SVG (one <path> of dark modules
// over a light quiet-zone background). Returns null if the value is too large
// for the encoder's envelope (the caller then shows just the code/link).
export default function QRCode({ value, size = 168, quiet = 4, dark = '#0a0014', light = '#ffffff' }) {
  const mx = useMemo(() => qrMatrix(value), [value]);
  if (!mx) return null;
  const n = mx.size;
  const dim = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (mx.modules[r][c]) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', borderRadius: 8 }}
      role="img"
      aria-label="Challenge QR code"
    >
      <rect width={dim} height={dim} fill={light} />
      <path d={d} fill={dark} />
    </svg>
  );
}
