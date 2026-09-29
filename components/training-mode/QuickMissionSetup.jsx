import { useState, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { Shuffle, SlidersHorizontal } from 'lucide-react';
import { QM_LENGTHS, QM_FOCI, QM_INTENSITY, quickMissionConfig } from './data/quickMissionConfig';
import { generateQuickMission, estimateQuickMissionSeconds, quickMissionDose } from './fit-mode/quickMissionGenerator';
import AddCardioSheet from './AddCardioSheet';
import { NAMED_WORKOUTS, namedWorkoutById, buildNamedMission } from './data/namedWorkouts';
import { isPro } from './data/entitlements';
import { summarizeCardioAddon } from './data/cardioAddon';
import {
  fitKitCSS, SetupHeader, SetupPage, GoldButton, GhostButton, Tag, ChipGroup, Modal, CardioToggleCard, Label,
  HEAD, BODY, MUTED, VIOLET_TEXT, GOLD,
} from './shared/FitSetupKit';

// Quick Mission — the Revamp layout (QuickMission.dc.html).
//
// The old screen was a form: pick a length, a focus, an intensity, then START
// something you had not seen. This one shows the mission first — its name,
// its moves and their doses — with one gold START on it. SURPRISE ME deals a
// new one in place; ADJUST opens the three choices in a modal. What the card
// shows is exactly what runs: the previewed mission travels with the config.
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const focusLabel = (f) => (f === 'FULL BODY' ? 'Full Body' : cap(f));

export default function QuickMissionSetup({ onBack, onHome, onFightMode, onStart, onCardioOnly, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [duration, setDuration] = useState(10);
  const [focus, setFocus] = useState('FULL BODY');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [seed, setSeed] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  // A named classic (Murph, Sally Up…) replaces the generated mission on the
  // card until SURPRISE ME or ADJUST hands it back to the generator.
  const [namedId, setNamedId] = useState(null);
  const named = namedId ? namedWorkoutById(namedId) : null;
  void onHome; void onCardioOnly;

  // The mission on the card. Regenerated whenever a choice changes, or when
  // SURPRISE ME bumps the seed with the same choices.
  const cfg = useMemo(() => quickMissionConfig({ duration, focus, difficulty, cardioAddon }), [duration, focus, difficulty, cardioAddon]);
  const mission = useMemo(() => generateQuickMission(cfg), [cfg, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const estMin = Math.max(1, Math.round(estimateQuickMissionSeconds(mission) / 60));

  const surprise = () => {
    setNamedId(null);
    let d = duration, f = focus, i = difficulty;
    while (d === duration && f === focus && i === difficulty) { d = rand(QM_LENGTHS); f = rand(QM_FOCI); i = rand(QM_INTENSITY); }
    setDuration(d); setFocus(f); setDifficulty(i); setSeed(s => s + 1);
  };

  const handleStart = () => {
    // Pro classics: only enforced once the paywall is on (isPro() is true
    // for everyone until then).
    if (named?.pro && !isPro()) { onPaywall?.(); return; }
    if (named) {
      const m = buildNamedMission(named.id);
      onStart?.({ ...cfg, duration: m.duration, difficulty: 'Hard', focus: m.focus, mission: m });
      return;
    }
    onStart?.({ ...cfg, mission });
  };

  const cardioSummary = cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run · off by default';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={onBack} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
          {/* The mission card — what START runs. */}
          <section className="fk-hero" data-guide="qm-length" style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden', flexShrink: 0,
            border: '1px solid rgba(157,108,255,0.35)', background: '#0D0A18',
          }}>
            <SafeImage src="/static/fitmode/banner-gym-quick.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '55% 50%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.82) 55%, rgba(7,6,12,0.4) 100%)' }}/>
            <div style={{ position: 'relative', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: named ? GOLD : VIOLET_TEXT }}>{named ? `Classic · ${named.tag}` : 'Today’s Quick Mission'}</span>
              <h1 style={{ margin: 0, font: `700 26px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 300 }}>{named ? named.title : mission.title}</h1>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {named ? (
                  <>
                    <Tag>~{named.estMin} min</Tag>
                    <Tag accent>{named.focus}</Tag>
                    {named.needs && <Tag>{named.needs}</Tag>}
                    {named.pro && <Tag>PRO</Tag>}
                  </>
                ) : (
                  <>
                    <Tag>{duration} min</Tag>
                    <Tag>{cap(difficulty)}</Tag>
                    <Tag accent>{focusLabel(focus)}</Tag>
                    <Tag>{mission.rounds} {mission.rounds === 1 ? 'round' : 'rounds'}</Tag>
                  </>
                )}
              </div>
              {named ? (
                <>
                  <ol style={{ listStyle: 'none', margin: '4px 0 2px', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {named.lines.map(([a, b], i) => /^[+×]\s/.test(a) ? (
                      // "+ 3 more" / "× 2 rounds" are notes on the list, not steps.
                      <li key={i} style={{ paddingLeft: 28, font: `600 12px ${HEAD}`, letterSpacing: '0.06em', color: MUTED }}>{a}</li>
                    ) : (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 14px ${BODY}`, color: '#fff' }}>
                        <span style={{ width: 18, font: `700 11px ${HEAD}`, color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{a}</span>
                        {b && <span style={{ font: `600 12px ${HEAD}`, color: '#CFC9E4' }}>{b}</span>}
                      </li>
                    ))}
                  </ol>
                  <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{named.note}</div>
                </>
              ) : (
              <>
              <ol style={{ listStyle: 'none', margin: '4px 0 2px', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {mission.exercises.map((ex, i) => (
                  <li key={`${ex.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 14px ${BODY}`, color: '#fff' }}>
                    <span style={{ width: 18, font: `700 11px ${HEAD}`, color: '#9D6CFF' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                    <span style={{ font: `600 12px ${HEAD}`, color: '#CFC9E4' }}>{quickMissionDose(ex)}</span>
                  </li>
                ))}
                {mission.finisherExercises.map((ex, i) => (
                  <li key={`fin-${ex.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 14px ${BODY}`, color: GOLD }}>
                    <span style={{ width: 18, font: `700 11px ${HEAD}`, color: GOLD }}>❤</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{ex.name}</span>
                    <span style={{ font: `600 12px ${HEAD}` }}>{quickMissionDose(ex)}</span>
                  </li>
                ))}
              </ol>
              <div style={{ font: `500 12px ${BODY}`, color: MUTED }}>About {estMin} min with the coach&apos;s count and rest.</div>
              </>
              )}
              <div data-guide="qm-start" style={{ marginTop: 4 }}>
                <GoldButton label="START" icon="play" onClick={handleStart} height={56} style={{ fontSize: 20, letterSpacing: '0.2em' }}/>
              </div>
            </div>
          </section>

          <div data-guide="qm-intensity" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <GhostButton label="SURPRISE ME" icon={<Shuffle size={17} color={GOLD}/>} onClick={surprise}/>
            <GhostButton label="ADJUST" icon={<SlidersHorizontal size={17} color={VIOLET_TEXT}/>} onClick={() => { setNamedId(null); setAdjustOpen(true); }} ariaExpanded={adjustOpen ? 'true' : 'false'}
              style={adjustOpen ? { borderColor: '#9D6CFF', background: 'rgba(157,108,255,0.16)' } : undefined}/>
          </div>

          {/* CLASSICS — the workouts people ask for by name. Tap one to put
              it on the card; tap it again (or SURPRISE ME / ADJUST) to go
              back to a generated mission. */}
          <div data-guide="qm-classics" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Classics</Label>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {NAMED_WORKOUTS.map(w => {
                const on = w.id === namedId;
                return (
                  <button key={w.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={() => setNamedId(on ? null : w.id)} style={{
                    flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: on ? 'rgba(242,190,69,0.16)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.7)' : 'transparent'}`,
                    color: on ? GOLD : '#E6E2F5', font: `700 11px ${HEAD}`, letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>{w.title}{w.pro && <span style={{ font: `800 8px ${HEAD}`, letterSpacing: '0.1em', color: '#1A1204', background: GOLD, borderRadius: 3, padding: '2px 4px' }}>PRO</span>}</button>
                );
              })}
            </div>
          </div>

          <CardioToggleCard
            guide="qm-cardio"
            on={!!cardioAddon}
            summary={cardioSummary}
            onToggle={() => { if (cardioAddon) setCardioAddon(null); else setCardioSheetOpen(true); }}
            onEdit={() => setCardioSheetOpen(true)}
          />
        </div>
      </SetupPage>

      {adjustOpen && (
        <Modal title="ADJUST MISSION" onClose={() => setAdjustOpen(false)} footer={<GoldButton label="DONE" height={50} onClick={() => setAdjustOpen(false)} style={{ fontSize: 16 }}/>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label style={{ fontSize: 10 }}>Focus</Label>
            <ChipGroup ariaLabel="Focus" options={QM_FOCI.map(f => ({ id: f, label: focusLabel(f) }))} value={focus} onPick={setFocus}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Duration</Label>
            <ChipGroup ariaLabel="Duration" options={QM_LENGTHS.map(l => ({ id: l, label: `${l}m` }))} value={duration} onPick={setDuration}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Intensity</Label>
            <ChipGroup ariaLabel="Intensity" options={QM_INTENSITY.map(d => ({ id: d, label: cap(d) }))} value={difficulty} onPick={setDifficulty}/>
          </div>
        </Modal>
      )}

      {cardioSheetOpen && (
        <AddCardioSheet
          context={{ source: 'Quick Mission', difficulty: cap(difficulty), durationMin: duration }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.quick_mission_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
