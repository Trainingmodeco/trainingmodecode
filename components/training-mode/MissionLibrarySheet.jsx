import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { Folder, X, Check, ChevronRight } from 'lucide-react';
import { NAV_H } from './Styles';
import OverlayPortal, { OVERLAY_Z } from './shared/OverlayPortal';
import { FLOAT_BACKDROP, floatPanel } from './shared/BottomSheet';
import { GoldButton, GhostButton, Tag, HEAD, BODY, MUTED, VIOLET, VIOLET_TEXT, GOLD } from './shared/FitSetupKit';
import { namedWorkoutById } from './data/namedWorkouts';
import {
  LOADOUTS, THEMES, buildLoadoutMission, missionCardModel, classicMeta,
  filterShelf, themeCounts, loadoutCounts, shelfEntryLine, emptyShelfCopy, loadShelfPrefs, saveShelfPrefs,
} from './data/loadoutMissions';

// Quick Mission · the MISSION LIBRARY sheet: every launch mission and every
// classic in one vertical list (the owner does not want to slide sideways
// through them).
//
// The Workout Map's tall floating sheet (floatPanel, portalled so it rests on
// the tab bar instead of under it). Only the list scrolls: the header, the
// pinned preview of the highlighted mission, the LOADOUT / THEME chips and
// the footer stay put. Tapping a row only highlights it. PUT ON CARD hands it
// to the page, where its card has every control (GUIDED / SOLO, LEVEL,
// swaps); START runs it from here, in the remembered run mode at the level
// its card would open on. The preview is read-only, so nothing in here ever
// opens a second sheet.
//
// The filters are the shelf prefs MISSION SELECT used (tm_qm_shelf_v1), so
// they come back from the last visit.
const same = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const keyOf = (e) => `${e.kind}-${e.id}`;

const CSS = `
@keyframes ml-up { from { transform: translateY(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.ml-row { transition: border-color .18s ease, background .18s ease; }
.ml-row:not([aria-checked="true"]):hover, .ml-row:not([aria-checked="true"]):focus-visible { border-color: ${VIOLET} !important; background: rgba(157,108,255,.12) !important; }
@media (max-height: 760px) { .ml-move-3 { display: none !important; } }
`;

// What the pinned preview shows: the card's own words, at the level START
// would run.
function previewOf(entry, { gear, levelFor }) {
  if (!entry) return null;
  if (entry.kind === 'v2') {
    const m = buildLoadoutMission(entry.id, { level: levelFor(entry.id), gear });
    if (!m) return null;
    const card = missionCardModel(m, { gear });
    return {
      eyebrow: card.eyebrow, title: card.title,
      tags: [{ t: card.tags[0] }, card.accentTag && { t: card.accentTag, accent: true }, ...card.tags.slice(1).map(t => ({ t, accent: t === 'SCALED' }))].filter(Boolean),
      lines: [['LOADOUT', card.loadoutLine], ['MISSION', card.missionLine]],
      moves: card.rows.map(r => [r.name, r.dose]),
    };
  }
  const w = namedWorkoutById(entry.id);
  if (!w) return null;
  const meta = classicMeta(w);
  return {
    eyebrow: `Classic · ${w.tag}`, title: w.title,
    tags: [{ t: `~${w.estMin} min` }, { t: w.focus, accent: true }, meta.accentTag && { t: meta.accentTag, accent: true }, w.needs && { t: w.needs }, w.pro && { t: 'PRO' }].filter(Boolean),
    lines: [['LOADOUT', meta.loadoutLabel]],
    // "+ 3 more" / "× 2 rounds" are notes on the whiteboard, not moves.
    moves: w.lines.filter(([a]) => !/^[+×]\s/.test(a)),
  };
}

const pill = (label, background, color) => (
  <span style={{ flexShrink: 0, font: `800 8px ${HEAD}`, letterSpacing: '0.1em', color, background, borderRadius: 3, padding: '2px 4px' }}>{label}</span>
);

export function CountPill({ n }) {
  return <span style={{ flexShrink: 0, font: `700 11px ${HEAD}`, color: GOLD, background: 'rgba(242,190,69,0.14)', borderRadius: 999, padding: '3px 8px' }}>{n}</span>;
}

