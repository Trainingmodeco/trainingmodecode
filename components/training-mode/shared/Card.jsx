import { C } from '../Styles';

export default function Card({ children, style = {}, className = '', onClick }) {
  return (
    <div
      className={`tm-hud-card ${className}`}
      onClick={onClick}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
