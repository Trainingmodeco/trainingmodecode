// LEGACY: This screen will be replaced by guided video lessons in the next release.
import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import IntroLogo from './IntroLogo';
import { ChevronLeft, ChevronRight, Play, CircleCheck as CheckCircle, Shield } from 'lucide-react';
import { C } from './Styles';
import { addStartHereLesson } from './data/userStats';

const GOLD = C.yellow;

const LESSONS = [
  {
    id: 'stance',
    title: 'Fighting Stance',
    subtitle: 'Learn your base, guard, and foot position.',
    steps: [
      'Stand with your feet shoulder-width apart.',
      'Step your lead foot forward (left foot if right-handed).',
      'Keep your knees slightly bent — stay light.',
      'Bring your hands up to protect your chin.',
      'Tuck your elbows close to your ribs.',
      'Chin down, eyes forward.',
      'Move forward and back for 30 seconds. Stay balanced.',
    ],
  },
  {
    id: 'jab_cross',
    title: 'Jab + Cross',
    subtitle: 'Build your first two punches.',
    steps: [
      'Start in your fighting stance.',
      'JAB: Extend your lead hand straight out, palm down.',
      'Snap it back to guard immediately.',
      'CROSS: Rotate your back hip and throw your rear hand straight.',
      'Your back heel lifts as you rotate.',
      'Return to guard after every punch.',
      'Practice 10 jabs, then 10 crosses, then 10 jab-cross combos.',
    ],
  },
  {
    id: 'first_combo',
    title: 'First Combo',
    subtitle: 'Put your stance and punches together.',
    steps: [
      'Start in your fighting stance — hands up, chin down.',
      'Throw a JAB (lead hand, quick snap).',
      'Follow with a CROSS (rear hand, rotate hips).',
      'Step forward with a JAB again.',
      'Return to stance — guard up.',
      'Repeat the 1-2-1 combo 10 times.',
      'Focus on balance and returning to guard between combos.',
    ],
  },
];

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