// A LOADOUT / THEME chip: the kit's violet radio chip, compact, dimmed (still
// tappable) when its count is 0.
function FilterChip({ on, dim, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={onClick} style={{
      flexShrink: 0, height: 32, padding: '0 10px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
      background: on ? 'rgba(157,108,255,0.22)' : '#16131F', border: `1px solid ${on ? 'rgba(157,108,255,0.55)' : 'transparent'}`,
      color: on ? VIOLET_TEXT : '#E6E2F5', font: `700 10px ${HEAD}`, letterSpacing: '0.12em', opacity: dim ? 0.45 : 1,
    }}>{children}</button>
  );
}

function ChipRow({ label, children }) {
  return (
    <div className="no-scrollbar" role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
      {children}
    </div>
  );
}

// One mission: number, title (+ SOLO / PRO), "~16 MIN · BARBELL · EMOM".
// The accessible name is the title, as the old shelf chips had it.
function MissionRow({ entry, index, on, line, onPick, rowRef }) {
  const name = [entry.title, entry.soloOnly && 'SOLO', entry.pro && 'PRO'].filter(Boolean).join(' ');
  return (
    <button ref={rowRef} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-label={name} className="ml-row" onClick={onPick} style={{
      width: '100%', minHeight: 54, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 10,
      boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer',
      background: on ? 'rgba(242,190,69,0.10)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.75)' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: on ? GOLD : MUTED }}>{String(index + 1).padStart(2, '0')}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ minWidth: 0, font: `700 13px ${HEAD}`, letterSpacing: '0.1em', color: on ? GOLD : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.title}</span>
          {entry.soloOnly && pill('SOLO', '#9D6CFF', '#0D0A18')}
          {entry.pro && pill('PRO', GOLD, '#1A1204')}
        </span>
        <span style={{ font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
      </span>
      {on ? (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: GOLD }}>
          <Check size={14} strokeWidth={3}/>ON TOP
        </span>
      ) : <ChevronRight size={16} color="#7D7799" style={{ flexShrink: 0 }}/>}
    </button>
  );
}

