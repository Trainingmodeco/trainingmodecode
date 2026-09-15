import { C } from '../Styles';
import { SPEED_STEP, fmtSpeed, speedUnitLabel, paceFromSpeed, clampSpeed } from '../data/machineSpeed';
import { fmtClock } from '../data/runCoach';

// The indoor distance control: match the number on the machine's console and
// the app tracks real distance from it.
//
// Design notes, both from what the athlete is actually doing while using it:
//
//  • The steps are 0.1, the same increment every treadmill console uses. A
//    coarser step would be quicker to reach a target but could not MATCH the
//    belt, which is the only job this control has.
//  • The targets are large (44px+) and the number does not change width as it
//    changes value, because this is tapped mid-run by someone breathing hard
//    and bouncing. fmtSpeed always renders one decimal for the same reason.
//  • It shows the PACE the speed implies, so the athlete can see the connection
//    between the console's number and the target they were given.
export default function SpeedDial({ speed, unit = 'mi', onChange, compact = false, disabled = false }) {
  const mono = "'Orbitron',sans-serif";
  const pace = paceFromSpeed(speed);
  const step = (dir) => { if (!disabled) onChange(clampSpeed(speed + dir * SPEED_STEP, unit)); };

  const btn = {
    width: compact ? 44 : 52,
    height: compact ? 44 : 52,
    flex: '0 0 auto',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.4)',
    background: 'rgba(124,58,237,0.16)',
    color: '#d6c2ff',
    fontFamily: mono,
    fontSize: 20,
    fontWeight: 900,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => step(-1)} aria-label="Decrease speed" style={btn}>−</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: 7, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.14em' }}>
            MACHINE SPEED
          </div>
          <div style={{ fontFamily: mono, fontSize: compact ? 26 : 32, fontWeight: 900, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {fmtSpeed(speed)}
            <span style={{ fontSize: 11, color: C.yellow, marginLeft: 5, letterSpacing: '0.08em' }}>{speedUnitLabel(unit)}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 7.5, fontWeight: 700, color: '#6f6790', marginTop: 1, whiteSpace: 'nowrap' }}>
            {pace ? `${fmtClock(pace)} /${unit}` : '—'}
          </div>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Increase speed" style={btn}>+</button>
      </div>
    </div>
  );
}
