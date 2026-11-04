import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import CornerHUD from './CornerHUD';
import SafeImage from './SafeImage';
import { levelStory } from './data/levelStory';
import { getStreak } from './data/userStats';
import { getCurrentTier, tierImage } from './data/tiers';

// The Level page: opened from Profile by tapping the avatar. It only lays out
// what data/levelStory.js works out, so the words and the maths live in one
// place (and one test suite). Orbitron and Rajdhani, purple and gold, with the
// tier's own colour for the glow and the ladder.
const GOLD = '#fde047';
const ORB = "'Orbitron',sans-serif";
const RAJ = "'Rajdhani',sans-serif";

function Card({ label, accent = 'rgba(168,85,247,0.28)', children }) {
  return (
    <section style={{ borderRadius: 14, border: `1px solid ${accent}`, background: 'rgba(8,2,18,0.8)', padding: '12px 14px 14px' }}>
      <div style={{ font: `700 9px ${ORB}`, color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 8 }}>{label}</div>
      {children}
    </section>
  );
}

// The five visible tiers as a staircase: passed tiers ticked, the current one
// lit with a marker above it, the rest dim. Little pips inside each step are
// its levels, so the exact level shows where it sits. A secret tier, for the
// athlete who is in one, is a sixth row under the stairs.
function Ladder({ nodes }) {
  const steps = nodes.filter((n) => !n.secret);
  const secret = nodes.find((n) => n.secret);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {steps.map((n, i) => {
          const lit = n.current;
          const done = n.ticked;
          const h = 52 + i * 11;
          return (
            <div key={n.id} data-tier={n.id} data-state={n.state} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {n.marker && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ font: `900 8px ${ORB}`, color: '#0a0014', background: GOLD, borderRadius: 5, padding: '2px 5px', whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(253,224,71,0.55)' }}>{n.marker.label}</span>
                  <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${GOLD}` }}/>
                </div>
              )}
              <div style={{
                width: '100%', height: h, boxSizing: 'border-box', borderRadius: 9,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0 7px',
                background: lit ? `linear-gradient(180deg, ${n.color}, ${n.color}88)` : done ? `${n.color}26` : 'rgba(255,255,255,0.03)',
                border: lit ? '2px solid rgba(255,255,255,0.55)' : done ? `1.5px solid ${n.color}aa` : `1.5px dashed ${n.color}55`,
                boxShadow: lit ? `0 0 18px -2px ${n.color}, 0 0 34px -8px ${n.color}` : 'none',
              }}>
                <span style={{ font: `900 14px ${ORB}`, lineHeight: 1, color: lit ? '#0a0014' : done ? n.color : '#6f6690' }}>{done ? '✓' : i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {n.pips.map((p) => {
                    const here = p.state === 'here';
                    const filled = p.state === 'done';
                    const base = lit ? '#0a0014' : done ? n.color : '#6f6690';
                    return (
                      <span key={p.level} style={{
                        width: here ? 8 : 5, height: here ? 8 : 5, boxSizing: 'border-box', borderRadius: '50%',
                        background: here ? '#fff' : filled || (done && !lit) ? base : 'transparent',
                        border: here ? '2px solid #0a0014' : `1.5px solid ${base}`,
                        boxShadow: here ? '0 0 6px #fff' : 'none',
                      }}/>
                    );
                  })}
                </span>
              </div>
              <div style={{ marginTop: 5, maxWidth: '100%', font: `800 7.5px ${ORB}`, letterSpacing: '0.02em', color: lit ? n.color : done ? '#fff' : '#9a90b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name.toUpperCase()}</div>
              <div style={{ font: `700 9.5px ${RAJ}`, color: lit ? '#f5e9ff' : '#9a90b8', letterSpacing: '0.02em' }}>LVL {n.levels}</div>
            </div>
          );
        })}
      </div>
      {secret && (
        <div data-tier={secret.id} data-state="current" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '8px 10px', border: `1.5px solid ${secret.color}aa`, background: `${secret.color}1f`, boxShadow: `0 0 18px -6px ${secret.color}` }}>
          <span style={{ font: `900 14px ${ORB}`, color: secret.color }}>★</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: `900 10px ${ORB}`, color: secret.color, letterSpacing: '0.04em' }}>{secret.name.toUpperCase()}</span>
            <span style={{ display: 'block', font: `700 9.5px ${RAJ}`, color: '#c4a4d8' }}>Secret tier · LVL {secret.levels}</span>
          </span>
          <span style={{ font: `900 8px ${ORB}`, color: '#0a0014', background: GOLD, borderRadius: 5, padding: '3px 6px', whiteSpace: 'nowrap' }}>{secret.marker.label}</span>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div style={{ minWidth: 0, background: 'rgba(12,2,24,0.8)', border: '1px solid rgba(168,85,247,0.22)', borderRadius: 10, padding: '7px 10px' }}>
      <div style={{ font: `700 8px ${ORB}`, color: '#9a90b8', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ font: `900 15px ${ORB}`, color: '#fff', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

export default function LevelView({ stats, name, sex, onBack, onHome, onChangeAvatar }) {
  const st = stats || { xp: 0, sessions: [] };
  const story = levelStory(st, { streak: getStreak(st), tier: getCurrentTier(st) });
  const t = story.tier;
  const avSex = String(sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const displayName = (name && String(name).trim()) ? String(name).trim().toUpperCase() : 'TRAINEE';
  const nx = story.next;

  return (
    <PhoneFrame useBrandBg>
      <CornerHUD color="rgba(168,85,247,0.3)" size={24} inset={12}/>
      {/* Same shell as the Profile overview: the page is one screen tall and
          the content scrolls inside it, above the tab bar. */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', boxSizing: 'border-box', paddingBottom: 'calc(max(96px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))' }}>
        <TrainingHeader title="YOUR LEVEL" subtitle="Where you stand and what is next." onHome={onHome} showBack onBack={onBack}/>

        <div className="no-scrollbar" data-screen="level" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '14px 14px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Hero: the portrait with the tier's glow, the level and the XP bar */}
            <section style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1.5px solid ${t.color}99`, background: `radial-gradient(ellipse at 50% 22%, ${t.color}3d, #0a0014 74%)`, padding: '18px 16px 14px', textAlign: 'center', boxShadow: `0 0 30px -12px ${t.color}` }}>
              <div style={{ width: 132, height: 164, margin: '0 auto', borderRadius: 14, overflow: 'hidden', border: `2px solid ${t.color}`, boxShadow: `0 0 34px -2px ${t.color}b3, 0 0 70px -10px ${t.color}80` }}>
                <SafeImage src={tierImage(t.id, avSex)} alt="" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
              </div>
              <div style={{ font: `900 14px ${ORB}`, color: '#fff', letterSpacing: '0.05em', marginTop: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ font: `900 38px ${ORB}`, color: GOLD, letterSpacing: '0.02em', lineHeight: 1.1, marginTop: 2, textShadow: '0 0 24px rgba(253,224,71,0.55), 0 0 50px rgba(168,85,247,0.4)' }}>{story.headline}</div>
              <div style={{ display: 'inline-block', marginTop: 6, font: `800 10px ${ORB}`, color: t.color, letterSpacing: '0.1em', border: `1px solid ${t.color}99`, background: `${t.color}1a`, borderRadius: 99, padding: '4px 12px' }}>{story.tierLabel}{t.secret ? ' ★' : ''}</div>
              <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 14 }}>
                <div style={{ width: `${story.xpInfo.pct}%`, height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
                <span style={{ font: `600 11px ${RAJ}`, color: '#9a90b8' }}>{story.xpInfo.intoLabel}</span>
                <span style={{ font: `800 10px ${ORB}`, color: GOLD, letterSpacing: '0.04em' }}>{story.xpInfo.barLabel}</span>
              </div>
            </section>

            {/* The ladder */}
            <Card label="THE LADDER">
              <Ladder nodes={story.ladder}/>
              <div style={{ font: `600 11px ${RAJ}`, color: '#9a90b8', marginTop: 10, textAlign: 'center' }}>{story.ladderNote}</div>
            </Card>

            {/* What this exact level means */}
            <Card label={story.levelTitle} accent={`${t.color}66`}>
              <p style={{ margin: 0, font: `600 14px/1.4 ${RAJ}`, color: '#f5e9ff' }}>
                <span style={{ color: '#c4a4d8' }}>{story.levelLineParts[0]}</span>{' '}
                <span style={{ fontWeight: 700 }}>{story.levelLineParts[1]}</span>
              </p>
            </Card>

            {/* What the athlete has really done */}
            <Card label={story.doneTitle}>
              <p style={{ margin: 0, font: `700 14px/1.4 ${RAJ}`, color: '#f5e9ff' }}>{story.recap}</p>
              {story.facts.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 10 }}>
                  {story.facts.map((f) => <Fact key={f.key} label={f.label} value={f.value}/>)}
                </div>
              )}
              {story.split.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div role="img" aria-label={story.split.map((x) => `${x.label} ${x.count}`).join(', ')} style={{ display: 'flex', height: 9, borderRadius: 99, overflow: 'hidden', gap: 2, background: 'rgba(255,255,255,0.05)' }}>
                    {story.split.map((x) => <div key={x.key} style={{ flex: x.count, minWidth: 4, background: x.color }}/>)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 7 }}>
                    {story.split.map((x) => (
                      <span key={x.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: `700 11px ${RAJ}`, color: '#c4a4d8' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.color }}/>{x.label} {x.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* The promotion */}
            <section style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, padding: '13px 14px', border: '1.5px solid rgba(253,224,71,0.55)', background: 'linear-gradient(90deg,rgba(253,224,71,0.16),rgba(176,106,255,0.08))', boxShadow: '0 0 18px -6px rgba(253,224,71,0.6)' }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 17px ${ORB}`, color: '#0a0014', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, boxShadow: '0 0 14px rgba(253,224,71,0.5)' }}>★</span>
              <p style={{ margin: 0, font: `700 15px/1.35 ${RAJ}`, color: '#fff7c2' }}>{story.promo}</p>
            </section>

            {/* What is next */}
            <Card label={story.nextTitle}>
              <div style={{ font: `900 19px ${ORB}`, color: GOLD, letterSpacing: '0.02em' }}>{nx.xpLine}</div>
              <div style={{ font: `600 13px/1.4 ${RAJ}`, color: '#f5e9ff', marginTop: 5 }}>{nx.paceLine}</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, font: `600 13px/1.4 ${RAJ}`, color: '#c4a4d8', marginTop: 6 }}>
                {nx.nextTier && <span aria-hidden="true" style={{ flexShrink: 0, width: 9, height: 9, borderRadius: '50%', marginTop: 5, background: nx.nextTier.color, boxShadow: `0 0 8px ${nx.nextTier.color}` }}/>}
                <span>{nx.tierLine}</span>
              </div>
            </Card>

            {/* Nothing is lost: the editor is one quiet tap away. */}
            <button type="button" onClick={onChangeAvatar} style={{ alignSelf: 'center', minHeight: 40, padding: '0 18px', borderRadius: 11, cursor: 'pointer', background: 'transparent', border: '1px dashed rgba(168,85,247,0.4)', font: `800 10px ${ORB}`, color: '#c9a6ff', letterSpacing: '0.08em' }}>
              ⚔️ CHANGE AVATAR
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
