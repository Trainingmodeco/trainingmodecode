import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import IntroLogo from './IntroLogo';
import { ChevronRight, ChevronLeft, Play, House } from 'lucide-react';
import { C } from './Styles';

const GOLD = C.yellow;

const GOALS = [
  'Get Fit',
  'Learn Combat Basics',
  'Build Fight Conditioning',
  'Lose Weight',
  'Build Strength',
  'Train Like a Fighter',
];

const LEVELS = [
  { id: 'Beginner', label: 'Beginner', desc: 'New to training' },
  { id: 'Some Training', label: 'Some Training', desc: '3-6 months' },
  { id: 'Experienced', label: 'Experienced', desc: '1+ years' },
  { id: 'Advanced', label: 'Advanced', desc: '3+ years' },
];

const SPECIALTIES = [
  'BOXING',
  'KICKBOXING',
  'MUAY THAI',
  'MMA',
  'GRAPPLING/WRESTLING',
  'GENERAL FITNESS',
  'COMBAT CONDITIONING',
];

// Total ordered steps: Welcome, Name, Goal, Experience, Specialty, Body, Recommendation
const STEP = {
  WELCOME: 0,
  NAME: 1,
  GOAL: 2,
  EXPERIENCE: 3,
  SPECIALTY: 4,
  BODY: 5,
  RECOMMEND: 6,
};
const TOTAL_STEPS = 7;

function getRecommendation(goal, experience) {
  const isNew = experience === 'Beginner' || experience === 'Some Training';

  if (isNew && goal === 'Learn Combat Basics') {
    return { title: 'Fighting Stance + Jab', type: 'startHere', desc: 'Learn your first combat technique with guided lessons.' };
  }
  if (isNew && goal === 'Get Fit') {
    return { title: '12 Minute Bodyweight Starter', type: 'quickMission', desc: 'A short bodyweight circuit to get moving.' };
  }
  if (isNew && goal === 'Lose Weight') {
    return { title: '15 Minute Fat Burn Circuit', type: 'quickMission', desc: 'High-energy bodyweight exercises to torch calories.' };
  }
  if (goal === 'Build Fight Conditioning') {
    return { title: 'Fighter Conditioning Starter', type: 'quickMission', desc: 'Combat-inspired conditioning to build endurance.' };
  }
  if (goal === 'Build Strength') {
    return { title: 'Strength Builder — Weighted', type: 'quickMission', desc: 'Weighted compound moves to build raw power.' };
  }
  if (!isNew) {
    return { title: 'Fight Focus — 3 Round Starter', type: 'fightFocus', desc: 'Timed rounds with coach prompts. Built for fighters.' };
  }
  return { title: 'Quick Mission — Bodyweight Starter', type: 'quickMission', desc: 'A quick guided session to get you moving.' };
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(255,255,255,0.08)',
  color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 14,
  outline: 'none',
};

function StepTitle({ title, subtitle }) {
  return (
    <>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
        color: '#fff', letterSpacing: '0.1em', textAlign: 'center', marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted,
        textAlign: 'center', marginBottom: 22,
      }}>{subtitle}</div>
    </>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 12,
      background: disabled ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
      color: disabled ? 'rgba(255,255,255,0.2)' : C.bg,
      border: 'none',
      fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
      letterSpacing: '0.14em', cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 0 20px rgba(253,224,71,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {children}
    </button>
  );
}

function SkipButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 10,
      background: 'transparent', border: 'none',
      color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
      letterSpacing: '0.14em', cursor: 'pointer',
    }}>
      SKIP FOR NOW · EDIT LATER
    </button>
  );
}

