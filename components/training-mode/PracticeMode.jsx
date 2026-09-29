import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import DisciplineTabs, { useDiscipline } from './shared/DisciplineTabs';
import { FightBackdrop } from './shared/FightTimerKit';
import PracticeRound from './PracticeRound';
import { addStartHereLesson, addPracticeSession, addPracticeWeeklyBonus } from './data/userStats';
import { loadProfile, isBeginnerLearner } from './data/userProfile';
import { primeSpeech, setVoiceGender, speakAsync, cancelSpeech, stopVoiceSession, delay } from './voiceCoach';
import { PRACTICE_DISCIPLINES, PRACTICE_CATEGORIES, TECHNIQUES } from './practiceData';
import { addLearned } from './data/arsenal';
import { numberForStrike } from './data/strikeNumbering';
import {
  basicsFor, getCompletedLessons, markLessonComplete, getLibraryDrilled, markLibraryDrilled,
} from './data/practiceLessons';
import { buildRound, planLine } from './data/practiceRound';
import { claimWeeklyBonus, notePracticed } from './data/practiceInvite';

// Practice Mode — simplified to one screen in the Simplify revamp
// (Practice.dc.html): Continue Learning banner, the Fundamentals Path as a
// 7-dot stepper, and the Technique Library as a two-column grid. Every
// lesson and technique opens one centred card, and its START PRACTICE ROUND
// runs a round built from what the athlete has learned (PracticeRound.jsx).
// That round replaces the old Shadowbox and Combo drills; DRILL A COMBO now
// goes to Combo Coach, the app's real combo caller.

const GOLD = '#F2BE45';
const SOFT = '#A9B4D6';
const LEVEL = { Beginner: ['BEGINNER', '#4ADE80'], Intermediate: ['INTERMEDIATE', GOLD], Advanced: ['ADVANCED', '#F87171'] };
const SHOW = 6;

// Avatar (male/female banner) follows the profile's avatarPreference, else sex.
const getVariant = (p) => {
  const pref = String(p?.avatarPreference || '').toLowerCase();
  if (pref === 'female' || pref === 'male') return pref;
  const s = String(p?.sex || p?.gender || '').toLowerCase();
  return s === 'female' ? 'female' : 'male';
};
const SLUG = { Boxing: 'boxing', Kickboxing: 'kickboxing', 'Muay Thai': 'muaythai', MMA: 'mma' };
const bannerSrc = (disc, variant) => `/static/revamp/practice/${variant === 'female' ? 'f' : 'm'}-${SLUG[disc] || 'boxing'}.webp`;

// ─── Technique Library helpers ─────────────────────────────────────────────────
// Defense and footwork carry over from the simpler disciplines: Muay Thai
// lists boxing's slips as well as its own checks.
const DEFENSE_FOOTWORK_INCLUDES = {
  Boxing: ['Boxing'],
  Kickboxing: ['Boxing', 'Kickboxing'],
  'Muay Thai': ['Boxing', 'Kickboxing', 'Muay Thai'],
  MMA: ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'],
};

function getTechniquesFor(discipline, category) {
  if (category === 'Strikes') return TECHNIQUES.filter(t => t.discipline === discipline && t.category === 'Strikes');
  const seen = new Set();
  const result = [];
  for (const src of DEFENSE_FOOTWORK_INCLUDES[discipline] || [discipline]) {
    for (const t of TECHNIQUES) {
      if (t.discipline === src && t.category === category && !seen.has(t.name)) { seen.add(t.name); result.push(t); }
    }
  }
  return result;
}

// The card's kind badge: PUNCH / KICK / KNEE / ELBOW for strikes.
function badgeForTech(t) {
  if (t.category !== 'Strikes') return String(t.category).toUpperCase().replace(/S$/, '');
  const n = t.name.toLowerCase();
  if (/knee/.test(n)) return 'KNEE';
  if (/elbow/.test(n)) return 'ELBOW';
  if (/kick|teep|roundhouse|\bcheck\b/.test(n)) return 'KICK';
  return 'PUNCH';
}

