import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import WordmarkTM from './WordmarkTM';
import CornerHUD from './CornerHUD';
import { ChevronLeft, MessageSquare, Bell, Volume2 } from 'lucide-react';
import { C } from './Styles';
import { getAudioSettings, saveAudioSettings } from './data/audioEngine';
import { loadReminderSettings, saveReminderSettings, requestNotificationPermission, getNotificationPermissionStatus } from './data/reminderEngine';


function SectionLabel({ text }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted,
      letterSpacing: '0.18em', marginBottom: 4, fontWeight: 600,
    }}>{text}</div>
  );
}

function PillRow({ opts, val, onPick, wrap = false }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: wrap ? 'wrap' : 'nowrap', marginBottom: 4 }}>
      {opts.map(o => {
        const active = o === val;
        return (
          <button key={o} onClick={() => onPick(o)} style={{
            padding: '7px 14px', borderRadius: 20, minHeight: 34,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
            letterSpacing: '0.06em', transition: 'all 0.18s',
            background: active ? 'rgba(168,85,247,0.12)' : 'rgba(12,2,24,0.7)',
            color: active ? C.neon : 'rgba(255,255,255,0.45)',
            border: active ? '1.5px solid rgba(168,85,247,0.65)' : '1.5px solid rgba(255,255,255,0.07)',
            boxShadow: active ? '0 0 10px rgba(168,85,247,0.25)' : 'none',
            cursor: 'pointer',
          }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function AudioSlider({ label, value, onChange }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{
      background: 'rgba(12,2,24,0.8)', borderRadius: 8, padding: '6px 14px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: C.text }}>{label}</span>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: C.yellow }}>{pct}%</span>
      </div>
      <input type="range" min={0} max={100} value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        style={{
          width: '100%', height: 4, borderRadius: 2, appearance: 'none',
          background: `linear-gradient(to right, ${C.neon} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
          outline: 'none', cursor: 'pointer',
        }}/>
    </div>
  );
}

function AudioSettingsView({ onBack, onHome, voiceCoach, setVoiceCoach, coachStyle, setCoachStyle, encouragement, setEncouragement, audioSettings, updateAudio }) {
  const [saved, setSaved] = useState(false);

  const handleSaveAudio = () => {
    saveAudioSettings(audioSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PhoneFrame useBrandBg>
      <CornerHUD color="rgba(168,85,247,0.3)" size={24} inset={12}/>
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
      }}>
        <TrainingHeader
          title="AUDIO SETTINGS"
          subtitle="Voice and sound controls."
          onHome={onHome}
          showBack
          onBack={onBack}
        />

        <div className="no-scrollbar" style={{
          flex: 1, overflowX: 'hidden',
          padding: '12px 16px calc(190px + env(safe-area-inset-bottom, 0px))',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Voice Coach */}
            <div>
              <SectionLabel text="VOICE COACH"/>
              <PillRow opts={['FEMALE', 'MALE']} val={voiceCoach} onPick={setVoiceCoach}/>
            </div>

            {/* Coach Style */}
            <div>
              <SectionLabel text="COACH STYLE"/>
              <PillRow opts={['STANDARD', 'HYPE', 'CALM']} val={coachStyle} onPick={setCoachStyle}/>
            </div>

            {/* Mid-Round Encouragement */}
            <div>
              <SectionLabel text="MID-ROUND ENCOURAGEMENT"/>
              <PillRow opts={['OFF', 'LOW', 'NORMAL', 'HIGH']} val={encouragement.toUpperCase()} onPick={v => setEncouragement(v.toLowerCase())} wrap/>
            </div>

            {/* Volume Controls */}
            <div>
              <SectionLabel text="VOLUME CONTROLS"/>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <AudioSlider label="Voice Volume" value={audioSettings.voiceVolume} onChange={v => updateAudio('voiceVolume', v)}/>
                <AudioSlider label="Music Volume" value={audioSettings.musicVolume ?? 0.6} onChange={v => updateAudio('musicVolume', v)}/>
                <AudioSlider label="Bell / Beep Volume" value={audioSettings.sfxVolume} onChange={v => updateAudio('sfxVolume', v)}/>
                <AudioSlider label="Master Volume" value={audioSettings.masterVolume} onChange={v => updateAudio('masterVolume', v)}/>
              </div>
            </div>

            {/* Ducking */}
            <div>
              <SectionLabel text="AUDIO DUCKING"/>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(12,2,24,0.8)', borderRadius: 8, padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: C.text }}>Duck Music During Commands</span>
                  <button onClick={() => updateAudio('duckingEnabled', !audioSettings.duckingEnabled)} style={{
                    width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                    background: audioSettings.duckingEnabled ? C.neon : 'rgba(255,255,255,0.12)',
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: audioSettings.duckingEnabled ? 20 : 2,
                      transition: 'left 0.2s',
                    }}/>
                  </button>
                </div>
                {audioSettings.duckingEnabled && (
                  <div style={{
                    background: 'rgba(12,2,24,0.8)', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: C.text, display: 'block', marginBottom: 6 }}>Ducking Strength</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['light', 'normal', 'strong'].map(s => (
                        <button key={s} onClick={() => updateAudio('duckingStrength', s)} style={{
                          flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          background: (audioSettings.duckingStrength || 'normal') === s ? C.neon : 'rgba(255,255,255,0.08)',
                          color: (audioSettings.duckingStrength || 'normal') === s ? '#0a0014' : C.muted,
                          transition: 'all 0.2s',
                        }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ paddingTop: 8 }}>
              <button onClick={handleSaveAudio} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: saved ? 'rgba(74,222,128,0.2)' : C.yellow,
                color: saved ? 'rgba(74,222,128,0.9)' : C.bg,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
                letterSpacing: '0.14em',
                boxShadow: saved ? '0 0 16px rgba(74,222,128,0.2)' : '0 0 20px rgba(253,224,71,0.35)',
                transition: 'all 0.3s ease',
              }}>
                {saved ? 'SAVED' : 'SAVE AUDIO SETTINGS'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

export default function Profile({ onHome, onBack, onSave, profile, updateProfile, onBetaFeedback }) {
  const p = profile || {};
  const [profileView, setProfileView] = useState('main');
  const [name,        setName       ] = useState(p.name        ?? '');
  const [sex,         setSex        ] = useState((p.sex        ?? 'male').toUpperCase());
  const [age,         setAge        ] = useState(p.age         ?? '');
  const [heightVal,   setHeightVal  ] = useState(p.heightVal   ?? '');
  const [heightUnit,  setHeightUnit ] = useState(p.heightUnit  ?? 'FT/IN');
  const [weightVal,   setWeightVal  ] = useState(p.weightVal   ?? '');
  const [weightUnit,  setWeightUnit ] = useState(p.weightUnit  ?? 'LBS');
  const [experience,  setExperience ] = useState(p.experience  ?? 'INTERMEDIATE');
  const [goal,        setGoal       ] = useState(() => {
    const saved = p.goal ?? 'BUILD MUSCLE';
    return saved === 'GET FASTER' ? 'BUILD MUSCLE' : saved;
  });
  const [specialty,   setSpecialty  ] = useState(p.specialty   ?? '');
  const [voiceCoach,  setVoiceCoach ] = useState(p.voiceCoach  ?? 'FEMALE');
  const [coachStyle,  setCoachStyle ] = useState(() => {
    const saved = p.coachStyle ?? 'STANDARD';
    return saved === 'DRILL' ? 'STANDARD' : saved;
  });
  const [encouragement, setEncouragement] = useState(p.encouragement ?? 'normal');

  const [audioSettings, setAudioSettingsState] = useState(getAudioSettings);
  const [reminderSettings, setReminderSettingsState] = useState(loadReminderSettings);
  const updateAudio = (key, val) => {
    const next = { ...audioSettings, [key]: val };
    setAudioSettingsState(next);
    saveAudioSettings(next);
  };
  const updateReminder = (key, val) => {
    const next = { ...reminderSettings, [key]: val };
    setReminderSettingsState(next);
    saveReminderSettings(next);
  };

  const inputStyle = {
    width: '100%', padding: '8px 14px', borderRadius: 8,
    background: 'rgba(12,2,24,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 14,
    outline: 'none',
  };

  const handleSave = () => {
    updateProfile({
      name,
      sex: sex.toLowerCase(),
      age,
      heightVal,
      heightUnit,
      weightVal,
      weightUnit,
      experience,
      goal,
      specialty,
      voiceCoach,
      coachStyle,
      encouragement,
    });
    onSave();
  };

  if (profileView === 'audio') {
    return (
      <AudioSettingsView
        onBack={() => setProfileView('main')}
        onHome={onHome}
        voiceCoach={voiceCoach}
        setVoiceCoach={setVoiceCoach}
        coachStyle={coachStyle}
        setCoachStyle={setCoachStyle}
        encouragement={encouragement}
        setEncouragement={setEncouragement}
        audioSettings={audioSettings}
        updateAudio={updateAudio}
      />
    );
  }

  return (
    <PhoneFrame useBrandBg>
      <CornerHUD color="rgba(168,85,247,0.3)" size={24} inset={12}/>
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
      }}>

        <TrainingHeader
          title="PROFILE"
          subtitle="Player settings and preferences."
          onHome={onHome}
          showBack
          onBack={onBack}
          rightSlot={<WordmarkTM height={24}/>}
        />

        {/* Scrollable form area */}
        <div className="no-scrollbar" style={{
          flex: 1, overflowX: 'hidden',
          padding: '12px 16px calc(190px + env(safe-area-inset-bottom, 0px))',
        }}>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Name */}
          <div>
            <SectionLabel text="NAME"/>
            <input
              type="text"
              placeholder="Trainee"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Sex + Age Row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <SectionLabel text="SEX"/>
              <PillRow opts={['MALE', 'FEMALE']} val={sex} onPick={setSex}/>
            </div>
            <div style={{ flex: 1 }}>
              <SectionLabel text="AGE"/>
              <input type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)}
                style={{ ...inputStyle, fontSize: 12 }}/>
            </div>
          </div>

          {/* Height + Weight Row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <SectionLabel text="HEIGHT"/>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" placeholder={heightUnit === 'FT/IN' ? '5\'10"' : '178'} value={heightVal}
                  onChange={e => setHeightVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '8px 10px' }}/>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['FT/IN', 'CM'].map(u => (
                    <button key={u} onClick={() => setHeightUnit(u)} style={{
                      padding: '6px 8px', borderRadius: 6, minHeight: 32,
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
                      background: u === heightUnit ? 'rgba(168,85,247,0.12)' : 'rgba(12,2,24,0.7)',
                      color: u === heightUnit ? C.neon : C.muted,
                      border: u === heightUnit ? '1.5px solid rgba(168,85,247,0.65)' : '1.5px solid rgba(255,255,255,0.07)',
                      boxShadow: u === heightUnit ? '0 0 8px rgba(168,85,247,0.2)' : 'none',
                      cursor: 'pointer', transition: 'all 0.18s',
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <SectionLabel text="WEIGHT"/>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" placeholder={weightUnit === 'LBS' ? '175' : '80'} value={weightVal}
                  onChange={e => setWeightVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '8px 10px' }}/>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['LBS', 'KG'].map(u => (
                    <button key={u} onClick={() => setWeightUnit(u)} style={{
                      padding: '6px 8px', borderRadius: 6, minHeight: 32,
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
                      background: u === weightUnit ? 'rgba(168,85,247,0.12)' : 'rgba(12,2,24,0.7)',
                      color: u === weightUnit ? C.neon : C.muted,
                      border: u === weightUnit ? '1.5px solid rgba(168,85,247,0.65)' : '1.5px solid rgba(255,255,255,0.07)',
                      boxShadow: u === weightUnit ? '0 0 8px rgba(168,85,247,0.2)' : 'none',
                      cursor: 'pointer', transition: 'all 0.18s',
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Experience */}
          <div>
            <SectionLabel text="EXPERIENCE"/>
            <PillRow opts={['BEGINNER', 'INTERMEDIATE', 'ADVANCED']} val={experience} onPick={setExperience}/>
          </div>

          {/* Primary Goal */}
          <div>
            <SectionLabel text="PRIMARY GOAL"/>
            <PillRow opts={['LOSE WEIGHT', 'BUILD MUSCLE', 'COMPETE']} val={goal} onPick={setGoal} wrap/>
          </div>

          {/* Training Specialty */}
          <div>
            <SectionLabel text="TRAINING SPECIALTY"/>
            <PillRow
              opts={['BOXING', 'KICKBOXING', 'MUAY THAI', 'MMA', 'GRAPPLING/WRESTLING', 'GENERAL FITNESS', 'COMBAT CONDITIONING']}
              val={specialty}
              onPick={v => setSpecialty(v === specialty ? '' : v)}
              wrap
            />
          </div>

          {/* Audio Settings Card */}
          <button onClick={() => setProfileView('audio')} style={{
            width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'rgba(12,2,24,0.85)',
            borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(168,85,247,0.2)',
            display: 'flex', alignItems: 'center', gap: 12,
            transition: 'all 0.2s ease',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(168,85,247,0.1)', border: '1.5px solid rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Volume2 size={16} color={C.neon}/>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
                color: C.text, letterSpacing: '0.1em',
              }}>AUDIO SETTINGS</div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 11,
                color: C.muted, marginTop: 2,
              }}>Voice, music, coach, and volume controls.</div>
            </div>
            <ChevronLeft size={16} color={C.muted} style={{ marginLeft: 'auto', transform: 'rotate(180deg)' }}/>
          </button>
        </div>

        {/* Reminders & Notifications */}
        <div style={{
          marginTop: 16, padding: '14px', borderRadius: 12,
          background: 'rgba(12,2,24,0.85)', border: '1px solid rgba(168,85,247,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Bell size={14} color={C.neon}/>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.muted, letterSpacing: '0.18em', fontWeight: 600 }}>REMINDERS & NOTIFICATIONS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Master toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: C.text }}>Workout Reminders</span>
              <button onClick={async () => {
                if (!reminderSettings.enabled) {
                  await requestNotificationPermission();
                  updateReminder('enabled', true);
                } else {
                  updateReminder('enabled', false);
                }
              }} style={{
                width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                background: reminderSettings.enabled ? C.neon : 'rgba(255,255,255,0.12)',
                transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2,
                  left: reminderSettings.enabled ? 20 : 2,
                  transition: 'left 0.2s',
                }}/>
              </button>
            </div>

            {reminderSettings.enabled && (
              <>
                {/* Reminder Style */}
                <div style={{ background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Reminder Style</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['light', 'normal', 'intense'].map(s => (
                      <button key={s} onClick={() => updateReminder('style', s)} style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: reminderSettings.style === s ? C.neon : 'rgba(255,255,255,0.06)',
                        color: reminderSettings.style === s ? '#0a0014' : C.muted,
                        transition: 'all 0.2s',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Frequency */}
                <div style={{ background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Frequency</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['low', 'normal'].map(s => (
                      <button key={s} onClick={() => updateReminder('frequency', s)} style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: reminderSettings.frequency === s ? C.neon : 'rgba(255,255,255,0.06)',
                        color: reminderSettings.frequency === s ? '#0a0014' : C.muted,
                        transition: 'all 0.2s',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Streak + Program toggles */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted }}>Streak</span>
                    <button onClick={() => updateReminder('streakReminders', !reminderSettings.streakReminders)} style={{
                      width: 30, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
                      background: reminderSettings.streakReminders ? C.neon : 'rgba(255,255,255,0.12)',
                    }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: reminderSettings.streakReminders ? 16 : 2, transition: 'left 0.2s' }}/>
                    </button>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted }}>Program</span>
                    <button onClick={() => updateReminder('programReminders', !reminderSettings.programReminders)} style={{
                      width: 30, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
                      background: reminderSettings.programReminders ? C.neon : 'rgba(255,255,255,0.12)',
                    }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: reminderSettings.programReminders ? 16 : 2, transition: 'left 0.2s' }}/>
                    </button>
                  </div>
                </div>

                {/* Quiet Hours */}
                <div style={{ background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted }}>Quiet Hours</span>
                    <button onClick={() => updateReminder('quietHoursEnabled', !reminderSettings.quietHoursEnabled)} style={{
                      width: 30, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
                      background: reminderSettings.quietHoursEnabled ? C.neon : 'rgba(255,255,255,0.12)',
                    }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: reminderSettings.quietHoursEnabled ? 16 : 2, transition: 'left 0.2s' }}/>
                    </button>
                  </div>
                  {reminderSettings.quietHoursEnabled && (
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>
                      No reminders from {reminderSettings.quietStart}:00 to {reminderSettings.quietEnd}:00
                    </div>
                  )}
                </div>

                {/* Notification permission status */}
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, textAlign: 'center', padding: '4px 0' }}>
                  {getNotificationPermissionStatus() === 'granted' ? 'Push notifications enabled' :
                   getNotificationPermissionStatus() === 'denied' ? 'Push notifications blocked by browser' :
                   getNotificationPermissionStatus() === 'unavailable' ? 'Push notifications unavailable - using in-app reminders' :
                   'Push notification permission not yet granted'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Beta Feedback Card */}
        <div style={{
          marginTop: 16, padding: '14px 14px 12px', borderRadius: 12,
          background: 'rgba(12,2,24,0.85)',
          border: '1px solid rgba(253,224,71,0.15)',
          boxShadow: '0 0 12px rgba(253,224,71,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MessageSquare size={16} color={C.yellow}/>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
              color: C.yellow, letterSpacing: '0.12em',
            }}>BETA TESTER FEEDBACK</span>
          </div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 12,
            color: C.text, lineHeight: 1.45, marginBottom: 10,
          }}>
            Report bugs, confusing screens, or feature ideas. Your feedback helps shape Training Mode before launch.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {['Bug', 'Confusing Screen', 'Feature Idea', 'Workout Issue', 'Timer Issue', 'Layout Issue'].map(tag => (
              <span key={tag} style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
                color: C.yellow, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.18)',
                letterSpacing: '0.05em',
              }}>{tag}</span>
            ))}
          </div>
          <button onClick={onBetaFeedback} style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(253,224,71,0.15), rgba(253,224,71,0.08))',
            color: C.yellow, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
            letterSpacing: '0.12em',
            boxShadow: '0 0 10px rgba(253,224,71,0.1)',
            transition: 'all 0.18s',
          }}>
            SEND BETA FEEDBACK
          </button>
        </div>

        {/* Save Button */}
        <div style={{ paddingTop: 14 }}>
          <button onClick={handleSave} style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: C.yellow, color: C.bg,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
            letterSpacing: '0.14em',
            boxShadow: '0 0 20px rgba(253,224,71,0.35)',
          }}>
            SAVE PROFILE
          </button>
        </div>

        {/* Legal / Safety */}
        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 500,
          color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 16,
          lineHeight: 1.5, maxWidth: 300, alignSelf: 'center',
        }}>
          Training Mode provides fitness and combat-inspired training content for educational and entertainment purposes only. Not medical advice. Train safely and consult a qualified professional before starting a new program.
        </p>
        </div>
      </div>
    </PhoneFrame>
  );
}
