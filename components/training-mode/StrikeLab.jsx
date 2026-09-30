import { useCallback, useEffect, useRef, useState } from 'react';
import { createStrikeDetector } from './data/strikeCounter';
import { createMicStrikeDetector, MIC_DEFAULTS } from './data/micStrikeDetector';
import { judgeRush } from './data/rushVerdict';
import { loadLabLog, saveLabLog } from './data/strikeLab';
import { playBeep, unlockAudio } from './data/audioEngine';
import useWakeLock from './hooks/useWakeLock';

// STRIKE LAB — private diagnostics, opened only with the owner's code
// (data/strikeLab). Runs the app's accelerometer strike detector and the
// microphone bag-hit detector side by side so we can see, per phone
// placement, which one counts honestly — and whether either undercounts a
// flurry, which is the question the rush verdict depends on.
//
// Two tests:
//   COUNT — throw exactly N strikes at a normal pace, tap STOP. Accuracy per sensor.
//   RUSH  — 5 s prep · 15 s steady · 10 s all-out · 15 s steady, cued by beeps.
//           Per sensor: strikes/min in each phase, and what the live rush
//           verdict would have said.
const mono = "'Orbitron',sans-serif";
const body = "'Rajdhani',sans-serif";
const GOLD = '#fde047';
const PLACEMENTS = ['POCKET', 'FLOOR', 'BAG FRAME', 'OTHER'];
const RUSH_PHASES = [
  { id: 'prep', label: 'GET READY', sec: 5 },
  { id: 'steady1', label: 'STEADY', sec: 15 },
  { id: 'rush', label: 'RUSH · ALL OUT', sec: 10 },
  { id: 'steady2', label: 'STEADY', sec: 15 },
];
const BEEP_MUTE_MS = 300;

const btn = (bg, fg = '#fff') => ({
  padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: bg, color: fg,
  font: `800 11px ${mono}`, letterSpacing: '0.1em', cursor: 'pointer',
});

