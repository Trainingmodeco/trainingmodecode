# PROMPT REVAMP-CC-2 — Combat Conditioning audio + Combo Coach voice priority

**Scope: Combat Conditioning active timer + shadowbox library + the voice
scheduler shared by Combo Coach, Fight Focus, Training Arcade and
Training Camp.**

Run this in the revamp app repo AFTER `PROMPT-REVAMP-CC-1` has landed.
It brings **Combat Conditioning's playback** and **the voice priority
system** up to the state that shipped to `apptrainingmode.com` at commit
`b1106a7` on `trainingmodeco/trainingmodecode`, branch `app`.

Every path, hash and constant here was verified against the working tree
of the app repo on 2026-09-24. **Read the four source files below**
before writing — the revamp must match them line-close, not paraphrase.

**Reference source** — read from `trainingmodeco/trainingmodecode`,
branch `app`, at `b1106a7`:

| Purpose | Path |
|---|---|
| Voice scheduler (priority-aware) | `components/training-mode/voiceCoach.js` |
| Combat Conditioning active timer | `components/training-mode/CombatConditioningActive.jsx` |
| Combo Coach round loop | `components/training-mode/ComboCoachActive.jsx` |
| Fight Focus timer (drives Arcade + Camp) | `components/training-mode/FightFocusTimer.jsx` |
| Exercise library (rename + 11 new drills) | `components/training-mode/data/combatConditioningData.js` |

**Ledger of commits this prompt combines:**

| Commit | Summary |
|---|---|
| `e3bb6af` | CC: bells at every ring-honest moment, and the clock waits for the coach |
| `68483fb` | Shadowbox variety: 11 new drills so the tile lives up to its name |
| `b1106a7` | Voice coach: priority-aware scheduler so combos / quotes / sprint / rush never talk over each other |

---

## 0. What we are trying to do

Two live-athlete bugs the app tester found under gym lights:

1. **Combat Conditioning.** The clock was ticking while the coach was
   still announcing the drill — a 40-second work window lost 5-7 seconds
   before the athlete threw a punch. And there were no bells. A round
   timer without a bell isn't a round timer.

2. **Combo Coach.** Motivational quotes, the rush sprint countdown, and
   combo call-outs all cut each other off mid-syllable — "one-two-th…
   RUSH!" Root cause: `voiceCoach.speakAsync` unconditionally cancelled
   whatever was playing on every call.

Also — a fitness-tester finding: the single "Shadowbox Rounds" drill
couldn't cover both a 40-second speed round and a 5-minute technique
round. Different intents need different drill entries.

The revamp app has the SAME `speakAsync`, the SAME Combat Conditioning
active screen, and the SAME shadowbox drill entry. It has all three bugs.

---

## 1. THE VOICE SCHEDULER — `voiceCoach.js`

Rewrite `speakAsync` so callers can declare how they want to share the
mic. Read the reference file top-to-bottom before writing; the shape you
need to add:

### 1.1 Module-level state

Add two variables above the export:

```js
let currentSpeechPromise = null;
let currentSpeechPriority = -1;
```

Two small helpers, exported so a UI can render "coach is talking":

```js
export function isSpeechBusy() { return currentSpeechPromise !== null; }
export function currentSpeechLevel() { return currentSpeechPriority; }
```

### 1.2 The inner utterance function

Extract the current body of `speakAsync` (everything from `const text =
normalizeSpeech(rawText)` down to `synth.speak(utter)`) into a private
function called `speakUtterance(rawText, opts)`. Keep the existing rate,
pitch, volume, voice-picking, duck-audio and fallback-timeout logic
exactly as-is. It should return the Promise that resolves when the
utterance ends.

The extracted function must **not** call `synth.cancel()` — that's the
scheduler's job now.

### 1.3 The scheduler

Rewrite `speakAsync` to consume three new opts:

```js
export async function speakAsync(rawText, opts = {}) {
  const synth = getSynth();
  if (!synth) return;

  await ensureVoicesReady();

  const priority   = Number.isFinite(opts.priority) ? opts.priority : 1;
  const preempt    = opts.preempt === true;
  const dropIfBusy = opts.dropIfBusy === true;

  if (currentSpeechPromise) {
    const shouldPreempt = preempt || priority > currentSpeechPriority;
    if (shouldPreempt) {
      synth.cancel();
      // let the previous promise unwind before we start
      await new Promise((r) => setTimeout(r, 20));
    } else if (dropIfBusy) {
      return;
    } else {
      try { await currentSpeechPromise; } catch { /* ignore */ }
    }
  }

  currentSpeechPriority = priority;
  const p = speakUtterance(rawText, opts).finally(() => {
    if (currentSpeechPromise === p) {
      currentSpeechPromise = null;
      currentSpeechPriority = -1;
    }
  });
  currentSpeechPromise = p;
  return p;
}
```

