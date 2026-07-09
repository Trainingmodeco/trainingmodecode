import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft, Home, Check } from 'lucide-react';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile } from './data/userProfile';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { IMG } from './data/optimizedImageMap';

// Fight Mode hub — pixel match of design 5a:
// header (title-fight) · SELECT DISCIPLINE grid · CHOOSE MODE rows · QUICK CONFIG · one START.
const GOLD = '#fde047';
const VIOLET = '#b06aff';

const DISCIPLINES = [
  { id: 'Boxing',     label: 'BOXING',     sub: 'the sweet science',  img: IMG.fightMode.boxingMale,     imgF: IMG.fightMode.boxingFemale },
  { id: 'Kickboxing', label: 'KICKBOXING', sub: 'hands, kicks, rhythm', img: IMG.fightMode.kickboxingMale, imgF: IMG.fightMode.kickboxingFemale },
  { id: 'Muay Thai',  label: 'MUAY THAI',  sub: 'art of eight limbs', img: IMG.fightMode.muayThaiMale,   imgF: IMG.fightMode.muayThaiFemale },
  { id: 'MMA',        label: 'MMA',        sub: 'mixed martial arts', img: IMG.fightMode.mmaMale,        imgF: IMG.fightMode.mmaFemale },
];

const MODES = [
  { key: 'fight_focus', icon: '🎯', title: 'FIGHT FOCUS',   desc: 'Round timer with voice coaching.',                        badge: 'REC',     accent: GOLD },
  { key: 'combo_coach', icon: '⚡', title: 'COMBO COACH',   desc: 'Strike combos at your pace.',                             badge: null,      accent: VIOLET },
  { key: 'practice',    icon: '📖', title: 'PRACTICE MODE', desc: 'Learn strikes, defense & footwork with guided breakdowns.', badge: 'PREVIEW', accent: VIOLET },
];

const getVariant = (p) => (String(p?.sex || p?.gender || '').toLowerCase() === 'female' ? 'female' : 'male');

function SectionNum({ n, label, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 15, height: 15, borderRadius: '50%', background: GOLD, color: '#0a0014', font: "900 8px 'Orbitron',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
        <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.25em' }}>{label}</span>
      </div>
      {right}
    </div>
  );
}

