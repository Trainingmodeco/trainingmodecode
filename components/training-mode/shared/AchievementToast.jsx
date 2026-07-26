import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';

// Item 10b — the unlock toast. Sits over whatever outcome screen is showing,
// one card per newly-unlocked achievement, auto-dismissing in order. Because
// award() only returns an achievement on its FIRST unlock, a re-cleared stage
// never re-fires this.
const GOLD = '#fde047';

const toastCSS = `
@keyframes ach-in  { 0% { opacity: 0; transform: translateY(-14px) scale(0.96); } 100% { opacity: 1; transform: none; } }
@keyframes ach-out { 0% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
`;

/**
 * @param {Array}  unlocked  achievements returned by award()/awardMany()
 * @param {number} [dwellMs] how long each card stays up
 */
export default function AchievementToast({ unlocked = [], dwellMs = 2600 }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { setIndex(0); setLeaving(false); }, [unlocked]);

  useEffect(() => {
    if (index >= unlocked.length) return;
    const out = setTimeout(() => setLeaving(true), dwellMs - 300);
    const next = setTimeout(() => { setLeaving(false); setIndex((i) => i + 1); }, dwellMs);
    return () => { clearTimeout(out); clearTimeout(next); };
  }, [index, unlocked.length, dwellMs]);

  const current = unlocked[index];
  if (!current) return null;

  return (
    <div style={{
      position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: 0, right: 0,
      zIndex: 10000, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none',
    }}>
      <style dangerouslySetInnerHTML={{ __html: toastCSS }}/>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        maxWidth: 320, width: '100%', padding: '10px 13px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(30,10,50,0.97), rgba(8,2,18,0.97))',
        border: `1px solid ${GOLD}66`, boxShadow: `0 6px 24px rgba(0,0,0,0.55), 0 0 22px ${GOLD}33`,
        animation: leaving ? 'ach-out 0.3s ease forwards' : 'ach-in 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 9,
          background: 'rgba(253,224,71,0.1)', border: `1px solid ${GOLD}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Award size={18} color={GOLD} strokeWidth={2}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 7px 'Press Start 2P',monospace", color: GOLD, letterSpacing: '0.14em', marginBottom: 3 }}>
            ACHIEVEMENT UNLOCKED
          </div>
          <div style={{
            font: "900 12px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{current.name}</div>
          {current.trigger && (
            <div style={{
              font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{current.trigger}</div>
          )}
        </div>
        {unlocked.length > 1 && (
          <div style={{ flexShrink: 0, font: "700 9px 'Orbitron',sans-serif", color: '#9a90b8' }}>
            {index + 1}/{unlocked.length}
          </div>
        )}
      </div>
    </div>
  );
}
