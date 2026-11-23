import { RotateCcw } from 'lucide-react';
import { ARC, RETENTION_CSS } from './tokens';

// The near-miss panel (retention feature 3): how close the session came, in
// plain words from its real counts (data/nearMiss), the bar, and two buttons
// of the same size: RETRY and COME BACK FRESH TOMORROW. When a retry is not
// safe (data/retrySafety: a boss, MAX OUT, a second go today, three sessions
// today) the line says when to come back and the one button is DONE FOR TODAY.
// There is no reminder to hook a REMIND ME TOMORROW into, so it is left out.
//
//   miss:  nearMiss() → { line, value, max, left, right }
//   gate:  canRetryNow() → { allowed, line } (a gate with no line shows none:
//          the classic clear, where a win never reads "come back tomorrow")
//   onRetry / retryLabel: the same session again (only when allowed)
//   onLeave / leaveLabel: the way out (home); null leaves the button out (a
//          screen that keeps its own way out, the classic clear)
//   alt:   { label, onClick } in place of the way out (the clear's next stage)
export default function NearMissPanel({ miss, gate, onRetry, retryLabel = 'RETRY', onLeave, leaveLabel, alt = null, eyebrow = 'HOW CLOSE', style }) {
  if (!miss) return null;
  const allowed = !!gate?.allowed && typeof onRetry === 'function';
  const pct = miss.max > 0 ? Math.max(0, Math.min(100, (miss.value / miss.max) * 100)) : 0;
  const second = alt || (onLeave ? { label: leaveLabel || (allowed ? 'COME BACK FRESH TOMORROW' : 'DONE FOR TODAY'), onClick: onLeave } : null);
  // The big line in capitals, but a seconds gap keeps its "s" ("12 s OFF ★★★").
  const big = String(miss.line || '').toUpperCase().replace(/(\d) S\b/g, '$1 s');
  const btn = {
    width: '100%', minHeight: 46, height: '100%', padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
    // 11.5px and tight spacing: COME BACK FRESH TOMORROW stays on one line
    // down to a 230px label box (a 320px phone, the gallery's phone frame).
    font: `900 11.5px ${ARC.head}`, letterSpacing: '0.03em', lineHeight: 1.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center',
  };
  return (
    <div data-retention="near-miss" role="group" aria-label={`${eyebrow.toLowerCase()}: ${miss.line}`} className="rt-anim" style={{
      background: 'rgba(8,2,18,0.9)', border: '1px solid rgba(253,224,71,0.32)', borderRadius: 12, padding: '10px 12px 12px',
      animation: 'rt-rise .45s .25s both', textAlign: 'left', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div style={{ font: `700 8px ${ARC.head}`, color: '#b06aff', letterSpacing: '0.16em' }}>{eyebrow}</div>
      <div style={{ font: `900 18px ${ARC.head}`, color: ARC.gold, letterSpacing: '0.04em', lineHeight: 1.15, marginTop: 4, textShadow: '0 0 14px rgba(253,224,71,0.35)' }}>{big}</div>
      <div aria-hidden style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,#b06aff,#fde047)', transformOrigin: 'left center', animation: 'rt-fill .8s .45s both' }}/>
      </div>
      {(miss.left || miss.right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px', marginTop: 5, font: `600 8px ${ARC.head}`, letterSpacing: '0.08em', color: ARC.muted }}>
          <span>{miss.left}</span>{miss.right && <span>{miss.right}</span>}
        </div>
      )}
      {!allowed && gate?.line && (
        <div style={{ font: `600 12px ${ARC.body}`, color: ARC.text, lineHeight: 1.35, marginTop: 8 }}>{gate.line}</div>
      )}
      {(allowed || second) && (
        // One grid row height for both: a label that wraps on a narrow phone
        // makes both buttons taller, never one bigger than the other.
        <div style={{ display: 'grid', gridAutoRows: '1fr', gap: 8, marginTop: 10 }}>
          {allowed && (
            <button type="button" className="rt-go" onClick={onRetry} style={{ ...btn, border: 'none', background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', boxShadow: '0 0 18px rgba(253,224,71,0.3)' }}>
              <RotateCcw size={14} strokeWidth={2.6} aria-hidden/>{retryLabel}
            </button>
          )}
          {second && (
            <button type="button" className="rt-go" onClick={second.onClick} style={{ ...btn, border: '1px solid rgba(176,106,255,0.6)', background: 'rgba(176,106,255,0.16)', color: ARC.text }}>
              {second.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