Rules the scheduler enforces, in plain English:

- Nothing playing → speak.
- Something playing + `preempt: true` OR `priority > current` → cancel
  the current utterance, take the mic.
- Something playing + `dropIfBusy: true` → return without speaking.
- Otherwise → queue: wait for the current utterance to end, then speak.

### 1.4 Also update `cancelSpeech`

```js
export function cancelSpeech() {
  const synth = getSynth();
  if (!synth) return;
  currentVersion++;
  currentSpeechPromise = null;
  currentSpeechPriority = -1;
  synth.cancel();
}
```

Without this, a hard stop between screens leaves the scheduler still
thinking it's holding a lock.

### 1.5 The signature is backwards-compatible

Every existing `speakAsync(text)` call with no opts still works — it
just becomes "queue if busy, priority 1". Only callers that need to
preempt or drop opt in.

---

## 2. COMBAT CONDITIONING — bells + clock waits for the coach

Read the reference `CombatConditioningActive.jsx` end-to-end, then match.

### 2.1 Import the audio engine

```js
import { playBell, unlockAudio } from './data/audioEngine';
```

`playBell(count)` and `unlockAudio()` both already exist in the reference
repo's `data/audioEngine.js`; the revamp should have them too. If it
doesn't, port `playBell` (it plays `/audio/boxing-bell-signals.mp3`).

### 2.2 Unlock audio on session start

Inside the init `useEffect`'s async body, right after `setVoiceGender`,
add:

```js
try { unlockAudio(); } catch { /* best effort */ }
```

Mobile browsers won't play the bell later without this — the first user
gesture is the only chance to prime the graph.

### 2.3 `startDrill` — hold the clock while the coach talks

The bug: the current `startDrill` sets `phase` to 'working' immediately
and fires `speak(...)` unawaited. The timer effect at
`useEffect(() => { const id = setInterval(...) }, [phase, ...])` starts
ticking down before the announcement finishes.

Rewrite `startDrill` so it sets `phase` to `'ready'` first (the timer
effect already returns during 'ready'), **awaits** the announcement,
plays a bell, then transitions to 'working':

```js
const startDrill = async (isFirst) => {
  const drill = drills[drillIdxRef.current];
  setPhase('ready');   // holds the clock while the coach announces
  setRepCount(0);
  cadenceRepRef.current = 0;
  if (drill.workType === 'timed') {
    setRemaining(drill.workSeconds || 30);
  }
  if (isFirst && !integrityStartedRef.current) {
    integrityStartedRef.current = true;
    integrity.startUnit('circuit');
  }

  const d = isFirst ? drills[0] : drill;
  const version = versionRef.current;
  const stale = () => version !== versionRef.current || doneRef.current;

  if (d.workType === 'timed') {
    await speak(`${d.name}. ${d.workSeconds || 30} seconds. Ready. Begin.`);
    if (stale()) return;
    playBell(1);
    await delay(320);
    if (stale()) return;
    setPhase('working');
  } else if (cadenceEnabled(d)) {
    await speak(`${d.name}. ${d.reps || 10} reps. On my count. Begin.`);
    if (stale()) return;
    playBell(1);
    await delay(320);
    if (stale()) return;
    setPhase('working');
    startCadence(d);
  } else {
    await speak(`${d.name}. ${d.reps || '--'} reps. Move with control. Tap done when complete.`);
    if (stale()) return;
    playBell(1);
    await delay(320);
    if (stale()) return;
    setPhase('working');
  }
};
```

The 320 ms delay is what lets the bell breathe before the athlete moves.
The `stale()` guard is what a pause / skip / mission-abort uses to keep
a fired bell out of a screen the athlete has already left.

### 2.4 `completeDrill` — bells at drill end and round end

Inside the existing `completeDrill`, add bells at the two transitions:

- After the round-end block (`if (nextIdx >= drills.length)`) but before
  the `speak('Round N complete…')`, insert `playBell(2)`.
- In the inline-drill-transition branch (`else` clause), before the
  `speak('Rest. N seconds. Up next: …')`, insert `playBell(1)`.

