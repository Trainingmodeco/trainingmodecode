# 15 · TRAINING ARCADE — THE STRUGGLER: BLACK SWORDSMAN PROTOCOL (Berserk, build prompts)

Third data-driven campaign, content in
`protocol-src/data/campaigns/ARC_BERSERK/`. Wiring is the SAME shared engine
as Ultra Ego (spec 13) — if those five prompts are built, this campaign
needs only Prompt 1 (register). Prompts 2-4 cover what is UNIQUE to Berserk:
weapon-swing modality, the no-taper Eclipse block with hard safety caps, and
the controlled-fury boss. Content is grounded in the deep-research report
(saved at `protocol-src/research/berserk-research-report.md`).

--- PROMPT 1: Register the campaign ---

Load `campaigns/ARC_BERSERK/{campaign,stages,modules}.json` into the
campaign registry. Renders through the spec-13 screens: landing (name "THE
STRUGGLER — BLACK SWORDSMAN PROTOCOL", tagline "The bigger the sword, the
stronger you grow.", core rule chip «Fury without control consumes you.»),
12-node stage map, stage selection (path / format / dual difficulty /
equipment / live preview), skill-first split runner, boss, achievements,
independent fit/fight failure logic. Difficulty labels: EASY "BRANDED" ·
NORMAL "BLACK SWORDSMAN" · HARD "BERSERKER". Persona labels per stage come
from stage.persona (Young Guts → Casca → Griffith → Adult Guts → Zodd →
The Eclipse → Beast of Darkness). New equipment icons: 🔨 Sledgehammer,
⚒ Steel Mace, 🎒 Sandbag.

--- PROMPT 2: Weapon-swing fight modality ---

Berserk fight modules are two-handed weapon-swing work, not clean striking.
Render fight rounds the same way (ring timer + per-round GOAL), but:
- Every implement has a no-equipment shadow/band substitute shown as the
  active chip when the user lacks the gear (e.g. "SLEDGEHAMMER → SHADOW
  GREATSWORD SWINGS"). The swing PATTERN is what matters — progressive
  overload + specificity are the campaign's stated mechanics.
- The strike counter counts swings; form matters more than count (see the
  core rule in Prompt 4), so swing volume never earns bonus XP on its own.
- Sledgehammer rounds = overhead tire strikes; steel-mace rounds = 360s /
  10-to-2 pendulum. Show the implement mechanic hint from the module notes.

--- PROMPT 3: The Eclipse block (stages 9-11) — NO TAPER, HARD SAFETY CAPS ---

This campaign does NOT taper. Stages 9-11 (The Eclipse) escalate straight
into the boss and are the hardest block — so they are hard-capped for
safety. Grounded in a 2024 systematic review linking CrossFit-style HIFT to
exertional rhabdomyolysis (63 cases, CK up to 232,579 U/L, predominantly
upper-body/arms, affecting beginners too). Implement `campaign.eclipse_safety`:
- ENHANCED READINESS GATE before every Eclipse stage (9-12): the normal
  readiness sheet PLUS three questions — training in heat/humidity today?
  recent viral illness? hydrated and fed? Bad answers push toward Easy /
  rest, never shame. (stage.readiness_checks already lists heat /
  recent_illness / hydration for these stages.)
- PREDETERMINED TARGETS ONLY: rounds/circuits flagged "target_capped": true
  and modules flagged "volume_capped": true must show a fixed target
  ("hit the target, then STOP") and must NOT offer an AMRAP / "max until
  collapse" mode.
- ARM-VOLUME CAP: no unbounded high-rep push-up/pull-up circuits (arms are
  the top rhabdo site). Rotate load across muscle groups.
- REST FLOORS: enforce the module rest_sec as a floor even on Hard; stage
  11 sets "extended_rest_floor": true (75s).
- PROGRESSION LIMIT: an Eclipse stage cannot be attempted on Hard until the
  prior Eclipse stage was cleared with zero safety flags.
- STOP CRITERIA (always visible during Eclipse/boss sessions, from
  campaign.eclipse_safety.user_facing_stop_criteria): severe/unusual muscle
  pain · muscle swelling · dark cola-colored urine · nausea/dizziness. Any
  one halts the session, shows a plain-language rhabdomyolysis caution
  ("this can be serious — stop and seek medical advice if it persists"), and
  applies NO XP penalty. These also extend the global safety_stop list.

--- PROMPT 4: Berserk Armor boss — controlled fury (form gate) ---

Stage 12 is a controlled-fury test, not a max-output grind:
- 12 rounds, each with its objective from campaign.final_boss.round_objectives
  (e.g. "ROUND 8 · THE BEAST STIRS — RESIST THE URGE TO FLAIL, KEEP FORM").
  Timing from final_boss.timing[difficulty] (Easy 12×1:00/45s ~20min ·
  Normal 12×2:00/30s ~30min · Hard 12×3:00/30s ~42min).
- FORM GATE (the core mechanic): each round tracks technique-breakdown
  flags. Output is rewarded ONLY while form holds; exceeding the round's
  breakdown limit = "the Beast takes over" = that round fails. Winning =
  maximal output WITHOUT losing control. Surface this as a live "CONTROL"
  meter that drains on breakdown and fails the round at empty.
- Eclipse safety caps still apply (capped survival round, stop criteria).
- Outcome: FINAL BOSS CLEAR with no form-breakdown fail → victory screen +
  "CONTROLLED FURY" achievement; the cooldown readiness report includes the
  rhabdo stop-criteria reminder.

--- SOURCING NOTE (do not present as canon) ---

Per the research: two claims were refuted and must NOT be shown as sourced
Berserk canon — the 400 lb "Dragon Slayer" strength benchmark, and Guts
using the HEMA Ox guard. The ZODD "strength benchmark" stage and the BEAST
OF DARKNESS / BERSERK ARMOR finale are the campaign's OWN thematic
invention. Casca's guard-transition work and Griffith's rapier
thrust/lunge/point-control ARE grounded (HEMA-instructor analysis), as is
the Adult-Guts strongman club/mace/carry content (The Bioneer) and all
Eclipse safety guidance (peer-reviewed reviews).

--- END ---
