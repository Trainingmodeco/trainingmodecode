import { useState } from 'react';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from '../data/links';

// Beta TM-05 — the global feedback affordance. The form used to live four
// taps deep (Profile → Edit Profile → scroll past Game Plan), which meant a
// tester who hit a problem had lost the context by the time they reached it.
// This chip is on every screen, two taps from any frustration.
//
// Context (screen, timestamp, viewport, user agent) is copied to the
// clipboard on tap — Google Forms can't accept arbitrary prefill params, so
// the tester pastes one line instead of remembering four facts. Anchored to
// the APP COLUMN, not the viewport (the RS-04 lesson): on desktop it hugs
// the frame, never strands in empty background.
export default function FeedbackChip({ screen }) {
  const [copied, setCopied] = useState(false);

  const report = async () => {
    const ctx = [
      `screen: ${screen}`,
      `time: ${new Date().toISOString()}`,
      `viewport: ${window.innerWidth}x${window.innerHeight} ${window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'}`,
      `ua: ${navigator.userAgent}`,
    ].join(' · ');
    try {
      await navigator.clipboard.writeText(ctx);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable — the form still opens */ }
    // Small delay so the "copied" note is seen before the form tab fronts.
    setTimeout(() => openExternalUrl(BETA_FEEDBACK_FORM_URL), copied ? 0 : 900);
  };

  return (
    <>
      <button
        onClick={report}
        aria-label="Report beta feedback"
        style={{
          position: 'fixed',
          bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
          left: 'max(10px, calc((100vw - 440px) / 2 + 10px))',
          zIndex: 320,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 99, cursor: 'pointer',
          background: 'rgba(20,6,38,0.92)', border: '1px solid rgba(253,224,71,0.4)',
          boxShadow: '0 4px 14px -6px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ fontSize: 11 }}>🐞</span>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, color: '#fde047', letterSpacing: '0.1em' }}>BETA</span>
      </button>
      {copied && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(108px + env(safe-area-inset-bottom, 0px))',
          left: 'max(10px, calc((100vw - 440px) / 2 + 10px))',
          zIndex: 320, padding: '7px 11px', borderRadius: 9,
          background: 'rgba(20,6,38,0.95)', border: '1px solid rgba(34,197,94,0.5)',
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#4ade80',
          pointerEvents: 'none',
        }}>
          ✓ Screen &amp; device info copied — paste it into the form
        </div>
      )}
    </>
  );
}
