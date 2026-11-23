import { useEffect, useState } from 'react';
import { HOME, head, orb, goldText, Look, Feature } from './looksKit';
import { WeekChip } from './lookStreak';
import HomeHeader from '../shared/HomeHeader';
import PathMap from './ui/PathMap';
import ReplaySheet, { PathChoice } from './ui/ReplaySheet';
import NextUpRow from './ui/NextUpRow';
import StageStarsCard from './ui/StageStarsCard';
import ArcadeStageClearOverlay from '../ArcadeStageClearOverlay';
import { sagaPath, campPath, stageStars, nextStarLine, endStarsLine, fmtTime, nextUpCopy } from '../data/pathStars';
import { getSeriesById } from '../data/trainingArcadeData';
import { campLevels } from '../protocol/content';

// 2 · The path + stars. One path for the Arcade sagas and Training Camp: it
// climbs from the first node at the bottom to the boss at the top and opens
// on the current node; cleared nodes show their stars. Every card renders the
// REAL components (retention/ui, data/pathStars, the real stage-clear screen)
// with sample data: what is drawn here is what ships behind the `path` switch.

// Sample progress on the real sagas: One Hundred (time tiers) and The Grappler
// (one star per path).
const OP = getSeriesById('one-punch-protocol');
const GRAP = getSeriesById('grappler-protocol');
const OP_DONE = [[3, 860], [3, 1265], [2, 1060], [1, 1805], [3, 951]];
const OP_PROGRESS = { completedStages: Object.fromEntries(OP_DONE.map(([stars, best], i) => [`op-stage-${i + 1}`, { completed: true, stars, bestTimeSeconds: best }])) };
const GRAP_PROGRESS = { completedStages: Object.fromEntries((GRAP?.stages || []).slice(0, 3).map((s, i) => [s.id, { completed: true, stars: i + 1, paths: [['fit'], ['fit', 'fight'], ['fit', 'fight', 'both']][i] }])) };
const CAMP = campPath({ levels: campLevels, current: 5, sessions: { 4: { s1: true, s2: true }, 5: { s1: true } } });

// The saga screen's header as it is with the path (title, the climb, ★ total).
function Screen({ title, sub, right, art = 'radial-gradient(ellipse at 50% 30%, rgba(30,0,70,.8), #050010 75%)', children }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: art }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(168,85,247,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: HOME.muted, fontSize: 18 }}>‹</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...orb(13), ...goldText }}>{title}</div>
          <div style={{ ...head(10, 600), color: HOME.muted }}>{sub}</div>
        </div>
        {right}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
