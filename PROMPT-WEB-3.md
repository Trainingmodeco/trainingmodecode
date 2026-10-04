# PROMPT WEB-3 — update the current trainingmode.co (merge, don't redesign)

**Supersedes WEB-1 and WEB-2 for the site.** The owner wants to **keep the
current site** — the `landing/` folder on branch
`claude/training-mode-landing-redesign-qjfnuz` (commit `e1290b5`, deployed to
Hostinger per `landing/DEPLOY.md`) — and only update it. **Keep the
layout, fonts, colours, hero, gallery ("Every Screen Is a Stage"), progress
and community sections.** Edits below reuse the site's own classes; §10–15
(round 2) rework the modes, Arcade and Pro sections and add `features.html`.

A ready-to-upload copy with all of these edits applied was given to the owner
as `trainingmode-co-update-v2.zip` (includes round 2). This prompt is the same change, step by step.

---

## 1. Hero chip → the live drop (`index.html`)
Replace `<span class="beta-chip">★ Beta Wave 01 Now Open</span>` with
`<a class="beta-chip" href="#drop" data-drop-chip>★ New Concept Drop · Shoto · Oct 23</a>`.
Script (§6) rewrites it: before a drop `★ New Concept Drop · {Title} · {Mon D}`,
during `★ Live Now · {Title} · Ends {Mon D}`. CSS: `a.beta-chip { text-decoration:none; display:inline-block; }`.

## 2. New section: CONCEPT DROP (between Arcade and "Inside the App")
Same structure as the Arcade section (`arcade-section` + `arcade-media` +
`arcade-copy`), id `drop`, `data-drop`:
- Media: the drop's poster `./assets/drops/{id}.webp` (`data-drop-art`).
- `section-code` (`data-drop-code`): `New Concept Drop · Live` / `Next Concept Drop`.
- `h2` (`data-drop-title`), tagline `p` (`data-drop-tag`).
- `stage-grid` with three non-clickable `stage-card`s: `Part 01 · Fit`,
  `Part 02 · Fight`, `Part 03 · Arcade` (boss style).
- `stage-output drop-count` (`data-drop-count`): `Ends {Mon D} · {N} days left`
  or `Drops {Mon D} · in {N} days`.
- `p.drop-reward`: `Finish all three before it ends for the limited <strong>{Reward}</strong> title. The live drop is free for everyone.`
- `button-primary` link → `https://apptrainingmode.com/?src=site` (`data-app-link`, `data-drop-cta`):
  `Start {Title}` (live) / `Get Ready in the App` (before).
- `div.drop-calendar` (`data-drop-calendar`): all six drops, live one gold,
  past ones `In the Vault`.
- Footer nav: add `<a href="#drop">Drops</a>` after Arcade.
- Assets: `assets/drops/{shoto,ultra-ego,flow-state,one-hundred,warrior-queen,night-vigilante}.webp`
  — the app's `public/static/concepts/{id}/poster.webp`, 760 px wide.

## 3. Gallery — three new screens first
Prepend to `.gallery-strip` (same `<figure>` pattern, 420×800 WebP in
`assets/phones/`): `concept-drop.webp` "Concept Drop", `multiple-opponents.webp`
"Multiple Opponents", `choose-path-stage.webp` "Choose Your Path". Keep the
existing six.

## 4. Game section — no launch date
- Chip `Coming Soon · Game Launches 2026` → `In the Works`.
- Copy: `…power your in-game fighter's stats, rank &amp; skins.` → `…power your in-game fighter.`

## 5. Subscribe — the real Pro (superseded by §13)
- Lede → `Every Arcade saga and boss, the full Training Camp, and every past concept drop in the Vault. The current drop is always free.`
- `Training Mode Plus` → `Training Mode Pro`.
- Bullets → exactly the app's paywall (`Paywall.jsx` `BENEFITS`):
  `All Arcade protocols & boss stages` · `Training Camp levels 4-12` ·
  `Unlimited saved Builder routines` · `Full session length in Combo Coach & Fight Focus` ·
  `Every past concept drop in the Vault`.
- New `div.price-row` under the list: `$34.99 / year · Best value` (gold border),
  `$5.99 / month · Cancel anytime`, `$59 once · Founder · 100 seats`.
- Buttons: `Join the Waitlist` → `Get Pro in the App`
  (`https://apptrainingmode.com/?src=site-pro`, `data-app-link`); the ghost
  `Go To App` here → `Open the App` (`https://apptrainingmode.com/?src=site`, `data-app-link`).
  No Stripe links on the site — checkout needs the signed-in app user.

## 6. `script.js` — append two blocks
1. **Drops:** a `DROPS` array copied from the app's `CONCEPT_SCHEDULE`
   (id, title, start, end, reward, accent, tag — see the zip), local-time
   inclusive dates; pick the live drop, else the next; fill §1/§2; set
   `--drop-accent` on the section.
2. **Link pass-through:** for every `[data-app-link]`, copy `src`, `ch`, `ref`,
   `utm_source/medium/campaign` from the page URL onto the href. If `ch` is
   present, `location.replace` straight to `https://apptrainingmode.com/?ch=…`
   (challenge links must land in the app). This is what lets the app's share
   QR point here (`EXPO_PUBLIC_SHARE_TARGET=site`).

