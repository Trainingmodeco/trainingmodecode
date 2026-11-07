# Combo Coach sync videos: the text that goes with them

Copies of the text files `npm run sync-broll` writes to `exports/cc-sync/` (git-ignored, with the
videos), kept here so they travel with the repo:

- `FILM-GUIDE.md`: one page for whoever films themselves striking to the videos.
- `CALLS.md`: every call of every video, with the strikes in plain words.
- `cc-sync-<style>-<1|2>.timing.json` and `.csv`: when each count-in beep, the bell and each call lands on
  that video's own clock (seconds), how long the voice takes, when the next call comes, and the
  strikes of each call in plain words. App commit `e9c3753`, seeds in each file.

The videos are not in git: `npm run sync-broll` records them again (same app, same seeds, same
combos). On the owner's clip, a moment at guide time `t` is at `t + offset`, the offset that
`npm run align -- <guide.mp4> <owner-clip.mp4>` prints.
