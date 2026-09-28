import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import TrainingHeader from './TrainingHeader';
import { ChevronRight, Flame } from 'lucide-react';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile } from './data/userProfile';
import { loadCampProgress } from './data/campProgress';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { FightBackdrop } from './shared/FightTimerKit';
import ModeTabs from './shared/ModeTabs';
import DisciplineTabs, { useDiscipline } from './shared/DisciplineTabs';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';

// Fight Mode hub — the Simplify revamp layout, royal blue and gold.
//
// Four numbered ways to train, ordered from least to most structure: a plain
// round timer, coached rounds, called combos, then the 12-stage camp. Practice
// Mode sits under them as its own card because it teaches rather than trains.
//
// The discipline tabs above drive every row: the choice persists to the
// profile and each mode reads it.
const RED = '#ef4444';

const BANNERS = [
  { key: 'just_train', n: '01', title: 'JUST TRAIN', sub: 'Flexible fight timer · Fast start · Saved presets', art: '/static/revamp/just-train-banner.png', pos: '80% 50%', guide: 'fh-just-train' },
  { key: 'fight_focus', n: '02', title: 'FIGHT FOCUS', sub: 'Timer + guided round objectives', art: '/static/revamp/fight-focus-banner.png', pos: '50% 30%', guide: 'fh-fight-focus' },
  // The combo-coach art is already blue, so it skips the hue shift the other
  // violet-toned banners get.
  { key: 'combo_coach', n: '03', title: 'COMBO COACH', sub: 'Called combos · Defense · Movement · Footwork', art: '/static/revamp/combo-coach-banner.png', pos: '100% 35%', noShift: true, guide: 'fh-combo' },
  { key: 'training_camp', n: '04', title: 'TRAINING CAMP', sub: 'Structured fight progression · Stages · Title path', art: '/static/fight-hub/training-camp.webp', pos: '60% 50%', camp: true, guide: 'fh-camp', tour: 'mode-camp' },
];

// Art sits dimmed and shifted toward blue until the row is pointed at, then
// brightens and the border turns gold. The banners were painted violet for the
// old theme; the hue shift is the design's way of reusing them.
const hubCSS = `
.fb { position: relative; height: 84px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(61,123,255,.4); background: #070B1C; display: block; width: 100%; padding: 0; text-align: left; cursor: pointer; flex-shrink: 0;
  transition: border-color .2s, box-shadow .2s, transform .12s; -webkit-tap-highlight-color: transparent; }
.fb img { opacity: .5; filter: hue-rotate(-48deg) saturate(1.15) brightness(.75); transition: opacity .25s, filter .25s, transform .25s; }
.fb.no-shift img { filter: brightness(.75); }
.fb .scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5,8,20,.97) 0%, rgba(5,8,20,.82) 50%, rgba(5,8,20,.15) 100%); transition: opacity .25s; }
.fb:hover, .fb:focus-visible { border-color: #F2BE45; box-shadow: 0 0 0 1px rgba(242,190,69,.35), 0 0 22px rgba(61,123,255,.55), 0 0 14px rgba(242,190,69,.3); }
.fb:hover img, .fb:focus-visible img { opacity: 1; filter: hue-rotate(-48deg) saturate(1.3) brightness(1.1); transform: scale(1.03); }
.fb.no-shift:hover img, .fb.no-shift:focus-visible img { filter: saturate(1.2) brightness(1.1); }
.fb:hover .scrim, .fb:focus-visible .scrim { opacity: .75; }
.fb:hover .fb-n, .fb:focus-visible .fb-n, .fb:hover .fb-go, .fb:focus-visible .fb-go { color: #F2BE45 !important; }
.fb:active { transform: scale(.99); }
.prac { transition: border-color .2s, box-shadow .2s; }
.prac img { opacity: .55; transition: opacity .25s, transform .25s, filter .25s; }
.prac:hover, .prac:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 18px rgba(157,108,255,.4); }
.prac:hover img, .prac:focus-visible img { opacity: 1; transform: scale(1.08); filter: drop-shadow(0 0 8px rgba(168,85,247,.7)) drop-shadow(0 0 6px rgba(242,190,69,.5)); }
.cond { transition: border-color .2s; }
.cond:hover, .cond:focus-visible { border-color: #F2BE45 !important; }
`;

