import { useState } from 'react';
import SafeImage from '../SafeImage';
import ShareCardSheet from '../ShareCardSheet';
import { loadProfile } from '../data/userProfile';
import { getLastBattle, exportGhostCode, getMyBestGhost, nextVsVariant } from '../data/ghostBattles';
import { loadStats, getLevel, getStreak } from '../data/userStats';
import { getCurrentTier, tierImage } from '../data/tiers';

// Item 11c/11d — the ghost battle result, and its share card.
//
// The timer already flashes a three-second verdict at the final bell; this is
// the screen you can actually read, act on, and share. Everything it shows
// comes from the engine via getLastBattle() — battleHeadline() already writes
// the headline ("▲ 26s FASTER · GHOST DEFEATED"), so nothing is re-derived here.
const GOLD = '#fde047';
const VIOLET = '#b06aff';

const TONE = {
  victory: { color: '#22c55e', glow: 'rgba(34,197,94,0.45)', label: 'GHOST DEFEATED', icon: '🏆' },
  defeat:  { color: '#ef4444', glow: 'rgba(239,68,68,0.40)', label: 'GHOST WINS',     icon: '👻' },
  tie:     { color: GOLD,      glow: 'rgba(253,224,71,0.40)', label: 'DEAD HEAT',      icon: '🤝' },
};

const resCSS = `
@keyframes gr-in   { from { opacity: 0; } to { opacity: 1; } }
@keyframes gr-slam { 0% { opacity: 0; transform: scale(1.8); } 55% { opacity: 1; transform: scale(0.95); } 100% { transform: scale(1); } }
@keyframes gr-up   { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
`;

