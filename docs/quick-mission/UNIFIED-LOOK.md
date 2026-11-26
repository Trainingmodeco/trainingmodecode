# Quick Mission: one look (2026-11-25)

The owner's words: "Yes, please make it look unified. You keep the bolt in the
background, but make it very dim, as eventually I will be adding the GIFs for
the workouts." Earlier: the Quick Mission buttons "look really flat", the
cut-corner rectangles "look like they have a curve", and buttons should stand
out "similar to the yellow button and the red buttons in combat training".

GUIDED, AT YOUR PACE, the setup page, the library sheets and the end screens
now share one look: the AT YOUR PACE run screen's (docs/quick-mission/PACE-LOOK.md).
Only the look changed. The timing, the cadence, the coach voice and clips, the
saving, the stash and what each screen hands on are exactly as before.

## The one look, and where it lives

- **Raised buttons.** A rounded button with a gradient body, a light top edge,
  a darker lip under it and a soft glow; it presses down when tapped. The
  skins are in ONE place, `components/training-mode/shared/TrainingCTA.jsx`
  (`RAISED_SKINS` and `raisedShadow`): the AT YOUR PACE bar (PAUSE / STOP)
  uses them through TrainingCTA, everything else in Quick Mission through
  `shared/QmButtons.jsx`.
  - `gold`: the main action (START, DONE, REPEAT, NEW MISSION, RESUME). The
    loudest button on every screen.
  - `picked`: a chosen option (GEAR, GUIDED / AT YOUR PACE, LEVEL, FOCUS, the
    library's filters, an open +): a brighter violet body with a gold hairline.
  - `slate`: an option not chosen, and the quiet buttons (SHUFFLE, CHOOSE,
    SURPRISE, MISSION LIBRARY, PUT ON CARD, NEW CHALLENGE, restart and skip):
    deep slate-violet, raised.
  - `violet`: PAUSE. `red`: STOP, END MISSION, I PUT IT DOWN. `teal`: the
    small DONE of a manual move (SKIP WARM-UP's colour).
  - No cut corners anywhere in Quick Mission.
- **`shared/QmButtons.jsx`** holds Quick Mission's pieces built on those
  skins: `QmGold` and `QmGhost` (in place of the kit's GoldButton and
  GhostButton), `QmSegRow`, `QmChipGroup`, and the style helpers `qmRaised`,
  `qmSeg`, `qmStrip`, `qmChip`. They are used ONLY from Quick Mission's files.
  `shared/FitSetupKit.jsx` is untouched, so Workout Builder, Combat
  Conditioning, Fit Mode and the rest look exactly as they did (photos compared
  pixel by pixel: the only differences are the glows that animate).
  `shared/MissionComplete.jsx` takes a new `raised` switch, which only Quick
  Mission's end screen turns on; every other end screen is as before.
- **The ring** is `shared/RunRing.jsx` everywhere in Quick Mission: a faint
  track, a glowing arc, the time large in the middle, one word under it, and
  the lightning bolt behind the arc, at its original strength (0.3).
- **The Training Mode T**, large and glowing behind the page:
  `RunWatermark` in `shared/RunBar.jsx`.

## What changed, screen by screen

- **GUIDED run** (`QuickMissionActive.jsx`), every phase:
  - PREPARING...: the shared ring with PREPARING... and its line in it;
    AT YOUR PACE INSTEAD stays under it.
  - Work: a timed move shows the time in the ring; a counted move with the
    cadence shows the rep number, and the arc fills as the reps go by
    (REP 5 / 10 under it); a move you tap DONE on shows its reps.
  - MAX REPS: MAX in a full gold ring; DONE is the raised gold button.
  - Rest: the blue ring, UP NEXT and the next move big.
  - Paused: the arc dims and the pause button turns to RESUME, gold and glowing.
  - The move in hand is big and white (22 to 28 px, at least 20), with
    "UP NEXT:" and the next move (20 px) under it. Labels are no longer in the
    tiny pixel font.
  - Controls: restart and skip raised slate, PAUSE raised violet (RESUME gold),
    STOP raised red, all 56 px or more. The END MISSION? box's buttons are
    raised too.
  - The title lines use the same lettering as AT YOUR PACE. The old ring
    picture behind the page is gone; the T is there instead.
  - Short phones (360x640, 320x568): a smaller ring and a tighter card, so the
    controls stay above the tab bar without scrolling. MAX REPS on a 320x568
    phone gets an even smaller ring and tighter rows (the stop line and the
    safety card stay), so PAUSE and STOP clear the shelf mid-set; before this
    job they sat half under it.
- **AT YOUR PACE**: only the bolt, now about a tenth as strong.
- **Setup page and Fit card** (`QuickMissionSetup.jsx`, `fit-challenge/ui/WorkoutCard.jsx`,
  `fit-challenge/FitCardSetup.jsx`): GEAR and GUIDED / AT YOUR PACE are raised
  segments (picked: violet with a gold hairline; START keeps the only gold);
  SHUFFLE, CHOOSE, SURPRISE and MISSION LIBRARY are raised slate; START is
  raised gold; the ROUNDS − / + buttons are raised slate (also on the CHECK-OFF
  run's round picker, `fit-challenge/FitCheckOffSolo.jsx`). On a 360x640 phone
  the closed card shows its first move only (SEE ALL shows them all) and START
  is 4 px shorter; with AT YOUR PACE picked (the CHECK-OFF row) or a notice
  line showing ("Shuffled: ..."), the closed card lists no move at that size,
  so START stays clear of the shelf's fade. The ▾ SEE ALL line is a quiet
  show-more link, not a button, and stays as it was.
  `WorkoutCard` takes a `raised` prop that only the Quick Mission Fit card
  turns on: the Fit Mode PROGRAMS day card uses the same card and keeps its
  flat look (SHUFFLE THIS DAY, RESUME), as do the looks gallery's copies.
- **ADJUST sheet** (`QuickMissionAdjustSheet.jsx`): LEVEL, run mode and FOCUS
  raised; DONE raised gold.
- **MISSION LIBRARY** (`MissionLibrarySheet.jsx`) and **CHOOSE**
  (`fit-challenge/ui/ChooseSheet.jsx`): filter chips raised, the + that drops a
  workout down raised (`shared/WorkoutDrop.jsx`), PUT ON CARD raised slate,
  START raised gold, SURPRISE ME raised slate.
- **End screens**: the classic Quick Mission's (`QuickMissionComplete.jsx`):
  NEW MISSION gold, BACK TO FIT MODE and RETURN HOME raised slate. The Fit
  card's (`fit-challenge/ui/ChallengeResults.jsx`): REPEAT gold, NEW CHALLENGE
  and SAVE WORKOUT raised slate (a touch shorter, so the screen is no taller).
  The near-miss panel (`retention/ui/NearMissPanel.jsx`: RETRY gold, COME BACK
  FRESH TOMORROW raised slate) takes a `raised` prop that only Quick Mission's
  end screen turns on (through `shared/MissionComplete.jsx`); the other modes
  keep the flat panel. The library's filter chips keep a space before their
  count ("ALL 53").

## Where an exercise GIF would go

In the GUIDED run, the exercise card (`data-guide="qma-exercisecard"`): a
square picture about 96 to 120 px, above the move's name, centred, with the
ring kept as the clock. On AT YOUR PACE, the move in hand beside the ring
(`[data-run-now]`) has the room: a picture about 72 to 96 px above its name,
or the ring's own middle on GET READY. The bolt behind the ring is soft; if a picture laid over it fights the bolt, lower BOLT_OPACITY (see below). On short phones the card is
tight, so the picture there should be the smaller size (about 72 px).

## The charged bolt (2026-11-26)

While the work is on (the ring is gold, or red in the last minute) the bolt in
`shared/RunRing.jsx` is charged: it pulses, three sets of jagged electric arcs
take turns around it (a crackle), and six sparks twinkle at its tips. On a rest
(blue) the bolt settles to `BOLT_REST_OPACITY` (0.12) and the arcs stop; paused
and GET READY are as before. With reduced motion the arcs stand still. It is
CSS animation only (no timers, no extra renders). The same ring draws it in the
guided run and in AT YOUR PACE.

## Tuning the bolt

`BOLT_OPACITY` at the top of `components/training-mode/shared/RunRing.jsx`:
0 hides the bolt, 1 is full strength. It is 0.3 (the owner tried 0.03 on 2026-11-25 and asked for 0.3 back on 2026-11-26). Paused,
the bolt is about half of that. Change the one number; nothing else needs to
change.

## Proof

`scripts/fit-card-preview.mjs` has new states: `guided-intro`,
`guided-paused`, `guided-rest`, `guided-maxreps` (and `guided`), which check
that the ring is the shared one, the move names are 20 px or more, and the four
controls are raised, 44 px or more, above the tab bar and not covered;
`card-solo`, `adjust`, `end-failed`, `end-card-failed` (and `results`, the
complete one). Every state passes at 360x640, 360x780, 390x844 and 430x932;
GUIDED's work, rest, paused, PREPARING and MAX REPS screens also at 320x568.
The script's tap now falls back to a direct click when a row sits under a fade
(the library row on a 320x568 phone), and its START check now also fails when
START runs under the shelf's fade (the BETA pill's row), not only under the
tab bar. On a 320x568 phone the setup page scrolls to START, as it did before
this job.
