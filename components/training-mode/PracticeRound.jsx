import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { playBell, unlockAudio } from './data/audioEngine';
import { primeSpeech, setVoiceGender, speakAsync, cancelSpeech, stopVoiceSession } from './voiceCoach';
import { buildRound, PLANS, REST_SEC, mmss, planLine, planMinutes, spokenCall } from './data/practiceRound';

// Practice Round (Simplify revamp, PracticeRound.dc.html) — opened from a
// lesson or technique. A setup view explains the round, then a live view
// calls moves on a timer: big gold call, the next one under it, and a
// coaching cue from the lesson's own key points. The coach says each call
// out loud, so it works with the phone down.
//
// It reports back through onFinish only when every round is done; ending
// early banks nothing.

const V = '#B794FF', GOLD = '#F2BE45', MUTED = '#A9A3C4';
const CSS = `
@keyframes pr-call-in { from { opacity: 0; transform: scale(1.25) } to { opacity: 1; transform: none } }
.pr-hit { transition: border-color .18s ease, color .18s ease, filter .18s ease; }
.pr-hit:hover, .pr-hit:focus-visible { border-color: ${GOLD} !important; }
.pr-back:hover, .pr-back:focus-visible { color: ${GOLD} !important; }
.pr-gold:hover, .pr-gold:focus-visible { filter: brightness(1.1); }
@media (prefers-reduced-motion: reduce) { .pr-call { animation: none !important } }
`;
const label = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: MUTED };
const goldBtn = {
  height: 58, flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 0, cursor: 'pointer',
  clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
  background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
  font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', boxShadow: '0 0 28px rgba(242,190,69,.35)',
};
const Play = ({ size = 17 }) => <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, fill: 'currentColor' }}><path d="M7 4l13 8-13 8z"/></svg>;

// Key points worth repeating mid-round: skip the set-up and rep-count lines.
const cuesFrom = (points = []) => {
  const c = points.filter(p => !/^(start in|practice \d|practice )/i.test(p));
  return c.length ? c : ['Return to guard after every shot'];
};

