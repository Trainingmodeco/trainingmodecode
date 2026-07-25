import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import { Zap, X, Volume2, Trash2, Gamepad2 } from 'lucide-react';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { loadProfile } from './data/userProfile';
import { getCurrentTier, tierImage } from './data/tiers';
import { loadStats } from './data/userStats';
import { speakAsync, primeSpeech, setVoiceGender } from './voiceCoach';
import {
  loadCombos, saveCombo, saveSignatureMove, deleteCombo, updateCombo, getBuilderPalette,
} from './data/customCombos';

// MOVE LAB (design 43a) — the athlete's fighting-game command list. Home page:
// + CREATE bar → creator modal (BUILD IT / TYPE IT). Move cards show the name,
// the strike sequence as chips, a rotation toggle (join Combo Coach calls), and
// a 🎮 GAME-READY tag. Typed specials collect in the ★ SIGNATURE MOVES tier.
const VIOLET = '#a855f7';
const GOLD = '#fde047';
const RED = '#ef4444';
const BASIC = new Set(['jab', 'cross', 'hook', 'uppercut', 'overhand', 'body jab', 'body cross', 'body hook']);
const chipColor = (s) => (BASIC.has(String(s).toLowerCase()) ? GOLD : RED);

function Chip({ label, index, color, onClick }) {
  const c = color || GOLD;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8, padding: '7px 10px', cursor: onClick ? 'pointer' : 'default',
      background: `${c}22`, border: `1.5px solid ${c}`, color: c,
      font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.02em',
    }}>
      {index != null && <span style={{ opacity: 0.6, fontSize: 8 }}>{index}</span>}
      {label.toUpperCase()}
    </button>
  );
}

