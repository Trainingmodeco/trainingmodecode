import { Play } from 'lucide-react';
import { RAISED_SKINS, RAISED_CSS, raisedShadow, cornerTick } from './TrainingCTA';
import { HEAD } from './FitSetupKit';

// Quick Mission's raised buttons (owner, 2026-11-25: "make it look unified";
// the flat and cut-corner buttons "look really flat", wanted "similar to the
// yellow button and the red buttons in combat training"). One look with AT
// YOUR PACE's PAUSE / STOP: the skins and the shadow come from TrainingCTA
// (RAISED_SKINS, raisedShadow), the one source of the raised style.
//
// Used ONLY from Quick Mission's own files. FitSetupKit's GoldButton,
// GhostButton, SegRow and ChipGroup stay as they are for every other screen
// (Workout Builder, Combat Conditioning, Fit Mode...).
//
// Corner ticks (owner, 2026-11-27: "fix"): AT YOUR PACE's buttons carry four
// small bracket marks in their corners; the LARGE primary buttons of Quick
// Mission now carry the same ones (QmTicks, from TrainingCTA's cornerTick, in
// the skin's own colour): QmGold and the big QmGhost (44px or more) by default,
// and the raw big buttons (guided PAUSE / STOP, MAX REPS DONE, ...) by adding
// <QmTicks skin="..."/> as their first child with `ticks: true` in qmRaised
// (that sets position: relative, the ticks' anchor). Chips, segments, the
// small round controls, the drop-down + and the library rows have none.
//
// Rules: gold is the main action and the loudest button on a screen; a picked
// choice is a brighter violet body with a gold hairline (`picked`), an unpicked
// one deep slate-violet (`slate`); danger is `red`. Rounded, no cut corners.
//
// docs/quick-mission/UNIFIED-LOOK.md describes the look.

const QM_CSS = `${RAISED_CSS}
.qm-raised { transition: transform .07s ease, box-shadow .07s ease, filter .15s ease; }
.qm-raised:not(:disabled):not([aria-disabled="true"]):hover { filter: brightness(1.08); }
.qm-raised:not(:disabled):not([aria-disabled="true"]):active { transform: translateY(3px); }
@media (prefers-reduced-motion: reduce) { .qm-raised { transition: none !important; } }
`;

// One <style> per screen is enough; a few copies do no harm.
export function QmStyle() {
  return <style dangerouslySetInnerHTML={{ __html: QM_CSS }}/>;
}

// The raised body for a skin: put it on any <button>. `lift` is the lip's
// depth (the button keeps that much room under it), `radius` its corners.
export function qmRaised(skin = 'slate', { lift = 4, radius = 12, glow, ticks = false } = {}) {
  const sk = RAISED_SKINS[skin] || RAISED_SKINS.slate;
  return {
    ...(ticks ? { position: 'relative' } : null),
    background: sk.background, border: sk.border, color: sk.color, textShadow: sk.textShadow,
    borderRadius: radius, marginBottom: lift, boxSizing: 'border-box',
    boxShadow: raisedShadow(sk, lift) + (glow ? `, 0 0 24px ${glow}` : ''),
  };
}

// The four corner ticks, as the first child of a raised button whose style has
// `ticks: true`. Decorative: no text, aria-hidden, absolutely placed inside the
// button (so no height, and no gap in a flex row), clicks pass through.
export function QmTicks({ skin = 'slate' }) {
  const c = (RAISED_SKINS[skin] || RAISED_SKINS.slate).corner;
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map(pos => <span key={pos} aria-hidden="true" data-qm-tick="" style={cornerTick(pos, c)}/>)}
    </>
  );
}

// A segment of a choice strip (GEAR, GUIDED | AT YOUR PACE, LEVEL): picked or
// not, 44px. `off` dims a segment that cannot be picked.
export function qmSeg(on, { off = false, height = 44 } = {}) {
  return {
    ...qmRaised(on ? 'picked' : 'slate', { lift: 3, radius: 10 }),
    flex: '1 1 0', minWidth: 0, height, padding: '0 4px', whiteSpace: 'nowrap', cursor: off ? 'default' : 'pointer',
    font: `700 12px ${HEAD}`, letterSpacing: '0.1em', opacity: off ? 0.4 : 1,
    ...(on ? null : { color: '#D9D3F0' }),
  };
}
// The strip holding the segments: no frame, the segments stand on their own.
export const qmStrip = { display: 'flex', gap: 6, alignItems: 'stretch' };

