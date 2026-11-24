import { Fragment, useState, useRef, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, VIOLET_TEXT } from './FitSetupKit';

// The + on a library row (owner, 2026-11-24): it drops the full workout down
// under the row (every move with its reps or time, the rounds, the format, the
// gear), as the card's SEE ALL does, so a workout can be read before it is
// picked. Used by MissionLibrarySheet and the Fit card's CHOOSE.
//
//   useOneOpen()   one row open at a time. Opening another row, picking one or
//                  tapping anywhere outside the open row closes it; a tap
//                  inside it (its row, its + or the dropped panel) does not.
//                  A scroll is not a tap, so reading a long workout is safe.
//   DropButton     the + (− when open): 44 x 44, its own button next to the row
//                  button (a button cannot sit inside a button).
//   WorkoutDrop    the panel; `model` is data/libraryDrop's.
// Brings the open row into the list's window: as little scroll as it takes, but
// when the dropped workout is taller than the window (a short phone) the row's
// own top, its title, is what shows, and the rest is a scroll away.
function reveal(el) {
  el.scrollIntoView({ block: 'nearest' });
  let p = el.parentElement;
  while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
  if (p && el.getBoundingClientRect().top < p.getBoundingClientRect().top + 30) el.scrollIntoView({ block: 'start' });
}

export function useOneOpen() {
  const [openId, setOpenId] = useState(null);
  const wrapRef = useRef(null); // the open item's wrapper: the item that sets it is the open one
  useEffect(() => {
    if (openId == null) return undefined;
    // `click`, not `pointerdown`: a swipe that starts elsewhere to scroll the list is no tap.
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenId(null); };
    document.addEventListener('click', onClick, true);
    if (wrapRef.current) reveal(wrapRef.current);
    return () => document.removeEventListener('click', onClick, true);
  }, [openId]);
  return { openId, close: () => setOpenId(null), toggle: (id) => setOpenId((cur) => (cur === id ? null : id)), wrapRef };
}

export function DropButton({ open, controls, titleId, onClick }) {
  const Icon = open ? Minus : Plus;
  return (
    <button type="button" aria-label={open ? 'Hide the full workout' : 'Show the full workout'} aria-expanded={open ? 'true' : 'false'}
      aria-controls={controls} aria-describedby={titleId} onClick={onClick} style={{
        width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 10, cursor: 'pointer',
        background: open ? 'rgba(157,108,255,0.22)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? 'rgba(157,108,255,0.6)' : 'rgba(255,255,255,0.14)'}`, color: VIOLET_TEXT,
      }}>
      <Icon size={18} strokeWidth={2.6} aria-hidden="true"/>
    </button>
  );
}

export function WorkoutDrop({ id, model, label }) {
  if (!model) return null;
  return (
    <div id={id} role="region" aria-label={label || 'Full workout'} data-drop="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 12px 12px', borderTop: '1px dashed rgba(255,255,255,0.12)', marginTop: 0 }}>
      {model.summary && <div style={{ paddingTop: 8, font: `600 11px ${HEAD}`, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase', lineHeight: 1.4 }}>{model.summary}</div>}
      {model.facts.length > 0 && (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '3px 12px', alignItems: 'baseline' }}>
          {model.facts.map(([k, v]) => (
            <Fragment key={k}>
              <dt style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{k}</dt>
              <dd style={{ margin: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{v}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      <ol aria-label="Moves" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {model.moves.map((m, i) => (
          <li key={`${m.name}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, font: `500 13px ${BODY}`, lineHeight: 1.3, color: '#fff' }}>
            <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {m.prefix && <span style={{ marginRight: 6, font: `600 10px ${HEAD}`, letterSpacing: '0.1em', color: MUTED }}>{m.prefix}</span>}
              <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{m.name}</span>
              {m.note && <div style={{ marginTop: 1, font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{m.note}</div>}
            </span>
            {m.dose && <span style={{ maxWidth: '48%', flexShrink: 0, textAlign: 'right', font: `600 12px ${HEAD}`, color: '#CFC9E4', overflowWrap: 'anywhere' }}>{m.dose}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
