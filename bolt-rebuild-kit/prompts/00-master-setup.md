# 00 · MASTER SETUP — run this first

--- PROMPT ---

Set up a mobile-first fitness app called TRAINING MODE — a gamified combat-sports training app with an arcade-fighter aesthetic. Build with React, mobile viewport (390×844 design target), dark theme only.

DESIGN SYSTEM (create as shared tokens/styles):
- Page background: #080012 with a faint purple grid + a full-page background image `/assets/app-bg.png` rendered at ~20% opacity under a rgba(8,2,18,0.45) scrim on every screen.
- Colors: gold #fde047 (primary CTA, rank, active states), violet #a855f7 / #b06aff (secondary, borders, links), red #ef4444 (fight/danger), green #22c55e (success), orange #ff8a4a (cardio), text #f5e9ff, muted text #c4a4d8, faint #9a90b8.
- Fonts (Google Fonts): Orbitron 700/900 for headings, numbers, buttons (uppercase, letter-spacing 0.04–0.2em); Rajdhani 500–700 for body/labels.
- Cards: background rgba(8,2,18,0.8), border 1px rgba(168,85,247,0.25), radius 12px.
- Primary button: 52px tall, radius 13px, gradient gold (#fde047→#f59e0b), black Orbitron 900 text, subtle gold glow shadow. Secondary: violet gradient (#b975ff→#a855f7), white text. Ghost: transparent, 1px white/14% border, muted text.
- Toggles: 40×22 pill, ON = violet track + gold knob + gold border.

NAVIGATION:
- 4-tab bottom bar (56px, top border rgba(168,85,247,0.15), bg rgba(11,8,20,0.9)): HOME ⌂, TRAIN 🥊, PROGRESS 📈, PROFILE 👤. Active tab gold, inactive 55% opacity. Orbitron 700 7px labels.
- Everything else is a drill-in page with a back chevron header: ‹ + Orbitron 900 15px gold title.

APP STATE (context/store):
- user: { name, gender ('male'|'female'), age, height, weight, experience ('rookie'|'mid'|'advanced'), discipline ('boxing'|'kickboxing'|'muaythai'|'mma'), level (1–5), xp, streak, sessions }
- Avatar art is driven by gender + level: /assets/tiers/{tier}-{gender}.png where tier = rookie(1), adept(2), veteran(3), elite(4), champion(5). Changing gender in profile swaps ALL avatar art app-wide.
- Persist everything to localStorage for now.

FOLDER STRUCTURE: src/screens (one file per screen), src/components (BottomNav, Card, PrimaryButton, Toggle, RingTimer, PhoneHeader), src/state, public/assets (I will drag in an assets folder — reference images as /assets/...).

Build the shell now: app background, bottom nav with 4 empty screens, design tokens, and the shared components. No screen content yet.

--- END ---
