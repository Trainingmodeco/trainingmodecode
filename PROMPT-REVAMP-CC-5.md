# PROMPT REVAMP-CC-5 — Concept drops, the concept gauntlet on the Arcade ladder, titleless Arcade banners, saga renames, Strike Lab sensors, and the production smoke test

**Scope: everything that shipped to `apptrainingmode.com` after CC-4
(`3dd63cc`) up to and including commit `20cb89a` on
`trainingmodeco/trainingmodecode`, branch `app`. Nothing else.**

Run this in the revamp app repo. It brings the revamp up to `20cb89a`.

Every path, constant and string here was checked against the working tree
of the app repo on 2026-10-02. **Read the source files below** before
writing — the revamp must match them line-close, not paraphrase. Where this
prompt and the source disagree, the source wins.

**Reference source** — read from `trainingmodeco/trainingmodecode`,
branch `app`, at commit `20cb89a`:

| Purpose | Path |
|---|---|
| Concept engine: schedule, window, vault/Pro rules, owner preview, Fit/Fight/Arcade cfg builders, completion, pop-up | `components/training-mode/data/concepts/index.js` |
| Concept saga adapter (concept → Arcade series shape, path stars, carousel list) | `components/training-mode/data/concepts/saga.js` |
| Shoto content (three styles, supers, exercises, 3 × 10-stage arcs) | `components/training-mode/data/concepts/shoto.js` |
| Ultra Ego content | `components/training-mode/data/concepts/ultraEgo.js` |
| Concept page (FIT / FIGHT / ARCADE tabs, tier chips, Gym/Home, sticky CTA) | `components/training-mode/ConceptScreen.jsx` |
| App-open drop pop-up | `components/training-mode/shared/ConceptDropPopup.jsx` |
| Featured-drop card on Home, Fit hub, Fight hub | `components/training-mode/shared/ConceptFeatureCard.jsx` |
| Arcade carousel (concept sagas first, 2:3 cards, printed titles) | `components/training-mode/TrainingArcade.jsx` |
| Stage ladder + side-anchored stage pop-up (CHOOSE YOUR PATH) | `components/training-mode/ArcadeSeriesDetail.jsx` |
| Arcade progress store (`path` → stars) | `components/training-mode/data/arcadeProgress.js` |
| Supers in the round timer | `components/training-mode/FightFocusTimer.jsx` |
| Fit player: concept title, no REGENERATE | `components/training-mode/FitBuilderWorkout.jsx` |
| Host wiring (popup queue, goConcept, goConceptSaga, concept stage start, completion) | `components/training-mode/App.jsx` |
| Routes (`concept`, StrikeLab `onOpenConcept`, ConceptScreen `onOpenGauntlet`) | `components/training-mode/ScreenRouter.jsx` |
| Saga titles / stage names / badges after the renames | `components/training-mode/data/trainingArcadeData.js` |
| Player chrome fallback title | `components/training-mode/ArcadeCadenceRepPlayer.jsx`, `ArcadeBenchmarkPlayer.jsx` |
| Strike Lab (private; sensors auto-on at test start) | `components/training-mode/StrikeLab.jsx` |
| GPS run crash fix (hook order) | `components/training-mode/RunPlayer.jsx` |
| Plausible snippet + boot crash reporter | `scripts/copy-public-assets.mjs`, `app/+html.tsx`, `components/training-mode/data/analytics.js` |
| Lint guard | `eslint.config.js` |
| Tests | `scripts/test-concepts.mjs` (92 checks), `scripts/smoke-web.mjs` |
| Art | `public/static/concepts/{shoto,ultra-ego}/{poster,wide,card}.webp`, `public/static/series/posters/*.{png,webp}` |

---

## 1. Concept drops (the engine)

A **concept drop** is a themed program released on a two-month cadence. Each
drop has three parts: a **Fit program**, a **Fight program** and an
**Arcade gauntlet**.

Rules — copy `data/concepts/index.js` verbatim, it is pure data + rules and
never renders:

