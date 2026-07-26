import { useMemo } from 'react';
import SafeImage from '../SafeImage';
import { loadProfile } from '../data/userProfile';
import { nextVsVariant } from '../data/ghostBattles';

// Item 11a — the VS pre-fight screen.
//
// The engine, the recording and the six art variants have all shipped; this is
// the screen that was missing. Runs between "START SESSION" and the timer
// whenever a ghost is loaded, so a race feels like a fight being made rather
// than a checkbox on the setup screen.
const GOLD = '#fde047';
const VIOLET = '#b06aff';

const vsCSS = `
@keyframes gvs-in    { from { opacity: 0; } to { opacity: 1; } }
@keyframes gvs-left  { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: none; } }
@keyframes gvs-right { from { opacity: 0; transform: translateX(22px); }  to { opacity: 1; transform: none; } }
@keyframes gvs-slam  { 0% { opacity: 0; transform: scale(2.2); } 55% { opacity: 1; transform: scale(0.92); } 100% { transform: scale(1); } }
`;

function Column({ align, label, name, stats, color, animation }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: align, animation }}>
      <div style={{ font: "700 7px 'Press Start 2P',monospace", color: '#9a90b8', letterSpacing: '0.12em', marginBottom: 5 }}>{label}</div>
      <div style={{
        font: "900 15px 'Orbitron',sans-serif", color, letterSpacing: '0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 7,
      }}>{name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 6 }}>
            <span style={{ font: "800 11px 'Orbitron',sans-serif", color: '#fff' }}>{s.value}</span>
            <span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', alignSelf: 'flex-end', paddingBottom: 1 }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object}   ghost      the GhostRecord being raced
 * @param {string}   [sourceLabel]  "Your best" | "Challenge code" | a friend's name
 * @param {function} onAccept
 * @param {function} onBack
 */
export default function GhostVsScreen({ ghost, sourceLabel, onAccept, onBack }) {
  const profile = loadProfile() || {};
  const sex = String(profile.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  // One variant per battle, rotated so the same pose never lands twice running.
  const variant = useMemo(() => nextVsVariant(), []);
  const art = `/static/ghost/vs-${sex}-${variant}.webp`;

  if (!ghost) return null;

  const isMine = ghost.ownerId === 'me';
  const source = sourceLabel || (isMine ? 'YOUR BEST RUN' : 'CHALLENGE CODE');
  const byTime = ghost.winMetric === 'time';
  const mins = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

  const ghostStats = byTime
    ? [{ value: mins(ghost.completionSec), label: 'TIME' }, { value: ghost.totalStrikes, label: 'STRIKES' }]
    : [{ value: ghost.totalStrikes, label: 'STRIKES' }, { value: ghost.bestRound, label: 'BEST ROUND' }];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998, overflow: 'hidden',
      background: '#050010', animation: 'gvs-in 0.3s ease-out',
      display: 'flex', flexDirection: 'column',
    }}>
      <style dangerouslySetInnerHTML={{ __html: vsCSS }}/>

      {/* Art — full bleed, dimmed under the copy so the stats stay readable */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <SafeImage src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,0,16,0.55) 0%, rgba(5,0,16,0.15) 35%, rgba(5,0,16,0.92) 78%, #050010 100%)' }}/>
      </div>

      <div style={{
        position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 18px calc(26px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ font: "700 7px 'Press Start 2P',monospace", color: VIOLET, letterSpacing: '0.16em', textAlign: 'center', marginBottom: 4 }}>
          ◈ GHOST BATTLE ◈
        </div>
        <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', textAlign: 'center', marginBottom: 14 }}>
          {source} · {ghost.source?.disciplineOrCampaign || 'Boxing'} · {String(ghost.source?.difficulty || 'normal').toUpperCase()}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
          <Column
            align="left" label="YOU" color={GOLD}
            name={(profile.name || 'FIGHTER').toUpperCase()}
            stats={[{ value: '—', label: byTime ? 'TIME' : 'STRIKES' }, { value: 'LIVE', label: 'THIS RUN' }]}
            animation="gvs-left 0.45s cubic-bezier(0.22,1,0.36,1) both"
          />
          <div style={{
            flexShrink: 0, alignSelf: 'center',
            font: "900 26px 'Orbitron',sans-serif", color: '#fff',
            textShadow: `0 0 22px ${VIOLET}`, animation: 'gvs-slam 0.5s cubic-bezier(0.22,1,0.36,1) 0.2s both',
          }}>VS</div>
          <Column
            align="right" label="GHOST" color={VIOLET}
            name={`👻 ${ghost.ownerName || 'GHOST'}`}
            stats={ghostStats}
            animation="gvs-right 0.45s cubic-bezier(0.22,1,0.36,1) both"
          />
        </div>

        <div style={{
          font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8',
          textAlign: 'center', marginBottom: 14, lineHeight: 1.4,
        }}>
          {byTime
            ? 'Finish faster than the ghost to win. A loss still counts as a session.'
            : 'Most verified strikes wins. A loss still counts as a session.'}
        </div>

        <button onClick={onAccept} style={{
          width: '100%', height: 50, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${VIOLET}, #7c3aed)`, color: '#fff',
          font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.1em',
          boxShadow: `0 0 26px ${VIOLET}66`, marginBottom: 8,
        }}>ACCEPT · FIGHT</button>

        <button onClick={onBack} style={{
          width: '100%', height: 38, borderRadius: 11, cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
          color: '#9a90b8', font: "700 11px 'Orbitron',sans-serif", letterSpacing: '0.08em',
        }}>BACK</button>
      </div>
    </div>
  );
}
