# Quick Mission button looks

**PICKED (owner, 2026-11-25): LOOK 2, RAISED · ROUNDED.** It is now built into
the app: `FitSetupKit.jsx` appends `css(round look, 'html:not([data-bl="now"]) ')`
to `fitKitCSS`, so the kit's buttons (GhostButton, SegRow, GearRow, RunModeSwitch,
ChipGroup, the library's +, the MISSION LIBRARY and ADJUST rows, SURPRISE) are
raised and rounded. Left in the OLD style at the owner's word (2026-11-25): the
library's LOADOUT / THEME filter chips and the end screen's BACK TO FIT MODE and
RETURN HOME. It reaches every screen that draws the kit (Build Workout and
Cardio too). `/button-looks` keeps all looks for comparison:
`?look=now` switches the pick off (the old buttons), `?look=applied` is the app
as it is. Below is the original brief.

The owner finds Quick Mission's cut-corner dark buttons flat ("they don't stand
out") and wants the depth of the yellow START and the red combat buttons.
When the looks were drawn up nothing in the app was changed; the pick above is
the only change to `FitSetupKit.jsx`. `RunBar.jsx` and `QuickMissionSolo.jsx`
are untouched.

## See them

Hidden page `/button-looks` (noindex, not linked), like `/score-looks`.
`?look=<now|raised|round|neon|full>&panel=<setup|library|end|kit>` draws the
real Quick Mission screen with sample data in that look; no params lists them.

`npm run preview:button-looks -- <out-dir>` photographs every look and panel at
360x780 and 390x844 (scale 2) and builds one comparison sheet per panel and
size (`sheet-<panel>-<width>.png`: NOW and LOOKS 1 to 3 side by side). It fails
on sideways overflow, a look's target under 44 px, a label under 4.5:1, or a
look that styled nothing. Needs the dev server (`CI=1 npx expo start --web
--port 8081`; restart with `--clear` after an edit) and ImageMagick.

Panels: (a) setup (GUIDED / AT YOUR PACE, START + SURPRISE, GEAR, MISSION
LIBRARY row), (b) the library sheet (filter chips picked and unpicked, a row
with its + closed and one open, PUT ON CARD + START), (c) the end screen
(BACK TO FIT MODE, RETURN HOME), (d) every kind side by side, including the red
danger button, which no Quick Mission screen has yet.

## The three looks

1. **RAISED, cut corners**: the kit's cut corners kept. Gradient body, light top
   edge, a darker 3 px lip, soft glow. Unpicked: deep slate-violet. Picked:
   brighter violet with a gold hairline. Quiet (PUT ON CARD, SURPRISE, RETURN
   HOME): gold-edged raised dark. Danger: the red skin.
2. **RAISED, rounded**: the same depth and colours on rounded corners (Home START).
3. **NEON COLOUR** (neon frame and full colour merged): the neon frame, the
   TrainingCTA corner ticks (big buttons) and glow, on full-colour bodies.
   Unpicked: raised dark glass in a violet frame. Picked: gold like START
   (flatter, small glow, so START keeps the big one and stays the loudest).
   PUT ON CARD, SURPRISE and BACK TO FIT MODE: filled violet. Danger: filled red.
   RETURN HOME: dark glass in a gold frame.

Gold START (`GoldButton`) and the end screen's NEW MISSION are not touched by
any look.

## Where each style lives

`components/training-mode/button-looks/looks.js`: one object per look (`LOOKS`)
with its colours per role (`off`, `on`, `ghost`, `second`, `end2`, `home`,
`danger`: body stops, lip, edge, glow, text; for neon the frame, fill or glass, and ticks) and
its shape (`cut`, `round`, `neon`), plus `css(look)`, which turns a look into
rules scoped to `html[data-bl="<id>"]`. `ButtonLooks.jsx` sets that attribute
and draws the panels from the real components.

Roles: `off`/`on` = SegRow, GearRow, RunModeSwitch, ChipGroup, the library's
filter chips, and the + (open = on); `ghost` = GhostButton and SURPRISE;
`second` = the MISSION LIBRARY and ADJUST rows; `end2` = BACK TO FIT MODE;
`home` = RETURN HOME.

How it survives `clip-path` (which also clips box-shadow and borders): the
button's own clip-path, background, border and shadow are switched off. Its
`::before` is the lip (same cut shape, 3 px lower), its `::after` the body
(gradient, inset highlight and hairline, which stay inside the cut), and the
glow is `filter: drop-shadow` on the button itself, which nothing clips. Neon:
`::before` is the frame, `::after` the glass 1.5 px inside it, its cut
shortened to stay parallel. Chips are drawn 36 px tall inside a 44 px hit area
(negative margins), so layout does not move. A segmented strip loses its single
cut-corner container: each segment is its own button with a 6 px gap.

## Applying a pick

The page restyles through classes the buttons already carry (`fk-seg`,
`fk-chip`, `fk-ghost`, `qm-lib`, `fk-end2`, `fk-home`). To make another pick real
(done for LOOK 2, as above):

1. In `FitSetupKit.jsx`, move the pick's `roles` in and add its rules to
   `fitKitCSS` (copy `css(look)` with the `html[data-bl]` prefix dropped, about
   25 lines for one look). `GhostButton`, `SegRow`, `ChipGroup` and `GearRow`
   already carry the classes; drop their inline `chf`, background and border.
2. Give `MissionComplete`'s secondary and ghost buttons the `fk-ghost` class,
   and `DropButton`, `FilterChip` and the MISSION LIBRARY row theirs, so the
   same rules reach them (then the two inline-style selectors go).
3. Delete `button-looks/`, the route and the preview script, or keep them as
   the gallery.

Checks the looks already meet: labels at least 4.5:1 on every stop of their
body (`contrastPairs`, run by the preview script), tap targets at least 44 px,
nothing wider than the screen at 360.
