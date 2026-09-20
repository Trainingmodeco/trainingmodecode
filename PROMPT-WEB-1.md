# PROMPT WEB-1 — the trainingmode.co landing site

**Domain: `trainingmode.co` · not the app**
**Sister site: `apptrainingmode.com` (the PWA — do NOT re-implement it here)**

Run this in the marketing-site repo, wherever `trainingmode.co` is served
from. This prompt is a **static landing site**, not the app. If you find the
domain redirects to `apptrainingmode.com` today, replace the redirect with
the page below — one hurts SEO and one gives us somewhere to send install
links, coach outreach, and Founder-100 buyers.

Everything named here was verified against the working tree of the app repo
(`app` branch at `fb05f52`) on 2026-09-20. **Do not invent copy.** Every
benefit, price and screenshot comes from the app itself. If a claim is not
grounded in code, it does not go on the site.

---

## 0. What we are trying to do

The `.co` is a page a coach, a gym owner, or a person who saw a share card
lands on. It has three jobs, in order:

1. **Prove Training Mode is real** — six screenshots from the actual PWA,
   not stock renders. If they cannot see the app, they will not install it.
2. **Send them into the app** — a single install button that opens
   `https://apptrainingmode.com/` on the same device, with clear PWA
   install instructions inline (iOS and Android differ; both are one line).
3. **Sell Pro honestly** — the four gated benefits, priced at $34.99/yr or
   $59 lifetime. Nothing else.

It is not a blog. It is not a docs site. It is not a page that lists every
feature. Anything longer than one scroll on a phone is over-scoped.

---

## 1. THE CANONICAL COPY BLOCK — copy verbatim, do not paraphrase

This is the source of truth for every claim on the site. The strings come
straight from the app, so a search engine indexing both sees the same
promises. If you need to shorten a headline, shorten the words around
these — do not shorten the claims themselves.

### 1a. Hero

- **Headline:** `Train like a fighter. Play like a game.`
- **Sub:** `Fight Mode. Fit Mode. A round timer that sounds like a corner,
  a run coach that talks, and an Arcade you climb one stage at a time.`
- **CTA:** `▶ INSTALL THE APP`
- **Sub-CTA (secondary):** `See a session in 30 seconds ↓`

### 1b. What is inside — six tiles, exactly these six

| Tile | One line | Screenshot to use |
|---|---|---|
| **FIGHT FOCUS** | Round timer with a real bell, a corner voice, and a
ten-second clapper. | Fight Focus in-round frame |
| **COMBO COACH** | Called combos at cadence — hands, kicks, knees,
elbows by style. | Combo Coach active |
| **CARDIO MODE** | Outdoor GPS, treadmill, bike, rower, elliptical, stair
climber. Each measured its own honest way. | Cardio equipment picker |
| **TRAINING ARCADE** | Twelve sagas, ten stages each, one mythic boss. XP
per session, no ads. | Arcade series detail |
| **TRAINING CAMP** | A twelve-week programmed climb. Levels 1–3 free. | Camp map |
| **WORKOUT BUILDER** | Save routines, generate sessions, swap moves — the
Rounds category builds you one from your level. | Rounds generator card |

### 1c. Pro — four bullets, verbatim from `Paywall.jsx:15-20`

    All Arcade protocols & boss stages
    Training Camp levels 4-12
    Unlimited saved Builder routines
    Full session length in Combo Coach & Fight Focus

These are the only four Pro benefits shipped in the app today. **Do not**
add "avatar tiers", "skins", "voice packs", "game-link rewards" or a
launch date for the companion game. Those claims lost us the last draft.

### 1d. Prices — from `data/stripe.js`

- **$34.99 / year** — annual plan
- **$59 lifetime** — the Founder link, capped at 100 seats total across
  the whole product

Show the lifetime option next to the annual with a `FOUNDER · 100 SEATS`
chip. When the cap is reached the page falls back to annual only.

### 1e. Game Link — one line, no CTA that suggests a launch date

> Companion game: in the works. Every real workout will power your in-game
> fighter when it lands.

That is the whole section. No stat bullets. No 2026. No screenshot from a
game that does not exist. A single line and a link into the app's Game
Link page (which itself says "notify me").

