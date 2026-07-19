import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import WordmarkFightMode from './WordmarkFightMode';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import SafeImage from './SafeImage';
import { ChevronLeft, Play, Pause, Lock, ChevronRight, Volume2, Square } from 'lucide-react';
import { C } from './Styles';
import { addStartHereLesson } from './data/userStats';
import { loadProfile } from './data/userProfile';
import {
  primeSpeech, setVoiceGender, speakAsync, cancelSpeech, stopVoiceSession, delay,
} from './voiceCoach';
import TrainingCTA from './shared/TrainingCTA';
import {
  PRACTICE_DISCIPLINES,
  PRACTICE_CATEGORIES,
  TECHNIQUES,
} from './practiceData';
import { addLearned } from './data/arsenal';

const GOLD = C.yellow;
const NEON = C.neon;

// ─── Basics (fundamentals path) data per discipline ─────────────────────────────
const START_HERE_LESSONS = {
  Boxing: [
    { id: 'boxing_stance', title: 'Boxing Stance', subtitle: 'Learn your base, guard, and foot position.', steps: ['Stand with feet shoulder-width apart.','Step lead foot forward (left if right-handed).','Keep knees slightly bent — stay light.','Hands up to protect your chin.','Tuck elbows close to ribs.','Chin down, eyes forward.','Move forward and back for 30 seconds.'] },
    { id: 'boxing_guard', title: 'Guard + Footwork', subtitle: 'Protect yourself and move with balance.', steps: ['Start in your boxing stance.','Keep both hands glued to your cheeks.','Step forward: lead foot first, back foot follows.','Step back: back foot first, lead foot follows.','Never cross your feet.','Practice 10 steps forward, 10 back.','Add lateral movement: step-slide left and right.'] },
    { id: 'boxing_jab', title: 'Jab', subtitle: 'Your fastest, longest-range punch.', steps: ['Start in your boxing stance with guard up.','Extend your lead hand straight out, palm turns down.','Snap it back to guard immediately.','Keep your rear hand glued to your chin.','Step forward slightly as you jab.','Practice 20 jabs — focus on speed, not power.','Keep your shoulder up to protect your chin.'] },
    { id: 'boxing_cross', title: 'Cross', subtitle: 'Your power punch from the rear hand.', steps: ['Start in stance with guard up.','Rotate your back hip forward.','Throw your rear hand straight.','Your back heel lifts as you rotate.','Full extension — don\'t loop it.','Snap back to guard.','Practice 20 crosses — focus on rotation.'] },
    { id: 'boxing_jab_cross', title: 'Jab-Cross', subtitle: 'Your first combination.', steps: ['Start in stance.','Throw a JAB (lead hand snap).','Immediately follow with a CROSS (rear hand, rotate hips).','Return to guard between combos.','Practice 10 jab-cross combos.','Focus on smooth flow, not power.','Add a small step forward with the jab.'] },
    { id: 'boxing_defense', title: 'Basic Defense', subtitle: 'Slips, blocks, and getting out of the way.', steps: ['Start in stance with guard up tight.','BLOCK: Keep hands high — absorb with your gloves.','SLIP INSIDE: Bend knees, move head off center (lead side).','SLIP OUTSIDE: Bend knees, move head to rear side.','PULL: Lean back slightly from the waist.','Practice 10 of each defensive move.','Always return to guard after every slip.'] },
  ],
  Kickboxing: [
    { id: 'kb_stance', title: 'Kickboxing Stance', subtitle: 'Wider base for kicks and punches.', steps: ['Stand slightly wider than boxing stance.','Weight evenly distributed on both feet.','Hands up protecting your chin.','Keep your lead hand extended slightly more.','Stay on the balls of your feet.','Chin down, core tight.','Practice bouncing lightly in place for 30 seconds.'] },
    { id: 'kb_jab', title: 'Jab', subtitle: 'Same fundamentals, kickboxing range.', steps: ['Start in kickboxing stance.','Extend lead hand straight, palm down.','Snap back immediately.','Keep your weight centered (not over-committing).','Step forward slightly with the jab.','Practice 20 quick jabs.','Use the jab to set up kicks.'] },
    { id: 'kb_cross', title: 'Cross', subtitle: 'Power from your rear hand.', steps: ['Start in stance.','Rotate your rear hip forward.','Throw rear hand straight out.','Back heel lifts, hips fully rotate.','Return to guard immediately.','Practice 20 crosses.','Combine: jab-cross, 10 reps.'] },
    { id: 'kb_front_kick', title: 'Front Kick / Teep', subtitle: 'Your longest-range weapon — push them back.', steps: ['Start in stance.','Lift your lead knee to waist height.','Push your foot forward, hitting with the ball of your foot.','Extend your leg fully.','Snap it back to stance.','Keep your hands up the entire time.','Practice 10 lead teeps, then 10 rear teeps.'] },
    { id: 'kb_roundhouse', title: 'Rear Roundhouse Kick', subtitle: 'Power kick using your shin.', steps: ['Start in stance.','Pivot on your lead foot — turn it 90 degrees.','Swing your rear leg in an arc.','Hit with your SHIN, not your foot.','Your hips rotate all the way through.','Return to stance.','Practice 10 slow roundhouses — focus on form.'] },
    { id: 'kb_combo', title: 'Basic Kickboxing Combo', subtitle: 'Hands and feet together.', steps: ['Start in stance.','Jab.','Cross.','Rear roundhouse kick.','Return to stance.','That\'s your 1-2-kick combo.','Practice 10 reps each side.'] },
  ],
  'Muay Thai': [
    { id: 'mt_stance', title: 'Muay Thai Stance', subtitle: 'Tall, square, ready for all 8 weapons.', steps: ['Stand taller than boxing stance.','Feet shoulder-width, slightly squared.','Weight slightly on back foot.','Hands high — palms facing forward.','Elbows tucked and ready.','Stay on the balls of your feet.','Practice shifting weight forward and back.'] },
    { id: 'mt_jab_cross', title: 'Jab + Cross', subtitle: 'Setting up your heavy weapons.', steps: ['Start in Muay Thai stance.','Jab: lead hand straight, step forward slightly.','Cross: rotate rear hip, throw rear hand.','Keep hands high between punches.','Practice 10 jab-cross combos.','These set up your elbows and kicks.','Focus on returning to guard.'] },
    { id: 'mt_teep', title: 'Teep', subtitle: 'The Thai push kick — control distance.', steps: ['Start in stance.','Lift your lead knee high.','Push forward — extend your leg.','Hit with ball of foot or flat foot.','Push opponent away — don\'t kick through.','Snap leg back to stance.','Practice 10 lead teeps, 10 rear teeps.'] },
    { id: 'mt_roundhouse', title: 'Roundhouse Kick', subtitle: 'The most powerful kick in combat sports.', steps: ['Start in Muay Thai stance.','Step your lead foot 45 degrees outward.','Swing rear leg — hip drives through.','Hit with your SHIN.','Your whole body rotates with the kick.','Follow through completely.','Practice 10 slow, controlled kicks per side.'] },
    { id: 'mt_knee', title: 'Knee', subtitle: 'Close-range devastation.', steps: ['Start in stance — closer range.','Grab imaginary clinch (hands up high).','Drive your rear knee straight up.','Point your knee, push hips forward.','Return to stance.','Practice 10 rear knees.','Then 10 lead knees (switch stance slightly).'] },
    { id: 'mt_elbow', title: 'Elbow', subtitle: 'The blade of Muay Thai.', steps: ['Start in stance — very close range.','Lift your elbow to shoulder height.','Slash horizontally across.','Use your hip rotation for power.','Keep opposite hand protecting your face.','Practice horizontal elbows: 10 per side.','Elbows are for VERY close range only.'] },
  ],
  MMA: [
    { id: 'mma_stance', title: 'MMA Stance', subtitle: 'Balanced for striking and takedown defense.', steps: ['Stand with feet shoulder-width, slightly staggered.','Weight centered — 50/50 distribution.','Hands slightly lower than boxing (defend takedowns).','Stay on the balls of your feet.','Chin tucked, core engaged.','Ready to strike AND sprawl.','Practice bouncing lightly — stay mobile.'] },
    { id: 'mma_jab_cross', title: 'Jab + Cross', subtitle: 'Setting up everything in MMA.', steps: ['Start in MMA stance.','Jab: lead hand straight.','Cross: rotate hips, rear hand.','Keep hands ready to defend takedowns after.','Don\'t over-extend on the cross.','Practice 10 jab-cross combos.','After the combo, reset your stance.'] },
    { id: 'mma_teep_low', title: 'Teep or Low Kick', subtitle: 'Control distance or chop the legs.', steps: ['TEEP: Lift knee, push foot forward.','Hit with ball of foot — push away.','LOW KICK: Target outside of lead thigh.','Use your rear leg, pivot lead foot.','Hit with your shin, low and hard.','Practice 10 teeps, then 10 low kicks.','These keep opponents at your range.'] },
    { id: 'mma_sprawl', title: 'Sprawl', subtitle: 'Defend the takedown — stay on your feet.', steps: ['Start in stance.','When someone shoots in, kick your legs BACK.','Drop your hips DOWN to the ground.','Your hands push down on their head/shoulders.','Your legs are extended behind you.','Pop back up to stance immediately.','Practice 10 sprawls (shadow, no partner needed).'] },
    { id: 'mma_level_change', title: 'Level Change Defense', subtitle: 'Recognize and stop the shot.', steps: ['Start in MMA stance.','Lower your level by bending knees.','Keep your back straight — don\'t bend at waist.','Hands drop to hip/thigh level.','If opponent shoots: SPRAWL.','If they don\'t: pop back up.','Practice level changes: down, up, 10 reps.'] },
    { id: 'mma_movement', title: 'Basic MMA Movement', subtitle: 'Angles, footwork, and cage awareness.', steps: ['Start in MMA stance.','Circle left: lead foot steps, rear foot follows.','Circle right: rear foot steps, lead foot follows.','Practice pivoting: plant lead foot, swing rear 90 degrees.','Never walk straight backward.','Always circle away from opponent\'s power hand.','Practice 2 minutes of movement drills.'] },
  ],
};