- `CONCEPT_SCHEDULE` (date order, inclusive local dates):
  - Shoto `2026-10-19` → `2026-11-30`
  - Ultra Ego `2026-12-01` → `2027-01-31`
- `windowState(entry)` → `'upcoming' | 'live' | 'vault'`.
- The **live** drop is free for everyone. A **vault** drop is Pro, except a
  player who started it inside its window keeps it until all three parts are
  done (`canPlay`).
- The limited reward (title + XP) is claimable only inside the window
  (`rewardState` → `locked | ready | expired | claimed`).
- **Owner preview:** `localStorage['tm_owner_preview'] = '1'` features the next
  upcoming drop and makes it playable. Unlocking the private Strike Lab sets
  it (`setOwnerPreview(true)` in App's lab effect).
- Progress lives in `localStorage['tm_concepts_v1']` per concept:
  `fitDone`, `fightDone`, `cleared[]`, `clearedBy{fit,fight,hybrid}`,
  `startedAt`, `popupSeen`, `rewardClaimedAt`, prefs.
- Completion (`recordConceptSession(cfg, done, total)`, called from
  `goSummary` and `goFitComplete`): Fit counts at ≥75% of exercises, Fight at
  ≥75% of rounds, an Arcade stage only when every round is done. A stage
  cleared in any arc counts in `cleared`; each arc also keeps its own marks
  in `clearedBy`.
- `duePopup()` — once per drop per phone, only while it is featured. In App's
  open-time queue it sits **after** the ghost challenge offer and **before**
  the comeback card.

### Session builders (they reuse the existing players — no new player)

- `fitDayCfg(concept, { tier, home })` → a Fit player cfg with
  `savedExercises`, `conceptId`, `conceptKind:'fit'`, `conceptSeq`,
  `conceptTitle` (e.g. `ULTRA EGO · LEGS`). Tier scales sets/reps; `home`
  swaps gym kit for the row's `swap`. `WEIGHTED` = dumbbell, barbell,
  kettlebell, medball, sandbag.
- `fightDayCfg(concept, { tier })` → a Fight Focus cfg with `blockRounds`
  (combos, `super`, `rush:{ pattern:'end30' }`), `conceptKind:'fight'`.
  App starts it through `startConceptFight(cfg, concept.fight.discipline)`,
  which sets the discipline then calls `goTimer`.
- `stageCfg(concept, stageIdx, { arc })` → a Fight Focus cfg for one
  gauntlet stage. `arc` is `'fit' | 'fight' | 'hybrid'` (see §3).

### FitBuilderWorkout

- `buildTitle(cfg)` returns `cfg.conceptTitle` when set.
- REGENERATE is hidden when `cfg.conceptId` is set (a concept day is a set
  program); the actions grid collapses to one column.

---

## 2. Supers (FightFocusTimer)

A concept Fight round can carry `super: { name, calls[], every }` with
`rush: { pattern: 'end30' }` — a named custom rush in the last 30 s of the
last bag round.

When the rush opens on a super round:
- Speak `Super! <name>!` instead of the rush activation line; first call
  after 2 s.
- Every `every` seconds (default 5) call the next entry of `calls`
  (cycling, via `formatCall` with the user's call style), show it as the
  current combo, and keep calling through the final seconds while
  `remaining > 3` — the combo IS the finish.
- Skip the numeric rush countdown on super rounds.

Shoto's supers (`SUPERS` in `shoto.js`): **Rising Dragon** (Ryu, every 4 s),
**Dragon Storm** (Ken, every 6 s), **Demon Barrage** (Akuma, every 6 s).

---

## 3. The concept gauntlet on the ORIGINAL Arcade ladder

The owner's call: **keep the original Training Arcade ladder and its
side-anchored stage pop-up.** A concept gauntlet is not a separate list —
it is a saga in the Arcade carousel and opens the same ladder.

- `saga.js`:
  - `conceptSaga(conceptId)` adapts a concept into the Arcade series shape:
    `id: concept-<id>`, `conceptId`, `title`, `subtitle: '<TITLE> Gauntlet ·
    Concept Drop'`, `modeOptions/availableModes: ['fit','fight','both']`,
    `poster: art.arcade || art.card`, and 10 `stages` with
    `pathItems: { fit, fight, both: { format, items } }`. The boss title is
    stripped of its `BOSS · ` prefix.
  - `conceptSagaProgress(conceptId)` → `{ completedStages: { [stageId]:
    { completed, stars: paths.length, paths } } }`.
  - `conceptSagasForCarousel(now)` → the featured drop (live, or owner
    preview) plus playable vault drops. TrainingArcade puts these **first**.
- Each concept defines three full 10-stage arcs: `arcade.fit` (fitness
  only), `arcade.fight` (striking with a little fitness) and
  `arcade.stages` (hybrid). Levels get progressively harder — there is
  **no** easy/normal/hard.
- `ArcadeSeriesDetail`:
  - When `series.conceptId` is set, progress comes from
    `conceptSagaProgress`.
  - `pathModes = series.modeOptions?.length > 1 ? series.modeOptions : null`.
    When set, the pop-up replaces the star-goal / difficulty row with a
    **CHOOSE YOUR PATH** chip row: `FIT` / `FIGHT` / `BOTH` (default `BOTH`).
    A chip shows ★ when that path is already cleared.
  - Mission objectives come from `selected.pathItems[selMode].items.slice(0,4)`
    (fallback `selected.mission`).
  - ENTER STAGE with `pathModes` starts directly:
    `onStartStage(series, selected, selMode, null, { difficulty:'normal',
    voiceCoach:true, sound:'on' })`.
- App `goArcadeSession`: if `series.conceptId`, map
  `both → hybrid, fit → fit, else fight` and run
  `startConceptFight(conceptStageCfg(entry.concept, stageNumber-1, { arc }))`.
  v2 campaigns now also carry `path` in their arcade ctx and pass it to
  `completeArcadeStage`.
- `arcadeProgress.completeStage`: when `result.path` is given, merge it into
  `entry.paths` and set `stars = paths.length` (stars = paths cleared, max 3).
- `goArcadeSeries` routes a `conceptId` series to `arcade_series`; new
  `goConceptSaga(conceptId)`.
- The concept page's ARCADE tab calls `onOpenGauntlet(c.id)` →
  `actions.goConceptSaga` (or the Pro gate when `canPlay` is false). The old
  in-page arcade list, arc picker sheet and the Arcade "concept strip" are
  gone.

---

## 4. Concept surfaces

- **ConceptDropPopup** — app-open card: art, `NEW CONCEPT DROP` pill, window
  line (`UNTIL NOV 30 · LIMITED TITLE`), title, tagline, three chips
  (FIT / FIGHT / ARCADE with their lengths), `▶ START THE REGIME`, and the
  reward line. START → `goConcept('fit', id, 'home')`.
- **ConceptFeatureCard** — the featured drop on Home (`mode="home"`), Fit hub
  (`mode="fit"`) and Fight hub (`mode="fight"`), each wired to
  `onOpenConcept`.
- **ConceptScreen** — FIT / FIGHT / ARCADE tabs, tier chips, Gym/Home
  toggle, sticky CTA. Route `concept`; App state
  `conceptView = { id, tab, from }`.
- **StrikeLab** — per-drop `OPEN` buttons (via `onOpenConcept`) and the
  preview toggle.

---

## 5. Arcade banners — titleless art, titles printed in-app

- All saga banners are now **2:3** (768×1152) silhouette art with **no title
  baked in**. Replace the files in `public/static/series/posters/` with the
  ones at `20cb89a` (`one-punch`, `hyperbolic-gravity`, `hero-hunter`,
  `ultra-ego`, `grappler-protocol`, `ultra-instinct`, `the-dragon`,
  `the-contender`, `the-wall-crawler`, `demon-back`) and add `shoto.webp`.
- Carousel card: `aspectRatio: '2 / 3'`, `objectPosition: 'center top'`.
- The card prints the saga title in the bottom strip, above the subtitle:
  Orbitron 900 italic, uppercase, 26 px (20 px when the title is longer
  than 12 characters), gold gradient text with a dark drop shadow and a
  violet glow, class `saga-title`.
- `TITLED_POSTERS = { struggler-protocol, vigilante-protocol,
  blue-blur-protocol }` still have their old titled art, so they skip the
  printed title until their new banners land.
- Concepts may set `art.arcade` for their carousel banner (Ultra Ego →
  `/static/series/posters/ultra-ego.webp`, Shoto →
  `/static/series/posters/shoto.webp`).
- Run `npm run lock:assets` after replacing art.

## 6. Saga renames (copyright)

| id | Old | New |
|---|---|---|
| `one-punch-protocol` | One Punch Protocol | **One Hundred** |
| `demon-back-protocol` | Demon Back Protocol | **The Demon's Son** |
| `the-wall-crawler` | The Wall-Crawler | **Web Climber** |

Follow-ons: stage 6 `The Standard Hundred`, stage 10 `Final Boss — The
Hundred Gauntlet` (and their announcer lines), badges `One Hundred Badge`,
`Demon's Son Badge`, `Web Climber Badge`, campaign title `Hundred Legend`,
player chrome fallback `ONE HUNDRED`. **Ids do not change** (progress keys).

## 7. Strike Lab (private — do not link it anywhere)

`startCount` / `startRush` are now async and first `await ensureSensors()`:
enable motion if `motionState === 'off'`, enable the mic if
`micState === 'off'` (both inside the tap gesture), then resume the
AudioContext. Reason: both reset on reload and most field runs were
recorded blind.

## 8. Stability and observability

- **RunPlayer:** the `preloadXpBanners` effect moved below `const machine`
  — reading it above its declaration crashed every GPS start
  ("Cannot access 'machine' before initialization").
- **ESLint:** `no-use-before-define` as an error for variables
  (`functions:false, classes:false, variables:false, allowNamedExports:true`
  — match `eslint.config.js` exactly).
- **Plausible:** the owner's site-specific snippet
  (`pa-7d3Zk5sxJ2vgZHF_-M1j2.js` + its inline `plausible.init` stub),
  injected by `copy-public-assets.mjs` and mirrored in `app/+html.tsx`. The
  boot-time `js_error` reporter stands down once the app sets
  `window.__tmAppErrors = true` in `installErrorReporting()`.
- **Smoke test:** `npm run smoke:web` mounts every mode of the production
  bundle in headless Chrome (`playwright-core`, `CHROME_PATH` env) and fails
  on the runtime-error screen or any uncaught error. It covers the concept
  pop-up and page, a concept Fit day, a concept Fight day and a gauntlet
  stage start (`.saga-slide` with opacity 1 → `.ladder-node` →
  `BOTH` → `ENTER STAGE`). Added to `check:all` and CI.
- `check:all` gains `test:concepts` and `smoke:web`.

---

## Acceptance

1. `npm run check:all` passes (concepts: 92 checks; smoke: every screen).
2. With owner preview on: Home shows the Shoto pop-up once; START opens the
   concept page; FIT starts the Fit player titled `SHOTO · …` with no
   REGENERATE; FIGHT starts Fight Focus and the last bag round ends with
   `Super! <name>!` and its combo calls.
3. Training Arcade: Shoto is the first card, printed title `SHOTO`. Tap →
   the original ladder. Tap stage 1 → the side pop-up shows CHOOSE YOUR
   PATH (FIT / FIGHT / BOTH), no difficulty. ENTER STAGE starts the round
   timer. Clearing it in two paths shows ★★ on the ladder.
4. Every carousel card except Struggler, Vigilante and Blue Blur shows a
   printed gold title over titleless art; the renamed sagas read ONE
   HUNDRED, THE DEMON'S SON, WEB CLIMBER.
5. A GPS run starts without the error screen.