---

## 2. STRUCTURE — one page, one scroll on mobile

Above the fold, in this order:

1. Wordmark (`/static/brand/tm-logo-gold.png`), 44px, centred.
2. Headline (1a).
3. Sub (1a).
4. Install button (yellow, gold shadow — match the app's CTA style).
5. Six screenshots in a horizontal-snap gallery (1b). Autoplay off.
   Captions under each. On desktop, three per row.

Below the fold, in this order:

6. **HOW IT WORKS** — three cards: install to Home Screen · pick a mode ·
   train. Fifty words total. No video.
7. **WHAT PRO UNLOCKS** — the four bullets from 1c, big gold check marks,
   the two prices side-by-side, one CTA per price.
8. **FOR COACHES** — a two-line pitch and a mailto. "Free lifetime Pro
   for you, a code your athletes enter once, we do not touch your relationship."
   Contact `trainingmode.co@gmail.com`.
9. **GAME LINK** — the one-line block from 1e.
10. Footer: `© 2026 Training Mode` · `apptrainingmode.com` · `PRIVACY` (links
   to `apptrainingmode.com/privacy.html`) · Instagram · contact.

That is the whole page. No FAQ. No blog. No newsletter widget.

---

## 3. THE INSTALL BUTTON — the only interactive thing

Behaviour:

- On mobile: opens `https://apptrainingmode.com/` in the SAME tab. The
  PWA registers its service worker on that origin, then prompts to install
  when it detects the visit is fresh.
- On desktop: opens `apptrainingmode.com` in a new tab.
- If the user is already on `apptrainingmode.com` (they came here via an
  in-app link), the button reads `▶ OPEN THE APP` and just navigates.

Under the button, in tiny text and matched to the OS:

- **iPhone:** `Safari → Share → Add to Home Screen`
- **Android:** `Chrome → three-dot menu → Install app`

Two lines only. Detect from `navigator.userAgent`. If neither matches
(desktop), hide both.

---

## 4. STYLING — the brand, not stock Bootstrap

Use these tokens. They match the app's `ARCADE` constants so the site and
the app look like the same product:

    --tm-gold:          #fde047
    --tm-gold-deep:     #e0b400
    --tm-violet:        #7c3aed
    --tm-violet-soft:   rgba(168, 85, 247, 0.28)
    --tm-bg-top:        #120428
    --tm-bg-mid:        #0b0118
    --tm-bg-bot:        #0a0116
    --tm-text:          #ffffff
    --tm-text-muted:    #9d93b8

    --tm-font-head:     'Orbitron', system-ui, sans-serif
    --tm-font-body:     'Rajdhani', system-ui, sans-serif

Background: the same radial-plus-linear gradient the app uses. Load Orbitron
and Rajdhani from `fonts.googleapis.com` with a system fallback stack —
the site can afford runtime font loading in a way the app cannot.

Corners on cards: 12–14px. Buttons: 14px, gold gradient, gold-glow shadow.
Never use pure black — use `#0a0116`. Never use pure white — use `#f5f0ff`
for anything under 12px.

---

## 5. SEO + SHARING — this is why the domain exists

Set the following in the `<head>`:

    <title>Training Mode — Fight & Fit Workout Trainer</title>
    <meta name="description" content="Training Mode turns combat and strength
      training into a game. Fight Focus, Combo Coach, Cardio Mode, Training
      Camp and the Arcade — every rep earns XP.">
    <link rel="canonical" href="https://trainingmode.co/">
    <meta name="theme-color" content="#080012">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Training Mode">
    <meta property="og:title" content="Training Mode — Fight & Fit Workout Trainer">
    <meta property="og:description" content="A round timer that sounds like
      a corner, a run coach that talks, and an Arcade you climb.">
    <meta property="og:url" content="https://trainingmode.co/">
    <meta property="og:image" content="https://apptrainingmode.com/social/training-mode-share-card-template.png">

    <meta name="twitter:card" content="summary_large_image">

Confirm the OG image resolves before shipping — the URL points at the app's
share-card asset. If the image 404s, copy it into this repo at
`/social/training-mode-share-card-template.png` instead.

Add Plausible with `data-domain="trainingmode.co"` (a SEPARATE Plausible
site from the app — a coach clicking through counts once, not twice):

    <script defer data-domain="trainingmode.co"
      src="https://plausible.io/js/script.js"></script>

Robots: allow all. `sitemap.xml` with the single URL.

---

## 6. SCREENSHOTS — from the real app, not mockups

Take these on a real iPhone Safari session at `apptrainingmode.com`, in
dark mode, with `?paywall=preview` so the Pro overlay renders. Six frames:

1. **Fight Focus in-round** — the ring, the "ROUND 4 OF 12" line, the coach
   caption reading a real cue.
2. **Combo Coach active** — a called combo mid-cadence with the arsenal
   badge lit.
3. **Cardio equipment picker** — the RUNNING / OTHER EQUIPMENT / ROUNDS grid
   from `CardioMode.jsx`, with OUTDOOR RUN and TREADMILL RUN visible.
4. **Arcade series detail** — the stage ladder with stage 4 gated by a
   Pro badge (this is the point-of-contact overlay in the background).
5. **Camp map** — level 4 tapped, the ProGateOverlay open, showing "Level
   4 is Pro" and the free-vs-Pro tiers.
6. **Rounds generator card** — five moves in the BUILT FOR YOU · LEVEL 7
   card with reorder / swap / remove controls visible.

Crop to the phone frame, save as WebP at 2x, largest side 1600px. Preload
the first two, lazy-load the rest.

Do NOT use stock fitness photos. Do NOT use AI-generated hero art. If a
frame is not from the running app, it does not go on the site.

---

## 7. PERFORMANCE + ACCESSIBILITY — cheap wins that catch coaches

- LCP < 2s on 4G. Achievable because there is no video and no framework
  runtime — this is one HTML file, one CSS file, one SVG wordmark, six
  WebP images. Ship as static HTML from Netlify or Cloudflare Pages.
- Every image has an alt. The six screenshots' alts are the tile lines
  from §1b.
- Every heading level in order — one `<h1>`, six `<h2>`, no skips.
- Every button is a real `<button>`, not a `<div>` with a click handler.
- Prefers-reduced-motion respected: no autoplay, no parallax, no scroll
  animations. The screenshots move because the user swipes, not because
  they scroll.
- Colour contrast: gold on `#0a0116` is 12.4:1 for the CTA, text on
  the same background is 12.9:1 for `#f5f0ff`. Do not soften either.

Lighthouse target: 100 / 100 / 100 / 100.

---

## 8. WHAT IS DELIBERATELY NOT ON THIS SITE

Any of these will regress it. Do not add them under any name:

- A FAQ. If a question comes up more than three times, add its answer to
  the app's `HowItWorksGuide`, not here.
- A newsletter or email capture. The install button IS the CTA.
- A pricing table with more than two prices. Two.
- Testimonials, unless real, quoted, and attributed by name and gym.
- A "how it stacks up" comparison to any other app.
- Screenshots of the companion game.
- The word "skins", "avatar tier", "game-link rewards" anywhere on the
  page. These are the fake-benefit claims the app just fixed.
- A blog. If long-form is needed, ship it at `apptrainingmode.com`, not here.

---

## 9. DONE MEANS

- `trainingmode.co` returns the page above with a 200 and no console
  errors on iOS Safari, Android Chrome and desktop Chrome.
- Lighthouse mobile: LCP < 2s, CLS < 0.05, TBT < 200ms, all four scores
  at or above 95.
- The install button opens `apptrainingmode.com` on the same-tab and
  the PWA install prompt fires within three seconds of arrival.
- The four Pro bullets on this page match `Paywall.jsx:15-20` in the app
  repo byte-for-byte. A grep of both sources shows no divergence.
- Nothing on the page names a feature the app does not have. A grep of
  `skins|avatar tier|game-link reward|launches 202\d` on the built HTML
  returns zero lines.
- Sharing the URL on iOS Messages, Instagram DM and X shows a real preview
  card with the wordmark, headline and description.
- Plausible receives at least one visit event when the page is loaded
  through the real domain.

If all seven pass, ship it.
