# Claude Design Prompt — "TM Videogame Build"

> Copy-paste the block below into Claude Design (claude.ai/design).
> Before sending: attach/open your two existing Training Mode design
> projects so Designer can read them —
> https://claude.ai/design/p/1213aacf-ac08-4ad9-aa65-cfc728766690?via=share
> https://claude.ai/design/p/b0b43543-7787-4b23-8638-05fc3069246e?via=share
> If Designer can't access GitHub directly, upload assets from the repo
> (bolt-rebuild-kit/assets/) into the project as files.

---

Create a design-system project named **TM Videogame Build** — the game UI
kit for TRAINING MODE: THE GAME, a retro 90s-anime, pixel-art, cyberpunk
beat 'em up companion to the Training Mode fitness app.

REFERENCE MATERIAL (use all three):
1. My two linked Training Mode design projects (attached) — match their
   established brand exactly; this game kit is a sibling, not a new brand.
2. GitHub repo `Trainingmodeco/trainingmodecode`:
   - `game-ui-kit/` — working HTML/CSS mockups of every component below;
     treat these as the v0.1 source of truth to refine, not replace.
   - `bolt-rebuild-kit/assets/` — final app art to reuse: `tiers/` (avatar
     art per rank/gender), `stages/` (stage badges), `trophies/`, `rings/`
     (timer rings), `discipline/` (boxing/kickboxing/muay thai/MMA art),
     logos (`logo-mark.png`, `logo-wordmark.png`).
   - `docs/game-concept/` — design law: 00 master concept, 02 story
     outline, 03 app-to-game sync spec.

BRAND TOKENS (identical to the app — do not drift):
- Background: Void Violet #080012 (near-black violet)
- Accent gold #FDE047 (XP, ranks, combo text, CTAs)
- Neon violet #A855F7 (energy, super meter, UI lines; light variant #C99CFF)
- Danger red #EF4444 (boss health, damage, KO)
- Success green #22C55E (player health, stage clear)
- Cardio orange #FF8A4A (stamina, workout phases)
- Cards: rgba(8,2,18,0.8) bg · 1px rgba(168,85,247,0.25) border · 11–14px radius
- Type: Orbitron 700/900 (uppercase, letter-spaced — headers, numbers,
  HUD) + Rajdhani 500–700 (labels, dialogue, descriptions)
- DARK ONLY: this kit renders exclusively in the game's neon-dark world.
  No light mode.

BUILD THESE COMPONENTS (group names in brackets):

[Brand Tokens]
1. Game Palette — swatch card of the six colors with hex + in-game role.
2. Typography — Orbitron 900 (ROUND 1 / FIGHT! / combo numbers), Orbitron
   700 (boss names, menus), Rajdhani 700 (stat labels), Rajdhani 500
   (dialogue/subtitles).

[In-Game HUD]
3. Player HUD — avatar portrait framed in gold with "LV3 VETERAN" badge,
   fighter name + discipline tag, green health bar, orange stamina bar
   (show it SHORT — the build shown is a lifter who skips cardio), violet
   5-segment super meter, build chips: gold "★ GLASS CANNON" perk + red
   "⚠ GASSES OUT" weakness. These values come from the app data sync.
4. Boss Bar — top-of-screen wide bar: "👑 MIKE BISON — 'THE BARON OF
   BOXING' · PHASE 2/3", segmented red health with glow, violet phase
   pips, and a taunt call-out strip ("Call him a knockoff Iron Mike to
   trigger RAGE MODE").
5. Combo Counter — huge tilted Orbitron 900 gold "12 HIT COMBO" with
   violet drop-shadow, rank grade below, and two popup chips: violet
   "+240 HIT XP ×2.1" and gold "COMBO DMG ×1.58".

[Screens]
6. Versus Screen — diagonal split (gold side vs red side) with a glowing
   slash divider, big rotated "VS", fighter name plates (name, gym,
   record), and placeholder silhouette panels sized for character art.
7. Stage Title Card — 90s-anime episode card with CRT scanlines:
   "EPISODE 03 · FIGHT SIDE / THE OLD SCHOOL GYM", a subtitle quote line,
   and a corner block (BOSS · OBJECTIVE · WORKOUT PHASE).

ALSO ADD (new work beyond v0.1):
8. Pause / options menu panel
9. Stage-results screen (rank S–D, time, XP earned, "NEXT STAGE ▸")
10. Dialogue box for story beats — normal version + "chibi mode" comedy
    variant (smaller portrait frame, bouncier shape)
11. Workout-phase overlay — the button-mash/motion prompt frame used in
    fitness-boss fights (big instruction, rep counter, mash meter)

RULES: pixel-game energy but crisp vector UI (the pixel art is the
characters/stages, not the interface). Every placeholder (portraits,
silhouettes) must be shaped to receive the founder's avatar art from
bolt-rebuild-kit/assets/tiers/. Keep all copy in the game's voice —
confident, funny, arcade-loud.
