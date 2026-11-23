import { useState } from 'react';
import BottomSheet from '../../shared/BottomSheet';
import { OptionRow, MiniTag } from '../../shared/MoveSwapSheet';
import { HEAD, BODY, MUTED, VIOLET } from '../../shared/FitSetupKit';

// The swap sheet for one move of ANY workout on the card, generated ones
// included. It is shared/MoveSwapSheet's sheet: the same NOW box and the same
// option rows (OptionRow: EASIER / SIMILAR / HARDER / NO GEAR, the dose before
// and after, cues under the name), fed plain props instead of a v2 mission.
// A pick replaces that one move; the rounds stay and the totals follow.
//
// row: { name, dose, gearLabel? }  options: OptionRow's option shape
// ({ id, kind, label, name, doseFrom, doseTo, gear, gearLabel, cues, stop? }).
export default function ChallengeSwapSheet({ row, options = [], rounds, onPick, onClose }) {
  const [openId, setOpenId] = useState(null);
  return (
    <BottomSheet
      variant="float" wide accent={VIOLET} onClose={onClose}
      title={<span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.12em' }}>{`SWAP: ${String(row?.name || '').toUpperCase()}`}</span>}
      footer={<div style={{ font: `500 11px ${BODY}`, color: MUTED, textAlign: 'center', lineHeight: 1.4 }}>Swaps never cost XP. {rounds} rounds stay; the totals update.</div>}
    >
      <div data-look="swap" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
        {row && (
          <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flexShrink: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>NOW</span>
            <span style={{ flex: 1, minWidth: 0, font: `600 14px ${BODY}`, lineHeight: 1.2, color: '#fff' }}>{row.name}</span>
            <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{row.dose}</span>
            {row.gearLabel && <MiniTag>{row.gearLabel}</MiniTag>}
          </div>
        )}
        <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((o) => (
            <OptionRow key={o.id} option={o} open={openId === o.id} onToggle={() => setOpenId((id) => (id === o.id ? null : o.id))} onPick={onPick}/>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}
