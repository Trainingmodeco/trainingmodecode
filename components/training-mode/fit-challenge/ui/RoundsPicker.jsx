import { Label, HEAD, MUTED, VIOLET, CARD, CARD_BORDER, chf } from '../../shared/FitSetupKit';
import { ROUND_CHOICES } from '../../data/challengeTotals';

// ROUNDS 2 | 3 | 4 | 5, chosen directly: the kit's chamfered radio strip
// (SegRow's look) with big numbers, 52px tall. Picking a number is all it
// does; the card works out the totals and the time from it.
export default function RoundsPicker({ value, onPick, options = ROUND_CHOICES, label = 'Rounds', right, height = 52 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && <Label right={right}>{label}</Label>}
      <div role="radiogroup" aria-label={label} style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
        {options.map((n) => {
          const on = n === value;
          return (
            <button key={n} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-label={`${n} rounds`} className="fk-seg"
              onClick={() => onPick?.(n)} style={{
                flex: '1 1 0', minWidth: 0, height, border: 'none', cursor: 'pointer', padding: 0,
                font: `700 22px ${HEAD}`, fontVariantNumeric: 'tabular-nums',
                color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
                boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none',
              }}>{n}</button>
          );
        })}
      </div>
    </div>
  );
}
