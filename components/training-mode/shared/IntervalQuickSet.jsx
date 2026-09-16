import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';

// The four numbers every interval timer is actually made of: warm-up, work,
// rest, rounds. Nothing else.
//
// They existed before, behind an EDIT button that opened a modal — so setting up
// a Tabata meant tapping the protocol, tapping EDIT, adjusting inside a sheet,
// and closing it, to reach a screen that then needed one more tap to start. For
// the bodyweight categories, where the timer IS the whole product and there is
// no distance or equipment to configure, that is the entire setup hidden behind
// a door. They are on the screen now, and the modal survives for the rarer
// settings (cool-down) rather than being the only way in.
//
// Steps are chosen to match how people actually think about these: warm-up in
// whole minutes, work and rest in five-second notches, rounds one at a time.
const FIELDS = [
  { key: 'warmupMin', label: 'WARM-UP', unit: 'MIN', min: 0, max: 15, step: 1 },
  { key: 'workSec', label: 'WORK', unit: 'SEC', min: 5, max: 300, step: 5 },
  { key: 'restSec', label: 'REST', unit: 'SEC', min: 0, max: 300, step: 5 },
  { key: 'rounds', label: 'ROUNDS', unit: 'SETS', min: 1, max: 30, step: 1 },
];

export default function IntervalQuickSet({ cfg, onChange }) {
  const set = (key, next, f) => onChange({ ...cfg, [key]: Math.min(f.max, Math.max(f.min, next)) });

  const btn = {
    width: 30, height: 30, flexShrink: 0, borderRadius: 8,
    border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(124,58,237,0.16)',
    color: '#d6c2ff', fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 900,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
      {FIELDS.map(f => {
        const value = Number(cfg?.[f.key]) || 0;
        return (
          <div key={f.key} style={{
            borderRadius: ARCADE.radius.sm, border: `1px solid ${ARCADE.violetBorderSoft}`,
            background: 'rgba(8,2,18,0.55)', padding: '7px 8px',
          }}>
            <div style={{ fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.14em', marginBottom: 4, textAlign: 'center' }}>
              {f.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" aria-label={`Decrease ${f.label.toLowerCase()}`} onClick={() => set(f.key, value - f.step, f)} style={btn}>−</button>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', marginLeft: 3 }}>{f.unit}</span>
              </div>
              <button type="button" aria-label={`Increase ${f.label.toLowerCase()}`} onClick={() => set(f.key, value + f.step, f)} style={btn}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