export default function StartHere({ onBack }) {
  const [activeLesson, setActiveLesson] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(() => getCompletedLessons());

  const handleCompleteLesson = (lesson) => {
    markLessonComplete(lesson.id);
    addStartHereLesson(lesson.title);
    setCompleted(getCompletedLessons());
    setActiveLesson(null);
    setCurrentStep(0);
  };

  if (activeLesson) {
    const lesson = LESSONS.find(l => l.id === activeLesson);
    const isLastStep = currentStep >= lesson.steps.length - 1;

    return (
      <PhoneFrame useBrandBg>
        <Embers count={3}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={10}/>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', minHeight: '100dvh',
          padding: '24px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
          overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}>
          <button onClick={() => { setActiveLesson(null); setCurrentStep(0); }} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: C.muted, display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: "'Rajdhani',sans-serif", fontSize: 13, cursor: 'pointer', marginBottom: 20,
          }}>
            <ChevronLeft size={18}/> BACK TO LESSONS
          </button>

          <Shield size={28} color={GOLD} style={{ marginBottom: 12 }}/>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
            color: '#fff', letterSpacing: '0.1em', marginBottom: 6, textAlign: 'center',
          }}>{lesson.title.toUpperCase()}</div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.muted,
            marginBottom: 28, textAlign: 'center',
          }}>{lesson.subtitle}</div>

          {/* Step progress */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
            {lesson.steps.map((_, i) => (
              <div key={i} style={{
                width: i === currentStep ? 20 : 8, height: 4, borderRadius: 4,
                background: i < currentStep ? GOLD : i === currentStep ? GOLD : 'rgba(255,255,255,0.1)',
                opacity: i < currentStep ? 0.5 : 1,
                transition: 'all 0.3s ease',
              }}/>
            ))}
          </div>

          {/* Current instruction */}
          <div style={{
            width: '100%', maxWidth: 340, borderRadius: 14, padding: '24px 20px',
            background: 'rgba(10,0,20,0.8)', border: '1.5px solid rgba(253,224,71,0.2)',
            textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: GOLD, letterSpacing: '0.2em', marginBottom: 12,
            }}>STEP {currentStep + 1} OF {lesson.steps.length}</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 600,
              color: '#fff', lineHeight: 1.5,
            }}>{lesson.steps[currentStep]}</div>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 340 }}>
            {currentStep > 0 && (
              <button onClick={() => setCurrentStep(s => s - 1)} style={{
                flex: 1, padding: '13px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              }}>BACK</button>
            )}
            {!isLastStep ? (
              <button onClick={() => setCurrentStep(s => s + 1)} style={{
                flex: 1, padding: '13px 0', borderRadius: 10,
                background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
                border: 'none', color: C.bg,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
                boxShadow: '0 0 18px rgba(253,224,71,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>NEXT <ChevronRight size={14}/></button>
            ) : (
              <button onClick={() => handleCompleteLesson(lesson)} style={{
                flex: 1, padding: '13px 0', borderRadius: 10,
                background: `linear-gradient(135deg, #22c55e, #16a34a)`,
                border: 'none', color: '#fff',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
                boxShadow: '0 0 18px rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>COMPLETE LESSON <CheckCircle size={14}/></button>
            )}
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={10}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh',
        padding: '24px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        <button onClick={onBack} style={{
          alignSelf: 'flex-start', background: 'none', border: 'none',
          color: C.muted, display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: "'Rajdhani',sans-serif", fontSize: 13, cursor: 'pointer', marginBottom: 20,
        }}>
          <ChevronLeft size={18}/> BACK
        </button>

        <IntroLogo size={36}/>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18,
          color: GOLD, letterSpacing: '0.12em', marginTop: 14, marginBottom: 4,
          textShadow: '0 0 12px rgba(253,224,71,0.3)',
        }}>START HERE</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.muted,
          textAlign: 'center', marginBottom: 28, maxWidth: 280,
        }}>New to combat training? Learn the basics step by step. No experience needed.</div>

        {/* Lessons */}
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LESSONS.map((lesson, idx) => {
            const done = completed.includes(lesson.id);
            return (
              <div key={lesson.id} style={{
                borderRadius: 14, padding: '16px 18px',
                background: done ? 'rgba(34,197,94,0.04)' : 'rgba(10,0,20,0.8)',
                border: `1.5px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgba(253,224,71,0.2)'}`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: done ? 'rgba(34,197,94,0.12)' : 'rgba(253,224,71,0.08)',
                    border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgba(253,224,71,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
                    color: done ? '#22c55e' : GOLD,
                  }}>{done ? <CheckCircle size={14}/> : idx + 1}</div>
                  <div style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
                    color: '#fff', letterSpacing: '0.06em',
                  }}>{lesson.title.toUpperCase()}</div>
                  {done && (
                    <span style={{
                      marginLeft: 'auto', fontFamily: "'Orbitron',sans-serif",
                      fontSize: 7, fontWeight: 700, color: '#22c55e', letterSpacing: '0.1em',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                    }}>DONE</span>
                  )}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
                  color: C.muted, lineHeight: 1.4, marginBottom: 12,
                }}>{lesson.subtitle}</div>

                {/* Video placeholder */}
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(10,0,20,0.6)', border: '1px dashed rgba(168,85,247,0.15)',
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                }}>
                  <Play size={16} color="rgba(168,85,247,0.3)"/>
                  <div>
                    <div style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
                      color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
                    }}>VIDEO LESSON COMING SOON</div>
                    <div style={{
                      fontFamily: "'Rajdhani',sans-serif", fontSize: 10,
                      color: 'rgba(255,255,255,0.18)', marginTop: 1,
                    }}>Coach breakdown will appear here.</div>
                  </div>
                </div>

                {!done ? (
                  <button onClick={() => { setActiveLesson(lesson.id); setCurrentStep(0); }} style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
                    border: 'none', color: C.bg,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                    fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(253,224,71,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>START LESSON <ChevronRight size={14}/></button>
                ) : (
                  <button onClick={() => { setActiveLesson(lesson.id); setCurrentStep(0); }} style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: C.muted,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                    fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>REVIEW LESSON <ChevronRight size={14}/></button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: 24, fontFamily: "'Press Start 2P',monospace", fontSize: 7,
          color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', textAlign: 'center',
        }}>+20 XP PER LESSON</div>
      </div>
    </PhoneFrame>
  );
}
