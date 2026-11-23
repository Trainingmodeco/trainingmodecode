import { useState } from 'react';
import { History } from 'lucide-react';
import PhoneFrame from '../PhoneFrame';
import { SetupHeader, SetupPage, fitKitCSS, HEAD, BODY, MUTED, VIOLET_TEXT } from '../shared/FitSetupKit';
import { CountPill } from '../MissionLibrarySheet';
import WorkoutHistoryList from './ui/WorkoutHistoryList';
import { loadStats } from '../data/userStats';
import { workoutRows, lastWeek } from '../data/fitCard';
import { cardRunById } from '../data/fitCardStore';
import { mmss } from '../data/challengeTotals';

// YOUR WORKOUTS (switch fitCard): every finished workout of every mode, newest
// first, from the stats the app already banks (data/fitCard workoutRows). A
// row from a card run that is still kept (data/fitCardStore recent) goes back
// on the Quick Mission card to repeat; any other row is a record only.
// Opened from the Quick Mission page and from Progress (both as a view of
// their own screen, so the tab bar and back work as on any page).
export function useWorkoutRows() {
  const [rows] = useState(() => workoutRows(loadStats().sessions).map((r) => ({ ...r, canOpen: !!(r.cardId && cardRunById(r.cardId)) })));
  return rows;
}

export function WorkoutsRow({ n, onClick, guide }) {
  return (
    <button type="button" data-guide={guide} className="fk-row" onClick={onClick} style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px', width: '100%', boxSizing: 'border-box',
      borderRadius: 14, background: '#0F0B1E', border: '1px solid rgba(157,108,255,0.4)', color: '#fff', textAlign: 'left', cursor: 'pointer',
    }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: 'rgba(157,108,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <History size={18} color={VIOLET_TEXT}/>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em' }}>YOUR WORKOUTS</span>
        <span style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>Every mode, newest first.</span>
      </span>
      <CountPill n={n}/>
    </button>
  );
}

export default function WorkoutsPage({ rows, onBack, onOpen, now = Date.now() }) {
  const week = lastWeek(rows, now);
  const tiles = [[String(week.count), 'LAST 7 DAYS'], [week.xp.toLocaleString('en-US'), 'XP'], [week.seconds ? mmss(week.seconds) : '0:00', 'TIME']];
  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <SetupPage scroll>
        <SetupHeader title="YOUR WORKOUTS" onBack={onBack}/>
        <div data-fc="workouts" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 16px 16px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {tiles.map(([v, l]) => (
              <div key={l} style={{ flex: 1, minWidth: 0, borderRadius: 12, background: 'rgba(7,6,12,0.72)', border: '1px solid rgba(242,190,69,0.3)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ font: `700 20px ${HEAD}`, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.14em', color: MUTED }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
            Newest first, every mode. A card workout with an arrow goes back on the card.
          </div>
          <WorkoutHistoryList rows={rows} onOpen={onOpen} empty="Your finished workouts land here."/>
        </div>
      </SetupPage>
    </PhoneFrame>
  );
}
