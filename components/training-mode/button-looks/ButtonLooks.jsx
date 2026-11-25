import { useLayoutEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { STYLE } from '../Styles';
import BottomNav from '../BottomNav';
import PhoneFrame from '../PhoneFrame';
import QuickMissionSetup from '../QuickMissionSetup';
import MissionLibrarySheet from '../MissionLibrarySheet';
import MissionComplete from '../shared/MissionComplete';
import { DropButton } from '../shared/WorkoutDrop';
import { shelfEntries, gearProfile } from '../data/loadoutMissions';
import { fitKitCSS, SegRow, ChipGroup, GhostButton, GoldButton, Label, HEAD, MUTED } from '../shared/FitSetupKit';
import { LOOKS, NOW, lookById, css } from './looks';

// BUTTON LOOKS (looks only). The real Quick Mission screens with sample data,
// once per look; the look is a <style> scoped to html[data-bl=...] (button-looks/
// looks.js), so no existing screen or kit file is touched. /button-looks lists
// the panels; ?look=...&panel=... draws one inside the app's phone layout.
// scripts/button-looks-preview.mjs photographs them all.

const noop = () => {};
const PANELS = [
  { id: 'setup', title: '(a) Quick Mission setup' },
  { id: 'library', title: '(b) Library sheet' },
  { id: 'end', title: '(c) End screen' },
  { id: 'kit', title: '(d) Every kind, side by side' },
];

function Shell({ state, children }) {
  return (
    <div data-bl-state={state} style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#0a0014', overflow: 'hidden' }}>
      <div className="no-scrollbar" style={{ height: '100dvh', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', overscrollBehaviorY: 'contain', paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, zIndex: 100 }}>
        <BottomNav active="train" onNavigate={noop}/>
      </div>
    </div>
  );
}

function Setup() {
  return <QuickMissionSetup onBack={noop} onHome={noop} onFightMode={noop} onStart={noop} onCardioOnly={noop} onPaywall={noop}/>;
}

function Library() {
  const [shelf] = useState(() => shelfEntries());
  const [gear] = useState(() => gearProfile());
  return (
    <>
      <Setup/>
      <MissionLibrarySheet shelf={shelf} onTop={null} gear={gear} onPutOnCard={noop} onStart={noop} onClose={noop}/>
    </>
  );
}

function End() {
  return (
    <MissionComplete
      variant="success" eyebrow="QUICK MISSION · COMPLETE" title="FIRST BELL" subtitle="Weighted · EMOM · Standard"
      accent="#F2BE45" xp={140} heroImage="/static/trophies/mission-complete-fit.webp" onBack={noop}
      stats={[
        { value: '21/21', label: 'ROUNDS', color: '#F2BE45' },
        { value: '2', label: 'EXERCISES', color: '#fff' },
        { value: '15', label: 'MINUTES', color: '#fff' },
      ]}
      actions={[
        { label: 'NEW MISSION', onClick: noop, kind: 'primary' },
        { label: 'BACK TO FIT MODE', onClick: noop, kind: 'secondary', className: 'fk-end2' },
        { label: 'RETURN HOME', onClick: noop, kind: 'ghost', role: 'home', className: 'fk-home' },
      ]}
    />
  );
}

// Every role once, from the real kit parts where there is one.
function Kit() {
  const [a] = useState('Weighted');
  return (
    <PhoneFrame>
      <div style={{ position: 'relative', zIndex: 10, padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SegRow label="GEAR · picked and unpicked" options={['Bodyweight', 'Weighted', 'Hybrid']} value={a} onPick={noop} height={44}/>
        <Label>Chips · picked and unpicked</Label>
        <ChipGroup options={['ALL', 'BELL / DB', 'BARBELL', 'BAG']} value="BELL / DB" onPick={noop}/>
        <Label>Quiet · beside START</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)', gap: 10 }}>
          <GhostButton label="PUT ON CARD" height={48} style={{ fontSize: 12 }}/>
          <GoldButton label="START" icon="play" height={48} style={{ fontSize: 16, letterSpacing: '0.2em' }}/>
        </div>
        <Label>Danger · the red combat skin</Label>
        <button type="button" className="bl-danger" style={{ height: 48, width: '100%', cursor: 'pointer', font: `700 14px ${HEAD}`, letterSpacing: '0.18em', color: '#fff', background: '#CC2D2D', border: 0 }}>STOP</button>
        <Label>Quiet · plain</Label>
        <button type="button" className="bl-quiet" style={{ height: 48, width: '100%', cursor: 'pointer', font: `700 13px ${HEAD}`, letterSpacing: '0.14em', color: '#fff', background: '#16131F', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Check size={16}/>DONE</button>
        <Label>The + on a library row · closed and open</Label>
        <div style={{ display: 'flex', gap: 14 }}>
          <DropButton open={false} controls="ml-drop-a" titleId="x" onClick={noop}/>
          <DropButton open controls="ml-drop-b" titleId="x" onClick={noop}/>
        </div>
        <span style={{ font: `500 12px ${HEAD}`, color: MUTED }}>Every button here is the real kit part; DANGER and the plain QUIET are sample buttons (no Quick Mission screen has one yet).</span>
      </div>
    </PhoneFrame>
  );
}

const BODY = { setup: Setup, library: Library, end: End, kit: Kit };

function Gallery() {
  return (
    <div data-bl-state="gallery" style={{ minHeight: '100vh', background: '#080012', color: '#fff' }}>
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: `700 10px ${HEAD}`, letterSpacing: '0.18em', color: '#F2BE45' }}>LOOKS ONLY · SAMPLE DATA</span>
          <h1 style={{ margin: 0, font: `900 22px ${HEAD}`, letterSpacing: '0.06em' }}>QUICK MISSION BUTTONS</h1>
        </header>
        {[NOW, ...LOOKS].map((l) => (
          <section key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.1em', color: '#F2BE45' }}>{l.n ? `LOOK ${l.n} · ` : ''}{l.name}</span>
            <span style={{ font: `500 13px ${HEAD}`, color: '#cbc6e0', lineHeight: 1.4 }}>{l.blurb}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PANELS.map((p) => (
                <a key={p.id} href={`?look=${l.id}&panel=${p.id}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 10, textDecoration: 'none', color: '#fff', background: 'rgba(14,11,24,0.95)', border: '1px solid rgba(176,106,255,0.3)', font: `600 12px ${HEAD}` }}>{p.title}</a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default function ButtonLooks({ look, panel }) {
  const l = lookById(look);
  const Panel = BODY[panel];
  // The look is set on <html>: the library sheet is portalled to <body>.
  useLayoutEffect(() => {
    const el = document.documentElement;
    if (l) el.setAttribute('data-bl', l.id); else if (look === 'now') el.setAttribute('data-bl', 'now'); else el.removeAttribute('data-bl');
    return () => el.removeAttribute('data-bl');
  }, [l, look]);
  if (!Panel || (!l && look !== 'now' && look !== 'applied')) return <Gallery/>;
  return (
    <>
      <style>{STYLE}</style>
      <style>{fitKitCSS}</style>
      {l && <style>{css(l)}</style>}
      <Shell state={`${look}-${panel}`}><Panel/></Shell>
    </>
  );
}