const COMPLETION_KEY = 'tm_starthere_completed';

function getCompletedLessons() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPLETION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function markLessonComplete(lessonId) {
  if (typeof localStorage === 'undefined') return;
  const completed = getCompletedLessons();
  if (!completed.includes(lessonId)) {
    completed.push(lessonId);
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(completed));
  }
  if (!localStorage.getItem('trainingModeStartHereFirstLessonComplete')) {
    localStorage.setItem('trainingModeStartHereFirstLessonComplete', 'true');
  }
}

// ─── Profile-driven helpers ─────────────────────────────────────────────────────
// Avatar (male/female banner) follows the profile's avatarPreference, else sex.
const getVariant = (p) => {
  const pref = String(p?.avatarPreference || '').toLowerCase();
  if (pref === 'female') return 'female';
  if (pref === 'male') return 'male';
  const s = String(p?.sex || p?.gender || '').toLowerCase();
  return s === 'female' ? 'female' : 'male';
};

// A "beginner learner" is someone who told onboarding they're new AND want to
// learn combat. For them, drilling a basic is mandatory for it to count complete
// (and the Technique Library stays locked until all basics are drilled). Everyone
// else completes a basic just by opening it.
const isBeginnerLearner = (p) => {
  const exp = String(p?.experience || '').toLowerCase();
  const isNew = exp === 'beginner' || exp === 'some training' || exp === '';
  const goal = String(p?.goal || '').toLowerCase();
  return isNew && goal === 'learn combat basics';
};

