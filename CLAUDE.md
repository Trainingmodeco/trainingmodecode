# Training Mode: notes for Claude

## The coach's voice (owner's standing rule, 2026-11-10)

Every line the coach says must play from recorded clips in **both** voices
(`public/voice/female`, `public/voice/male`). The phone speech engine is only a
fallback, and on the owner's phone it is silent.

So whenever new material lands (workouts, exercises, strikes, combos, MMA
moves, missions, camp or arcade content, new spoken lines in a screen):

1. Run `npm run voice:coverage`. It lists every phrase per feature that has no
   clip in a bank (`--json out.json` writes the list).
2. Record the missing phrases with Higgsfield `seed_audio`, about 0.1 credit a
   clip per voice:
   - female: `medias: [{ value: 'ace2fa4f-5c6a-4739-9bc0-c91497d6f409', role: 'audio_references' }], speech_rate: 20`
   - male (Andre): `voice_id: 'f1e8226e-2248-4d5f-b43c-0a79e9949dbf', voice_type: 'preset'`
3. Clean and encode them like the rest of the bank: keep only the voiced
   part, drop stray breaths and clicks at the ends, cap pauses inside a
   phrase (0.1 s inside a strike name), gain to -16 LUFS, mono 24 kHz,
   64 kbps mp3. Add each to `manifest.json` with its `ms`.
4. Listen-check by numbers: a one-word strike over ~0.9 s, or two voiced
   parts with a gap, is a double take: record it again.
5. `npm run -s test:clips && npm run -s test:voice`, then re-run coverage.

How lines are matched: `data/voicePhrases.js` splits a line into phrases
(sentences; a combo into one phrase per strike), and `data/voiceClips.js`
plays each phrase from its whole clip, else from the fewest recorded pieces.
Put names and numbers in their own sentence or after a colon when writing a
new spoken line ("Up next: Goblet Squats."), so they reuse existing clips.
