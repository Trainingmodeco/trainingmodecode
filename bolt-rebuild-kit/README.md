# TRAINING MODE — Bolt Rebuild Kit

Everything you need to rebuild the redesigned Training Mode app in Bolt.

## What's in this kit

```
bolt-rebuild-kit/
├── README.md                 ← you are here
├── prompts/                  ← copy-paste Bolt prompts, in build order
│   ├── 00-master-setup.md    ← run this FIRST (design system + nav + structure)
│   ├── 01-entry-onboarding.md
│   ├── 02-home-hub.md
│   ├── 03-fit-mode.md
│   ├── 04-cardio.md
│   ├── 05-fight-mode.md
│   ├── 06-training-arcade.md
│   ├── 07-rewards-progress.md
│   ├── 08-account-store.md
│   └── 09-anti-cheat-protocols.md
├── assets/                   ← ALL final images, organized (drag into Bolt as-is)
└── design-reference/         ← the full hi-fi design (real HTML/CSS code)
    ├── Training Mode Redesign.dc.html
    └── support.js
```

## How to use in Bolt

1. **Start a new Bolt project** (or a fresh branch of your existing one).
2. **Drag the `assets/` folder into Bolt** so every image path referenced by the
   prompts exists (`/assets/tiers/veteran-male.png`, etc.). Keep the folder
   structure exactly as-is.
3. **Paste `prompts/00-master-setup.md` first.** It sets up the design tokens,
   fonts, bottom nav, and folder structure. Everything else builds on it.
4. **Work down prompts 01 → 09, one prompt block at a time.** Each file has
   1–4 prompt blocks (marked `--- PROMPT ---`). Paste ONE block, let Bolt
   build it, check it, then paste the next. Don't paste a whole file at once.
5. **When Bolt's output doesn't match the design**, open
   `design-reference/Training Mode Redesign.dc.html` in a browser, find the
   screen (each has a visible id badge like `4a`, `13a`, `25a`), right-click →
   Inspect → copy that screen's markup, and tell Bolt:
   *"Match this exact HTML/CSS:"* + paste. Bolt is very good at transcribing
   exact markup into React components.
6. **Logic ≠ UI.** These prompts rebuild the interface and interaction states.
   The deep systems (workout generator focus behavior, GPS, HealthKit, IAP)
   are specced in the prompts' BEHAVIOR sections + `09-anti-cheat-protocols.md`
   — Bolt can scaffold them, but test them like real features.

## Design tokens (quick reference)

- Background: `#080012` (near-black violet), overlay art `assets/app-bg.png` at ~20% opacity
- Accent gold: `#fde047` (CTAs, ranks) · Accent violet: `#a855f7` / `#b06aff`
- Danger red: `#ef4444` · Success green: `#22c55e` · Cardio orange: `#ff8a4a`
- Display font: **Orbitron** (700/900, uppercase, letter-spacing) — headers, numbers, buttons
- Body font: **Rajdhani** (500–700) — descriptions, labels
- Cards: `rgba(8,2,18,0.8)` bg, 1px `rgba(168,85,247,0.25)` border, 11–14px radius
- Bottom nav: 4 tabs — HOME · TRAIN · PROGRESS · PROFILE (active = gold)
- Avatar tiers: LV1 Rookie → LV2 Adept → LV3 Veteran → LV4 Elite → LV5 Champion,
  male/female art swaps with profile gender (`assets/tiers/`)
