import { Play } from 'lucide-react';
import { HOME, head, GOLD_BUTTON, RETENTION_CSS } from './tokens';

// The DAILY MISSION card at the top of Home (retention feature 1): today's
// 3-minute mission, its bonus XP and one tap to start; after it is done, the
// done state until tomorrow's mission. `mission` comes from data/dailyMission.
export default function DailyMissionCard({ mission, done = false, weekDone = 0, weekTarget = 4, onStart, style }) {
  if (!mission) return null;
  const dayLine = weekDone >= weekTarget ? 'WEEK TARGET MET' : `DAY ${weekDone} OF ${weekTarget}`;
  return (
    <section data-guide="home-daily-mission" className="rt-anim" style={{
      position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '12px 14px 14px', flexShrink: 0, boxSizing: 'border-box',
      background: done ? HOME.tile : 'linear-gradient(135deg, rgba(242,190,69,.16), rgba(157,108,255,.14))',
      border: `1px solid ${done ? 'rgba(143,232,172,.4)' : 'rgba(242,190,69,.55)'}`, ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      {!done && <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 40, background: 'rgba(255,255,255,.10)', animation: 'rt-shine 3.2s 1s infinite', pointerEvents: 'none' }}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...head(10), color: done ? HOME.green : HOME.gold, whiteSpace: 'nowrap' }}>{done ? '✓ DAILY MISSION DONE' : 'DAILY MISSION'}</span>
        <span style={{ marginLeft: 'auto', ...head(10, 600), color: HOME.muted, whiteSpace: 'nowrap' }}>{done ? 'NEW ONE TOMORROW' : `${mission.minutes} MIN`}</span>
      </div>
      <div style={{ ...head(18, 700, { letterSpacing: '0.02em', lineHeight: 1.15 }), color: '#fff', marginTop: 6 }}>{mission.title}</div>
      <div style={{ fontSize: 13, color: HOME.muted, marginTop: 3, lineHeight: 1.3 }}>{mission.line}</div>
      {done ? (
        <div style={{ ...head(13), color: HOME.green, marginTop: 10 }}>+{mission.bonusXp} XP · {dayLine} ✓</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button type="button" className="rt-go" onClick={onStart} style={{
            flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: GOLD_BUTTON, color: '#1A1204', ...head(14, 700, { letterSpacing: '0.18em' }),
          }}><Play size={14} fill="currentColor" strokeWidth={0}/>START</button>
          <span style={{ ...head(13), color: HOME.gold, whiteSpace: 'nowrap', flexShrink: 0 }}>+{mission.bonusXp} XP</span>
        </div>
      )}
    </section>
  );
}
