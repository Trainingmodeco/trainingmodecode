# ARC_BAKI — "The Grappler" · full campaign review sheet

Generated from `protocol-src/data/campaigns/ARC_BAKI/{stages,modules}.json`.
12 stages · 24 modules (fit + fight per stage) · tier map T1 = S1–3, T2 = S4–6,
T3 = S7–9, T4 = S10–12.

**Stored numbers are the NORMAL baseline.** The app re-resolves easy/hard at
runtime from the volume ladder in `arcade-session-standards.json` by
tier + category, so `3x5` pull-ups on Stage 1 normal becomes a lighter easy set
and a heavier hard set automatically.

**Fight round totals:** 67 rounds — **44 generated** (carry a `combo_spec` with
`allowed_strikes`, so the Combo Coach generator writes the combos live) and
**23 cue-based** (grappling / stance / footwork rounds where numbered punch
combos don't apply; still fully voiced, just coached rather than combo-called).

Playtested and passed by the user: **Stage 1, Stage 2.**

---

## S01 · The Iron Core — *foundation · Young Baki* · T1

> Calisthenics base and the famous core. "Own your bodyweight — clean reps and
> a braced core on every one."

**FIT — Calisthenics Base + Iron Core** · 26 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Pull-ups (or band-assisted) | 3 × 5 | pull | 90s |
| Push-ups | 3 × 12 | push | 60s |
| Bodyweight squats | 3 × 20 | squat_legs | 60s |
| Hanging or lying leg raises | 3 × 20 | core | 45s |
| Hollow-body hold | 3 × 30s | hold | 45s |
| Plank and side plank | 3 × 30s | hold | 45s |

**FIGHT — First Strikes** · 20 min · 5 × 2min / 45s rest
| R | Goal | Combo seed |
|---|---|---|
| 1 | stance_and_guard | *cue-based* — stance + high guard |
| 2 | jab_cross | `1, 2` · intro |
| 3 | footwork | *cue-based* — advance/retreat/pivot |
| 4 | strike_reset_guard | `1, 2` · intro |
| 5 | relaxed_free_round | `1, 2, 3` · basic |

Finisher: tuck jumps + jumping lunges — 2 × 20s, end of session.

---

## S02 · Fight the Phantom — *foundation · Young Baki* · T1

> Bodyweight mastery plus the first phantom rounds. "See the opponent who isn't
> there — react, counter, and flow."

**FIT — Bodyweight Mastery** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Explosive push-ups | 3 × 12 | push | 60s |
| High-speed pull-ups (or negatives) | 3 × 5 | pull | 90s |
| Jump squats | 3 × 10 | explosive | 75s |
| Ab wheel or V-ups | 3 × 20 | core | 45s |
| Tuck-ups and hollow rocks | 3 × 20 | core | 45s |
| Hanging knee raises | 3 × 20 | core | 45s |

**FIGHT — The Phantom** · 22 min · 5 × 2min / 45s
| R | Goal | Combo seed |
|---|---|---|
| 1 | phantom_slow_counter | `1, 2, 3` · intro |
| 2 | phantom_read_and_slip | `1, 2` · basic |
| 3 | phantom_moderate_pace | `1, 2, 3, 2b` · basic |
| 4 | phantom_flow | `1, 2, 3, 4` · standard |
| 5 | phantom_beat_his_move | `1, 2, 3` · basic |

Finisher: burpees — 2 × 25s.

---

## S03 · Underground Arena — *development · Underground Arena* · T1

> Striking base — boxing power, the jab, explosiveness.

**FIT — Explosive Engine (HIIT)** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Box jumps or tuck jumps | 3 × 10 | explosive | 75s |
| Explosive push-ups | 3 × 12 | push | 60s |
| Sprint intervals or high knees | 3 × 30s | conditioning | 60s |
| Med-ball slams or bodyweight throws | 3 × 12 | explosive | 60s |
| Burpees | 3 × 10 | explosive | 60s |

**FIGHT — Underground Boxing** · 24 min · 5 × 2min / 45s · boxing
| R | Goal | Combo seed |
|---|---|---|
| 1 | jab_cross_power | `1, 2` · basic |
| 2 | hooks_body_shots | `3, 4, 3b, 2b` · standard |
| 3 | slip_and_counter | `1, 2, 3` · standard |
| 4 | combo_footwork_exit | `1, 2, 3, 4` · standard |
| 5 | phantom_explosive_burst | `1, 2, 3, 4, 2b, 3b` · burst |

Finisher: burpees + tuck jumps — 2 × 30s.

---

## S04 · One-Punch Power — *development · Katsumi Orochi (Karate)* · T2

> Karate straight-punch power. Safe bag conditioning + structure — never
> bare-knuckle boards.

**FIT — Power Base** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Med-ball chest/rotational throws | 3 × 12 | explosive | 75s |
| Explosive push-up variations | 4 × 20 | push | 60s |
| Jump squats | 3 × 12 | explosive | 75s |
| Hip-drive work (KB swings or bridges) | 4 × 20 | squat_legs | 60s |
| Core anti-rotation (Pallof) | 3 × 30s | core | 45s |
| Wrist and forearm strengthening | 2 × 15 | mobility | 45s |

**FIGHT — The Straight (Karate Power)** · 24 min · 5 × 2min / 60s
| R | Goal | Combo seed |
|---|---|---|
| 1 | karate_straight_structure | `2` · single |
| 2 | reverse_punch_power | `2` · intro |
| 3 | power_step_in | `2` · intro |
| 4 | single_perfect_strike_reset | `2` · single |
| 5 | phantom_one_punch_finish | `2` · single |

Finisher: jumping lunges — 3 × 20s.

> ⚠️ **FLAG 1 — five straight rounds of nothing but the cross.** Every round is
> `["2"]`, and three of them are `complexity: single`, which is *exempt* from
> the 60/40 variety rule you asked for. So Stage 4 is ~24 minutes of one punch.
> It is thematically correct (Katsumi = the one perfect straight) but it's the
> same monotony you flagged on the jab-cross rounds. Fix option below.

---

## S05 · The Sea King's Fist — *development · Retsu Kaioh (Kung Fu)* · T2

> Chinese kenpo — stances, forms, speed. Structure and flow over brute force.

**FIT — Stance Strength and Mobility** · 26 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Deep squat & horse-stance holds | 3 × 45s | hold | 45s |
| Cossack squats | 3 × 16 | squat_legs | 60s |
| Single-leg balance and control | 3 × 30s | hold | 30s |
| Hip mobility flow | 1 × 180s (uncounted) | mobility | — |
| Isometric wall sits | 3 × 45s | hold | 45s |
| Core rotation | 4 × 30 | core | 45s |

**FIGHT — Kenpo: Root and Strike** · 24 min · 5 × 2min / 45s
| R | Goal | Combo seed |
|---|---|---|
| 1 | stance_holds_and_root | *cue-based* |
| 2 | strike_from_root | `2` · intro |
| 3 | rapid_hand_combinations | `1, 2` · burst |
| 4 | stance_transition_footwork | *cue-based* |
| 5 | phantom_form_flow | `1, 2, 3` · standard |

Finisher: tuck jumps — 2 × 30s.

---

## S06 · Iron Grip — *hard_camp · Kaoru Hanayama* · T2

> Grip strength and clinch control — built safely.

**FIT — Iron Grip** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Dead hangs and towel hangs | 3 × 45s | hold | 60s |
| Plate pinches / grip-trainer crushes | 3 × 30s | hold | 60s |
| Farmer holds / suitcase carries | 3 × 40s | carry (weighted) | 60s |
| Thick-bar or towel pull-ups | 4 × 8 | pull | 90s |
| Wrist curls and reverse curls | 3 × 15 | mobility | 45s |
| Forearm and hand mobility | 1 × 120s (uncounted) | mobility | — |

**FIGHT — Grip and Clinch** · 24 min · 5 × 2min / 45s — **all 5 cue-based**
clinch entries · grip fight · pummel · off-balance drag · hold under fatigue.
Finisher: sprawls — 2 × 30s.

---

## S07 · Ground Flow — *hard_camp · Izou Motobe (Jiu-Jitsu)* · T3

> Solo grappling and submission flow.

**FIT — Grappler's Conditioning** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Bear crawls and crab walks | 3 × 40s | conditioning | 60s |
| Bridging and hip thrusts | 4 × 30 | squat_legs | 60s |
| Sprawls | 4 × 12 | explosive | 60s |
| Rotational core + gentle neck | 4 × 30 | core | 45s |
| Loaded carries | 3 × 40s | carry (weighted) | 60s |
| Mobility flow | 1 × 180s (uncounted) | mobility | — |

**FIGHT — Solo Grappling Flow** · 26 min · 5 × 2min / 45s — **all 5 cue-based**
shrimping · technical stand-up + sit-out · bridge & roll · guard retention ·
submission-chain shadow flow. Finisher: sprawls + mountain climbers — 2 × 30s.

> ⚠️ **FLAG 2 — S06 + S07 back-to-back = 10 consecutive fight rounds with zero
> striking.** Correct for a grappler campaign, but if someone runs FIGHT-only
> they get ~50 minutes across two stages with no combos called. Fix option below.

---

## S08 · Raw Power — *hard_camp · Jack Hanma* · T3

> Heavy compound strength — the real way, no PEDs. This is the weighted stage.

**FIT — Heavy Compound Strength** · 32 min · **all weighted → timed, adaptive rest**
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Squat pattern to a target | 4 × 7 | squat_legs (weighted) | 120s |
| Deadlift or hip-hinge to target | 4 × 6 | squat_legs (weighted) | 120s |
| Overhead or floor press | 4 × 8 | push (weighted) | 120s |
| Weighted / hard-progression pull-ups | 4 × 6 | pull (weighted) | 120s |
| Loaded carry | 3 × 40s | carry (weighted) | 90s |
| Core brace under load | 3 × 45s | core | 60s |

**FIGHT — Brute Force (Controlled)** · 24 min · 5 × 2min / 60s
| R | Goal | Combo seed |
|---|---|---|
| 1 | heavy_single_strikes | `2, 3` · single |
| 2 | power_combos_reset | `1, 2, 3, 4` · standard |
| 3 | overhand_body_rip | `oh, 3b, 2b` · basic |
| 4 | explosive_entry_stop | `1, 2` · intro |
| 5 | phantom_power_composed | `1, 2, 3, 4` · standard |

Finisher: burpees — 3 × 30s.

---

## S09 · The Primal Man — *peak · Pickle* · T3

**FIT — Primal Strength Circuit** · 30 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Sandbag/backpack clean and press | 4 × 8 | carry (weighted) | 90s |
| Bear crawls and variations | 4 × 40s | conditioning | 60s |
| Heavy carries | 3 × 40s | carry (weighted) | 90s |
| Explosive broad jumps | 4 × 12 | explosive | 75s |
| Full-body get-ups | 3 × 6 | carry | 60s |
| Crawl-carry-jump circuit to target (capped) | 3 × 60s | conditioning | 60s |

**FIGHT — Primal Combat** · 26 min · 5 × 2min / 60s
| R | Goal | Combo seed |
|---|---|---|
| 1 | raw_committed_strikes | `2, 3, 4` · basic |
| 2 | tackle_drive_entries | *cue-based* |
| 3 | ground_and_pound_motion | *cue-based* |
| 4 | explosive_scramble_up | *cue-based* |
| 5 | phantom_survival_controlled | `1, 2, 3, 4` · standard |

Finisher: jumping lunges + burpees — 3 × 30s.

---

## S10 · The Arena's Strongest — *peak* · T4

> Everything integrated. First stage at true peak volume.

**FIT — Integrated Athlete** · 30 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Pull-ups | 5 × 15 | pull | 90s |
| Dips | 4 × 15 | push | 60s |
| Pistol squats | 3 × 10 | squat_legs | 60s |
| Explosive/plyometric block | 4 × 15 | explosive | 75s |
| Grip and carry block | 3 × 40s | carry | 60s |
| Core circuit | 5 × 50 | core | 45s |
| Conditioning finisher to target (capped) | 1 × 120s | conditioning | — |

**FIGHT — All-Around: Every Tool** · 28 min · 5 × 2min / 45s
| R | Goal | Combo seed |
|---|---|---|
| 1 | boxing_combination | `1, 2, 3, 4, 2b, 3b` · standard |
| 2 | karate_kungfu_striking | `1, 2` · burst |
| 3 | clinch_and_grip | *cue-based* |
| 4 | ground_flow | *cue-based* |
| 5 | phantom_all_around | `1, 2, 3, 4` · standard |

Finisher: burpees + tuck jumps — 3 × 30s.

---

## S11 · The Strongest Teen — *peak* · T4

> Hardest stage before the boss. Capped for safety — targets, never AMRAP.

**FIT — Peak Athlete (Capped)** · 30 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| Hardest pull progression to target | 5 × 15 | pull | 90s |
| Hardest push progression to target | 5 × 40 | push | 60s |
| Explosive power block | 5 × 15 | explosive | 75s |
| Grip and full-body strength | 3 × 45s | carry | 60s |
| Core peak circuit | 5 × 50 | core | 45s |
| Capped conditioning finisher | 1 × 120s | conditioning | — |

**FIGHT — The Strongest: Peak Rounds** · 28 min · 5 × 2min / 60s
| R | Goal | Combo seed |
|---|---|---|
| 1 | all_around_capped | `1, 2, 3, 4, 2b, 3b` · standard |
| 2 | strike_grapple_rotation | `1, 2, 3` · basic |
| 3 | hold_form_under_fatigue | `1, 2, 3` · basic |
| 4 | phantom_peak_round | `1, 2, 3, 4` · standard |
| 5 | finish_to_target_in_control | `1, 2` · basic |

Finisher: burpees + jumping lunges — 3 × 30s (capped).

---

## S12 · The Ogre — *final_boss · Yujiro Hanma* · T4

> Twelve rounds cycling every skill, gated on form and composure.

**FIT — The Ogre: Fit Final Test** · 28 min
| Exercise | Sets × Reps | Category | Rest |
|---|---|---|---|
| High-rep pull-up target | 5 × 15 | pull | 90s |
| High-rep push-up target (capped) | 5 × 40 | push | 60s |
| Core hold for time | 4 × 90s | hold | 45s |
| Grip max-hold | 3 × 45s | hold | 60s |
| Explosive jump target | 4 × 15 | explosive | 75s |

**FIGHT — The Ogre: Father-Son Trial** · 32 min · 12 × 2min / 30s rest
| R | Goal | Combo seed |
|---|---|---|
| 1 | face_the_ogre_composure | *cue-based* |
| 2 | the_jab | `1` · intro |
| 3 | one_punch_power | `2` · single |
| 4 | kungfu_speed_combo | `1, 2` · burst |
| 5 | phantom_read_and_counter | `1, 2, 3` · basic |
| 6 | clinch_and_grip_control | *cue-based* |
| 7 | ground_flow_chain | *cue-based* |
| 8 | explosive_burst_capped | `1, 2, 3, 4` · burst |
| 9 | all_around_strike_into_grapple | `1, 2` · basic |
| 10 | mental_dominance_composure | *cue-based* |
| 11 | survival_round_capped | `1, 2, 3, 4` · standard |
| 12 | master_yourself_finish_in_control | `1, 2` · basic |

No separate finisher — explosive work folds into rounds 8 and 11.

---

# Verdict

The campaign is **structurally sound and ready to pass** — the volume ladder
climbs correctly T1 → T4, every FIT exercise carries counted sets × reps with a
category (so the pacing fix applies), the weighted stage (S08) is correctly the
only timed/adaptive-rest one, and finishers are capped and share the plyo budget.

Three things worth a decision before it's "perfect":

**FLAG 1 — Stage 4 is five rounds of one punch.** Every round is `["2"]` and
three are `complexity: single`, which the 60/40 variety rule deliberately
exempts. *Recommended fix:* keep R1 and R4 as pure `single` (that's the whole
point of the Katsumi stage — the one perfect straight), but open R2, R3, and R5
to `["1","2","2b"]` at `intro`/`basic` so the generator can set the straight up
instead of only repeating it.

**FLAG 2 — Stages 6 and 7 are 10 straight cue-based rounds with no combos.**
Honest for grip and ground work. *Recommended fix:* convert one round in each
(S06 R1 clinch entries, S07 R5 submission chain) into a mixed round that enters
with `["1","2","3"]` before the grappling cue, so a FIGHT-only player never goes
two full stages without a combo called.

**FLAG 3 — cosmetic.** FIGHT modules have no `tier` field (only FIT does).
Finishers scale off `difficulty_scaled` instead, so nothing is broken, but
adding `tier` to the 12 fight modules would make the two halves symmetrical.

Stages 1, 2, 3, 5, 8, 9, 10, 11, 12 need no changes.
