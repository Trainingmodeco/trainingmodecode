// Empty / error states — pixel match of design 25d. A reusable state block plus
// three presets (no internet, GPS denied, first-run empty). Fills its container.
const PRESETS = {
  offline: {
    icon: '📡', title: 'NO CONNECTION',
    body: "Your session saves offline & syncs when you're back online.",
    primary: 'RETRY', primaryStyle: 'ghost',
  },
  gps: {
    icon: '🛰', title: 'GPS IS OFF',
    body: 'Outdoor runs need location. Or switch to Treadmill mode to track by time.',
    primary: 'ENABLE LOCATION', primaryStyle: 'violet', secondary: 'USE TREADMILL MODE',
  },
  firstRun: {
    icon: '📊', title: 'NO HISTORY YET',
    body: 'Finish your first bout and your progress, XP & trophies show up here.',
    primary: '▶ START FIRST BOUT', primaryStyle: 'gold',
  },
};

const BTN = {
  gold: { background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', border: 'none' },
  violet: { background: 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff', border: 'none' },
  ghost: { background: 'rgba(253,224,71,0.08)', color: '#fde047', border: '1px solid rgba(253,224,71,0.5)' },
};

export default function EmptyState({ preset = 'firstRun', icon, title, body, primary, primaryStyle, secondary, onPrimary, onSecondary, style }) {
  const p = PRESETS[preset] || PRESETS.firstRun;
  const _icon = icon ?? p.icon;
  const _title = title ?? p.title;
  const _body = body ?? p.body;
  const _primary = primary ?? p.primary;
  const _pStyle = primaryStyle ?? p.primaryStyle;
  const _secondary = secondary ?? p.secondary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 24px', minHeight: 260, ...style }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{_icon}</div>
      <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff', marginBottom: 6 }}>{_title}</div>
      <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 16, maxWidth: 240, lineHeight: 1.5 }}>{_body}</div>
      {_primary && (
        <button onClick={onPrimary} style={{ borderRadius: 10, padding: '10px 20px', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.05em', cursor: 'pointer', ...(BTN[_pStyle] || BTN.gold) }}>{_primary}</button>
      )}
      {_secondary && (
        <button onClick={onSecondary} style={{ marginTop: 10, background: 'none', border: 'none', font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.04em', cursor: 'pointer' }}>{_secondary}</button>
      )}
    </div>
  );
}
