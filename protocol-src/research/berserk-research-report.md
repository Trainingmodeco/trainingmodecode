# Berserk Campaign — Deep Research Report (verified)

Source for `campaigns/ARC_BERSERK`. Multi-source deep research, 103 agents,
25 claims adversarially verified (23 confirmed, 2 refuted). Raw output:
`berserk-research-raw.json`.

## Confirmed findings used in the campaign

**Guts / Adult Guts — strongman power-endurance** (The Bioneer, high conf.)
- Two named mechanics: **progressive overload** ("ever-larger sword") and
  **specificity** (train the actual swing pattern — club/mace/sword swings,
  not only gym lifts). These are the campaign's stated mechanics.
- Old-time-strongman profile: grip, core, rotational power. Kettlebell +
  club/steel-mace work in high rep ranges (between cardio and resistance);
  **loaded carries ~1 mile** (kettlebell/club), rest only when needed →
  "Carry the Great Sword" module (Stage 7).
- SuperheroJacked rep bands (medium conf.): Strength 5-8, Hypertrophy 10-12,
  Endurance 15-20 → used for difficulty rep-band scaling.

**Casca — precision / guard transitions** (Popverse, former HEMA instructor)
- Drawn using near-textbook German longsword guards (Fool's / Ox / Plow) and
  footwork → Stage 3 guard-transition + footwork content.

**Griffith — elegant fencing** (same HEMA source)
- Reads as early-Renaissance rapier: thrust-centric, lunges, point control,
  leverage over strength → Stages 4-5 en-garde / lunge / point-control.

**Sledgehammer vs steel mace** (Vahva Fitness, physics-corroborated)
- Sledgehammer = thin handle, two-handed overhead power swing on a tire,
  mimics chopping wood. Steel mace/club = thick handle, long lever; lever
  length makes difficulty adjustable (choke grip) and loads grip/forearms.
  → distinct modalities in Stages 6 (mace) and 7 (sledgehammer).

**Eclipse safety — exertional rhabdomyolysis** (2024 PRISMA review + 2021
Neuromuscular Disorders review, both primary/peer-reviewed, high conf.)
- HIFT/CrossFit-style training is linked to exertional rhabdomyolysis: 26
  studies, 63 cases, CK 7,816–232,579 U/L (normal ~200).
- Predominantly **upper-body/arms** (high-rep push-ups/pull-ups) → arm-
  volume cap.
- Affects **untrained beginners too**, not only elites → same guardrails for
  all users; novices may be at higher risk (no repeated-bout protection).
- Triggered by intense/repetitive/prolonged exercise; can progress to acute
  renal failure, arrhythmia, death.
- Screenable risk factors: heat/humidity, recent viral infection,
  drug/alcohol, genetic (sickle cell trait, McArdle) → enhanced readiness
  gate for Eclipse stages.
- Self-observable STOP signs: severe muscle pain, swelling, dark urine
  (CK needs bloodwork) → user-facing stop criteria.

## REFUTED — do NOT present as Berserk canon (0-3 votes)

1. Guts's Dragon Slayer weighs ~400 lb as a cited strength benchmark.
2. Guts characteristically uses the HEMA Ox guard.

→ The **Zodd** "strength benchmark" stage and the **Beast of Darkness /
Berserk Armor** finale are the campaign's OWN thematic invention, labeled as
such in `campaign.json.sourcing_note`. No researched source grounds the
Eclipse (God Hand/Apostle) or the finale — those mappings are design.

## Open questions (from the research, not blocking)

- No evidence-based exact volume caps for a consumer HIFT block; the reviews
  establish the hazard and stop criteria, not safe-dosing numbers. The
  campaign uses conservative predetermined targets + rest floors as a
  practical guardrail.
- A validated fencing/footwork at-home vocabulary beyond the single Popverse
  analysis would strengthen the Casca/Griffith stages.
- The review's screening is clinical/military; a scaled consumer-app version
  (how to handle self-reported sickle cell trait) is a product decision.