export default function FightModeHub({ onHome, onBack, onFitMode, onJustTrain, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning, onTrainingCamp }) {
  const profile = loadProfile();
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const needsGate = isBeginner && !hasCompletedFirstLesson();

  // The chosen discipline persists to the profile and drives every feature
  // below (call sets, opponent art, lesson lists).
  const [disc, pickDisc] = useDiscipline();

  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState(false);

  const campStage = Math.min(loadCampProgress(), 12);

  const goMode = async (key) => {
    if (key === 'training_camp') { onTrainingCamp?.(disc); return; }
    if (key === 'conditioning') { onCombatConditioning?.(); return; }
    if (key === 'practice') {
      if (onPractice) onPractice(disc);
      else { setToast('Practice Mode preview — coming soon.'); setTimeout(() => setToast(false), 2200); }
      return;
    }
    // Beginners who haven't done their first lesson go to Start Here first —
    // the same rule for all three timers, Just Train included.
    if (needsGate) { onStartHere?.(disc); return; }
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    if (key === 'just_train') onJustTrain?.(disc);
    else if (key === 'fight_focus') onFightFocus?.(disc);
    else if (key === 'combo_coach') onComboCoach?.(disc);
  };

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>

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

        {/* Fit / Fight is a tab switch now, not a screen you back out to. */}
        <div style={{ flexShrink: 0, padding: '0 14px' }}>
          <ModeTabs active="fight" onFit={onFitMode}/>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 14px 0', paddingBottom: 'calc(max(96px, 15dvh) + env(safe-area-inset-bottom, 0px))' }}>

        <DisciplineTabs value={disc} onChange={pickDisc} guide="fh-disciplines" style={{ marginBottom: 14 }}/>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {BANNERS.map(b => (
            <button key={b.key} type="button" className={`fb${b.noShift ? ' no-shift' : ''}`} data-tour={b.tour} data-guide={b.guide} onClick={() => goMode(b.key)}>
              <SafeImage src={b.art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos }}/>
              <div className="scrim"/>
              <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: '0 12px 0 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="fb-n" style={{ font: "700 13px 'Chakra Petch',sans-serif", color: '#3D7BFF', alignSelf: 'flex-start', marginTop: 14 }}>{b.n}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ font: "700 19px 'Chakra Petch',sans-serif", letterSpacing: '0.08em', color: '#fff', textShadow: '0 0 14px rgba(61,123,255,0.7)' }}>{b.title}</span>
                  <span style={{ fontSize: 13, color: '#C9D4EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.sub}</span>
                  {b.camp && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${Math.round((campStage / 12) * 100)}%`, height: '100%', background: '#F2BE45' }}/>
                      </span>
                      <span style={{ fontSize: 11, color: '#F2BE45' }}>Stage {campStage} / 12</span>
                    </span>
                  )}
                </span>
                <ChevronRight className="fb-go" size={20} color="#8FB4FF"/>
              </div>
            </button>
          ))}
        </div>

        {/* Practice teaches rather than trains, so it's a quieter card under
            the four ways to train: the book stays dim until pointed at. */}
        <button type="button" className="prac" data-guide="fh-practice" onClick={() => goMode('practice')} style={{
          marginTop: 8, height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
          background: '#0B0F1F', border: '1px dashed rgba(143,180,255,0.55)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
        }}>
          <SafeImage src="/static/revamp/practice-book.webp" alt="" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}/>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: "700 15px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', color: '#fff' }}>PRACTICE MODE</span>
            <span style={{ display: 'block', fontSize: 13, color: '#A9B4D6' }}>Learn &amp; drill techniques</span>
          </span>
          <span style={{ font: "600 9.5px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', padding: '4px 7px', border: '1px solid rgba(143,180,255,0.5)', color: '#8FB4FF' }}>SKILLS</span>
        </button>

        {/* Combat Conditioning stays reachable here. The design moves it to
            Home's Quick Access, which isn't built yet — removing it now would
            leave it with no door on the Fight side. */}
        <button type="button" className="cond" data-guide="fh-conditioning" onClick={() => goMode('conditioning')} style={{
          marginTop: 8, height: 44, flexShrink: 0, borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#120A14', border: '1px solid rgba(239,68,68,0.4)',
        }}>
          <Flame size={16} color={RED}/>
          <span style={{ flex: 1, font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: RED }}>COMBAT CONDITIONING</span>
          <span style={{ fontSize: 12, color: '#A9A3C4' }}>Fit × fight blend</span>
        </button>
        </div>
      </div>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 120, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#c9a6ff', zIndex: 20, whiteSpace: 'nowrap' }}>{toast}</div>}

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fight_hub} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