// Tile badge: the gym number when the move has one (1 = jab …), otherwise
// the move's initials.
const tileMark = (name) => numberForStrike(name) || name.split(/[\s-]+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();

const techCall = (name) => name.toUpperCase();

// ─── Styles ────────────────────────────────────────────────────────────────────
const css = `
.pm-hit { transition: border-color .18s ease, color .18s ease, box-shadow .18s ease, filter .18s ease; }
.pm-hit:hover, .pm-hit:focus-visible { border-color: ${GOLD} !important; }
.pm-tile:hover, .pm-tile:focus-visible { border-color: ${GOLD} !important; box-shadow: 0 0 14px rgba(61,123,255,.4); }
.pm-txt:hover, .pm-txt:focus-visible { color: ${GOLD} !important; }
.pm-banner:hover, .pm-banner:focus-visible { box-shadow: 0 0 22px rgba(168,85,247,.5); }
.pm-gold:hover, .pm-gold:focus-visible { filter: brightness(1.1); }
.pm-hit:active, .pm-tile:active { transform: scale(0.98); }
.pm-grid { scrollbar-width: thin; scrollbar-color: rgba(143,180,255,.35) transparent; }
@keyframes pm-toast-in { from { opacity: 0; transform: translate(-50%, 10px) } to { opacity: 1; transform: translate(-50%, 0) } }
@keyframes pm-cue-glow { 0%, 100% { box-shadow: 0 0 10px rgba(242,190,69,0.3) } 50% { box-shadow: 0 0 20px rgba(242,190,69,0.55) } }
`;
const label = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: SOFT };
const Play = ({ size = 11, style }) => <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, fill: 'currentColor', ...style }}><path d="M7 4l13 8-13 8z"/></svg>;

