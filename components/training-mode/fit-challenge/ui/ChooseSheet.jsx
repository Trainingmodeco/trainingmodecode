import { Check, Dices } from 'lucide-react';
import BottomSheet from '../../shared/BottomSheet';
import { Label, HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT } from '../../shared/FitSetupKit';
import { QmStyle, qmRaised } from '../../shared/QmButtons';
import { useOneOpen, DropButton, WorkoutDrop } from '../../shared/WorkoutDrop';

// CHOOSE: the library, grouped by the spec's categories (FULL BODY, UPPER
// BODY, LOWER BODY, CORE & ABS, COMBAT CONDITIONING), with SURPRISE ME pinned
// as the sheet's footer so it never scrolls away. The app's own floating sheet
// (shared/BottomSheet), rows in MissionLibrarySheet's look. A row puts its
// workout on the card; the one already there says ON CARD.
//
// The + at a row's end (− when open) drops the whole workout down under it
// (owner, 2026-11-24): every move with its reps or time, the rounds, the
// format and the gear (shared/WorkoutDrop). One is open at a time; opening
// another, picking a row or tapping elsewhere closes it, and the row's own tap
// still picks the workout.
//
// groups: [{ id, label, items: [{ id, title, line, onCard?, drop?: () => model }] }]
function Row({ item, onPick, open, onToggle, wrapRef }) {
  const on = !!item.onCard;
  const model = open && item.drop ? item.drop() : null;
  const titleId = `cs-title-${item.id}`;
  const panelId = `cs-drop-${item.id}`;
  return (
    // The box is the item's; the row button and the + sit side by side in it
    // (a button cannot hold a button), the dropped workout under them.
    <div ref={open ? wrapRef : undefined} style={{
      width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 10, boxSizing: 'border-box',
      background: on ? 'rgba(242,190,69,0.10)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.75)' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: item.drop ? 4 : 0 }}>
        <button type="button" className="fk-row" aria-current={on ? 'true' : undefined} onClick={() => onPick?.(item)} style={{
          flex: 1, minWidth: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px 7px 12px', borderRadius: 10,
          boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span id={titleId} style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.08em', lineHeight: 1.25, color: on ? GOLD : '#fff' }}>{item.title}</span>
            <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>{item.line}</span>
          </span>
          {on && (
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: GOLD }}>
              <Check size={14} strokeWidth={3}/>ON CARD
            </span>
          )}
        </button>
        {item.drop && <DropButton open={open} controls={panelId} titleId={titleId} onClick={onToggle}/>}
      </div>
      {open && model && <WorkoutDrop id={panelId} model={model} label={`${item.title}: full workout`}/>}
    </div>
  );
}

function SurpriseRow({ onClick }) {
  return (
    <button type="button" className="qm-raised" onClick={onClick} style={{
      ...qmRaised('slate', { lift: 4, radius: 12 }),
      width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
      textAlign: 'left', cursor: 'pointer',
    }}>
      <QmStyle/>
      <Dices size={20} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.12em', color: '#fff' }}>SURPRISE ME</span>
        <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>Any category, a new level and focus.</span>
      </span>
    </button>
  );
}

export default function ChooseSheet({ groups, onPick, onSurprise, onClose }) {
  const { openId, close, toggle, wrapRef } = useOneOpen();
  return (
    <BottomSheet
      variant="float" wide accent={VIOLET} onClose={onClose}
      title={<span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.12em' }}>CHOOSE A WORKOUT</span>}
      footer={<div data-look="choose-foot"><SurpriseRow onClick={onSurprise}/></div>}
    >
      <div data-look="choose" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 2 }}>
        {groups.map((g) => (
          <div key={g.id} role="group" aria-label={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{g.label}</Label>
            {g.items.map((it) => (
              <Row key={it.id} item={it} onPick={(i) => { close(); onPick?.(i); }} open={openId === it.id} onToggle={() => toggle(it.id)} wrapRef={wrapRef}/>
            ))}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
