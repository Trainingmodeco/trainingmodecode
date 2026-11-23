import { useLayoutEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import OverlayPortal, { OVERLAY_Z } from '../../shared/OverlayPortal';
import swallowNextClick from '../../shared/swallowNextClick';
import { tierImage } from '../../data/tiers';
import { rustyCopy } from '../../data/power';
import { HOME, head, GOLD_BUTTON, RETENTION_CSS } from './tokens';
import { FinalArt, RustyPortraitImage, retentionArt } from './RustyLook';

// The RUSTY pop-up (retention, switch `power`): an athlete back after a month
// away, once per rusty spell, when the app opens on Home (it takes the open's
// one turn in App's queue, so it never stacks on the concept drop, a ghost
// challenge, the guide or a paused session). The fighter covered in dust and
// rust (the owner's art, or the athlete's tier portrait greyed as the stand-in),
// how long it has been, that nothing earned is gone, a gold REVIVE that runs
// TODAY'S BOUT's START (the same path, so the bout's bonus rules apply) and a
// quiet LATER. Nothing here speaks.
//
// The tap that opened the app can come again a moment later (a double tap);
// the pop-up ignores taps for its first moment, and REVIVE and LATER eat the
// click after them (shared/swallowNextClick), so a second tap never lands on
// what is under them.
const GUARD_MS = 350;

// Top-aligned: a portrait's own logo or title at its top edge is never cut.
const ART_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%' };

// The card itself (the gallery shows it as it is).
export function RustyCard({ sex, tierId = 'rookie', daysSince, onRevive, onLater, style }) {
  const c = rustyCopy({ daysSince });
  return (
    <div data-retention="rusty-card" className="rt-anim" onClick={(e) => e.stopPropagation()} style={{
      position: 'relative', width: '100%', maxWidth: 340, borderRadius: 20, overflow: 'hidden', background: '#0c0218',
      boxShadow: `0 0 0 1px ${HOME.rust}99, 0 0 34px rgba(208,138,78,0.28)`, animation: 'rt-pop .4s both', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div style={{ position: 'relative', height: 'clamp(210px, 38vh, 300px)', background: '#08050a' }}>
        <FinalArt
          src={retentionArt('rusty', sex)} style={ART_STYLE}
          standIn={<RustyPortraitImage src={tierImage(tierId, sex)} rusty loading="eager" imgStyle={ART_STYLE}/>}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,2,24,0) 46%, rgba(12,2,24,0.82) 80%, #0c0218 100%)' }}/>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 10 }}>
          <div style={{
            font: "italic 900 40px 'Orbitron',sans-serif", lineHeight: 1, letterSpacing: '0.03em',
            background: 'linear-gradient(180deg, #F6DDB8 0%, #D08A4E 52%, #8A4A20 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(208,138,78,.45)) drop-shadow(2px 2px 0 #2A1206)',
          }}>{c.title}</div>
          <div style={{ font: "600 15px 'Rajdhani',sans-serif", color: '#F1E4D6', marginTop: 6 }}>{c.since}</div>
        </div>
      </div>
      <div style={{ padding: '6px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ font: "600 14px 'Rajdhani',sans-serif", lineHeight: 1.35, color: HOME.muted, textWrap: 'balance' }}>{c.kept}</div>
        <button type="button" className="rt-go" onClick={onRevive} aria-label="Revive: start today's bout" style={{
          height: 52, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: GOLD_BUTTON, color: '#1A1204', ...head(17, 700, { letterSpacing: '0.2em' }), boxShadow: '0 0 24px rgba(242,190,69,0.3)',
        }}><Play size={16} fill="currentColor" strokeWidth={0}/>REVIVE</button>
        <button type="button" onClick={onLater} style={{
          height: 40, marginTop: -4, background: 'none', border: 'none', cursor: 'pointer', color: HOME.muted, ...head(11, 600, { letterSpacing: '0.18em' }),
        }}>LATER</button>
      </div>
    </div>
  );
}

export default function RustyPopup({ sex, tierId, daysSince, onRevive, onLater }) {
  const openedAt = useRef(0);
  useLayoutEffect(() => { openedAt.current = performance.now(); }, []);
  const armed = () => performance.now() - openedAt.current >= GUARD_MS;
  const revive = () => { if (!armed()) return; swallowNextClick(); onRevive?.(); };
  const later = () => { if (!armed()) return; swallowNextClick(); onLater?.(); };
  return (
    <OverlayPortal>
      <div role="dialog" aria-modal="true" aria-label="Your fighter is rusty" data-retention="rusty-popup" onClick={later} style={{
        position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: OVERLAY_Z, boxSizing: 'border-box',
        // margin: auto on the card centres it and, on a short screen, scrolls rather than cuts its top.
        display: 'flex', padding: '20px 22px', overflowY: 'auto',
        background: 'rgba(5,0,12,0.86)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}>
        <RustyCard sex={sex} tierId={tierId} daysSince={daysSince} onRevive={revive} onLater={later} style={{ margin: 'auto' }}/>
      </div>
    </OverlayPortal>
  );
}
