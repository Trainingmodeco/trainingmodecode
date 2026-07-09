import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import IntroLogo from './IntroLogo';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { ChevronLeft, TriangleAlert as AlertTriangle } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import { CARDIO_SAFETY_COPY } from './data/cardioProtocolData';
import {
  CARDIO_ADDON_TYPES,
  INTERVAL_PRESETS,
  cardioAddonToPlayer,
  getCardioStyleLabel,
  summarizeCardioAddon,
} from './data/cardioAddon';
import CardioProtocolPlayer from './CardioProtocolPlayer';
import CardioSummary from './CardioSummary';
import EmptyState from './EmptyState';
import WorkoutHelpPanel, { HelpButton } from './shared/WorkoutHelpPanel';
import { loadStats, getLevel } from './data/userStats';
import { loadProfile } from './data/userProfile';

const GOLD = C.yellow;
const VIOLET = '#b06aff';

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Auto pace target (design 12a): from the goal distance + the athlete's level we
// set a target pace the voice coach holds them to. Base 10:00/mi at level 1,
// ~18s/level faster, floored at 6:30/mi.
function computeAutoPace(distance, unit, level) {
  const paceSecPerMile = Math.max(390, 600 - (Math.max(1, level) - 1) * 18);
  const miles = unit === 'km' ? distance * 0.621371 : distance;
  const totalSec = Math.round(miles * paceSecPerMile);
  const paceSecPerUnit = unit === 'km' ? paceSecPerMile * 0.621371 : paceSecPerMile;
  return { totalSec, paceSecPerUnit, paceLabel: `${fmtClock(paceSecPerUnit)} /${unit}`, timeLabel: fmtClock(totalSec), goalLabel: `${distance} ${unit}` };
}

// Protocols mirror the Cardio Finisher. Steady / Custom run a plain timer;
// the rest map to interval configs the player understands.
const PROTOCOLS = [
  { id: 'steady', label: 'Steady', intervals: null },
  { id: 'intervals', label: 'Beginner Intervals', intervals: INTERVAL_PRESETS.intervals },
  { id: 'tabata', label: 'Tabata', intervals: INTERVAL_PRESETS.tabata },
  { id: 'hiit', label: 'HIIT', intervals: INTERVAL_PRESETS.hiit },
  { id: 'custom', label: 'Custom', intervals: null },
];

const TARGETS = [
  { id: 'time', label: 'Time' },
  { id: 'distance', label: 'Distance' },
  { id: 'manual', label: 'Manual Completion' },
];

const TIME_PRESETS = [
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 1200, label: '20 min' },
  { seconds: 1800, label: '30 min' },
  { seconds: 2700, label: '45 min' },
  { seconds: 3600, label: '60 min' },
];

const DISTANCE_PRESETS = [
  { id: '1mi', value: 1, unit: 'mi', label: '1 mile' },
  { id: '2mi', value: 2, unit: 'mi', label: '2 miles' },
  { id: '3mi', value: 3, unit: 'mi', label: '3 miles' },
  { id: '5k', value: 5, unit: 'km', label: '5K' },
  { id: '10k', value: 10, unit: 'km', label: '10K' },
  { id: 'custom', value: null, unit: 'mi', label: 'Custom' },
];

function getMethod(id) {
  return CARDIO_ADDON_TYPES.find(m => m.id === id) || CARDIO_ADDON_TYPES[0];
}

function Chip({ active, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', padding: '10px 12px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
      background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.65)',
      border: active ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
      boxShadow: active ? '0 0 16px rgba(253,224,71,0.16)' : 'none',
      transition: 'all 0.15s', width: '100%',
    }}>
      <div style={{
        fontFamily: ARCADE.fontHead, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        color: active ? GOLD : '#c4b5fd',
      }}>{label}</div>
      {sub && (
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>
      )}
    </button>
  );
}

