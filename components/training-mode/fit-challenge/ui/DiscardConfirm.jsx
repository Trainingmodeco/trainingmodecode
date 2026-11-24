import { Modal, GoldButton, GhostButton, BODY, MUTED } from '../../shared/FitSetupKit';

// Before SHUFFLE (or a rounds change below the rounds already done) throws the
// ticks away: the kit's Modal, in AT YOUR PACE's END MISSION? shape: KEEP
// GOING in gold, the throw-away in a red-edged ghost. KEEP GOING is the safe
// default and sits first.
//
// The owner's note: "Add END at the bottom just in case the user wants to
// just stop". With `onEnd`, an END row under the two buttons ends the workout
// the normal way, as AT YOUR PACE's END does: what was done is banked.
const RED_BORDER = 'rgba(239,68,68,0.5)';

export default function DiscardConfirm({ title = 'START OVER?', body, confirmLabel = 'SHUFFLE', onKeep, onConfirm, onEnd }) {
  return (
    <Modal title={title} onClose={onKeep} footer={(
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <GoldButton label="KEEP GOING" height={46} onClick={onKeep} style={{ fontSize: 13, letterSpacing: '0.12em' }}/>
          <GhostButton label={confirmLabel} height={46} onClick={onConfirm} style={{ border: `1px solid ${RED_BORDER}`, color: '#FCA5A5' }}/>
        </div>
        {onEnd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <GhostButton label="END" height={44} onClick={onEnd} style={{ border: `1px solid ${RED_BORDER}`, color: '#FCA5A5' }}/>
            <div style={{ font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35, textAlign: 'center' }}>END stops here and keeps what you have done.</div>
          </div>
        )}
      </div>
    )}>
      <div data-look="confirm" style={{ font: `500 14px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 }}>{body}</div>
    </Modal>
  );
}
