import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { Crosshair, Zap, BookOpen, Swords, Shield, Check, Hand, Footprints, Flame } from 'lucide-react';
import { C } from './Styles';
import { hasCompletedFirstLesson } from './data/recommendations';
import { loadProfile } from './data/userProfile';
import { IMG } from './data/optimizedImageMap';

const DISCIPLINES = [
  { id: 'Boxing',     assetKey: 'boxing',     Icon: Hand,       label: 'BOXING',     sub: 'the sweet science' },
  { id: 'Kickboxing', assetKey: 'kickboxing', Icon: Footprints, label: 'KICKBOXING', sub: 'hands, kicks, and rhythm' },
  { id: 'Muay Thai',  assetKey: 'muayThai',   Icon: Flame,      label: 'MUAY THAI',  sub: 'art of the eight limbs' },
  { id: 'MMA',        assetKey: 'mma',        Icon: Swords,     label: 'MMA',        sub: 'mixed martial arts' },
];

const disciplineAssets = {
  male: {
    boxing: IMG.fightMode.boxingMale,
    kickboxing: IMG.fightMode.kickboxingMale,
    muayThai: IMG.fightMode.muayThaiMale,
    mma: IMG.fightMode.mmaMale,
  },
  female: {
    boxing: IMG.fightMode.boxingFemale,
    kickboxing: IMG.fightMode.kickboxingFemale,
    muayThai: IMG.fightMode.muayThaiFemale,
    mma: IMG.fightMode.mmaFemale,
  },
};

const getAvatarVariant = (profile) => {
  const preference = String(profile?.avatarPreference || '').toLowerCase();
  const sex = String(profile?.sex || '').toLowerCase();
  const gender = String(profile?.gender || '').toLowerCase();
  const genderIdentity = String(profile?.genderIdentity || '').toLowerCase();

  if (preference === 'female') return 'female';
  if (preference === 'male') return 'male';
  if (sex === 'female' || gender === 'female' || genderIdentity === 'female') return 'female';
  return 'male';
};

const GOLD = C.gold;
const RED = '#ef4444';

const hubCSS = `
.fh-disc-card {
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  min-height: 130px;
  background: rgba(10,0,20,0.7);
  border: 1.5px solid rgba(168,85,247,0.2);
  transition: all 0.25s cubic-bezier(0.25,0.46,0.45,0.94);
}
.fh-disc-card:hover {
  transform: scale(1.03) translateY(-2px);
  border-color: rgba(168,85,247,0.5);
  box-shadow: 0 0 18px rgba(168,85,247,0.2);
}
.fh-disc-card:active { transform: scale(0.97); }
.fh-disc-card.active {
  border-color: rgba(253,224,71,0.7);
  box-shadow: 0 0 22px rgba(253,224,71,0.25);
}
.fh-disc-card.active:hover {
  border-color: rgba(253,224,71,0.85);
  box-shadow: 0 0 28px rgba(253,224,71,0.3);
}
.fh-mode-card {
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.fh-mode-card::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
  transition: left 0.5s ease;
  pointer-events: none;
}
.fh-mode-card:hover {
  transform: scale(1.015) translateY(-2px);
  box-shadow: 0 0 20px var(--card-glow, rgba(168,85,247,0.2));
}
.fh-mode-card:hover::after { left: 120%; }
.fh-mode-card:active { transform: scale(0.98); }
.fh-toast {
  animation: fh-toast-in 0.25s ease forwards;
}
@keyframes fh-toast-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
`;

const MODE_CARDS = [
  {
    key: 'fight_focus',
    Icon: Crosshair,
    title: 'FIGHT FOCUS',
    sub: 'Round timer \u2014 fight-paced work/rest rounds',
    accent: GOLD,
    badge: 'REC',
  },
  {
    key: 'combo_coach',
    Icon: Zap,
    title: 'COMBO COACH',
    sub: 'Called combos at cadence \u2014 hands up',
    accent: C.violet,
    badge: null,
  },
  {
    key: 'practice',
    Icon: BookOpen,
    title: 'PRACTICE MODE',
    sub: 'Learn every strike, step by step',
    accent: C.violet,
    badge: 'PREVIEW',
  },
  {
    key: 'combat_cond',
    Icon: Swords,
    title: 'COMBAT CONDITIONING',
    sub: 'Hybrid strength x striking circuits',
    accent: RED,
    badge: null,
  },
];

