import { momentCopy } from '../../data/weekStreak';
import WeekChip from './WeekChip';
import { RETENTION_CSS } from './tokens';

// The end screen's one quiet strip (retention feature 1), in YOUR PROGRESS:
// the training day this session filled ("TRAINING DAY 3 OF 4 · STREAK KEPT"),
// or the week it completed, with the week chip's new dot popping in; a line
// when a freeze was earned, and one when it was the daily mission.
// `moment` comes from data/weekStreak sessionMoment; `missionXp` is the daily
// mission bonus this session paid (0 or absent when none).
export default function WeekMomentStrip({ moment, missionXp = 0 }) {
  if (!moment && !(missionXp > 0)) return null;
  // The day was already counted: just the mission line.
  if (!moment) {
    return (
      <div data-retention="week-moment" style={{ borderTop: '1px solid rgba(176,106,255,0.18)', paddingTop: 7, marginBottom: 7 }}>
        <span style={{ font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: '#8fe8ac' }}>✓ DAILY MISSION · +{missionXp} XP</span>
      </div>
    );
  }
  const copy = momentCopy(moment);
  const complete = moment.kind !== 'kept';
  return (
    <div data-retention="week-moment" className="rt-anim" style={{
      borderTop: '1px solid rgba(176,106,255,0.18)', paddingTop: 7, marginBottom: 7, animation: 'rt-rise .45s .2s both',
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div style={{ font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.08em', lineHeight: 1.35, color: complete ? '#fde047' : '#f5e9ff' }}>
        <span aria-hidden style={{ marginRight: 5 }}>{complete ? '🏆' : '🔥'}</span>{copy.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <WeekChip days={moment.days} done={moment.done} target={moment.target} streak={moment.streak} freezes={moment.freezes || 0} pop={moment.popIndex}/>
        <div style={{ flex: 1, minWidth: 0, font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', lineHeight: 1.3 }}>{copy.sub}</div>
      </div>
      {(copy.freeze || missionXp > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
          {copy.freeze && <span style={{ font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: '#9ad8ff', animation: 'rt-pop .5s .9s both' }}>❄ {copy.freeze}</span>}
          {missionXp > 0 && <span style={{ font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: '#8fe8ac' }}>✓ DAILY MISSION · +{missionXp} XP</span>}
        </div>
      )}
    </div>
  );
}
