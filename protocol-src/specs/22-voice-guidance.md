# 22 · VOICE GUIDANCE — FULLY AUDIO-GUIDED TIMER (all campaigns)

A shared, cross-campaign contract: **the workout timer speaks the workout aloud
so the user never has to read the screen.** Every campaign carries a
`voice_guidance` block in its `campaign.json`; this spec defines what that block
means and how the timer must behave. It applies to ALL campaigns (Training Camp,
Training Arcade, and every future one) and every path (FIT / FIGHT / BOTH).

--- WHY ---

Users train with the phone across the room, on a bag, mid-sprint, or with sweat
in their eyes. Reading the screen breaks the workout. The timer must be usable
eyes-free: if voice guidance is on, a user can complete any stage without ever
looking at the screen.

--- THE `voice_guidance` BLOCK (in every campaign.json) ---

```
"voice_guidance": {
  "enabled": true,
  "no_read_required": true,        // hard requirement: eyes-free completion
  "engine": "tts",
  "policy": "...",                  // human-readable summary of what is spoken
  "announce": { ...flags... },      // which spoken events are on
  "source_fields": "...",           // where the spoken lines come from
  "settings": { user_toggle, duck_background_music, language, voice_pack_default }
}
```

--- WHAT THE TIMER SPEAKS (the `announce` flags) ---

The timer generates spoken audio for each enabled event — no reading required:

- `stage_intro` — on start: stage name + what's coming ("Stage 3, Legs Drive the
  Punch. Explosive legs and sprints. Warm up first.").
- `next_up` — before each movement: "Next up: broad jumps."
- `exercise_name` — announces each movement BY NAME as it begins.
- `exercise_cue` — a short form/coach cue per movement (from the module's
  coach_note / exercise text): "soft landings, reset each rep."
- `combination_callouts` (FIGHT) — calls striking combinations aloud in rhythm:
  "jab, cross, hook — go." Voice drives the combo so the user never reads it.
- `round_start` / `round_end` — "Round 2, begin." / "Rest."
- `countdown_into_work` / `countdown_into_rest` — spoken "3, 2, 1" into each work
  and rest block.
- `rep_or_time_count` — counts reps or elapsed/remaining time as configured (ties
  into Gravity's `voice_count_mode` where present — see integration below).
- `halfway_call` — "Halfway."
- `final_10s_call` — counts down the last 10 seconds of a work block.
- `safety_cue` — speaks the module's key safety cue at the right moment ("breathe,
  don't hold" / "wrap your wrists" / "land soft").
- `completion_call` — "Stage complete. Nice work."

--- WHERE THE SPOKEN LINES COME FROM (`source_fields`) ---

The timer builds its script from EXISTING module data — no separate voice script
needs to be authored per module:
- `module.title` → stage/segment intro
- `module.exercises[]` / `module.drills[]` → movement names + cues
- `module.coach_note` → the per-module cue and safety line
- `module.rounds[].goal` / `length_sec` / `rest_sec` → round/rest structure and timing
- `campaign.safety_scaffolding` → the safety cues
- FIGHT modules: combinations embedded in `exercises[]` (e.g. "Jab–cross–hook")
  are spoken as combo callouts.

This means adding a campaign = adding data; voice guidance comes for free.

--- INTEGRATION WITH EXISTING PER-CAMPAIGN VOICE MECHANICS ---

- **Gravity Chamber** already has `voice_count_mode` (none | reps | cadence) and
  a tempo cadence ("down 1..2..3.. hold.. up 1..2..3"). That is the
  `rep_or_time_count` channel for that campaign — voice_guidance wraps it, it is
  not replaced.
- **Sonic / Garou** use a mandatory warm-up; `stage_intro` + `safety_cue`
  announce and gate it aloud.
- Where a campaign defines its own cadence/count, voice_guidance defers to it for
  counting and layers the rest (intro, next-up, rounds, safety, completion).

--- SETTINGS ---

- `user_toggle` — the user can turn voice guidance off (defaults ON).
- `duck_background_music` — lower the user's music under each spoken cue, restore
  after (ties into the existing audio-mix ducking work).
- `language` — default "en"; structured so other languages can be added.
- `voice_pack_default` — the default coach voice; per-campaign packs may swap it
  (e.g. a distinct voice per series) without changing the contract.

--- BUILD NOTE ---

The `voice_guidance` block is DATA + CONTRACT for the app/engine team: the timer
component reads it and drives TTS accordingly. It is identical across campaigns
(campaign-specific flavor lives in the voice pack, not the contract), so the
behavior is consistent everywhere and every future campaign inherits it by
including the same block.

--- END ---
