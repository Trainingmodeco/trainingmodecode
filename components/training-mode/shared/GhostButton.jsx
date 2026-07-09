export default function GhostButton({ children, onClick, disabled = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'transparent',
        color: '#f5e9ff',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '0 20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.18s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
