import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { MiniTag } from '../../shared/MoveSwapSheet';
import { HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT } from '../../shared/FitSetupKit';

// BONUS TRAINING: optional add-ons under the card, folded by default. They are
// never in the card's totals, its XP or its result: a tick here is the
// athlete's own note. Two of them are whole modes of their own (a run is
// Cardio Mode, shadowboxing is Fight Mode), so they link there instead.
//
// items: [{ id, name, dose, gear?, link?: { label, onClick }, onLine? }]
// onLine: a line shown in gold under a ticked item (the cardio cool-down says
// what its tick does: the workout goes straight into it).
// ticked: { [id]: true }
export default function BonusBlock({ open, onToggle, items = [], ticked = {}, onTick }) {
  const count = Object.values(ticked).filter(Boolean).length;
  return (
    <div data-look="bonus" style={{
      borderRadius: 14, background: '#0F0B1E', overflow: 'hidden',
      border: `1px solid ${open ? 'rgba(157,108,255,0.55)' : 'rgba(157,108,255,0.3)'}`,
    }}>
      <button type="button" className="fk-row" aria-expanded={open ? 'true' : 'false'} aria-controls="fl-bonus-list" onClick={onToggle} style={{
        width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
        background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
      }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: `1.5px solid ${VIOLET}`, color: VIOLET_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={18}/>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em', color: '#fff' }}>BONUS TRAINING</span>
          <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>
            {count ? `${count} done · ` : ''}Optional. Never in your totals.
          </span>
        </span>
        <ChevronDown size={18} color={VIOLET_TEXT} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}/>
      </button>
      {open && (
        <ul id="fl-bonus-list" style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it) => {
            const on = !!ticked[it.id];
            return (
              <li key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 52, padding: '2px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" role="checkbox" aria-checked={on ? 'true' : 'false'} aria-label={`${it.name} done`} onClick={() => onTick?.(it.id)} style={{
                  width: 44, height: 44, flexShrink: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span aria-hidden="true" style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
                    background: on ? GOLD : 'transparent', border: on ? 'none' : '2px solid rgba(255,255,255,0.3)',
                  }}>{on && <Check size={15} strokeWidth={3} color="#1A1204"/>}</span>
                </button>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ font: `600 14px ${BODY}`, lineHeight: 1.25, color: on && !it.onLine ? MUTED : '#fff', textDecoration: on && !it.onLine ? 'line-through' : 'none' }}>{it.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>
                    {it.dose}{it.gear && <MiniTag>{it.gear}</MiniTag>}
                  </span>
                  {on && it.onLine && <span role="status" style={{ font: `600 12px ${BODY}`, lineHeight: 1.3, color: GOLD }}>{it.onLine}</span>}
                </span>
                {it.link && (
                  <button type="button" className="fk-quiet" onClick={it.link.onClick} style={{
                    flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px 0 8px',
                    background: 'transparent', border: 'none', cursor: 'pointer', font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: VIOLET_TEXT, whiteSpace: 'nowrap',
                  }}>{it.link.label}<ChevronRight size={14}/></button>
                )}
              </li>
            );
          })}
          <li style={{ padding: '4px 6px 2px', font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
            Bonus work never changes the rounds, reps or XP above.
          </li>
        </ul>
      )}
    </div>
  );
}