// A chip (FOCUS, the library's filters): picked or not.
export function qmChip(on) {
  return {
    ...qmRaised(on ? 'picked' : 'slate', { lift: 3, radius: 10 }),
    height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    font: `700 11px ${HEAD}`, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    ...(on ? null : { color: '#E6E2F5' }),
  };
}

// The <style> sits BESIDE the button, not inside it: a style element inside a
// button puts its whole sheet into the button's textContent, so a script that
// finds the START button by its text ("START") no longer finds it. (A style is
// display: none, so next to the button it takes no room in a flex or grid.)
export function QmButton({ skin = 'slate', lift = 4, radius = 12, glow, ticks = false, className, style, children, type = 'button', ...rest }) {
  return (
    <>
      <QmStyle/>
      <button type={type} className={`qm-raised${className ? ` ${className}` : ''}`} {...rest} style={{
        cursor: rest.disabled ? 'default' : 'pointer', ...qmRaised(skin, { lift, radius, glow, ticks }), ...style,
      }}>
        {ticks && <QmTicks skin={skin}/>}
        {children}
      </button>
    </>
  );
}

// GoldButton's place in Quick Mission: the main action, raised gold with a soft glow.
export function QmGold({ label, icon, onClick, height = 56, guide, style, disabled, ticks = true }) {
  return (
    <QmButton skin="gold" lift={5} radius={14} ticks={ticks} glow={disabled ? undefined : 'rgba(242,190,69,0.4)'} data-guide={guide} onClick={onClick} disabled={disabled} style={{
      height, width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      color: '#1A1204', opacity: disabled ? 0.55 : 1, font: `700 18px ${HEAD}`, letterSpacing: '0.18em', padding: 0,
      ...style,
    }}>
      {icon === 'play' ? <Play size={18} fill="currentColor" strokeWidth={0}/> : icon || null}
      {label}
    </QmButton>
  );
}

// GhostButton's place: the quiet raised slate button. Ticks from 44px up (the
// big end-screen buttons); the 40 and 42px ones are quiet and have none.
export function QmGhost({ label, icon, onClick, height = 46, guide, style, ariaExpanded, skin = 'slate', ticks = height >= 44 }) {
  return (
    <QmButton skin={skin} ticks={ticks} data-guide={guide} onClick={onClick} aria-expanded={ariaExpanded} style={{
      height, width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      font: `600 13px ${HEAD}`, letterSpacing: '0.12em', padding: 0,
      ...style,
    }}>
      {icon}{label}
    </QmButton>
  );
}

// SegRow's place (same props): a label and a strip of raised segments.
export function QmSegRow({ label, options, value, onPick, guide, height = 40, gap = 8, right, Label }) {
  const opts = options.map(o => (typeof o === 'string' ? { id: o, label: o } : o));
  return (
    <div data-guide={guide} style={{ display: 'flex', flexDirection: 'column', gap }}>
      <QmStyle/>
      {label && Label && <Label right={right}>{label}</Label>}
      <div role="radiogroup" aria-label={label} style={qmStrip}>
        {opts.map(o => {
          const on = o.id === value;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="qm-raised" onClick={() => onPick(o.id)} style={qmSeg(on, { height })}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ChipGroup's place (same props).
export function QmChipGroup({ options, value, onPick, multi, ariaLabel }) {
  const opts = options.map(o => (typeof o === 'string' ? { id: o, label: o } : o));
  const isOn = (id) => (multi ? (value || []).includes(id) : value === id);
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={ariaLabel} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <QmStyle/>
      {opts.map(o => (
        <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={isOn(o.id) ? 'true' : 'false'} className="qm-raised" onClick={() => onPick(o.id)} style={qmChip(isOn(o.id))}>{o.label}</button>
      ))}
    </div>
  );
}