## 7. `styles.css` — append only
`.drop-media img` (accent border + glow), `.drop-count`, `.drop-reward`,
`.drop-calendar` (3 cols, 2 on ≤520 px, `.live` gold), `.price-row` (3 cols,
`.best` gold). Copy the block from the zip; nothing existing changes.

## 8. Owner decisions (resolved in round 2 — see §10)
- **"Go To App" / Google Play buttons** point to
  `play.google.com/store/apps/details?id=app.trainingmode.pro`. Keep only if
  that listing is live; otherwise point them at `https://apptrainingmode.com/?src=site`
  with `data-app-link`.
- **Newsletter form** — keep; confirm where it submits.
- **Instagram** footer link is commented out — the handle is `trainingmode.co`
  (`https://www.instagram.com/trainingmode.co/`, same as the app); uncomment.

## 10. Links, nav, socials (round 2)
- Google Play is **not live**: every `play.google.com` link → `https://apptrainingmode.com/?src=site`
  with `data-app-link`. Header button `Open App`; hero `Open the App`. The Play badge
  becomes `<span class="store-button store-soon">Coming soon to Google Play</span>`
  (App Store stays "coming soon") + `p.pwa-note` `Works now in your phone browser — add it to your Home Screen.`
- Desktop and mobile nav: Home, Modes, Arcade, Drops, **Features** (`features.html`),
  Community, Pro (`#subscribe`); the mobile nav ends with `Open the App`.
- Footer: Instagram uncommented (`https://www.instagram.com/trainingmode.co/`);
  add `Features` after Modes.

## 11. Modes → app-style tabs (replaces "Two Core Modes. Two Ways to Bridge Them.")
- Heading `Mode Select` / `Pick Your Mode.` / `Fit builds the body. Fight builds the skills. The Arcade turns both into a climb — every rep earns XP.`
- `nav.mt[role=tablist][data-mode-tabs]` with three `button.mt-tab` (`fit on`, `fight`,
  `arcade`; `data-mode`; `<span>LABEL</span><i class="mt-bar"></i>`). CSS is the app's
  `shared/ModeTabs.jsx` `modeTabsCSS` (violet fit, blue fight) + a gold arcade variant.
- `div.mode-stage` holds the three existing `mode-panel` cards (`data-mode-panel`;
  fight/arcade `hidden`), image left / copy right on desktop, stacked on mobile.
  Bullets — Fit: Quick Missions · Workout Builder · Programs · GPS & machine cardio.
  Fight: Fight Focus rounds · Combo Coach · Multiple opponents · Training Camp.
  Arcade: 10-stage sagas · Choose your path · Boss rounds · Concept drop gauntlets + `How the Arcade works ›`.
- Combat Conditioning drops to one line under the tabs (`p.mode-extra`) linking `features.html#conditioning`.
- JS: clicking a tab toggles `.on` / `aria-selected` and `hidden` on the panels.

## 12. Arcade → "How the Arcade Works"
Keep the poster. Copy: `Every saga is a ladder of ten stages. Clear one, the next opens. The boss waits at the top.`
Replace the stage-card picker with `ol.how-steps`: `01 Pick a saga` · `02 Choose your path`
(FIT / FIGHT / BOTH chips) · `03 Clear to climb` · `10 Beat the boss` (violet). Button
`Enter the Arcade` (`data-app-link`).

## 13. Pro — simple
`Go Pro` / `Unlock the Whole Climb` / `The app is free to start, and the current drop is always free.`
Card: three bullets (Every Arcade saga & boss · The full Training Camp · Every past
concept drop), `p.price-line` `From $5.99/mo · $34.99/yr · $59 Founder lifetime`, one
button `Get Pro in the App` (`?src=site-pro`). No price tiles.

## 14. New page `features.html`
Same header/footer as `index.html` (anchors → `index.html#…`). Hero `Everything in
Training Mode`, then a sticky, scrollable slanted tab bar (`nav.dt[data-feat-tabs]`,
the app's DisciplineTabs look) that highlights the section on screen. Six sections
(`section.feat`, phone screenshot + copy + bullets, alternating sides):
`#fit` (fit-hub) · `#fight` (fight-hub-new) · `#arcade` (arcade-ladder, 10-stage
ladder strip, the 4 steps + concept-drop unlock rule) · `#camp` (12 levels, 1–3 free) ·
`#conditioning` · `#ranks` (Ranks & XP, the five tier images Rookie → Champion).
Closing CTA `Ready for Stage 1?` → app (`?src=site-features`). Add it to `sitemap.xml`.

## 15. Done means (round 2)
No `play.google.com` links; Instagram shows in the footer; the mode tabs switch
panels; `features.html` tabs track scroll on mobile; no horizontal scroll at 390 px.

## 9. Done means
- Visually identical to today except the chip, the new Drop section, three
  gallery screens, the game chip, and the Pro card.
- With the clock on Oct 20 the Drop section says `Drops Oct 23 · in 3 days`;
  Oct 25 → `Ends Nov 30 · 37 days left`; Dec 5 → Ultra Ego live, Shoto `In the Vault`.
- `trainingmode.co/?src=qr` → the Pro / drop buttons carry `src=qr`;
  `?ch=TMC1.x` jumps straight into the app.
- No character/franchise names (`ryu|akuma|goku|vegeta|saitama|batman|wonder woman`)
  and no `2026` launch claim on the page.
- Back up the live `public_html` before uploading (DEPLOY.md step 3), then
  clear Hostinger's cache.
