# TRAINING MODE: THE GAME — How a Game Actually Gets Built (Founder's Guide)

> Plain-language guide for a first-time game creator whose superpowers are
> creative direction and visual art. Junior-high simple, on purpose.

## The 6 steps (like building a house)

1. **Concept & design — DONE.** What the game is, story, characters, look.
   That's `docs/game-concept/00–03`. Most people skip this and fail.
2. **Prototype ("the ugly test").** A tiny playable thing with placeholder
   art — boxes punching boxes. Only question: **does punching feel good?**
   In a beat 'em up this is everything. Redo until it's crunchy.
3. **Vertical slice ("one perfect bite").** One stage + one boss (Mike
   Bison) + one character at FINAL quality. This is what you show people
   to get funding, partners, and hype.
4. **Production ("the long middle").** Repeat the slice recipe for every
   stage/boss. ~70% of total time. Content: sprites, stages, enemies,
   sounds, dialogue.
5. **Polish & testing.** Real players break it; fix bugs, tune difficulty,
   add juice (screen shake, hit sparks, sounds). Bad games skip this.
6. **Release & marketing.** Steam page + art clips start back at step 3 —
   audiences build slowly, not at launch.

## The founder's role — art director

- Character design sheets · sprite animation · stage backgrounds · boss
  designs · UI art · cutscene storyboards.
- **Tool to learn: Aseprite** (~$20) — THE pixel-art animation tool.
- Key fact: a game character = a *sprite sheet*, not one drawing. Idle,
  walk, 3–5 attacks, hurt, knockdown, victory ≈ **100–300 small drawings
  per character.** Art-heavy genre = artist-founder advantage.

## What we still need

- **Programming** — a partner dev, or AI-assisted (Claude Code) with the
  founder supplying art + direction. Very viable for prototype/slice.
- **Sound & music** — contract out later (synthwave / 90s-anime style).

## Engines (the toolbox the game is built in)

- ❌ The real Street Fighter / Streets of Rage engines are Capcom/Sega
  private property — not licensable by anyone.
- ✅ **Godot — RECOMMENDED.** Free, no royalties, excellent 2D pixel
  support, huge community. Handles the side-scroller AND the versus-stage
  transition (versus = locked camera + two health bars, same engine).
  Also the best fit for our Supabase app-sync (`game-sync/`).
- ✅ **OpenBOR** — the free fan-made "Streets of Rage engine" (from the
  *Beats of Rage* fan game). Purpose-built for beat 'em ups, mostly
  art + config files. Great for a FAST prototype; too dated/limited for
  the final game (weak versus mode, no app sync, rough console path).
  Sketchbook, not canvas.
- ⚠️ **Unity** — industry standard, more power, licensing costs. Only if
  we hire devs who know it.
- ⚠️ **GameMaker** — beginner-friendly pixel-indie favorite (Hyper Light
  Drifter). Fine plan B.

## Next three moves

1. **Founder draws:** male/female protagonist design sheets + Mike Bison
   design + a 4-frame jab animation (Aseprite).
2. **Prototype:** scaffold a Godot project in this repo — walk + punch on
   placeholder art, built to hot-swap the founder's sprites.
3. **Feel it, then commit:** when punching feels good with real art on it,
   greenlight the vertical slice.
