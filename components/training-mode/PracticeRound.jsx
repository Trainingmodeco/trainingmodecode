import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { playBell, unlockAudio } from './data/audioEngine';
import { primeSpeech, setVoiceGender, speakAsync, cancelSpeech, stopVoiceSession } from './voiceCoach';
import useWakeLock from './hooks/useWakeLock';
import useAutoPauseOnHidden from './hooks/useAutoPauseOnHidden';
import { buildRound, PLANS, REST_SEC, mmss, planLine, planSeconds, spokenCall } from './data/practiceRound';
import { planCall, drillSources } from './data/drillClips';
import DrillVideo, { warmClips, clipUrl, failClip, releaseClips } from './PracticeDrillVideo';
import { GOLD, GREEN, GOLD_FILL, PLATE, StepChips, Play } from './PracticeParts';

// The drill of a move (the Practice Round). DRILL IT on the Ladder or on a
// move card opens it, and round 1 starts at once: there is no setup screen.
// The coach calls the moves out loud on a timer, so it works with the phone
// down. On screen: the three steps, the clip of the strike being called
// (PracticeDrillVideo.jsx), the call in large type, the clock.
//
// It reports back through onFinish only when every round is done; ending
// early banks nothing. onFinish answers with what the drill earned, which the
// done view shows: { fresh, gained, xp, bonus, done, total, next }.

const V = '#B794FF', MUTED = '#A9A3C4';
const CSS = `
@keyframes pr-call-in { from { opacity: 0; transform: scale(1.18) } to { opacity: 1; transform: none } }
.pr-hit { transition: border-color .18s ease, color .18s ease, filter .18s ease; }
.pr-hit:hover, .pr-hit:focus-visible { border-color: ${GOLD} !important; }
.pr-back:hover, .pr-back:focus-visible { color: ${GOLD} !important; }
.pr-gold:hover, .pr-gold:focus-visible { filter: brightness(1.1); }
.pr-done { scrollbar-width: thin; scrollbar-color: rgba(183,148,255,.35) transparent; }
/* A short phone keeps the picture and the call; the coaching cue steps aside. */
@media (max-height: 620px) { .pr-cue { display: none !important; } }
@media (prefers-reduced-motion: reduce) { .pr-call { animation: none !important } }
`;
const label = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: MUTED };
const goldBtn = {
  height: 54, flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 0, cursor: 'pointer',
  clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
  background: GOLD_FILL, color: '#1A1204', padding: '0 14px', boxSizing: 'border-box',
  font: "700 15px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', boxShadow: '0 0 28px rgba(242,190,69,.35)',
};
const callStyle = {
  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.1,
  textShadow: '0 0 14px rgba(242,190,69,.55)', animation: 'pr-call-in .3s ease-out both', overflowWrap: 'anywhere',
};
const plainBtn = {
  width: '100%', height: 48, flexShrink: 0, borderRadius: 12, background: 'transparent', border: '1px solid rgba(168,85,247,.5)', color: '#fff',
  font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', cursor: 'pointer',
};

// Key points worth repeating mid-round: skip the set-up and rep-count lines.
const cuesFrom = (points = []) => {
  const c = points.filter(p => !/^(start in|practice \d|practice )/i.test(p));
  return c.length ? c : ['Return to guard after every shot'];
};

// Wakes the sound and the voice. Called inside the tap on DRILL IT, which is
// the gesture a phone asks for before it will play either. Returns a promise
// that settles when the recorded voice is ready to speak.
export function primeDrill(profile) {
  unlockAudio();
  setVoiceGender(profile?.voiceCoach || 'FEMALE');
  return primeSpeech().catch(() => { /* speech optional */ });
}

