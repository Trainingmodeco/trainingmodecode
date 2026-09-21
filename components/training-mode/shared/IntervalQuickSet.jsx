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
// The unit rides on the VALUE now (3m, 20s, 8x) rather than sitting in its own
// span beside it. Four fields across one row instead of a 2x2 grid took this
// block from 129px to about 50, which is most of what a 667-tall phone needed
// to stop scrolling — and nothing was removed to get it.
const FIELDS = [
  { key: 'warmupMin', label: 'WARM-UP', suffix: 'm', min: 0, max: 15, step: 1 },
  { key: 'workSec', label: 'WORK', suffix: 's', min: 5, max: 300, step: 5 },
  { key: 'restSec', label: 'REST', suffix: 's', min: 0, max: 300, step: 5 },
  { key: 'rounds', label: 'ROUNDS', suffix: '×', min: 1, max: 30, step: 1 },
];

// `only` narrows the set to the fields that still do something. In ROUNDS with
// a generated session the player takes work, rest and rounds from the SESSION
// and reads just the warm-up from here (see sessionToIntervalConfig), so
// rendering all four put three dead steppers on the screen — the same defect
// as a swap button that cannot swap.
export default function IntervalQuickSet({ cfg, onChange, only = null, inline = false }) {
  const fields = only ? FIELDS.filter(f => only.includes(f.key)) : FIELDS;
  const set = (key, next, f) => onChange({ ...cfg, [key]: Math.min(f.max, Math.max(f.min, next)) });

  // 24px keeps the tap target usable at a quarter of a 375px screen. Below
  // that the plus and minus start missing under a thumb, which is worse than
  // scrolling.
  const btn = {
    width: 24, height: 24, flexShrink: 0, borderRadius: 7,
    border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(124,58,237,0.16)',
    color: '#d6c2ff', fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 900,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1, WebkitTapHighlightColor: 'transparent', padding: 0,
  };

  return (
    <div style={inline
      ? { display: 'flex', alignItems: 'center', gap: 5 }
      : { display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, fields.length)}, 1fr)`, gap: 5 }}>
      {fields.map(f => {
        const value = Number(cfg?.[f.key]) || 0;
        return (
          <div key={f.key} style={{
            borderRadius: ARCADE.radius.sm, border: `1px solid ${ARCADE.violetBorderSoft}`,
            background: 'rgba(8,2,18,0.55)', padding: inline ? '2px 5px' : '5px 4px', minWidth: 0,
            ...(inline ? { display: 'flex', alignItems: 'center', gap: 5 } : null),
          }}>
            <div style={{ fontFamily: ARCADE.fontHead, fontSize: 6.5, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.1em', marginBottom: inline ? 0 : 3, textAlign: 'center', whiteSpace: 'nowrap', display: inline ? 'none' : 'block' }}>
              {f.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button type="button" aria-label={`Decrease ${f.label.toLowerCase()}`} onClick={() => set(f.key, value - f.step, f)} style={btn}>−</button>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                {/* Three digits only happen at the far end of the range (300s,
                    30 rounds). Stepping down a point there keeps the number
                    clear of the +, rather than sizing every field for the
                    widest one it will almost never hold. */}
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: value >= 100 ? 12 : 14, fontWeight: 900, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {value}<span style={{ fontSize: 8, color: C.muted, marginLeft: 1 }}>{f.suffix}</span>
                </span>
              </div>
              <button type="button" aria-label={`Increase ${f.label.toLowerCase()}`} onClick={() => set(f.key, value + f.step, f)} style={btn}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
