import { useState, useMemo } from 'react';
import { ArrowRightLeft, ChevronDown } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { GoldButton, GhostButton, HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT } from './FitSetupKit';
import { cardRows, swapOptions, gearProfile } from '../data/loadoutMissions';
import { moveById, GEAR_LABEL } from '../data/missionMoves';

// Quick Mission v2 · the move row and the swap sheet.
//
// One row component for the Setup card and the SOLO screen, so the row look,
// its aria-labels and the UNDO rule cannot drift between them. Everything
// shown comes from cardRows() / swapOptions() (data/loadoutMissions); this
// file only draws it. A pick goes back to the parent, which applies it (Setup
// rebuilds from its swaps map, SOLO calls swapMissionMove) and closes the
// sheet. Swaps never touch integrity.
//
// The swap sheet shows catalog cues inline instead of ExerciseInfoSheet: that
// sheet's move families mis-cue these moves (heels lifting on a Hindu squat,
// jump cues on a squat thrust).

const KIND_STYLE = {
  easier: { background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT },
  similar: { background: 'rgba(255,255,255,0.08)', color: '#E6E2F5' },
  harder: { background: 'rgba(242,190,69,0.16)', color: GOLD },
  'no-gear': { background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT },
};

function MiniTag({ children, style }) {
  return (
    <span style={{
      flexShrink: 0, font: `700 9px ${HEAD}`, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      padding: '3px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.08)', color: '#E6E2F5', ...style,
    }}>{children}</span>
  );
}