// Standalone Cardio Mode. Shares the Cardio Finisher's method IDs, target types,
// presets, and player behavior. Awards normal cardio XP once (via CardioSummary);
// never awards the Hybrid Training Bonus.
export default function CardioMode({ onBack, onHome }) {
  const [phase, setPhase] = useState('setup');
  const [cardioType, setCardioType] = useState('outdoor-run');
  const [style, setStyle] = useState('steady');
  const [targetType, setTargetType] = useState('distance');
  const [targetTimeSeconds, setTargetTimeSeconds] = useState(600);
  const [distancePreset, setDistancePreset] = useState('3mi');
  const [customDistance, setCustomDistance] = useState('');
  const [playerResult, setPlayerResult] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const method = getMethod(cardioType);
  const supportsDistance = method.supportsDistance;
  const effectiveTarget = targetType === 'distance' && !supportsDistance ? 'time' : targetType;
  const availableTargets = supportsDistance ? TARGETS : TARGETS.filter(t => t.id !== 'distance');

  const level = getLevel(loadStats().xp);
  const profile = loadProfile();

  const handleMethodChange = (id) => {
    setCardioType(id);
    if (targetType === 'distance' && !getMethod(id).supportsDistance) setTargetType('time');
  };

  const resolveDistance = () => {
    const preset = DISTANCE_PRESETS.find(d => d.id === distancePreset) || DISTANCE_PRESETS[0];
    if (preset.id === 'custom') {
      const value = parseFloat(customDistance);
      return { value: Number.isFinite(value) && value > 0 ? value : 1, unit: 'mi' };
    }
    return { value: preset.value, unit: preset.unit };
  };

  const autoPace = effectiveTarget === 'distance'
    ? (() => { const d = resolveDistance(); return computeAutoPace(d.value, d.unit, level); })()
    : null;

  const buildAddon = () => {
    const proto = PROTOCOLS.find(p => p.id === style) || PROTOCOLS[0];
    const dist = effectiveTarget === 'distance' ? resolveDistance() : null;
    return {
      enabled: true,
      sourceMode: 'Cardio Mode',
      placement: 'standalone',
      cardioType,
      cardioLabel: method.label,
      targetType: effectiveTarget,
      targetTimeSeconds,
      targetDistance: dist ? dist.value : null,
      distanceUnit: dist ? dist.unit : 'mi',
      paceTargetSeconds: autoPace ? autoPace.paceSecPerUnit : null,
      paceTargetLabel: autoPace ? autoPace.paceLabel : null,
      style,
      intervals: proto.intervals,
      bonusEligible: false,
    };
  };

  const addon = buildAddon();
  const summary = summarizeCardioAddon(addon);

  // Outdoor runs need GPS; probe real permission and route to the GPS empty
  // state (25d) if it's unavailable / denied.
  const startCardio = () => {
    setPlayerResult(null);
    if (effectiveTarget === 'manual') { setPhase('summary'); return; }
    if (cardioType === 'outdoor-run') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) { setPhase('gps'); return; }
      navigator.geolocation.getCurrentPosition(() => setPhase('player'), () => setPhase('gps'), { timeout: 8000, maximumAge: 60000 });
      return;
    }
    setPhase('player');
  };

  if (phase === 'gps') {
    return (
      <PhoneFrame useBrandBg>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setPhase('setup')} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}><ChevronLeft size={22}/></button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <EmptyState preset="gps" onPrimary={startCardio} onSecondary={() => { setCardioType('treadmill'); setPhase('player'); }} style={{ width: '100%' }}/>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'player') {
    const player = cardioAddonToPlayer(addon);
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button onClick={() => setPhase('setup')} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardioProtocolPlayer
              format={player.format}
              durationSeconds={player.durationSeconds}
              intervalConfig={player.intervalConfig}
              headerLabel="CARDIO MODE"
              methodLabel={method.label}
              styleLabel={getCardioStyleLabel(style)}
              distanceLabel={effectiveTarget === 'distance' ? player.distanceLabel : null}
              distanceMode={effectiveTarget === 'distance'}
              distanceTargetLabel={player.distanceLabel}
              paceTargetLabel={addon.paceTargetLabel}
              initialDistanceUnit={addon.distanceUnit}
              deferManualLog={effectiveTarget === 'distance'}
              onComplete={(result) => { setPlayerResult(result); setPhase('summary'); }}
            />
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'summary') {
    const player = cardioAddonToPlayer(addon);
    const fallbackTime = effectiveTarget === 'time' && style === 'steady' ? targetTimeSeconds : 0;
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div className="no-scrollbar" style={{ position: 'relative', zIndex: 10, minHeight: '100dvh', overflowY: 'auto', padding: '14px 0 40px' }}>
          <CardioSummary
            sourceMode="Cardio Mode"
            method={cardioType}
            methodLabel={method.label}
            cardioType={cardioType}
            targetType={effectiveTarget}
            targetTimeSeconds={effectiveTarget === 'time' ? targetTimeSeconds : null}
            targetDistance={effectiveTarget === 'distance' ? player.distanceLabel : null}
            initialTimeSeconds={playerResult?.completedTimeSeconds ?? fallbackTime}
            initialDistanceUnit={addon.distanceUnit || 'mi'}
            awardXp
            onDone={onBack}
          />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <CornerHUD color="rgba(253,224,71,0.25)" size={20} inset={10}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={30}/>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <h1 style={{
            fontFamily: ARCADE.fontHead, fontWeight: 900, color: GOLD, fontSize: 22,
            letterSpacing: '0.12em', textShadow: '0 0 14px rgba(253,224,71,0.4)',
          }}>CARDIO MODE</h1>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 12, color: C.muted, marginTop: 3 }}>
            Pick method + goal. We set your pace.
          </div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>

          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {CARDIO_ADDON_TYPES.map(m => (
              <Chip key={m.id} active={cardioType === m.id} label={m.label.toUpperCase()} onClick={() => handleMethodChange(m.id)}/>
            ))}
          </div>

          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>PROTOCOL</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {PROTOCOLS.map(p => (
              <button key={p.id} onClick={() => setStyle(p.id)} style={{
                padding: '8px 13px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                background: style === p.id ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.65)',
                border: style === p.id ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                color: style === p.id ? GOLD : C.muted,
              }}>{p.label.toUpperCase()}</button>
            ))}
          </div>

          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>TARGET</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {availableTargets.map(t => (
              <Chip key={t.id} active={effectiveTarget === t.id} label={t.label} onClick={() => setTargetType(t.id)}/>
            ))}
          </div>

          {effectiveTarget === 'time' && (
            <>
              <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>TARGET TIME</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {TIME_PRESETS.map(p => (
                  <button key={p.seconds} onClick={() => setTargetTimeSeconds(p.seconds)} style={{
                    padding: '8px 13px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                    fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                    background: targetTimeSeconds === p.seconds ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.65)',
                    border: targetTimeSeconds === p.seconds ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                    color: targetTimeSeconds === p.seconds ? GOLD : C.muted,
                  }}>{p.label.toUpperCase()}</button>
                ))}
              </div>
            </>
          )}

          {effectiveTarget === 'distance' && (
            <>
              <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>GOAL DISTANCE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {DISTANCE_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setDistancePreset(p.id)} style={{
                    padding: '8px 13px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                    fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                    background: distancePreset === p.id ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.65)',
                    border: distancePreset === p.id ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                    color: distancePreset === p.id ? GOLD : C.muted,
                  }}>{p.label.toUpperCase()}</button>
                ))}
              </div>
              {distancePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.1"
                    value={customDistance} onChange={e => setCustomDistance(e.target.value)}
                    placeholder="Distance"
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: ARCADE.radius.sm,
                      background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`,
                      color: C.text, fontFamily: ARCADE.fontBody, fontSize: 15, fontWeight: 600, outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: C.muted }}>MI</span>
                </div>
              )}
              {distancePreset !== 'custom' && <div style={{ marginBottom: 8 }}/>}

              {/* Auto pace target (design 12a) */}
              {autoPace && (
                <div style={{ borderRadius: 11, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '11px 13px', marginBottom: 16 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.12em', marginBottom: 3 }}>AUTO PACE TARGET</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 17, color: '#fff' }}>{autoPace.goalLabel} · {autoPace.timeLabel}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: GOLD }}>= {autoPace.paceLabel}</span>
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10, color: C.muted, marginTop: 2 }}>Set from your goal &amp; level {level}. Voice coaches you to hold it.</div>
                </div>
              )}
            </>
          )}

          {effectiveTarget === 'manual' && (
            <div style={{
              background: 'rgba(176,106,255,0.08)', borderRadius: ARCADE.radius.md, padding: '12px 14px',
              border: '1px solid rgba(176,106,255,0.2)', marginBottom: 16,
            }}>
              <div style={{ fontFamily: ARCADE.fontBody, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Do the cardio your way, then log it. No timer &mdash; just record what you finished.
              </div>
            </div>
          )}

          {(style === 'intervals' || style === 'hiit' || style === 'tabata') && (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 12, lineHeight: 1.4 }}>
              {style === 'tabata'
                ? `${INTERVAL_PRESETS.tabata.rounds} rounds \u2022 ${INTERVAL_PRESETS.tabata.hardSeconds}s hard / ${INTERVAL_PRESETS.tabata.restSeconds}s rest`
                : `${INTERVAL_PRESETS[style].rounds} rounds \u2022 ${INTERVAL_PRESETS[style].fastSeconds}s fast / ${INTERVAL_PRESETS[style].easySeconds}s easy`}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
            fontFamily: ARCADE.fontBody, fontWeight: 600, fontSize: 12.5, color: GOLD, justifyContent: 'center', textAlign: 'center',
          }}>{summary}</div>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', borderRadius: ARCADE.radius.sm,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 16,
          }}>
            <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }}/>
            <span style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: 'rgba(239,68,68,0.85)', lineHeight: 1.4 }}>{CARDIO_SAFETY_COPY}</span>
          </div>

          {/* Voice coach row (design 12a) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.7)', padding: '9px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>🔊</span>
            <span style={{ flex: 1, fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9, color: '#c4a4d8', letterSpacing: '0.04em' }}>
              VOICE COACH · {String(profile?.voiceCoach || 'FEMALE').toUpperCase()} · {String(profile?.encouragement || 'HYPE').toUpperCase()}
            </span>
          </div>

          <button onClick={startCardio} style={{
            width: '100%', height: 52, border: 'none', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff',
            fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 14, letterSpacing: '0.06em',
            boxShadow: '0 0 22px rgba(168,85,247,0.45)',
          }}>▶ {effectiveTarget === 'manual' ? 'LOG CARDIO' : 'START CARDIO'}</button>
        </div>
      </div>
      <WorkoutHelpPanel contentKey="cardio_mode" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}
