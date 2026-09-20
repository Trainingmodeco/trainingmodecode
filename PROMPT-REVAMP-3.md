# PROMPT REVAMP-3 — the fortnight since REVAMP-2

Run this in the Training Mode revamp app. It is the roll-up of everything
shipped to `app` of `github.com/Trainingmodeco/trainingmodecode` between
`1c568bc` (the last transfer kit's head) and `fb05f52` (today) — twelve
commits, four systems.

The systems, and why each one exists:

1. **Every arcade block's clock now restores itself** (`272ee45`) — a Camp
   set or a Cardio Finisher used to lose its ticker on a resumed session
   and reset to 0:00. Every block reads its own persisted seconds now.
2. **Cardio equipment picker + machine speed dial + cadence coach** — the
   old "estimated distance" was circular; it played the goal back at you.
   Distance is now measured or explicitly time-goal, per equipment. See
   §2 for the eight pieces.
3. **ROUNDS card + cardio session generator** — ALTERNATE and EXERCISE
   were the same product wearing two hats. One card now, and the app can
   BUILD the session from your level using the 50-move Combat Conditioning
   library plus 9 additions. §3.
4. **The Pro overlay at the point of contact + the truth pass** — the
   paywall was a screen the user was routed to, and it sold two things
   the app does not have. Both fixed. §4.

Read the ledger below, fetch the files, verify the checks. Everything is
in the `app` branch as of the last push, and the transfer kit format is
identical to REVAMP-2 — Option A checkout, Option B patch, Option C
cherry-pick.

**Line numbers drift.** Every one below is a hint, verified against the
tree the day this prompt was written. Match on the quoted symbol before
you edit.

---

## 0. Fetch first, before anything else

    git fetch https://github.com/Trainingmodeco/trainingmodecode.git app
    git show FETCH_HEAD:transfer/README.md

That README carries the checkout command, the full patch, and the
cherry-pick list. Use Option A unless your revamp has its own edits in
`App.jsx`, `ScreenRouter.jsx`, `Profile.jsx`, `HomeDashboard.jsx` or
`ProgressScreen.jsx`; for those five use Option B (`git apply -3 --binary`)
so your edits merge instead of being overwritten.

Then, before reading further:

    npx tsc --noEmit && npx expo lint && npm run test:indoor && \
        npm run test:cardio && npm run build:web

All five must be clean. `test:indoor` is 56 checks over the speed dial and
the cadence meter; `test:cardio` is 39 checks over the generator. If
either fails, do not proceed to the UI wiring.

---

## 1. THE LEDGER — twelve commits, in the order that makes them make sense

| Commit | System | Feature | Files (representative) |
|---|---|---|---|
| `272ee45` | 1 | Every block restores its own clock | `App.jsx`, `CampFitRunner.jsx`, `CampFitSetRunner.jsx`, `CampFullSession.jsx`, `CardioFinisherPlayer.jsx`, `CardioProtocolPlayer.jsx` |
| `25289ae` | 1 | Geoapify tile provider + automatic credit | `RouteMap.jsx`, `data/mapTiles.js` (new) |
| `0db0452` | 2 | Speed dial + cadence + machine-surface ghosts | `data/machineSpeed.js` (new), `data/cadence.js` (new), `hooks/useCadence.js` (new), `shared/SpeedDial.jsx` (new), `data/runGhosts.js`, `RunPlayer.jsx`, `CardioMode.jsx`, `CardioSummary.jsx` |
| `9b16bb1` | 2 | Equipment IS the choice; each declares its tracking | `data/cardioEquipment.js` (new), `CardioMode.jsx`, `CardioSummary.jsx` |
| `b2419be` | 2 | Setup options change per equipment | `CardioMode.jsx`, `data/cardioEquipment.js` |
| `45d1f18` | 3 | Miles default + bodyweight = timer | `CardioMode.jsx`, `CardioSummary.jsx`, `data/runLog.js`, `shared/IntervalQuickSet.jsx` (new) |
| `6e8a7c1` | 3 | ROUNDS card + session generator + coach names moves | `data/cardioGenerator.js` (new), `shared/CardioSessionCard.jsx` (new), `CardioMode.jsx`, `CardioProtocolPlayer.jsx`, `scripts/test-cardio-generator.mjs` (new) |
| `9cbda7d` | 4 | Truth audit (documentation) | `TRUTH-AUDIT.md` (new) |
| `69fab24` | 4 | Pro overlay at the point of contact | `shared/ProGateOverlay.jsx` (new), `data/entitlements.js`, `ArcadeSeriesDetail.jsx`, `TrainingCampMap.jsx`, `ComboCoachSetup.jsx`, `FightFocusSetup.jsx`, `ScreenRouter.jsx` |
| `e5df39c` | 4 | Overlay centred, logo top | `shared/ProGateOverlay.jsx` |
| `2c1c12a` | 4 | Overlay uses the real Training Mode logo | `shared/ProGateOverlay.jsx` |
| `fb05f52` | 4 | Truthful benefits everywhere Pro is sold | `Paywall.jsx`, `Profile.jsx`, `GameLink.jsx`, `HowItWorksGuide.jsx` |

Record `fb05f52` in your own commit message as the source, so the next
roll-up diffs from it.

---

## 2. SYSTEM TWO — cardio, honestly measured per equipment

### 2.1 The problem this fixes

`RunPlayer.jsx` computed indoor distance as `elapsedSec / targetPaceSec`
— the goal played back at the athlete. Every indoor run finished exactly
on target, every split landed on schedule, and the pace coach was
deliberately muted (`RunPlayer.jsx:410`) because the number could not
disagree with the plan. And treadmill mode was reachable only by being
denied GPS — an athlete standing on a belt with location granted picked
RUNNING and watched the distance sit at zero.

### 2.2 The four tracking modes, in descending order of what the app knows

    'gps'      Satellites measure the distance. Outdoors only.
    'speed'    The athlete matches a dial to the console; distance is that
               speed integrated over elapsed time.
    'console'  No trustworthy live distance, but the console keeps a real
               one. Run on time, take the number at the end. (Rower.)
    'time'     No trustworthy distance at all. Goal is minutes; cadence
               and calories carry the session.

Live in `data/cardioEquipment.js`. Rule: **never show a distance the app
cannot stand behind.** An estimated distance is worse than no distance.

### 2.3 The six pieces of equipment

    RUNNING → OUTDOOR RUN (gps)
              TREADMILL RUN (speed)
    OTHER   → BIKE (speed)
              ROWER (console; unit 'm')
              ELLIPTICAL (time)
              STAIR CLIMBER (time)

Each is one card on its equipment screen, labelled with a green DISTANCE
GOAL or violet TIME GOAL badge so the athlete knows before starting rather
than mid-session.

### 2.4 The speed dial (`data/machineSpeed.js`)

Speed integrated over elapsed seconds, in segments — changing the belt
changes the rate from that moment without recomputing the past. As
accurate as the belt's calibration. Two subtle wins:

- `clampSpeed()` rounds via integer tenths, not `Math.round(s / 0.1) * 0.1`
  which reintroduces binary error and stored `10.100000000000001` into
  cloud sync.
- `setSpeedAt()` coalesces bursts within 2.5s into one segment change,
  so a 30-tap belt bump writes one boundary, not 30.

Verify:

    npm run test:indoor
    # Expect: 56 passed, 0 failed

### 2.5 The cadence meter (`data/cadence.js`)

Not the punch detector retuned — that has an adaptive noise floor and
running is continuous, so within seconds the floor rises to include the
running signal and it goes deaf. Peak-counting throws away the property
that makes gait easy: it is periodic. The meter measures the period with
a DFT over candidate frequencies, evaluated against real timestamps
(DeviceMotion delivers 50–200 Hz and jitters).

Every threshold in this file is EMPIRICAL. Three plausible designs were
rejected by measurement; the rationale is documented in place. Do not
touch the constants without re-running the harness — a change that looks
obviously better silently halved availability once already.

Confidence alone does not gate the display. What separates a runner from
a treadmill running with nobody on it is HARMONIC STRUCTURE — a footstrike
is an impulse, so it has a second harmonic; a noise peak does not.

### 2.6 The stride cross-check

`strideIsPlausible(rate, speed, unit, kind)`. A cadence value at a known
speed implies a stride length; anything outside 0.4–2.0m on the run is
rejected as impossible. This kills the meter's last failure mode — a
brief false reading on an empty running belt that would otherwise say
you were running when you were not.

### 2.7 Ghost bucketing (`data/runGhosts.js`)

Ghosts key on `${unit}|${goal}|${surface}` now, where `surface` is
`'gps'` or `'machine'`. A treadmill mile and an outdoor mile are not the
same mile — the belt comes back to meet you, there is no wind, no camber,
no turns. Legacy keys migrate on read to `${unit}|${goal}|gps` (every
existing ghost is from GPS; the machine surface did not exist).

### 2.8 CardioSummary now has three states, not two

    Old: gps ? "GPS · VERIFIED" : "ESTIMATED · NO FIX"
    New: gps       ? "GPS · VERIFIED"
       : measured  ? "MACHINE · CONFIRMED"   (after typing the console number)
                  or "MACHINE · TRACKED"    (dial only)
       : "ESTIMATED · NO FIX"

Machine runs prefill the distance field. Rower asks for METRES from the
console and converts to km on the way into the log.

### Verify §2

- Start Cardio → OUTDOOR RUN → GENERATE. Player is unchanged from
  REVAMP-2's build.
- Cardio → TREADMILL RUN → set 3 mi goal, start. Header reads
  `10.0 KPH · RUNNING · 5 km`, distance labelled `DISTANCE · MACHINE`,
  MACHINE SPEED dial visible below the controls. Change the dial: pace
  chip tracks it (10.0 → 6:00/km, 13.0 → 4:37/km, 4.0 → 15:00/km).
- Cardio → OTHER EQUIPMENT → ELLIPTICAL. Player shows the ring, no
  distance anywhere, and offers TRACK MY CADENCE.
- Cardio → OTHER EQUIPMENT → ROWER → end early → summary asks
  `METRES (from the console)` with km/mi toggle hidden.

---

## 3. SYSTEM THREE — the ROUNDS card and the session generator

### 3.1 Two cards become one

`METHOD_CATEGORIES` in `CardioMode.jsx` was `RUNNING · MACHINE · ALTERNATE
· EXERCISE`. The last two were the same product wearing two hats. They
merge into one ROUNDS card, wide (`gridColumn: '1 / -1'`). Legacy setups
map forward with `LEGACY_CATEGORIES = { alternate: 'rounds', exercise: 'rounds' }`.

### 3.2 The four formats — names in the chips, timings in the note

The chip row is the four format names ONLY. An earlier draft put
`FIGHT ROUNDS 3:00 / 1:00 × 12` inside the chip and pushed the other three
onto a second row. The timings live in the sentence BELOW the chips, where
there is space to explain what the format is FOR:

- **FIGHT ROUNDS** — three minutes on, one minute off, twelve rounds.
- **TABATA** — twenty seconds flat out, ten off, eight rounds. Four
  minutes total.
- **HIIT** — forty-five seconds hard, fifteen off, ten rounds.
- **CUSTOM** — your numbers.

### 3.3 The session generator (`data/cardioGenerator.js`)

Does NOT carry its own exercise list. `CC_EXERCISE_LIBRARY` already has
50 movements with difficulty, equipment, coaching cues and safety notes
that Combat Conditioning has been using for months. Two lists would be
two places for a bad cue to hide.

The generator filters that library to conditioning work on basic kit
(bodyweight, jump rope, medicine ball, heavy bag, pull-up bar, battle
rope) and adds nine that the library lacks: high knees, mountain
climbers, the three shadowbox variants, battle rope waves and slams,
hurdle jumps, explosive pull-ups. Medicine ball slams are pulled in by
name despite being filed under Strength — on a clock, they are.

Equipment is an ALLOW-LIST. Anything needing a rack, a barbell, a cable
machine, cones or an agility ladder never gets generated. A suggested
session the athlete cannot start is worse than no suggestion.

Difficulty gates on level: Easy from L1, Normal from L2, Hard from L6,
Advanced never.

### 3.4 The session card — editable, not regenerated

Each row: `↑ ↓ ⇄ ✕`. Regenerating is the WRONG fix for one bad movement
— someone with a sore wrist wants the push-ups gone, not a whole new
session that drops the four they were happy with. `SURPRISE ME` is
there for when they genuinely want to start over.

Total retimes itself on every edit. Minimum floor of 2 moves.

### 3.5 The coach names each movement

`CardioProtocolPlayer.jsx` takes a `moveNames` prop. On the WORK segment
of interval `i`, the coach says `"Round <n>. <movement>. Go!"` instead
of `"Round <n>. Work!"`. This is the thing a generic interval timer
CANNOT do — it tells you WHAT to do, not just when.

The movement also shows under the ring, and the upcoming one shows
during the rest.

### Verify §3

    npm run test:cardio
    # Expect: 39 passed, 0 failed

- Cardio → ROUNDS. Four format chips fit one line. Each format changes
  the note underneath.
- Tap `BUILD ME A SESSION` (or `⟳ SURPRISE ME`). Card shows five moves,
  ordered by category so it is not five push-ups.
- Move row 1 down → rows 1 and 2 swap. Swap row 3 → only row 3 changes.
- Start the session. Audio (or the caption on a silent build) names the
  first movement at round 1: `Round 1. <name>. Go!`

---

## 4. SYSTEM FOUR — the Pro overlay and the truth pass

### 4.1 Two problems, one fix

Old paywall was a SCREEN the user was routed to. Athletes lost their
setup (`ComboCoachSetup`, `CardioMode`, `TrainingCampMap`) because the
router tore down the tree. Worse: the back-button behaved unpredictably,
and the mini-player was killed by the tear-down.

New behaviour: the Pro ask pops IN PLACE the moment a free athlete tries
the thing free does not cover, and closes back to where they were.

### 4.2 `shared/ProGateOverlay.jsx` — one component, four sites

The overlay is a component, not a screen. Rendered as a fixed centred
modal over the setup. The Training Mode wordmark (`IntroLogo`, glow on,
44px) sits at the top-centre, the `TRAINING MODE PRO` badge under it,
close button in the top-right corner.

Props: `open`, `title`, `body`, `freeLine`, `proLine`, `onGoPro`, `onClose`.

The four sites, each with its own title and free-vs-Pro sentence:

    Arcade         Stage <n> is Pro.        Stages 1–3, all sagas.
    Camp           Level <n> is Pro.        Levels 1–3. Both formats.
    Combo Coach    <n>-round session is Pro. Up to 3 rounds per session.
    Fight Focus    <n>-round session is Pro. Up to 3 rounds per session.

Each site's overlay says the SPECIFIC thing being asked for. Not "Go Pro
to unlock more". "Stage 4 is Pro." "Level 4 is Pro." "5-round session is
Pro." The context is right in the sentence.

### 4.3 A new gate — `canRunRounds(rounds)`

`data/entitlements.js` gains `GATES.freeRoundsPerSession = 3` and
`canRunRounds(n)`. The gate only bites when `paywallActive()` is true,
so dev work is not blocked by accident.

The stepper does NOT cap at 3. The gate fires on START. That is
deliberate — letting the athlete build the whole session first is
stronger than a stepper that caps early, because they see the 20-minute
total they would get with Pro before the ask.

### 4.4 The truth pass — six places, no fake claims

Paywall.jsx sold four benefits; only two mapped to real gates. Fake ones
were "avatar tier + exclusive skins" and "voice coaching + game-link
rewards". Two more were on the highest-traffic entry points in Profile.
The full sweep:

    Paywall.jsx:15-20    4 truthful bullets
    Profile.jsx:433      "Unlock Arcade, Camp levels 4-12 & unlimited routines"
    Profile.jsx:649      same
    Profile.jsx:653      GAME LINK — "Connect your fighter — in the works."
    GameLink.jsx:8-12    3 bullets, all softened to future work
    HowItWorksGuide      "power the avatar" (was "stats, rank & skins")

The BENEFITS block in `Paywall.jsx`:

    const BENEFITS = [
      'All Arcade protocols & boss stages',
      'Training Camp levels 4-12',
      'Unlimited saved Builder routines',
      'Full session length in Combo Coach & Fight Focus',
    ];

Rule for future changes: **the gate ships first, the banner second.** A
new benefit gets a `canAccess…` function before it gets a bullet on the
paywall.

### Verify §4

- `grep -rn "skins\|avatar tier\|launches 202\d\|game-link reward" components/`
  → only `protocol/campaigns.ts` (an internal source comment) remains.
- Enable the preview: `?paywall=preview`, then a paid preview through
  the browser opts this device in.
- Combo Coach: set 5 rounds, tap START. Overlay opens IN PLACE, title
  reads `5-round session is Pro.`, tiles show `Up to 3 rounds per session`
  vs `Any round count. Any format.`. Cancel — setup is still 5 rounds.
- Arcade: tap stage 4. Overlay opens, title `Stage 4 is Pro.`, tiles show
  `Stages 1–3, all sagas.` vs `Every stage. The mythic boss. Ghosts you race.`
- Camp: tap level 4. Overlay opens, title `Level 4 is Pro.`.
- Profile grep for the old fake strings returns nothing.

---

## 5. THE ORDER TO SHIP IT

If the revamp does not carry parallel work on these files, take the whole
kit in one commit. If it does, this is the order that isolates blast
radius:

1. `272ee45` + `25289ae` — pure additions to Camp and RouteMap. Zero risk.
2. §2 (`0db0452`, `9b16bb1`, `b2419be`) — the cardio system. New files;
   `CardioMode.jsx` and `CardioSummary.jsx` are whole-file copies for
   simplicity but their changes are strictly additive (equipment picker,
   equipment options block, speed dial, MACHINE/CONFIRMED label).
3. §3 (`45d1f18`, `6e8a7c1`) — the ROUNDS card and generator. `CardioMode.jsx`
   again; `CardioProtocolPlayer.jsx` gets `moveNames` and `cadenceKind`
   props; both are optional.
4. §4 (`69fab24`, `e5df39c`, `2c1c12a`, `fb05f52`) — the overlay and the
   truth pass. `entitlements.js`, `ScreenRouter.jsx`, four setup screens
   and `Paywall.jsx`.
5. `9cbda7d` — TRUTH-AUDIT.md is documentation only; take it or reference
   it in your own tree.

---

## 6. DONE MEANS

- `npx tsc --noEmit && npx expo lint` both clean.
- `npm run test:indoor` reports 56 / 56.
- `npm run test:cardio` reports 39 / 39.
- `npm run build:web` exits 0 and the built `dist/` boots.
- Every check listed under §2, §3 and §4 passes by hand in a phone-width
  Chrome window with `?paywall=preview` set.
- `grep -rn "skins\|avatar tier\|launches 202\d\|game-link reward"
  components/` returns only `protocol/campaigns.ts:3` (internal comment).
- Ghost migration is idempotent: run the app twice, snapshot
  `localStorage.tm_run_ghosts_v1`, confirm the second boot changed nothing.
- The Pro overlay opens ON TOP of each of the four setup screens without
  tearing them down. Close it and the setup values are untouched.

If all seven pass, ship it and record `fb05f52` as the source in the
merge commit.
