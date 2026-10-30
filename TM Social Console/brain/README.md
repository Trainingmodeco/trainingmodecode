# brain

What the console knows. Read the file that fits the job.

| File | What's in it |
|---|---|
| `../brand/brand.json` | the app's facts: colors, ranks, concept drops and dates, Arcade sagas, Coach's Tapes, named workouts, programs, Pro prices and benefits, the naming rule. Synced from the app (`npm run sync`). The full kit with every workout day is `../../content-kit/content-kit.json`. |
| `scripts/INDEX.md` | the owner's scripts imported from Google Drive, one markdown file per source doc |
| `scripts/library.json` | every short-form script as data: hook, 15/30/60s cuts, caption, CTA, shot list, flags |
| `formats.md` | repeatable post types, which template makes each, drop calendar, cadence, hooks |
| `platforms.md` | where each platform's posts go, connection status, caption style, video spec |
| `manychat.md` | Instagram comment → DM flow and its copy |

`scripts/` is **not in git**: the app repo is public and these are the
owner's private Drive docs. It comes with the console zip, or Claude can
re-import it: read each source with the Google Drive connector and write one
markdown file per doc plus `library.json` and `INDEX.md` in the same shape
(sources: Combined Scripts + Production Schedule, Month 1 Content + Filming
Tracker, Draft SCRIPT AND FILM WEEKLY VIDEO PLAN, TM.co Script Dump Short
Scripts 2025, TRAINING_MODE_COMPLETE_PLAYBOOK.md, Research Agent Tracker,
Video List Batch, the PROMPT docs and the single-script docs).

Scripts with a `naming:` or `stale:` flag must be rewritten before they go
in the queue (`npm run check` will refuse them anyway).
