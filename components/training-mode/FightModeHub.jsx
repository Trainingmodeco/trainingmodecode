import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import TrainingHeader from './TrainingHeader';
import { Check, Crosshair, Zap, BookOpen } from 'lucide-react';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile } from './data/userProfile';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { IMG } from './data/optimizedImageMap';

// Fight Mode hub — select a discipline, then tap a mode to go. Matches the
// SELECT DISCIPLINE grid + CHOOSE MODE list layout (no quick-config / single START).
const GOLD = '#fde047';
const VIOLET = '#b06aff';

const DISCIPLINES = [
  { id: 'Boxing',     label: 'BOXING',     sub: 'the sweet science',      img: IMG.fightMode.boxingMale,     imgF: IMG.fightMode.boxingFemale },
  { id: 'Kickboxing', label: 'KICKBOXING', sub: 'hands, kicks, and rhythm', img: IMG.fightMode.kickboxingMale, imgF: IMG.fightMode.kickboxingFemale },
  { id: 'Muay Thai',  label: 'MUAY THAI',  sub: 'art of the eight limbs',  img: IMG.fightMode.muayThaiMale,   imgF: IMG.fightMode.muayThaiFemale },
  { id: 'MMA',        label: 'MMA',        sub: 'mixed martial arts',      img: IMG.fightMode.mmaMale,        imgF: IMG.fightMode.mmaFemale },
];

const MODES = [
  { key: 'fight_focus', Icon: Crosshair, title: 'FIGHT FOCUS',   desc: 'Round timer with voice coaching',                          badge: 'REC',     gold: true },
  { key: 'combo_coach', Icon: Zap,       title: 'COMBO COACH',   desc: 'Strike combos at your pace',                               badge: null,      gold: false },
  { key: 'practice',    Icon: BookOpen,  title: 'PRACTICE MODE', desc: 'Learn strikes, defense & footwork with guided breakdowns.', badge: 'PREVIEW', gold: false },
];

const getVariant = (p) => (String(p?.sex || p?.gender || '').toLowerCase() === 'female' ? 'female' : 'male');

function SectionLabel({ children }) {
  return (
    <div style={{ textAlign: 'center', font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.28em', marginBottom: 6 }}>{children}</div>
  );
}

export default function FightModeHub({ onHome, onBack, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const needsGate = isBeginner && !hasCompletedFirstLesson();
  void onCombatConditioning; // reachable from Fit/Train; not a Fight-Mode row here

  const [disc, setDisc] = useState('Boxing');
  const [toast, setToast] = useState(false);

  // Tapping a mode row launches that mode with the selected discipline.
  const goMode = async (key) => {
    if (key === 'practice') {
      if (onPractice) onPractice(disc);
      else { setToast(true); setTimeout(() => setToast(false), 2200); }
      return;
    }
    // Beginners are routed through their first guided lesson before the timers.
    if (needsGate) { onStartHere?.(disc); return; }
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    if (key === 'fight_focus') onFightFocus?.(disc);
    else if (key === 'combo_coach') onComboCoach?.(disc);
  };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>

      <TrainingHeader
        title="FIGHT MODE"
        subtitle="Train. Fight. Win."
        onHome={onHome}
        showBack
        onBack={onBack}
        rightSlot={<SafeImage src="/static/title-fight.png" alt="Fight Mode" style={{ height: 26, width: 'auto', display: 'block' }}/>}
      />

      <div style={{ position: 'relative', zIndex: 10, padding: '14px 14px calc(96px + env(safe-area-inset-bottom,0px))' }}>

        {/* Select discipline */}
        <SectionLabel>SELECT DISCIPLINE</SectionLabel>
        <div style={{ textAlign: 'center', font: "900 26px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.08em', textShadow: '0 0 16px rgba(253,224,71,0.4)', marginBottom: 14 }}>FIGHT MODE</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {DISCIPLINES.map(d => {
            const active = d.id === disc;
            return (
              <button key={d.id} onClick={() => setDisc(d.id)} style={{
                position: 'relative', height: 130, borderRadius: 13, overflow: 'hidden', padding: 0, cursor: 'pointer',
                border: `1.5px solid ${active ? 'rgba(253,224,71,0.85)' : 'rgba(168,85,247,0.28)'}`,
                boxShadow: active ? '0 0 26px rgba(253,224,71,0.3)' : '0 2px 12px rgba(0,0,0,0.4)',
              }}>
                <SafeImage src={variant === 'female' ? d.imgF : d.img} alt={d.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%', opacity: active ? 1 : 0.9 }}/>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '9px 9px 10px', textAlign: 'center', background: `linear-gradient(to top,${active ? 'rgba(20,6,38,0.94)' : 'rgba(8,2,18,0.88)'} 15%,transparent)` }}>
                  <div style={{ font: "900 14px 'Orbitron',sans-serif", color: active ? GOLD : '#fff', letterSpacing: '0.05em', textShadow: active ? '0 0 10px rgba(253,224,71,0.4)' : '0 1px 4px rgba(0,0,0,0.7)' }}>{d.label}</div>
                  <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: active ? 'rgba(253,224,71,0.85)' : 'rgba(226,214,245,0.85)', marginTop: 1 }}>{d.sub}</div>
                </div>
                {active && <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: GOLD, color: '#0a0014', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(253,224,71,0.7)' }}><Check size={13} strokeWidth={3}/></div>}
              </button>
            );
          })}
        </div>

        {/* Choose mode */}
        <SectionLabel>CHOOSE MODE</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {MODES.map(m => {
            const accent = m.gold ? GOLD : VIOLET;
            const Icon = m.Icon;
            return (
              <button key={m.key} onClick={() => goMode(m.key)} style={{
                display: 'flex', alignItems: 'center', gap: 13, borderRadius: 13, padding: '13px 15px', cursor: 'pointer', textAlign: 'left',
                background: 'rgba(16,4,30,0.82)',
                border: `1px solid ${m.gold ? 'rgba(253,224,71,0.45)' : 'rgba(168,85,247,0.4)'}`,
                boxShadow: m.gold ? '0 0 16px rgba(253,224,71,0.14)' : '0 0 14px rgba(168,85,247,0.12)',
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: m.gold ? 'rgba(253,224,71,0.1)' : 'rgba(168,85,247,0.1)', border: `1px solid ${m.gold ? 'rgba(253,224,71,0.3)' : 'rgba(168,85,247,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={accent}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: "900 16px 'Orbitron',sans-serif", color: accent, letterSpacing: '0.06em' }}>{m.title}</span>
                    {m.badge && <span style={{ font: "700 7px 'Orbitron',sans-serif", color: GOLD, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 4, padding: '2px 6px' }}>{m.badge}</span>}
                  </div>
                  <div style={{ font: "500 12px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3, lineHeight: 1.3 }}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Brand footer line */}
        <div style={{ textAlign: 'center', font: "700 9px 'Orbitron',sans-serif", color: 'rgba(196,164,216,0.28)', letterSpacing: '0.3em', marginTop: 20 }}>TRAIN · FIGHT · WIN</div>
      </div>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#c9a6ff', zIndex: 20, whiteSpace: 'nowrap' }}>Practice Mode preview — coming soon.</div>}
    </PhoneFrame>
  );
}
