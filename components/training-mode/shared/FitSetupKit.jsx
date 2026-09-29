import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X, Check } from 'lucide-react';
import { HelpButton } from './WorkoutHelpPanel';
import BottomSheet from './BottomSheet';
import { loadStats, getLevel } from '../data/userStats';

// The Fit-side setup vocabulary from the Revamp design (FitMode / QuickMission
// / BuildWorkout / Cardio .dc.html): one header, a chamfered segmented row,
// setting rows that open a picker, the gold chamfered CTA and its ghost
// sibling, and the ADD CARDIO switch card. Quick Mission, Build Workout and
// Cardio all draw from here so the three screens read as one product.
export const GOLD = '#F2BE45';
export const VIOLET = '#9D6CFF';
export const VIOLET_TEXT = '#C4A8FF';
export const MUTED = '#A9A3C4';
export const CARD = '#110E1C';
export const CARD_BORDER = 'rgba(255,255,255,0.09)';

export const HEAD = "'Chakra Petch', system-ui, sans-serif";
export const BODY = "'Barlow', system-ui, sans-serif";

// Chamfered corners (top-left, bottom-right) — the design's .chf.
export const chf = { clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' };
export const GOLD_FILL = 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)';

export const fitKitCSS = `
.fk-gold { transition: filter .18s ease, box-shadow .18s ease, transform .1s ease; }
.fk-gold:hover, .fk-gold:focus-visible { filter: brightness(1.12); box-shadow: 0 0 30px rgba(242,190,69,.55) !important; }
.fk-gold:active { transform: scale(.98); }
.fk-ghost { transition: border-color .2s, background .2s, color .2s; }
.fk-ghost:hover, .fk-ghost:focus-visible { background: rgba(157,108,255,.14) !important; border-color: ${VIOLET} !important; color: #fff !important; }
.fk-ghost:hover svg, .fk-ghost:focus-visible svg { color: ${GOLD} !important; }
.fk-seg { transition: color .18s ease, background .18s ease, box-shadow .18s ease; }
.fk-seg:not([aria-checked="true"]):hover, .fk-seg:not([aria-checked="true"]):focus-visible { color: #fff; background: rgba(157,108,255,.14); }
.fk-row { transition: background .18s ease; }
.fk-row:hover, .fk-row:focus-visible { background: rgba(157,108,255,.12) !important; }
.fk-row:hover svg, .fk-row:focus-visible svg { color: ${GOLD} !important; }
.fk-chip { transition: border-color .18s ease, background .18s ease, color .18s ease; }
.fk-chip:not([aria-checked="true"]):hover, .fk-chip:not([aria-checked="true"]):focus-visible { border-color: ${VIOLET} !important; background: rgba(157,108,255,.14) !important; color: #fff !important; }
.fk-quiet { transition: color .18s ease; }
.fk-quiet:hover, .fk-quiet:focus-visible { color: #FFFFFF !important; }
.fk-back { transition: color .18s ease; }
.fk-back:hover, .fk-back:focus-visible { color: ${GOLD} !important; }
.fk-hero img { opacity: .5; filter: brightness(.8); transition: opacity .25s ease, filter .25s ease, transform .3s ease; }
.fk-hero:hover img { opacity: .8; filter: brightness(1) saturate(1.1); transform: scale(1.02); }
:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
`;

export function LevelBadge() {
  const [level] = useState(() => getLevel(loadStats().xp));
  return <span style={{ font: `700 13px ${HEAD}`, color: GOLD, flexShrink: 0 }}>LV {level}</span>;
}

// Back · TITLE · LV n · ?
export function SetupHeader({ title, onBack, onHelp, right, guide }) {
  return (
    <div data-guide={guide} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 6px', flexShrink: 0 }}>
      {onBack && (
        <button type="button" className="fk-back" onClick={onBack} aria-label="Back" style={{ width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0 }}>
          <ChevronLeft size={22}/>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0, font: `700 18px ${HEAD}`, letterSpacing: '0.14em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {right !== undefined ? right : <LevelBadge/>}
      {onHelp && <div style={{ marginLeft: 8 }}><HelpButton onClick={onHelp}/></div>}
    </div>
  );
}

export function Label({ children, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style }}>
      <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{children}</span>
      {right}
    </div>
  );
}

