import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import TrainingHeader from './TrainingHeader';
import { Check, Crosshair, Zap, BookOpen, Tent } from 'lucide-react';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile } from './data/userProfile';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';

// Fight Mode hub — locked (non-scrolling) SELECT DISCIPLINE grid + CHOOSE MODE list.
const GOLD = '#fde047';
const VIOLET = '#b06aff';

const DISCIPLINES = [
  { id: 'Boxing',     key: 'boxing',     label: 'BOXING',     sub: 'the sweet science' },
  { id: 'Kickboxing', key: 'kickboxing', label: 'KICKBOXING', sub: 'hands, kicks, and rhythm' },
  { id: 'Muay Thai',  key: 'muay_thai',  label: 'MUAY THAI',  sub: 'art of the eight limbs' },
  { id: 'MMA',        key: 'mma',        label: 'MMA',        sub: 'mixed martial arts' },
];
const discImg = (key, variant) => `/discipline-cards/${key}_${variant}.webp`;

const MODES = [
  { key: 'training_camp', Icon: Tent,      title: 'TRAINING CAMP', desc: '12-level fight camp — periodized to a title fight',        badge: 'NEW',     gold: true },
  { key: 'fight_focus',   Icon: Crosshair, title: 'FIGHT FOCUS',   desc: 'Round timer with voice coaching',                          badge: 'REC',     gold: true },
  { key: 'combo_coach',   Icon: Zap,       title: 'COMBO COACH',   desc: 'Strike combos at your pace',                               badge: null,      gold: false },
  { key: 'practice',      Icon: BookOpen,  title: 'PRACTICE MODE', desc: 'Learn strikes, defense & footwork with guided breakdowns.', badge: 'PREVIEW', gold: false },
];

const getVariant = (p) => {
  const pref = String(p?.avatarPreference || '').toLowerCase();
  if (pref === 'female') return 'female';
  if (pref === 'male') return 'male';
  const s = String(p?.sex || p?.gender || '').toLowerCase();
  return s === 'female' ? 'female' : 'male';
};

