import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { Check } from 'lucide-react';
import TrainingHeader from './TrainingHeader';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile, saveProfile } from './data/userProfile';
import { loadCampProgress } from './data/campProgress';
import { totalMoveCount } from './data/customCombos';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';

// Fight Mode hub — designer rebuild: single non-scrolling banner stack.
// Palette: bg #080012 · gold #fde047 · violet #a855f7 · fight-red #ef4444.
// Top→bottom: red FIGHT MODE header → SELECT DISCIPLINE (4-across, persists
// to profile) → SELECT MODE banner stack (Camp featured 72px w/ STAGE pill +
// CONTINUE; Fight Focus / Combo Coach / Practice 64px) → two-up utility row
// (MOVE LAB gold · CONDITIONING red, cross-listed from Fit). Art sits dimmed
// (brightness .68) and brightens with its border on press. Fits 812px with
// ~15% breathing room above the footer.
const GOLD = '#fde047';
const VIOLET = '#a855f7';
const RED = '#ef4444';

const DISCIPLINES = [
  { id: 'Boxing',     key: 'boxing',     label: 'BOXING' },
  { id: 'Kickboxing', key: 'kickboxing', label: 'KICKBOXING' },
  { id: 'Muay Thai',  key: 'muay_thai',  label: 'MUAY THAI' },
  { id: 'MMA',        key: 'mma',        label: 'MMA' },
];
const discImg = (key, variant) => `/discipline-cards/${key}_${variant}.webp`;

// Primary banner stack (heights per design: camp 72, others 64).
const BANNERS = [
  { key: 'training_camp', title: '⛺ TRAINING CAMP', sub: 'Climb 12 stages to the Title Fight', art: '/static/fight-hub/training-camp.webp', accent: RED, h: 72, featured: true, guide: 'fh-camp', tour: 'mode-camp' },
  { key: 'fight_focus',   title: '⏱️ FIGHT FOCUS',   sub: 'Round timer — fight-paced work & rest', art: '/static/fight-hub/fight-focus.webp', accent: VIOLET, h: 64, guide: 'fh-fight-focus' },
  { key: 'combo_coach',   title: '🥊 COMBO COACH',   sub: 'Called combos at cadence — hands up', art: '/static/fight-hub/combo-coach.webp', accent: VIOLET, labelColor: '#f87171', h: 64, guide: 'fh-combo' },
  { key: 'practice',      title: '📚 PRACTICE MODE', sub: 'Tutorials, fundamentals & form', art: '/static/fight-hub/practice.webp', accent: VIOLET, h: 64, guide: 'fh-practice' },
];

const getVariant = (p) => {
  const pref = String(p?.avatarPreference || '').toLowerCase();
  if (pref === 'female') return 'female';
  if (pref === 'male') return 'male';
  const s = String(p?.sex || p?.gender || '').toLowerCase();
  return s === 'female' ? 'female' : 'male';
};


const hubCSS = `
.fm-banner { transition: filter .18s ease, border-color .18s ease, box-shadow .18s ease, transform .12s ease; }
.fm-banner img { filter: brightness(0.68); transition: filter .18s ease; }
.fm-banner:hover img, .fm-banner:active img { filter: brightness(1); }
.fm-banner:active { transform: scale(0.985); }
.fm-tile { transition: border-color .15s ease, transform .12s ease; }
.fm-tile:active { transform: scale(0.96); }
`;