// A label over a chamfered radio strip. options: [{ id, label }] or strings.
export function SegRow({ label, options, value, onPick, guide, height = 40, gap = 8 }) {
  const opts = options.map(o => (typeof o === 'string' ? { id: o, label: o } : o));
  return (
    <div data-guide={guide} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {label && <Label>{label}</Label>}
      <div role="radiogroup" aria-label={label} style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
        {opts.map(o => {
          const on = o.id === value;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-seg" onClick={() => onPick(o.id)} style={{
              flex: 1, height, border: 'none', cursor: 'pointer', font: `600 12px ${HEAD}`, letterSpacing: '0.1em',
              color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
              boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none', whiteSpace: 'nowrap', padding: 0,
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// A stack of setting rows in one card.
export function SettingsCard({ children, style }) {
  return (
    <div style={{ borderRadius: 14, background: CARD, border: `1px solid ${CARD_BORDER}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}>
      {children}
    </div>
  );
}

// LABEL · value · ›  (56px; `height` for a denser card). `first` drops the top hairline.
export function SettingRow({ label, value, onClick, guide, first, accent, height = 56 }) {
  return (
    <button type="button" className="fk-row" data-guide={guide} onClick={onClick} style={{
      minHeight: height, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', width: '100%',
      border: 'none', borderTop: first ? 'none' : `1px solid rgba(255,255,255,0.07)`, background: 'transparent',
      color: '#fff', textAlign: 'left', cursor: 'pointer',
    }}>
      <span style={{ width: 92, flexShrink: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, font: `600 15px ${BODY}`, color: accent || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <ChevronRight size={18} color="#7D7799" style={{ flexShrink: 0 }}/>
    </button>
  );
}

// The gold chamfered CTA.
export function GoldButton({ label, icon, onClick, height = 56, guide, style, disabled }) {
  return (
    <button type="button" className="fk-gold" data-guide={guide} onClick={onClick} disabled={disabled} style={{
      ...chf, height, width: '100%', border: 'none', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: GOLD_FILL, color: '#1A1204', opacity: disabled ? 0.55 : 1,
      font: `700 18px ${HEAD}`, letterSpacing: '0.18em', boxShadow: '0 0 28px rgba(242,190,69,0.35)',
      ...style,
    }}>
      {icon === 'play' ? <Play size={18} fill="currentColor" strokeWidth={0}/> : icon || null}
      {label}
    </button>
  );
}

// The quiet sibling: dark fill, hairline, white text.
export function GhostButton({ label, icon, onClick, height = 46, guide, style, ariaExpanded }) {
  return (
    <button type="button" className="fk-ghost" data-guide={guide} onClick={onClick} aria-expanded={ariaExpanded} style={{
      ...chf, height, width: '100%', cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      background: CARD, border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
      font: `600 13px ${HEAD}`, letterSpacing: '0.12em', padding: 0,
      ...style,
    }}>
      {icon}{label}
    </button>
  );
}

// Small tag chip: "20 min" · "Normal" · "Upper".
export function Tag({ children, accent }) {
  return (
    <span style={{
      font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '5px 8px',
      background: accent ? 'rgba(157,108,255,0.22)' : 'rgba(255,255,255,0.08)', color: accent ? VIOLET_TEXT : '#fff',
    }}>{children}</span>
  );
}

// A wrap of selectable chips (radio or multi).
export function ChipGroup({ options, value, onPick, multi, ariaLabel }) {
  const opts = options.map(o => (typeof o === 'string' ? { id: o, label: o } : o));
  const isOn = (id) => (multi ? (value || []).includes(id) : value === id);
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={ariaLabel} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map(o => {
        const on = isOn(o.id);
        return (
          <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={() => onPick(o.id)} style={{
            height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: on ? 'rgba(157,108,255,0.22)' : '#16131F', border: `1px solid ${on ? 'rgba(157,108,255,0.55)' : 'transparent'}`,
            borderRadius: 3, color: on ? VIOLET_TEXT : '#E6E2F5', font: `700 11px ${HEAD}`, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// A centred modal (the design's .modal): scrim + card, violet frame.
export function Modal({ title, onClose, children, footer, ariaLabel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
      <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(3,2,8,0.72)', backdropFilter: 'blur(2px)', cursor: 'pointer' }}/>
      <div role="dialog" aria-modal="true" aria-label={ariaLabel || title} style={{
        position: 'absolute', left: '7%', right: '7%', top: '50%', transform: 'translateY(-50%)', maxWidth: 380, margin: '0 auto',
        maxHeight: 'calc(100% - 96px)', overflowY: 'auto', boxSizing: 'border-box', padding: '18px 16px',
        borderRadius: 18, background: '#110C22', border: '1.5px solid rgba(157,108,255,0.7)',
        boxShadow: '0 0 30px rgba(157,108,255,0.3), 0 20px 50px rgba(0,0,0,0.75)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#CFC9E4', cursor: 'pointer' }}><X size={16}/></button>
        <div style={{ font: `700 17px ${HEAD}`, letterSpacing: '0.12em', color: '#fff', paddingRight: 40 }}>{title}</div>
        {children}
        {footer}
      </div>
    </div>
  );
}

// A picker sheet for one setting: chips (single or multi) + DONE.
export function ChoiceSheet({ title, options, value, onPick, onClose, multi, note, children }) {
  return (
    <BottomSheet variant="float" title={title} accent={VIOLET} onClose={onClose} maxHeight="72dvh" footer={(
      <GoldButton label="DONE" icon={<Check size={16} strokeWidth={3}/>} height={48} onClick={onClose} style={{ fontSize: 14 }}/>
    )}>
      {note && <div style={{ font: `500 13px ${BODY}`, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>{note}</div>}
      <ChipGroup options={options} value={value} onPick={onPick} multi={multi} ariaLabel={title}/>
      {children}
    </BottomSheet>
  );
}

// ADD CARDIO — the switch card. `summary` is the one-line state; ON shows an
// EDIT pill. Toggling ON opens the editor (via onEdit); OFF clears.
export function CardioToggleCard({ on, summary, onToggle, onEdit, guide }) {
  return (
    <div data-guide={guide} style={{
      flexShrink: 0, borderRadius: 14, background: '#0F0B1E', overflow: 'hidden',
      border: `1px solid ${on ? 'rgba(242,190,69,0.75)' : 'rgba(157,108,255,0.3)'}`,
      boxShadow: on ? '0 0 18px rgba(242,190,69,0.28)' : 'none', transition: 'border-color .25s, box-shadow .25s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 62, padding: '0 14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `1.5px solid ${on ? GOLD : VIOLET}`, color: on ? '#FFE9A8' : VIOLET_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em', color: '#fff' }}>ADD CARDIO</span>
          <span style={{ font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
        </div>
        {on && (
          <button type="button" onClick={onEdit} style={{ flexShrink: 0, height: 36, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(157,108,255,0.16)', color: VIOLET_TEXT, font: `700 11px ${HEAD}`, letterSpacing: '0.12em' }}>EDIT</button>
        )}
        <button type="button" role="switch" aria-checked={on ? 'true' : 'false'} aria-label="Add cardio" onClick={onToggle} style={{
          flexShrink: 0, width: 52, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', position: 'relative', padding: 0,
          background: on ? GOLD_FILL : '#2A2540',
          boxShadow: on ? '0 0 14px rgba(242,190,69,0.75), 0 0 4px rgba(255,233,168,0.9)' : 'none', transition: 'box-shadow .25s',
        }}>
          <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s ease' }}/>
        </button>
      </div>
    </div>
  );
}

// Fit-side page frame: header + tabs slot + the body, no page scroll unless
// the body needs it; clears the bottom nav.
export function SetupPage({ children, scroll }) {
  return (
    <div className={scroll ? 'no-scrollbar' : undefined} style={{
      position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
      height: '100dvh', boxSizing: 'border-box', overflow: scroll ? 'auto' : 'hidden',
      paddingBottom: 'calc(max(84px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom,0px))',
    }}>
      {children}
    </div>
  );
}