// One move on a v2 card. row: a cardRows() row; index: 0-based. onUndo is
// optional; the SWAPPED tag and UNDO only show with it. highlight marks SOLO's
// current segment. Render it inside an <ol>/<ul>.
export function MoveRow({ row, index, onSwap, onUndo, highlight = false }) {
  const showUndo = !!(row.undoable && onUndo);
  return (
    // The negative margin lets the highlight bar and tint sit just outside the
    // row's content, so lighting a row in SOLO never shifts its text.
    <li style={{
      listStyle: 'none', margin: '0 -6px', padding: '0 6px', borderRadius: 4,
      background: highlight ? 'rgba(242,190,69,0.08)' : 'transparent',
      boxShadow: highlight ? `inset 3px 0 0 ${GOLD}` : 'none', transition: 'background .2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, font: `500 13px ${BODY}`, color: '#fff' }}>
        <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: GOLD }}>{String(index + 1).padStart(2, '0')}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            {row.prefix && <span style={{ flexShrink: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.1em', color: MUTED, whiteSpace: 'nowrap' }}>{row.prefix}</span>}
            <span style={{ minWidth: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
          </span>
          {/* Under the name, not beside it: on a phone a tag and a button in
              the row would squeeze the name down to a few letters. */}
          {showUndo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MiniTag style={{ font: `700 8px ${HEAD}`, padding: '2px 4px', background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT }}>SWAPPED</MiniTag>
              <button type="button" onClick={() => onUndo(row)} aria-label={`Undo swap ${row.name}`} style={{
                height: 24, padding: '0 6px', margin: '-2px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                font: `700 10px ${HEAD}`, letterSpacing: '0.14em', color: GOLD,
              }}>UNDO</button>
            </span>
          )}
        </span>
        <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{row.dose}</span>
        <button type="button" onClick={row.canSwap ? () => onSwap?.(row) : undefined} disabled={!row.canSwap} aria-label={`Swap ${row.name}`} style={{
          width: 44, height: 44, flexShrink: 0, marginRight: -6, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: row.canSwap ? 'pointer' : 'default',
        }}>
          {row.canSwap && <ArrowRightLeft size={18} color={VIOLET_TEXT}/>}
        </button>
      </div>
      {row.note && <div style={{ padding: '0 0 4px 28px', marginTop: -4, font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{row.note}</div>}
    </li>
  );
}

// One option: the whole row picks it; the name (its own button) opens the
// cues. The pick button sits under the row's content rather than around it,
// so the two buttons are never nested.
function OptionRow({ option: o, open, onToggle, onPick }) {
  return (
    <li style={{ listStyle: 'none', borderRadius: 10, background: open ? 'rgba(157,108,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${open ? 'rgba(157,108,255,0.45)' : 'rgba(255,255,255,0.09)'}` }}>
      <div style={{ position: 'relative' }}>
        <button type="button" className="fk-row" onClick={() => onPick(o.id)} aria-label={`Swap to ${o.name}`} style={{
          position: 'absolute', inset: 0, width: '100%', borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}/>
        <div style={{ position: 'relative', pointerEvents: 'none', minHeight: 56, boxSizing: 'border-box', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MiniTag style={{ width: 60, textAlign: 'center', boxSizing: 'border-box', ...KIND_STYLE[o.kind] }}>{o.label}</MiniTag>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <button type="button" aria-expanded={open ? 'true' : 'false'} onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{
              pointerEvents: 'auto', maxWidth: '100%', minHeight: 32, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left', font: `600 14px ${BODY}`, lineHeight: 1.2, color: '#fff',
            }}>
              {/* Wraps rather than truncates: the doses on the right leave
                  little room, and the name is what the athlete is choosing. */}
              <span style={{ minWidth: 0 }}>{o.name}</span>
              <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}/>
            </button>
            {o.stop && <span style={{ font: `600 11px ${BODY}`, color: GOLD, marginTop: -4 }}>{o.stop} Use this one.</span>}
          </span>
          <span style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{o.doseFrom} → {o.doseTo}</span>
            {o.gear !== 'none' && <MiniTag>{o.gearLabel}</MiniTag>}
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {o.cues.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, font: `500 12px ${BODY}`, color: '#E6E2F5', lineHeight: 1.35 }}>
                <span style={{ flexShrink: 0, font: `700 10px ${HEAD}`, color: VIOLET_TEXT, paddingTop: 1 }}>{i + 1}</span>{c}
              </li>
            ))}
          </ul>
          <GoldButton label="USE THIS MOVE" height={40} onClick={() => onPick(o.id)} style={{ fontSize: 13, letterSpacing: '0.16em' }}/>
        </div>
      )}
    </li>
  );
}

// The swap sheet for one row. gear: the Set the caller captured with
// gearProfile() and passed to cardRows (read here only when it is missing).
export default function MoveSwapSheet({ mission, swapKey, gear, onPick, onClose }) {
  const [ownGear] = useState(() => (gear ? null : gearProfile()));
  const g = gear || ownGear;
  const [openId, setOpenId] = useState(null);
  const row = useMemo(() => cardRows(mission, { gear: g }).find(r => r.swapKey === swapKey) || null, [mission, swapKey, g]);
  const options = useMemo(() => (row ? swapOptions(mission, swapKey, { gear: g }) : []), [row, mission, swapKey, g]);
  const pick = (id) => onPick?.(id);
  const current = moveById(row?.moveId);

  return (
    <BottomSheet
      variant="float" wide accent={VIOLET} onClose={onClose}
      title={<span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.12em' }}>{row ? `SWAP: ${row.name.toUpperCase()}` : 'SWAP'}</span>}
      footer={<div style={{ font: `500 11px ${BODY}`, color: MUTED, textAlign: 'center' }}>Swaps never cost XP. The run is marked SCALED.</div>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
        {row && (
          <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flexShrink: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>NOW</span>
              <span style={{ flex: 1, minWidth: 0, font: `600 14px ${BODY}`, lineHeight: 1.2, color: '#fff' }}>{row.name}</span>
              <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{row.dose}</span>
              {current && <MiniTag>{GEAR_LABEL[current.gear] || current.gear}</MiniTag>}
            </div>
            {row.swapped && (
              <GhostButton label={`BACK TO ${String(row.baseName).toUpperCase()}`} height={40} onClick={() => pick(row.baseMoveId)} style={{ fontSize: 12 }}/>
            )}
          </div>
        )}
        {options.length ? (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map(o => (
              <OptionRow key={o.id} option={o} open={openId === o.id} onToggle={() => setOpenId(id => (id === o.id ? null : o.id))} onPick={pick}/>
            ))}
          </ul>
        ) : (
          <div style={{ font: `500 13px ${BODY}`, color: MUTED, padding: '6px 2px' }}>No swaps for this move yet.</div>
        )}
      </div>
    </BottomSheet>
  );
}
