# Voices

## The announcer (social videos)

The owner's call (2026-10-31): Fight Focus videos are called by an arcade
fight announcer, deep, booming and hyped, instead of the robotic placeholder.
It is our own voice in that spirit: never clone or imitate a real announcer,
voice actor or game's voice (CLAUDE.md rule 2).

Made on Higgsfield with Seed Audio (`seed_audio`), a preset voice and these
settings: `pitch_rate -3`, `loudness_rate 20`, `speech_rate 0`, `wav`, 48 kHz.
About 0.2 credits a line. `npm run voice` then trims the silences and adds an
arena echo.

Lines, in the announcer's words:

| Key | Line |
|---|---|
| `round-1` … `round-4` | "Round one! Short speed combos!" (the round's drill) |
| last round | "Final round! Nonstop windshield wipers!" (the screen shows FINAL ROUND) |
| `rush` | "Rush mode!" (plays with the RUSH screen, after the call if it runs long) |
| `clear` | "Stage clear!" (on the end card) |

### Auditions (2026-10-31): the owner picks one

Eight deep male presets read "Round one! Short speed combos!" with the settings
above, but slower (`speech_rate -10`), which made the lines 4–5 s: too long for
4–5 s rounds, so final lines use normal speed. They are in the owner's
Higgsfield history.

| Voice | Preset id | Line length |
|---|---|---|
| Gideon | `1ad38ba4-9cc4-4f2f-9fde-b0fefdf67ae5` | 4.9 s |
| Knox | `195e386a-cb61-5c1b-a53b-0e2f0669c408` | 4.9 s |
| Barrett | `d603a8cd-3fe1-55e0-9245-617a2589131e` | 4.0 s |
| Orion | `ed69c516-92d2-4b30-a967-617737a342e5` | 4.9 s |
| Marcus | `6f98d3dd-324f-4845-8c28-c1d1647a06cd` | 3.9 s |
| Bram | `549ff70a-3ee7-4f04-a4d9-89a24fab7709` | 5.0 s |
| Vlad | `e5666b9c-99a2-4fac-8b4e-abee078b186d` | 5.4 s |
| Sterling | `dc382508-c8bd-443c-8cb2-46e57b8d2e6f` | 4.9 s |

Picked: **Gideon** (2026-10-31), then replaced the same day by a designed
voice (below).

## The designed announcer (2026-10-31)

The owner wrote a voice brief and wants the announcer built from it. Seed
Audio can **design a voice from a description**: call `seed_audio` with no
`voice_id` and a prompt of `<description>\n\nDialogue:\n<lines>`
(1.4 credits a line). Every such call invents a new voice, so make **one**
signature take, then **clone it** for every other line: `medias:
[{ "value": "<that job id>", "role": "audio_references" }]` with the prompt
set to the line only (the clone reads the prompt verbatim; no description).
Clones came out slow (4.0 s for "Round one! Short speed combos!"), so the
final set uses `speech_rate` 20.

The brief (the owner's words, kept as the house style for this voice):
male, high-energy 1990s arcade fighting-game announcer; powerful mid-range
pitch; sharp, fast articulation; intense, commanding, electrifying,
explosive; slightly gritty and raspy with a bright, punchy tone; dramatic
emphasis and explosive attacks on key words (ROUND, STRIKES, POWER, RUSH,
GO); rhythmic fast cadence; shifts between authoritative round intros and
shouted combat commands; subtle metallic arcade reverb and a short slapback
(`npm run voice` adds the echo). Not robotic, not bass-heavy, not a movie
trailer. An original voice: never a clone or imitation of a real announcer.

The RUSH line, in the owner's words: "RUSH MODE... ACTIVATED!!! / GO ALL
OUT!!! / GO! GO! GOOOO!!!", RUSH MODE forceful, ACTIVATED like a system
unlocking with rising urgency, GO ALL OUT at maximum aggression, the three
GOs faster and louder, the last one stretched into a shout.

Takes of that line (in the owner's Higgsfield history; the owner picks):
A `090eb057` the brief as written (6.3 s) · B `3b5c0606` hoarser, full
shout (7.0 s) · C `f485b4c2` cleaner and brighter (6.0 s) · plus a cheap
comparison, Gideon with a style instruction on `qwen_audio_tts`
(`9fc0106e`, 5.3 s, 0.02 credits). Clone tests from A: "Round one! Short
speed combos!" `dbf8701a` (4.0 s), "Final round! Nonstop windshield
wipers!" `c3314da0` (4.8 s).

**Fitting the RUSH line:** at 6 s it is three times longer than the RUSH
window in the boxing-rounds video (RUSH fires ~2 s before the owner stops).
In that cut use only "RUSH MODE... ACTIVATED!!!" (clone it as its own
line); the full line fits once the owner's text-free clips let the last
round run its full 9 s.

## Making a post's lines

1. `generate_audio_batch`: one request per line, the picked preset
   (`voice_type: "preset"`), the settings above. Wait with `jobs_wait`.
2. Write the results to `raw-footage/voice/<post-id>/higgsfield.json` (not in
   git: the links carry the owner's account):
   `{ "voice": "Gideon", "lines": { "round-1": { "text": "...", "url": "<result_url>" }, ..., "rush": {...}, "clear": {...} } }`
3. `npm run voice -- <post-id>`, then `npm run render -- <post-id>`.

In a cloud session the downloads need Higgsfield's hosts allowed in the
environment's network settings: `cdn.higgsfield.ai`,
`d1xarpci4ikg0w.cloudfront.net` and `d8j0ntlcm91z4.cloudfront.net`. The
laptop needs nothing.

## The app's coach voice

The app itself speaks through the device's voice, female and British first
(voiceCoach.js). With no `higgsfield.json`, `npm run voice` uses that order
(Windows: Hazel, Susan, Sonia, Zira).
