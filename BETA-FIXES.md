# Beta Report — Checklist (from Usama's QA report, Aug 2026)

47 findings · 0 critical open · 6 blocking the wave. Ordered easy → hard
within each section. Check items off as they ship; close each by its ID.

---

## ✅ KEEP — what the tester praised (protect during the fix cycle)

- [ ] **Training Camp ladder** — "strongest screen in the product"; a 12-week
  commitment legible in two seconds. Don't let layout fixes touch it blind.
- [ ] **Health screening** — non-punitive PAR-Q routing (yes → Easy, still
  earns XP). "Unusual care." Keep exactly this tone.
- [ ] **Fight Focus timer** — "a complete screen with nothing surplus."
- [ ] **COUNT FOR ME / ON MY OWN split** (OP-1) — "respects a genuine
  difference in how people train."
- [ ] **End Mission copy** — "Only completed exercises will count toward your
  stats" is the benchmark ALL app copy should follow.
- [ ] Confirmed fixed: persistence (TM-01), scare warning (TM-02),
  height/weight onboarding (TM-08), Progress empty state (TM-21).

---

## 🚦 STEP 0 — check the deploy before fixing anything

- [ ] **Verify what apptrainingmode.com serves.** `public/privacy.html`
  (ND-03) and the PWA manifest (TM-20) already exist in this repo's build —
  the tester saw neither. If that domain deploys from the wrong branch or a
  stale build, several "open" findings close with a deploy, not development.

## 🔴 EASY FIXES (minutes each)

- [ ] **ND-03** Privacy page blank → likely just the deploy (Step 0); else publish it.
- [ ] **ND-05 (part)** "1 sessions" grammar → pluralise.
- [ ] **TM-19** Stray "x" glyph before TODAY'S BOUT (also in coach-mark title).
- [ ] **ND-13** Height shows "5.10" → format as 5'10".
- [ ] **TM-15** "REST · t00" glyph/format bug in Fight Focus up-next chip.
- [ ] **ND-10** Rep counter shows an icon glyph instead of 0 at start.
- [ ] **TM-13** Hide "Video guide coming soon" until the video exists.
- [ ] **TM-26** Remove legacy shrink-to-fit viewport flag.
- [ ] **TM-22/23** Open Graph + Twitter Card tags, real title + meta
  description (~2h; directly affects tester enrolment links).
- [ ] **TM-09 (copy half)** Rename floating pill "F5 Builder" → "Build a
  workout" (or remove; full placement fix below).
- [ ] **Copy sweep** ("internal vocabulary"): "Clear L3 first" → "Complete
  Level 3 to unlock"; audit every string that names a system state instead of
  a consequence.

## 🟠 MEDIUM FIXES (hours each)

- [ ] **RS-02** Full-width START bar → `FitBuilderWorkout.jsx:491` is
  `position: fixed; left:0; right:0` anchored to the VIEWPORT; give every
  fixed bar the tab bar's `maxWidth:440; margin:auto` treatment. **Fix as one
  family with TM-03 (mobile Home clipping), RS-03 (modal scrim/clipping),
  AN-02 (landscape clipping)** — the report calls it "one bug with four faces."
- [ ] **ND-04** Anti-cheat copy on ordinary early exit → one verdict source;
  early exit says "Mission ended early — finish a full round to earn XP";
  never show integrity language and "incomplete" together.
- [ ] **ND-05** Reconcile the three contradicting counters on the mission
  summary (0 exercises vs 1/2 rounds vs 15/500 XP) — one authoritative
  counter, others derived. Completed exercises count on abandon (the End
  dialog already promises this).
- [ ] **TM-05** Feedback → persistent global affordance, auto-attach route,
  timestamp, viewport width, user agent.
- [ ] **TM-07** Age/Weight fields open alphabetic keyboard → `inputMode="numeric"`.
- [ ] **TM-11** Splash "TAP ANYWHERE" not keyboard-focusable (WCAG 2.1.1).
- [ ] **TM-16** Back affordance inconsistent (label vs chevron vs absent) → one pattern.
- [ ] **ND-08/ND-09/ND-12** Loading skeletons for PREPARING… and muscle
  diagrams; accessible names on icon-only timer controls.
- [ ] **TM-12** Duplicated instruction copy on Exercise screen.
- [ ] **TM-14** Count-for-me counter skipping a value; cadence slider needs units.
- [ ] **AN-03** Cut coach-mark tour from ~15 steps to 3–4.
- [ ] **TM-06** Stage timer runs while still choosing a mode → start on choice.
- [ ] **ND-11** Age renders blank when entered (optional-skip em-dash is
  correct) → trace against the Height/Weight write path.
- [ ] **TM-20** PWA manifest missing on tested build → likely Step 0; verify
  install prompt after redeploy.

## 🟡 HARD / DECISIONS (days, or owner calls)

- [ ] **TM-04 + ND-07** Tester account gate: lightweight identification for
  beta only; finish the hanging Google sign-in. Guest mode returns at launch.
- [ ] **TM-10** One primary CTA on Home at 0 XP (six competing entry points today).
- [ ] **AN-02** Landscape: allow vertical scroll, or lock portrait and say so.
- [ ] **RS-01** Desktop position, deliberately: styled centred column with a
  real backdrop (cheap) OR a ~1024px two-column breakpoint (Camp ladder,
  muscle diagrams, Progress would benefit). Owner decision.
- [ ] **RS-03** Centre Save Routine modal, let it scroll, scrim above the CTA
  (largely falls out of the RS-02 container fix).
- [ ] **RS-04/RS-05 + TM-09 (placement half)** Anchor floating pill to the
  column; fix frame corners on short screens; decide the pill's future
  (tab bar vs fold into Train).
- [ ] **TM-17/TM-18** Contrast audit (WCAG AA); Orbitron/all-caps restricted
  to headings and labels, never body copy.
- [ ] **ND-06** Decide health-screening scope: PAR-Q gates Camp only today;
  Quick Mission / Builder / Fight Focus reachable without it. Owner + maybe
  legal call.
- [ ] **TM-24** Prerender/SSR fallback so a JS failure shows content, not a
  blank page (pre-launch, not wave).
- [ ] **AN-04** Legal review of anime-adjacent saga names (pre-launch).

## 📋 PROCESS SUGGESTIONS (adopt before recruiting)

- [ ] Two cohorts: 8–12 hand-picked after blockers clear → then 30–50.
- [ ] Exit criteria BEFORE the wave: ≥70% onboarding · ≥50% first workout ·
  ≥40% day-2 · ≥25% day-7 · ≥1 feedback per 3 testers · 0 criticals for Cohort 2.
- [ ] Instrument the 9 events (splash drop-off, per-step onboarding, first
  card chosen, early-exit reason, tour dismissal step, D2/D7 return,
  viewport at session start).
- [ ] Use their tester pack: recruitment message, 6-field device form,
  11-task UAT script (report §8), 5-question exit survey.
- [ ] Triage daily, ship weekly, close findings by ID — TM-13 was wrongly
  closed once because a rewrite was assumed to cover it.
