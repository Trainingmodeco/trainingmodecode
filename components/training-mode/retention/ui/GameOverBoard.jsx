import ScoreBoard, { formatScore } from './ScoreBoard';
import { ARC, RETENTION_CSS } from './tokens';

// The game-over score board, full screen (option A: straight after FINISH,
// CONTINUE to the end screen). Props only, sample data in the looks:
//
//   board: { mode, setting, beta?, kind, unit, unitLong, rows, you, hero }
//     mode / setting: the board's key, said in two short lines
//       ("FIGHT FOCUS · BOXING", "3 × 3 MIN · 60 S REST · NORMAL")
//     beta: a BETA mark after the mode, while a board's scores are not yet
//       proven fair (phone-counted strikes, typed SOLO and Max Out scores)
//     hero: { value, newBest?, was?, best?, line? } this session's score;
//       `was` the old best under a NEW BEST, `best` the best that stands
//       when this session did not beat it
//   onContinue / continueLabel: the one way on (the end screen)

const goldText = {
  background: ARC.goldGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text',
  WebkitTextFillColor: 'transparent', color: 'transparent',
};

export function BoardHeader({ mode, setting, beta = false, eyebrow = '◈ GAME OVER ◈' }) {
  return (
    <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ font: "700 8px 'Press Start 2P',monospace", color: '#c9a6ff', letterSpacing: '0.16em', lineHeight: 1.4 }}>{eyebrow}</div>
      <h1 className="rt-anim" style={{ margin: '2px 0 2px', font: `900 26px ${ARC.head}`, letterSpacing: '0.08em', lineHeight: 1.1, ...goldText, animation: 'rt-slam .6s both' }}>HIGH SCORES</h1>
      {mode && (
        <div style={{ font: `800 10px ${ARC.head}`, letterSpacing: '0.12em', color: '#f5e9ff', lineHeight: 1.3 }}>
          {mode}
          {beta && <>{' '}<span data-sb-beta style={{
            display: 'inline-block', marginLeft: 2, verticalAlign: '1px', padding: '2px 6px 1px', borderRadius: 99,
            border: '1px solid rgba(253,224,71,0.5)', color: ARC.gold, font: `800 7.5px ${ARC.head}`, letterSpacing: '0.1em', lineHeight: 1.2,
          }}>BETA</span></>}
        </div>
      )}
      {setting && <div style={{ font: `700 9px ${ARC.head}`, letterSpacing: '0.12em', color: '#a9a3c4', lineHeight: 1.3 }}>{setting}</div>}
    </header>
  );
}

function YourScore({ hero, kind, unitLong }) {
  if (!hero) return null;
  return (
    <div data-sb-hero style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(253,224,71,0.12), rgba(8,2,18,0.85))', border: '1px solid rgba(253,224,71,0.45)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 8px ${ARC.head}`, color: '#b06aff', letterSpacing: '0.16em' }}>YOUR SCORE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 8px', marginTop: 2 }}>
          <span style={{ font: `900 26px ${ARC.head}`, color: ARC.gold, letterSpacing: '0.02em', lineHeight: 1.1, textShadow: '0 0 14px rgba(253,224,71,0.4)', fontVariantNumeric: 'tabular-nums' }}>{formatScore(kind, hero.value)}</span>
          <span style={{ font: `800 10px ${ARC.head}`, color: '#f5e9ff', letterSpacing: '0.1em' }}>{unitLong}</span>
        </div>
        {hero.line && <div style={{ font: `600 12px ${ARC.body}`, color: '#cbc6e0', letterSpacing: '0.04em', marginTop: 2, lineHeight: 1.3 }}>{hero.line}</div>}
      </div>
      {hero.newBest ? (
        <div className="rt-anim" style={{ flexShrink: 0, textAlign: 'center', animation: 'rt-slam .55s .35s both' }}>
          <div style={{
            font: `900 11px ${ARC.head}`, letterSpacing: '0.08em', color: '#0a0014', lineHeight: 1.15, padding: '6px 9px', borderRadius: 8,
            background: 'linear-gradient(135deg,#fde047,#f59e0b)', boxShadow: '0 0 18px rgba(253,224,71,0.45)',
          }}>NEW<br/>BEST</div>
          {hero.was != null && <div style={{ font: `700 9px ${ARC.head}`, color: '#a9a3c4', letterSpacing: '0.06em', marginTop: 4, whiteSpace: 'nowrap' }}>WAS {formatScore(kind, hero.was)}</div>}
        </div>
      ) : hero.best != null ? (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ font: `700 8px ${ARC.head}`, color: '#a9a3c4', letterSpacing: '0.14em' }}>YOUR BEST</div>
          <div style={{ font: `900 15px ${ARC.head}`, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatScore(kind, hero.best)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function GameOverBoard({ board, onContinue, continueLabel = 'CONTINUE' }) {
  if (!board) return null;
  return (
    <div data-retention="game-over" style={{ position: 'relative', zIndex: 10, padding: '22px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <BoardHeader mode={board.mode} setting={board.setting} beta={!!board.beta}/>
      <YourScore hero={board.hero} kind={board.kind} unitLong={board.unitLong || board.unit}/>
      <ScoreBoard rows={board.rows} kind={board.kind} unit={board.unit} you={board.you}/>
      <button type="button" className="rt-go" onClick={onContinue} style={{
        width: '100%', height: 48, border: 'none', borderRadius: 12, cursor: 'pointer', background: 'linear-gradient(135deg,#fde047,#f59e0b)',
        color: '#0a0014', font: `900 14px ${ARC.head}`, letterSpacing: '0.1em', boxShadow: '0 0 20px rgba(253,224,71,0.35)',
      }}>{continueLabel}</button>
    </div>
  );
}
