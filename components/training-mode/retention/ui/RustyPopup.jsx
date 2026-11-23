import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import OverlayPortal, { OVERLAY_Z } from '../../shared/OverlayPortal';
import swallowNextClick from '../../shared/swallowNextClick';
import { tierImage } from '../../data/tiers';
import { rustyCopy } from '../../data/power';
import { HOME, head, GOLD_BUTTON, RETENTION_CSS } from './tokens';
import { FinalArt, RustyPortraitImage, retentionArt } from './RustyLook';
import SafeImage from '../../SafeImage';
import { DustDrift, DustBurst, BURST_MS } from './DustFX';

// The RUSTY pop-up (retention, switch `power`): an athlete back after a month
// away, once per rusty spell, when the app opens on Home (it takes the open's
// one turn in App's queue, so it never stacks on the concept drop, a ghost
// challenge, the guide or a paused session). The fighter covered in dust and
// rust (the owner's art, or the athlete's tier portrait greyed as the stand-in),
// how long it has been, that nothing earned is gone, a gold REVIVE that runs
// TODAY'S BOUT's START (the same path, so the bout's bonus rules apply) and a
// quiet LATER. Nothing here speaks.
//
// Dust floats through the picture while it is open (DustFX). REVIVE first
// plays the comeback: the fighter wiping the dust off (the owner's revive art)
// fades in over the rusty one, the dust and rust blow off in one burst, and
// the bout starts once it settles (REVIVE_HOLD_MS). Taps during it do
// nothing. With reduced motion the bout starts at once.
//
// The tap that opened the app can come again a moment later (a double tap);
// the pop-up ignores taps for its first moment, and REVIVE and LATER eat the
// click after them (shared/swallowNextClick), so a second tap never lands on
// what is under them.
const GUARD_MS = 350;
export const REVIVE_HOLD_MS = BURST_MS + 250;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Top-aligned: a portrait's own logo or title at its top edge is never cut.
const ART_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%' };

