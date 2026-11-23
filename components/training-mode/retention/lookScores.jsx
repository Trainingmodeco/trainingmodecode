import { Look, Feature } from './looksKit';
import GameOverBoard from './ui/GameOverBoard';
import HighScoresCard from './ui/HighScoresCard';
import BoardOptIn from './ui/BoardOptIn';
import { FIGHT_TOP10, BOSS_EARLY, ROOM_BUSY, STAGE_TIME, RUN_FADE } from './scoreBoards';

// 4 · The game-over score board (it replaced the weekly leagues, owner
// 2026-11-22). After a finished session, the athlete's score for that mode at
// that setting and where it ranks in the world, like an arcade HIGH SCORES
// list. Every card renders the real components (retention/ui/ScoreBoard,
// GameOverBoard, HighScoresCard, BoardOptIn) with the sample boards of
// retention/scoreBoards. Looks only: nothing wired, nothing sent anywhere.
// Full-screen phone states: /score-looks.

const noop = () => {};
const BG = 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.18) 0%, transparent 55%), #080012';

export default function LookScores() {
  return (
    <Feature id="f4" num="FEATURE 4" title="GAME-OVER SCORE BOARD"
      reuse="the end screen (MissionComplete), the arcade gold titles, the app's level and tier colours, each mode's own finished-session numbers (strikes the phone counted, a mission's score, a stage time, a run time), the account sign-in."
      isNew="one board per mode and setting, ten places, your row in gold with NEW BEST; CPU house scores (equipment names, tagged CPU) fill a new board and step aside once 5 real players are on it; your world rank pinned under the list when you are outside the top 10; a HIGH SCORES card for the end screen; a one-time opt-in (display name only). Full phone screens: /score-looks.">

      <Look name="A · New best, in the top 10" note="Straight after FINISH. Fight Focus, a beta board: 4 real players among CPU rows; the new best lands 6th. CONTINUE goes to the end screen." bg={BG} animated>
        <GameOverBoard board={FIGHT_TOP10} onContinue={noop}/>
        <div style={{ height: 16 }}/>
      </Look>

      <Look name="A · Brand-new board" note="Max Out, BOSS RUSH: you are the first real player. The CPU rows are equipment, never people, and always tagged CPU." bg={BG}>
        <GameOverBoard board={BOSS_EARLY} onContinue={noop}/>
        <div style={{ height: 16 }}/>
      </Look>

      <Look name="A · CPU fading out" note="A 5 km run with 6 real players: from 5 players on, CPU rows sit only under the slowest player." bg={BG}>
        <GameOverBoard board={RUN_FADE} onContinue={noop}/>
        <div style={{ height: 16 }}/>
      </Look>

      <Look name="A · Busy board, outside the top 10" note="2,310 players, no CPU left. Your best stays on the board; your row is pinned under the ten with your world rank and what the next place needs." bg={BG}>
        <GameOverBoard board={ROOM_BUSY} onContinue={noop}/>
        <div style={{ height: 16 }}/>
      </Look>

      <Look name="A · Timed board" note="An arcade stage: less time ranks higher." bg={BG}>
        <GameOverBoard board={STAGE_TIME} onContinue={noop}/>
        <div style={{ height: 16 }}/>
      </Look>

      <Look name="B · On the end screen" note="The board is not shown on its own: the end screen carries your place, the top 3 and VIEW BOARD (it sits above YOUR PROGRESS)." bg={BG} pad={16}>
        <HighScoresCard board={FIGHT_TOP10} onView={noop}/>
      </Look>

      <Look name="First time: join the world board" note="Asked once, before the first board. Display name only; the country stays off unless turned on. NOT NOW goes on to the end screen." bg={BG} pad={16}>
        <BoardOptIn name="Trainee" country="US" onJoin={noop} onLater={noop}/>
      </Look>
    </Feature>
  );
}
