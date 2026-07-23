import { useState } from 'react';
import { ShieldCheck, TriangleAlert as AlertTriangle } from 'lucide-react';
import { readinessConfig } from '../protocol/content';

// Phase 2 · 2.6 (stage 1) — PAR-Q+ pre-participation screening. Shown ONCE at
// camp onboarding, before the daily readiness gate ever runs. Six standard
// yes/no questions from readiness.json. Any "yes" NEVER hard-blocks — it shows a
// "check with a professional first" advisory and softly steers the camp to Easy.
// Calm and encouraging, never clinical or fear-mongering.
const GOLD = '#fde047';
const TEAL = '#2dd4bf';

const QUESTIONS = readinessConfig?.onboarding_screening?.questions || [];

function card(children) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(4,0,10,0.66)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div style={{
        width: '92%', maxWidth: 320, maxHeight: '86%', overflowY: 'auto',
        background: 'rgba(16,7,32,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(168,85,247,0.42)', borderRadius: 16, padding: '15px 16px 16px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.65)',
      }}>{children}</div>
    </div>
  );
}

export default function ParQSheet({ onDone }) {
  // answers[i] = null | true | false
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => null));
  const [advisory, setAdvisory] = useState(false); // showing the "any yes" advisory

  const set = (i, val) => setAnswers((a) => a.map((x, k) => (k === i ? val : x)));
  const allAnswered = answers.every((a) => a !== null);
  const anyYes = answers.some((a) => a === true);

  const submit = () => {
    if (anyYes) { setAdvisory(true); return; }
    onDone(false);
  };

  if (advisory) {
    return card(
      <div style={{ textAlign: 'center' }}>
        <AlertTriangle size={30} color={GOLD} style={{ marginBottom: 7 }} />
        <div style={{ font: "900 14px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.04em', marginBottom: 8 }}>CHECK IN FIRST</div>
        <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#e6d9ff', lineHeight: 1.4, marginBottom: 12 }}>
          You flagged something worth a quick word with a doctor before you push hard. Training Mode isn&apos;t medical advice — get the all-clear when you can.
        </div>
        <div style={{ background: 'rgba(45,212,191,0.1)', border: `1px solid ${TEAL}55`, borderRadius: 10, padding: '9px 11px', marginBottom: 14 }}>
          <div style={{ font: "800 9px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.05em', marginBottom: 3 }}>WE&apos;LL START YOU ON EASY</div>
          <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#c4e9e2', lineHeight: 1.35 }}>
            Nothing is locked — you can change difficulty any time. Easy still earns XP and keeps your streak.
          </div>
        </div>
        <button onClick={() => onDone(true)} style={{ width: '100%', height: 42, borderRadius: 11, border: 'none', background: `linear-gradient(135deg,${TEAL},#22c55e)`, color: '#04140f', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>▶ ENTER CAMP ON EASY</button>
      </div>
    );
  }

  return card(
    <>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <ShieldCheck size={26} color={TEAL} style={{ marginBottom: 5 }} />
        <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.05em' }}>HEALTH CHECK</div>
        <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#b9a9d8', marginTop: 3, lineHeight: 1.35 }}>
          One-time screening before your first camp. Answer honestly — this keeps training safe.
        </div>
      </div>

      <div>
        {QUESTIONS.map((q, i) => {
          const val = answers[i];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < QUESTIONS.length - 1 ? '1px solid rgba(168,85,247,0.14)' : 'none' }}>
              <div style={{ flex: 1, font: "600 9.5px 'Rajdhani',sans-serif", color: '#dcd2f0', lineHeight: 1.3 }}>{q}</div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[['NO', false], ['YES', true]].map(([lbl, v]) => {
                  const on = val === v;
                  const c = v ? '#ef4444' : '#22c55e';
                  return (
                    <button key={lbl} onClick={() => set(i, v)} aria-label={`Q${i + 1} ${lbl}`} style={{
                      width: 38, padding: '5px 0', borderRadius: 7, cursor: 'pointer',
                      background: on ? `${c}22` : 'rgba(8,2,18,0.4)', border: `1px solid ${on ? c : 'rgba(168,85,247,0.25)'}`,
                      font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.04em', color: on ? c : '#9a90b8',
                    }}>{lbl}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={submit} disabled={!allAnswered} style={{
        width: '100%', height: 42, borderRadius: 11, border: 'none', marginTop: 13,
        background: allAnswered ? `linear-gradient(135deg,${GOLD},#f59e0b)` : 'rgba(253,224,71,0.22)',
        color: '#0a0014', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.07em',
        cursor: allAnswered ? 'pointer' : 'not-allowed', opacity: allAnswered ? 1 : 0.55,
      }}>{allAnswered ? '✓ CONTINUE' : 'ANSWER ALL TO CONTINUE'}</button>
    </>
  );
}
