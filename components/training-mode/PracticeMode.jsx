import { useState, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import WordmarkFightMode from './WordmarkFightMode';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Play, Lock, ChevronRight, Shield, CircleCheck as CheckCircle, Hand, Footprints, Flame, Swords } from 'lucide-react';
import { C } from './Styles';
import { addStartHereLesson } from './data/userStats';
import {
  PRACTICE_DISCIPLINES,
  PRACTICE_CATEGORIES,
  TECHNIQUES,
} from './practiceData';

const GOLD = C.yellow;
const NEON = C.neon;

// ─── Start Here data per discipline ────────────────────────────────────────────
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

const DISCIPLINE_ICONS = {
  Boxing: Hand,
  Kickboxing: Footprints,
  'Muay Thai': Flame,
  MMA: Swords,
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

// ─── Technique Library helpers ─────────────────────────────────────────────────
const DEFENSE_FOOTWORK_INCLUDES = {
  Boxing:    ['Boxing'],
  Kickboxing: ['Boxing', 'Kickboxing'],
  'Muay Thai': ['Boxing', 'Kickboxing', 'Muay Thai'],
  MMA:       ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'],
};

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
  border-color: rgba(168,85,247,0.6);
  background: rgba(168,85,247,0.1);
  color: ${NEON};
}
.pm-cat-pill:hover:not(.active) {
  border-color: rgba(168,85,247,0.35);
  color: rgba(255,255,255,0.65);
}
.pm-card {
  border-radius: 12px;
  border: 1px solid rgba(168,85,247,0.15);
  background: rgba(10,0,20,0.75);
  padding: 13px 14px;
  display: flex;
  align-items: center;
  gap: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
  opacity: 0.82;
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
.pm-tab-btn {
  flex: 1;
  padding: 9px 0;
  border-radius: 8px;
  border: 1.5px solid rgba(168,85,247,0.15);
  background: rgba(10,0,20,0.6);
  color: rgba(255,255,255,0.4);
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: center;
}
.pm-tab-btn.active {
  border-color: rgba(253,224,71,0.5);
  background: rgba(253,224,71,0.06);
  color: ${GOLD};
  box-shadow: 0 0 10px rgba(253,224,71,0.12);
}
.pm-tab-btn:hover:not(.active) {
  border-color: rgba(168,85,247,0.35);
  color: rgba(255,255,255,0.65);
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

// ─── Technique Card ──────────────────────────────────────────────────────────
function TechniqueCard({ technique, onTap }) {
  return (
    <button className="pm-card" onClick={() => onTap(technique)} style={{ width: '100%', border: 'none', textAlign: 'left' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <Play size={18} style={{ color: 'rgba(168,85,247,0.45)', marginLeft: 2 }}/>
        <div style={{
          position: 'absolute', bottom: -4, right: -4,
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(10,0,20,0.95)', border: '1px solid rgba(168,85,247,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={7} style={{ color: 'rgba(168,85,247,0.65)' }}/>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em' }}>{technique.name}</span>
          <LevelBadge level={technique.level}/>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.3 }}>{technique.description}</div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'rgba(168,85,247,0.4)', marginTop: 4, letterSpacing: '0.07em' }}>{technique.duration} &bull; VIDEO COMING SOON</div>
      </div>
      <ChevronRight size={16} style={{ color: 'rgba(168,85,247,0.35)', flexShrink: 0 }}/>
    </button>
  );
}

// ─── Technique Detail panel ──────────────────────────────────────────────────
function TechniqueDetail({ technique, onBack, onNext, onToast }) {
  const Section = ({ title, items, color }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: color || C.muted, letterSpacing: '0.12em', marginBottom: 7 }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: color || 'rgba(168,85,247,0.5)' }}/>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.text, lineHeight: 1.4 }}>{item}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pm-panel-in" style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(6,0,14,0.97)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      padding: '16px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Orbitron',sans-serif", fontSize: 10, color: C.muted, letterSpacing: '0.07em' }}>
          <ChevronLeft size={18} style={{ color: C.muted }}/> BACK TO LIBRARY
        </button>
        <div style={{ marginLeft: 'auto' }}><LevelBadge level={technique.level}/></div>
      </div>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: 'rgba(168,85,247,0.55)', letterSpacing: '0.2em', marginBottom: 4 }}>{technique.discipline.toUpperCase()} &bull; {technique.category.toUpperCase()}</div>
      <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD, fontSize: 26, letterSpacing: '0.1em', textShadow: '0 0 14px rgba(253,224,71,0.4)', marginBottom: 4 }}>{technique.name.toUpperCase()}</h2>
      <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, color: C.muted, marginBottom: 18 }}>{technique.description}</p>

      <div onClick={onToast} style={{
        width: '100%', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(10,0,20,0.8)',
        aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', marginBottom: 20,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(168,85,247,0.08)', border: '1.5px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={22} style={{ color: 'rgba(168,85,247,0.55)' }}/>
        </div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12, color: 'rgba(168,85,247,0.6)', letterSpacing: '0.12em' }}>COMING SOON</div>
      </div>

      <Section title="KEY CUES" items={technique.cues} color="rgba(74,222,128,0.7)"/>
      <Section title="COMMON MISTAKES" items={technique.mistakes} color="rgba(249,115,22,0.7)"/>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '13px 0', borderRadius: 10, background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(168,85,247,0.25)', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: 'rgba(168,85,247,0.7)', letterSpacing: '0.1em', cursor: 'pointer' }}>LIBRARY</button>
        <button onClick={onNext} style={{ flex: 2, padding: '13px 0', borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.35)', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: NEON, letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>NEXT <ChevronRight size={14}/></button>
      </div>
    </div>
  );
}