const fmtTime = (s) => (s == null || !Number.isFinite(s) ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

/**
 * @param {object}   [battle]   { result, headline, ghost, you } — defaults to the last one recorded
 * @param {function} onRematch
 * @param {function} onDone
 */
export default function GhostResultScreen({ battle, onRematch, onDone }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [variant] = useState(() => nextVsVariant());

  const b = battle || getLastBattle();
  if (!b?.result) return null;

  const { result, headline, ghost, you } = b;
  const tone = TONE[result.outcome] || TONE.tie;
  const byTime = result.metric === 'time';
  const profile = loadProfile() || {};
  const sex = String(profile.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const stats = loadStats();
  const tier = getCurrentTier(stats);

  const yourValue = byTime ? fmtTime(result.yourValue) : result.yourValue;
  const ghostValue = byTime ? fmtTime(result.ghostValue) : result.ghostValue;
  const metricLabel = byTime ? 'TIME' : 'STRIKES';

  // The share card reuses the app's existing renderer — ghost art as the
  // backdrop, the engine's headline as the line that matters.
  const cardData = {
    eyebrow: 'GHOST BATTLE',
    title: tone.label,
    subtitle: [headline, ghost?.source?.disciplineOrCampaign].filter(Boolean).join(' · '),
    xp: result.outcome === 'victory' ? 75 : 0,
    level: getLevel(stats.xp),
    tierLabel: tier.label,
    tierImg: tierImage(tier.id, sex),
    streak: getStreak(stats),
    sessions: Array.isArray(stats.sessions) ? stats.sessions.length : 0,
    verified: true,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998, overflow: 'hidden',
      background: '#050010', animation: 'gr-in 0.3s ease-out',
      display: 'flex', flexDirection: 'column',
    }}>
      <style dangerouslySetInnerHTML={{ __html: resCSS }}/>

      <div style={{ position: 'absolute', inset: 0 }}>
        <SafeImage src={`/static/ghost/vs-${sex}-${variant}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', opacity: 0.5 }}/>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${tone.glow} 0%, rgba(5,0,16,0.85) 55%, #050010 100%)` }}/>
      </div>

      <div style={{
        position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 18px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 4, animation: 'gr-slam 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>{tone.icon}</div>
          <div style={{
            font: "900 22px 'Orbitron',sans-serif", color: tone.color, letterSpacing: '0.08em',
            textShadow: `0 0 22px ${tone.glow}`, animation: 'gr-up 0.4s ease-out 0.15s both',
          }}>{tone.label}</div>
          <div style={{ font: "700 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 5, animation: 'gr-up 0.4s ease-out 0.25s both' }}>
            {headline}
          </div>
          {result.decidedByTiebreak && result.outcome !== 'tie' && (
            <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 3 }}>
              decided on the tiebreak
            </div>
          )}
        </div>

        {/* Head to head */}
        <div style={{
          display: 'flex', alignItems: 'stretch', borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${tone.color}44`, marginBottom: 10, animation: 'gr-up 0.4s ease-out 0.3s both',
        }}>
          <div style={{ flex: 1, padding: '11px 10px', textAlign: 'center', background: 'rgba(8,2,18,0.85)' }}>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', letterSpacing: '0.1em', marginBottom: 3 }}>YOU</div>
            <div style={{ font: "900 18px 'Orbitron',sans-serif", color: result.outcome === 'victory' ? tone.color : '#fff' }}>{yourValue}</div>
            <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 1 }}>{metricLabel}</div>
          </div>
          <div style={{ width: 1, background: `${tone.color}33` }}/>
          <div style={{ flex: 1, padding: '11px 10px', textAlign: 'center', background: 'rgba(8,2,18,0.85)' }}>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', letterSpacing: '0.1em', marginBottom: 3 }}>👻 {(ghost?.ownerName || 'GHOST').slice(0, 12)}</div>
            <div style={{ font: "900 18px 'Orbitron',sans-serif", color: result.outcome === 'defeat' ? tone.color : '#fff' }}>{ghostValue}</div>
            <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 1 }}>{metricLabel}</div>
          </div>
        </div>

        {/* Best round is the tiebreak metric and BOTH sides record it, so it is
            a real comparison. The ghost keeps 10-second buckets rather than
            rounds, so there is no honest round-for-round matchup to show —
            your own round breakdown sits below instead. */}
        <div style={{
          display: 'flex', alignItems: 'stretch', borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(168,85,247,0.25)', marginBottom: 10, animation: 'gr-up 0.4s ease-out 0.33s both',
        }}>
          <div style={{ flex: 1, padding: '8px 10px', textAlign: 'center', background: 'rgba(8,2,18,0.85)' }}>
            <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff' }}>{you?.bestRound ?? '—'}</div>
            <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 1 }}>YOUR BEST ROUND</div>
          </div>
          <div style={{ width: 1, background: 'rgba(168,85,247,0.2)' }}/>
          <div style={{ flex: 1, padding: '8px 10px', textAlign: 'center', background: 'rgba(8,2,18,0.85)' }}>
            <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#c9a6ff' }}>{ghost?.bestRound ?? '—'}</div>
            <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 1 }}>GHOST BEST ROUND</div>
          </div>
        </div>

        {Array.isArray(you?.perRoundStrikes) && you.perRoundStrikes.length > 0 && (
          <div style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 11, padding: '9px 12px', marginBottom: 10, animation: 'gr-up 0.4s ease-out 0.35s both' }}>
            <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 6 }}>YOUR ROUNDS</div>
            {(() => {
              const rounds = you.perRoundStrikes.slice(0, 6);
              const peak = Math.max(1, ...rounds);
              return rounds.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ flexShrink: 0, width: 16, font: "800 8px 'Orbitron',sans-serif", color: '#8b83a8' }}>R{i + 1}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((n / peak) * 100)}%`, height: '100%', background: n === peak ? 'linear-gradient(90deg,#b06aff,#fde047)' : 'rgba(176,106,255,0.6)' }}/>
                  </div>
                  <span style={{ flexShrink: 0, width: 24, textAlign: 'right', font: "800 9px 'Orbitron',sans-serif", color: '#fff' }}>{n}</span>
                </div>
              ));
            })()}
          </div>
        )}

        {result.outcome === 'victory' && (
          <div style={{ textAlign: 'center', font: "800 10px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.08em', marginBottom: 10 }}>
            +75 BONUS XP
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button onClick={onRematch} style={{
            width: '100%', height: 46, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${VIOLET}, #7c3aed)`, color: '#fff',
            font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.1em', boxShadow: `0 0 22px ${VIOLET}55`,
          }}>REMATCH</button>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={() => {
              // Same challenge flow the Fight Focus setup screen already uses:
              // export MY best run as a code and copy it. There is no server —
              // ghost codes travel by paste.
              const mine = getMyBestGhost(ghost?.source?.mode, ghost?.source?.disciplineOrCampaign);
              const code = mine ? exportGhostCode(mine) : null;
              if (code && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
              setToast(code ? 'Challenge code copied — send it and let them race your run.' : 'No verified run to challenge with yet.');
              setTimeout(() => setToast(''), 3200);
            }} style={{
              flex: 1, height: 40, borderRadius: 11, cursor: 'pointer',
              border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.08)',
              color: '#b06aff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em',
            }}>CHALLENGE A FRIEND</button>
            <button onClick={() => setShareOpen(true)} style={{
              flex: 1, height: 40, borderRadius: 11, cursor: 'pointer',
              border: '1px solid rgba(253,224,71,0.4)', background: 'rgba(253,224,71,0.08)',
              color: GOLD, font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em',
            }}>SHARE CARD</button>
          </div>
          <button onClick={onDone} style={{
            width: '100%', height: 38, borderRadius: 11, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
            color: '#9a90b8', font: "700 11px 'Orbitron',sans-serif", letterSpacing: '0.08em',
          }}>DONE</button>
        </div>

        {toast && (
          <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c9a6ff', textAlign: 'center', marginTop: 8 }}>{toast}</div>
        )}
      </div>

      {shareOpen && (
        <ShareCardSheet
          cardData={cardData}
          shareData={{ mode: 'Ghost Battle', eyebrow: 'GHOST BATTLE', xpEarned: cardData.xp }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