export default function FightModeHub({ onHome, onBack, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning, onQuickFight, onQuickCombo }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const needsGate = isBeginner && !hasCompletedFirstLesson();
  void onCombatConditioning; // reachable from Fit/Train; not a Fight-Mode row in design 5a

  const [disc, setDisc] = useState('Boxing');
  const [mode, setMode] = useState('fight_focus');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [rounds, setRounds] = useState(3);
  const [toast, setToast] = useState(false);

  const modeTitle = MODES.find(m => m.key === mode)?.title || '';
  // 'NORMAL' -> 'Normal' to match the session config's difficulty casing.
  const capDiff = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();

  // QUICK CONFIG + START launches straight into the session (design 5a), carrying
  // the chosen difficulty + rounds. Round length / rest / voice use the same
  // defaults as the full setup; FULL ⚙ opens that setup for finer control.
  const start = async () => {
    if (needsGate && (mode === 'fight_focus' || mode === 'combo_coach')) { onStartHere?.(disc); return; }
    if (mode === 'practice') {
      if (onPractice) onPractice(disc);
      else { setToast(true); setTimeout(() => setToast(false), 2200); }
      return;
    }
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    if (mode === 'fight_focus') {
      if (onQuickFight) onQuickFight({ difficulty: capDiff, mode: 'Combo', rounds, roundMin: 3, restSec: 60, voiceOn: true, rushMode: false });
      else onFightFocus?.(disc);
    } else if (mode === 'combo_coach') {
      if (onQuickCombo) onQuickCombo({ discipline: disc, difficulty: capDiff, speed: 'medium', speedLabel: 'MEDIUM', ms: 4000, rounds, roundMin: 3, voiceOn: true, rushMode: false, encouragement: profile?.encouragement || 'normal' });
      else onComboCoach?.(disc);
    }
  };

  // FULL ⚙ — open the detailed setup screen for the selected mode.
  const openFullConfig = () => {
    if (mode === 'combo_coach') onComboCoach?.(disc);
    else if (mode === 'practice') { if (onPractice) onPractice(disc); }
    else onFightFocus?.(disc);
  };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom,0px))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 8px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={22}/></button>
          <div style={{ flex: 1 }}><SafeImage src="/static/title-fight.png" alt="Fight Mode" style={{ height: 30, width: 'auto', maxWidth: '100%', display: 'block' }}/></div>
          <button onClick={onHome} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={18}/></button>
        </div>

        <div style={{ padding: '4px 14px 0' }}>
          {/* 1 · DISCIPLINE */}
          <SectionNum n={1} label="SELECT DISCIPLINE"/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {DISCIPLINES.map(d => {
              const active = d.id === disc;
              return (
                <button key={d.id} onClick={() => setDisc(d.id)} style={{
                  position: 'relative', height: 94, borderRadius: 11, overflow: 'hidden', padding: 0, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'rgba(253,224,71,0.8)' : 'rgba(168,85,247,0.25)'}`,
                  boxShadow: active ? '0 0 24px rgba(253,224,71,0.28)' : '0 2px 12px rgba(0,0,0,0.4)',
                }}>
                  <SafeImage src={variant === 'female' ? d.imgF : d.img} alt={d.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%', opacity: active ? 1 : 0.92 }}/>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '7px 8px', textAlign: 'center', background: `linear-gradient(to top,${active ? 'rgba(20,6,38,0.92)' : 'rgba(8,2,18,0.85)'},transparent)`, borderTop: `1px solid ${active ? 'rgba(253,224,71,0.35)' : 'rgba(168,85,247,0.2)'}` }}>
                    <div style={{ font: "900 12px 'Orbitron',sans-serif", color: active ? GOLD : '#fff', letterSpacing: '0.06em', textShadow: active ? '0 0 10px rgba(253,224,71,0.4)' : '0 1px 4px rgba(0,0,0,0.7)' }}>{d.label}</div>
                    <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: active ? 'rgba(253,224,71,0.82)' : 'rgba(226,214,245,0.82)' }}>{d.sub}</div>
                  </div>
                  {active && <div style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: '50%', background: GOLD, color: '#0a0014', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(253,224,71,0.7)' }}><Check size={12} strokeWidth={3}/></div>}
                </button>
              );
            })}
          </div>

          {/* 2 · MODE */}
          <SectionNum n={2} label="CHOOSE MODE"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {MODES.map(m => {
              const active = m.key === mode;
              const gold = m.accent === GOLD;
              return (
                <button key={m.key} onClick={() => setMode(m.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                  background: 'rgba(16,4,30,0.82)',
                  border: `1px solid ${active ? (gold ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.6)') : (gold ? 'rgba(253,224,71,0.4)' : 'rgba(168,85,247,0.35)')}`,
                  boxShadow: active ? (gold ? '0 0 16px rgba(253,224,71,0.18)' : '0 0 16px rgba(168,85,247,0.22)') : (gold ? '0 0 14px rgba(253,224,71,0.1)' : '0 0 12px rgba(168,85,247,0.1)'),
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: gold ? 'rgba(253,224,71,0.08)' : 'rgba(168,85,247,0.08)', border: `1px solid ${gold ? 'rgba(253,224,71,0.25)' : 'rgba(168,85,247,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: "900 15px 'Orbitron',sans-serif", color: m.accent, letterSpacing: '0.08em' }}>{m.title}</span>
                      {m.badge && <span style={{ font: "700 7px 'Orbitron',sans-serif", color: GOLD, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.25)', borderRadius: 4, padding: '2px 6px' }}>{m.badge}</span>}
                    </div>
                    <div style={{ font: "500 12px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3 }}>{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3 · QUICK CONFIG */}
          <SectionNum n={3} label="QUICK CONFIG" right={<button onClick={openFullConfig} style={{ font: "700 8px 'Orbitron',sans-serif", color: VIOLET, letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>FULL ⚙</button>}/>
          <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ font: "700 10px 'Rajdhani',sans-serif", color: '#c4a4d8', letterSpacing: '0.06em' }}>DIFFICULTY</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['EASY', 'NORMAL', 'HARD'].map(d => (
                  <button key={d} onClick={() => setDifficulty(d)} style={{ font: "800 9px 'Orbitron',sans-serif", color: difficulty === d ? '#0a0014' : '#c4a4d8', background: difficulty === d ? GOLD : 'transparent', border: difficulty === d ? 'none' : '1px solid rgba(168,85,247,0.3)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', boxShadow: difficulty === d ? '0 0 10px rgba(253,224,71,0.4)' : 'none' }}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: "700 10px 'Rajdhani',sans-serif", color: '#c4a4d8', letterSpacing: '0.06em' }}>ROUNDS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setRounds(r => Math.max(1, r - 1))} aria-label="Fewer rounds" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(168,85,247,0.4)', color: GOLD, background: 'none', font: "900 14px 'Orbitron',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>−</button>
                <span style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff', minWidth: 16, textAlign: 'center' }}>{rounds}</span>
                <button onClick={() => setRounds(r => Math.min(12, r + 1))} aria-label="More rounds" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(168,85,247,0.4)', color: GOLD, background: 'none', font: "900 14px 'Orbitron',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
              </div>
            </div>
          </div>

          {/* START */}
          <div style={{ padding: '14px 0 0' }}>
            <button onClick={start} style={{ width: '100%', height: 46, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 0 22px rgba(253,224,71,0.4)' }}>▶ START · {disc.toUpperCase()} {modeTitle}</button>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#c9a6ff', zIndex: 20, whiteSpace: 'nowrap' }}>Practice Mode preview — coming soon.</div>}
    </PhoneFrame>
  );
}