// ─── Lesson / technique card (centred modal) ──────────────────────────────────
// The design draws a video player here. There are no lesson videos yet, so
// the player area is the title card for the step-by-step guide, and its play
// button reads the key points aloud — the guide it promises, for real.
function DetailCard({ detail, profile, roundLine, onClose, onStartRound }) {
  const [activeCue, setActiveCue] = useState(-1);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const keyPoints = useMemo(() => detail.keyPoints || [], [detail]);
  const mistakes = detail.mistakes || [];

  const stopReading = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    setActiveCue(-1);
    cancelSpeech();
  }, []);

  useEffect(() => () => { readingRef.current = false; stopVoiceSession(); }, []);

  const toggleRead = useCallback(async () => {
    if (readingRef.current) { stopReading(); return; }
    readingRef.current = true;
    setReading(true);
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    try { await primeSpeech(); } catch { /* ignore */ }
    for (let i = 0; i < keyPoints.length; i++) {
      if (!readingRef.current) break;
      setActiveCue(i);
      await speakAsync(`${i + 1}. ${keyPoints[i]}`, { rate: 0.8, pitch: 1.0 });
      if (!readingRef.current) break;
      await delay(320);
    }
    if (readingRef.current) { readingRef.current = false; setReading(false); setActiveCue(-1); }
  }, [keyPoints, profile, stopReading]);

  const close = () => { stopReading(); onClose(); };
  const progress = reading && keyPoints.length ? ((activeCue + 1) / keyPoints.length) * 100 : 0;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 200 }}>
      <button type="button" aria-label="Close" onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(3,2,8,.78)', border: 0, backdropFilter: 'blur(3px)', cursor: 'default' }}/>
      <div role="dialog" aria-modal="true" aria-label={detail.title} style={{
        position: 'absolute', left: 14, right: 14, top: '50%', transform: 'translateY(-50%)', maxHeight: 'calc(100dvh - 28px)',
        boxSizing: 'border-box', borderRadius: 18, overflow: 'hidden', background: '#0A0716', color: '#fff',
        border: '1.5px solid rgba(168,85,247,.6)', boxShadow: '0 0 30px rgba(168,85,247,.35), 0 24px 60px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <div style={{
          position: 'relative', aspectRatio: '16 / 9', flexShrink: 0, maxHeight: '32dvh',
          background: 'repeating-linear-gradient(135deg, #1A1030 0 16px, #150C28 16px 32px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <button type="button" className="pm-hit pm-txt" aria-label="Close" onClick={close} style={{
            position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.5)',
            border: '1px solid rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', fontSize: 14,
          }}>✕</button>
          <span style={{
            position: 'absolute', top: 10, left: 10, font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(196,168,255,.6)', color: '#D2BCFF', background: 'rgba(0,0,0,.4)',
          }}>{detail.badge}</span>
          {keyPoints.length > 0 && (
            <button type="button" className="pm-gold" aria-label={reading ? 'Stop the guide' : 'Play the step-by-step guide'} onClick={toggleRead} style={{
              width: 58, height: 58, borderRadius: '50%', border: 0, cursor: 'pointer', color: '#1A1204',
              background: 'linear-gradient(180deg,#FFE9A8,#F2BE45 55%,#C98A1C)', boxShadow: '0 0 24px rgba(242,190,69,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {reading
                ? <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 2, background: 'currentColor' }}/>
                : <Play size={22} style={{ marginLeft: 3 }}/>}
            </button>
          )}
          <span style={{ font: "700 20px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', textAlign: 'center', padding: '0 44px' }}>{detail.title.toUpperCase()}</span>
          <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#C4A8FF' }}>
            STEP-BY-STEP GUIDE · {keyPoints.length} STEPS
          </span>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,.1)' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: GOLD, transition: 'width .3s ease' }}/>
          </div>
        </div>

        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flexGrow: 1, fontSize: 13, color: '#A9A3C4' }}>{detail.description}</span>
            {keyPoints.length > 0 && (
              <button type="button" className="pm-hit pm-txt" onClick={toggleRead} style={{
                height: 30, padding: '0 9px', borderRadius: 7, flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                background: reading ? 'rgba(242,190,69,.12)' : 'transparent',
                border: `1px solid ${reading ? 'rgba(242,190,69,.7)' : 'rgba(196,168,255,.5)'}`, color: reading ? GOLD : '#D2BCFF',
                font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
              }}>{reading ? '■ STOP' : '🔊 READ ALOUD'}</button>
            )}
          </div>

          {keyPoints.length > 0 && <span style={{ ...label, color: '#C4A8FF' }}>KEY POINTS</span>}
          {keyPoints.map((c, i) => {
            const on = activeCue === i;
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, padding: '6px 12px', borderRadius: 9, boxSizing: 'border-box',
                background: on ? 'rgba(242,190,69,.12)' : '#0F0B1F', border: `1px solid ${on ? 'rgba(242,190,69,.9)' : 'rgba(168,85,247,.28)'}`,
                fontSize: 13, lineHeight: 1.25, animation: on ? 'pm-cue-glow 1.3s ease-in-out infinite' : 'none',
                transition: 'background .2s ease, border-color .2s ease',
              }}>
                <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: GOLD, flexShrink: 0 }}>{i + 1}</span>{c}
              </div>
            );
          })}

          {mistakes.length > 0 && (
            <>
              <span style={{ ...label, color: '#F87171' }}>WATCH FOR</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {mistakes.map(m => (
                  <span key={m} style={{ minHeight: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', boxSizing: 'border-box', borderRadius: 7, background: '#1A0A12', border: '1px solid rgba(239,68,68,.35)', fontSize: 12 }}>
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>✕</span>{m}
                  </span>
                ))}
              </div>
            </>
          )}

          <button type="button" className="pm-gold" data-guide="pm-start-round" onClick={() => { stopReading(); onStartRound(); }} style={{
            marginTop: 2, height: 52, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            border: 0, cursor: 'pointer', color: '#1A1204', fontFamily: "'Chakra Petch',sans-serif",
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            background: 'linear-gradient(180deg,#FFE9A8,#F2BE45 50%,#C98A1C)',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.16em' }}>🥊 START PRACTICE ROUND</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75 }}>{roundLine}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PracticeMode({ openLesson = false, onBack, onComboCoach }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  // A "beginner learner" (told onboarding they're new AND want to learn
  // combat) must finish the practice round for a lesson to count; everyone
  // else completes a lesson by opening it.
  const mustDrill = isBeginnerLearner(profile);

  // The discipline shared with the Fight hub and Combat Conditioning. There
  // is no per-caller override: Home opened Practice with none, and the old
  // 'Boxing' default then quietly reset everyone's tab. A caller that wants
  // a discipline saves it to the profile first (App's goPracticeLesson).
  const [stored, pickStored] = useDiscipline();
  const discipline = PRACTICE_DISCIPLINES.includes(stored) ? stored : 'Boxing';

  const [category, setCategory] = useState('Strikes');
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState(null);   // the open card
  const [round, setRound] = useState(null);     // the open Practice Round
  const [toast, setToast] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [completed, setCompleted] = useState(() => getCompletedLessons());
  const [drilled, setDrilled] = useState(() => getLibraryDrilled(discipline));
  useEffect(() => { setDrilled(getLibraryDrilled(discipline)); }, [discipline]);

  const flash = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);

  const basics = useMemo(() => basicsFor(discipline), [discipline]);
  const doneCount = basics.filter(l => completed.includes(l.id)).length;
  const nextIndex = basics.findIndex(l => !completed.includes(l.id));
  const current = nextIndex >= 0 ? nextIndex : basics.length - 1;
  const techniques = getTechniquesFor(discipline, category);
  const shown = showAll ? techniques : techniques.slice(0, SHOW);

  // Bank strikes into the arsenal and say so.
  const bankArsenal = useCallback((name) => {
    const gained = addLearned(discipline, name);
    if (gained.length) flash(`${gained.map(s => s.toUpperCase()).join(' + ')} ADDED TO YOUR ARSENAL`);
  }, [discipline, flash]);

  const completeBasic = useCallback((lesson) => {
    if (!lesson || getCompletedLessons().includes(lesson.id)) return;
    markLessonComplete(lesson.id);
    addStartHereLesson(lesson.title);
    setCompleted(getCompletedLessons());
    bankArsenal(lesson.title);
    const bonus = claimWeeklyBonus();
    if (bonus) { addPracticeWeeklyBonus(bonus); flash(`WEEKLY LESSON DONE · +${bonus} XP`); }
  }, [bankArsenal, flash]);

  // What a card's practice round would be, from what's learned so far.
  const roundFor = useCallback((d) => {
    if (d.kind === 'basic') {
      const i = basics.findIndex(l => l.id === d.lessonId);
      const lesson = basics[i];
      const learned = doneCount + (completed.includes(lesson.id) ? 0 : 1) + drilled.length;
      return {
        focus: { id: lesson.id, name: lesson.title, calls: lesson.calls, keyPoints: lesson.steps },
        prior: basics.slice(0, i).map(l => ({ name: l.title, calls: l.calls })),
        learned, lessonId: lesson.id,
      };
    }
    const list = getTechniquesFor(discipline, d.category);
    const i = list.findIndex(t => t.name === d.title);
    const learned = doneCount + drilled.length + (drilled.includes(d.title) ? 0 : 1);
    return {
      focus: { name: d.title, calls: [techCall(d.title), `${techCall(d.title)} × 2`], keyPoints: d.keyPoints },
      prior: list.slice(Math.max(0, i - 3), Math.max(0, i)).map(t => ({ name: t.name, calls: [techCall(t.name)] })),
      learned, techName: d.title,
    };
  }, [basics, completed, doneCount, drilled, discipline]);

  const openBasic = useCallback((lesson, index) => {
    setDetail({
      kind: 'basic', lessonId: lesson.id, title: lesson.title, description: lesson.subtitle,
      badge: `LESSON ${index + 1}`, keyPoints: lesson.steps, mistakes: [],
    });
    if (!mustDrill) completeBasic(lesson);
  }, [mustDrill, completeBasic]);

  const openTechnique = useCallback((t) => {
    setDetail({
      kind: 'technique', title: t.name, description: t.description, badge: badgeForTech(t),
      keyPoints: t.cues || [], mistakes: t.mistakes || [], category: t.category,
    });
  }, []);

  // Home's Start Here, the Practice invite and the weekly reminder open
  // Practice straight onto the current lesson.
  const opened = useRef(false);
  useEffect(() => {
    if (!openLesson || opened.current) return;
    opened.current = true;
    openBasic(basics[current], current);
  }, [openLesson, basics, current, openBasic]);

  const finishRound = useCallback(({ xp, rounds }) => {
    addPracticeSession(round.focus.name, rounds, rounds, xp);
    notePracticed();
    if (round.lessonId) {
      completeBasic(basics.find(l => l.id === round.lessonId));
    } else if (round.techName) {
      markLibraryDrilled(discipline, round.techName);
      setDrilled(getLibraryDrilled(discipline));
      bankArsenal(round.techName);
    }
  }, [round, basics, discipline, completeBasic, bankArsenal]);

  // After a lesson's round: the next lesson on the path, if there is one.
  const nextAfterRound = round?.lessonId ? basics.findIndex(l => !completed.includes(l.id) && l.id !== round.lessonId) : -1;

  const roundLine = (d) => {
    const r = roundFor(d);
    const { plan } = buildRound(r);
    return `${plan.rounds} ${plan.rounds === 1 ? 'ROUND' : 'ROUNDS'} × ${planLine(plan).split(' × ')[1]} · FOCUS: ${d.title.toUpperCase()}`;
  };

  const lesson = basics[current];
  const allDone = nextIndex < 0;

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: css }}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10,
        height: '100dvh', boxSizing: 'border-box', padding: '10px 16px 0',
        // Clears the tab bar and the BETA chip that floats just above it.
        paddingBottom: 'calc(108px + env(safe-area-inset-bottom, 0px))', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
          <button type="button" className="pm-txt" aria-label="Back to Fight Mode" onClick={onBack} style={{
            width: 40, height: 44, marginLeft: -10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
          }}><ChevronLeft size={22}/></button>
          <SafeImage src="/static/revamp/practice-book.webp" alt="" style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(168,85,247,.55))', flexShrink: 0 }}/>
          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ font: "700 20px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1 }}>PRACTICE MODE</div>
            <div style={{ fontSize: 12, color: SOFT }}>Learn &amp; drill techniques</div>
          </div>
          <button type="button" className="pm-hit pm-txt" aria-label="How it works" onClick={() => setHelpOpen(true)} style={{
            width: 40, height: 40, borderRadius: '50%', background: 'rgba(61,123,255,0.14)', flexShrink: 0,
            border: '1px solid rgba(61,123,255,0.55)', color: '#8FB4FF', cursor: 'pointer', font: "700 17px 'Chakra Petch',sans-serif",
          }}>?</button>
        </header>

        <DisciplineTabs
          value={discipline}
          guide="pm-discipline"
          onChange={(d) => { pickStored(d); setCategory('Strikes'); setShowAll(false); setDetail(null); }}
        />

        {/* Continue Learning: the art at its native 2172:724, text inside its frame. */}
        <button type="button" className="pm-banner" data-guide="pm-continue" onClick={() => openBasic(lesson, current)} style={{
          position: 'relative', flexShrink: 0, width: '100%', padding: 0, border: 0, textAlign: 'left', cursor: 'pointer',
          aspectRatio: '2172 / 724', borderRadius: 10, overflow: 'hidden', background: '#000', color: '#fff', display: 'block',
          transition: 'box-shadow .18s ease',
        }}>
          {/* Dimmed for good (owner call): the art sits behind the lesson
              name as texture, not as the thing you read. */}
          <SafeImage src={bannerSrc(discipline, variant)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45, filter: 'brightness(0.75) saturate(0.9)' }}/>
          <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: '14px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
            <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: allDone ? '#4ADE80' : GOLD }}>{allDone ? 'BASICS COMPLETE' : 'CONTINUE LEARNING'}</span>
            <span style={{ font: "700 15px 'Chakra Petch',sans-serif", letterSpacing: '0.03em', lineHeight: 1.1, maxWidth: '62%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {allDone ? `${discipline.toUpperCase()} BASICS DONE` : `${current + 1} · ${lesson.title.toUpperCase()}`}
            </span>
            <span style={{ fontSize: 11, color: SOFT }}>{discipline} · Fundamentals path</span>
            <span style={{
              marginTop: 2, flexShrink: 0, alignSelf: 'flex-start', height: 26, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
              borderRadius: 8, background: 'linear-gradient(180deg,#FFE9A8,#F2BE45 55%,#C98A1C)', color: '#1A1204',
              font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            }}><Play/>{allDone ? 'REVIEW' : 'RESUME'}</span>
          </div>
        </button>

        {/* Fundamentals Path — done gold ✓, current gold ring, upcoming faint. */}
        <div data-guide="pm-path" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, padding: '10px 12px', borderRadius: 12, background: '#0B0F22', border: '1px solid rgba(61,123,255,.22)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={label}>FUNDAMENTALS PATH</span>
            <span style={{ ...label, letterSpacing: '0.12em', color: '#8FB4FF' }}>{doneCount} / {basics.length} DONE</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: '50%', height: 2, marginTop: -1, background: 'rgba(143,180,255,.2)' }}/>
            {basics.map((l, i) => {
              const done = completed.includes(l.id);
              const here = !allDone && i === current;
              const size = here ? 34 : 28;
              return (
                <button key={l.id} type="button" className="pm-hit" aria-label={`Lesson ${i + 1}: ${l.title}${done ? ' (done)' : ''}`} onClick={() => openBasic(l, i)} style={{
                  position: 'relative', width: size, height: size, borderRadius: '50%', padding: 0, cursor: 'pointer', flexShrink: 0,
                  background: done ? GOLD : here ? '#141A36' : '#0E1024',
                  border: `2px solid ${done || here ? GOLD : 'rgba(143,180,255,.35)'}`,
                  boxShadow: here ? '0 0 14px rgba(242,190,69,.55)' : 'none',
                  color: done ? '#1A1204' : here ? GOLD : '#8E98BC', font: "700 12px 'Chakra Petch',sans-serif",
                }}>{done ? '✓' : i + 1}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', color: GOLD, whiteSpace: 'nowrap' }}>{current + 1} · {lesson.title}</span>
            <span style={{ fontSize: 12, color: SOFT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lesson.subtitle}</span>
          </div>
        </div>

        <div data-guide="pm-library" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
            <span style={label}>TECHNIQUE LIBRARY</span>
            <div role="radiogroup" aria-label="Category" style={{ display: 'flex', padding: 3, gap: 3, borderRadius: 10, background: '#0B0F22', border: '1px solid rgba(143,180,255,.18)' }}>
              {PRACTICE_CATEGORIES.map(c => {
                const on = category === c;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} className={on ? '' : 'pm-txt'} onClick={() => { setCategory(c); setShowAll(false); }} style={{
                    height: 30, padding: '0 8px', borderRadius: 7, border: 0, cursor: 'pointer',
                    background: on ? 'linear-gradient(180deg,#FFE9A8,#F2BE45 55%,#C98A1C)' : 'transparent', color: on ? '#1A1204' : '#8E98BC',
                    font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.06em',
                  }}>{c.toUpperCase()}</button>
                );
              })}
            </div>
          </div>

          {/* Only the grid scrolls, and only once SEE ALL opens it up. */}
          <div className="pm-grid" style={{
            flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gridAutoRows: 56, alignContent: 'start', gap: 6,
          }}>
            {shown.map(t => {
              const [lvl, color] = LEVEL[t.level] || LEVEL.Beginner;
              const wasDrilled = drilled.includes(t.name);
              return (
                <button key={t.name} type="button" className="pm-tile" onClick={() => openTechnique(t)} style={{
                  height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderRadius: 10, minWidth: 0,
                  background: '#0B0F22', border: '1px solid rgba(61,123,255,.22)', color: '#fff', textAlign: 'left', cursor: 'pointer',
                  transition: 'border-color .18s ease, box-shadow .18s ease',
                }}>
                  <span style={{
                    width: 26, height: 26, flexShrink: 0, borderRadius: '50%', boxSizing: 'border-box',
                    border: `1.5px solid ${wasDrilled ? GOLD : 'rgba(242,190,69,.7)'}`, background: wasDrilled ? 'rgba(242,190,69,.18)' : 'transparent',
                    color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 10px 'Chakra Petch',sans-serif",
                  }}>{tileMark(t.name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ font: "700 13px 'Chakra Petch',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    <span style={{ font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color }}>{lvl}</span>
                  </span>
                </button>
              );
            })}
            {!techniques.length && (
              <div style={{ gridColumn: '1 / -1', padding: '16px 0', textAlign: 'center', fontSize: 13, color: SOFT }}>Nothing in this section yet — try another.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {/* The screen's one action, so it wears the gold START look. */}
            <button type="button" className="pm-gold" data-guide="pm-combo" onClick={() => onComboCoach?.(discipline)} style={{
              flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px', border: 'none', cursor: 'pointer',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
              background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
              boxShadow: '0 0 22px rgba(242,190,69,.35)',
              font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            }}>🥊 DRILL A COMBO</button>
            <button type="button" className="pm-hit pm-txt" disabled={techniques.length <= SHOW} onClick={() => setShowAll(a => !a)} style={{
              width: 110, height: 44, borderRadius: 10, background: 'transparent', border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF',
              font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', cursor: techniques.length > SHOW ? 'pointer' : 'default',
            }}>{techniques.length > SHOW ? (showAll ? 'SHOW LESS' : `SEE ALL ${techniques.length}`) : `${techniques.length} TOTAL`}</button>
          </div>
        </div>
      </div>

      {detail && !round && (
        <DetailCard
          detail={detail} profile={profile} roundLine={roundLine(detail)}
          onClose={() => setDetail(null)}
          onStartRound={() => { setRound(roundFor(detail)); setDetail(null); }}
        />
      )}

      {round && (
        <PracticeRound
          discipline={discipline} focus={round.focus} prior={round.prior} learned={round.learned} profile={profile}
          onClose={() => setRound(null)}
          onFinish={finishRound}
          onNext={nextAfterRound >= 0 ? () => { setRound(null); openBasic(basics[nextAfterRound], nextAfterRound); } : undefined}
        />
      )}

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.practice} onClose={() => setHelpOpen(false)}/>}

      {toast && (
        <div role="status" style={{
          position: 'fixed', bottom: 100, left: '50%', zIndex: 300, pointerEvents: 'none', transform: 'translateX(-50%)',
          padding: '10px 18px', borderRadius: 10, background: 'rgba(10,2,22,0.96)', border: '1px solid rgba(242,190,69,0.55)',
          boxShadow: '0 0 18px rgba(242,190,69,0.28)', whiteSpace: 'nowrap', animation: 'pm-toast-in .22s ease both',
          font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.08em', color: GOLD,
        }}>🥊 {toast}</div>
      )}
    </PhoneFrame>
  );
}
