# RUSTY and REVIVE art: what to make and how to drop it in (2026-11-23)

The POWER build (switch `power`, `docs/retention/BUILD-NOTES.md`) already looks for four pictures. Until they exist,
the app uses a stand-in: the athlete's own tier portrait (`/static/tiers/<tier>-<sex>.png`, 312 x 520), greyed and
rust-toned, with dust drawn over it. A missing file never shows a broken image; it shows the stand-in.

## The four files

| File (in `public/static/retention/`) | What it shows | Where it shows |
| --- | --- | --- |
| `rusty-male.webp` | a male fighter covered in dust and rust, a month untouched | the RUSTY pop-up (male profile) |
| `rusty-female.webp` | a female fighter covered in dust and rust | the RUSTY pop-up (female profile) |
| `revive-male.webp` | the same male fighter wiping the dust and rust off | the REVIVED line on the end screen, small (male) |
| `revive-female.webp` | the same female fighter wiping it off | the REVIVED line on the end screen, small (female) |

The app reads `/static/retention/rusty-<sex>.webp` and `/static/retention/revive-<sex>.webp`, with `<sex>` from the
profile (`male` unless the profile says `female`). Names are lower case, exactly as above.

## Size and format

- **3:5 portrait, 624 x 1040 px** (twice the tier portraits' 312 x 520, so it stays sharp on a phone screen).
- **WebP**, about 80 to 85 quality, under about 150 KB each.
- **Background:** transparent, or the app's near-black (`#0c0218`, or black like the tier portraits). Nothing bright
  at the edges: the pop-up fades the picture's bottom into the card.
- **No text, no logo, no frame, no watermark.** The app writes RUSTY and REVIVED itself.
- **Where the fighter sits:**
  - RUSTY: the pop-up shows the **top half** of the picture (it crops from the top: about 46% of the height on a
    small phone, up to about 56% on a big one). Keep the face, the dusty shoulders and the hands in the top 45%.
    The bottom half can be legs and floor: it is hidden or faded.
  - REVIVE: the end screen shows a small square (22 px) cut from the top of the picture, centred on the face. Keep
    the face in the top third, centred left to right. A bigger use later would show the whole picture.
- Keep each pair the **same fighter** (same face, hair, gear) so REVIVE reads as the RUSTY fighter coming back.

## Prompts for the generator

Make the RUSTY picture first, then use it as the reference image for the REVIVE one so the fighter matches.

**RUSTY (male / female):**

> Vertical 3:5 character portrait, 624x1040, of a [male / female] combat athlete in a guarded fighting stance, hand
> wraps on, dark training gear, painted in the dramatic style of a premium fighting-game character card. The
> fighter is completely covered in a thick layer of grey dust and flaking orange-brown rust, as if left standing
> untouched for a month: dust settled on the hair, shoulders, forearms and gloves, rust patches and small cracks on
> the gear, a few cobwebs between arm and body, colours faded to grey and brown, eyes still alert and ready. Soft rim
> light, a few dust motes in the air, near-black deep purple background. Face, shoulders and hands in the top half of
> the frame. No text, no logo, no frame, no watermark.

**REVIVE (male / female), with the RUSTY picture as the reference:**

> The same fighter as the reference image, same face, hair and gear, mid-motion wiping the dust and rust off: one
> forearm sweeping across the chest and shoulder, a burst of dust and rust flakes flying off, full colour and a warm
> golden glow showing where it is wiped clean, a determined look straight ahead. Same dramatic fighting-game card
> style, near-black deep purple background, face in the top third of the frame, centred. Vertical 3:5, 624x1040.
> No text, no logo, no frame, no watermark.

Keep to the app's own look: no characters, costumes or logos from any existing game, film or show.

## Dropping them in

1. Save the four files as `public/static/retention/rusty-male.webp`, `rusty-female.webp`, `revive-male.webp` and
   `revive-female.webp`.
2. Update the image lock: `node scripts/lock-assets.mjs --write` (the build checks that the image set is the one
   signed off, and new files must be listed in `assets.lock.json`).
3. Nothing in the code changes: the pop-up and the end-screen line use the file when it loads and the stand-in when
   it does not.
4. Check the look on the phone sizes: with the dev server running,
   `node scripts/retention-preview.mjs <out-dir> --only '^f4-(rusty-popup|end-revived)'` and look at the photos at
   360, 390 and 430 wide (the face whole in the pop-up, the end-screen square showing the face).
5. Commit the four files and `assets.lock.json` together.

Only the pop-up and the REVIVED line use these files. The portraits on Profile, the Level page and the end screen
keep the athlete's own tier art (with the rusty look while RUSTY), because they show the athlete's tier.
