import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import IntroLogo from './IntroLogo';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { GOALS, LEVELS, DISCIPLINE_CHOICES } from './data/profileOptions';
import { firstPick } from './data/recommendations';
import { loadStats } from './data/userStats';
import { fitKitCSS, GOLD, GOLD_FILL, VIOLET, VIOLET_TEXT, MUTED, CARD, HEAD, BODY, chf } from './shared/FitSetupKit';

// The setup questionnaire, in the Revamp's look: Chakra Petch headings over
// Barlow, violet selection, one gold chamfered CONTINUE. Same seven steps and
// the same answers as before — the answer lists are shared with Profile's
// edit screen (data/profileOptions), so changing an answer later changes the
// same answer.
const NOT_SURE = 'Not sure yet';

// Welcome, Name, Goal, Experience, Discipline, Body, First workout
const STEP = {
  WELCOME: 0,
  NAME: 1,
  GOAL: 2,
  EXPERIENCE: 3,
  DISCIPLINE: 4,
  BODY: 5,
  RECOMMEND: 6,
};
const TOTAL_STEPS = 7;

const css = `
.ob-opt { transition: border-color .18s, background .18s, box-shadow .18s; }
.ob-opt[aria-checked="false"]:hover, .ob-opt[aria-checked="false"]:focus-visible { border-color: ${VIOLET} !important; background: rgba(157,108,255,.1) !important; }
.ob-skip { transition: color .18s; }
.ob-skip:hover, .ob-skip:focus-visible { color: #fff !important; }
.ob-in::placeholder { color: #5E5878; }
.ob-in:focus { border-color: ${VIOLET} !important; box-shadow: 0 0 0 3px rgba(157,108,255,.18); }
`;

const inputStyle = {
  width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 10,
  background: CARD, border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', font: `700 16px ${HEAD}`, outline: 'none',
};

