import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { Flame } from 'lucide-react';
import { C } from './Styles';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import TrainingCTA from './shared/TrainingCTA';

const GOLD = C.gold;
const VIOLET = C.violet;

const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
const BASE_INTERVAL = 4000;
const SPEEDS = [
  { id: 'slow',   label: 'SLOW',   ms: BASE_INTERVAL * 2.0,  color: '#22c55e' },
  { id: 'medium', label: 'MEDIUM', ms: BASE_INTERVAL * 1.0,  color: '#f59e0b' },
  { id: 'turbo',  label: 'TURBO',  ms: Math.max(BASE_INTERVAL * 0.85, 2800), color: '#ef4444' },
];
const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8];
const ROUND_LENGTH_OPTIONS = [
  { label: '1:00', min: 1 },
  { label: '2:00', min: 2 },
  { label: '3:00', min: 3 },
  { label: '4:00', min: 4 },
  { label: '5:00', min: 5 },
];

const setupCSS = `
.cc-s-pill { transition: all 0.2s ease; cursor: pointer; }
.cc-s-pill:hover { filter: brightness(1.1); transform: scale(1.03); }
.cc-s-pill:active { transform: scale(0.96); }
.cc-s-cta { transition: all 0.2s ease; }
.cc-s-cta:hover { transform: translateY(-1px); filter: brightness(1.1); }
.cc-s-cta:active { transform: scale(0.97); }
`;

export default function ComboCoachSetup({ discipline, onBack, onStart, profile }) {
  const [difficulty, setDifficulty] = useState('Normal');
  const [speed, setSpeed] = useState('medium');
  const [rounds, setRounds] = useState(3);
  const [roundMin, setRoundMin] = useState(3);
  const [voiceOn, setVoiceOn] = useState(true);
  const [rushMode, setRushMode] = useState(false);

  const selectedSpeed = SPEEDS.find(s => s.id === speed);
  const totalEst = Math.round(rounds * roundMin + rounds);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="COMBO COACH"
        subtitle={`${discipline} \u2014 strike combos at cadence`}
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner */}
        <div style={{
          width: '100%', height: 80, borderRadius: 12, overflow: 'hidden',
          marginBottom: 14, position: 'relative',
          border: '1px solid rgba(168,85,247,0.25)',
        }}>
          <SafeImage
            src="/static/ring-combo.webp"
            alt="Combo Coach"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.8), transparent)' }}/>
          <div style={{ position: 'absolute', bottom: 10, left: 14, zIndex: 2 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: VIOLET, letterSpacing: '0.1em',
              textShadow: '0 0 10px rgba(168,85,247,0.4)',
            }}>COMBO COACH</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10,
              color: 'rgba(255,255,255,0.7)', marginTop: 1,
            }}>Flash combos, build flow</div>
          </div>
        </div>

        {/* Difficulty */}
        <SectionLabel>DIFFICULTY</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {DIFFICULTIES.map(d => {
            const active = d === difficulty;
            return (
              <button key={d} className="cc-s-pill" onClick={() => setDifficulty(d)} style={{
                padding: '9px 14px', borderRadius: 20,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.06em',
                background: active ? 'rgba(168,85,247,0.15)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${VIOLET}` : '1.5px solid rgba(168,85,247,0.1)',
                color: active ? VIOLET : C.faint,
                boxShadow: active ? '0 0 10px rgba(168,85,247,0.25)' : 'none',
              }}>
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Speed / Cadence */}
        <SectionLabel>CADENCE SPEED</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {SPEEDS.map(s => {
            const active = s.id === speed;
            return (
              <button key={s.id} className="cc-s-pill" onClick={() => setSpeed(s.id)} style={{
                flex: 1, padding: '10px 0', borderRadius: 8, textAlign: 'center',
                background: active ? `${s.color}18` : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${s.color}` : '1.5px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
                  color: active ? s.color : C.faint, letterSpacing: '0.06em',
                }}>{s.label}</div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.faint, marginTop: 2,
                }}>{(s.ms / 1000).toFixed(1)}s</div>
              </button>
            );
          })}
        </div>

        {/* Rounds */}
        <SectionLabel>ROUNDS</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {ROUND_OPTIONS.map(r => {
            const active = r === rounds;
            return (
              <button key={r} className="cc-s-pill" onClick={() => setRounds(r)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12,
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
              }}>
                {r}
              </button>
            );
          })}
        </div>

        {/* Round Length */}
        <SectionLabel>ROUND LENGTH</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {ROUND_LENGTH_OPTIONS.map(opt => {
            const active = opt.min === roundMin;
            return (
              <button key={opt.min} className="cc-s-pill" onClick={() => setRoundMin(opt.min)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
              }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Estimated time */}
        <div style={{
          textAlign: 'center', marginBottom: 14, fontFamily: "'Rajdhani',sans-serif",
          fontSize: 11, fontWeight: 600, color: C.faint,
        }}>
          EST. {totalEst} MIN
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <ToggleRow label="VOICE COACHING" value={voiceOn} onChange={setVoiceOn}/>
          <ToggleRow label="RUSH MODE" sub="Final 30s — go all out" value={rushMode} onChange={setRushMode} hot/>
        </div>

        {/* CTA */}
        <TrainingCTA variant="gold" label="START COMBOS" icon="⚡" height={50} style={{ fontSize: 13, letterSpacing: '0.1em' }} onClick={async () => {
          setVoiceGender(profile?.voiceCoach || 'FEMALE');
          if (voiceOn) await primeSpeech();
          onStart({
            discipline, difficulty, speed,
            speedLabel: selectedSpeed.label,
            ms: selectedSpeed.ms,
            rounds, roundMin, voiceOn, rushMode,
            encouragement: profile?.encouragement || 'normal',
          });
        }}/>
      </div>
    </PhoneFrame>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.faint,
      fontSize: 9, letterSpacing: '0.15em', marginBottom: 6,
    }}>{children}</div>
  );
}

function ToggleRow({ label, sub, value, onChange, hot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(10,0,20,0.5)', borderRadius: 8, padding: '10px 12px',
      border: hot ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
          color: hot ? '#ef4444' : C.muted, letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {hot && <Flame size={11} style={{ color: '#ef4444' }}/>}
          {label}
        </div>
        {sub && <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.faint, marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{ background: 'none', border: 'none', padding: 0 }}>
        <div className={`tm-toggle ${value ? 'on' : ''}`}><div className="tm-toggle-knob"/></div>
      </button>
    </div>
  );
}