export default function PracticeRound({ discipline, focus, prior, learned, profile, onClose, onFinish, onNext }) {
  const round = useMemo(() => buildRound({ focus, prior, learned }), [focus, prior, learned]);
  const { plan, tier, xp } = round;
  const cues = useMemo(() => cuesFrom(focus.keyPoints), [focus]);

  const [view, setView] = useState('setup');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, whole session incl. rests
  // [on screen, next up]. Nothing is on screen until the first call lands.
  const [calls, setCalls] = useState(() => [null, round.pick()]);
  const [callKey, setCallKey] = useState(0);
  const clock = useRef({ base: 0, since: 0 });
  const lastPhase = useRef(null);
  const nextCallAt = useRef(0);
  const finished = useRef(false);

  const workTotal = plan.rounds * plan.lenSec + (plan.rounds - 1) * REST_SEC;
  // Where the clock is: which round, working or resting, time left in it.
  const phase = useMemo(() => {
    const cycle = plan.lenSec + REST_SEC;
    const idx = Math.min(plan.rounds - 1, Math.floor(elapsed / cycle));
    const into = elapsed - idx * cycle;
    const resting = into >= plan.lenSec && idx < plan.rounds - 1;
    return {
      round: idx + 1, resting,
      left: Math.max(0, Math.ceil(resting ? cycle - into : plan.lenSec - into)),
      frac: resting ? 0 : Math.min(1, into / plan.lenSec),
    };
  }, [elapsed, plan]);

  // Each call cuts off the last: a late word is worse than a dropped one.
  const say = useCallback((text) => {
    speakAsync(text, { rate: 1.05, preempt: true }).catch(() => {});
  }, []);

  const advanceCall = useCallback(() => {
    setCalls(([cur, nxt]) => {
      const now = nxt || round.pick(cur);
      say(spokenCall(now));
      return [now, round.pick(now)];
    });
    setCallKey(k => k + 1);
  }, [round, say]);

  // The clock: real elapsed time, so a slow tab never stretches a round.
  useEffect(() => {
    if (view !== 'live' || paused) return undefined;
    clock.current.since = performance.now();
    const id = setInterval(() => {
      const secs = clock.current.base + (performance.now() - clock.current.since) / 1000;
      setElapsed(Math.min(workTotal, secs));
    }, 200);
    return () => {
      clearInterval(id);
      clock.current.base += (performance.now() - clock.current.since) / 1000;
    };
  }, [view, paused, workTotal]);

  // Bells at each edge, calls on the beat while working.
  useEffect(() => {
    if (view !== 'live') return;
    if (elapsed >= workTotal) {
      if (!finished.current) {
        finished.current = true;
        playBell(3);
        say('Time. Round complete.');
        setView('done');
        onFinish?.({ xp, rounds: plan.rounds });
      }
      return;
    }
    const key = `${phase.round}-${phase.resting}`;
    if (lastPhase.current !== key) {
      const first = lastPhase.current === null;
      lastPhase.current = key;
      if (phase.resting) {
        playBell(2);
        say(`Rest. Round ${phase.round + 1} next.`);
      } else {
        if (!first) playBell(1);
        nextCallAt.current = elapsed + 1.2;
      }
      return;
    }
    if (!phase.resting && elapsed >= nextCallAt.current) {
      nextCallAt.current = elapsed + round.callMs / 1000;
      advanceCall();
    }
  }, [elapsed, view, phase, workTotal, round, advanceCall, say, xp, plan, onFinish]);

  useEffect(() => () => stopVoiceSession(), []);

  const start = async () => {
    unlockAudio();
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    try { await primeSpeech(); } catch { /* speech optional */ }
    clock.current = { base: 0, since: performance.now() };
    lastPhase.current = null;
    finished.current = false;
    setElapsed(0);
    setPaused(false);
    setView('live');
    playBell(1);
  };

  const end = () => { stopVoiceSession(); onClose(); };
  const cue = cues[Math.floor(elapsed / 20) % cues.length];
  const sub = `${discipline} · Focus: ${focus.name}`;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 220, overflow: 'hidden',
      background: 'radial-gradient(110% 50% at 50% 0%, #1B0F3A 0%, #07060C 62%)', color: '#fff',
      fontFamily: "Barlow, system-ui, sans-serif", display: 'flex', flexDirection: 'column', gap: 12,
      boxSizing: 'border-box', padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
        <button type="button" className="pr-back" aria-label="Back to Practice Mode" onClick={end} style={{
          width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
        }}><ChevronLeft size={22}/></button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ font: "700 20px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1 }}>PRACTICE ROUND</div>
          <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        </div>
        <span style={{
          font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', padding: '5px 8px', borderRadius: 6,
          border: '1px solid rgba(242,190,69,.55)', color: GOLD, whiteSpace: 'nowrap', flexShrink: 0,
        }}>+{xp} XP</span>
      </header>

      {view === 'setup' && (
        <div data-guide="pr-setup" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, background: '#0F0B1F', border: '1px solid rgba(168,85,247,.45)', boxShadow: '0 0 20px rgba(168,85,247,.18)', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1 }}>
              <span style={{ ...label, color: '#C4A8FF' }}>{plan.name}</span>
              <span style={{ font: "900 22px 'Orbitron',sans-serif", letterSpacing: '0.02em' }}>{planLine(plan)}</span>
              <span style={{ fontSize: 13, color: MUTED }}>{plan.rounds > 1 ? `${REST_SEC}s rest · ` : ''}built from what you&apos;ve learned</span>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: '50%', border: `2px solid ${GOLD}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(242,190,69,.4)', flexShrink: 0 }}>
              <span style={{ font: "900 18px 'Orbitron',sans-serif", color: GOLD }}>{planMinutes(plan)}</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: MUTED }}>MIN</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <span style={label}>WHAT YOU&apos;LL DRILL</span>
            {round.groups.map(g => (
              <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: "700 13px 'Chakra Petch',sans-serif" }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                  <span style={{ color: g.color, flexShrink: 0 }}>{g.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${g.pct}%`, height: '100%', background: g.color, boxShadow: `0 0 8px ${g.color}` }}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <span style={label}>SAMPLE CALLS</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {round.sample.map(c => (
                <span key={c} style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 6, background: '#151029', border: '1px solid rgba(168,85,247,.35)', font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.06em' }}>{c}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, background: '#0B0916', border: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
            <span style={label}>ROUNDS GROW AS YOU LEARN</span>
            {PLANS.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i <= tier ? 1 : 0.5 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                  background: i < tier ? GOLD : i === tier ? '#1A1204' : 'transparent',
                  border: `1.5px solid ${i <= tier ? GOLD : 'rgba(255,255,255,.25)'}`,
                  boxShadow: i === tier ? '0 0 10px rgba(242,190,69,.7)' : 'none',
                }}/>
                <span style={{ flexGrow: 1, minWidth: 0, fontSize: 12, color: '#CFC9E4' }}>{p.when}</span>
                <span style={{ flexShrink: 0, whiteSpace: 'nowrap', font: "700 12px 'Chakra Petch',sans-serif", color: i === tier ? GOLD : '#CFC9E4' }}>{planLine(p)}</span>
              </div>
            ))}
          </div>

          <div style={{ flexGrow: 1 }}/>
          <button type="button" className="pr-gold" data-guide="pr-start" onClick={start} style={goldBtn}><Play/>START ROUND 1</button>
        </div>
      )}

      {view === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: plan.rounds }, (_, i) => (
              <span key={i} style={{ width: 36, height: 5, borderRadius: 3, background: i < phase.round - 1 ? GOLD : i === phase.round - 1 ? V : 'rgba(255,255,255,.12)' }}/>
            ))}
          </div>
          <span style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', color: '#C4A8FF' }}>
            {phase.resting ? `REST · ROUND ${phase.round + 1} NEXT` : `ROUND ${phase.round} OF ${plan.rounds}`}
          </span>
          <div style={{ position: 'relative', width: 250, height: 250, flexShrink: 0 }}>
            <svg viewBox="0 0 250 250" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="125" cy="125" r="112" fill="none" stroke="rgba(168,85,247,.16)" strokeWidth="12"/>
              <circle cx="125" cy="125" r="112" fill="none" stroke={phase.resting ? '#6E9BFF' : '#B794FF'} strokeWidth="12" strokeLinecap="round"
                strokeDasharray="703.7" strokeDashoffset={703.7 * phase.frac}
                style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,.9))', transition: 'stroke-dashoffset .2s linear' }}/>
              <circle cx="125" cy="125" r="94" fill="none" stroke="rgba(242,190,69,.45)" strokeWidth="1.5" strokeDasharray="3 7"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {phase.resting ? (
                <span style={{ font: "900 24px 'Orbitron',sans-serif", color: '#8FB4FF', letterSpacing: '0.1em' }}>REST</span>
              ) : (
                <span key={callKey} className="pr-call" aria-live="polite" style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: (calls[0] || '').length > 12 ? 17 : 24, color: GOLD,
                  letterSpacing: '0.04em', textAlign: 'center', maxWidth: 200, lineHeight: 1.1,
                  textShadow: '0 0 14px rgba(242,190,69,.55)', animation: 'pr-call-in .35s ease-out both',
                }}>{calls[0] || 'READY'}</span>
              )}
              <span style={{ font: "900 30px 'Orbitron',sans-serif" }}>{mmss(phase.left)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, visibility: phase.resting ? 'hidden' : 'visible' }}>
            NEXT <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: '#fff', letterSpacing: '0.06em' }}>{calls[1]}</span>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#0F0B1F', border: '1px solid rgba(168,85,247,.3)', fontSize: 13, color: '#CFC9E4', textAlign: 'center', maxWidth: 300 }}>
            Cue: <span style={{ color: GOLD, fontWeight: 600 }}>{cue}</span>
          </div>
          <div style={{ flexGrow: 1 }}/>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button type="button" className="pr-hit" onClick={() => { if (!paused) cancelSpeech(); setPaused(p => !p); }} style={{
              flex: 1, height: 54, borderRadius: 12, background: '#151029', border: '1px solid rgba(168,85,247,.5)', color: '#fff',
              font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', cursor: 'pointer',
            }}>{paused ? 'RESUME' : 'PAUSE'}</button>
            <button type="button" className="pr-hit" onClick={end} style={{
              flex: 1, height: 54, borderRadius: 12, background: 'transparent', border: '1px solid rgba(239,68,68,.5)', color: '#F87171',
              font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', cursor: 'pointer',
            }}>END</button>
          </div>
        </div>
      )}

      {view === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1, minHeight: 0, textAlign: 'center' }}>
          <div style={{ flexGrow: 1 }}/>
          <span style={{ ...label, color: '#C4A8FF' }}>{plan.name}</span>
          <div style={{ font: "900 26px 'Orbitron',sans-serif", lineHeight: 1.15 }}>ROUND COMPLETE</div>
          <div style={{ fontSize: 15, color: '#CFC9E4', maxWidth: 300 }}>
            {planLine(plan)} of {focus.name} drilled. Every round you finish makes the next one bigger.
          </div>
          <div style={{ font: "900 32px 'Orbitron',sans-serif", color: GOLD, textShadow: '0 0 18px rgba(242,190,69,.5)' }}>+{xp} XP</div>
          <div style={{ flexGrow: 1 }}/>
          {onNext && (
            <button type="button" className="pr-gold" onClick={onNext} style={goldBtn}><Play/>NEXT LESSON</button>
          )}
          <button type="button" className="pr-hit" onClick={onClose} style={{
            width: '100%', height: 50, borderRadius: 12, background: 'transparent', border: '1px solid rgba(168,85,247,.5)', color: '#fff',
            font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', cursor: 'pointer',
          }}>BACK TO PRACTICE</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
