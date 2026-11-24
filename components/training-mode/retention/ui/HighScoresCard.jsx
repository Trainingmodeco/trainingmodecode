import ScoreBoard from './ScoreBoard';
import { ARC } from './tokens';

// The end screen's HIGH SCORES card (option B: the board is not shown on its
// own after FINISH; the end screen carries this and VIEW BOARD opens it).
// Props only: the top 3, your row (your place, NEW BEST when it is one) and
// VIEW BOARD. Your row says your place, so there is no line repeating it.
//
//   board:  { setting, kind, unit, rows, you, note? } (the same object the full
//           board takes); `note`: one quiet line under the rows (a session that
//           did not beat the best on the board: "Today: 899. Your best (939) stays on the board.")
//   onView: VIEW BOARD
export default function HighScoresCard({ board, onView }) {
  if (!board) return null;
  const top = board.rows.slice(0, 3);
  const mine = board.rows.find((r) => r.you);
  const rows = mine && mine.place > 3 ? [...top, mine] : top;
  return (
    <div data-retention="high-scores-card" style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 11, padding: '9px 10px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '0 2px' }}>
        <span style={{ font: `700 8px ${ARC.head}`, color: ARC.gold, letterSpacing: '0.16em' }}>HIGH SCORES</span>
        {board.setting && <span style={{ font: `700 8px ${ARC.head}`, color: '#a9a3c4', letterSpacing: '0.1em' }}>{board.setting}</span>}
      </div>
      <div style={{ height: 8 }}/>
      <ScoreBoard bare rows={rows} kind={board.kind} unit={board.unit} you={mine ? null : board.you} legend={false}/>
      {board.note && <div data-sb-note style={{ padding: '6px 4px 0', textAlign: 'center', font: `600 12px ${ARC.body}`, color: '#cbc6e0', lineHeight: 1.35 }}>{board.note}</div>}
      <button type="button" className="rt-go" onClick={onView} style={{
        width: '100%', height: 40, marginTop: 8, border: '1px solid rgba(176,106,255,0.45)', borderRadius: 11, cursor: 'pointer',
        background: 'rgba(176,106,255,0.1)', color: '#c9a6ff', font: `800 12px ${ARC.head}`, letterSpacing: '0.08em',
      }}>VIEW BOARD</button>
    </div>
  );
}
