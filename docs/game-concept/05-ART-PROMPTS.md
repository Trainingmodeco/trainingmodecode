# TRAINING MODE: THE GAME — GPT Image Prompts (Character, Stage & Boss Art)

> Ready-to-paste prompts for GPT image generation. Workflow rules:
> **one prompt = one generation**; always upload the matching avatar image
> from `bolt-rebuild-kit/assets/tiers/` and say "match this character
> exactly"; start every prompt with the STYLE BLOCK; outputs are
> *reference sheets* — final sprites are hand-pixeled in Aseprite.

## STYLE BLOCK (paste first, every time)

```
Retro 90s anime style, cel shading, clean thick outlines, flat colors,
cyberpunk fitness world. Brand palette: near-black violet background
#080012, gold #FDE047 accents, neon violet #A855F7 energy/glow, black and
gold athletic gear with a gold "T" logo. Characters have subtly glowing
violet eyes. Mood: confident, action-packed, tongue-in-cheek but played
straight — Scott Pilgrim × One Punch Man humor, Streets of Rage energy.
No text, no watermark.
```

## GAME CONTEXT BLOCK (add for backgrounds and bosses)

```
The game: TRAINING MODE: THE GAME — a retro pixel-art beat 'em up where
your real workouts build your fighter. Two trainees from the Training Mode
gym lose a fair fight, get recruited by a shady mega-gym promoter, and
fight through the city's gyms and dojos — bosses are hilarious exaggerated
caricatures of fitness and combat-sports celebrities — before realizing
they're being manipulated, uniting the city's fitness and fighting sides,
and founding one gym where every discipline trains together.
```

## Character description lines

- **Male:** young adult male fighter, dark brown skin, short black curly
  hair with a fade, subtly glowing violet eyes, athletic muscular build,
  black hoodie with gold drawstrings and gold "T" chest logo, black
  joggers with gold side stripe, black fingerless MMA gloves.
- **Female:** young adult female fighter, brown skin, long black ponytail
  tied with a violet band, subtly glowing violet eyes, fit athletic build,
  black sports crop tank with gold "T" chest logo, black training shorts
  with gold trim, black fingerless MMA gloves.

## 1 · Turnaround sheet (run once per character)

```
Character turnaround model sheet of this exact character: [CHARACTER
LINE]. Show the SAME character 4 times in a row, same height, neutral
A-pose: front view, 3/4 view, side profile view, back view. Flat colors,
clean thick outlines, plain dark background, full body, consistent
proportions across all four views.
```

## 2 · Fighting stance (per character)

```
Same character, full body, side-profile boxing fighting stance facing
left: knees bent, hands up in guard, chin tucked, weight on back foot,
subtle violet energy aura starting to glow around the gloves. Dynamic but
grounded — ready to fight, not mid-attack. Flat colors, clean outlines,
plain dark background.
```

## 3 · Strike animation strip (per character)

```
Animation reference strip: the same character throwing ONE [male: right
cross / female: lead hook], shown as 6 sequential frames left to right in
a single row, same scale and position: (1) guard stance, (2) hips rotate
wind-up, (3) arm half extended, (4) full extension with small gold impact
flash at the fist, (5) arm retracting, (6) back to guard. Side profile
view facing left, flat colors, clean outlines, identical character in
every frame, plain dark background.
```

## 4 · City street background

```
[STYLE + GAME CONTEXT] Wide side-scrolling background layout for a beat
'em up stage: neon cyberpunk city street at night, near-black violet sky
#080012, glowing gold and violet neon signs for gyms and dojos (dumbbell
icons, boxing glove icons, no readable text), wet asphalt reflections,
chain-link fences, parked delivery scooters, distant city skyline. Drawn
in flat layers for parallax: foreground props, mid-ground storefronts,
background skyline. 90s anime cel style, no characters.
```

## 5 · Gym interior background

```
[STYLE + GAME CONTEXT] Wide side-scrolling background layout for the
first stage: old-school boxing gym interior at night — worn boxing ring
in the center, heavy bags hanging in a row, speed bags, dumbbell racks,
faded fight posters (no readable text), one wall with a big gold "T" logo
mural, dramatic violet rim lighting from high windows, gold practical
lights. Flat parallax layers, 90s anime cel style, gritty but warm, no
characters.
```

## 6 · Boss design sheet — Mike Bison (vertical-slice boss)

```
[STYLE + GAME CONTEXT] Boss character design sheet: "MIKE BISON", a
hilarious exaggerated parody boxer — a mountain of muscle with a comically
thick neck, tiny championship shorts, gold heavyweight belt worn
diagonally like a sash, face tattoo on the WRONG side of his face,
gap-toothed cocky grin, tiny ears, red boxing gloves the size of his head.
He's furious about being called a knockoff of a certain famous boxer and
carries himself like royalty — crown-shaped hair cut into his flat-top.
Show: full body front pose, side profile, plus two head expressions
(smug grin / offended rage). Flat colors, clean outlines, plain dark
background. Parody design — do NOT depict any real person's face.
```

## Notes

- The "do NOT depict any real person's face" line on boss prompts is
  deliberate legal protection — keep it on every celebrity-caricature boss.
- 6-frame single-row strips at identical scale convert cleanest into
  Aseprite sprite strips.
- Chibi variants: rerun any character prompt adding "chibi version of
  this exact character, same outfit and colors, 2-head-tall proportions".
