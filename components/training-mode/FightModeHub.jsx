import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';
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
.fb { position: relative; height: 68px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(61,123,255,.4); background: #070B1C; display: block; width: 100%; padding: 0; text-align: left; cursor: pointer; flex-shrink: 0;
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
/* The two skill tiles under the ladder. Practice's art stays dimmed even when
   pointed at (owner call) — only the frame answers the hover. */
.ft { position: relative; overflow: hidden; border-radius: 14px; cursor: pointer; text-align: left; padding: 0; display: block; width: 100%; height: 100%;
  transition: border-color .2s, box-shadow .2s, transform .12s; -webkit-tap-highlight-color: transparent; }
.ft img { transition: opacity .25s, filter .25s, transform .25s; }
.ft:hover, .ft:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 0 1px rgba(242,190,69,.3), 0 0 18px rgba(61,123,255,.4); }
.ft:active { transform: scale(.985); }
.ft.prac img { opacity: .35; filter: brightness(.7) saturate(.85); }
.ft.prac .ft-book img { opacity: 1; filter: drop-shadow(0 0 8px rgba(168,85,247,.6)); transition: transform .25s, filter .25s; }
.ft.prac:hover .ft-book img, .ft.prac:focus-visible .ft-book img { transform: scale(1.08); filter: drop-shadow(0 0 10px rgba(168,85,247,.8)) drop-shadow(0 0 6px rgba(242,190,69,.5)); }
.ft.cond img { opacity: .45; filter: brightness(.7); }
.ft.cond:hover img, .ft.cond:focus-visible img { opacity: .85; filter: brightness(1); transform: scale(1.03); }
.ft:hover .ft-go, .ft:focus-visible .ft-go { color: #F2BE45 !important; }
.fh-q { transition: color .18s; }
.fh-q:hover, .fh-q:focus-visible { color: #F2BE45 !important; }
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

        {/* The same header as the Fit hub: back · wordmark · ? · home. The
            TT logo and its subtitle line are gone; the discipline tabs below
            already say which discipline you're on. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 12px', flexShrink: 0 }}>
          <button onClick={onBack} aria-label="Back" className="fh-q" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a9bff0', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={22}/></button>
          <div style={{ flex: 1 }}><SafeImage src="/static/title-fight.png" alt="Fight Mode" style={{ height: 30, width: 'auto', maxWidth: '100%', display: 'block' }}/></div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
          <button onClick={onHome} aria-label="Home" className="fh-q" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a9bff0', display: 'flex', padding: 0 }}><Home size={18}/></button>
        </div>

        {/* Fit / Fight is a tab switch now, not a screen you back out to. */}
        <div style={{ flexShrink: 0, padding: '0 14px' }}>
          <ModeTabs active="fight" onFit={onFitMode}/>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 14px 0', paddingBottom: 'calc(max(96px, 15dvh) + env(safe-area-inset-bottom, 0px))' }}>

        <DisciplineTabs value={disc} onChange={pickDisc} guide="fh-disciplines" style={{ marginBottom: 12 }}/>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
          {BANNERS.map(b => (
            <button key={b.key} type="button" className={`fb${b.noShift ? ' no-shift' : ''}`} data-tour={b.tour} data-guide={b.guide} onClick={() => goMode(b.key)}>
              <SafeImage src={b.art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos }}/>
              <div className="scrim"/>
              <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: '0 12px 0 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="fb-n" style={{ font: "700 13px 'Chakra Petch',sans-serif", color: '#3D7BFF', alignSelf: 'flex-start', marginTop: 12 }}>{b.n}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.08em', color: '#fff', textShadow: '0 0 14px rgba(61,123,255,0.7)' }}>{b.title}</span>
                  <span style={{ fontSize: 12, color: '#C9D4EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.sub}</span>
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

        {/* Clear air between the four ways to train and the two skill tiles —
            stacked straight under Training Camp they read as one dense list. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 2px 10px', flexShrink: 0 }}>
          <span style={{ font: "600 10px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', color: '#6F7699' }}>SKILLS &amp; CONDITIONING</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(61,123,255,0.35), transparent)' }}/>
        </div>

        {/* Practice teaches, Combat Conditioning builds the engine: two
            side-by-side tiles, a step quieter than the ladder above. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, height: 108, flexShrink: 0 }}>
          <button type="button" className="ft prac" data-guide="fh-practice" onClick={() => goMode('practice')} style={{ background: '#0B0F1F', border: '1px dashed rgba(143,180,255,0.55)' }}>
            <SafeImage src="/static/fight-hub/practice.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '82% 50%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,8,20,0.1) 0%, rgba(5,8,20,0.85) 70%)' }}/>
            {/* The book, top-middle — Practice's mark. Full strength while the
                art behind it stays dimmed. */}
            <span className="ft-book" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 40, height: 40 }}>
              <SafeImage src="/static/revamp/practice-book.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            </span>
            <span style={{ position: 'absolute', left: 12, right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.08em', color: '#fff' }}>PRACTICE</span>
                <ChevronRight className="ft-go" size={16} color="#8FB4FF"/>
              </span>
              <span style={{ fontSize: 11.5, color: '#A9B4D6' }}>Learn &amp; drill techniques</span>
            </span>
          </button>
          <button type="button" className="ft cond" data-guide="fh-conditioning" onClick={() => goMode('conditioning')} style={{ background: '#120A14', border: '1px solid rgba(239,68,68,0.45)' }}>
            <SafeImage src="/static/revamp/combat-hero.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '100% 35%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,6,10,0.1) 0%, rgba(18,6,10,0.85) 70%)' }}/>
            <span style={{ position: 'absolute', left: 12, right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', color: RED }}>CONDITIONING</span>
                <ChevronRight className="ft-go" size={16} color={RED}/>
              </span>
              <span style={{ fontSize: 11.5, color: '#D4B0B0' }}>Fit × fight circuits</span>
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