const fieldLabel = { font: `600 11px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED, marginBottom: 7 };

function StepTitle({ kicker, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {kicker && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.18em', color: VIOLET_TEXT, marginBottom: 8 }}>{kicker}</div>}
      <h1 style={{ margin: 0, font: `700 26px ${HEAD}`, lineHeight: 1.08, color: '#fff' }}>{title}</h1>
      {subtitle && <p style={{ margin: '8px 0 0', font: `500 15px ${BODY}`, lineHeight: 1.4, color: MUTED }}>{subtitle}</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button type="button" className="fk-gold" onClick={onClick} disabled={disabled} style={{
      ...chf, marginTop: 22, width: '100%', height: 56, border: 'none', flexShrink: 0,
      background: disabled ? '#1B1730' : GOLD_FILL, color: disabled ? '#5E5878' : '#1A1204',
      font: `700 17px ${HEAD}`, letterSpacing: '0.18em', cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 0 28px rgba(242,190,69,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {children}
    </button>
  );
}

function SkipButton({ onClick }) {
  return (
    <button type="button" className="ob-skip" onClick={onClick} style={{
      marginTop: 8, width: '100%', height: 40, background: 'transparent', border: 'none',
      color: MUTED, font: `600 11px ${HEAD}`, letterSpacing: '0.16em', cursor: 'pointer',
    }}>
      SKIP FOR NOW · EDIT LATER
    </button>
  );
}

// One answer row: label (+ optional line), a check when chosen.
function Option({ active, onClick, label, desc }) {
  return (
    <button type="button" role="radio" aria-checked={active ? 'true' : 'false'} className="ob-opt" onClick={onClick} style={{
      width: '100%', minHeight: desc ? 60 : 52, padding: '10px 14px', borderRadius: 12, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
      background: active ? 'rgba(157,108,255,0.2)' : CARD,
      border: `1px solid ${active ? VIOLET : 'rgba(255,255,255,0.09)'}`,
      boxShadow: active ? '0 0 16px rgba(157,108,255,0.35)' : 'none',
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: `700 15px ${HEAD}`, letterSpacing: '0.04em', color: '#fff' }}>{label}</span>
        {desc && <span style={{ display: 'block', font: `500 13px ${BODY}`, color: MUTED, marginTop: 2 }}>{desc}</span>}
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
        border: `1.5px solid ${active ? GOLD : 'rgba(255,255,255,0.2)'}`, background: active ? GOLD : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{active && <Check size={13} color="#1A1204" strokeWidth={3}/>}</span>
    </button>
  );
}

// Two-way strip (sex, units) — the design's segmented control.
function Seg({ options, value, onPick, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: '1px solid rgba(255,255,255,0.09)', flexShrink: 0 }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-seg" onClick={() => onPick(o)} style={{
            flex: 1, minWidth: 52, height: 40, padding: '0 8px', border: 'none', cursor: 'pointer',
            font: `600 12px ${HEAD}`, letterSpacing: '0.1em',
            color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
            boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(STEP.WELCOME);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [sex, setSex] = useState('MALE');
  const [age, setAge] = useState('');
  const [heightVal, setHeightVal] = useState('');
  const [heightUnit, setHeightUnit] = useState('FT/IN');
  const [weightVal, setWeightVal] = useState('');
  const [weightUnit, setWeightUnit] = useState('LBS');

  // The first workout — the same pick Home's top card will show them.
  const pick = step === STEP.RECOMMEND
    ? firstPick({ profile: { goal, experience, discipline: discipline || 'Boxing' }, stats: loadStats() })
    : null;

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
    // The discipline tabs open on this; "not sure" leaves them on Boxing.
    specialty: discipline ? discipline.toUpperCase() : '',
    ...(discipline ? { discipline } : {}),
  });

  const goBack = () => setStep(s => Math.max(0, s - 1));

  const handleFinish = () => {
    onComplete({ goal, experience, recommendation: pick, profile: buildProfile() });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + css }}/>
      <Embers count={3}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', boxSizing: 'border-box', padding: '14px 20px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', overflowX: 'hidden',
      }}>

        {/* Top bar: back (after welcome) · progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, flexShrink: 0 }}>
          {step > STEP.WELCOME ? (
            <button type="button" className="fk-back" onClick={goBack} aria-label="Back" style={{
              width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
            }}><ChevronLeft size={22}/></button>
          ) : <span style={{ width: 32 }}/>}
          <div style={{ flex: 1, display: 'flex', gap: 4 }} aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= step ? GOLD : '#1B1730',
                boxShadow: i === step ? '0 0 8px rgba(242,190,69,0.6)' : 'none',
                transition: 'background .3s ease',
              }}/>
            ))}
          </div>
          <span style={{ font: `700 12px ${HEAD}`, color: MUTED, minWidth: 32, textAlign: 'right' }}>{step + 1}/{TOTAL_STEPS}</span>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: step === STEP.WELCOME ? 'center' : 'flex-start',
          paddingTop: step === STEP.WELCOME ? 0 : 26, width: '100%', maxWidth: 380, margin: '0 auto',
        }}>

        {/* SCREEN 0: Welcome */}
        {step === STEP.WELCOME && (
          <div style={{ textAlign: 'center' }}>
            <IntroLogo size={56}/>
            <h1 style={{ margin: '22px 0 0', font: `700 30px ${HEAD}`, lineHeight: 1.05, color: '#fff' }}>
              Welcome to<br/><span style={{ color: GOLD }}>Training Mode</span>
            </h1>
            <p style={{ margin: '12px auto 0', maxWidth: 300, font: `500 16px ${BODY}`, lineHeight: 1.45, color: MUTED }}>
              Let&apos;s build your fighter profile. It takes under a minute, and you can change every answer later.
            </p>
            <PrimaryButton onClick={() => setStep(STEP.NAME)}>
              START SETUP <ChevronRight size={18}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 1: Name */}
        {step === STEP.NAME && (
          <div>
            <StepTitle kicker="YOUR PROFILE" title="What should we call you?" subtitle="Your name shows up on your player card."/>
            <input
              className="ob-in"
              type="text"
              placeholder="Trainee"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            <PrimaryButton onClick={() => setStep(STEP.GOAL)}>
              CONTINUE <ChevronRight size={18}/>
            </PrimaryButton>
            <SkipButton onClick={() => setStep(STEP.GOAL)}/>
          </div>
        )}

        {/* SCREEN 2: Goal */}
        {step === STEP.GOAL && (
          <div>
            <StepTitle kicker="YOUR GOAL" title="What are you training for?" subtitle="Pick the one that matters most."/>
            <div role="radiogroup" aria-label="Goal" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GOALS.map(g => (
                <Option key={g} active={goal === g} onClick={() => setGoal(g)} label={g}/>
              ))}
            </div>
            <PrimaryButton onClick={() => { if (goal) setStep(STEP.EXPERIENCE); }} disabled={!goal}>
              CONTINUE <ChevronRight size={18}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 3: Experience */}
        {step === STEP.EXPERIENCE && (
          <div>
            <StepTitle kicker="EXPERIENCE" title="How long have you been training?"/>
            <div role="radiogroup" aria-label="Experience" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEVELS.map(l => (
                <Option key={l.id} active={experience === l.id} onClick={() => setExperience(l.id)} label={l.label} desc={l.desc}/>
              ))}
            </div>
            <PrimaryButton onClick={() => { if (experience) setStep(STEP.DISCIPLINE); }} disabled={!experience}>
              CONTINUE <ChevronRight size={18}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 4: Discipline — the four tabs Fight Mode, Practice and
            Combat Conditioning share. */}
        {step === STEP.DISCIPLINE && (
          <div>
            <StepTitle kicker="DISCIPLINE" title="What do you want to fight in?" subtitle="Fight Mode, Practice and Combat Conditioning open on it. Switch any time with the tabs."/>
            <div role="radiogroup" aria-label="Discipline" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {DISCIPLINE_CHOICES.map(s => (
                <Option key={s} active={discipline === s} onClick={() => setDiscipline(s)} label={s}/>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Option active={discipline === ''} onClick={() => setDiscipline('')} label={NOT_SURE} desc="We'll start you on Boxing"/>
            </div>
            <PrimaryButton onClick={() => setStep(STEP.BODY)}>
              CONTINUE <ChevronRight size={18}/>
            </PrimaryButton>
          </div>
        )}

        {/* SCREEN 5: Body profile */}
        {step === STEP.BODY && (
          <div>
            <StepTitle kicker="OPTIONAL" title="Body profile" subtitle="Sets your fighter's look and tailors your training. Skip anytime."/>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1.3 }}>
                <div style={fieldLabel}>Sex</div>
                <Seg ariaLabel="Sex" options={['MALE', 'FEMALE']} value={sex} onPick={setSex}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Age</div>
                <input className="ob-in" type="number" inputMode="numeric" placeholder="25" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} aria-label="Age"/>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Height</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="ob-in" type="text" inputMode="decimal" placeholder={heightUnit === 'FT/IN' ? '5\'10"' : '178'} value={heightVal}
                  onChange={e => setHeightVal(e.target.value)} style={{ ...inputStyle, flex: 1 }} aria-label="Height"/>
                <Seg ariaLabel="Height unit" options={['FT/IN', 'CM']} value={heightUnit} onPick={setHeightUnit}/>
              </div>
            </div>

            <div>
              <div style={fieldLabel}>Weight</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="ob-in" type="number" inputMode="numeric" placeholder={weightUnit === 'LBS' ? '175' : '80'} value={weightVal}
                  onChange={e => setWeightVal(e.target.value)} style={{ ...inputStyle, flex: 1 }} aria-label="Weight"/>
                <Seg ariaLabel="Weight unit" options={['LBS', 'KG']} value={weightUnit} onPick={setWeightUnit}/>
              </div>
            </div>

            <PrimaryButton onClick={() => setStep(STEP.RECOMMEND)}>
              CONTINUE <ChevronRight size={18}/>
            </PrimaryButton>
            <SkipButton onClick={() => setStep(STEP.RECOMMEND)}/>
          </div>
        )}

        {/* SCREEN 6: First workout. It names the real workout Home's top card
            will hold (firstPick), and says so — setup goes on to Home, where
            the walkthrough starts on that card. */}
        {step === STEP.RECOMMEND && pick && (
          <div>
            <StepTitle kicker="SETUP COMPLETE" title="Your first workout" subtitle="Picked from your goal and experience."/>

            <section style={{
              position: 'relative', borderRadius: 16, overflow: 'hidden', padding: 18,
              background: 'linear-gradient(135deg,#1A1034 0%,#0D0A18 75%)',
              border: `1px solid ${pick.mode === 'fit' ? 'rgba(157,108,255,0.45)' : 'rgba(61,123,255,0.45)'}`,
            }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: pick.mode === 'fit' ? VIOLET : '#3D7BFF' }}/>
              <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: pick.mode === 'fit' ? VIOLET_TEXT : '#8FB4FF' }}>
                {pick.mode === 'fit' ? 'FIT MODE' : 'FIGHT MODE'}
              </div>
              <div style={{ font: `700 22px ${HEAD}`, lineHeight: 1.1, color: '#fff', marginTop: 6 }}>{pick.title}</div>
              <div style={{ font: `500 14px ${BODY}`, lineHeight: 1.45, color: MUTED, marginTop: 6 }}>{pick.subtitle}</div>
            </section>

            <p style={{ margin: '14px 0 0', font: `500 15px ${BODY}`, lineHeight: 1.45, color: '#DCD7EE' }}>
              It&apos;ll be waiting at the top of Home — tap START when you&apos;re ready.
            </p>

            <PrimaryButton onClick={handleFinish}>
              LET&apos;S GO <ChevronRight size={18}/>
            </PrimaryButton>
          </div>
        )}
        </div>
      </div>
    </PhoneFrame>
  );
}
