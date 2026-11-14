import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import DisciplineTabs, { useDiscipline } from './shared/DisciplineTabs';
import { FightBackdrop } from './shared/FightTimerKit';
import { PRACTICE_DISCIPLINES } from './practiceData';
import { shadowClipsFor, shadowGroups, shadowClock } from './data/shadowboxing';

// Fight Mode › Practice › SHADOWBOXING: the owner's follow-along clips
// (10 s to a minute), by discipline and by the group each sits in. The list is
// public/static/practice/shadow/index.json (data/shadowboxing.js), so a new
// delivery needs no code. Tiles show the poster; a tile opens one centred card
// that plays the clip, with PREVIOUS and NEXT through the discipline's list.

const GOLD = '#F2BE45';
const SOFT = '#A9B4D6';
const LEVEL = { Beginner: ['BEGINNER', '#4ADE80'], Intermediate: ['INTERMEDIATE', GOLD], Advanced: ['ADVANCED', '#F87171'] };

const css = `
.sb-hit { transition: border-color .18s ease, color .18s ease, box-shadow .18s ease, filter .18s ease; }
.sb-hit:hover, .sb-hit:focus-visible { border-color: ${GOLD} !important; }
.sb-txt:hover, .sb-txt:focus-visible { color: ${GOLD} !important; }
.sb-tile:hover, .sb-tile:focus-visible { border-color: ${GOLD} !important; box-shadow: 0 0 14px rgba(61,123,255,.4); }
.sb-tile:active { transform: scale(0.98); }
.sb-gold:hover, .sb-gold:focus-visible { filter: brightness(1.1); }
.sb-scroll { scrollbar-width: thin; scrollbar-color: rgba(143,180,255,.35) transparent; }
`;
const label = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: SOFT };
const Play = ({ size = 11, style }) => <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, fill: 'currentColor', ...style }}><path d="M7 4l13 8-13 8z"/></svg>;

// A clip's poster; a missing poster leaves the striped plate, never a broken image.
function Poster({ src }) {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [src]);
  if (!ok) return null;
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>;
}