const StarTotal = ({ path }) => (
  <span style={{ ...orb(10, { fontWeight: 800 }), color: '#fde047', background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.28)', borderRadius: 8, padding: '5px 9px', whiteSpace: 'nowrap' }}>
    ★ {path.earned}<span style={{ color: 'rgba(200,170,255,0.6)' }}>/{path.total}</span>
  </span>
);

function SagaPathLook({ series, progress, children }) {
  const path = sagaPath(series, progress);
  const cleared = path.nodes.filter((n) => n.state === 'cleared').length;
  return (
    <Screen title={series.title.toUpperCase()} sub={`THE CLIMB · ${cleared} of ${path.nodes.length} · tap a stage`} right={<StarTotal path={path}/>}>
      <PathMap nodes={path.nodes} unit="STAGE" bossLabel="BOSS"/>
      {children}
    </Screen>
  );
}

function ReplayLook({ series, progress, index }) {
  const stage = series.stages[index];
  const info = stageStars(series, stage, progress.completedStages[stage.id]);
  const [mode, setMode] = useState(info.missing[0] || 'fit');
  const tiles = [
    ...(info.bestSec != null ? [{ label: 'YOUR BEST', value: fmtTime(info.bestSec) }] : []),
    ...(info.kind === 'time' && info.next ? [{ label: 'NEEDS', stars: info.next.stars, value: info.next.needs, gold: true }] : []),
  ];
  const multi = (series.modeOptions || []).length > 1;
  return (
    <SagaPathLook series={series} progress={progress}>
      <ReplaySheet eyebrow={`STAGE ${stage.stageNumber} · CLEARED`} title={stage.title} stars={info.stars} max={info.max} check={info.check}
        tiles={tiles} line={nextStarLine(info)} onReplay={() => {}} onClose={() => {}}>
        {multi && <PathChoice paths={series.modeOptions} cleared={info.paths} value={mode} onChange={setMode}/>}
      </ReplaySheet>
    </SagaPathLook>
  );
}

// The real stage-clear screen (classic saga): position fixed, held inside
// the phone frame (its transform makes it the containing block).
function StageClearLook() {
  const stage = OP.stages[4];
  return (
    <ArcadeStageClearOverlay
      series={OP} stage={stage}
      result={{ invalid: false, rank: null, points: 300, xpEarned: 300, elapsedSeconds: 951, stars: 3, newBest: true, completedTasks: 3, totalTasks: 3 }}
      xpEarned={300} completedStageIds={OP.stages.slice(0, 5).map((s) => s.id)}
      onContinue={() => {}} onReturnToArcade={() => {}} onNextStage={() => {}}
    />
  );
}

// The end screen's stars row (arcade v2 and concept stages), in the shared
// end screen's stat area.
function EndStarsLook() {
  const stage = GRAP.stages[1];
  const info = stageStars(GRAP, stage, GRAP_PROGRESS.completedStages[stage.id]);
  return (
    <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ font: "700 7px 'Press Start 2P',monospace", color: '#86efac', letterSpacing: '0.16em', textAlign: 'center' }}>◈ STAGE CLEARED ◈</div>
      <div style={{ font: "900 18px 'Orbitron',sans-serif", color: '#fff', textAlign: 'center' }}>STAGE 2 CLEAR</div>
      <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#c4a4d8', textAlign: 'center', marginBottom: 6 }}>TRAINING ARCADE · The Grappler · normal</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <div style={{ borderRadius: 10, border: '1px solid rgba(253,224,71,0.45)', background: 'rgba(253,224,71,0.08)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fde047' }}>+164</div>
          <div style={{ font: "600 7.5px 'Orbitron',sans-serif", color: '#86efac', letterSpacing: '0.08em' }}>XP EARNED</div>
        </div>
        <div style={{ borderRadius: 10, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.6)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fff' }}>5/5</div>
          <div style={{ font: "600 7.5px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em' }}>ROUNDS</div>
        </div>
      </div>
      <StageStarsCard stars={info.stars} max={info.max} line={endStarsLine(info)}/>
    </div>
  );
}

export default function LookPath() {
  const op = sagaPath(OP, OP_PROGRESS);
  const next = { kind: 'arcade', saga: OP.title, number: op.nodes[op.current].number, title: op.nodes[op.current].title, boss: false };
  return (
    <Feature id="f2" num="FEATURE 2" title="THE PATH + STARS"
      reuse="ArcadeConstellationMap's pulsing current node, boss node and gold-for-cleared colours; each screen's own stage pop-up, locked hint, Pro gate and start flow; the stars as they are stored today; the arcade gold title type."
      isNew="the stage ladder and the camp ladder become one path: big tap targets on a winding road that climbs and scrolls, opens on the current node, shows the stars (or a check) under each cleared node and START on the current one; the replay sheet; NEXT UP on Home; the stars landing one by one. Every card here is the real component.">

      <Look name="The path: a saga" note="One Hundred: opens on the current node (stage 6). Gold road behind, dashed road ahead, the boss at the top. The header counts the saga's stars. A tap on the current node opens the stage's own pop-up." height={640}>
        <SagaPathLook series={OP} progress={OP_PROGRESS}/>
      </Look>

      <Look name="The path: Training Camp" note="The same component for the camp's 12 levels: S1/S2 pips under the split levels, the title fight at the top. Camp has no star rule yet, so a cleared level shows a check." height={640}>
        <Screen title="TRAINING CAMP · BOXING" sub="Level 5 of 12 · DEVELOPMENT" art="linear-gradient(180deg, #1a0a2e 0%, #10061f 45%, #0a0416 100%)">
          <PathMap nodes={CAMP.nodes} unit="LEVEL" bossLabel="TITLE"/>
        </Screen>
      </Look>

      <Look name="Home: NEXT UP" note="The last saga's current node (or the camp's level); a tap opens the saga on that node's pop-up. When the Continue card is that saga or camp, NEXT UP folds into it (NEXT UP · One Hundred · Stage 6 · The Standard Hundred): one card for one place. This row is left for a concept stage's last run, whose Continue replays that stage." height={170}>
        <div style={{ padding: '14px 16px 0' }}>
          <HomeHeader level={14} tierName="Champion" levelXp={250} levelNeeded={500} xpPercent={50} compact chip={<WeekChip/>}/>
        </div>
        <div style={{ padding: '12px 16px' }}><NextUpRow {...nextUpCopy(next)} number={next.number} onGo={() => {}}/></div>
      </Look>

      <Look name="Replay sheet (a cleared node)" note="Best stars, best time, what the next star needs and how far off it is. REPLAY runs the stage's own start flow; replays keep the best result." height={560} animated>
        <ReplayLook series={OP} progress={OP_PROGRESS} index={2}/>
      </Look>

      <Look name="Replay sheet: one star per path" note="A multi-path saga says how its stars work and picks a path not yet cleared to replay." height={560} animated>
        <ReplayLook series={GRAP} progress={GRAP_PROGRESS} index={0}/>
      </Look>

      <Look name="Stage clear: stars land one by one" note="The real classic-saga clear screen: each star slams in with its own tone (with the owner preview on). Nothing else changed on it." height={680} animated>
        <StageClearLook/>
      </Look>

      <Look name="End screen: the stars row" note="Arcade v2 and concept stages end on the shared end screen: a small stars row lands the same way when the stage has stars." height={260} animated>
        <EndStarsLook/>
      </Look>
    </Feature>
  );
}

// The gallery's CLEARED look counts its XP with this.
export function CountUp({ to, ms = 900, delay = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const id = setTimeout(() => {
      const tick = (now) => { t0 = t0 || now; const p = Math.min(1, (now - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [to, ms, delay]);
  return <>{v}</>;
}