// ─── Start Here Lesson Active View ───────────────────────────────────────────
function StartHereLessonView({ lesson, onBack, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep >= lesson.steps.length - 1;

  return (
    <div className="pm-panel-in" style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(6,0,14,0.98)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
    }}>
      <button onClick={onBack} style={{
        alignSelf: 'flex-start', background: 'none', border: 'none',
        color: C.muted, display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: "'Rajdhani',sans-serif", fontSize: 13, cursor: 'pointer', marginBottom: 20,
      }}>
        <ChevronLeft size={18}/> BACK TO LESSONS
      </button>

      <Shield size={24} color={GOLD} style={{ marginBottom: 10 }}/>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.1em', marginBottom: 4, textAlign: 'center' }}>{lesson.title.toUpperCase()}</div>
      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, marginBottom: 22, textAlign: 'center' }}>{lesson.subtitle}</div>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 20 }}>
        {lesson.steps.map((_, i) => (
          <div key={i} style={{
            width: i === currentStep ? 18 : 7, height: 3.5, borderRadius: 3,
            background: i <= currentStep ? GOLD : 'rgba(255,255,255,0.08)',
            opacity: i < currentStep ? 0.5 : 1, transition: 'all 0.3s ease',
          }}/>
        ))}
      </div>

      {/* Current instruction */}
      <div style={{
        width: '100%', maxWidth: 320, borderRadius: 12, padding: '20px 16px',
        background: 'rgba(10,0,20,0.8)', border: '1.5px solid rgba(253,224,71,0.18)',
        textAlign: 'center', marginBottom: 20,
      }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: GOLD, letterSpacing: '0.2em', marginBottom: 10 }}>STEP {currentStep + 1} OF {lesson.steps.length}</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>{lesson.steps[currentStep]}</div>
      </div>

      {/* Video placeholder */}
      <div style={{
        width: '100%', maxWidth: 320, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(10,0,20,0.6)', border: '1px dashed rgba(168,85,247,0.15)',
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
      }}>
        <Play size={14} color="rgba(168,85,247,0.3)"/>
        <div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 6.5, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>VIDEO LESSON COMING SOON</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9.5, color: 'rgba(255,255,255,0.15)', marginTop: 1 }}>Coach breakdown will appear here.</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
        {currentStep > 0 && (
          <button onClick={() => setCurrentStep(s => s - 1)} style={{
            flex: 1, padding: '12px 0', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
            fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
          }}>BACK</button>
        )}
        {!isLastStep ? (
          <button onClick={() => setCurrentStep(s => s + 1)} style={{
            flex: 1, padding: '12px 0', borderRadius: 10,
            background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
            border: 'none', color: C.bg,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer',
            boxShadow: '0 0 16px rgba(253,224,71,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>NEXT <ChevronRight size={13}/></button>
        ) : (
          <button onClick={() => onComplete(lesson)} style={{
            flex: 1, padding: '12px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', color: '#fff',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer',
            boxShadow: '0 0 16px rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>COMPLETE LESSON <CheckCircle size={13}/></button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PracticeMode({ initialDisc = 'Boxing', initialView = 'library', onBack, onHome }) {
  const [view, setView] = useState(initialView === 'startHere' ? 'startHere' : 'library');
  const [discipline, setDisc] = useState(PRACTICE_DISCIPLINES.includes(initialDisc) ? initialDisc : 'Boxing');
  const [category, setCategory] = useState('Strikes');
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(false);

  // Start Here state
  const [shDisc, setShDisc] = useState('Boxing');
  const [activeLesson, setActiveLesson] = useState(null);
  const [completed, setCompleted] = useState(() => getCompletedLessons());

  const techniques = getTechniquesFor(discipline, category);

  const showToast = useCallback(() => {
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  }, []);

  const openDetail = useCallback((t) => {
    showToast();
    setDetail(t);
  }, [showToast]);

  const closeDetail = () => setDetail(null);

  const goNext = () => {
    if (!detail) return;
    const sameSet = getTechniquesFor(discipline, category);
    const idx = sameSet.findIndex(t => t.name === detail.name);
    const next = sameSet[(idx + 1) % sameSet.length];
    setDetail(next);
    showToast();
  };

  const handleCompleteLesson = (lesson) => {
    markLessonComplete(lesson.id);
    addStartHereLesson(lesson.title);
    setCompleted(getCompletedLessons());
    setActiveLesson(null);
  };

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

        {/* Tab selector: Start Here | Technique Library */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexShrink: 0 }}>
          <button className={`pm-tab-btn${view === 'startHere' ? ' active' : ''}`} onClick={() => setView('startHere')}>
            BASIC
          </button>
          <button className={`pm-tab-btn${view === 'library' ? ' active' : ''}`} onClick={() => setView('library')}>
            TECHNIQUE LIBRARY
          </button>
        </div>

        {/* ─── Start Here View ─── */}
        {view === 'startHere' && (
          <>
            {/* Discipline selector */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
              {['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'].map(d => (
                <button key={d} className={`pm-disc-pill${shDisc === d ? ' active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => setShDisc(d)}>
                  {d.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Count */}
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'rgba(168,85,247,0.4)', letterSpacing: '0.1em', marginBottom: 8, flexShrink: 0 }}>
              {(START_HERE_LESSONS[shDisc] || []).length} LESSON{(START_HERE_LESSONS[shDisc] || []).length !== 1 ? 'S' : ''} &bull; BEGINNER &bull; +20 XP EACH
            </div>

            {/* Scrollable list */}
            <div className="pm-technique-list" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))', paddingRight: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(START_HERE_LESSONS[shDisc] || []).map((lesson, idx) => {
                  const done = completed.includes(lesson.id);
                  return (
                    <button key={lesson.id} className="pm-card" onClick={() => setActiveLesson(lesson)} style={{ width: '100%', border: 'none', textAlign: 'left' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: done ? 'rgba(34,197,94,0.07)' : 'rgba(168,85,247,0.07)',
                        border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'rgba(168,85,247,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      }}>
                        {done
                          ? <CheckCircle size={18} style={{ color: '#22c55e' }}/>
                          : <Play size={18} style={{ color: 'rgba(168,85,247,0.45)', marginLeft: 2 }}/>
                        }
                        <div style={{
                          position: 'absolute', bottom: -4, right: -4,
                          width: 16, height: 16, borderRadius: '50%',
                          background: done ? 'rgba(34,197,94,0.15)' : 'rgba(10,0,20,0.95)',
                          border: `1px solid ${done ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.3)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {done
                            ? <CheckCircle size={7} style={{ color: '#22c55e' }}/>
                            : <Lock size={7} style={{ color: 'rgba(168,85,247,0.65)' }}/>
                          }
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em' }}>{lesson.title}</span>
                          <LevelBadge level="Beginner"/>
                          {done && (
                            <span style={{
                              fontFamily: "'Press Start 2P',monospace", fontSize: 6,
                              color: '#22c55e', letterSpacing: '0.06em',
                              padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                            }}>DONE</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.3 }}>{lesson.subtitle}</div>
                        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'rgba(168,85,247,0.4)', marginTop: 4, letterSpacing: '0.07em' }}>{lesson.steps.length} STEPS &bull; VIDEO COMING SOON</div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'rgba(168,85,247,0.35)', flexShrink: 0 }}/>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 20, textAlign: 'center', fontFamily: "'Press Start 2P',monospace", fontSize: 6.5, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.18em' }}>TRAIN &middot; FIGHT &middot; WIN</div>
            </div>
          </>
        )}

        {/* ─── Technique Library View ─── */}
        {view === 'library' && (
          <>
            {/* Discipline pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
              {PRACTICE_DISCIPLINES.map(d => (
                <button key={d} className={`pm-disc-pill${discipline === d ? ' active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => { setDisc(d); setDetail(null); }}>
                  {d.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexShrink: 0 }}>
              {PRACTICE_CATEGORIES.map(c => (
                <button key={c} className={`pm-cat-pill${category === c ? ' active' : ''}`} onClick={() => { setCategory(c); setDetail(null); }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Count */}
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: 'rgba(168,85,247,0.4)', letterSpacing: '0.1em', marginBottom: 8, flexShrink: 0 }}>
              {techniques.length} TECHNIQUE{techniques.length !== 1 ? 'S' : ''} &bull; ALL LOCKED
            </div>

            {/* Scrollable list */}
            <div className="pm-technique-list" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))', paddingRight: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {techniques.length > 0 ? techniques.map(t => (
                  <TechniqueCard key={t.name} technique={t} onTap={openDetail}/>
                )) : (
                  <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: "'Rajdhani',sans-serif", fontSize: 14, color: C.muted }}>Content coming soon.</div>
                )}
              </div>
              <div style={{ marginTop: 20, textAlign: 'center', fontFamily: "'Press Start 2P',monospace", fontSize: 6.5, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.18em' }}>TRAIN &middot; FIGHT &middot; WIN</div>
            </div>
          </>
        )}
      </div>

      {/* Technique Detail overlay */}
      {detail && (
        <TechniqueDetail technique={detail} onBack={closeDetail} onNext={goNext} onToast={showToast}/>
      )}

      {/* Start Here Lesson overlay */}
      {activeLesson && (
        <StartHereLessonView lesson={activeLesson} onBack={() => setActiveLesson(null)} onComplete={handleCompleteLesson}/>
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
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: NEON, letterSpacing: '0.08em' }}>Practice Mode coming soon.</span>
        </div>
      )}
    </PhoneFrame>
  );
}
