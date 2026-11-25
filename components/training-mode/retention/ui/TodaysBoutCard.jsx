import { Play, Check, RotateCcw } from 'lucide-react';
import SafeImage from '../../SafeImage';
import { HOME, head, GOLD_BUTTON, RETENTION_CSS } from './tokens';

// TODAY'S BOUT (retention feature 1, switch `weeks`): Home's one card at the
// top, the daily mission folded in. The same art, mode tag and title as
// Home's top card, plus the day's bonus beside START, the bout's length and a
// true personal line where the pick knows them, and a done state once the
// bonus is paid (START becomes TRAIN AGAIN: it runs the bout again, with no
// second bonus). The bout comes from data/dailyMission (pickTodaysBout).
//   side   SIDES.fit | SIDES.fight (tokens)
//   parts  the line under the title, joined with " · "
//   meta   the small line (boutMeta): "12 MIN · FITS YOUR LEVEL"
//   ghost  the live ghost challenge's 👻 button, beside the title
export default function TodaysBoutCard({
  side, title, parts = [], meta = [], cta = 'START', bonusXp = 25, done = false, onGo, label, ghost = null, retention = 'todays-bout', style,
}) {
  const accent = done ? HOME.green : HOME.gold;
  return (
    <section data-guide="home-continue" data-retention={retention} className="rt-anim" style={{
      position: 'relative', minHeight: 'var(--hm-card-min, 176px)', flexShrink: 0, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      border: `1px solid ${done ? 'rgba(143,232,172,0.32)' : 'rgba(255,255,255,0.08)'}`, background: '#0D0A18', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <SafeImage src={side.art} alt="" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'auto', maxWidth: 'none', opacity: done ? 0.4 : 0.55, filter: side.filter }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.72) 58%, rgba(7,6,12,0.25) 100%)' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: done ? HOME.green : side.accent }}/>
      <div style={{ position: 'relative', flex: 1, boxSizing: 'border-box', padding: 'var(--hm-card-pt, 16px) 18px var(--hm-card-pb, 18px)', display: 'flex', flexDirection: 'column', gap: 'var(--hm-card-gap, 6px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {done ? <Check size={13} color={accent} strokeWidth={3}/> : <Play size={12} color={accent} fill={accent} strokeWidth={0}/>}
          <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, whiteSpace: 'nowrap' }}>Today&apos;s bout</span>
          <span style={{ marginLeft: 'auto', font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: side.accentText, whiteSpace: 'nowrap' }}>{side.label}</span>
        </div>
        {/* Short titles at 28px; longer picks drop a size and wrap rather than lose words. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h1 style={{
            flex: '0 1 auto', minWidth: 0,
            margin: '2px 0 0', fontWeight: 700, fontSize: title.length > 18 ? 'min(22px, var(--hm-title, 28px))' : 'var(--hm-title, 28px)', fontFamily: "'Chakra Petch',sans-serif", lineHeight: 1.08, color: '#fff',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'balance',
          }}>{title}</h1>
          {ghost}
        </div>
        {done ? (
          <div data-retention="bout-done" style={{ fontSize: 14, lineHeight: 1.3, color: HOME.green, fontWeight: 600 }}>
            +{bonusXp} XP earned. A new bout tomorrow.
          </div>
        ) : (
          <>
            {parts.length > 0 && (
              // Balanced, so a second line is never one word on its own.
              <div style={{ fontSize: 14, lineHeight: 1.3, color: HOME.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'balance' }}>{parts.join(' · ')}</div>
            )}
            {meta.length > 0 && (
              <div data-retention="bout-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0', font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: HOME.gold }}>
                {meta.map((m, i) => (
                  <span key={m} style={{ whiteSpace: 'nowrap' }}>{i > 0 && <span aria-hidden style={{ margin: '0 6px', color: HOME.muted }}>·</span>}{m}</span>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ flexGrow: 1, minHeight: 2 }}/>
        {done ? (
          <button type="button" className="rt-go" onClick={onGo} aria-label={label ? `${label}. Train again` : undefined} style={{
            height: 'min(46px, var(--hm-go-h, 52px))', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(242,190,69,0.08)', border: '1px solid rgba(242,190,69,0.5)', color: HOME.gold,
            font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.18em',
          }}><RotateCcw size={14} strokeWidth={2.5}/>TRAIN AGAIN</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* hm-go: Home's own hover glow for its gold button (homeCSS). */}
            <button type="button" className="hm-go rt-go" onClick={onGo} aria-label={label} style={{
              flex: 1, minWidth: 0, height: 'var(--hm-go-h, 52px)', borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: GOLD_BUTTON, color: '#1A1204', whiteSpace: 'nowrap',
              font: `700 ${cta.length > 9 ? 15 : 17}px 'Chakra Petch',sans-serif`, letterSpacing: cta.length > 9 ? '0.14em' : '0.2em', boxShadow: '0 0 24px rgba(242,190,69,0.3)',
            }}><Play size={16} fill="currentColor" strokeWidth={0}/>{cta}</button>
            <span data-retention="bout-bonus" style={{ ...head(14), color: HOME.gold, whiteSpace: 'nowrap', flexShrink: 0 }}>+{bonusXp} XP</span>
          </div>
        )}
      </div>
    </section>
  );
}