function SectionLabel({ children }) {
  return (
    <div style={{ textAlign: 'center', font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.28em', marginBottom: 5 }}>{children}</div>
  );
}

export default function FightModeHub({ onHome, onBack, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning, onTrainingCamp }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const needsGate = isBeginner && !hasCompletedFirstLesson();
  void onCombatConditioning;

  const [disc, setDisc] = useState('Boxing');
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState(false);

  const goMode = async (key) => {
    if (key === 'training_camp') { onTrainingCamp?.(disc); return; }
    if (key === 'practice') {
      if (onPractice) onPractice(disc);
      else { setToast(true); setTimeout(() => setToast(false), 2200); }
      return;
    }
    if (needsGate) { onStartHere?.(disc); return; }
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    if (key === 'fight_focus') onFightFocus?.(disc);
    else if (key === 'combo_coach') onComboCoach?.(disc);
  };

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.22}/>
      <Embers count={3}/>

      <TrainingHeader
        title="FIGHT MODE"
        subtitle="Train. Fight. Win."
        onHome={onHome}
        showBack
        onBack={onBack}
        rightSlot={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SafeImage src="/static/title-fight.png" alt="Fight Mode" style={{ height: 26, width: 'auto', display: 'block' }}/><HelpButton onClick={() => setHelpOpen(true)}/></div>}
      />

      {/* Locked viewport — fits without scrolling */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 132px)', overflow: 'hidden',
        padding: '12px 14px 0',
      }}>

        {/* Select discipline — the ⓘ guide lives in the header's right slot */}
        <SectionLabel>SELECT DISCIPLINE</SectionLabel>
        <div style={{ textAlign: 'center', font: "900 24px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.08em', textShadow: '0 0 16px rgba(253,224,71,0.4)', marginBottom: 9, flexShrink: 0 }}>FIGHT MODE</div>

        {/* Slightly smaller cards (four mode rows now live below) so the page
            breathes and keeps ~10–15% clear space above the tab bar. */}
        <div data-guide="fh-disciplines" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 13, flexShrink: 0, width: '100%', maxWidth: 272, marginLeft: 'auto', marginRight: 'auto' }}>
          {DISCIPLINES.map(d => {
            const active = d.id === disc;
            return (
              <button key={d.id} onClick={() => setDisc(d.id)} style={{
                position: 'relative', aspectRatio: '1 / 0.88', borderRadius: 13, overflow: 'hidden', padding: 0, cursor: 'pointer',
                border: `1.5px solid ${active ? 'rgba(253,224,71,0.85)' : 'rgba(168,85,247,0.28)'}`,
                boxShadow: active ? '0 0 26px rgba(253,224,71,0.3)' : '0 2px 12px rgba(0,0,0,0.4)',
                background: 'radial-gradient(ellipse at 50% 30%, rgba(60,20,90,0.5), rgba(12,3,24,0.95) 70%)',
              }}>
                <SafeImage src={discImg(d.key, variant)} fallbackSrc={discImg(d.key, 'male')} preferWebp={false} alt={d.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }}/>
                {/* Blue text banner */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 8px 9px', textAlign: 'center',
                  background: active
                    ? 'linear-gradient(to top, rgba(37,78,163,0.96) 0%, rgba(37,78,163,0.62) 52%, rgba(37,78,163,0) 100%)'
                    : 'linear-gradient(to top, rgba(24,52,118,0.94) 0%, rgba(24,52,118,0.55) 52%, rgba(24,52,118,0) 100%)',
                  borderTop: active ? '1px solid rgba(253,224,71,0.5)' : '1px solid rgba(96,140,220,0.4)',
                }}>
                  <div style={{ font: "900 13px 'Orbitron',sans-serif", color: active ? GOLD : '#fff', letterSpacing: '0.05em', textShadow: active ? '0 0 10px rgba(253,224,71,0.4)' : '0 1px 4px rgba(0,0,0,0.8)' }}>{d.label}</div>
                  <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: active ? 'rgba(253,224,71,0.9)' : 'rgba(224,235,255,0.92)', marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{d.sub}</div>
                </div>
                {active && <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: GOLD, color: '#0a0014', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(253,224,71,0.7)' }}><Check size={13} strokeWidth={3}/></div>}
              </button>
            );
          })}
        </div>

        {/* Choose mode */}
        <SectionLabel>CHOOSE MODE</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {MODES.map(m => {
            const accent = m.gold ? GOLD : VIOLET;
            const Icon = m.Icon;
            return (
              <button key={m.key} data-tour={m.key === 'training_camp' ? 'mode-camp' : undefined} data-guide={m.key === 'training_camp' ? 'fh-camp' : m.key === 'fight_focus' ? 'fh-fight-focus' : m.key === 'combo_coach' ? 'fh-combo' : 'fh-practice'} onClick={() => goMode(m.key)} style={{
                display: 'flex', alignItems: 'center', gap: 11, borderRadius: 12, padding: '9px 13px', cursor: 'pointer', textAlign: 'left',
                background: 'rgba(16,4,30,0.82)',
                border: `1px solid ${m.gold ? 'rgba(253,224,71,0.45)' : 'rgba(168,85,247,0.4)'}`,
                boxShadow: m.gold ? '0 0 16px rgba(253,224,71,0.14)' : '0 0 14px rgba(168,85,247,0.12)',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: m.gold ? 'rgba(253,224,71,0.1)' : 'rgba(168,85,247,0.1)', border: `1px solid ${m.gold ? 'rgba(253,224,71,0.3)' : 'rgba(168,85,247,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={accent}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: "900 14px 'Orbitron',sans-serif", color: accent, letterSpacing: '0.06em' }}>{m.title}</span>
                    {m.badge && <span style={{ font: "700 7px 'Orbitron',sans-serif", color: GOLD, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 4, padding: '2px 6px' }}>{m.badge}</span>}
                  </div>
                  <div style={{ font: "500 10.5px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 2, lineHeight: 1.25 }}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#c9a6ff', zIndex: 20, whiteSpace: 'nowrap' }}>Practice Mode preview — coming soon.</div>}

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fight_hub} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
