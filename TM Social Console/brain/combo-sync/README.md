# Combo Coach sync videos: the text that goes with them

Copies of the text files `npm run sync-broll` writes to `exports/cc-sync/` (git-ignored, with the
videos), kept here so they travel with the repo:

- `FILM-GUIDE.md`: one page for whoever films themselves striking to the videos.
- `CALLS.md`: every call of every video, with the strikes in plain words.
- `cc-sync-<style>-<1|2>.timing.json` and `.csv`: when each count-in beep, the bell and each call lands on
  that video's own clock (seconds), how long the voice takes, when the next call comes, and the
  strikes of each call in plain words. App commit `e9c3753`, seeds in each file.

The videos are not in git (about 10 MB each): `npm run sync-broll` records them again. The same app
and seeds deal the same combos in the same order, but NOT the same file: a call can land a frame
earlier or later and the bytes differ. **Each timing sheet is exact only for the mp4 it was written
with.** Keep a video and its sheet as a pair, and do not swap in a re-recorded video once the owner has
filmed to the old one.

On the owner's clip, a moment at guide time `t` is at `t + offset`, the offset that
`npm run align -- <guide.mp4> <owner-clip.mp4>` prints.
