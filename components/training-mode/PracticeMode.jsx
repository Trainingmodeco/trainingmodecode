import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import DisciplineTabs, { useDiscipline } from './shared/DisciplineTabs';
import { FightBackdrop } from './shared/FightTimerKit';
import PracticeRound, { primeDrill } from './PracticeRound';
import PracticeMoveCard from './PracticeMoveCard';
import PracticeShadowboxing from './PracticeShadowboxing';
import { warmClips } from './PracticeDrillVideo';
import { GOLD, SOFT, GREEN, GOLD_FILL, label, practiceCSS, moveLabel, LoopVideo, GuidePlate, Thumb, Play } from './PracticeParts';
import { loadShadowClips, cachedShadowClips } from './data/shadowboxing';
import { addStartHereLesson, addPracticeSession, addPracticeWeeklyBonus } from './data/userStats';
import { loadProfile, isBeginnerLearner } from './data/userProfile';
import { PRACTICE_DISCIPLINES } from './practiceData';
import {
  movesFor, groupsOf, watchFor, getLearned, isLearned, learnMove, learnMoves, nextMove, progressFor, drillFor, groupDrill, isStanceMove,
} from './data/practiceMoves';
import { buildRound, mmss, planSeconds } from './data/practiceRound';
import { drillSources } from './data/drillClips';
import { claimWeeklyBonus, notePracticed } from './data/practiceInvite';

// Practice Mode: the Ladder. One scrolling list of a discipline's MOVES in
// the order they are learned (data/practiceMoves.js). The next move not yet
// learned plays at the top (UP NEXT). A row opens the move card: watch it,
// drill it, and it is LEARNED. Finished groups fold to their heading, and a
// group can be tested out in one drill. Nothing is ever locked.

const small = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', whiteSpace: 'nowrap' };