//   drill   what data/practiceMoves drillFor or groupDrill returned
//   move    the move being drilled, or null for a TEST OUT of a group
//   watch   that move's watch video (practiceMoves watchFor), if any
//   points  its key points, for the cue under the call
//   ready   the promise primeDrill returned in the opening tap
export default function PracticeRound({ discipline, drill, move, watch, points, ready, profile, onClose, onFinish, onNext, onComboCoach }) {
  const round = useMemo(() => buildRound(drill), [drill]);
  const { plan, tier, xp } = round;
  const focus = drill.focus;
  const cues = useMemo(() => cuesFrom(points), [points]);

  // Every video this drill can show, fetched now so a call's picture is
  // instant. A whole watch video is let go again when the drill closes.
  const clipOptions = useMemo(() => ({ discipline, focus, watch, callMs: round.callMs }), [discipline, focus, watch, round]);
  const sources = useMemo(() => drillSources(round.groups.flatMap(g => g.calls), clipOptions), [round, clipOptions]);
  useEffect(() => {
    warmClips(sources);
    return () => { if (watch?.src) releaseClips(sources.filter(src => src === watch.src)); };
  }, [sources, watch]);
  const hasVideo = sources.length > 0;

  const [view, setView] = useState('live');
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, whole session incl. rests
  // What is on screen: the call, its clips (null: text only) and the call
  // after it. Nothing is called until the first call lands.
  const [now, setNow] = useState(() => ({ call: null, plan: null, next: round.pick(), key: 0 }));
  const [result, setResult] = useState(null);
  const calls = useRef({ current: null, next: now.next });
  const clock = useRef({ base: 0, since: 0 });
  const lastPhase = useRef(null);
  const nextCallAt = useRef(0);
  const finished = useRef(false);

  const workTotal = planSeconds(plan);
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

  // The clips of a call, when every one of them is in memory. Otherwise the
  // call is text only: the picture never shows half a combination.
  const planFor = useCallback((call) => {
    const p = planCall(call, clipOptions);
    if (!p) return null;
    const clips = p.clips.map(c => ({ ...c, url: clipUrl(c.src) }));
    return clips.every(c => c.url) ? { ...p, clips } : null;
  }, [clipOptions]);

  // Says the next call and puts it on screen. Returns how long it stays up.
  const advanceCall = useCallback(() => {
    const call = calls.current.next || round.pick(calls.current.current);
    const next = round.pick(call);
    calls.current = { current: call, next };
    const clips = planFor(call);
    say(spokenCall(call));
    setNow(n => ({ call, plan: clips, next, key: n.key + 1 }));
    return clips ? clips.holdMs : round.callMs;
  }, [round, planFor, say]);

  // A clip that would not play: its call goes back to text, now and later.
  const clipFailed = useCallback((src) => {
    failClip(src);
    setNow(n => (n.plan && n.plan.clips.some(c => c.src === src) ? { ...n, plan: null } : n));
  }, []);

  // Round 1 starts as soon as the voice is ready (a moment after the tap).
  useEffect(() => {
    let live = true;
    (ready || primeDrill(profile)).then(() => {
      if (!live) return;
      clock.current = { base: 0, since: performance.now() };
      setStarted(true);
      playBell(1);
    });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock: real elapsed time, so a slow tab never stretches a round.
  const running = view === 'live' && started && !paused;
  useEffect(() => {
    if (!running) return undefined;
    clock.current.since = performance.now();
    const id = setInterval(() => {
      const secs = clock.current.base + (performance.now() - clock.current.since) / 1000;
      setElapsed(Math.min(workTotal, secs));
    }, 200);
    return () => {
      clearInterval(id);
      clock.current.base += (performance.now() - clock.current.since) / 1000;
    };
  }, [running, workTotal]);

  // Bells at each edge, calls on the beat while working.
  useEffect(() => {
    if (view !== 'live' || !started) return;
    if (elapsed >= workTotal) {
      if (!finished.current) {
        finished.current = true;
        playBell(3);
        say('Time. Round complete.');
        setResult(onFinish?.({ xp, rounds: plan.rounds }) || null);
        setView('done');
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
      nextCallAt.current = elapsed + advanceCall() / 1000;
    }
  }, [elapsed, view, started, phase, workTotal, advanceCall, say, xp, plan, onFinish]);

  // A drill runs on a phone that is often propped up, not touched: keep the
  // screen awake while it ticks, and pause (as PAUSE does) if the app is
  // hidden so the coach never talks to a locked phone.
  useWakeLock(running);
  useAutoPauseOnHidden(running, () => setPaused(true));

  useEffect(() => () => stopVoiceSession(), []);

  const end = () => { stopVoiceSession(); onClose(); };
  const cue = cues[Math.floor(elapsed / 20) % cues.length];
  const callText = now.call || 'READY';
  const callSize = callText.length > 20 ? 19 : callText.length > 12 ? 24 : 30;
  const roundLine = phase.resting ? `REST · ROUND ${phase.round + 1} NEXT` : `ROUND ${phase.round} OF ${plan.rounds}`;
  // The call on screen has no clip (or its clip would not load).
  const textOnly = !!now.call && !now.plan && !phase.resting;
  const wasFresh = !!result?.fresh;
  const nextUp = result?.next || null;

  return createPortal(
    <div data-testid="practice-drill" data-view={view} style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 220, overflow: 'hidden',
      background: 'radial-gradient(110% 50% at 50% 0%, #1B0F3A 0%, #07060C 62%)', color: '#fff',
      fontFamily: "Barlow, system-ui, sans-serif", display: 'flex', flexDirection: 'column', gap: 10,
      boxSizing: 'border-box', padding: '12px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
        <button type="button" className="pr-back" aria-label="Back to Practice Mode" onClick={end} style={{
          width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
        }}><ChevronLeft size={22}/></button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ font: "700 20px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1 }}>PRACTICE DRILL</div>
          <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{discipline} · {move ? focus.name : `${focus.name} test out`}</div>
        </div>
        {view === 'live' && (
          <span style={{
            font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', padding: '5px 8px', borderRadius: 6,
            border: '1px solid rgba(242,190,69,.55)', color: GOLD, whiteSpace: 'nowrap', flexShrink: 0,
          }}>+{xp} XP</span>
        )}
      </header>

      <StepChips at={view === 'done' ? 'learned' : 'drill'} learned={view === 'done'} watched={!!move}/>

      {view === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexShrink: 0 }}>
            <span data-testid="drill-round" style={{ font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#C4A8FF', whiteSpace: 'nowrap' }}>{roundLine}</span>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {Array.from({ length: plan.rounds }, (_, i) => {
                const fill = i < phase.round - 1 ? 1 : i === phase.round - 1 ? phase.frac : 0;
                return (
                  <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${fill * 100}%`, height: '100%', background: i < phase.round - 1 ? GOLD : V, transition: 'width .2s linear' }}/>
                  </span>
                );
              })}
            </div>
          </div>

          {hasVideo ? (
            <>
              {/* The picture. It is as wide as the screen allows once the call, the clock and the buttons have their room.
                  A call the app has no clip for is shown here as text, large, where the picture would be. A call whose
                  clip is a moment from showing gets the bare plate, with no words to flash. */}
              <div style={{
                position: 'relative', flexShrink: 0, width: 'min(100%, max(150px, calc(100dvh - 446px)))', aspectRatio: '1 / 1',
                borderRadius: 14, overflow: 'hidden', background: '#000', border: '1px solid rgba(168,85,247,.45)', boxShadow: '0 0 22px rgba(168,85,247,.22)',
              }}>
                <DrillVideo plan={phase.resting ? null : now.plan} paused={paused} onFail={clipFailed}>
                  <div data-testid={textOnly ? 'drill-text-only' : undefined} style={{ position: 'absolute', inset: 0, background: PLATE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, boxSizing: 'border-box', textAlign: 'center' }}>
                    {phase.resting ? <span style={{ font: "900 26px 'Orbitron',sans-serif", color: '#8FB4FF', letterSpacing: '0.1em' }}>REST</span>
                      : textOnly ? <span key={now.key} className="pr-call" data-testid="drill-call" aria-live="polite" style={{ ...callStyle, fontSize: callSize }}>{now.call}</span>
                        : !now.call ? <span style={{ font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#C4A8FF' }}>GET READY</span> : null}
                  </div>
                </DrillVideo>
              </div>
              {/* Under the picture: the call it shows. */}
              <div style={{ height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {now.call && now.plan && !phase.resting && (
                  <span key={now.key} className="pr-call" data-testid="drill-call" aria-live="polite" style={{ ...callStyle, fontSize: callSize }}>{now.call}</span>
                )}
              </div>
              <span data-testid="drill-clock" style={{ font: "900 30px 'Orbitron',sans-serif", lineHeight: 1, flexShrink: 0 }}>{mmss(phase.left)}</span>
            </>
          ) : (
            <div style={{ position: 'relative', width: 'min(250px, max(170px, calc(100dvh - 400px)))', aspectRatio: '1 / 1', flexShrink: 0 }}>
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
                  <span key={now.key} className="pr-call" data-testid="drill-call" aria-live="polite" style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: callText.length > 12 ? 17 : 24, color: GOLD,
                    letterSpacing: '0.04em', textAlign: 'center', maxWidth: '80%', lineHeight: 1.1,
                    textShadow: '0 0 14px rgba(242,190,69,.55)', animation: 'pr-call-in .3s ease-out both',
                  }}>{callText}</span>
                )}
                <span data-testid="drill-clock" style={{ font: "900 30px 'Orbitron',sans-serif" }}>{mmss(phase.left)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, visibility: phase.resting ? 'hidden' : 'visible', flexShrink: 0 }}>
            NEXT <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: '#fff', letterSpacing: '0.06em' }}>{now.next}</span>
          </div>
          <div className="pr-cue" style={{ padding: '8px 14px', borderRadius: 10, background: '#0F0B1F', border: '1px solid rgba(168,85,247,.3)', fontSize: 13, color: '#CFC9E4', textAlign: 'center', maxWidth: 320, flexShrink: 0 }}>
            Cue: <span style={{ color: GOLD, fontWeight: 600 }}>{cue}</span>
          </div>
          <div style={{ flexGrow: 1, minHeight: 0 }}/>
          <div style={{ display: 'flex', gap: 10, width: '100%', flexShrink: 0 }}>
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

      {/* The verdict scrolls if the phone is short; the three ways on stay in reach under it. */}
      {view === 'done' && (
        <div data-testid="drill-done" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
          <div className="pr-done" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '6px 0' }}>
              <div aria-hidden="true" style={{
                width: 58, height: 58, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${wasFresh ? GREEN : GOLD}`, color: wasFresh ? GREEN : GOLD, fontSize: 28, boxShadow: `0 0 18px ${wasFresh ? 'rgba(74,222,128,.35)' : 'rgba(242,190,69,.35)'}`,
              }}>✓</div>
              <div data-testid="drill-verdict" style={{ font: "900 26px 'Orbitron',sans-serif", lineHeight: 1.1, letterSpacing: '0.08em', color: wasFresh ? GREEN : '#fff' }}>
                {wasFresh ? 'LEARNED' : 'ROUND DONE'}
              </div>
              <div style={{ fontSize: 15, color: '#CFC9E4' }}>{focus.name} · drilled {mmss(workTotal)}</div>
              {result && (
                <div data-testid="drill-count" style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>
                  {result.done} of {result.total} learned
                  {result.told && <><br/>Combo Coach will now call it.</>}
                </div>
              )}
              <div data-testid="drill-xp" style={{ font: "900 30px 'Orbitron',sans-serif", color: GOLD, textShadow: '0 0 18px rgba(242,190,69,.5)' }}>+{result ? result.xp : xp} XP</div>
              {result?.bonus > 0 && (
                <div style={{ font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', color: GOLD }}>WEEKLY LESSON DONE · +{result.bonus} XP</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, background: '#0B0916', border: '1px solid rgba(255,255,255,.07)', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <span style={label}>DRILLS GROW AS YOU LEARN</span>
                {PLANS.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i <= tier ? 1 : 0.5 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                      background: i < tier ? GOLD : i === tier ? '#1A1204' : 'transparent',
                      border: `1.5px solid ${i <= tier ? GOLD : 'rgba(255,255,255,.25)'}`,
                      boxShadow: i === tier ? '0 0 10px rgba(242,190,69,.7)' : 'none',
                    }}/>
                    <span style={{ flexGrow: 1, minWidth: 0, fontSize: 12, color: '#CFC9E4' }}>{p.when}</span>
                    <span style={{ flexShrink: 0, whiteSpace: 'nowrap', font: "700 12px 'Chakra Petch',sans-serif", color: i === tier ? GOLD : '#CFC9E4' }}>{planLine(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {nextUp && (
            <button type="button" className="pr-gold" data-testid="drill-next" onClick={() => onNext?.(nextUp)} style={goldBtn}>
              <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>NEXT: {nextUp.name.toUpperCase()}</span><span aria-hidden="true">›</span>
            </button>
          )}
          <button type="button" className={nextUp ? 'pr-hit' : 'pr-gold'} data-testid="drill-combo" onClick={() => onComboCoach?.()} style={nextUp ? plainBtn : goldBtn}>
            {!nextUp && <Play size={14}/>}TAKE IT TO COMBO COACH
          </button>
          <button type="button" className="pr-hit" data-testid="drill-back" onClick={onClose} style={{ ...plainBtn, border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF' }}>BACK TO THE LIST</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
