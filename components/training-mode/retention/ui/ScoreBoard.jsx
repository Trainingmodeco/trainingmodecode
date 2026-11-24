import { Fragment } from 'react';
import { VISIBLE_TIERS, tierIndexForLevel } from '../../data/tiers';
import { ARC, RETENTION_CSS } from './tokens';
import { ORD, formatScore } from '../scoreFormat';

export { ORD, formatScore };

// The game-over score board (RETENTION-PLAN.md, the owner-only batch): one mode
// at one setting, ten places, like an arcade HIGH SCORES list. A pure display
// component: it draws the rows it is handed and works nothing out. Which rows,
// in which order, with which CPU house scores, is the board's rule
// (retention/scoreBoards.js composeBoard for the looks; the server later).
//
//   rows:  [{ place, name, level, value, cpu?, you?, newBest?, cc? }] in order,
//          at most 10. `place` 1..10 counts every row on the board, CPU too
//          (the PLACE column, arcade style); a player's rank among players
//          only is said on YOUR SCORE (scoreBoards.js placeLine), never here.
//   kind:  'count' (1,284) · 'time' (14:52, lower is better) · 'roundsReps'
//          (7 + 12: value = rounds × 1000 + reps)
//   unit:  the column's name (STRIKES, TIME, TOTAL REPS). Said once, at the
//          top of the score column, so a row stays one line on a 360 phone.
//   you:   { place, of, level, value, newBest?, next?, ofLine? } when the
//          athlete is not in `rows`: pinned under the list with the world rank
//          ("#143 of 2,310") and what the next place needs (`next`). `ofLine`
//          says the rank in place of "of N players" while CPU rows sit above
//          (a new board: "3RD OF 4 PLAYERS", so a place is never read as a rank).
//   legend: false hides the CPU line under the list (the end-screen card).
//   bare:   no box of its own (inside a card that has one).
// Rows whose places are not next to each other get a ··· between them.
//
// A real player shows their display name as they typed it, a two-letter
// country only if they chose to show it, and their level in its tier colour.
// A CPU house row is quieter: an equipment name in capitals, a CPU tag, no
// country. The athlete's own row reads YOU, gold, with NEW BEST when it is.

// The app's level, in its tier's colour (data/tiers: three levels a tier).
export function levelTier(level) {
  return VISIBLE_TIERS[tierIndexForLevel(level)] || VISIBLE_TIERS[0];
}

const PLACE_COLOR = { 1: '#fde047', 2: '#d9d9e6', 3: '#e0a066' };

// A board narrower than a 360 phone's (a 320 phone, the end-screen card in
// the gallery's frame): tighter columns and the level as a bare number, so a
// row still holds the longest house name and its CPU tag on one line.
const SB_CSS = `
.sb-root { container-type: inline-size; }
.sb-narrow { display: none; }
@container (max-width: 300px) {
  .sb-row { gap: 5px !important; padding: 0 6px !important; }
  .sb-head { gap: 5px !important; padding: 0 6px 6px !important; }
  .sb-rank { width: 33px !important; min-width: 33px !important; }
  .sb-head .sb-rank { letter-spacing: 0 !important; }
  .sb-lv { width: 24px !important; }
  .sb-score { width: 58px !important; }
  .sb-wide { display: none !important; }
  .sb-narrow { display: inline !important; }
}`;