function ClipCard({ clip, index, total, onPrev, onNext, onClose, onCombo }) {
  const videoRef = useRef(null);
  const [lvl, lvlColor] = LEVEL[clip.level] || [];
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.play().catch(() => { /* the controls are up; a tap plays it */ });
    return () => { v?.pause(); };
  }, [clip.id]);
  const meta = [clip.group, shadowClock(clip.seconds)].filter(Boolean).join(' · ');
  const nav = (disabled) => ({
    flex: 1, height: 40, borderRadius: 9, background: 'transparent', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
  });
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 200 }}>
      <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(3,2,8,.78)', border: 0, backdropFilter: 'blur(3px)', cursor: 'default' }}/>
      <div role="dialog" aria-modal="true" aria-label={clip.title} data-testid="shadow-player" style={{
        position: 'absolute', left: 14, right: 14, top: '50%', transform: 'translateY(-50%)', maxHeight: 'calc(100dvh - 28px)',
        boxSizing: 'border-box', borderRadius: 18, overflow: 'hidden', background: '#0A0716', color: '#fff',
        border: '1.5px solid rgba(168,85,247,.6)', boxShadow: '0 0 30px rgba(168,85,247,.35), 0 24px 60px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', flexShrink: 0, maxHeight: '38dvh', background: '#000' }}>
          <video
            key={clip.id} ref={videoRef} src={clip.videoUrl} poster={clip.posterUrl}
            autoPlay muted playsInline controls preload="metadata"
            aria-label={`${clip.title} shadowboxing clip`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
          <button type="button" className="sb-hit sb-txt" aria-label="Close" onClick={onClose} style={{
            position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.5)',
            border: '1px solid rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', fontSize: 14,
          }}>✕</button>
          <span style={{
            position: 'absolute', top: 10, left: 10, font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(196,168,255,.6)', color: '#D2BCFF', background: 'rgba(0,0,0,.4)',
          }}>SHADOWBOXING</span>
        </div>
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', lineHeight: 1.15 }}>{clip.title}</span>
            <span style={{ ...label, letterSpacing: '0.12em' }}>
              {meta}{lvl && <span style={{ color: lvlColor }}>{meta ? ' · ' : ''}{lvl}</span>}
            </span>
          </div>
          {clip.note && <span style={{ fontSize: 13, color: '#A9A3C4', lineHeight: 1.3 }}>{clip.note}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="sb-hit sb-txt" disabled={!onPrev} onClick={onPrev} style={nav(!onPrev)}>‹ PREVIOUS</button>
            <span style={{ ...label, flexShrink: 0, color: '#8FB4FF' }}>{index + 1} / {total}</span>
            <button type="button" className="sb-hit sb-txt" disabled={!onNext} onClick={onNext} style={nav(!onNext)}>NEXT ›</button>
          </div>
          <button type="button" className="sb-gold" onClick={onCombo} style={{
            height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: 0, cursor: 'pointer', color: '#1A1204', fontFamily: "'Chakra Petch',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em',
            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
            background: 'linear-gradient(180deg,#FFE9A8,#F2BE45 50%,#C98A1C)',
          }}>🥊 DRILL A COMBO</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PracticeShadowboxing({ clips, onBack, onComboCoach }) {
  const [stored, pickStored] = useDiscipline();
  const discipline = PRACTICE_DISCIPLINES.includes(stored) ? stored : 'Boxing';
  const [openId, setOpenId] = useState(null);

  const list = useMemo(() => shadowClipsFor(clips, discipline), [clips, discipline]);
  const groups = useMemo(() => shadowGroups(list), [list]);
  const openIndex = openId ? list.findIndex((c) => c.id === openId) : -1;
  const open = openIndex >= 0 ? list[openIndex] : null;
  const step = useCallback((by) => { const next = list[openIndex + by]; if (next) setOpenId(next.id); }, [list, openIndex]);

  // Switching discipline closes the card: its clip is no longer in the list.
  useEffect(() => { setOpenId(null); }, [discipline]);

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: css }}/>
      <div data-testid="shadow-view" style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10,
        height: '100dvh', boxSizing: 'border-box', padding: '10px 16px 0',
        paddingBottom: 'calc(max(108px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
          <button type="button" className="sb-txt" aria-label="Back to Practice" onClick={onBack} style={{
            width: 40, height: 44, marginLeft: -10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
          }}><ChevronLeft size={22}/></button>
          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ font: "700 20px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1 }}>SHADOWBOXING</div>
            <div style={{ fontSize: 12, color: SOFT }}>Watch, then throw along</div>
          </div>
        </header>

        <DisciplineTabs value={discipline} guide="sb-discipline" onChange={pickStored}/>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={label}>{discipline.toUpperCase()}</span>
          <span style={{ ...label, letterSpacing: '0.12em', color: '#8FB4FF' }}>{list.length} {list.length === 1 ? 'CLIP' : 'CLIPS'}</span>
        </div>

        <div className="sb-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(({ group, clips: inGroup }) => (
            <section key={group} aria-label={group} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...label, color: GOLD }}>{group.toUpperCase()} · {inGroup.length}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                {inGroup.map((c) => {
                  const [lvl, lvlColor] = LEVEL[c.level] || [];
                  return (
                    <button key={c.id} type="button" className="sb-tile" aria-label={`Play ${c.title}`} onClick={() => setOpenId(c.id)} style={{
                      display: 'flex', flexDirection: 'column', gap: 5, padding: 5, borderRadius: 10, minWidth: 0, textAlign: 'left', cursor: 'pointer',
                      background: '#0B0F22', border: '1px solid rgba(61,123,255,.22)', color: '#fff', transition: 'border-color .18s ease, box-shadow .18s ease',
                    }}>
                      <span style={{
                        position: 'relative', display: 'block', aspectRatio: '16 / 9', borderRadius: 7, overflow: 'hidden',
                        background: 'repeating-linear-gradient(135deg, #1A1030 0 12px, #150C28 12px 24px)',
                      }}>
                        <Poster src={c.posterUrl}/>
                        <span style={{
                          position: 'absolute', left: 6, bottom: 6, width: 24, height: 24, borderRadius: '50%', color: '#1A1204',
                          background: 'linear-gradient(180deg,#FFE9A8,#F2BE45 55%,#C98A1C)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Play size={10} style={{ marginLeft: 1 }}/></span>
                        {c.seconds > 0 && (
                          <span style={{
                            position: 'absolute', right: 6, bottom: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.65)',
                            font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.06em',
                          }}>{shadowClock(c.seconds)}</span>
                        )}
                      </span>
                      <span style={{
                        font: "700 12px 'Chakra Petch',sans-serif", lineHeight: 1.2, padding: '0 3px', minHeight: 29,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{c.title}</span>
                      {lvl && <span style={{ font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: lvlColor, padding: '0 3px 2px' }}>{lvl}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!list.length && (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: SOFT }}>No shadowboxing clips for {discipline} yet — try another discipline.</div>
          )}
        </div>
      </div>

      {open && (
        <ClipCard
          clip={open} index={openIndex} total={list.length}
          onPrev={openIndex > 0 ? () => step(-1) : undefined}
          onNext={openIndex < list.length - 1 ? () => step(1) : undefined}
          onClose={() => setOpenId(null)}
          onCombo={() => { setOpenId(null); onComboCoach?.(discipline); }}
        />
      )}
    </PhoneFrame>
  );
}
