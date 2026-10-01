import { useMemo, useState } from 'react';
import SafeImage from './SafeImage';
import ProGateOverlay from './shared/ProGateOverlay';
import {
  featuredEntry, entryFor, vaultEntries, loadProgress, setPrefs, status, canPlay, rewardState, claimReward,
  fitTrainingDays, fitTotal, fightTotal, stagePlayable, fitDayCfg, fightDayCfg, stageCfg, fmtEnd, daysLeft, windowState,
} from './data/concepts';
import { addBonusXp } from './data/userStats';

// A concept drop's home: one page, three tabs — FIT (the weekly program),
// FIGHT (five days of called rounds), ARCADE (the 10-stage gauntlet). The
// sessions themselves run on the existing Fit player and Fight Focus timer;
// this page only shows the plan and hands the right cfg to them.
const H = "'Orbitron',sans-serif";
const B = "'Rajdhani',sans-serif";
const GOLD = '#fde047';
const MUTED = '#9a90b8';
const TABS = [
  { id: 'fit', label: 'FIT', color: '#b58cff' },
  { id: 'fight', label: 'FIGHT', color: '#60a5fa' },
  { id: 'arcade', label: 'ARCADE', color: GOLD },
];

const chip = (bg, border, color) => ({
  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: 99,
  background: bg, border: `1px solid ${border}`, color, font: `800 8.5px ${H}`, letterSpacing: '0.14em',
});

function DayRow({ n, label, focus, body, state, accent }) {
  const done = state === 'done', next = state === 'next', rest = state === 'rest', locked = state === 'locked';
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'stretch', borderRadius: 12, padding: '10px 12px',
      background: 'rgba(14,4,28,0.86)', opacity: rest || locked ? 0.6 : 1,
      border: `1px solid ${next ? GOLD : 'rgba(168,85,247,0.28)'}`, boxShadow: next ? '0 0 18px rgba(253,224,71,0.18)' : 'none',
    }}>
      <div style={{
        flex: '0 0 38px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 9,
        background: done ? 'rgba(34,197,94,0.18)' : next ? 'rgba(253,224,71,0.16)' : 'rgba(168,85,247,0.14)',
        border: `1px solid ${done ? 'rgba(34,197,94,0.6)' : next ? GOLD : 'rgba(168,85,247,0.4)'}`,
      }}>
        <div style={{ font: `800 6.5px ${H}`, letterSpacing: '0.14em', color: '#c4b5fd' }}>{typeof n === 'number' ? 'DAY' : ''}</div>
        <div style={{ font: `900 16px ${H}`, color: done ? '#86efac' : next ? GOLD : '#e9d5ff' }}>{done ? '✓' : locked ? '🔒' : n}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
          <div style={{ font: `900 12px ${H}`, letterSpacing: '0.05em', color: '#fff' }}>{label}</div>
          <div style={{ font: `800 7.5px ${H}`, letterSpacing: '0.14em', color: next ? GOLD : accent || MUTED, whiteSpace: 'nowrap' }}>{focus}</div>
        </div>
        <div style={{ font: `600 11.5px ${B}`, color: '#bfb2da', marginTop: 3, lineHeight: 1.3 }}>{body}</div>
      </div>
    </div>
  );
}