function Tag({ children, tone = 'cpu' }) {
  const t = {
    cpu: { color: '#a9a3c4', border: '1px solid rgba(169,163,196,0.45)', background: 'rgba(169,163,196,0.08)' },
    cc: { color: '#cbc6e0', border: '1px solid rgba(203,198,224,0.3)', background: 'transparent' },
    best: { color: '#0a0014', border: '1px solid #fde047', background: 'linear-gradient(135deg,#fde047,#f59e0b)' },
  }[tone];
  return (
    <span style={{
      ...t, flexShrink: 0, font: `800 8px ${ARC.head}`, letterSpacing: '0.08em', lineHeight: 1,
      padding: '3px 4px 2px', borderRadius: 4, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// Places left out between two rows (the end-screen card's top 3 and YOU, or
// the pinned world rank under the ten).
function Gap() {
  return <div aria-hidden style={{ textAlign: 'center', color: '#6f6790', font: `900 10px ${ARC.head}`, letterSpacing: '0.4em', lineHeight: 1, padding: '3px 0 4px' }}>···</div>;
}

function Row({ r, kind, i, pinnedPlace }) {
  const tier = levelTier(r.level);
  const place = pinnedPlace || ORD(r.place);
  const you = !!r.you, cpu = !!r.cpu;
  const placeColor = you ? ARC.gold : cpu ? 'rgba(169,163,196,0.75)' : PLACE_COLOR[r.place] || '#cbc6e0';
  return (
    <div
      role="row" data-sb-row={cpu ? 'cpu' : you ? 'you' : 'player'}
      aria-label={`${place}: ${you ? 'you' : r.name}${cpu ? ' (CPU house score)' : ''}, level ${r.level}, ${formatScore(kind, r.value)}`}
      className="rt-anim sb-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px', borderRadius: 8, boxSizing: 'border-box',
        background: you ? 'rgba(253,224,71,0.13)' : cpu ? 'transparent' : 'rgba(255,255,255,0.035)',
        border: you ? '1.5px solid rgba(253,224,71,0.85)' : '1px solid transparent',
        boxShadow: you ? '0 0 16px rgba(253,224,71,0.22)' : 'none',
        animation: `rt-rise .35s ${0.08 + i * 0.045}s both`,
      }}
    >
      <span className={pinnedPlace ? undefined : 'sb-rank'} style={{ width: pinnedPlace ? 'auto' : 36, minWidth: 36, flexShrink: 0, font: `900 11px ${ARC.head}`, letterSpacing: '0.02em', color: placeColor, fontVariantNumeric: 'tabular-nums' }}>{place}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          whiteSpace: 'nowrap', lineHeight: 1,
          font: cpu ? `700 10.5px ${ARC.head}` : you ? `900 13px ${ARC.head}` : `700 15px ${ARC.body}`,
          letterSpacing: cpu ? '0.06em' : you ? '0.08em' : '0.01em',
          color: you ? ARC.gold : cpu ? '#9d96ba' : '#f5e9ff',
        }}>{you ? 'YOU' : r.name}</span>
        {cpu && <Tag>CPU</Tag>}
        {!cpu && !you && r.cc && <Tag tone="cc">{r.cc}</Tag>}
        {you && r.newBest && <Tag tone="best">NEW BEST</Tag>}
      </span>
      <span className="sb-lv" title={tier.label} style={{ width: 42, flexShrink: 0, font: `800 10px ${ARC.head}`, letterSpacing: '0.02em', color: tier.color, opacity: cpu ? 0.6 : 1, whiteSpace: 'nowrap' }}><span className="sb-wide">LV </span>{r.level}</span>
      <span className="sb-score" style={{
        width: 66, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        font: `900 13px ${ARC.head}`, letterSpacing: '0.01em', color: you ? ARC.gold : cpu ? '#9d96ba' : '#fff',
      }}>{formatScore(kind, r.value)}</span>
    </div>
  );
}

export default function ScoreBoard({ rows = [], kind = 'count', unit = 'SCORE', you = null, legend = true, bare = false, style }) {
  const hasCpu = rows.some((r) => r.cpu);
  const head = { font: `700 8px ${ARC.head}`, letterSpacing: '0.14em', color: '#9a90b8' };
  return (
    <div data-retention="score-board" className="sb-root" role="table" aria-label={`High scores, ${unit.toLowerCase()}`} style={bare ? style : {
      background: 'rgba(8,2,18,0.9)', border: '1px solid rgba(176,106,255,0.32)', borderRadius: 12, padding: '8px 6px 8px', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS + SB_CSS }}/>
      <div role="row" className="sb-head" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 6px' }}>
        <span className="sb-rank" style={{ ...head, width: 36, flexShrink: 0, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PLACE</span>
        <span style={{ ...head, flex: 1 }}>NAME</span>
        <span className="sb-lv" style={{ ...head, width: 42, flexShrink: 0 }}><span className="sb-wide">LEVEL</span><span className="sb-narrow">LV</span></span>
        <span className="sb-score" style={{ ...head, width: 66, flexShrink: 0, textAlign: 'right', color: ARC.gold, whiteSpace: 'nowrap' }}>{unit}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r, i) => (
          <Fragment key={`${r.place}-${r.name}`}>
            {i > 0 && r.place > rows[i - 1].place + 1 && <Gap/>}
            <Row r={r} kind={kind} i={i}/>
          </Fragment>
        ))}
      </div>
      {you && (
        <div data-sb-pinned style={{ marginTop: 2 }}>
          <Gap/>
          <Row r={{ ...you, you: true }} kind={kind} i={rows.length} pinnedPlace={`#${you.place.toLocaleString('en-US')}`}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '5px 8px 0', font: `600 12px ${ARC.body}`, color: '#cbc6e0', lineHeight: 1.3 }}>
            <span>{you.ofLine || `of ${you.of.toLocaleString('en-US')} players`}</span>
            {you.next && <span style={{ color: ARC.gold }}>{you.next}</span>}
          </div>
        </div>
      )}
      {legend && hasCpu && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 0', font: `600 12px ${ARC.body}`, color: '#a9a3c4', lineHeight: 1.3 }}>
          <Tag>CPU</Tag><span>A house score, not a player. Players push them off.</span>
        </div>
      )}
    </div>
  );
}