export default function StrikeLab({ onExit }) {
  const [placement, setPlacement] = useState('POCKET');
  const [target, setTarget] = useState(20);
  const [factor, setFactor] = useState(MIC_DEFAULTS.factor);
  const [motionState, setMotionState] = useState('off'); // off | on | denied | unsupported
  const [micState, setMicState] = useState('off');       // off | on | denied | unsupported
  const [running, setRunning] = useState(null);           // null | 'count' | 'rush'
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [phaseLeft, setPhaseLeft] = useState(0);
  const [accelCount, setAccelCount] = useState(0);
  const [micCount, setMicCount] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [accelLevel, setAccelLevel] = useState(0);
  const [log, setLog] = useState(loadLabLog);
  const [copied, setCopied] = useState(false);

  const accelDet = useRef(createStrikeDetector());
  const micDet = useRef(createMicStrikeDetector());
  const accelSeen = useRef(false);
  const counts = useRef({ accel: 0, mic: 0 });
  const phaseMarks = useRef([]); // [{ id, sec, accel, mic }] counts at each phase START
  const startedAt = useRef(0);
  const audio = useRef({ ctx: null, stream: null, analyser: null, timer: null, buf: null });
  const levelTick = useRef(0);

  useWakeLock(!!running);

  // ── sensors ─────────────────────────────────────────────────────────────
  const enableMotion = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') { setMotionState('unsupported'); return; }
    if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
      try {
        const r = await window.DeviceMotionEvent.requestPermission();
        if (r !== 'granted') { setMotionState('denied'); return; }
      } catch { setMotionState('denied'); return; }
    }
    setMotionState('on');
  }, []);

  useEffect(() => {
    if (motionState !== 'on') return undefined;
    const handler = (e) => {
      const lin = e.acceleration;
      const raw = e.accelerationIncludingGravity;
      const src = (lin && lin.x != null) ? lin : raw;
      if (!src || src.x == null) return;
      accelSeen.current = true;
      const t = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
      const n = accelDet.current.onSample(src.x, src.y, src.z, src === raw, t);
      counts.current.accel = n;
      const mag = Math.hypot(src.x, src.y, src.z) - (src === raw ? 9.81 : 0);
      if (++levelTick.current % 6 === 0) setAccelLevel(Math.min(1, Math.abs(mag) / 25));
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [motionState]);

  const enableMic = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setMicState('unsupported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 70;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(hp); hp.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let tick = 0;
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > peak) peak = v; }
        const r = micDet.current.onFrame(peak, performance.now());
        counts.current.mic = r.count;
        if (++tick % 5 === 0) setMicLevel(Math.min(1, peak));
      }, 10);
      audio.current = { ctx, stream, analyser, timer, buf };
      setMicState('on');
    } catch { setMicState('denied'); }
  }, []);

  useEffect(() => () => {
    const a = audio.current;
    if (a.timer) clearInterval(a.timer);
    a.stream?.getTracks().forEach(tr => tr.stop());
    a.ctx?.close?.().catch?.(() => {});
  }, []);

  useEffect(() => { micDet.current.set({ factor }); }, [factor]);

  // Live count display while a test runs.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { setAccelCount(counts.current.accel); setMicCount(counts.current.mic); }, 100);
    return () => clearInterval(id);
  }, [running]);

  // ── tests ───────────────────────────────────────────────────────────────
  const zero = () => {
    accelDet.current.reset(); micDet.current.reset();
    counts.current = { accel: 0, mic: 0 };
    accelSeen.current = false;
    setAccelCount(0); setMicCount(0);
  };
  const cue = () => { playBeep(); micDet.current.mute(performance.now(), BEEP_MUTE_MS); };

  const record = (row) => {
    const next = [...log, { at: new Date().toISOString(), placement, micFactor: factor, motion: motionState === 'on' && accelSeen.current, mic: micState === 'on', ...row }];
    setLog(next); saveLabLog(next);
  };

  const startCount = () => {
    unlockAudio(); zero(); cue();
    startedAt.current = performance.now();
    setRunning('count');
  };
  const stopCount = () => {
    const sec = (performance.now() - startedAt.current) / 1000;
    record({ test: 'count', target, sec: Math.round(sec), accel: counts.current.accel, micHits: counts.current.mic });
    setRunning(null);
  };

  const startRush = () => {
    unlockAudio(); zero();
    phaseMarks.current = [];
    setRunning('rush');
    setPhaseIdx(0);
    setPhaseLeft(RUSH_PHASES[0].sec);
    cue();
  };

  useEffect(() => {
    if (running !== 'rush' || phaseIdx < 0) return undefined;
    const id = setTimeout(() => {
      if (phaseLeft > 1) {
        if (phaseLeft <= 4 && RUSH_PHASES[phaseIdx + 1]) cue();
        setPhaseLeft(l => l - 1);
        return;
      }
      // Phase boundary: mark counts at the start of the next phase.
      const nextIdx = phaseIdx + 1;
      phaseMarks.current.push({ id: RUSH_PHASES[phaseIdx].id, accel: counts.current.accel, mic: counts.current.mic });
      if (nextIdx >= RUSH_PHASES.length) {
        cue(); setTimeout(cue, 180);
        finishRush();
        return;
      }
      cue();
      setPhaseIdx(nextIdx);
      setPhaseLeft(RUSH_PHASES[nextIdx].sec);
    }, 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIdx, phaseLeft]);

  const finishRush = () => {
    // marks hold the count at the END of each phase, in order.
    const m = phaseMarks.current;
    const at = (id) => m.find(x => x.id === id);
    const span = (fromId, toId, k) => (at(toId)?.[k] ?? 0) - (at(fromId)?.[k] ?? 0);
    const rate = (n, sec) => Math.round((n / sec) * 60);
    const sensor = (k) => {
      const s1 = span('prep', 'steady1', k), r = span('steady1', 'rush', k), s2 = span('rush', 'steady2', k);
      const v = judgeRush({ motionSeen: k === 'accel' ? accelSeen.current : micState === 'on', baselineStrikes: s1, baselineSec: 15, rushStrikes: r, rushSec: 10 });
      return { steady1PerMin: rate(s1, 15), rushPerMin: rate(r, 10), steady2PerMin: rate(s2, 15), verdict: v.verdict, ratio: v.ratio ? +v.ratio.toFixed(2) : null };
    };
    record({ test: 'rush', accel: sensor('accel'), micHits: sensor('mic') });
    setRunning(null); setPhaseIdx(-1);
  };

  const cancel = () => { setRunning(null); setPhaseIdx(-1); };

  const copyAll = async () => {
    const text = JSON.stringify({ app: 'Training Mode Strike Lab', ua: navigator.userAgent, rows: log }, null, 1);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copy the results:', text); }
  };
  const clearLog = () => { if (window.confirm('Clear all Strike Lab results?')) { setLog([]); saveLabLog([]); } };

  // ── view ────────────────────────────────────────────────────────────────
  const phase = phaseIdx >= 0 ? RUSH_PHASES[phaseIdx] : null;
  const meter = (v, color) => (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.round(v * 100)}%`, height: '100%', background: color, transition: 'width 80ms linear' }} />
    </div>
  );
  const sensorCard = (label, n, state, level, color) => (
    <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${color}55`, background: 'rgba(12,4,24,0.85)', padding: '10px 12px' }}>
      <div style={{ font: `800 9px ${mono}`, letterSpacing: '0.16em', color }}>{label}</div>
      <div style={{ font: `900 44px ${mono}`, color: '#fff', lineHeight: 1.1 }}>{state === 'on' ? n : '—'}</div>
      <div style={{ font: `600 10px ${body}`, color: '#9a90b8' }}>{state === 'on' ? 'live' : state}</div>
      {state === 'on' && meter(level, color)}
    </div>
  );
  const verdictColor = (v) => (v === 'pass' ? '#8fe8ac' : v === 'fail' ? '#ff9a9a' : v === 'hold' ? '#fde047' : '#9a90b8');

  return (
    <div style={{ minHeight: '100dvh', background: '#07020f', color: '#fff', padding: '16px 16px 40px', boxSizing: 'border-box', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ font: `900 16px ${mono}`, color: GOLD, letterSpacing: '0.12em' }}>STRIKE LAB</div>
          <div style={{ font: `600 10.5px ${body}`, color: '#9a90b8' }}>Private · accelerometer vs microphone</div>
        </div>
        <button type="button" onClick={onExit} style={btn('transparent', '#c4b5fd')}>EXIT</button>
      </div>

      {/* 1. sensors */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={enableMotion} disabled={motionState === 'on'} style={btn(motionState === 'on' ? '#1b3b24' : '#2a1450')}>{motionState === 'on' ? '✓ MOTION' : 'ENABLE MOTION'}</button>
        <button type="button" onClick={enableMic} disabled={micState === 'on'} style={btn(micState === 'on' ? '#1b3b24' : '#2a1450')}>{micState === 'on' ? '✓ MIC' : 'ENABLE MIC'}</button>
      </div>

      {/* 2. placement */}
      <div style={{ font: `800 9px ${mono}`, letterSpacing: '0.16em', color: '#9a90b8', margin: '4px 0 6px' }}>PHONE PLACEMENT</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
        {PLACEMENTS.map(p => (
          <button key={p} type="button" disabled={!!running} onClick={() => setPlacement(p)} style={{ ...btn(placement === p ? 'rgba(253,224,71,0.14)' : 'rgba(255,255,255,0.04)', placement === p ? GOLD : '#c4b5fd'), padding: '9px 4px', fontSize: 9, borderColor: placement === p ? 'rgba(253,224,71,0.6)' : 'rgba(255,255,255,0.12)' }}>{p}</button>
        ))}
      </div>

      {/* 3. live counts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {sensorCard('ACCELEROMETER', accelCount, motionState, accelLevel, '#b58cff')}
        {sensorCard('MICROPHONE', micCount, micState, micLevel, '#5ee0c0')}
      </div>

      {phase && (
        <div style={{ textAlign: 'center', borderRadius: 12, padding: '12px 10px', marginBottom: 10, background: phase.id === 'rush' ? 'rgba(255,138,74,0.18)' : 'rgba(124,58,237,0.16)', border: `1.5px solid ${phase.id === 'rush' ? '#ff8a4a' : '#7c3aed'}` }}>
          <div style={{ font: `900 18px ${mono}`, letterSpacing: '0.12em', color: phase.id === 'rush' ? '#ffb27a' : '#e6d4ff' }}>{phase.label}</div>
          <div style={{ font: `900 40px ${mono}`, color: '#fff' }}>{phaseLeft}</div>
        </div>
      )}

      {/* 4. tests */}
      {!running && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ font: `700 10px ${mono}`, color: '#9a90b8', letterSpacing: '0.1em' }}>COUNT TARGET</span>
            {[10, 20, 30].map(n => (
              <button key={n} type="button" onClick={() => setTarget(n)} style={{ ...btn(target === n ? 'rgba(253,224,71,0.14)' : 'rgba(255,255,255,0.04)', target === n ? GOLD : '#c4b5fd'), padding: '7px 10px' }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button type="button" onClick={startCount} style={{ ...btn('linear-gradient(180deg,#8b5cf6,#6d28d9)'), flex: 1 }}>COUNT TEST · {target}</button>
            <button type="button" onClick={startRush} style={{ ...btn('linear-gradient(180deg,#fb923c,#c2410c)'), flex: 1 }}>RUSH TEST · 45 s</button>
          </div>
        </>
      )}
      {running === 'count' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: `600 12px ${body}`, color: '#e6d4ff', textAlign: 'center', marginBottom: 8 }}>Throw exactly {target} strikes at a normal pace, then tap STOP.</div>
          <button type="button" onClick={stopCount} style={{ ...btn('linear-gradient(180deg,#22c55e,#15803d)'), width: '100%', padding: 16, fontSize: 14 }}>STOP · I THREW {target}</button>
        </div>
      )}
      {running === 'rush' && (
        <button type="button" onClick={cancel} style={{ ...btn('rgba(239,68,68,0.2)', '#ff9a9a'), width: '100%', marginBottom: 14 }}>CANCEL</button>
      )}

      {/* 5. mic sensitivity */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `700 9px ${mono}`, color: '#9a90b8', letterSpacing: '0.12em' }}>
          <span>MIC SENSITIVITY</span><span>{factor.toFixed(1)}× FLOOR · {factor <= 3 ? 'MORE HITS' : factor >= 6 ? 'FEWER HITS' : 'DEFAULT'}</span>
        </div>
        <input type="range" min={2} max={8} step={0.5} value={factor} disabled={!!running} onChange={e => setFactor(Number(e.target.value))} style={{ width: '100%' }} />
      </div>

      {/* 6. results */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ font: `800 9px ${mono}`, letterSpacing: '0.16em', color: '#9a90b8' }}>RESULTS · {log.length}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={copyAll} disabled={!log.length} style={{ ...btn('rgba(94,224,192,0.14)', '#5ee0c0'), padding: '7px 10px' }}>{copied ? 'COPIED' : 'COPY ALL'}</button>
          <button type="button" onClick={clearLog} disabled={!log.length} style={{ ...btn('transparent', '#9a90b8'), padding: '7px 10px' }}>CLEAR</button>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {log.slice().reverse().slice(0, 12).map((r, i) => (
          <div key={i} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', font: `600 11px ${body}`, color: '#d8ccf0' }}>
            <div style={{ font: `800 9px ${mono}`, letterSpacing: '0.1em', color: GOLD, marginBottom: 3 }}>{r.test.toUpperCase()} · {r.placement} · mic {r.micFactor}×</div>
            {r.test === 'count' ? (
              <div>
                Threw {r.target} · accel <b>{r.motion ? r.accel : '—'}</b>{r.motion ? ` (${Math.round((r.accel / r.target) * 100)}%)` : ''} · mic <b>{r.mic ? r.micHits : '—'}</b>{r.mic ? ` (${Math.round((r.micHits / r.target) * 100)}%)` : ''}
              </div>
            ) : (
              ['accel', 'micHits'].map(k => (
                <div key={k}>
                  {k === 'accel' ? 'accel' : 'mic'} · {r[k].steady1PerMin} → <b>{r[k].rushPerMin}</b> → {r[k].steady2PerMin}/min · <span style={{ color: verdictColor(r[k].verdict), fontWeight: 800 }}>{r[k].verdict.toUpperCase()}</span>{r[k].ratio ? ` ×${r[k].ratio}` : ''}
                </div>
              ))
            )}
          </div>
        ))}
        {!log.length && <div style={{ font: `600 11px ${body}`, color: '#6b6483' }}>No results yet. Enable both sensors, pick a placement, run a test.</div>}
      </div>
    </div>
  );
}
