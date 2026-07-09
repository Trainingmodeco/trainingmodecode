import { useState, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { Trophy, Flame, Calendar, TrendingUp, Zap, Share2, Shield, Star, Crown, Swords } from 'lucide-react';
import { C } from './Styles';
import { loadStats, getLevel, getLevelProgress, getWeeklySessions, getStreak } from './data/userStats';
import { shareTrainingResult, shareRankUp } from './data/shareUtils';

const RANKS = [
  { name: 'Combat Rookie', xp: 0, color: '#b87333', symbol: 'I', icon: 'shield', glow: 'rgba(184,115,51,0.5)' },
  { name: 'Gym Warrior', xp: 500, color: '#c0c0c0', symbol: 'II', icon: 'swords', glow: 'rgba(192,192,192,0.5)' },
  { name: 'Ring General', xp: 1500, color: '#fde047', symbol: 'III', icon: 'star', glow: 'rgba(253,224,71,0.5)' },
  { name: 'Combat Elite', xp: 3500, color: '#60a5fa', symbol: 'IV', icon: 'zap', glow: 'rgba(96,165,250,0.5)' },
  { name: 'Iron Legend', xp: 7000, color: '#c084fc', symbol: 'V', icon: 'trophy', glow: 'rgba(192,132,252,0.5)' },
  { name: 'Apex Champion', xp: 12000, color: '#f43f5e', symbol: 'VI', icon: 'crown', glow: 'rgba(244,63,94,0.5)' },
];

function getRank(xp) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.xp) rank = r;
  }
  return rank;
}

function getRankProgress(xp) {
  const rank = getRank(xp);
  const idx = RANKS.indexOf(rank);
  const next = RANKS[idx + 1];
  if (!next) return 1;
  const progress = (xp - rank.xp) / (next.xp - rank.xp);
  return Math.min(1, Math.max(0, progress));
}

function formatDate(iso) {
  const d = new Date(iso);
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

function TrophyIcon({ icon, size, color }) {
  switch (icon) {
    case 'shield': return <Shield size={size} color={color} strokeWidth={2}/>;
    case 'swords': return <Swords size={size} color={color} strokeWidth={2}/>;
    case 'star': return <Star size={size} color={color} strokeWidth={2}/>;
    case 'zap': return <Zap size={size} color={color} strokeWidth={2}/>;
    case 'trophy': return <Trophy size={size} color={color} strokeWidth={2}/>;
    case 'crown': return <Crown size={size} color={color} strokeWidth={2}/>;
    default: return <Shield size={size} color={color} strokeWidth={2}/>;
  }
}

function TrophyBadge({ rank, unlocked, isCurrent }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: unlocked
          ? `radial-gradient(circle at 30% 30%, ${rank.color}30, ${rank.color}08)`
          : 'rgba(255,255,255,0.02)',
        border: unlocked
          ? `2px solid ${rank.color}${isCurrent ? 'cc' : '70'}`
          : '2px solid rgba(255,255,255,0.08)',
        boxShadow: unlocked
          ? `0 0 ${isCurrent ? '14' : '8'}px ${rank.glow}, inset 0 0 8px ${rank.color}15`
          : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        transition: 'all 0.3s ease',
        opacity: unlocked ? 1 : 0.4,
      }}>
        {unlocked ? (
          <TrophyIcon icon={rank.icon} size={20} color={rank.color}/>
        ) : (
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
            color: 'rgba(255,255,255,0.15)',
          }}>{rank.symbol}</span>
        )}
        {isCurrent && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 12, height: 12, borderRadius: '50%',
            background: rank.color, border: '2px solid #0a0014',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }}/>
          </div>
        )}
      </div>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
        fontSize: 7, letterSpacing: '0.04em', textAlign: 'center',
        color: unlocked ? rank.color : 'rgba(255,255,255,0.2)',
        maxWidth: 52, lineHeight: 1.2,
      }}>{rank.name.split(' ')[0].toUpperCase()}</span>
    </div>
  );
}