function UnitToggle({ options, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map(u => (
        <button key={u} onClick={() => onPick(u)} style={{
          padding: '8px 10px', borderRadius: 6, minHeight: 38,
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
          background: u === value ? 'rgba(253,224,71,0.1)' : 'rgba(10,0,20,0.7)',
          color: u === value ? GOLD : C.muted,
          border: `1.5px solid ${u === value ? GOLD : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer', transition: 'all 0.18s',
        }}>{u}</button>
      ))}
    </div>
  );
}

export default function Onboarding({ onComplete, onHome }) {
  const [step, setStep] = useState(STEP.WELCOME);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [sex, setSex] = useState('MALE');
  const [age, setAge] = useState('');
  const [heightVal, setHeightVal] = useState('');
  const [heightUnit, setHeightUnit] = useState('FT/IN');
  const [weightVal, setWeightVal] = useState('');
  const [weightUnit, setWeightUnit] = useState('LBS');

  const recommendation = getRecommendation(goal, experience);

  const buildProfile = () => ({
    name: name.trim(),
    sex: sex.toLowerCase(),
    age,
    heightVal,
    heightUnit,
    weightVal,
    weightUnit,
    experience,
    goal,
    specialty,
  });

  const goBack = () => setStep(s => Math.max(0, s - 1));

  const handleFinish = () => {
    onComplete({ goal, experience, recommendation, profile: buildProfile() });
  };

  const handleGoHome = () => {
    onHome({ goal, experience, profile: buildProfile() });
  };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>
      <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={10}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: step === STEP.WELCOME ? 'center' : 'flex-start',
        minHeight: '100dvh', padding: '32px 20px',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
        paddingTop: step === STEP.WELCOME ? 32 : 46,
        overflowX: 'hidden',
      }}>

        {/* Back button — every step after welcome */}
        {step > STEP.WELCOME && (
          <button onClick={goBack} style={{
            position: 'absolute', top: 16, left: 16, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 11px 7px 8px', cursor: 'pointer',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
            letterSpacing: '0.1em', color: C.muted,
          }}>
            <ChevronLeft size={13}/> BACK
          </button>
        )}

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 26 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 7, height: 4, borderRadius: 4,
              background: i === step ? GOLD : i < step ? 'rgba(253,224,71,0.4)' : 'rgba(255,255,255,0.12)',
              transition: 'all 0.3s ease',
            }}/>
          ))}
        </div>

        {/* SCREEN 0: Welcome */}
        {step === STEP.WELCOME && (
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <IntroLogo size={50}/>
            <h1 style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
              color: '#fff', letterSpacing: '0.12em', marginTop: 20, marginBottom: 12,
              textShadow: '0 0 14px rgba(253,224,71,0.3)',
            }}>WELCOME TO<br/>TRAINING MODE</h1>
            <p style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 500,
              color: C.muted, lineHeight: 1.6, marginBottom: 20,
            }}>
              Let&apos;s build your fighter profile. It takes under a minute, and you can change every answer later.
            </p>
            <PrimaryButton onClick={() => setStep(STEP.NAME)}>
              START SETUP <ChevronRight size={16}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 1: Name */}
        {step === STEP.NAME && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <StepTitle title="WHAT SHOULD WE CALL YOU?" subtitle="Your name shows up on your player card."/>
            <input
              type="text"
              placeholder="Trainee"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            <PrimaryButton onClick={() => setStep(STEP.GOAL)}>
              CONTINUE <ChevronRight size={15}/>
            </PrimaryButton>
            <SkipButton onClick={() => setStep(STEP.GOAL)}/>
          </div>
        )}

        {/* SCREEN 2: Goal */}
        {step === STEP.GOAL && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <StepTitle title="WHAT ARE YOU TRAINING FOR?" subtitle="Pick your primary training goal."/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => {
                const active = goal === g;
                return (
                  <button key={g} onClick={() => setGoal(g)} style={{
                    width: '100%', padding: '13px 16px', borderRadius: 10,
                    background: active ? 'rgba(253,224,71,0.1)' : 'rgba(10,0,20,0.7)',
                    border: `1.5px solid ${active ? GOLD : 'rgba(255,255,255,0.08)'}`,
                    color: active ? GOLD : C.text,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                    letterSpacing: '0.08em', textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(253,224,71,0.15)' : 'none',
                  }}>
                    {g.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <PrimaryButton onClick={() => { if (goal) setStep(STEP.EXPERIENCE); }} disabled={!goal}>
              CONTINUE <ChevronRight size={15}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 3: Experience */}
        {step === STEP.EXPERIENCE && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <StepTitle title="EXPERIENCE LEVEL" subtitle="How long have you been training?"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEVELS.map(l => {
                const active = experience === l.id;
                return (
                  <button key={l.id} onClick={() => setExperience(l.id)} style={{
                    width: '100%', padding: '13px 16px', borderRadius: 10,
                    background: active ? 'rgba(253,224,71,0.1)' : 'rgba(10,0,20,0.7)',
                    border: `1.5px solid ${active ? GOLD : 'rgba(255,255,255,0.08)'}`,
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(253,224,71,0.15)' : 'none',
                  }}>
                    <div style={{
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                      color: active ? GOLD : C.text, letterSpacing: '0.08em',
                    }}>{l.label.toUpperCase()}</div>
                    <div style={{
                      fontFamily: "'Rajdhani',sans-serif", fontSize: 11,
                      color: C.muted, marginTop: 2,
                    }}>{l.desc}</div>
                  </button>
                );
              })}
            </div>
            <PrimaryButton onClick={() => { if (experience) setStep(STEP.SPECIALTY); }} disabled={!experience}>
              CONTINUE <ChevronRight size={15}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 4: Specialty */}
        {step === STEP.SPECIALTY && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <StepTitle title="TRAINING SPECIALTY" subtitle="Pick the discipline you want to focus on."/>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SPECIALTIES.map(s => {
                const active = specialty === s;
                return (
                  <button key={s} onClick={() => setSpecialty(active ? '' : s)} style={{
                    padding: '11px 15px', borderRadius: 20,
                    background: active ? 'rgba(253,224,71,0.1)' : 'rgba(10,0,20,0.7)',
                    border: `1.5px solid ${active ? GOLD : 'rgba(255,255,255,0.08)'}`,
                    color: active ? GOLD : C.text,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                    letterSpacing: '0.06em', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: active ? '0 0 12px rgba(253,224,71,0.15)' : 'none',
                  }}>
                    {s}
                  </button>
                );
              })}
            </div>
            <PrimaryButton onClick={() => setStep(STEP.BODY)}>
              CONTINUE <ChevronRight size={15}/>
            </PrimaryButton>
            <SkipButton onClick={() => setStep(STEP.BODY)}/>
          </div>
        )}

        {/* SCREEN 5: Body profile */}
        {step === STEP.BODY && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <StepTitle title="BODY PROFILE" subtitle="Optional — helps tailor your training. Skip anytime."/>

            {/* Sex + Age */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted, letterSpacing: '0.18em', marginBottom: 6, fontWeight: 600 }}>SEX</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['MALE', 'FEMALE'].map(s => (
                    <button key={s} onClick={() => setSex(s)} style={{
                      flex: 1, padding: '10px 0', borderRadius: 8,
                      background: sex === s ? 'rgba(253,224,71,0.1)' : 'rgba(10,0,20,0.7)',
                      border: `1.5px solid ${sex === s ? GOLD : 'rgba(255,255,255,0.08)'}`,
                      color: sex === s ? GOLD : C.text,
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                      letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.18s',
                    }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted, letterSpacing: '0.18em', marginBottom: 6, fontWeight: 600 }}>AGE</div>
                <input type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)}
                  style={{ ...inputStyle, fontSize: 13 }}/>
              </div>
            </div>

            {/* Height */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted, letterSpacing: '0.18em', marginBottom: 6, fontWeight: 600 }}>HEIGHT</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder={heightUnit === 'FT/IN' ? '5\'10"' : '178'} value={heightVal}
                  onChange={e => setHeightVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13 }}/>
                <UnitToggle options={['FT/IN', 'CM']} value={heightUnit} onPick={setHeightUnit}/>
              </div>
            </div>

            {/* Weight */}
            <div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted, letterSpacing: '0.18em', marginBottom: 6, fontWeight: 600 }}>WEIGHT</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" placeholder={weightUnit === 'LBS' ? '175' : '80'} value={weightVal}
                  onChange={e => setWeightVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13 }}/>
                <UnitToggle options={['LBS', 'KG']} value={weightUnit} onPick={setWeightUnit}/>
              </div>
            </div>

            <PrimaryButton onClick={() => setStep(STEP.RECOMMEND)}>
              CONTINUE <ChevronRight size={15}/>
            </PrimaryButton>
            <SkipButton onClick={() => setStep(STEP.RECOMMEND)}/>
          </div>
        )}

        {/* SCREEN 6: Recommendation */}
        {step === STEP.RECOMMEND && (
          <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.neon,
              letterSpacing: '0.2em', marginBottom: 10,
            }}>YOUR FIRST MISSION</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.1em', marginBottom: 6,
            }}>RECOMMENDED START</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, marginBottom: 20,
            }}>Based on your goal and experience level.</div>

            {/* Recommendation Card */}
            <div style={{
              padding: '18px 16px', borderRadius: 12,
              background: 'rgba(10,0,20,0.8)', border: '1.5px solid rgba(253,224,71,0.25)',
              marginBottom: 16, textAlign: 'left',
              boxShadow: '0 0 20px rgba(253,224,71,0.08)',
            }}>
              <div style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: GOLD,
                letterSpacing: '0.15em', marginBottom: 8,
              }}>START HERE</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
                color: '#fff', letterSpacing: '0.06em', marginBottom: 6,
              }}>{recommendation.title}</div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
                color: C.muted, lineHeight: 1.5,
              }}>{recommendation.desc}</div>
            </div>

            {/* Video Placeholder */}
            <div style={{
              padding: '20px 16px', borderRadius: 10,
              background: 'rgba(10,0,20,0.7)', border: '1px dashed rgba(168,85,247,0.3)',
              marginBottom: 22, textAlign: 'center',
            }}>
              <Play size={28} color="rgba(168,85,247,0.4)" style={{ marginBottom: 8 }}/>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginBottom: 4,
              }}>VIDEO GUIDE COMING SOON</div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.2)',
              }}>Coach intro will appear here.</div>
            </div>

            {/* CTAs */}
            <button onClick={handleFinish} style={{
              width: '100%', padding: '15px 0', borderRadius: 12,
              background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
              color: C.bg, border: 'none',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
              letterSpacing: '0.14em', cursor: 'pointer',
              boxShadow: '0 0 24px rgba(253,224,71,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 10,
            }}>
              <Play size={15}/> START FIRST MISSION
            </button>

            <button onClick={handleGoHome} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
              letterSpacing: '0.1em', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <House size={13}/> GO TO HOME
            </button>
          </div>
        )}

      </div>
    </PhoneFrame>
  );
}
