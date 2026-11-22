import { C } from '../Styles';
import { HOME, head, orb, goldText, Look, Feature, Bar, Btn, Stars } from './looksKit';

// 3 · Near-miss retry. "How close" in plain words from the session's real
// numbers, a RETRY only when a retry is safe, and an equally easy way out.

function Screen({ tone, label, title, big, sub, bar, children }) {
  const ring = tone === 'red' ? 'rgba(239,68,68,' : tone === 'green' ? 'rgba(34,197,94,' : 'rgba(253,224,71,';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 22, gap: 12, textAlign: 'center',
      background: `radial-gradient(ellipse at 50% 30%, ${ring}0.16) 0%, rgba(8,0,18,1) 62%)` }}>
      <div style={{ ...orb(11), color: HOME.muted, marginTop: 18, animation: 'rl-rise .4s both' }}>{label}</div>
      <div style={{ ...orb(22), color: C.text, animation: 'rl-rise .4s .1s both' }}>{title}</div>
      <div style={{ ...orb(40), ...goldText, animation: 'rl-slam .6s .35s both', lineHeight: 1.05 }}>{big}</div>
      {bar && (
        <div style={{ animation: 'rl-rise .4s .7s both' }}>
          <Bar value={bar[0]} max={bar[1]} color={tone === 'green' ? '#22c55e' : HOME.gold} height={10}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...head(11, 600), color: HOME.muted, marginTop: 4 }}><span>{bar[2]}</span><span>{bar[3]}</span></div>
        </div>
      )}
      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.4, animation: 'rl-rise .4s .9s both' }}>{sub}</div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, animation: 'rl-rise .4s 1.1s both' }}>{children}</div>
    </div>
  );
}

export default function LookNearMiss() {
  return (
    <Feature id="f3" num="FEATURE 3" title="NEAR-MISS RETRY"
      reuse="the outcome screens of ArcadeStageClearOverlay (partial, failed, cleared) and their verdicts from sessionOutcome; the readiness and recovery data for when a retry is safe."
      isNew="how close it was in plain words with a progress bar, RETRY and COME BACK TOMORROW as two equal buttons, and a no-retry state after a max-effort boss.">

      <Look name="Boss not beaten, retry is safe" note="Real numbers: 92 of 100 reps. RETRY and the way out are the same size." height={560} animated>
        <Screen tone="red" label="BOSS · STAGE 12" title="SO CLOSE" big="8 REPS SHORT" bar={[92, 100, '92 REPS', 'GOAL 100']} sub="You were on pace until the last minute. Your legs had it: the push-ups slowed down.">
          <Btn>↻ RETRY NOW</Btn>
          <Btn tone="ghost">COME BACK FRESH TOMORROW</Btn>
        </Screen>
      </Look>

      <Look name="Boss not beaten, after a max effort" note="No RETRY after a max-effort boss or past a sensible daily load: the screen says when to come back instead." height={560} animated>
        <Screen tone="red" label="BOSS · STAGE 12" title="ALL OUT" big="8 REPS SHORT" bar={[92, 100, '92 REPS', 'GOAL 100']} sub="That was a max effort. The boss opens again tomorrow, once you've recovered. You'll start fresh, and you're 8 reps away.">
          <div style={{ background: HOME.tile, borderRadius: 12, padding: 12, ...head(13), color: HOME.gold }}>⏳ BOSS OPENS AGAIN TOMORROW · 6:00</div>
          <Btn tone="violet">🔔 REMIND ME TOMORROW</Btn>
          <Btn tone="ghost">DONE FOR TODAY</Btn>
        </Screen>
      </Look>

      <Look name="Stage partly done" note="A partial stage: the rounds that are left, said plainly." height={560} animated>
        <Screen tone="gold" label="STAGE 7 · PARTIAL" title="NEARLY THERE" big="ONE ROUND TO GO" bar={[4, 5, '4 OF 5 ROUNDS', '']} sub="Four rounds banked (+60 XP). Finish the fifth to clear the stage.">
          <Btn>↻ RETRY THE STAGE</Btn>
          <Btn tone="ghost">COME BACK FRESH TOMORROW</Btn>
        </Screen>
      </Look>

      <Look name="Cleared, fewer than 3 stars" note="A clear is a clear. The third star is offered as a replay, never pushed." height={560} animated>
        <Screen tone="green" label="STAGE 5 · CLEARED" title="CLEARED WITH 2 STARS" big="12 s OFF" sub="the third star. Your time: 6:42; the third star is under 6:30. Replays keep your best result.">
          <div style={{ display: 'flex', justifyContent: 'center' }}><Stars n={2} size={34} land delay={0.4}/></div>
          <Btn>↻ GO FOR THE THIRD STAR</Btn>
          <Btn tone="ghost">NEXT STAGE ▶</Btn>
        </Screen>
      </Look>
    </Feature>
  );
}
