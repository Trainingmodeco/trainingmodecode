import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { Flame } from 'lucide-react';
import { C } from './Styles';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { IMG } from './data/optimizedImageMap';
import TrainingCTA from './shared/TrainingCTA';
import FightRingBackdrop from './shared/FightRingBackdrop';

const GOLD = C.gold;

const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];
const MODES = ['Technical', 'Combo'];
const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];
const ROUND_LENGTH_OPTIONS = [
  { label: '1:00', sec: 60 },
  { label: '1:30', sec: 90 },
  { label: '2:00', sec: 120 },
  { label: '3:00', sec: 180 },
  { label: '4:00', sec: 240 },
  { label: '5:00', sec: 300 },
];
const REST_OPTIONS = [
  { label: '30s', sec: 30 },
  { label: '45s', sec: 45 },
  { label: '60s', sec: 60 },
  { label: '90s', sec: 90 },
  { label: '120s', sec: 120 },
];

const setupCSS = `
.ff-pill { transition: all 0.2s ease; cursor: pointer; }
.ff-pill:hover { filter: brightness(1.1); transform: scale(1.03); }
.ff-pill:active { transform: scale(0.96); }
.ff-cta { transition: all 0.2s ease; }
.ff-cta:hover { transform: translateY(-1px); filter: brightness(1.1); }
.ff-cta:active { transform: scale(0.97); }
`;

export default function FightFocusSetup({ discipline, onBack, onStart, profile }) {
  const [cfg, setCfg] = useState({
    difficulty: 'Normal', mode: 'Combo', rounds: 3,
    roundMin: 3, restSec: 60, voiceOn: true, rushMode: false,
    encouragement: profile?.encouragement || 'normal',
  });
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const totalEst = Math.round((cfg.rounds * (cfg.roundMin * 60 + cfg.restSec)) / 60);

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="FIGHT FOCUS"
        subtitle={`${discipline} \u2014 voice-coached rounds`}
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner */}
        <div style={{
          width: '100%', height: 56, borderRadius: 12, overflow: 'hidden',
          marginBottom: 10, position: 'relative',
          border: '1px solid rgba(253,224,71,0.2)',
        }}>
          <SafeImage
            src={IMG.hub.fight}
            alt="Fight Focus"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.75), transparent)' }}/>
          <div style={{ position: 'absolute', bottom: 10, left: 14, zIndex: 2 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: GOLD, letterSpacing: '0.1em',
              textShadow: '0 0 10px rgba(253,224,71,0.4)',
            }}>FIGHT FOCUS</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10,
              color: 'rgba(255,255,255,0.7)', marginTop: 1,
            }}>Round timer with focus calls</div>
          </div>
        </div>

        {/* Rounds */}
        <SectionLabel>ROUNDS</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {ROUND_OPTIONS.map(r => {
            const active = r === cfg.rounds;
            return (
              <button key={r} className="ff-pill" onClick={() => set('rounds', r)} style={{
                padding: '9px 14px', borderRadius: 8,
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {ROUND_LENGTH_OPTIONS.map(opt => {
            const active = opt.sec === cfg.roundMin * 60;
            return (
              <button key={opt.sec} className="ff-pill" onClick={() => set('roundMin', opt.sec / 60)} style={{
                padding: '9px 14px', borderRadius: 8,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
              }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Rest Length */}
        <SectionLabel>REST BETWEEN ROUNDS</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {REST_OPTIONS.map(opt => {
            const active = opt.sec === cfg.restSec;
            return (
              <button key={opt.sec} className="ff-pill" onClick={() => set('restSec', opt.sec)} style={{
                padding: '9px 14px', borderRadius: 8,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                background: active ? 'rgba(79,140,255,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? '1.5px solid #4f8cff' : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? '#4f8cff' : C.faint,
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

        {/* Difficulty */}
        <SectionLabel>DIFFICULTY</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
          {DIFFICULTIES.map(d => {
            const active = d === cfg.difficulty;
            return (
              <button key={d} className="ff-pill" onClick={() => set('difficulty', d)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.06em',
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
              }}>
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Mode */}
        <SectionLabel>MODE</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
          {MODES.map(m => {
            const active = m === cfg.mode;
            return (
              <button key={m} className="ff-pill" onClick={() => set('mode', m)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.06em',
                background: active ? 'rgba(168,85,247,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${C.violet}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? C.violet : C.faint,
              }}>
                {m.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <ToggleRow label="VOICE COACHING" value={cfg.voiceOn} onChange={v => set('voiceOn', v)}/>
          <ToggleRow label="RUSH MODE" sub="Final 30s — go all out" value={cfg.rushMode} onChange={v => set('rushMode', v)} hot/>
        </div>

        {/* Start — inline, right under Rush Mode so it's never hidden */}
        <TrainingCTA
          variant="gold" label="START SESSION" icon="🎯" height={50}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            if (cfg.voiceOn) await primeSpeech();
            onStart(cfg);
          }}
        />

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
