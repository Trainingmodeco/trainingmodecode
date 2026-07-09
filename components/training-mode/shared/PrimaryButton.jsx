export default function PrimaryButton({ children, onClick, disabled = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 52,
        borderRadius: 13,
        border: 'none',
        background: 'linear-gradient(to bottom, #fde047, #f59e0b)',
        color: '#000',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '0 28px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: '0 0 18px rgba(253,224,71,0.4), 0 0 40px rgba(253,224,71,0.15)',
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
