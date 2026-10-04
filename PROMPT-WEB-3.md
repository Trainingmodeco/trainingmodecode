# PROMPT WEB-3 — update the current trainingmode.co (merge, don't redesign)

**Supersedes WEB-1 and WEB-2 for the site.** The owner wants to **keep the
current site** — the `landing/` folder on branch
`claude/training-mode-landing-redesign-qjfnuz` (commit `e1290b5`, deployed to
Hostinger per `landing/DEPLOY.md`) — and only update it. **Do not change the
layout, fonts, colours, hero, mode cards, Arcade, progress or community
sections.** Every edit below reuses the site's own classes.

A ready-to-upload copy with all of these edits applied was given to the owner
as `trainingmode-co-update.zip`. This prompt is the same change, step by step.

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

## 5. Subscribe — the real Pro
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

## 8. Owner decisions (not changed in this update)
- **"Go To App" / Google Play buttons** point to
  `play.google.com/store/apps/details?id=app.trainingmode.pro`. Keep only if
  that listing is live; otherwise point them at `https://apptrainingmode.com/?src=site`
  with `data-app-link`.
- **Newsletter form** — keep; confirm where it submits.
- **Instagram** footer link is commented out — the handle is `trainingmode.co`
  (`https://www.instagram.com/trainingmode.co/`, same as the app); uncomment.

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
