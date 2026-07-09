import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Notifications / streak reminders — pixel match of design 25c. UI-only: the
// toggles + reminder persist to localStorage; wiring real push is a later step.
const KEY = 'tm_notification_prefs';
const DEFAULTS = { enabled: false, time: '6:30 PM', repeat: 'MON–FRI', streak: true, bout: true, trophy: true, arcade: false };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

const ALERTS = [
  { key: 'streak', label: '🔥 Streak about to break' },
  { key: 'bout', label: "⚔ Today's bout ready" },
  { key: 'trophy', label: '🏆 New trophy / level up' },
  { key: 'arcade', label: '🕹 New arcade protocol' },
];

function Toggle({ on }) {
  return (
    <div style={{ width: 40, height: 22, borderRadius: 99, background: on ? '#a855f7' : '#2a2140', border: `1px solid ${on ? '#fde047' : 'rgba(255,255,255,0.15)'}`, position: 'relative', transition: 'background 0.15s' }}>
      <span style={{ position: 'absolute', top: 1, [on ? 'right' : 'left']: 1, width: 18, height: 18, borderRadius: '50%', background: on ? '#fde047' : '#6d5a8f', transition: 'all 0.15s' }}/>
    </div>
  );
}

export default function Notifications({ onBack }) {
  const [prefs, setPrefs] = useState(() => load());
  const save = (next) => { setPrefs(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ } };
  const toggle = (k) => save({ ...prefs, [k]: !prefs[k] });

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 10px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#c4a4d8', cursor: 'pointer', display: 'flex', padding: 0 }}><ChevronLeft size={22}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>NOTIFICATIONS</div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px calc(30px + env(safe-area-inset-bottom,0px))' }}>
          {/* Permission prompt */}
          {!prefs.enabled && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(253,224,71,0.4)', background: 'linear-gradient(135deg,rgba(253,224,71,0.08),rgba(168,85,247,0.06))', padding: 14, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🔔</div>
              <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff', marginBottom: 4 }}>STAY ON YOUR STREAK</div>
              <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 12 }}>Fighters who train on schedule level up 3× faster. Let us nudge you.</div>
              <button onClick={() => save({ ...prefs, enabled: true })} style={{ width: '100%', height: 42, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>ENABLE NOTIFICATIONS</button>
            </div>
          )}

          {/* Daily reminder */}
          <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 7 }}>DAILY TRAINING REMINDER</div>
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '4px 13px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>Remind me at</span><span style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fde047', display: 'flex', alignItems: 'center', gap: 3 }}>{prefs.time} <ChevronRight size={12}/></span></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}><span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>Repeat</span><span style={{ font: "700 9px 'Orbitron',sans-serif", color: '#b06aff', display: 'flex', alignItems: 'center', gap: 3 }}>{prefs.repeat} <ChevronRight size={11}/></span></div>
          </div>

          {/* Alert toggles */}
          <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 7 }}>ALERT ME ABOUT</div>
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '4px 13px' }}>
            {ALERTS.map((a, i) => (
              <button key={a.key} onClick={() => toggle(a.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === ALERTS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{a.label}</span>
                <Toggle on={!!prefs[a.key]}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