export default function ProgressScreen({ onHome, profile }) {
  const [stats, setStats] = useState(() => loadStats());

  useEffect(() => {
    const refreshStats = () => setStats(loadStats());
    refreshStats();
    window.addEventListener('training-mode-stats-updated', refreshStats);
    window.addEventListener('storage', refreshStats);
    return () => {
      window.removeEventListener('training-mode-stats-updated', refreshStats);
      window.removeEventListener('storage', refreshStats);
    };
  }, []);

  const totalXp = stats.xp || 0;
  const level = getLevel(totalXp);
  const { current: levelXp, needed: levelNeeded } = getLevelProgress(totalXp);
  const streak = getStreak(stats);
  const weeklySessions = getWeeklySessions(stats);
  const totalSessions = stats.sessions.length;
  const rank = getRank(totalXp);
  const rankProgress = getRankProgress(totalXp);

  const recentSessions = [...stats.sessions].reverse().slice(0, 20);

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>
      <CornerHUD color="rgba(168,85,247,0.4)" size={24} inset={12}/>

      <TrainingHeader
        title="PROGRESS"
        subtitle="Track your rank, XP, and streaks."
        onHome={onHome}
      />

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '14px 16px 0', paddingTop: 16,
        paddingBottom: 'calc(190px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* RANK CARD */}
        <div style={{
          borderRadius: 12, padding: '14px 14px',
          background: 'linear-gradient(145deg, rgba(20,0,35,0.95), rgba(42,10,62,0.5))',
          border: `1.5px solid ${rank.color}40`,
          boxShadow: `0 0 20px ${rank.color}15`,
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 10,
              background: `${rank.color}15`, border: `2px solid ${rank.color}60`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Shield size={22} color={rank.color} strokeWidth={2.2}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted,
                letterSpacing: '0.18em', marginBottom: 3,
              }}>CURRENT RANK</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
                color: rank.color, letterSpacing: '0.06em',
                textShadow: `0 0 12px ${rank.color}80`,
              }}>{rank.name.toUpperCase()}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted }}>
                  Level <span style={{ color: C.yellow }}>{level}</span>
                </span>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted }}>
                  XP <span style={{ color: C.neon }}>{totalXp}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Level XP Bar */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.15em' }}>LEVEL XP</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted }}>{levelXp}/{levelNeeded}</span>
            </div>
            <div style={{
              height: 6, borderRadius: 999, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.15)',
            }}>
              <div style={{
                width: `${Math.round((levelXp / levelNeeded) * 100)}%`, height: '100%', borderRadius: 999,
                background: `linear-gradient(90deg, ${C.neon}, ${C.yellow})`,
                boxShadow: '0 0 8px rgba(253,224,71,0.4)',
                transition: 'width 0.5s ease',
              }}/>
            </div>
          </div>

          {/* Rank Progress Bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.15em' }}>RANK PROGRESS</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted }}>{Math.round(rankProgress * 100)}%</span>
            </div>
            <div style={{
              height: 6, borderRadius: 999, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${rank.color}30`,
            }}>
              <div style={{
                width: `${Math.round(rankProgress * 100)}%`, height: '100%', borderRadius: 999,
                background: `linear-gradient(90deg, ${rank.color}, ${rank.color}cc)`,
                boxShadow: `0 0 8px ${rank.color}60`,
                transition: 'width 0.5s ease',
              }}/>
            </div>
          </div>

          {/* Share Rank Button */}
          <button
            onClick={() => shareRankUp({
              rank: rank.name,
              level,
              totalXp,
              streak,
            })}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '10px 0',
              borderRadius: 8,
              border: '1px solid rgba(192,132,252,0.4)',
              background: 'rgba(192,132,252,0.12)',
              color: '#c084fc',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(192,132,252,0.2)';
              e.currentTarget.style.boxShadow = '0 0 14px rgba(192,132,252,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(192,132,252,0.12)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Share2 size={13}/>
            SHARE RANK
          </button>
        </div>

        {/* TROPHY BADGES */}
        <div style={{
          borderRadius: 12, padding: '14px 10px',
          background: 'rgba(10,2,20,0.85)', border: '1px solid rgba(168,85,247,0.12)',
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, color: C.muted,
            letterSpacing: '0.18em', marginBottom: 12, textAlign: 'center', fontWeight: 700,
          }}>RANK TROPHIES</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            justifyItems: 'center',
          }}>
            {RANKS.map((r, i) => {
              const unlocked = totalXp >= r.xp;
              const isCurrent = r === rank;
              return <TrophyBadge key={i} rank={r} unlocked={unlocked} isCurrent={isCurrent}/>;
            })}
          </div>
        </div>

        {/* STATS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'SESSIONS', value: String(totalSessions), Icon: Calendar, color: C.neon, iconBg: 'rgba(168,85,247,0.12)' },
            { label: 'STREAK', value: streak > 0 ? `${streak}d` : '0d', Icon: Flame, color: C.rush, iconBg: 'rgba(255,107,0,0.12)' },
            { label: 'THIS WEEK', value: String(weeklySessions.length), Icon: TrendingUp, color: C.yellow, iconBg: 'rgba(253,224,71,0.12)' },
            { label: 'LEVEL', value: String(level), Icon: Trophy, color: C.yellow, iconBg: 'rgba(253,224,71,0.12)' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: 10, background: 'rgba(10,2,20,0.75)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${s.color}30`,
              }}>
                <s.Icon size={14} color={s.color}/>
              </div>
              <div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 8, color: C.muted,
                  letterSpacing: '0.1em', fontWeight: 600,
                }}>{s.label}</div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
                  color: s.color, lineHeight: 1, marginTop: 3,
                  textShadow: `0 0 8px ${s.color}40`,
                }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* SHARE CARD */}
        <div style={{
          borderRadius: 10, padding: '10px 14px',
          background: 'rgba(10,2,20,0.8)', border: '1px solid rgba(168,85,247,0.15)',
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 11,
            color: C.muted, lineHeight: 1.6, marginBottom: 8,
          }}>
            {`${rank.name} · Level ${level} · ${totalSessions} session${totalSessions !== 1 ? 's' : ''} complete`}
            {streak > 0 ? ` · ${streak}-day streak` : ''}<br/>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              #TrainingMode #FightFit #CombatComplete #FitnessJourney
            </span>
          </div>
          <button onClick={() => shareTrainingResult({
            mode: rank.name,
            xpEarned: totalXp,
            streak,
            level,
            completedCount: totalSessions,
          })} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 7, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.neon}, ${C.magenta})`,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
            color: '#fff', letterSpacing: '0.1em',
            boxShadow: '0 0 12px rgba(168,85,247,0.4)',
          }}>
            <Share2 size={12}/> SHARE PROGRESS
          </button>
        </div>

        {/* SESSION HISTORY */}
        <div style={{
          borderRadius: 10, padding: '12px 14px',
          background: 'rgba(10,2,20,0.8)', border: '1px solid rgba(168,85,247,0.1)',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, color: C.muted,
            letterSpacing: '0.14em', marginBottom: 8, fontWeight: 700,
          }}>SESSION HISTORY</div>

          {recentSessions.length === 0 ? (
            <div style={{
              padding: '20px 0', textAlign: 'center',
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 13,
              color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
            }}>
              No sessions yet.<br/>Start training to build your score.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentSessions.map((s, i) => {
                const stopped = !s.xpEarned || s.completedCount === 0;
                return (
                  <div key={s.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    opacity: stopped ? 0.55 : 1,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: s.completedCount === s.totalCount ? C.yellow : stopped ? 'rgba(255,255,255,0.2)' : C.muted,
                      boxShadow: s.completedCount === s.totalCount ? `0 0 6px ${C.yellow}80` : 'none',
                    }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12,
                        color: stopped ? 'rgba(255,255,255,0.5)' : C.text,
                      }}>{s.type}{stopped ? ' — Attempted' : ''}</div>
                      <div style={{
                        fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 10, color: C.muted,
                      }}>{formatDate(s.completedAt)} &middot; {s.completedCount}/{s.totalCount ?? '?'}</div>
                    </div>
                    <div style={{
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                      color: stopped ? 'rgba(255,255,255,0.3)' : C.neon,
                    }}>{stopped ? '0 XP' : `+${s.xpEarned} XP`}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </PhoneFrame>
  );
}
