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

export default function ReminderCard({ onAction, style }) {
  const [reminder, setReminder] = useState(() => (dismissedToday() ? null : getDashboardReminder()));
  if (!reminder) return null;

  const tone = TONE[reminder.category === 'streak' ? 'streak' : reminder.category === 'progress' ? 'progress' : 'default'] || TONE.default;
  const dismiss = () => { markDismissed(); setReminder(null); };
  const act = () => { markDismissed(); setReminder(null); onAction?.(reminder.actionType); };

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