export default function ConceptScreen({ conceptId, initialTab = 'fit', onBack, onStartFit, onStartFight, onPaywall }) {
  const entry = useMemo(() => (conceptId ? entryFor(conceptId) : featuredEntry()), [conceptId]);
  const [tab, setTab] = useState(initialTab);
  const [progress, setProgress] = useState(() => (entry ? loadProgress(entry.concept.id) : null));
  const [gate, setGate] = useState(false);
  const [claimed, setClaimed] = useState(null);

  if (!entry) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, font: `700 11px ${H}`, letterSpacing: '0.16em' }}>
        NO CONCEPT DROP RIGHT NOW
      </div>
    );
  }
  const c = entry.concept;
  const st = status(c, progress);
  const win = windowState(entry);
  const reward = rewardState(entry, Date.now(), progress);
  const tier = progress.tier || 'normal';
  const play = canPlay(entry, Date.now(), progress);
  const prefs = (p) => setProgress(setPrefs(c.id, p));

  const guard = (fn) => () => { if (!play) { setGate(true); return; } fn(); };
  const startFit = guard(() => onStartFit?.(fitDayCfg(c, { tier, home: progress.home })));
  const startFight = guard(() => onStartFight?.(fightDayCfg(c, { tier }), c.fight.discipline));
  const startStage = (i) => guard(() => onStartFight?.(stageCfg(c, i, { tier }), c.fight.discipline))();
  const claim = () => {
    const xp = addBonusXp(c.reward.xp);
    setProgress(claimReward(c.id));
    setClaimed(xp);
  };

  const trainDays = fitTrainingDays(c);
  let trainIdx = -1;
  const fitRows = c.fit.days.map((d, i) => {
    if (d.rest) return <DayRow key={i} n={i + 1} label={d.label} focus={d.focus} body={d.intro} state="rest" />;
    trainIdx += 1;
    const doneThisWeek = (progress.fitDone % trainDays.length) > trainIdx || st.fitComplete;
    const state = doneThisWeek ? 'done' : st.fitNext === trainIdx ? 'next' : '';
    return <DayRow key={i} n={i + 1} label={d.label} focus={d.focus} state={state} body={d.exercises.map(e => (progress.home && e.swap && e.equip !== 'bodyweight' && e.equip !== 'bar' ? e.swap : e.name)).join(' · ')} />;
  });
  const fightInWeek = st.fightComplete ? c.fight.days.length : progress.fightDone % c.fight.days.length;
  const fightRows = c.fight.days.map((d, i) => (
    <DayRow key={i} n={i + 1} label={d.label} focus={d.focus} accent="#93c5fd"
      state={i < fightInWeek ? 'done' : i === st.fightNext ? 'next' : ''}
      body={d.rounds.map(r => r.title).join(' · ')} />
  ));

  const nextFitDay = st.fitNext != null ? trainDays[st.fitNext] : null;
  const nextFightDay = st.fightNext != null ? c.fight.days[st.fightNext] : null;
  const cta = tab === 'fit'
    ? (st.fitComplete ? null : { label: `▶ START ${nextFitDay?.label || 'DAY'}`, onClick: startFit })
    : tab === 'fight'
      ? (st.fightComplete ? null : { label: `▶ START DAY ${(st.fightNext ?? 0) + 1} · ${nextFightDay?.label || ''}`, onClick: startFight })
      : null;
  const tabColor = TABS.find(t => t.id === tab)?.color || GOLD;
  const vault = vaultEntries();

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: '#07020f', color: '#fff', paddingBottom: 170 }}>
      {/* hero */}
      <div style={{ position: 'relative', height: 236, overflow: 'hidden' }}>
        <SafeImage src={tab === 'fight' ? c.art.poster : c.art.wide} alt="" loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(7,2,15,.55),rgba(7,2,15,0) 30%,rgba(7,2,15,.45) 62%,#07020f 98%)' }} />
        <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} aria-label="Back" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>‹</button>
          <span style={chip(c.accent, c.accent, '#2a0034')}>◆ CONCEPT DROP</span>
          <span style={{ marginLeft: 'auto', ...chip('rgba(0,0,0,0.6)', 'rgba(253,224,71,0.35)', GOLD) }}>
            {win === 'live' ? `ENDS ${fmtEnd(entry)} · ${daysLeft(entry)}D` : win === 'upcoming' ? 'PREVIEW · NOT RELEASED' : 'CONCEPT VAULT'}
          </span>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 10 }}>
          <div style={{ font: `900 34px ${H}`, lineHeight: 1, letterSpacing: '0.04em', textShadow: '0 2px 20px rgba(0,0,0,.8)' }}>{c.title}</div>
          <div style={{ font: `600 13px ${B}`, color: '#f5d0fe', marginTop: 4, textShadow: '0 1px 8px #000' }}>{c.tagline}</div>
        </div>
      </div>

      <div style={{ padding: '6px 16px 0' }}>
        {/* parts done + reward */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
          {TABS.map(t => {
            const done = t.id === 'fit' ? st.fitComplete : t.id === 'fight' ? st.fightComplete : st.arcadeComplete;
            const on = tab === t.id;
            const sub = t.id === 'fit' ? `${progress.fitDone}/${fitTotal(c)}` : t.id === 'fight' ? `${progress.fightDone}/${fightTotal(c)}` : `${progress.cleared.length}/${c.arcade.stages.length}`;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
                padding: '8px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                background: on ? `${t.color}22` : 'rgba(255,255,255,0.03)', border: `1.5px solid ${on ? t.color : 'rgba(255,255,255,0.12)'}`,
              }}>
                <div style={{ font: `900 12px ${H}`, letterSpacing: '0.12em', color: on ? t.color : '#d8ccf0' }}>{done ? '✓ ' : ''}{t.label}</div>
                <div style={{ font: `700 10px ${B}`, color: MUTED, marginTop: 1 }}>{sub}</div>
              </button>
            );
          })}
        </div>

        {reward === 'ready' && (
          <button type="button" onClick={claim} style={{ width: '100%', marginBottom: 10, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${GOLD}`, background: 'linear-gradient(90deg,rgba(120,20,140,.6),rgba(40,6,60,.85))', color: GOLD, font: `900 12px ${H}`, letterSpacing: '0.12em' }}>
            🏆 CLAIM {c.reward.title} · +{c.reward.xp} XP
          </button>
        )}
        {(reward === 'claimed' || claimed != null) && (
          <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid rgba(34,197,94,0.55)', background: 'rgba(34,197,94,0.12)', textAlign: 'center', font: `900 11px ${H}`, letterSpacing: '0.12em', color: '#86efac' }}>
            ✓ {c.reward.title} EARNED{claimed ? ` · +${claimed} XP` : ''}
          </div>
        )}
        {reward === 'expired' && (
          <div style={{ marginBottom: 10, font: `600 11.5px ${B}`, color: MUTED, textAlign: 'center' }}>All three done. The limited {c.reward.title} title ended with the drop.</div>
        )}

        {/* tier + (fit) gym/home */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
          {['easy', 'normal', 'hard'].map(t => (
            <button key={t} type="button" onClick={() => prefs({ tier: t })} style={{
              padding: '8px 0', borderRadius: 9, cursor: 'pointer', font: `800 10px ${H}`, letterSpacing: '0.12em',
              background: tier === t ? 'rgba(253,224,71,0.14)' : 'transparent', border: `1px solid ${tier === t ? GOLD : 'rgba(255,255,255,0.12)'}`, color: tier === t ? GOLD : '#bfb2da',
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        {tab === 'fit' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[[false, 'GYM'], [true, 'HOME · NO WEIGHTS']].map(([h, l]) => (
              <button key={l} type="button" onClick={() => prefs({ home: h })} style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer', font: `800 9px ${H}`, letterSpacing: '0.12em',
                background: progress.home === h ? 'rgba(181,140,255,0.16)' : 'transparent', border: `1px solid ${progress.home === h ? '#b58cff' : 'rgba(255,255,255,0.12)'}`, color: progress.home === h ? '#e9d5ff' : '#9a90b8',
              }}>{l}</button>
            ))}
          </div>
        )}

        {tab === 'fit' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0 8px', font: `800 8px ${H}`, letterSpacing: '0.14em' }}>
              <span style={{ color: '#c4b5fd' }}>{st.fitComplete ? 'PROGRAM COMPLETE' : `WEEK ${st.fitWeek} OF ${c.fit.weeks}`}</span>
              <span style={{ color: MUTED }}>{c.fit.days.length - trainDays.length} REST DAYS · ~{c.fit.minutes} MIN</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{fitRows}</div>
          </>
        )}
        {tab === 'fight' && (
          <>
            <div style={{ margin: '2px 0 8px', font: `600 11.5px ${B}`, color: '#93a4c8' }}>
              {(c.fight.weeks || 1) > 1 && <b style={{ color: '#c4b5fd' }}>{st.fightComplete ? 'PROGRAM COMPLETE · ' : `WEEK ${st.fightWeek} OF ${c.fight.weeks} · `}</b>}
              {c.fight.discipline} · {c.fight.roundMin}:00 rounds · runs on the Fight Focus timer, the coach calls every round.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{fightRows}</div>
          </>
        )}
        {tab === 'arcade' && (
          <>
            <div style={{ margin: '2px 0 8px', font: `600 11.5px ${B}`, color: '#cfc3e8' }}>Hybrid fit × fight stations. Stages 1–9 open now. <b style={{ color: GOLD }}>The boss unlocks</b> when you finish the Fit or the Fight program.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.arcade.stages.map((s, i) => {
                const cleared = progress.cleared.includes(i);
                const open = stagePlayable(c, i, progress);
                return (
                  <button key={i} type="button" disabled={!open} onClick={() => startStage(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: open ? 'pointer' : 'default',
                    padding: s.boss ? '10px 12px' : '8px 12px', borderRadius: 11, color: '#fff',
                    background: s.boss ? 'linear-gradient(90deg,rgba(120,20,140,.5),rgba(40,6,60,.8))' : 'rgba(16,4,30,0.85)',
                    border: `1px solid ${s.boss ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.25)'}`, opacity: open ? 1 : 0.75,
                  }}>
                    <div style={{ flex: '0 0 26px', textAlign: 'center', font: `900 13px ${H}`, color: cleared ? '#86efac' : s.boss ? GOLD : MUTED }}>{cleared ? '✓' : !open ? '🔒' : i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `900 11px ${H}`, letterSpacing: '0.05em', color: s.boss ? GOLD : '#fff' }}>{s.title} <span style={{ color: MUTED, fontWeight: 700, fontSize: 8.5 }}>· {s.format}</span></div>
                      <div style={{ font: `600 10.5px ${B}`, color: '#bfb2da', lineHeight: 1.25 }}>{s.items.join(' · ')}</div>
                      {s.boss && !open && <div style={{ font: `800 7.5px ${H}`, letterSpacing: '0.14em', color: c.accent, marginTop: 3 }}>FINISH THE FIT OR FIGHT PROGRAM TO UNLOCK</div>}
                    </div>
                    {open && !cleared && <span style={{ font: `900 9px ${H}`, color: '#1e1400', background: GOLD, padding: '6px 9px', borderRadius: 7 }}>GO</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {vault.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ font: `800 8.5px ${H}`, letterSpacing: '0.16em', color: MUTED, marginBottom: 6 }}>CONCEPT VAULT · PRO</div>
            {vault.map(v => (
              <div key={v.concept.id} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', marginBottom: 6, font: `900 11px ${H}`, color: '#e9d5ff' }}>{v.concept.title}</div>
            ))}
          </div>
        )}
      </div>

      {cta && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(64px + env(safe-area-inset-bottom,0px))', maxWidth: 440, margin: '0 auto', padding: '16px 16px 60px', background: 'linear-gradient(180deg,rgba(7,2,15,0),#07020f 22%)', zIndex: 5 }}>
          <button type="button" onClick={cta.onClick} style={{
            width: '100%', height: 52, borderRadius: 12, border: 0, cursor: 'pointer', color: '#1e1400',
            background: 'linear-gradient(180deg,#ffe574,#e7a52a)', boxShadow: `0 6px 0 #8a5a00,0 0 26px ${tabColor}55`,
            font: `900 13.5px ${H}`, letterSpacing: '0.14em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 12px',
          }}>{cta.label}</button>
        </div>
      )}

      <ProGateOverlay
        open={gate}
        title={`${c.title} IS IN THE CONCEPT VAULT`}
        body="Past concept drops stay playable with Pro. The current drop is always free."
        freeLine="Free: the current concept drop"
        proLine="Pro: every past drop in the vault, any time"
        onGoPro={() => { setGate(false); onPaywall?.(); }}
        onClose={() => setGate(false)}
      />
    </div>
  );
}
