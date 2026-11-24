# Home hub: locked to one screen (2026-11-24)

The owner asked for the Home hub to fit the phone and never slide, like the
Fit Mode and Fight Mode hubs. This is how it now works.

## What changed

- Home (`components/training-mode/HomeDashboard.jsx`) is now a column exactly
  one screen tall (`100dvh`, with a `100vh` version for browsers that do not
  know `dvh`). Its last block ends above the BETA pill's row and the tab bar
  (96px from the bottom, or the RESUME pill's row when it is there), the same
  rule the Fit hub uses.
- Every block is still there and still tappable: the header (level, streak or
  week chip, the ? button), the top card with START, SURPRISE ME / ADJUST, the
  "Also paused" row, NEXT UP, the NEW DROP banner, FIT MODE and FIGHT MODE,
  TRAINING ARCADE, and the three QUICK ACCESS tiles.
- All sizes are written as a range tied to the screen's height: on a tall
  phone the hub looks as it did; on a shorter one the blocks get smaller
  together.
- Taps made bigger where they were small: the "?" (44px), the logo, the 👻,
  the paused card's ✕, the "Also paused" RESUME and ✕ (the whole row height),
  SURPRISE ME / ADJUST and the Quick Access tiles.
- Small shared changes: the TODAY'S BOUT card and the drop banner read Home's
  sizes (other screens keep their old sizes), and the header's "LV 8" never
  breaks in two.

## How the blocks shrink

1. **Art tiles first.** FIT MODE / FIGHT MODE go from 150px down to 50px and
   the ARCADE banner from 96px to 44px. These are the only blocks that squeeze
   to fit what is left.
2. **Then gaps** between blocks: 14px down to 6px.
3. **Then the card**: its padding (16/18px down to 9/10px), its gold button
   (52px down to 44px) and its smallest height (176px down to 128px). The
   title goes from 28px to 22px; other text keeps its size.
4. The drop banner goes from 92px to 60px (its text stays centred), and NEXT
   UP loses some padding.
5. Under 760px tall, the Quick Access tiles drop their small icons (the words
   stay); the tiles go from 64px to 44px.
6. If the hub still does not fit (a short phone, or a busy day with a
   notice, NEXT UP and a drop all on it), Home takes tighter steps, one at a
   time, only as many as it needs:
   - step 1: FIT, FIGHT and ARCADE share one row of three tiles, and the
     "Quick access" heading goes (its three tiles stay);
   - step 2: a 1UP or POWER notice sits over the top of the card instead of
     pushing the hub down (it never covers START), and NEXT UP gets slimmer;
   - step 3: the card at its tightest (title 20px, less padding, smaller gaps);
   - step 4: NEXT UP and the drop banner sit side by side. Only the fullest
     state on the smallest phone (320x568 with a POWER notice, NEXT UP, a
     drop and a long title) needs this, and there the two banners' second
     lines are shortened with "...".
   Any change to what is on the hub, or to the screen size, starts again from
   the roomiest look.

Smallest sizes: every tap is at least 44px high, 40px on a phone under 640px
tall. A notice or toast over the header is the same as before.

If the content truly cannot fit even after step 4 (say the phone's text size is
set very large), the column scrolls inside itself as a last resort, rather
than hide anything. Otherwise it cannot scroll at all.
At normal text sizes it does not scroll at any size checked.

On a wide screen (a tablet, or a window wider than a phone), the hub stays a
440px phone column in the middle, as every other screen does.

## How to check it

Start the web dev server, then:

    CHROME_PATH=/opt/pw-browsers/chromium npm run preview:home-lock -- <photo folder> --base http://localhost:8081

It opens 17 Home states (owner preview on and off: CONTINUE, paused, also
paused, with and without a drop, ghost, toast, reminder, TODAY'S BOUT fresh,
repeat and done, 1UP and POWER notices, POWER draining and low, NEXT UP,
RUSTY, and the fullest of all) at 320x568, 360x640, 360x696, 375x667,
390x844, 412x915, 430x932, 600x960 and 768x1024. For each it checks that
nothing scrolls (also after a mouse wheel and a finger swipe), every block is
whole and above the BETA row and tab bar, no two blocks overlap, taps are big
enough, and START is never covered. It saves a photo of each and exits with an
error when anything fails. `--only <regex>` and `--sizes 360x696,...` narrow it.