Reference block for the round-end case:

```js
if (nextIdx >= drills.length) {
  integrity.completeUnit();
  const newRoundsCompleted = roundsCompletedRef.current + 1;
  setRoundsCompleted(newRoundsCompleted);
  roundsCompletedRef.current = newRoundsCompleted;
  if (roundRef.current >= totalRounds) {
    finishMission(newRoundsCompleted, completedSoFar);
    return;
  }
  integrity.startUnit('circuit');
  playBell(2);                                                     // ← end-of-round horn, two bells
  speak(`Round ${roundRef.current} complete. Prepare for Round ${roundRef.current + 1}.`);
  setPhase('resting');
  setRemaining(drill.restSeconds || 30);
  setDrillIdx(0);
  drillIdxRef.current = 0;
  setRound(r => r + 1);
  roundRef.current = roundRef.current + 1;
} else {
  const nextDrill = drills[nextIdx];
  const prep = getEquipmentPrep(nextDrill);
  playBell(1);                                                     // ← single bell to close a drill
  speak(`Rest. ${drill.restSeconds || 15} seconds. Up next: ${nextDrill.name}. ${prep}`);
  setPhase('resting');
  setRemaining(drill.restSeconds || 15);
  setDrillIdx(nextIdx);
  drillIdxRef.current = nextIdx;
}
```

### 2.5 `finishMission` — triple bell

Inside `finishMission`, before the "Conditioning complete. Good work."
speak, add `playBell(3)`:

```js
const finishMission = (finalRounds, finalDrills) => {
  cadenceVersionRef.current++;
  versionRef.current++;
  setDone(true);
  setPhase('complete');
  playBell(3);                                                     // ← mission complete
  speak('Conditioning complete. Good work.');
  ...
};
```

---

## 3. COMBAT CONDITIONING — shadowbox drill variety

The single drill "Shadowbox 5-Minute Rounds" was misleading at any
duration below five minutes (the coach announced the drill name; the
name promised five minutes; the timer ran whatever the athlete set).
Rename it, then add 11 new drills that cover the real range.

### 3.1 Rename `Shadowbox 5-Minute Rounds` → `Shadowbox Rounds`

In `components/training-mode/data/combatConditioningData.js`:

- Line ~872 (CC168 entry): change `name` and `slug` to `Shadowbox
  Rounds` / `shadowbox-rounds`.
- Global replace on the two prebuilt workouts that reference it by
  name: `Shadowbox 5-Minute Rounds` → `Shadowbox Rounds`. CCW001
  (Boxing Shoulder Gas Tank, line ~18) and CCW010 (Heavy Bag Speed
  Finish, line ~219).

`sed -i "s/Shadowbox 5-Minute Rounds/Shadowbox Rounds/g"
components/training-mode/data/combatConditioningData.js` catches all
three.

### 3.2 Add 11 new drills

Insert directly after CC168 (before the `// --- Core ---` block). Each
drill's shape MUST match the surrounding entries — same fields, same
order. Copy them byte-for-byte from the reference file. Summary:

**Speed shadowboxing (30–45 sec, snap tempo, one movement family)**

- **CC169 Speed Straights** — hands only, one-twos at max speed.
  `disciplineTags: ['Boxing', 'MMA', 'Universal']`, difficulty Normal.
- **CC170 Speed Combos** — 1-2-3, 1-2-3-2 at speed.
  `['Boxing', 'Kickboxing', 'MMA', 'Universal']`, Normal.
- **CC171 Speed Kicks** — teep, round, switch.
  `['Kickboxing', 'Muay Thai', 'MMA']`, Hard.
- **CC172 Speed Knees** — step-in knees, switch legs.
  `['Muay Thai', 'Kickboxing', 'MMA']`, Normal.

All four: `category: 'Combat Skill Conditioning'`,
`subcategory: 'Speed Shadowboxing'`, `equipment: 'Bodyweight'`,
`workType: 'Timed'`, `suggestedTime: '30-45 sec'`.

**Focus shadowboxing (1–5 min continuous, one weapon)**

- **CC173 Shadowbox: Hands Only** — Easy tier so beginners get it.
  `['Boxing', 'MMA', 'Universal']`, suggestedTime `2-5 min`.
- **CC174 Shadowbox: Kicks Only** — Normal, kickboxing / Muay Thai /
  MMA, `2-5 min`.
- **CC175 Shadowbox: Knees Only** — Normal, Muay Thai / Kickboxing /
  MMA, `2-4 min`.