const DISC_KEY = { Boxing: 'boxing', Kickboxing: 'kickbox', 'Muay Thai': 'muaythai', MMA: 'mma' };
const bannerSrc = (disc, variant) => `/static/practice/${DISC_KEY[disc] || 'boxing'}-${variant}.png`;

// ─── Technique Library helpers ─────────────────────────────────────────────────
const DEFENSE_FOOTWORK_INCLUDES = {
  Boxing:    ['Boxing'],
  Kickboxing: ['Boxing', 'Kickboxing'],
  'Muay Thai': ['Boxing', 'Kickboxing', 'Muay Thai'],
  MMA:       ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'],
};

// Sub-section label for a technique (group techniques within a category).
function subSectionFor(t) {
  const n = String(t.name).toLowerCase();
  if (t.category === 'Defense') {
    if (/slip|bob|weave|roll|pull|lean|duck|sway/.test(n)) return 'HEAD MOVEMENT';
    return 'BLOCKS & PARRIES';
  }
  if (t.category === 'Footwork') {
    if (/pivot|angle|lateral|circle|exit|entry|switch/.test(n)) return 'ANGLES & PIVOTS';
    return 'STEPS';
  }
  if (/knee/.test(n)) return 'KNEES';
  if (/elbow/.test(n)) return 'ELBOWS';
  if (/kick|teep|roundhouse|\bcheck\b/.test(n)) return 'KICKS';
  return 'PUNCHES';
}

// Short badge for the detail header (matches the "PUNCH" tag in the design).
const STRIKE_BADGE = { PUNCHES: 'PUNCH', KICKS: 'KICK', KNEES: 'KNEE', ELBOWS: 'ELBOW' };
function badgeForTech(t) {
  if (t.category === 'Strikes') {
    return STRIKE_BADGE[subSectionFor(t)] || 'STRIKE';
  }
  return String(t.category || 'MOVE').toUpperCase();
}

// Preserve first-seen order of sub-sections.
function groupBySubSection(techniques) {
  const groups = [];
  const idx = {};
  techniques.forEach(t => {
    const s = subSectionFor(t);
    if (idx[s] === undefined) { idx[s] = groups.length; groups.push({ section: s, items: [] }); }
    groups[idx[s]].items.push(t);
  });
  return groups;
}

function getTechniquesFor(discipline, category) {
  if (category === 'Strikes') {
    return TECHNIQUES.filter(t => t.discipline === discipline && t.category === 'Strikes');
  }
  const sources = DEFENSE_FOOTWORK_INCLUDES[discipline] || [discipline];
  const seen = new Set();
  const result = [];
  for (const src of sources) {
    for (const t of TECHNIQUES) {
      if (t.discipline === src && t.category === category && !seen.has(t.name)) {
        seen.add(t.name);
        result.push(t);
      }
    }
  }
  return result;
}

// ─── Normalizers → the shared detail shape ─────────────────────────────────────
const basicToDetail = (lesson) => ({
  kind: 'basic', lessonId: lesson.id, title: lesson.title,
  description: lesson.subtitle, badge: 'BASIC',
  keyPoints: lesson.steps, mistakes: [], duration: `${lesson.steps.length} steps`,
});
const techToDetail = (t) => ({
  kind: 'technique', lessonId: null, title: t.name,
  description: t.description, badge: badgeForTech(t),
  keyPoints: t.cues || [], mistakes: t.mistakes || [], duration: t.duration || '20–30 sec',
});

