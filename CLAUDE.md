# Training Mode: notes for Claude

## The coach's voice (owner's standing rule, 2026-11-10)

Every line the coach says must play from recorded clips in **both** voices
(`public/voice/female`, `public/voice/male`). The phone speech engine is only a
fallback, and on the owner's phone it is silent.

So whenever new material lands (workouts, exercises, strikes, combos, MMA
moves, missions, camp or arcade content, new spoken lines in a screen):

1. Run `npm run voice:coverage` and `npm run -s test:spoken`. Coverage lists
   every phrase per feature that has no clip in a bank (`--json out.json`
   writes the list). `test:spoken` builds the lines that are made from data
   (a pace, a distance, a count, a pool of cues) with real value sweeps
   (`scripts/spoken-sweeps.mjs`) and plans each against the real banks: a
   line built in code never shows up as a typed-out literal, and that is how
   Cardio Mode once shipped with no clips while coverage read 100%. A new
   line built from data needs a sweep there, and a new screen that speaks is
   picked up by coverage on its own (it fails until the screen is listed).
2. Record the missing phrases with Higgsfield `seed_audio`, about 0.1 to 0.2
   credit a clip per voice (an "out of credits" answer in the middle of a
   batch has been a false alarm: check the balance and retry):
   - female: `medias: [{ value: 'ace2fa4f-5c6a-4739-9bc0-c91497d6f409', role: 'audio_references' }], speech_rate: 20`
   - male (Andre): `voice_id: 'f1e8226e-2248-4d5f-b43c-0a79e9949dbf', voice_type: 'preset'`
3. Clean and encode them like the rest of the bank: keep only the voiced
   part, drop stray breaths and clicks at the ends, cap pauses inside a
   phrase (0.1 s inside a strike name), gain to -16 LUFS, mono 24 kHz,
   64 kbps mp3. Add each to `manifest.json` with its `ms`.
4. Listen-check by numbers: a one-word strike over ~0.9 s, or two voiced
   parts with a gap, is a double take: record it again.
5. `npm run -s test:clips && npm run -s test:voice && npm run -s test:spoken`,
   then re-run coverage with `--strict`. `SPOKEN_ASSUME=<record.json>` on
   either tool treats a list of `{ key, text }` as recorded, to prove a
   record list is complete before spending credits.

How lines are matched: `data/voicePhrases.js` splits a line into sentences
and phrases (a combo into one phrase per strike), and `data/voiceClips.js`
plays each sentence from its one-take recording if the bank has it, else each
phrase from the take recorded for its place (mid-sentence or closing, below),
else from its plain clip, else from the fewest recorded pieces. Put names and
numbers in their own sentence or after a colon when writing a new spoken line
("Up next: Goblet Squats."), so they reuse existing clips.

Exercise names: the Workout Builder's guided player says an exercise of
`fit-mode/fitModeExerciseData*.js` by its name, and a generated Quick Mission
says the moves of its own pools in `fit-mode/quickMissionGenerator.js` (it
does not deal from the library) as "14 squats" or "30 seconds" of the move,
in the lead, next, switch and up-next lines of `data/missionMoves.js`.
`test:spoken` sweeps every active library name and every pool name through
those lines (`scripts/spoken-sweeps.mjs`), so a new library exercise or pool
move fails the test until its name is recorded as a plain clip in both voices
(`test:spoken --json` prints the key). The 66 names that had no clip were
recorded on 2026-11-14.

Recording plain names or phrases (no carrier sentence): the generator takes
about four requests every twenty seconds, and about one take in three comes
back unusable: said in two parts with a silence of 0.3 s or more in the middle
(the female voice most of all), or cut by the edge of the file. Order two or
three takes of each at once, cut each with
`node scripts/voice-takes/plain.mjs <take.wav> <out.mp3>` (the bank's own cut:
it reaches back to the true start of the word, drops a click on the file edge,
caps a pause inside at 0.10 s, sets -16 LUFS through the bank's limiter) and
choose by the numbers it prints: `groups` 1 after clicks, `headRoomMs` of 10
or more and `tailRoomMs` of 20 or more (the voice does not run into the edge
of the file), `longestPause` under 0.2, a length in line with the voice's
rate and with the other voice. A clip cut 20 ms before the first loud
frame, or gained without the limiter, sounds clipped at the start and quiet
next to the rest of the bank: that was the first cut of those 66.

## Natural-sounding lines (owner's rule, 2026-11-13)

A phrase recorded on its own comes out slow, with a full stop on it; stitched
together, such clips sound choppy (the owner's complaint about Cardio Mode).
So, for any line worth hearing often:

- **A sentence with a comma or colon inside is ONE recording** ("Drive the
  arms, the legs will follow."). Bank key: its phrases joined with `, `.
- **A phrase that carries a number is recorded inside a real sentence and cut
  out at the pause**, in the tone of its place: a mid-sentence take (key ends
  with a comma: `20 minutes,`) and a closing take (key ends with a full stop:
  `32 seconds.`). A label before a value is a mid take too (`pace,`).
- **Write the line so recordings meet only at a comma, a colon or a full
  stop.** A number stays with its unit ("3 miles", "40 seconds per mile") and
  a label ends with a colon ("Target time: 30 minutes."); never a number glued
  after other words ("ahead of target by 20 seconds").
- After a mid take the pause is 0.10 s at a comma and 0.15 s at a colon.
  Loudness is set per recorded sentence (-16 LUFS), not per piece.
- `test:spoken` holds every Cardio line to this (one take per sentence, or one
  clip per phrase); its exception list names the few values said from pieces.

To record them: write each carrier sentence with its numbers spelled out
("Pace: nine minutes, forty seconds per mile."), record it with the voices
above, and save one `{ "phrase": <carrier id>, "url": <wav> }` line per take
to `<work>/<queue>/jobs.jsonl`. **The generator charges by length, about 0.1
credit per second of audio**: keep carriers short, and check the balance
after the first hundred takes, before quoting or spending the rest. Then:

    VOICE_WORK=<work> node scripts/voice-takes/cutbank.mjs <batches> <femaleQueues> <maleQueues> --encode
    VOICE_WORK=<work> node scripts/voice-takes/place.mjs

`cutbank.mjs` (its header describes the carrier file) cuts each recording at
its pauses and listens by numbers: a real pause at each cut, length against
the voice's own rate, no break inside, a clean start and end. `need.json`
lists the keys to record again: expect about one in ten, more for the female
voice, which often runs "minutes, seconds" together. `place.mjs` installs the
chosen takes and bumps the bank version.
