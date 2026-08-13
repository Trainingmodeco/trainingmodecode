# TRAINING MODE: THE GAME — Master Checklist & Roadmap

> Living document — tick items as they complete. Updated 2026-08-08.
> "Founder" = art/creative tasks · "Code chat" = Claude Code session tasks.

## Done so far

- [x] `00-MASTER-CONCEPT.md` — vision, tone, art direction, app-to-game
      hook, 20-boss caricature roster, customization, tech direction
- [x] `01-STORY-CONCEPTS.md` — audience research + 20 story concepts
- [x] `02-MAIN-STORY-OUTLINE.md` — four-act story, COACH/Promoter,
      chibi-flip rules, phone-call transitions, escalating gym
      commercials + AD ARCHIVE
- [x] `03-APP-TO-GAME-SYNC-SPEC.md` + `game-sync/` — Fighter Profile
      engine (working code, passing demo assertions) + pipeline spec +
      build prompt
- [x] `04-HOW-THE-GAME-GETS-BUILT.md` — process guide, engine decision
      (Godot; OpenBOR for throwaway prototypes only)
- [x] `05-ART-PROMPTS.md` — GPT prompt toolkit (characters, stages,
      Mike Bison, storyline block)
- [x] `06-STAGE-CONCEPT-THE-CLUB.md` — DJ-controlled 3-mode club stage,
      verified strobe-safety specs, beat-sync architecture, original
      music decision
- [x] `game-ui-kit/` — 7 UI components + published artifact
      ("TM Videogame Build") + Claude Design prompt
- [x] `HANDOFF-PROMPT.md` — context bootstrap for any new session
- [x] Concept docs merged to `main` (PRs #3, #4) and synced to `app`,
      fight-mode, and landing branches
- [x] Art pipeline decided: draw → GPT/PixelLab assist → Aseprite final
      pixels (AI = reference/first-pass, never shipped frames)

## PHASE 0 · Concept & Design (~90% done)

- [ ] Boss one-pagers: first 6 bosses (design, gimmick, stage, jokes)
- [ ] The Promoter's full lie-briefing list (~6 more, funny → dark;
      kitten shelter is the template)
- [ ] Final character names (placeholders: KO, Vince Maximus, COACH)
- [ ] Map caricature bosses to acts and Fit/Fight sides
- [ ] Founder answers to sync tuning questions (03 §6): recency window,
      tier stat caps, discipline flavor

## PHASE 1 · Art Foundation (founder — current phase)

- [ ] Aseprite installed (~$20) + PixelLab free trial started
- [ ] Male turnaround sheet — front/side/¾/back, locked palette
      **(THE unblocker)**
- [ ] Female turnaround sheet
- [ ] Chibi versions (male + female)
- [ ] PixelLab speed test: walk cycle + jab from the sheet, clean one
      frame in Aseprite → sets the real art schedule
- [ ] Mike Bison design sheet
- [ ] Gym interior background (stage 1)
- [ ] (Optional) Retro Diffusion side-by-side test before subscribing

## PHASE 2 · Prototype — "does punching feel good?" (code chat)

- [ ] Scaffold Godot project in this repo
- [ ] Walk + jab + hit reaction on placeholder art; hot-swap founder
      sprites when ready
- [ ] Game-feel tuning: hitstop, screen shake, knockback — iterate
      until crunchy
- [ ] Workout-mash mechanic prototype (button-mash burst)

## PHASE 3 · Vertical Slice — one perfect bite

- [ ] Stage 1 (Training Mode gym) fully art-ed and playable
- [ ] Mike Bison boss fight with taunt → rage mechanic
- [ ] Real HUD from game-ui-kit; stats from a sync stub
- [ ] First original music track commissioned (gym track; club brief
      already written in 06 §2)
- [ ] Slice = the demo for funding/partners/hype

## PHASE 4 · App Integration (parallel — app code chats)

- [ ] `feature_sessions` table + validated session logging
- [ ] `usage_snapshot` RPC + `fighter-profile` edge function (imports
      `game-sync/fighterProfile.js` verbatim)
- [ ] "GAME PROFILE" preview card in the app's Progress tab (ships value
      before the game exists)

## PHASE 5 · Production — the long middle

- [ ] Remaining stages: the Club (build to 06 spec), military base
      (Goggins PT round-ups), press arena, backlot, etc.
- [ ] 10–20 bosses at slice quality; enemy families (curl bros,
      treadmill zombies, supplement goblins…)
- [ ] Story scenes: phone calls, commercials (AD ARCHIVE set), chibi
      flips, versus-mode transitions for high-rank bosses
- [ ] Full soundtrack + SFX + 90s-dub voice barks
- [ ] Co-op (design goal) and ghost workout secret stages

## PHASE 6 · Polish & Testing

- [ ] Real playtests; difficulty tuning; bug fixing; juice pass
- [ ] Accessibility: strobe default-safe mode per 06 §7 (WCAG/XAG
      limits), remappable controls, mash-alternative inputs
- [ ] Legal review of boss parodies (budget for renames)
- [ ] Steam AI-content disclosure records (AI-assist logs)

## PHASE 7 · Release & Marketing (starts during Phase 3)

- [ ] Steam page live at vertical-slice time; post art/clips continuously
- [ ] Trailer from slice footage; public demo build
- [ ] Launch + game↔app cross-promotion (game milestones grant app
      trophies; app streaks unlock game cosmetics)

---

**Next actions:** Founder → male turnaround sheet. Code chat → "start
the prototype" (Godot scaffold; does not need to wait for finished art).