// shelf: shelfEntries() (the page decides what is on it); onTop: the entry
// the page card shows, if any; levelFor(id): the level that mission's card
// opens on; gear: gearProfile().
export default function MissionLibrarySheet({ shelf, onTop, gear, levelFor, onPutOnCard, onStart, onClose }) {
  const [prefs] = useState(() => loadShelfPrefs());
  const [loadout, setLoadout] = useState(prefs.loadout);
  const [theme, setTheme] = useState(prefs.theme);
  const [highlight, setHighlight] = useState(() => (shelf || []).find(e => same(e, onTop)) || null);
  const pickLoadout = (id) => { setLoadout(id); saveShelfPrefs({ loadout: id }); };
  const pickTheme = (id) => { setTheme(id); saveShelfPrefs({ theme: id }); };

  const list = useMemo(() => filterShelf(shelf, { loadout, theme }), [shelf, loadout, theme]);
  const tCounts = useMemo(() => themeCounts(shelf, loadout), [shelf, loadout]);
  const lCounts = useMemo(() => loadoutCounts(shelf, theme), [shelf, theme]);
  // The highlighted row, or the list's first when a filter hid it (it comes
  // back highlighted if the filter does).
  const current = list.find(e => same(e, highlight)) || list[0] || null;
  const preview = useMemo(() => previewOf(current, { gear, levelFor }), [current, gear, levelFor]);
  const groups = [
    { id: 'v2', label: 'MISSIONS', rows: list.filter(e => e.kind === 'v2') },
    { id: 'classic', label: 'CLASSICS', rows: list.filter(e => e.kind === 'classic') },
  ].filter(g => g.rows.length);
  const empty = list.length ? null : emptyShelfCopy({ loadout, theme });

  // Opened with a library mission on the card: start with its row in view.
  const rowRefs = useRef({});
  const panelRef = useRef(null);
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    if (onTop) rowRefs.current[keyOf(onTop)]?.scrollIntoView({ block: 'center' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <OverlayPortal>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: NAV_H, zIndex: OVERLAY_Z, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }}/>
        <div onClick={onClose} style={{ flex: 1, ...FLOAT_BACKDROP }}/>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0 }}/>
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mission library" style={{
          ...floatPanel(VIOLET, { wide: true }), height: 'calc(100% - 56px)', outline: 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'ml-up 0.26s ease',
        }}>
          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px 14px' }}>
            <Folder size={18} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
            <span style={{ minWidth: 0, font: `700 14px ${HEAD}`, letterSpacing: '0.14em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MISSION LIBRARY</span>
            <CountPill n={(shelf || []).length}/>
            <span style={{ flex: 1 }}/>
            <button type="button" aria-label="Close" onClick={onClose} style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#CFC9E4', cursor: 'pointer',
            }}><X size={16}/></button>
          </div>

          {/* The highlighted mission, pinned. Read-only: its controls live on
              the page card. */}
          <div aria-live="polite" style={{
            flexShrink: 0, margin: '0 12px', padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #0D0A18 0%, #120D22 100%)', border: '1px solid rgba(157,108,255,0.35)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {preview ? (
              <>
                <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }}>{preview.eyebrow}</span>
                <span style={{ font: `700 19px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff' }}>{preview.title}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {preview.tags.map(tag => <Tag key={tag.t} accent={tag.accent}>{tag.t}</Tag>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(60px, auto) 1fr', gap: '2px 10px', alignItems: 'baseline' }}>
                  {preview.lines.map(([k, v]) => (
                    <Fragment key={k}>
                      <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{k}</span>
                      <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff', lineHeight: 1.3 }}>{v}</span>
                    </Fragment>
                  ))}
                </div>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {preview.moves.slice(0, 3).map(([a, b], i) => (
                    <li key={`${a}-${i}`} className={`ml-move-${i + 1}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 20, font: `500 13px ${BODY}`, color: '#fff' }}>
                      <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a}</span>
                      {b && <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{b}</span>}
                    </li>
                  ))}
                  {preview.moves.length > 3 && (
                    <li style={{ paddingLeft: 28, font: `600 11px ${HEAD}`, letterSpacing: '0.06em', color: MUTED }}>+ {preview.moves.length - 3} more</li>
                  )}
                </ol>
              </>
            ) : (
              <span style={{ font: `500 13px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>Nothing here for these filters.</span>
            )}
          </div>

          {/* LOADOUT · THEME */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px 6px' }}>
            <ChipRow label="Loadout">
              {LOADOUTS.map(l => (
                <FilterChip key={l.id} on={l.id === loadout} dim={lCounts[l.id] === 0} onClick={() => pickLoadout(l.id)}>{l.label} {lCounts[l.id]}</FilterChip>
              ))}
            </ChipRow>
            <ChipRow label="Theme">
              {THEMES.map(th => (
                <FilterChip key={th.id} on={th.id === theme} dim={tCounts[th.id] === 0} onClick={() => pickTheme(th.id)}>
                  {th.id === 'all' ? 'ANY THEME' : `${th.label} ${tCounts[th.id]}`}
                </FilterChip>
              ))}
            </ChipRow>
          </div>

          {/* The list — the only part that scrolls. */}
          <div className="no-scrollbar" role="radiogroup" aria-label="Missions" style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px 10px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* One block per group, so its sticky header is pushed off by
                the next group's instead of sitting under it. */}
            {groups.map(g => (
              <div key={g.id} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px 4px',
                  background: '#110C22', font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED,
                }}>
                  {g.label}<span style={{ color: '#7D7799' }}>{g.rows.length}</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }}/>
                </div>
                {g.rows.map((e, i) => (
                  <MissionRow key={keyOf(e)} entry={e} index={i} on={same(e, current)} line={shelfEntryLine(e, { level: e.kind === 'v2' ? levelFor(e.id) : undefined })}
                    onPick={() => setHighlight(e)} rowRef={(el) => { rowRefs.current[keyOf(e)] = el; }}/>
                ))}
              </div>
            ))}
            {empty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
                <div style={{ font: `500 13px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{empty.text}</div>
                {empty.action && <GhostButton label={empty.action.label} height={40} onClick={() => pickLoadout(empty.action.loadout)}/>}
              </div>
            )}
          </div>

          {/* PUT ON CARD · START, pinned. */}
          <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 10, padding: '10px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <GhostButton label="PUT ON CARD" height={48} onClick={current ? () => onPutOnCard?.(current) : undefined}
              style={{ fontSize: 12, opacity: current ? 1 : 0.45, cursor: current ? 'pointer' : 'default' }}/>
            <GoldButton label="START" icon="play" height={48} disabled={!current} onClick={() => current && onStart?.(current)} style={{ fontSize: 16, letterSpacing: '0.2em' }}/>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