export default function FightModeHub({ onHome, onBack, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning, onTrainingCamp, onMoveLab }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const needsGate = isBeginner && !hasCompletedFirstLesson();

  // The chosen discipline persists to the profile and drives every feature
  // below (call sets, opponent art, lesson lists).
  const [disc, setDisc] = useState(() => loadProfile()?.discipline || 'Boxing');
  const pickDisc = (id) => {
    setDisc(id);
    try { saveProfile({ ...loadProfile(), discipline: id }); } catch { /* noop */ }
  };

  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState(false);

  const campStage = Math.min(loadCampProgress(), 12);
  const moves = totalMoveCount();

  const goMode = async (key) => {
    if (key === 'training_camp') { onTrainingCamp?.(disc); return; }
    if (key === 'conditioning') { onCombatConditioning?.(); return; }
    if (key === 'move_lab') { onMoveLab?.(disc); return; }
    if (key === 'practice') {
      if (onPractice) onPractice(disc);
      else { setToast('Practice Mode preview — coming soon.'); setTimeout(() => setToast(false), 2200); }
      return;
    }
    if (needsGate) { onStartHere?.(disc); return; }
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    if (key === 'fight_focus') onFightFocus?.(disc);
    else if (key === 'combo_coach') onComboCoach?.(disc);
  };

  // Left scrim keeps labels legible over the art (design spec).
  const SCRIM = 'linear-gradient(90deg, rgba(8,1,15,0.78) 30%, rgba(8,1,15,0.35) 60%)';

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.22}/>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>
      <Embers count={3}/>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', boxSizing: 'border-box', overflow: 'hidden' }}>

        {/* Standard app header (TT logo + title/subtitle left · avatar + ⓘ right) */}
        <div style={{ flexShrink: 0 }}>
          <TrainingHeader
            title="FIGHT MODE"
            subtitle={`${disc} · skill, rounds & combos`}
            onHome={onHome}
            showBack
            onBack={onBack}
            rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 14px 0', paddingBottom: 'calc(max(96px, 15dvh) + env(safe-area-inset-bottom, 0px))' }}>

        {/* SELECT DISCIPLINE — 4-across, selection persists */}
        <div style={{ textAlign: 'center', font: "700 12px 'Orbitron',sans-serif", color: '#d9cdf0', letterSpacing: '0.3em', marginBottom: 8, flexShrink: 0 }}>‹ SELECT DISCIPLINE ›</div>
        <div data-guide="fh-disciplines" style={{ display: 'flex', gap: 6, flexShrink: 0, marginBottom: 44 }}>
          {DISCIPLINES.map(d => {
            const on = d.id === disc;
            return (
              <button key={d.id} className="fm-tile" onClick={() => pickDisc(d.id)} style={{
                flex: 1, position: 'relative', borderRadius: 11, overflow: 'hidden', padding: 0, cursor: 'pointer',
                aspectRatio: '0.74', background: '#0a0014',
                border: on ? `2px solid ${GOLD}` : '1.5px solid rgba(168,85,247,0.35)',
                boxShadow: on ? '0 0 14px rgba(253,224,71,0.35)' : 'none',
              }}>
                <SafeImage src={discImg(d.key, variant)} alt={d.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', filter: on ? 'none' : 'brightness(0.62)' }}/>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 2px 6px', background: 'linear-gradient(to top, rgba(5,0,12,0.94), transparent)' }}>
                  <div style={{ font: "900 12px 'Orbitron',sans-serif", color: on ? GOLD : '#fff', letterSpacing: '0.02em', textAlign: 'center', textShadow: on ? '0 0 10px rgba(253,224,71,0.45)' : '0 1px 4px rgba(0,0,0,0.85)' }}>{d.label}</div>
                </div>
                {on && <span style={{ position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="#0a0014" strokeWidth={3.5}/></span>}
              </button>
            );
          })}
        </div>

        {/* SELECT MODE — the banner stack */}
        <div style={{ textAlign: 'center', font: "700 12px 'Orbitron',sans-serif", color: '#d9cdf0', letterSpacing: '0.3em', marginBottom: 8, flexShrink: 0 }}>‹ SELECT MODE ›</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {BANNERS.map(b => (
            <button key={b.key} className="fm-banner" data-tour={b.tour} data-guide={b.guide} onClick={() => goMode(b.key)} style={{
              position: 'relative', overflow: 'hidden', height: b.h, borderRadius: 13, padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%', flexShrink: 0,
              background: '#0c0118',
              border: `1.5px solid ${b.featured ? 'rgba(239,68,68,0.5)' : `${b.accent}59`}`,
              boxShadow: b.featured ? '0 0 18px rgba(239,68,68,0.28)' : `0 0 12px ${b.accent}1f`,
            }}>
              <SafeImage src={b.art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center' }}/>
              <div style={{ position: 'absolute', inset: 0, background: SCRIM }}/>
              {/* Label block — left-aligned, vertically centred */}
              <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', zIndex: 2, maxWidth: '72%' }}>
                <div style={{ font: `900 ${b.featured ? 15 : 14}px 'Orbitron',sans-serif`, color: b.labelColor || (b.featured ? RED : b.accent), letterSpacing: '0.05em', textShadow: '0 1px 8px rgba(0,0,0,0.85)' }}>{b.title}</div>
                <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#e3d8f5', marginTop: 2, textShadow: '0 1px 4px rgba(0,0,0,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.sub}</div>
                {b.featured && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, background: RED, color: '#fff', font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.08em', borderRadius: 7, padding: '4px 10px', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}>▶ CONTINUE</span>
                )}
              </div>
              {b.featured && (
                <span style={{ position: 'absolute', top: 7, right: 9, zIndex: 2, background: GOLD, color: '#2a1400', font: "900 8px 'Orbitron',sans-serif", letterSpacing: '0.06em', borderRadius: 7, padding: '3px 8px' }}>STAGE {campStage} / 12</span>
              )}
            </button>
          ))}
        </div>

        {/* Two-up utility row — secondary: MOVE LAB (gold) + CONDITIONING (red, cross-listed from Fit) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexShrink: 0 }}>
          <button data-tour="mode-movelab" data-guide="fh-movelab" onClick={() => goMode('move_lab')} style={{ flex: 1, height: 44, borderRadius: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', background: 'rgba(30,20,4,0.55)', border: '1px solid rgba(253,224,71,0.4)' }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', font: "900 9.5px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.05em' }}>MOVE LAB</span>
              <span style={{ display: 'block', font: "600 8px 'Rajdhani',sans-serif", color: '#b9a8d6' }}>Custom combos · 🎮 {moves} moves</span>
            </span>
          </button>
          <button data-guide="fh-conditioning" onClick={() => goMode('conditioning')} style={{ flex: 1, height: 44, borderRadius: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', background: 'rgba(34,6,10,0.55)', border: '1px solid rgba(239,68,68,0.45)' }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', font: "900 9.5px 'Orbitron',sans-serif", color: RED, letterSpacing: '0.05em' }}>CONDITIONING</span>
              <span style={{ display: 'block', font: "600 8px 'Rajdhani',sans-serif", color: '#b9a8d6' }}>Fit × fight blend</span>
            </span>
          </button>
        </div>
        </div>
      </div>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#c9a6ff', zIndex: 20, whiteSpace: 'nowrap' }}>{toast}</div>}

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fight_hub} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
