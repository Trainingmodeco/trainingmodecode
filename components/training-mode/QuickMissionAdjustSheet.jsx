import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { NAV_H } from './Styles';
import { RUN_MODES } from './data/loadoutMissions';
import OverlayPortal, { OVERLAY_Z } from './shared/OverlayPortal';
import { FLOAT_BACKDROP, floatPanel } from './shared/BottomSheet';
import useSheetModal, { GRAB_BAR } from './shared/useSheetModal';
import {
  SegRow, ChipGroup, CardioToggleCard, GoldButton, Label,
  HEAD, BODY, MUTED, VIOLET, VIOLET_TEXT, CARD, CARD_BORDER, chf,
} from './shared/FitSetupKit';

// Quick Mission · ADJUST. Everything that is not GEAR or TIME, behind the
// open card's ADJUST row, so the page itself stays two choices and START.
//
// The Mission Library's floating sheet (portalled, resting on the tab bar),
// sized to what it holds. What it shows depends on the mission on the card:
//   today's mission   LEVEL (easy / medium / hard) · FOCUS · RUN MODE (guided /
//                     at your pace) · ADD CARDIO
//   a library mission LEVEL (its own levels) · RUN MODE (guided / at your pace) · ADD CARDIO
//                     · NOTES (its loadout, score, how to scale and the
//                     coach's note: the brief the open card leaves out)
//   a classic         ADD CARDIO
// The page owns every choice: a tap goes straight back to it, the card
// rebuilds behind the sheet and the page remembers it. DONE, Escape, the
// backdrop or a swipe down on the grab bar close it.
//
// level: { options: [{ id, label }], value, onPick, detail? } | null
// focus: { options, value, onPick } | null
// how:   { value: 'guided' | 'solo' (shown as AT YOUR PACE), soloOnly, help, onPick } | null
// notes: { lines: [[label, value]], scale, note } | null
// cardio: { on, summary, onToggle, onEdit }
const CSS = `
@keyframes qa-up { from { transform: translateY(24px); opacity: .4; } to { transform: none; opacity: 1; } }
/* The five FOCUS chips on one row at 412px; a narrower phone wraps them. */
.qa-chips .fk-chip { position: relative; padding: 0 9px !important; letter-spacing: 0.08em !important; }
.qa-chips .fk-chip::after { content: ''; position: absolute; top: -4px; bottom: -4px; left: -3px; right: -3px; }
@media (prefers-reduced-motion: reduce) { .qa-panel { animation: none !important; } }
`;

const help = (text) => <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{text}</div>;

// GUIDED · AT YOUR PACE: the kit's strip (the same choice as the first page's
// switch, kept in sync by the page), with GUIDED greyed out on a mission only
// offered at your pace (it still says what is coming).
function HowRow({ how }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label>Run mode</Label>
      <div role="radiogroup" aria-label="Run mode" style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
        {RUN_MODES.map(({ id, label }) => {
          const on = how.value === id;
          const off = id === 'guided' && how.soloOnly;
          return (
            <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-disabled={off ? 'true' : undefined} className="fk-seg"
              onClick={off ? undefined : () => how.onPick(id)} style={{
                flex: 1, height: 44, border: 'none', padding: 0, cursor: off ? 'default' : 'pointer', whiteSpace: 'nowrap',
                font: `600 12px ${HEAD}`, letterSpacing: '0.14em', opacity: off ? 0.45 : 1,
                color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
                boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none',
              }}>{label}</button>
          );
        })}
      </div>
      {how.help && help(how.help)}
    </div>
  );
}

// NOTES: read-only, after the choices.
function NotesBlock({ notes }) {
  const lines = notes.lines.filter(([, v]) => v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label>Notes</Label>
      {lines.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(64px, auto) 1fr', gap: '2px 10px', alignItems: 'baseline' }}>
          {lines.map(([k, v]) => (
            <Fragment key={k}>
              <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{k}</span>
              <span style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff' }}>{v}</span>
            </Fragment>
          ))}
        </div>
      )}
      {notes.scale && help(<><span style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.08em' }}>SCALE:</span> {notes.scale}</>)}
      {notes.note && help(notes.note)}
    </div>
  );
}

export default function QuickMissionAdjustSheet({ title, level, focus, how, notes, cardio, onClose, returnFocus }) {
  const { panelRef, trapTab, grabProps } = useSheetModal(onClose, { returnFocus });
  return (
    <OverlayPortal>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: NAV_H, zIndex: OVERLAY_Z, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }}/>
        <div onClick={onClose} style={{ flex: 1, ...FLOAT_BACKDROP }}/>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0 }}/>
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Adjust" onKeyDown={trapTab} className="qa-panel" style={{
          ...floatPanel(VIOLET, { wide: true }), maxHeight: 'calc(100% - 56px)', outline: 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'qa-up 0.24s ease',
        }}>
          <div {...grabProps} style={{ flexShrink: 0, padding: '8px 16px 4px', touchAction: 'none' }}>
            <div aria-hidden="true" style={GRAB_BAR}/>
            <div style={{ marginTop: 10, font: `700 13px ${HEAD}`, letterSpacing: '0.16em', color: VIOLET_TEXT, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ADJUST · <span style={{ color: '#fff' }}>{title}</span>
            </div>
          </div>

          <div className="no-scrollbar" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '8px 16px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {level && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SegRow label="Level" options={level.options} value={level.value} onPick={level.onPick} height={44}/>
                {level.detail && help(level.detail)}
              </div>
            )}
            {focus && (
              <div className="qa-chips" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>Focus</Label>
                <ChipGroup ariaLabel="Focus" options={focus.options} value={focus.value} onPick={focus.onPick}/>
              </div>
            )}
            {how && <HowRow how={how}/>}
            <CardioToggleCard on={cardio.on} summary={cardio.summary} onToggle={cardio.onToggle} onEdit={cardio.onEdit}/>
            {notes && <NotesBlock notes={notes}/>}
          </div>

          <div style={{ flexShrink: 0, padding: '10px 16px 14px' }}>
            <GoldButton label="DONE" icon={<Check size={16} strokeWidth={3}/>} height={48} onClick={onClose} style={{ fontSize: 16, letterSpacing: '0.2em', color: '#1A1204' }}/>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
