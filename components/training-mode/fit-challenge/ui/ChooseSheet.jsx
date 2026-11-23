import { Check, ChevronRight, Dices } from 'lucide-react';
import BottomSheet from '../../shared/BottomSheet';
import { Label, HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT } from '../../shared/FitSetupKit';

// CHOOSE: the library, grouped by the spec's categories (FULL BODY, UPPER
// BODY, LOWER BODY, CORE & ABS, COMBAT CONDITIONING), with SURPRISE ME pinned
// as the sheet's footer so it never scrolls away. The app's own floating sheet
// (shared/BottomSheet), rows in MissionLibrarySheet's look. A row puts its
// workout on the card; the one already there says ON CARD.
//
// groups: [{ id, label, items: [{ id, title, line, onCard? }] }]
function Row({ item, onPick }) {
  const on = !!item.onCard;
  return (
    <button type="button" className="fk-row" aria-current={on ? 'true' : undefined} onClick={() => onPick?.(item)} style={{
      width: '100%', minHeight: 54, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 10,
      boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer',
      background: on ? 'rgba(242,190,69,0.10)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.75)' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.08em', lineHeight: 1.25, color: on ? GOLD : '#fff' }}>{item.title}</span>
        <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>{item.line}</span>
      </span>
      {on ? (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: GOLD }}>
          <Check size={14} strokeWidth={3}/>ON CARD
        </span>
      ) : <ChevronRight size={16} color="#7D7799" style={{ flexShrink: 0 }}/>}
    </button>
  );
}

function SurpriseRow({ onClick }) {
  return (
    <button type="button" className="fk-ghost" onClick={onClick} style={{
      width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10,
      boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', background: 'rgba(157,108,255,0.18)', border: `1px solid ${VIOLET}`,
    }}>
      <Dices size={20} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.12em', color: '#fff' }}>SURPRISE ME</span>
        <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED }}>Any category, a new level and focus.</span>
      </span>
    </button>
  );
}

export default function ChooseSheet({ groups, onPick, onSurprise, onClose }) {
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
            {g.items.map((it) => <Row key={it.id} item={it} onPick={onPick}/>)}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
