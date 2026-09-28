import { useState } from 'react';
import { X } from 'lucide-react';
import { getDashboardReminder } from '../data/reminderEngine';

// The come-back nudge, on the home screen.
//
// data/reminderEngine.js has always computed a good one — inactivity tiers at
// 1, 2, 3 and 7 days, a streak-about-to-break case, and a "you are 75% to the
// next level" case — and until now NOTHING called it. The engine was written,
// tested by hand, and then never mounted, so the whole re-engagement loop was
// dead code.
//
// This is the honest delivery channel for it on the web: the athlete sees the
// nudge the moment they open the app. A notification to a locked phone needs a
// push server and the installed app, which is a later step; this needs neither
// and works for every user today.
//
// Renders nothing when the athlete already trained today, or when no tier
// matched. Dismissing hides it for the rest of the day only.
const DISMISS_KEY = 'tm_reminder_card_dismissed';

function dismissedToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === new Date().toDateString();
  } catch { return false; }
}

function markDismissed() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, new Date().toDateString());
  } catch { /* quota */ }
}

const TONE = {
  streak: { emoji: '🔥', border: 'rgba(255,138,58,0.55)', glow: 'rgba(255,138,58,0.5)', fill: 'rgba(255,138,58,0.14)', cta: '#ff8a3a' },
  progress: { emoji: '⚡', border: 'rgba(253,224,71,0.55)', glow: 'rgba(253,224,71,0.45)', fill: 'rgba(253,224,71,0.12)', cta: '#fde047' },
  default: { emoji: '🥊', border: 'rgba(176,106,255,0.55)', glow: 'rgba(176,106,255,0.45)', fill: 'rgba(176,106,255,0.12)', cta: '#c9a6ff' },
};

export default function ReminderCard({ onAction, style, compact = false }) {
  const [reminder, setReminder] = useState(() => (dismissedToday() ? null : getDashboardReminder()));
  if (!reminder) return null;

  const tone = TONE[reminder.category === 'streak' ? 'streak' : reminder.category === 'progress' ? 'progress' : 'default'] || TONE.default;
  const dismiss = () => { markDismissed(); setReminder(null); };
  const act = () => { markDismissed(); setReminder(null); onAction?.(reminder.actionType); };

  // One row, header-height, for Home's toast: it floats over the header, so it
  // must not reach down over the card below.
  if (compact) {
    return (
      <div role="status" style={{
        minHeight: 52, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 12px',
        borderRadius: 14, border: `1px solid ${tone.border}`, boxShadow: `0 10px 30px rgba(0,0,0,.6), 0 0 18px -4px ${tone.glow}`,
        background: 'rgba(20,12,38,0.97)', ...style,
      }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{tone.emoji}</span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12.5, color: '#e7ddf7', lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{reminder.message}</span>
        <button onClick={act} style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: tone.cta, font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', whiteSpace: 'nowrap',
        }}>{reminder.actionLabel.toUpperCase()}</button>
        <button onClick={dismiss} aria-label="Dismiss reminder" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#9a90b8', padding: 4, display: 'flex' }}>
          <X size={14}/>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', borderRadius: 12, marginBottom: 12,
      border: `1.5px solid ${tone.border}`,
      background: `linear-gradient(135deg, ${tone.fill}, rgba(8,2,18,0.9))`,
      boxShadow: `0 0 18px -6px ${tone.glow}`,
      padding: '11px 12px',
      ...style,
    }}>
      <button onClick={dismiss} aria-label="Dismiss reminder" style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9a90b8', padding: 2, display: 'flex' }}>
        <X size={12}/>
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 14 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{tone.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#e7ddf7', lineHeight: 1.35 }}>{reminder.message}</div>
          <button onClick={act} style={{
            marginTop: 8, padding: '6px 13px', borderRadius: 8, cursor: 'pointer',
            background: `${tone.fill}`, border: `1px solid ${tone.border}`, color: tone.cta,
            font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.08em',
          }}>{reminder.actionLabel.toUpperCase()}</button>
        </div>
      </div>
    </div>
  );
}
