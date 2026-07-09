export default function SecondaryButton({ children, onClick, disabled = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 52,
        borderRadius: 13,
        border: 'none',
        background: 'linear-gradient(to bottom, #b975ff, #a855f7)',
        color: '#fff',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '0 28px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: '0 0 14px rgba(168,85,247,0.35)',
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
