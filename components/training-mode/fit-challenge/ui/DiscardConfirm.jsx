import { Modal, GoldButton, GhostButton, BODY } from '../../shared/FitSetupKit';

// Before SHUFFLE (or a rounds change below the rounds already done) throws the
// ticks away: the kit's Modal, in AT YOUR PACE's END MISSION? shape: KEEP
// GOING in gold, the throw-away in a red-edged ghost. KEEP GOING is the safe
// default and sits first.
const RED_BORDER = 'rgba(239,68,68,0.5)';

export default function DiscardConfirm({ title = 'START OVER?', body, confirmLabel = 'SHUFFLE', onKeep, onConfirm }) {
  return (
    <Modal title={title} onClose={onKeep} footer={(
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GoldButton label="KEEP GOING" height={46} onClick={onKeep} style={{ fontSize: 13, letterSpacing: '0.12em' }}/>
        <GhostButton label={confirmLabel} height={46} onClick={onConfirm} style={{ border: `1px solid ${RED_BORDER}`, color: '#FCA5A5' }}/>
      </div>
    )}>
      <div data-look="confirm" style={{ font: `500 14px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 }}>{body}</div>
    </Modal>
  );
}