export default function FightModeHub({ onHome, onBack, onFightFocus, onComboCoach, onPractice, onStartHere, onCombatConditioning }) {
  const [selectedDisc, setSelectedDisc] = useState('Boxing');
  const [toast, setToast] = useState(false);
  const [showGate, setShowGate] = useState(false);

  const profile = loadProfile();
  const isBeginner = !profile?.experience || profile.experience === 'Beginner';
  const firstLessonDone = hasCompletedFirstLesson();
  const needsGate = isBeginner && !firstLessonDone;
  const avatarVariant = getAvatarVariant(profile);

  const handleFightFocus = () => {
    if (needsGate) { setShowGate(true); return; }
    onFightFocus(selectedDisc);
  };

  const handleComboCoach = () => {
    if (needsGate) { setShowGate(true); return; }
    onComboCoach(selectedDisc);
  };

  const handlePracticeClick = () => {
    if (onPractice) { onPractice(selectedDisc); return; }
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  };

  const handleCombatConditioning = () => {
    if (onCombatConditioning) onCombatConditioning();
  };

  const handleCardClick = (key) => {
    if (key === 'fight_focus') handleFightFocus();
    else if (key === 'combo_coach') handleComboCoach();
    else if (key === 'practice') handlePracticeClick();
    else if (key === 'combat_cond') handleCombatConditioning();
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>
      <Embers count={4}/>

      <TrainingHeader
        title="FIGHT MODE"
        subtitle="Train. Fight. Win."
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px calc(160px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner */}
        <div style={{
          width: '100%', height: 90, borderRadius: 14, overflow: 'hidden',
          marginBottom: 14, position: 'relative',
          border: '1px solid rgba(253,224,71,0.2)',
        }}>
          <SafeImage
            src="/static/hub/fight.png"
            alt="Fight Mode"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(10,0,20,0.8) 0%, rgba(10,0,20,0.3) 50%, transparent 100%)',
          }}/>
          <div style={{
            position: 'absolute', bottom: 10, left: 14, zIndex: 2,
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18,
              color: GOLD, letterSpacing: '0.12em',
              textShadow: '0 0 12px rgba(253,224,71,0.4)',
            }}>FIGHT MODE</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: 'rgba(255,255,255,0.7)', marginTop: 1,
            }}>Select your discipline, choose your mode</div>
          </div>
        </div>

        {/* Discipline Grid */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
          color: C.faint, letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center',
        }}>SELECT DISCIPLINE</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginBottom: 18 }}>
          {DISCIPLINES.map(d => {
            const active = d.id === selectedDisc;
            const imgSrc = disciplineAssets[avatarVariant][d.assetKey];
            const fallbackSrc = avatarVariant === 'female' ? disciplineAssets.male[d.assetKey] : undefined;
            return (
              <DisciplineCard
                key={d.id}
                d={d}
                active={active}
                onSelect={setSelectedDisc}
                imgSrc={imgSrc}
                fallbackSrc={fallbackSrc}
              />
            );
          })}
        </div>

        {/* Mode Cards */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
          color: C.faint, letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center',
        }}>CHOOSE MODE</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {MODE_CARDS.map(card => (
            <button
              key={card.key}
              className="fh-mode-card"
              onClick={() => handleCardClick(card.key)}
              style={{
                '--card-glow': card.accent === GOLD
                  ? 'rgba(253,224,71,0.2)'
                  : card.accent === RED
                    ? 'rgba(239,68,68,0.2)'
                    : 'rgba(168,85,247,0.2)',
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(10,0,20,0.7)',
                border: `1px solid ${
                  card.accent === GOLD ? 'rgba(253,224,71,0.3)'
                  : card.accent === RED ? 'rgba(239,68,68,0.25)'
                  : 'rgba(168,85,247,0.25)'
                }`,
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: card.accent === GOLD
                  ? 'rgba(253,224,71,0.08)'
                  : card.accent === RED
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(168,85,247,0.08)',
                border: `1px solid ${
                  card.accent === GOLD ? 'rgba(253,224,71,0.25)'
                  : card.accent === RED ? 'rgba(239,68,68,0.2)'
                  : 'rgba(168,85,247,0.25)'
                }`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <card.Icon size={20} style={{ color: card.accent }}/>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
                    color: card.accent, letterSpacing: '0.08em',
                  }}>{card.title}</span>
                  {card.badge && (
                    <span style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
                      color: GOLD, letterSpacing: '0.06em',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.25)',
                    }}>{card.badge}</span>
                  )}
                </div>
                <span style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
                  color: C.faint, marginTop: 2,
                }}>{card.sub}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Press Start 2P',monospace", fontSize: 7,
            color: 'rgba(255,255,255,0.15)', letterSpacing: '0.25em',
          }}>TRAIN \u00B7 FIGHT \u00B7 WIN</div>
        </div>
      </div>

      {/* Coming soon toast */}
      {toast && (
        <div className="fh-toast" style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, padding: '10px 20px', borderRadius: 10,
          background: 'rgba(12,2,24,0.95)', border: '1px solid rgba(168,85,247,0.4)',
          boxShadow: '0 0 20px rgba(168,85,247,0.2)',
        }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
            color: C.violet, letterSpacing: '0.1em',
          }}>Practice Mode preview available.</span>
        </div>
      )}

      {/* Beginner Gate Modal */}
      {showGate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,0,15,0.85)', backdropFilter: 'blur(6px)',
          padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 320, borderRadius: 16,
            padding: '28px 22px', textAlign: 'center',
            background: 'rgba(12,2,24,0.98)',
            border: '1.5px solid rgba(253,224,71,0.3)',
            boxShadow: '0 0 40px rgba(253,224,71,0.1)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px',
              background: 'rgba(253,224,71,0.08)', border: '1.5px solid rgba(253,224,71,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={26} color={GOLD}/>
            </div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.1em', marginBottom: 8,
            }}>COMPLETE BASIC FIRST</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
              color: C.faint, lineHeight: 1.5, marginBottom: 20,
            }}>
              Before jumping into rounds, complete your first beginner lesson so you know your stance, guard, and basic strike.
            </div>
            <button onClick={() => { setShowGate(false); onStartHere(); }} style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD})`,
              color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
              letterSpacing: '0.12em', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(253,224,71,0.35)',
              marginBottom: 8,
            }}>GO TO BASIC</button>
            <button onClick={() => setShowGate(false)} style={{
              width: '100%', padding: '11px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              color: C.faint, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
              letterSpacing: '0.1em', cursor: 'pointer',
            }}>MAYBE LATER</button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

function DisciplineCard({ d, active, onSelect, imgSrc, fallbackSrc }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      onClick={() => onSelect(d.id)}
      className={`fh-disc-card${active ? ' active' : ''}`}
      style={{ border: 'none', padding: 0, textAlign: 'left' }}
    >
      {!imgFailed ? (
        <SafeImage
          src={imgSrc}
          fallbackSrc={fallbackSrc}
          preferWebp={false}
          onFail={() => setImgFailed(true)}
          alt={d.label}
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            display: 'block', opacity: active ? 1 : 0.85,
            transition: 'opacity 0.25s ease',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <d.Icon size={48} style={{ color: active ? GOLD : 'rgba(168,85,247,0.4)' }}/>
        </div>
      )}

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(8,2,18,0.85) 0%, rgba(8,2,18,0.3) 50%, transparent 100%)',
      }}/>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3,
        padding: '8px 10px', pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
          fontSize: 11, letterSpacing: '0.08em',
          color: active ? GOLD : '#fff',
          textShadow: active ? '0 0 8px rgba(253,224,71,0.4)' : 'none',
        }}>{d.label}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600,
          fontSize: 9, color: active ? 'rgba(253,224,71,0.8)' : 'rgba(255,255,255,0.6)',
          marginTop: 1,
        }}>{d.sub}</div>
      </div>

      {active && (
        <div style={{
          position: 'absolute', top: 7, right: 7, zIndex: 5,
          width: 20, height: 20, borderRadius: '50%',
          background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 8px rgba(253,224,71,0.6)',
        }}>
          <Check size={11} style={{ color: '#0a0014' }} strokeWidth={3}/>
        </div>
      )}
    </button>
  );
}
