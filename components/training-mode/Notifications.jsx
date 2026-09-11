import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import { ChevronLeft } from 'lucide-react';
import {
  loadReminderSettings, saveReminderSettings,
  requestNotificationPermission, getNotificationPermissionStatus,
} from './data/reminderEngine';

// Notifications / streak reminders.
//
// This screen used to LIE. "ENABLE NOTIFICATIONS" set a localStorage flag and
// never asked the browser for permission, so an athlete who tapped it believed
// notifications were on when nothing had been granted and nothing would ever
// fire. It also showed "Remind me at 6:30 PM · Repeat MON–FRI" with chevrons,
// as if those were settings, when neither was stored or read by anything.
//
// What is true on the web today:
//   · The come-back nudge is REAL and shows on the home screen when you open
//     the app (shared/ReminderCard + data/reminderEngine).
//   · The browser permission is real and worth asking for, because it is the
//     prerequisite for everything else and cannot be granted later without it.
//   · A notification to a LOCKED phone needs a push server and the installed
//     app. That is not built. This screen says so instead of implying it works.
//
// The alert toggles write to the same settings object the reminder engine
// reads, so turning "streak about to break" off genuinely silences that tier.
const ALERTS = [
  { key: 'streakReminders', label: '🔥 Streak about to break' },
  { key: 'programReminders', label: '⚔️ Time to train again' },
];

function Toggle({ on }) {
  return (
    <div style={{ width: 40, height: 22, borderRadius: 99, background: on ? '#a855f7' : '#2a2140', border: `1px solid ${on ? '#fde047' : 'rgba(255,255,255,0.15)'}`, position: 'relative', transition: 'background 0.15s' }}>
      <span style={{ position: 'absolute', top: 1, [on ? 'right' : 'left']: 1, width: 18, height: 18, borderRadius: '50%', background: on ? '#fde047' : '#9a90b8', transition: 'all 0.15s' }}/>
    </div>
  );
}

const label = { font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 7 };
const body = { font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', lineHeight: 1.5 };

export default function Notifications({ onBack }) {
  const [settings, setSettings] = useState(() => loadReminderSettings());
  const [permission, setPermission] = useState(() => getNotificationPermissionStatus());
  const [asking, setAsking] = useState(false);

  const save = (next) => { setSettings(next); saveReminderSettings(next); };
  const toggle = (k) => save({ ...settings, [k]: !settings[k] });

  const ask = async () => {
    setAsking(true);
    const result = await requestNotificationPermission();
    setPermission(result === 'unavailable' ? 'unavailable' : getNotificationPermissionStatus());
    if (result === 'granted') save({ ...settings, enabled: true });
    setAsking(false);
  };

  const granted = permission === 'granted';
  const denied = permission === 'denied';
  const unavailable = permission === 'unavailable';

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 10px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: '#c4a4d8', cursor: 'pointer', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={22}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>REMINDERS</div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px calc(30px + env(safe-area-inset-bottom,0px))' }}>

          {/* What actually happens — stated first, because the old screen's
              whole problem was that a user could not tell. */}
          <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.35)', background: 'rgba(176,106,255,0.07)', padding: 13, marginBottom: 16 }}>
            <div style={{ font: "900 11px 'Orbitron',sans-serif", color: '#e6d4ff', letterSpacing: '0.08em', marginBottom: 6 }}>HOW REMINDERS WORK</div>
            <div style={body}>
              Miss a day and your nudge is waiting on the home screen the next
              time you open Training Mode. It knows your streak, how long you
              have been off, and how close you are to the next level.
            </div>
            <div style={{ ...body, marginTop: 8, color: '#9a90b8' }}>
              A nudge to a locked phone is not built yet. It needs the installed
              app, and it lands with the native build.
            </div>
          </div>

          {/* Permission — the real browser state, not a pretend flag */}
          <div style={label}>PHONE NOTIFICATIONS</div>
          <div style={{ borderRadius: 12, border: `1px solid ${granted ? 'rgba(34,197,94,0.45)' : 'rgba(253,224,71,0.35)'}`, background: 'rgba(8,2,18,0.7)', padding: 13, marginBottom: 16 }}>
            {unavailable && (
              <div style={body}>This browser cannot show notifications at all. Your reminders still appear in the app.</div>
            )}
            {denied && (
              <div style={body}>
                Blocked. Your reminders still appear in the app. To allow phone
                notifications, open your browser&apos;s site settings for
                Training Mode and switch Notifications to Allow.
              </div>
            )}
            {granted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }}/>
                <div style={{ ...body, color: '#8fe8ac' }}>
                  Allowed. Ready for phone reminders the moment the native build
                  ships. Nothing else to do.
                </div>
              </div>
            )}
            {!granted && !denied && !unavailable && (
              <>
                <div style={{ ...body, marginBottom: 11 }}>
                  Allowing this now means phone reminders work the day they ship.
                  It costs nothing and changes nothing today.
                </div>
                <button onClick={ask} disabled={asking} style={{ width: '100%', height: 42, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: asking ? 'default' : 'pointer', opacity: asking ? 0.7 : 1 }}>
                  {asking ? 'ASKING…' : 'ALLOW NOTIFICATIONS'}
                </button>
              </>
            )}
          </div>

          {/* Which nudges — these genuinely gate the engine's tiers */}
          <div style={label}>NUDGE ME ABOUT</div>
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '4px 13px', marginBottom: 10 }}>
            {ALERTS.map((a, i) => (
              <button key={a.key} onClick={() => toggle(a.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === ALERTS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{a.label}</span>
                <Toggle on={settings[a.key] !== false}/>
              </button>
            ))}
          </div>
          <div style={{ ...body, fontSize: 9, color: '#7a7196', textAlign: 'center' }}>
            Turning one off silences that nudge everywhere, including the home screen.
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