// The card itself (the gallery shows it as it is; there, with no onRevive,
// REVIVE plays the comeback and then returns to RUSTY, so it can be seen
// again). `guard` says whether a tap counts yet; `onReviveStart` tells the
// pop-up the comeback is playing.
export function RustyCard({ sex, tierId = 'rookie', daysSince, onRevive, onLater, guard, onReviveStart, reviving: shown = false, style }) {
  const c = rustyCopy({ daysSince });
  const [playing, setPlaying] = useState(false);
  const reviving = playing || shown;
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tapRevive = () => {
    if (reviving || (guard && !guard())) return;
    swallowNextClick();
    if (reducedMotion()) { onRevive?.(); return; }
    onReviveStart?.();
    setPlaying(true);
    timer.current = setTimeout(() => {
      if (onRevive) onRevive();
      else timer.current = setTimeout(() => setPlaying(false), 1400);
    }, REVIVE_HOLD_MS);
  };
  const tapLater = () => {
    if (reviving || (guard && !guard())) return;
    swallowNextClick();
    onLater?.();
  };
  return (
    <div data-retention="rusty-card" className="rt-anim" onClick={(e) => e.stopPropagation()} style={{
      position: 'relative', width: '100%', maxWidth: 340, borderRadius: 20, overflow: 'hidden', background: '#0c0218',
      boxShadow: reviving ? '0 0 0 1px rgba(192,132,252,0.75), 0 0 40px rgba(168,85,247,0.45)' : `0 0 0 1px ${HOME.rust}99, 0 0 34px rgba(208,138,78,0.28)`,
      transition: 'box-shadow .5s ease', animation: 'rt-pop .4s both', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div style={{ position: 'relative', height: 'clamp(210px, 38vh, 300px)', background: '#08050a' }}>
        <FinalArt
          src={retentionArt('rusty', sex)} style={ART_STYLE}
          standIn={<RustyPortraitImage src={tierImage(tierId, sex)} rusty loading="eager" imgStyle={ART_STYLE}/>}
        />
        {/* The comeback picture, loaded with the pop-up so it is there the moment REVIVE is tapped. */}
        <SafeImage src={retentionArt('revive', sex)} alt="" loading="eager" preferWebp={false}
          style={{ ...ART_STYLE, opacity: reviving ? 1 : 0, transition: 'opacity .45s ease' }}/>
        {reviving ? <DustBurst/> : <DustDrift/>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,2,24,0) 46%, rgba(12,2,24,0.82) 80%, #0c0218 100%)' }}/>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 10 }}>
          <div key={reviving ? 'revive' : 'rusty'} style={{
            font: "italic 900 40px 'Orbitron',sans-serif", lineHeight: 1, letterSpacing: '0.03em',
            background: reviving ? 'linear-gradient(180deg, #FFFFFF 0%, #D8B4FE 48%, #9333EA 100%)' : 'linear-gradient(180deg, #F6DDB8 0%, #D08A4E 52%, #8A4A20 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: reviving ? 'drop-shadow(0 0 14px rgba(168,85,247,.7)) drop-shadow(2px 2px 0 #2A0A4A)' : 'drop-shadow(0 0 12px rgba(208,138,78,.45)) drop-shadow(2px 2px 0 #2A1206)',
            animation: reviving ? 'rt-slam .45s both' : undefined,
          }}>{reviving ? c.reviveTitle : c.title}</div>
          <div style={{ font: "600 15px 'Rajdhani',sans-serif", color: '#F1E4D6', marginTop: 6 }}>{reviving ? c.reviving : c.since}</div>
        </div>
      </div>
      <div style={{ padding: '6px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ font: "600 14px 'Rajdhani',sans-serif", lineHeight: 1.35, color: HOME.muted, textWrap: 'balance' }}>{c.kept}</div>
        <button type="button" className="rt-go" onClick={tapRevive} aria-label="Revive: start today's bout" aria-disabled={reviving || undefined} style={{
          height: 52, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: GOLD_BUTTON, color: '#1A1204', ...head(17, 700, { letterSpacing: '0.2em' }), boxShadow: '0 0 24px rgba(242,190,69,0.3)',
          opacity: reviving ? 0.6 : 1, transition: 'opacity .3s ease',
        }}><Play size={16} fill="currentColor" strokeWidth={0}/>REVIVE</button>
        <button type="button" onClick={tapLater} disabled={reviving} style={{
          height: 40, marginTop: -4, background: 'none', border: 'none', cursor: reviving ? 'default' : 'pointer', color: HOME.muted, ...head(11, 600, { letterSpacing: '0.18em' }),
          opacity: reviving ? 0.35 : 1, transition: 'opacity .3s ease',
        }}>LATER</button>
      </div>
    </div>
  );
}

export default function RustyPopup({ sex, tierId, daysSince, onRevive, onLater }) {
  const openedAt = useRef(0);
  useLayoutEffect(() => { openedAt.current = performance.now(); }, []);
  const busy = useRef(false);
  const armed = () => performance.now() - openedAt.current >= GUARD_MS;
  const later = () => { if (!armed() || busy.current) return; swallowNextClick(); onLater?.(); };
  return (
    <OverlayPortal>
      <div role="dialog" aria-modal="true" aria-label="Your fighter is rusty" data-retention="rusty-popup" onClick={later} style={{
        position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: OVERLAY_Z, boxSizing: 'border-box',
        // margin: auto on the card centres it and, on a short screen, scrolls rather than cuts its top.
        display: 'flex', padding: '20px 22px', overflowY: 'auto',
        background: 'rgba(5,0,12,0.86)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}>
        <RustyCard sex={sex} tierId={tierId} daysSince={daysSince} guard={armed} onReviveStart={() => { busy.current = true; }}
          onRevive={() => onRevive?.()} onLater={() => onLater?.()} style={{ margin: 'auto' }}/>
      </div>
    </OverlayPortal>
  );
}