// ─── Styles ────────────────────────────────────────────────────────────────────
const css = `
.pm-disc-pill {
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.07em;
  padding: 7px 12px;
  border-radius: 20px;
  border: 1.5px solid rgba(168,85,247,0.2);
  background: rgba(10,0,20,0.7);
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.pm-disc-pill.active {
  border-color: rgba(253,224,71,0.7);
  background: rgba(253,224,71,0.08);
  color: ${GOLD};
  box-shadow: 0 0 12px rgba(253,224,71,0.2);
}
.pm-disc-pill:hover:not(.active) {
  border-color: rgba(168,85,247,0.4);
  color: rgba(255,255,255,0.7);
}
.pm-cat-pill {
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.07em;
  padding: 6px 13px;
  border-radius: 6px;
  border: 1px solid rgba(168,85,247,0.15);
  background: transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: all 0.18s ease;
}
.pm-cat-pill.active {
  border: none;
  background: #fde047;
  color: #0a0014;
}
.pm-cat-pill:hover:not(.active) {
  border-color: rgba(168,85,247,0.35);
  color: rgba(255,255,255,0.65);
}
.pm-card {
  border-radius: 11px;
  border: 1px solid rgba(168,85,247,0.2);
  background: rgba(8,2,18,0.82);
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
  position: relative;
  overflow: hidden;
}
.pm-card:hover {
  opacity: 1;
  border-color: rgba(168,85,247,0.35);
  box-shadow: 0 0 12px rgba(168,85,247,0.12);
  transform: translateY(-1px);
}
.pm-card:active {
  transform: scale(0.98);
}
.pm-technique-list {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(168,85,247,0.4) rgba(10,0,20,0.3);
}
.pm-technique-list::-webkit-scrollbar { width: 5px; }
.pm-technique-list::-webkit-scrollbar-track { background: rgba(10,0,20,0.3); border-radius: 4px; }
.pm-technique-list::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.4); border-radius: 4px; }
.pm-toast {
  animation: pm-toast-in 0.22s ease forwards;
}
@keyframes pm-toast-in {
  from { opacity: 0; transform: translateY(10px) translateX(-50%); }
  to   { opacity: 1; transform: translateY(0)    translateX(-50%); }
}
.pm-panel-in {
  animation: pm-panel-slide 0.28s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
}
@keyframes pm-panel-slide {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pm-cue-glow {
  0%, 100% { box-shadow: 0 0 14px rgba(253,224,71,0.35); }
  50%      { box-shadow: 0 0 24px rgba(253,224,71,0.6); }
}
`;

// ─── Level badge ─────────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const color = level === 'Beginner' ? 'rgba(74,222,128,0.85)'
    : level === 'Intermediate' ? GOLD : 'rgba(249,115,22,0.9)';
  return (
    <span style={{
      fontFamily: "'Press Start 2P',monospace", fontSize: 6,
      color, letterSpacing: '0.06em',
      padding: '2px 6px', borderRadius: 4,
      background: 'rgba(0,0,0,0.4)', border: `1px solid ${color}`,
      opacity: 0.85,
    }}>{level.toUpperCase()}</span>
  );
}

function SectionLabel({ children, color = '#c4a4d8' }) {
  return (
    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 8, color, letterSpacing: '0.18em', marginBottom: 9 }}>{children}</div>
  );
}

// ─── Technique Card (library row) ──────────────────────────────────────────────
function TechniqueCard({ technique, onTap }) {
  return (
    <button className="pm-card" onClick={() => onTap(technique)} style={{ width: '100%', textAlign: 'left' }}>
      <div style={{
        position: 'relative', width: 52, height: 40, borderRadius: 7, flexShrink: 0,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'repeating-linear-gradient(45deg,#1a1030 0 6px,#241640 6px 12px)',
      }}>
        <Play size={13} style={{ color: '#fde047', marginLeft: 1 }} fill="#fde047"/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', letterSpacing: '0.03em' }}>{technique.name}</span>
          <LevelBadge level={technique.level}/>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: '#9a90b8', lineHeight: 1.3 }}>
          {technique.description}{technique.duration ? ` · ${technique.duration}` : ''}
        </div>
      </div>
      <ChevronRight size={15} style={{ color: '#b06aff', flexShrink: 0 }}/>
    </button>
  );
}