export default function MoveLab({ discipline = 'Boxing', onBack, onHome }) {
  const profile = loadProfile();
  const stats = loadStats();
  const beginner = !profile?.experience || profile.experience === 'Beginner';
  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const tier = getCurrentTier(stats);

  const [moves, setMoves] = useState(() => loadCombos(discipline));
  const [helpOpen, setHelpOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState('build');   // 'build' | 'type'
  const [seq, setSeq] = useState([]);
  const [name, setName] = useState('');
  const [typeText, setTypeText] = useState('');

  const palette = getBuilderPalette(discipline, beginner);
  const signatures = moves.filter((m) => m.signature);
  const builtMoves = moves.filter((m) => !m.signature);

  const openCreate = (prefill) => { setTab('build'); setSeq([]); setName(prefill || ''); setTypeText(''); setModal(true); };
  const refresh = () => setMoves(loadCombos(discipline));

  const preview = async (text) => {
    if (!text) return;
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    speakAsync(text);
  };

  const doSaveBuild = () => {
    if (seq.length === 0) return;
    if (saveCombo(discipline, { name, strikes: seq })) { refresh(); setModal(false); }
  };
  const doSaveType = () => {
    const t = typeText.trim();
    if (!t) return;
    if (saveSignatureMove(discipline, t)) { refresh(); setModal(false); }
  };

  const toggleRotation = (m) => setMoves(updateCombo(discipline, m.id, { rotation: !m.rotation }));
  const removeMove = (m) => setMoves(deleteCombo(discipline, m.id));

  return (
    <PhoneFrame useBrandBg>
      <TrainingHeader
        title="MOVE LAB"
        subtitle={`${discipline} · your command list`}
        onHome={onHome}
        showBack
        onBack={onBack}
        rightSlot={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${VIOLET}` }}>
              <SafeImage src={tierImage(tier?.id || 'rookie', sex)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 12%' }}/>
            </div>
            <HelpButton onClick={() => setHelpOpen(true)}/>
          </div>
        )}
      />

      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 10, flex: 1, overflowY: 'auto', padding: '10px 14px calc(96px + env(safe-area-inset-bottom,0px))' }}>

        {/* + CREATE bar */}
        <div data-guide="ml-create" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 11, padding: '0 12px' }}>
            <Zap size={15} color={GOLD}/>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new move or combo…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e7ddf7', font: "600 12px 'Rajdhani',sans-serif", padding: '11px 0' }}/>
          </div>
          <button onClick={() => openCreate(name)} style={{ background: `linear-gradient(135deg,${GOLD},#f59e0b)`, border: 'none', borderRadius: 11, cursor: 'pointer', color: '#2a1400', font: "900 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', padding: '0 15px' }}>+ CREATE</button>
        </div>

        {/* ★ Signature tier */}
        {signatures.length > 0 && (
          <>
            <div style={{ font: "700 9px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.16em', marginBottom: 8 }}>★ SIGNATURE MOVES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {signatures.map((m) => <MoveCard key={m.id} move={m} onToggle={() => toggleRotation(m)} onDelete={() => removeMove(m)} onSpeak={() => preview(m.name)}/>)}
            </div>
          </>
        )}

        {/* Built moves */}
        {builtMoves.length > 0 && <div style={{ font: "700 9px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 8 }}>YOUR MOVES</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {builtMoves.map((m) => <MoveCard key={m.id} move={m} onToggle={() => toggleRotation(m)} onDelete={() => removeMove(m)}/>)}
        </div>

        {moves.length === 0 && (
          <div style={{ textAlign: 'center', padding: '34px 20px', color: '#8b83a8' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🥊</div>
            <div style={{ font: "800 12px 'Orbitron',sans-serif", color: '#c9a6ff', marginBottom: 6 }}>NO MOVES YET</div>
            <div style={{ font: "600 11px 'Rajdhani',sans-serif", lineHeight: 1.4 }}>Tap <b style={{ color: GOLD }}>+ CREATE</b> to build a combo from strikes, or type a signature special. Your moves join the Combo Coach call rotation.</div>
          </div>
        )}
      </div>

      {/* Creator modal */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(4,0,10,0.82)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '90%', overflowY: 'auto', background: 'rgba(14,6,28,0.98)', border: `1px solid ${VIOLET}66`, borderRadius: 18, padding: '16px 16px 18px', boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 30px ${VIOLET}33` }} className="no-scrollbar">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ font: "900 15px 'Orbitron',sans-serif", color: VIOLET, letterSpacing: '0.05em' }}>CREATE YOUR MOVE</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#9a90b8', cursor: 'pointer', display: 'flex' }}><X size={18}/></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, background: 'rgba(8,2,18,0.7)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {[['build', '🧩 BUILD IT'], ['type', '⌨ TYPE IT']].map(([k, lbl]) => (
                <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '9px 0', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.04em', background: tab === k ? `linear-gradient(135deg,${VIOLET},#7c3aed)` : 'transparent', color: tab === k ? '#fff' : '#9a90b8' }}>{lbl}</button>
              ))}
            </div>

            {tab === 'build' ? (
              <>
                <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.12em', marginBottom: 6 }}>YOUR SEQUENCE · tap to remove</div>
                <div style={{ minHeight: 52, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: 'rgba(8,2,18,0.5)', border: '1px dashed rgba(168,85,247,0.35)', borderRadius: 10, padding: 8, marginBottom: 12 }}>
                  {seq.length === 0 && <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#6d5a8f', padding: '0 4px' }}>Tap strikes below to chain them…</span>}
                  {seq.map((s, i) => <Chip key={i} label={s} index={i + 1} color={chipColor(s)} onClick={() => setSeq(seq.filter((_, j) => j !== i))}/>)}
                </div>

                <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.12em', marginBottom: 6 }}>ESSENTIALS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {palette.map((s) => (
                    <button key={s} onClick={() => setSeq([...seq, s])} style={{ borderRadius: 8, padding: '7px 11px', cursor: 'pointer', background: 'rgba(8,2,18,0.6)', border: `1px solid ${chipColor(s)}66`, color: chipColor(s) === GOLD ? '#e7ddf7' : '#fca5a5', font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.02em' }}>{s.toUpperCase()}</button>
                  ))}
                </div>

                <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#8b83a8', lineHeight: 1.35, marginBottom: 12 }}>
                  ⌨ Use the <b style={{ color: '#c9a6ff' }}>TYPE IT</b> tab to write any specialty move (&quot;Hadouken&quot;) — the coach voice calls it exactly as written, and it saves as a ★ SIGNATURE move.
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name: e.g. KNEE CRUSHER"
                    style={{ flex: 1, background: 'rgba(8,2,18,0.6)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 9, color: GOLD, font: "800 11px 'Orbitron',sans-serif", padding: '10px 12px', outline: 'none' }}/>
                  <button onClick={() => preview(name || seq.join(' '))} aria-label="Preview voice" style={{ width: 42, borderRadius: 9, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.14)', color: '#c9a6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Volume2 size={17}/></button>
                </div>

                <button onClick={doSaveBuild} disabled={seq.length === 0} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', cursor: seq.length ? 'pointer' : 'not-allowed', background: seq.length ? `linear-gradient(135deg,${VIOLET},#7c3aed)` : 'rgba(168,85,247,0.25)', color: '#fff', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.06em', boxShadow: seq.length ? `0 0 18px ${VIOLET}55` : 'none' }}>✓ SAVE TO MOVE LAB</button>
              </>
            ) : (
              <>
                <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.12em', marginBottom: 6 }}>SIGNATURE MOVE · typed exactly as spoken</div>
                <input value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="e.g. Hadouken · Hurricane Kick · Superman Punch"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(8,2,18,0.6)', border: `1px solid ${GOLD}55`, borderRadius: 10, color: GOLD, font: "800 13px 'Orbitron',sans-serif", padding: '13px 12px', outline: 'none', marginBottom: 10 }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => preview(typeText)} disabled={!typeText.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 9, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.14)', color: '#c9a6ff', cursor: typeText.trim() ? 'pointer' : 'not-allowed', font: "800 9px 'Orbitron',sans-serif", padding: '9px 12px' }}><Volume2 size={15}/> HEAR THE CALL</button>
                  <span style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#8b83a8', flex: 1, lineHeight: 1.3 }}>The coach speaks it verbatim in Combo Coach. Saves to ★ Signature.</span>
                </div>
                <button onClick={doSaveType} disabled={!typeText.trim()} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', cursor: typeText.trim() ? 'pointer' : 'not-allowed', background: typeText.trim() ? `linear-gradient(135deg,${VIOLET},#7c3aed)` : 'rgba(168,85,247,0.25)', color: '#fff', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.06em', boxShadow: typeText.trim() ? `0 0 18px ${VIOLET}55` : 'none' }}>★ SAVE SIGNATURE MOVE</button>
              </>
            )}
          </div>
        </div>
      )}

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.move_lab} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

function MoveCard({ move, onToggle, onDelete, onSpeak }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${move.signature ? `${GOLD}44` : 'rgba(168,85,247,0.3)'}`, background: 'rgba(14,5,28,0.82)', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {move.signature && <span style={{ color: GOLD, fontSize: 12 }}>★</span>}
        <span style={{ flex: 1, font: "900 12px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{move.name.toUpperCase()}</span>
        {move.gameReady && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: "800 7px 'Orbitron',sans-serif", color: '#8fe8ac', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 5, padding: '3px 6px' }}><Gamepad2 size={9}/> GAME-READY</span>}
        {onSpeak && <button onClick={onSpeak} aria-label="Hear it" style={{ background: 'none', border: 'none', color: '#c9a6ff', cursor: 'pointer', display: 'flex', padding: 2 }}><Volume2 size={14}/></button>}
        <button onClick={onDelete} aria-label="Delete" style={{ background: 'none', border: 'none', color: '#6d5a8f', cursor: 'pointer', display: 'flex', padding: 2 }}><Trash2 size={13}/></button>
      </div>
      {move.signature ? (
        <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 9 }}>🗣 Coach calls it verbatim</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
          {move.strikes.map((s, i) => (
            <span key={i} style={{ font: "800 8.5px 'Orbitron',sans-serif", color: chipColor(s), background: `${chipColor(s)}1a`, border: `1px solid ${chipColor(s)}55`, borderRadius: 6, padding: '4px 7px' }}>{s.toUpperCase()}</span>
          ))}
        </div>
      )}
      {/* Rotation toggle — include in Combo Coach call rotation */}
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ width: 34, height: 18, borderRadius: 9, position: 'relative', background: move.rotation ? VIOLET : 'rgba(255,255,255,0.14)', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 2, left: move.rotation ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }}/>
        </span>
        <span style={{ font: "700 9px 'Rajdhani',sans-serif", color: move.rotation ? '#c9a6ff' : '#8b83a8' }}>{move.rotation ? 'In Combo Coach rotation' : 'Not in rotation'}</span>
      </button>
    </div>
  );
}