export default function PracticeMode({ openLesson = false, onBack, onComboCoach }) {
  const profile = loadProfile();
  // A "beginner learner" (new, and here to learn combat) has Combo Coach
  // limited to what they have learned: the Ladder tells them so.
  const beginner = isBeginnerLearner(profile);

  // The discipline shared with the Fight hub and Combat Conditioning. A
  // caller that wants one saves it to the profile first (App's
  // goPracticeLesson).
  const [stored, pickStored] = useDiscipline();
  const discipline = PRACTICE_DISCIPLINES.includes(stored) ? stored : 'Boxing';

  const [learned, setLearned] = useState(() => getLearned());
  const [cardId, setCardId] = useState(null);   // the open move card
  const [drill, setDrill] = useState(null);     // the open drill
  const [unfolded, setUnfolded] = useState({}); // finished groups opened by hand
  // The shadowboxing clips (public/static/practice/shadow/index.json): the
  // SHADOWBOX side of the switch, and the watch video of many moves.
  const [shadowClips, setShadowClips] = useState(cachedShadowClips);
  const [shadowOpen, setShadowOpen] = useState(false);
  useEffect(() => {
    let live = true;
    loadShadowClips().then((list) => { if (live) setShadowClips(list); });
    return () => { live = false; };
  }, []);

  const moves = useMemo(() => movesFor(discipline), [discipline]);
  const groups = useMemo(() => groupsOf(moves), [moves]);
  const watches = useMemo(() => new Map(moves.map(m => [m.id, watchFor(m, discipline, shadowClips)])), [moves, discipline, shadowClips]);
  const { done, total } = progressFor(moves, learned);
  const upNext = nextMove(moves, learned);
  const card = cardId ? moves.find(m => m.id === cardId) || null : null;

  // How long a move's drill is, rests included: "1:00" on DRILL IT.
  const clockFor = (move) => mmss(planSeconds(buildRound(drillFor(moves, move, learned)).plan));

  const pickDiscipline = (d) => { pickStored(d); setCardId(null); setUnfolded({}); };
  const listRef = useRef(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [discipline]);

  // Home's Start Here, the Practice invite and the weekly reminder open
  // Practice straight onto the next move's card.
  const opened = useRef(false);
  useEffect(() => {
    if (!openLesson || opened.current) return;
    opened.current = true;
    if (upNext) setCardId(upNext.id);
  }, [openLesson, upNext]);

  // The strike clips of the drill most likely to come next are fetched ahead,
  // so its first call already has its picture.
  const ahead = card || upNext;
  useEffect(() => {
    if (!ahead) return;
    const input = drillFor(moves, ahead, learned);
    const round = buildRound(input);
    warmClips(drillSources(round.groups.flatMap(g => g.calls), { discipline, focus: input.focus, callMs: round.callMs }));
  }, [ahead, moves, learned, discipline]);

  // DRILL IT: the drill opens with round 1 running. The tap wakes the sound.
  const startDrill = (move) => {
    const ready = primeDrill(profile);
    setCardId(null);
    setDrill({ key: Date.now(), ready, move, input: drillFor(moves, move, getLearned()), points: isStanceMove(move) ? move.steps : move.cues });
  };
  // TEST OUT: one drill of a whole group's calls.
  const startGroup = (group) => {
    const ready = primeDrill(profile);
    const input = groupDrill(moves, group, getLearned());
    setDrill({ key: Date.now(), ready, move: null, input, points: input.moves.map(m => m.cues[0]).filter(Boolean) });
  };

  // The drill ran to the bell: the move (or the whole group) is learned.
  // Answers with what the done view shows.
  const finishDrill = useCallback(({ xp, rounds }) => {
    if (!drill) return null;
    const { input, move } = drill;
    addPracticeSession(input.focus.name, rounds, rounds, xp);
    notePracticed();
    const out = move ? learnMove(move, discipline) : learnMoves(input.moves, discipline);
    const fresh = move ? out.fresh : out.fresh.length > 0;
    // A move learned for the first time is a lesson done: its own XP, and the
    // weekly reminder's bonus when one is waiting.
    let earned = xp, bonus = 0;
    if (fresh) {
      earned += addStartHereLesson(input.focus.name);
      bonus = claimWeeklyBonus();
      if (bonus) addPracticeWeeklyBonus(bonus);
    }
    const after = getLearned();
    setLearned(after);
    const last = move || input.moves[input.moves.length - 1];
    return {
      fresh, xp: earned, bonus, told: beginner && out.gained.length > 0,
      ...progressFor(moves, after), next: nextMove(moves, after, last.id),
    };
  }, [drill, discipline, moves, beginner]);

  if (shadowOpen && shadowClips.length) {
    return (
      <PracticeShadowboxing
        clips={shadowClips} discipline={discipline} onBack={() => setShadowOpen(false)} onComboCoach={onComboCoach}
        onDiscipline={pickDiscipline}
      />
    );
  }

  const openNextCard = (move) => {
    const i = moves.findIndex(m => m.id === move.id);
    const n = nextMove(moves, learned, move.id);
    setCardId((n && n.id !== move.id ? n : moves[(i + 1) % moves.length]).id);
  };

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: practiceCSS }}/>

      <div data-testid="practice-ladder" style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10,
        height: '100dvh', boxSizing: 'border-box', padding: '10px 16px 0',
        // Clears the tab bar and the BETA chip that floats just above it.
        paddingBottom: 'calc(max(108px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
          <button type="button" className="pm-txt" aria-label="Back to Fight Mode" onClick={onBack} style={{
            width: 40, height: 44, marginLeft: -10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
          }}><ChevronLeft size={22}/></button>
          <div style={{ flexGrow: 1, minWidth: 0, font: "700 clamp(15px, 4.8vw, 20px) 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1, whiteSpace: 'nowrap' }}>PRACTICE MODE</div>
          <button type="button" className="pm-hit pm-txt" data-testid="pm-combo-coach" onClick={() => onComboCoach?.(discipline)} style={{
            height: 40, padding: '0 10px', borderRadius: 9, flexShrink: 0, cursor: 'pointer', background: 'transparent',
            border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF', ...small, letterSpacing: '0.12em',
          }}>COMBO COACH ›</button>
        </header>

        <DisciplineTabs value={discipline} onChange={pickDiscipline}/>

        {shadowClips.length > 0 && (
          <div role="group" aria-label="Practice section" style={{ display: 'flex', flexShrink: 0, padding: 3, gap: 3, borderRadius: 10, background: '#0B0F22', border: '1px solid rgba(143,180,255,.18)' }}>
            <button type="button" aria-pressed="true" style={{
              flex: 1, height: 34, borderRadius: 7, border: 0, cursor: 'default', background: GOLD_FILL, color: '#1A1204',
              font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            }}>LEARN</button>
            <button type="button" className="pm-txt" aria-pressed="false" data-testid="shadow-entry" onClick={() => setShadowOpen(true)} style={{
              flex: 1, height: 34, borderRadius: 7, border: 0, cursor: 'pointer', background: 'transparent', color: '#8E98BC',
              font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            }}>SHADOWBOX</button>
          </div>
        )}

        <div ref={listRef} className="pm-scroll" data-testid="pm-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
          <div data-testid="pm-progress" style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <span style={{ ...label, color: '#fff' }}>{done} OF {total} LEARNED</span>
            <div role="progressbar" aria-label="Moves learned" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
              <div style={{ width: `${total ? (done / total) * 100 : 0}%`, height: '100%', borderRadius: 3, background: GOLD, transition: 'width .3s ease' }}/>
            </div>
            {beginner && upNext && <span data-testid="pm-rule" style={{ fontSize: 12, color: SOFT, lineHeight: 1.3 }}>Drill a strike once and Combo Coach starts calling it.</span>}
          </div>

          {upNext ? (
            <div data-testid="pm-upnext" data-move={upNext.id} style={{ flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#0B0F22', border: `1px solid ${GOLD}`, display: 'flex', flexDirection: 'column' }}>
              {watches.get(upNext.id)
                ? <LoopVideo watch={watches.get(upNext.id)} title={upNext.name} active={!card && !drill} style={{ maxHeight: '26dvh' }}/>
                : <GuidePlate sub="Open CUES for the steps." style={{ aspectRatio: '16 / 6' }}/>}
              <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ ...label, color: GOLD }}>UP NEXT</span>
                  <span style={{ font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{moveLabel(upNext).toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="pm-gold" data-testid="pm-drill" onClick={() => startDrill(upNext)} style={{
                    flex: 1, height: 46, border: 0, cursor: 'pointer', color: '#1A1204', background: GOLD_FILL,
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                    font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', whiteSpace: 'nowrap',
                  }}>DRILL IT · {clockFor(upNext)}</button>
                  <button type="button" className="pm-hit pm-txt" data-testid="pm-cues" onClick={() => setCardId(upNext.id)} style={{
                    width: 84, height: 46, flexShrink: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer',
                    border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF', font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
                  }}>CUES</button>
                </div>
              </div>
            </div>
          ) : (
            <div data-testid="pm-all-learned" style={{ flexShrink: 0, borderRadius: 12, padding: '14px 12px', background: '#0B0F22', border: `1px solid ${GREEN}`, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
              <span style={{ font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', color: GREEN }}>ALL {total} LEARNED</span>
              <button type="button" className="pm-gold" onClick={() => onComboCoach?.(discipline)} style={{
                height: 46, border: 0, cursor: 'pointer', color: '#1A1204', background: GOLD_FILL,
                clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
              }}>TAKE IT TO COMBO COACH</button>
            </div>
          )}

          {groups.map(({ group, moves: list }) => {
            const n = list.filter(m => isLearned(learned, m)).length;
            const all = n === list.length;
            const shut = all && !unfolded[group];
            return (
              <section key={group} aria-label={group} data-testid="pm-group" data-group={group} data-folded={shut ? 'true' : 'false'} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {all ? (
                  <button type="button" className="pm-hit" data-testid="pm-group-fold" aria-expanded={!shut} onClick={() => setUnfolded(u => ({ ...u, [group]: shut }))} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                    background: '#0B0F22', border: '1px solid rgba(74,222,128,.3)', color: '#fff', textAlign: 'left',
                  }}>
                    <span style={label}>{group}</span>
                    <span style={{ ...small, color: GREEN }}>{n} of {list.length} ✓ {shut ? '▸' : '▾'}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, paddingTop: 2 }}>
                    <span style={{ ...label, flexGrow: 1 }}>{group}</span>
                    <span style={{ ...small, color: SOFT }}>{n} of {list.length}</span>
                    <button type="button" className="pm-hit pm-txt" data-testid="pm-test-out" aria-label={`Test out ${group}`} onClick={() => startGroup(group)} style={{
                      height: 32, padding: '0 10px', borderRadius: 8, flexShrink: 0, cursor: 'pointer', background: 'transparent',
                      border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF', ...small,
                    }}>TEST OUT</button>
                  </div>
                )}
                {!shut && list.map((m) => {
                  const watch = watches.get(m.id);
                  const isDone = isLearned(learned, m);
                  const isNext = !!upNext && upNext.id === m.id;
                  return (
                    <button key={m.id} type="button" className="pm-row" data-testid="pm-move" data-move={m.id} data-state={isDone ? 'learned' : isNext ? 'next' : watch ? 'video' : 'guide'} onClick={() => setCardId(m.id)} style={{
                      minHeight: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 6px', borderRadius: 10, boxSizing: 'border-box', flexShrink: 0,
                      background: '#0B0F22', border: `1px solid ${isNext ? GOLD : 'rgba(61,123,255,.22)'}`, color: '#fff', textAlign: 'left', cursor: 'pointer',
                    }}>
                      <Thumb watch={watch}/>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flexGrow: 1 }}>
                        <span style={{ font: "700 14px 'Chakra Petch',sans-serif", lineHeight: 1.15, overflowWrap: 'anywhere' }}>{moveLabel(m)}</span>
                        <span style={{ font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: SOFT }}>{m.kind}</span>
                      </span>
                      {isDone ? <span style={{ ...small, color: GREEN }}>✓ LEARNED</span>
                        : isNext ? <span style={{ ...small, color: GOLD }}>UP NEXT</span>
                          : watch ? <span role="img" aria-label="has a video" style={{ color: '#C4A8FF', display: 'flex', flexShrink: 0, padding: '0 4px' }}><Play size={12}/></span>
                            : <span style={{ ...small, color: '#7E88AC' }}>GUIDE</span>}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      {card && !drill && (
        <PracticeMoveCard
          key={card.id} move={card} watch={watches.get(card.id)} learned={isLearned(learned, card)} drillClock={clockFor(card)} profile={profile}
          onClose={() => setCardId(null)}
          onDrill={() => startDrill(card)}
          onNext={() => openNextCard(card)}
        />
      )}

      {drill && (
        <PracticeRound
          key={drill.key} discipline={discipline} drill={drill.input} move={drill.move} watch={drill.move ? watches.get(drill.move.id) : null}
          points={drill.points} ready={drill.ready} profile={profile}
          onClose={() => setDrill(null)}
          onFinish={finishDrill}
          onNext={(m) => { setDrill(null); setCardId(m.id); }}
          onComboCoach={() => { setDrill(null); onComboCoach?.(discipline); }}
        />
      )}
    </PhoneFrame>
  );
}