- **CC176 Shadowbox: Elbows Only** — Normal, Muay Thai / MMA, `1-3
  min`.

All four: `category: 'Combat Skill Conditioning'`, `subcategory:
'Shadowboxing'`, `equipment: 'Bodyweight'`, `workType: 'Timed'`.

**Conditioning bursts (1–3 min, ground-to-feet)**

- **CC177 Shadowbox + Burpee** — 3-punch combo → burpee → repeat.
  Hard, `['Boxing', 'Kickboxing', 'MMA', 'Universal']`,
  `suggestedTime: '1-3 min'`.
- **CC178 Short Combo + Burpee** — 1-2, burpee, 1-2, burpee.
  Hard, universal disciplines, `suggestedTime: '30-60 sec'` — this
  is the drill the picker will grab for short intervals when combined
  with high intensity.
- **CC179 Shadowbox + Sprawl** — 5 punches, sprawl, up, 5 more. MMA
  only, Hard, `suggestedTime: '1-3 min'`.

All three: `category: 'Conditioning'`, `subcategory: 'Shadowboxing &
Bursts'`, `equipment: 'Bodyweight'`, `workType: 'Timed'`.

Full field-by-field copy of all 11 entries is at the top of the CC169
block in the reference file. Do not paraphrase the coaching cues — a
fitness tester wrote them.

### 3.3 Audit sanity

After adding the drills, `npm run audit:cc` should still print **0
failures / 144 clean**. The preset overlap should stay at 0 (the extra
variety actually reduces overlap in narrow NONE-equipment pools).

---

## 4. COMBO COACH + FIGHT FOCUS TIMER — voice priority tags

The scheduler is only half the fix. Every caller in `ComboCoachActive`
and `FightFocusTimer` needs to declare its priority so the scheduler
knows who has the mic. `FightFocusTimer` is what powers **Training
Arcade** and **Training Camp** as well, so this pass fixes all three
surfaces at once.

### 4.1 Combo Coach priority map

Read `ComboCoachActive.jsx` in the reference to see every touched call.
The rules the athlete asked for:

| Event | Priority | Behaviour | Why |
|---|---|---|---|
| Motivational quote | 1 | `dropIfBusy: true` | Background flavour; if a combo is speaking, drop the quote rather than queue it up to fire two seconds late. |
| Rush activation (`RUSH_ACTIVATION`) | 3 | `preempt: true` | THE mic-defining moment of the round; must be heard. |
| Rush complete (`RUSH_COMPLETE`) | 2 | queue | Fires after the rush window ends; queue behind any combo tail. |
| Mid-rush cue lines | 1 | `dropIfBusy: true` | Cheerleading; must never delay a queued countdown behind it. |
| Rush countdown numbers ("5", "4", …) | 3 | `preempt: true` | HAS to hit on the second. |
| Session complete (`fightComplete`) | 3 | `preempt: true` | The closing statement. |
| Rest transition ("Rest.") | 2 | queue | Session flow. |
| Combo call / defense call | 2 | queue | Primary mic; only speaks when rush is NOT active. |

### 4.2 Combo Coach — the additional rush gate

Both call sites that speak combos (the defense-call branch and the
regular-combo branch) must also **skip entirely when rush is active**.
Before the fix, only the endRound last-10s window suppressed combos.
Now, any rush pattern — 30-second, 5-second, any of them — silences
combo call-outs for the full rush window.

Change the two `if (cfg.voiceOn !== false && remainingRef.current > 3
&& …)` guards to include `&& !rushRef.current`. The reference diff at
`ComboCoachActive.jsx:507` and `:532` shows the exact lines.

### 4.3 Fight Focus Timer — same priority map

`FightFocusTimer.jsx` uses the same shape (it's the timer for
`FightFocusActive`, `ArcadeSessionPlayer`, and camp sessions). Apply
the same tags:

| Line (reference) | What speaks | Change |
|---|---|---|
| ~248 | Ghost verdict ("Ghost defeated." / etc.) | `{ ...vOpts, priority: 3, preempt: true }` |
| ~250 | Session complete | `{ ...vOpts, priority: 3, preempt: true }` |
| ~305 | Motivational quote | `{ rate: 0.95, priority: 1, dropIfBusy: true }` |
| ~335 | Rush activation | `{ priority: 3, preempt: true }` |
| ~346 | Rush complete | `{ priority: 2 }` |
| ~356 | Mid-rush cue | `{ priority: 1, dropIfBusy: true }` |
| ~371 | Rush countdown number | `{ priority: 3, preempt: true }` |
| ~380 | "Halfway." | `{ ...vOpts, priority: 2, dropIfBusy: true }` |
| ~403 | Cadence combo call | `{ ...vOpts, priority: 2 }` |
| ~444 | Finisher intro | `{ ...vOpts, priority: 3, preempt: true }` |
| ~460 | Rest + next-up | `{ ...vOpts, priority: 2 }` |
| ~480 | Next finisher movement | `{ ...vOpts, priority: 3, preempt: true }` |

The reference file has the exact final form of each call. Read it and
match.

### 4.4 What to NOT change

- Don't rewrite the existing `isSpeakingCombo.current` gate. The
  scheduler and that gate coexist: `isSpeakingCombo` is a caller-side
  hint that lets other callers avoid stepping on a combo mid-await, and
  the scheduler is the module-side authority. Both stay.
- Don't touch cadence-count `speakAsync(String(i))` inside cadence rep
  counting. Cadence counts are already awaited; they queue naturally.

---

## 5. VERIFICATION — on a real phone, in a real round

Once the code is in place, drive each of these to smoke:

### 5.1 Combat Conditioning

- Enter CONDITIONING, pick **GAS TANK · BAG · MED**, START.
- **Timer must sit at `0:40` until the coach finishes announcing the
  drill.** Not "0:38", not "0:35" — sit.
- **Bell rings** after "Ready. Begin.", right before the count starts.
- **Bell rings** to close each drill, before "Rest. N seconds. Up next…".
- **Two bells** at the end of a round, before "Round N complete."
- **Three bells** at the very end, before "Conditioning complete."
- Rename check: the coach should announce "Shadowbox Rounds", never
  "Shadowbox Five-Minute Rounds".
- Variety check: over a handful of Kickboxing sessions at 40-sec work,
  you should start hearing Speed Combos, Speed Knees, Short Combo +
  Burpee. Over 2-min work, you should hear Shadowbox: Kicks Only,
  Shadowbox: Knees Only.

### 5.2 Combo Coach with Rush Mode on

- Set a 60-sec round with rush pattern **endRound (last 10s)**.
- Activate rush by letting the round tick down to 10s.
- **Rush activation ("Rush!") cuts in cleanly** — no clipped combo
  syllable behind it.
- **Countdown "5, 4, 3, 2, 1" lands every second** regardless of what
  was playing.
- **Combo call-outs stop completely** during the rush window. Only rush
  countdown + rush cues + rush complete should be heard.
- Trigger a motivational quote schedule (some rounds have 15s / 30s
  scheduled quotes). While a combo is mid-word, the quote should **not
  play** — it drops silently.

### 5.3 Fight Focus (and by inheritance Training Arcade + Camp)

- Run a Training Camp session with rush mode on.
- Same expectations as Combo Coach: no clipped syllables, countdown
  numbers hit every second, combos silenced during rush.

---

## 6. WHAT THIS PROMPT DELIBERATELY DOES NOT DO

- No changes to any workout-timer engine other than the parts named
  above. Do NOT touch the round timer's `setInterval`, cadence counts,
  ghost recording, or integrity module.
- No new prebuilt workouts.
- No changes to `CombatConditioningSetup.jsx` — that landed in
  `PROMPT-REVAMP-CC-1`.
- No changes to `AddCardioSheet`, `WarmupRow`, `ScreenGuide`, or the
  bottom nav.
- Do NOT change the default behaviour of `speakAsync` for callers that
  don't pass any opts. Their behaviour is now "queue at priority 1" —
  the same effective ordering as before for the single-caller case, but
  now safe for the multi-caller case too.

---

## 7. DONE MEANS

- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run test:indoor` — 56 passed / 0 failed.
- `npm run test:cardio` — 39 passed / 0 failed.
- `npm run audit:cc` — Failures: 0. Sessions clean: 144. Preset overlaps: 0.
- `npm run build:web` — exit 0.
- On a real phone, the eight verification bullets in §5 all pass.
- A Combat Conditioning round timer sits at its start value until the
  coach's intro finishes, then rings a bell, then counts.
- Combo Coach's rush countdown "5, 4, 3, 2, 1" is heard on the second,
  every second, regardless of what quote or combo was in flight.
- No clipped mid-syllable audio anywhere.

If all seven checks and eight live bullets pass, ship it.