// ─── Detail (unified page: video · key points · common mistakes · drill it) ─────
function DetailView({ detail, profile, onBack, onToast, onDrill }) {
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

  // Cancel any speech if the page unmounts.
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
    if (readingRef.current) {
      readingRef.current = false;
      setReading(false);
      setActiveCue(-1);
    }
  }, [keyPoints, profile, stopReading]);

  const handleBack = () => { stopReading(); onBack(); };

  return createPortal(
    <div className="pm-panel-in" style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 200, background: '#080012', display: 'flex', flexDirection: 'column' }}>
      {/* Video */}
      <div style={{ position: 'relative', flexShrink: 0, aspectRatio: '16/10', background: 'repeating-linear-gradient(45deg,#140823 0 14px,#1c0d30 14px 28px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={handleBack} style={{ position: 'absolute', top: 8, left: 12, background: 'none', border: 'none', color: '#f5e9ff', cursor: 'pointer', display: 'flex', padding: 4 }}><ChevronLeft size={20}/></button>
        <div onClick={onToast} style={{ textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(253,224,71,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}><Play size={24} fill="#0a0014" color="#0a0014" style={{ marginLeft: 3 }}/></div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#8a6fb0' }}>{detail.title} · tutorial video</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 14px', background: 'linear-gradient(0deg,rgba(8,1,15,0.9),transparent)' }}>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}><div style={{ width: '35%', height: '100%', background: GOLD }}/></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Rajdhani',sans-serif", fontSize: 8, color: '#c4a4d8', marginTop: 5 }}><span>0:00</span><span>{detail.duration || '1:40'}</span></div>
        </div>
      </div>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px calc(90px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '0.03em' }}>{detail.title.toUpperCase()}</div>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#c9a6ff', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 5, padding: '3px 7px' }}>{detail.badge}</span>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: '#c4a4d8', marginBottom: 14 }}>{detail.description}</div>

        {/* KEY POINTS header + voice readout toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 8, color: '#c4a4d8', letterSpacing: '0.18em' }}>KEY POINTS</span>
          {keyPoints.length > 0 && (
            <button onClick={toggleRead} style={{
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              padding: '5px 10px', borderRadius: 7,
              border: `1px solid ${reading ? 'rgba(253,224,71,0.7)' : 'rgba(168,85,247,0.4)'}`,
              background: reading ? 'rgba(253,224,71,0.12)' : 'rgba(168,85,247,0.08)',
              color: reading ? GOLD : '#c9a6ff',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, letterSpacing: '0.1em',
            }}>
              {reading ? <Square size={10} fill="currentColor"/> : <Volume2 size={11}/>}
              {reading ? 'STOP' : 'READ ALOUD'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {keyPoints.map((c, i) => {
            const on = activeCue === i;
            return (
              <div key={i} style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                background: on ? 'rgba(253,224,71,0.12)' : 'rgba(8,2,18,0.7)',
                border: `1px solid ${on ? 'rgba(253,224,71,0.9)' : 'rgba(168,85,247,0.2)'}`,
                borderRadius: 9, padding: '9px 12px',
                transform: on ? 'scale(1.02)' : 'none',
                transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                animation: on ? 'pm-cue-glow 1.3s ease-in-out infinite' : 'none',
              }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: GOLD }}>{i + 1}</span>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: on ? '#fff' : '#e6dcff' }}>{c}</span>
              </div>
            );
          })}
        </div>

        {mistakes.length > 0 && (
          <>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 8, color: '#ff8a8a', letterSpacing: '0.18em', marginBottom: 8 }}>COMMON MISTAKES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {mistakes.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, padding: '9px 12px' }}>
                  <span style={{ color: '#ff8a8a', fontWeight: 800, fontSize: 11 }}>✕</span>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#e6dcff' }}>{m}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 16px calc(14px + env(safe-area-inset-bottom,0px))', display: 'flex', gap: 10, alignItems: 'stretch', background: 'linear-gradient(0deg,#080012 72%,transparent)' }}>
        <button onClick={handleBack} style={{ flex: 1, height: 48, border: '1px solid rgba(168,85,247,0.4)', borderRadius: 13, background: 'rgba(168,85,247,0.08)', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer' }}>↺ LIBRARY</button>
        <div style={{ flex: 2, display: 'flex' }}>
          <TrainingCTA variant="gold" label="DRILL IT" icon="🥊" height={48} onClick={() => onDrill(detail)} style={{ fontSize: 13, letterSpacing: '0.06em' }}/>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Shadowbox Drill (guided reps) ─────────────────────────────────────────────
function ShadowboxDrillView({ technique, onBack, onComplete }) {
  const TARGET = 30;
  const [reps, setReps] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tempoMs, setTempoMs] = useState(2000);
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (paused || done) { clearInterval(timer.current); return; }
    timer.current = setInterval(() => {
      setReps(r => {
        if (r + 1 >= TARGET) { setDone(true); return TARGET; }
        return r + 1;
      });
    }, tempoMs);
    return () => clearInterval(timer.current);
  }, [paused, done, tempoMs]);

  // Finishing all reps counts as completing the drill.
  useEffect(() => {
    if (done && !completedRef.current) { completedRef.current = true; onComplete?.(); }
  }, [done, onComplete]);

  const finishAndExit = () => {
    if (!completedRef.current) { completedRef.current = true; onComplete?.(); }
    onBack();
  };

  const name = String(technique.name || technique.title || 'HOOK').toUpperCase();
  const tempoLabel = `1 EVERY ${(tempoMs / 1000).toFixed(tempoMs % 1000 ? 1 : 0)}s`;

  return createPortal(
    <div className="pm-panel-in" style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 210, background: 'radial-gradient(ellipse at 50% 42%, rgba(168,85,247,0.22), rgba(10,7,20,0.96) 72%), #0a0714', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes sb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' }}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ textAlign: 'center', padding: '10px 0 0' }}><span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#b06aff', letterSpacing: '0.14em' }}>SHADOWBOX DRILL · {name}</span></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 11, color: '#c4a4d8', letterSpacing: '0.1em', marginBottom: 16 }}>{done ? 'DRILL COMPLETE' : 'THROW ON THE CALL'}</div>
          <div style={{ position: 'relative', width: 'min(90vw, 372px)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, animation: paused || done ? 'none' : `sb-pulse ${tempoMs}ms ease-in-out infinite` }}>
            <SafeImage src="/static/ring-alt2.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.28 }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 38, color: GOLD, textShadow: '0 0 18px rgba(253,224,71,.4)' }}>{name}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22, color: '#fff', marginTop: 8 }}>{reps} / {TARGET}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#8b83a8', letterSpacing: '0.1em', marginTop: 4 }}>REPS</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,4,30,0.7)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '9px 15px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 9, color: '#6d6688', letterSpacing: '0.08em' }}>TEMPO</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12, color: '#c9bff0' }}>{tempoLabel}</span>
          </div>
        </div>
        <div style={{ padding: '0 22px calc(26px + env(safe-area-inset-bottom,0px))' }}>
          <button onClick={() => setPaused(p => !p)} disabled={done} style={{ width: '100%', height: 56, border: 'none', borderRadius: 15, background: 'linear-gradient(180deg,#b975ff,#a855f7)', color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.12em', marginBottom: 11, cursor: 'pointer', boxShadow: '0 6px 22px -6px rgba(168,85,247,.7)', opacity: done ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {paused ? <><Play size={18} fill="#fff"/> RESUME</> : <><Pause size={18} fill="#fff"/> PAUSE</>}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTempoMs(m => Math.min(4000, m + 500))} style={{ flex: 1, height: 46, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: '#130e20', color: '#c9bff0', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>↺ SLOWER</button>
            <button onClick={finishAndExit} style={{ flex: 1, height: 46, border: '1px solid rgba(34,197,94,0.5)', borderRadius: 12, background: 'rgba(34,197,94,0.1)', color: '#7ee7a7', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>✓ DONE</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Combo Drill (multi-strike call-out) ───────────────────────────────────────
const DRILL_COMBOS = [
  ['JAB', 'CROSS'],
  ['JAB', 'CROSS', 'HOOK'],
  ['JAB', 'JAB', 'CROSS'],
  ['CROSS', 'HOOK', 'CROSS'],
];

function ComboDrillView({ discipline, onBack }) {
  const [comboIdx, setComboIdx] = useState(0);
  const [strikeIdx, setStrikeIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tempoMs, setTempoMs] = useState(1500);
  const timer = useRef(null);

  const combo = DRILL_COMBOS[comboIdx];

  const advance = useCallback(() => {
    setStrikeIdx(si => {
      if (si + 1 < combo.length) return si + 1;
      setComboIdx(ci => (ci + 1) % DRILL_COMBOS.length);
      return 0;
    });
  }, [combo.length]);

  useEffect(() => {
    if (paused) { clearInterval(timer.current); return; }
    timer.current = setInterval(advance, tempoMs);
    return () => clearInterval(timer.current);
  }, [paused, tempoMs, advance]);

  const skip = () => { setComboIdx(ci => (ci + 1) % DRILL_COMBOS.length); setStrikeIdx(0); };

  return createPortal(
    <div className="pm-panel-in" style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 210, background: 'radial-gradient(ellipse at 50% 42%, rgba(168,85,247,0.22), rgba(10,7,20,0.96) 72%), #0a0714', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes cd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' }}/>
      <div style={{ textAlign: 'center', padding: '10px 0 0' }}><span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#b06aff', letterSpacing: '0.14em' }}>COMBO DRILL · {String(discipline).toUpperCase()}</span></div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '9px 0 0' }}>
        {DRILL_COMBOS.map((_, i) => <span key={i} style={{ width: 22, height: 6, borderRadius: 99, background: i < comboIdx ? '#b06aff' : i === comboIdx ? '#fde047' : '#2a2140' }}/>)}
      </div>
      <div style={{ textAlign: 'center', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#8b83a8', letterSpacing: '0.1em', marginTop: 6 }}>COMBO {comboIdx + 1} / {DRILL_COMBOS.length}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ position: 'relative', width: 'min(90vw, 372px)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, animation: paused ? 'none' : `cd-pulse ${tempoMs}ms ease-in-out infinite` }}>
          <SafeImage src="/static/ring-alt2.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.28 }}/>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: '#c9a6ff', marginBottom: 12 }}>THROW IT</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              {combo.map((s, i) => {
                const cur = i === strikeIdx;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: cur ? 13 : 11, color: cur ? '#fde047' : '#6d5a8f' }}>{i + 1}</span>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: cur ? 26 : 20, color: cur ? '#fde047' : '#8b83a8', textShadow: cur ? '0 0 18px rgba(253,224,71,.5)' : 'none' }}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.08em', marginBottom: 10 }}>{combo.join(' · ')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,4,30,0.7)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '8px 15px' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 9, color: '#6d6688', letterSpacing: '0.08em' }}>SPEED</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12, color: '#c9bff0' }}>{tempoMs <= 1200 ? 'FAST' : tempoMs >= 2000 ? 'SLOW' : 'MEDIUM'}</span>
        </div>
      </div>
      <div style={{ padding: '0 22px calc(26px + env(safe-area-inset-bottom,0px))' }}>
        <button onClick={() => setPaused(p => !p)} style={{ width: '100%', height: 56, border: 'none', borderRadius: 15, background: 'linear-gradient(180deg,#b975ff,#a855f7)', color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.12em', marginBottom: 11, cursor: 'pointer', boxShadow: '0 6px 22px -6px rgba(168,85,247,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {paused ? <><Play size={18} fill="#fff"/> RESUME</> : <><Pause size={18} fill="#fff"/> PAUSE</>}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setTempoMs(m => Math.min(2500, m + 400))} style={{ flex: 1, height: 46, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: '#130e20', color: '#c9bff0', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>↺ SLOWER</button>
          <button onClick={skip} style={{ flex: 1, height: 46, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: '#130e20', color: '#c9bff0', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>SKIP ⏭</button>
          <button onClick={onBack} style={{ flex: 1, height: 46, border: '1px solid rgba(255,90,90,0.4)', borderRadius: 12, background: 'rgba(255,90,90,0.09)', color: '#ff8a8a', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>✕ END</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Learning-mission banner (avatar changes by discipline + gender) ────────────
function LearningBanner({ discipline, variant, basics, completed, onResume }) {
  const ci = basics.findIndex(l => !completed.includes(l.id));
  const cur = ci >= 0 ? basics[ci] : null;
  const src = bannerSrc(discipline, variant);
  return (
    <button
      onClick={() => { if (cur) onResume(cur); }}
      style={{
        position: 'relative', width: '100%', aspectRatio: '3 / 1', borderRadius: 14,
        overflow: 'hidden', marginBottom: 16, padding: 0, display: 'block',
        border: '1px solid rgba(168,85,247,0.3)', background: '#0a0014',
        cursor: cur ? 'pointer' : 'default',
      }}
    >
      <SafeImage src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.78 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,1,15,0.9) 0%, rgba(8,1,15,0.5) 46%, rgba(8,1,15,0.08) 100%)' }}/>
      <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left', maxWidth: '64%' }}>
        {cur ? (
          <>
            <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.14em', marginBottom: 4 }}>CONTINUE LEARNING</div>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', lineHeight: 1.15 }}>LESSON {ci + 1} · {cur.title.toUpperCase()}</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3 }}>{discipline} · Fundamentals path</div>
            <span style={{ display: 'inline-block', width: 'fit-content', marginTop: 10, borderRadius: 8, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 10px 'Orbitron',sans-serif", padding: '7px 15px' }}>▶ RESUME</span>
          </>
        ) : (
          <>
            <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#4ade80', letterSpacing: '0.14em', marginBottom: 4 }}>BASICS COMPLETE</div>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', lineHeight: 1.15 }}>{discipline.toUpperCase()} MASTERED</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3 }}>Full technique library unlocked below.</div>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PracticeMode({ initialDisc = 'Boxing', onBack, onHome }) {
  const profile = loadProfile();
  const variant = getVariant(profile);
  const mustDrill = isBeginnerLearner(profile);

  const [discipline, setDisc] = useState(PRACTICE_DISCIPLINES.includes(initialDisc) ? initialDisc : 'Boxing');
  const [category, setCategory] = useState('Strikes');
  const [detail, setDetail] = useState(null);
  const [drill, setDrill] = useState(null);
  const [comboDrill, setComboDrill] = useState(false);
  const [toast, setToast] = useState(false);
  const [learned, setLearned] = useState(null); // strikes just added to the arsenal (1.1)
  const [completed, setCompleted] = useState(() => getCompletedLessons());

  // Bank strikes into the arsenal and flash a "learned" toast (1.1).
  const bankArsenal = useCallback((name) => {
    const gained = addLearned(discipline, name);
    if (gained.length) { setLearned(gained); setTimeout(() => setLearned(null), 2600); }
  }, [discipline]);

  const basics = useMemo(() => START_HERE_LESSONS[discipline] || [], [discipline]);
  const techniques = getTechniquesFor(discipline, category);

  const showToast = useCallback(() => {
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  }, []);

  const completeBasic = useCallback((lesson) => {
    if (!lesson) return;
    const already = getCompletedLessons().includes(lesson.id);
    markLessonComplete(lesson.id);
    if (!already && lesson.title) addStartHereLesson(lesson.title);
    setCompleted(getCompletedLessons());
    // 1.1 — completing a strike lesson banks it into the arsenal.
    if (!already) bankArsenal(lesson.title);
  }, [bankArsenal]);

  // Open a basic lesson. Non-beginners complete it just by opening; beginners
  // must finish the drill (handled on drill complete) for it to count.
  const openBasic = useCallback((lesson) => {
    setDetail(basicToDetail(lesson));
    if (!mustDrill) completeBasic(lesson);
  }, [mustDrill, completeBasic]);

  const openTechnique = useCallback((t) => { setDetail(techToDetail(t)); }, []);

  const startDrill = useCallback((d) => { setDrill(d); setDetail(null); }, []);

  const onDrillComplete = useCallback(() => {
    if (drill?.lessonId) {
      const lesson = basics.find(b => b.id === drill.lessonId) || { id: drill.lessonId, title: drill.title };
      completeBasic(lesson);
    } else if (drill?.title) {
      // Drilling a Technique Library strike also banks it (1.1).
      bankArsenal(drill.title);
    }
  }, [drill, basics, completeBasic, bankArsenal]);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: css }}/>
      <Embers count={3}/>
      <CornerHUD color="rgba(168,85,247,0.25)" size={22} inset={10}/>

      <TrainingHeader
        title="PRACTICE MODE"
        subtitle="Learn techniques step by step."
        onHome={onHome}
        showBack
        onBack={onBack}
        rightSlot={<WordmarkFightMode height={22}/>}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '14px 14px 0',
      }}>
        {/* Discipline selector */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
          {PRACTICE_DISCIPLINES.map(d => (
            <button key={d} className={`pm-disc-pill${discipline === d ? ' active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => { setDisc(d); setCategory('Strikes'); setDetail(null); }}>
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Scrollable content: learning banner → basics → technique library */}
        <div className="pm-technique-list" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))', paddingRight: 4 }}>

          {/* Learning-mission banner */}
          <LearningBanner discipline={discipline} variant={variant} basics={basics} completed={completed} onResume={openBasic}/>

          {/* ── The Basics (fundamentals path) ── */}
          <SectionLabel>THE BASICS · FUNDAMENTALS PATH</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {basics.map((lesson, idx) => {
              const done = completed.includes(lesson.id);
              const isCurrent = !done && basics.slice(0, idx).every(l => completed.includes(l.id));
              const upcoming = !done && !isCurrent;
              return (
                <button key={lesson.id} onClick={() => openBasic(lesson)} style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', cursor: 'pointer',
                  borderRadius: 10, padding: '9px 12px',
                  border: `1px solid ${done ? 'rgba(34,197,94,0.35)' : isCurrent ? 'rgba(253,224,71,0.6)' : 'rgba(168,85,247,0.2)'}`,
                  background: done ? 'rgba(34,197,94,0.06)' : isCurrent ? 'rgba(253,224,71,0.07)' : 'rgba(16,4,30,0.6)',
                  boxShadow: isCurrent ? '0 0 12px rgba(253,224,71,0.14)' : 'none', opacity: upcoming ? 0.72 : 1,
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: "900 11px 'Orbitron',sans-serif",
                    background: done ? 'rgba(34,197,94,0.15)' : isCurrent ? '#fde047' : 'rgba(16,4,30,0.9)',
                    color: done ? '#22c55e' : isCurrent ? '#0a0014' : '#c4a4d8',
                    border: upcoming ? '1px solid rgba(168,85,247,0.3)' : 'none',
                  }}>{done ? '✓' : idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "900 11px 'Orbitron',sans-serif", color: done ? '#fff' : isCurrent ? '#fde047' : '#c4a4d8' }}>{lesson.title.toUpperCase()}</div>
                    <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: done ? '#9a90b8' : isCurrent ? '#facc15' : '#6d5a8f' }}>
                      {done ? `${lesson.steps.length} key points · complete` : isCurrent ? `in progress · ${lesson.steps.length} key points` : lesson.subtitle}
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: done ? 'rgba(34,197,94,0.6)' : isCurrent ? '#fde047' : 'rgba(168,85,247,0.4)', flexShrink: 0 }}/>
                </button>
              );
            })}
          </div>

          {/* ── Technique Library (always available, under the basics) ── */}
          <SectionLabel>TECHNIQUE LIBRARY</SectionLabel>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
            {PRACTICE_CATEGORIES.map(c => (
              <button key={c} className={`pm-cat-pill${category === c ? ' active' : ''}`} onClick={() => { setCategory(c); setDetail(null); }}>
                {c}
              </button>
            ))}
          </div>

          {/* Combo drill launcher */}
          <button onClick={() => setComboDrill(true)} style={{ width: '100%', marginBottom: 12, padding: '10px 14px', borderRadius: 11, border: '1px solid rgba(176,106,255,0.5)', background: 'linear-gradient(135deg,rgba(176,106,255,0.18),rgba(124,58,237,0.12))', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, color: '#c9a6ff', letterSpacing: '0.06em' }}>🥊 DRILL A COMBO</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: '#9a90b8' }}>Multi-strike call-outs on the beat</span>
            </span>
            <ChevronRight size={16} style={{ color: '#b06aff' }}/>
          </button>

          {/* Grouped technique list */}
          {techniques.length > 0 ? groupBySubSection(techniques).map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 600, fontSize: 8, color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 9 }}>{section} &middot; {items.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(t => <TechniqueCard key={t.name} technique={t} onTap={openTechnique}/>)}
              </div>
            </div>
          )) : (
            <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.muted }}>Content coming soon.</div>
          )}

          <div style={{ marginTop: 16, textAlign: 'center', fontFamily: "'Press Start 2P',monospace", fontSize: 6.5, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.18em' }}>TRAIN &middot; FIGHT &middot; WIN</div>
        </div>
      </div>

      {/* Detail overlay (unified page) */}
      {detail && !drill && (
        <DetailView detail={detail} profile={profile} onBack={() => setDetail(null)} onToast={showToast} onDrill={startDrill}/>
      )}

      {/* Shadowbox drill overlay */}
      {drill && (
        <ShadowboxDrillView technique={drill} onBack={() => setDrill(null)} onComplete={onDrillComplete}/>
      )}

      {/* Combo drill overlay */}
      {comboDrill && (
        <ComboDrillView discipline={discipline} onBack={() => setComboDrill(false)}/>
      )}

      {/* Toast */}
      {toast && (
        <div className="pm-toast" style={{
          position: 'fixed', bottom: 100, left: '50%', zIndex: 300, pointerEvents: 'none',
          padding: '10px 20px', borderRadius: 10,
          background: 'rgba(10,2,22,0.96)', border: '1px solid rgba(168,85,247,0.45)',
          boxShadow: '0 0 18px rgba(168,85,247,0.22)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Lock size={11} style={{ color: NEON }}/>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: NEON, letterSpacing: '0.08em' }}>Tutorial video coming soon.</span>
        </div>
      )}

      {/* Arsenal toast (1.1) — a learned strike was banked */}
      {learned && (
        <div className="pm-toast" style={{
          position: 'fixed', bottom: 100, left: '50%', zIndex: 300, pointerEvents: 'none',
          padding: '10px 20px', borderRadius: 10,
          background: 'rgba(10,2,22,0.96)', border: '1px solid rgba(253,224,71,0.55)',
          boxShadow: '0 0 18px rgba(253,224,71,0.28)',
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13 }}>🥊</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: GOLD, letterSpacing: '0.06em' }}>
            {learned.map(s => s.toUpperCase()).join(' + ')} ADDED TO YOUR ARSENAL
          </span>
        </div>
      )}
    </PhoneFrame>
  );
}
