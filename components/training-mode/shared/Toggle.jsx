export default function Toggle({ on, onToggle, style = {} }) {
  return (
    <div
      className={`tm-toggle${on ? ' on' : ''}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{ cursor: 'pointer', ...style }}
    >
      <div className="tm-toggle-knob" />
    </div>
  );
}
