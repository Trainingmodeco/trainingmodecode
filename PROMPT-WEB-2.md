# PROMPT WEB-2 — the trainingmode.co landing page (supersedes WEB-1)

> **Superseded by PROMPT-WEB-3** — the owner keeps the current site and merges updates. Use WEB-3.

**Domain: `trainingmode.co` · the marketing page, not the app.**
**The app lives at `apptrainingmode.com` (a PWA) — never re-implement it here.**

Run this in the repo that serves `trainingmode.co`. If the domain only
redirects to the app today, replace the redirect with this page.

Every claim, price and image below comes from the app repo
(`trainingmodeco/trainingmodecode`, branch `app`, at the commit that adds this
file). **Do not invent copy.** If a claim is not in the app, it does not go on
the page. WEB-2 keeps WEB-1's rules and adds: concept drops, the share-QR /
link pass-through, the fifth Pro benefit, the monthly price, and drop-aware
social previews.

---

## 0. Jobs of the page, in order

1. **Prove it's real** — real screenshots from the PWA, and the current drop's art.
2. **Get them into the app** — one install button → `apptrainingmode.com`,
   carrying any link parameters through (§4).
3. **Sell the current drop** — the limited, two-month program with a countdown.
4. **Sell Pro honestly** — five benefits, three prices.

One scroll on a phone. No blog, no FAQ, no newsletter.

---

## 1. COPY — verbatim

### 1a. Hero
- **Headline:** `Train like a fighter. Play like a game.`
- **Sub:** `A coach in your ear for every round. Fight Mode, Fit Mode, and an Arcade you climb — with a new limited drop every two months.`
- **CTA:** `▶ INSTALL THE APP` (`▶ OPEN THE APP` if already installed / on the app origin)
- **Under the CTA (OS-matched, one line):**
  - iPhone: `Safari → Share → Add to Home Screen`
  - Android: `Chrome → ⋮ → Install app`
  - Desktop: hide.

### 1b. The live drop — the section that changes every two months
Driven by `drops.json` (§3), never hard-coded in HTML.

- Chip: `◆ NEW CONCEPT DROP` (live) / `◆ DROPS {MON D}` (next, before it starts)
- Title: the drop's title, e.g. `SHOTO`
- Tagline: the drop's tagline
- Three pills: `FIT` · `FIGHT` · `ARCADE · 10-STAGE GAUNTLET`
- Countdown: live → `ENDS {MON D} · {N} DAYS LEFT`; upcoming → `STARTS IN {N} DAYS`
- Line: `Finish all three before it ends for the limited {REWARD} title.`
- Button: `▶ START {TITLE}` → the install/open link (§4)
- Art: the drop's `wide` image, cropped `object-position: 60% 30%`.

### 1c. What's inside — six tiles
| Tile | One line |
|---|---|
| **FIGHT FOCUS** | Round timer with a real bell and a coach that calls your focus every round. |
| **COMBO COACH** | Called combos at cadence — hands, kicks, knees, elbows — and multiple-opponent rounds. |
| **CARDIO MODE** | GPS runs, treadmill, bike, rower — each measured its own honest way. |
| **TRAINING ARCADE** | Sagas of ten stages each, boss at the top. Pick your path: Fit, Fight or both. |
| **TRAINING CAMP** | A twelve-level programmed climb. Levels 1–3 free. |
| **CONCEPT DROPS** | A new anime-inspired program every two months: Fit, Fight and an Arcade gauntlet. |

### 1d. Pro — exactly the app's five bullets (`Paywall.jsx` `BENEFITS`)
```
All Arcade protocols & boss stages
Training Camp levels 4-12
Unlimited saved Builder routines
Full session length in Combo Coach & Fight Focus
Every past concept drop in the Vault
```
Below: `The current drop is free for everyone while it's live.`

### 1e. Prices — from `data/stripe.js`
| Plan | Price | Note |
|---|---|---|
| Annual (default, `BEST VALUE · SAVE 51%`) | **$34.99 / yr** | $2.92/mo · billed yearly |
| Monthly | **$5.99 / mo** | Cancel anytime |
| Founder | **$59 once** | Lifetime · chip `FOUNDER · 100 SEATS` |

Each price button opens the app (§4) with `?plan=annual|monthly|founder` —
**never** a Stripe link from this page (checkout needs the signed-in app user).
Note: the app does **not** read `plan=` yet, so today the button just opens the
app (the athlete reaches the paywall from any Pro gate). Opening the paywall
pre-selected on `?plan=` is a small app change for the revamp — add it with
PROMPT-MONEY-90 §5 (paywall as an overlay).
No live seat counter until PROMPT-MONEY-90 §3 ships; the chip just says 100 seats.

### 1f. Drop calendar — small, below Pro
`SHOTO · OCT 23` · `ULTRA EGO · DEC 1` · `FLOW STATE · FEB 1` ·
`ONE HUNDRED · APR 1` · `WARRIOR QUEEN · JUN 1` · `NIGHT VIGILANTE · AUG 1`
(from `drops.json`; past drops show `IN THE VAULT`, the live one is highlighted).

### 1g. For coaches
`Free lifetime Pro for you, one code your athletes enter once. We never touch your relationship.`
→ `mailto:trainingmode.co@gmail.com?subject=Coach%20access`

### 1h. Footer
`© 2026 Training Mode` · `apptrainingmode.com` · `Privacy` →
`https://apptrainingmode.com/privacy.html` · Instagram
`https://www.instagram.com/trainingmode.co/` · contact mail.

### 1i. Naming rule (hard)
Never name a character, show, game or film anywhere on the page or in
metadata: no Ryu/Ken/Akuma, Street Fighter, Goku/Vegeta, Dragon Ball, Ultra
Instinct/Ego, Saitama, One Punch, Batman/Gotham, Wonder Woman. Drop titles
only. A grep in §9 enforces it.

---

## 2. STRUCTURE (mobile order; desktop = same order, wider)
1. Wordmark (`/brand/gold-logo.webp`, 44 px)
2. Hero (1a) + install button
3. **Live drop card (1b)**
4. Screenshot gallery — horizontal snap, 6 frames (§6), captions = 1c lines
5. How it works — 3 cards: `Install to Home Screen` · `Pick Fit or Fight` · `Train — the coach calls it`
6. Pro (1d) + prices (1e)
7. Drop calendar (1f)
8. Coaches (1g)
9. Footer (1h)

---

## 3. `drops.json` — the only thing you edit each drop
Static file at the site root. Source of truth for dates is the app's
`CONCEPT_SCHEDULE` (`components/training-mode/data/concepts/index.js`); copy it:
```json
[
  { "id": "shoto",          "title": "SHOTO",           "start": "2026-10-23", "end": "2026-11-30", "reward": "SHOTO MASTER",    "tagline": "Three styles. One path. Fundamentals, speed, pressure.", "accent": "#f97316" },
  { "id": "ultra-ego",      "title": "ULTRA EGO",       "start": "2026-12-01", "end": "2027-01-31", "reward": "DESTROYER",       "tagline": "Power at all costs. Take the hit, give it back harder.", "accent": "#e879f9" },
  { "id": "flow-state",     "title": "FLOW STATE",      "start": "2027-02-01", "end": "2027-03-31", "reward": "FLOW STATE",      "tagline": "Move before you think. Slip, angle, counter, flow.", "accent": "#7dd3fc" },
  { "id": "one-hundred",    "title": "ONE HUNDRED",     "start": "2027-04-01", "end": "2027-05-31", "reward": "LIMIT BREAKER",   "tagline": "100 push-ups. 100 sit-ups. 100 squats. Then run.", "accent": "#facc15" },
  { "id": "warrior-queen",  "title": "WARRIOR QUEEN",   "start": "2027-06-01", "end": "2027-07-31", "reward": "WARRIOR QUEEN",   "tagline": "Built like a goddess, trained like a warrior. Lift, sculpt, fight.", "accent": "#f59e0b" },
  { "id": "night-vigilante","title": "NIGHT VIGILANTE", "start": "2027-08-01", "end": "2027-09-30", "reward": "NIGHT VIGILANTE", "tagline": "Before the mask: the training years. Run, lift, fight, climb.", "accent": "#a78bfa" }
]
```
Check every tagline/reward against the app's concept files before shipping.
- Dates are inclusive, **local time** (same rule as the app).
- Live = today within [start, end]. If none is live, show the **next** one
  in "DROPS {date}" mode. Before the first drop, that's Shoto.
- Art: `https://apptrainingmode.com/static/concepts/{id}/wide.webp`
  (and `poster.webp` for the OG image) — or copy them into this repo.
- Accent colours the card's border/glow.

A ~40-line vanilla JS module renders 1b and 1f from this file. No framework.
If JS fails, the hero + install button must still work (progressive enhancement).

---

## 4. Links into the app — pass everything through
Every app-bound link (install, drop button, price buttons) is built by one
function:
```js
const APP = 'https://apptrainingmode.com/';
function appLink(extra = {}) {
  const here = new URLSearchParams(location.search);
  const out = new URLSearchParams();
  for (const k of ['src', 'ch', 'ref', 'utm_source', 'utm_medium', 'utm_campaign']) {
    if (here.get(k)) out.set(k, here.get(k));
  }
  if (!out.get('src')) out.set('src', 'site');
  for (const [k, v] of Object.entries(extra)) out.set(k, v);
  return APP + '?' + out.toString();
}
```
- Why: the app's share QR can be pointed here (`EXPO_PUBLIC_SHARE_TARGET=site`
  → `https://trainingmode.co/?src=qr`), and challenge links carry `?ch=`.
  Dropping those params loses attribution and breaks challenges.
- **If a `ch=` param is present, skip the page:** redirect immediately to
  `appLink()` — a challenge link must land in the app.
- Mobile: same tab. Desktop: new tab.

---

## 5. Styling — same brand as the app
```
--tm-gold #fde047   --tm-gold-deep #e0b400   --tm-violet #7c3aed
--tm-violet-soft rgba(168,85,247,.28)
--tm-bg-top #120428 --tm-bg-mid #0b0118 --tm-bg-bot #0a0116
--tm-text #f5f0ff   --tm-muted #9d93b8
--tm-font-head 'Orbitron'  --tm-font-body 'Rajdhani'
```
Buttons: gold gradient `#ffe574 → #e7a52a`, 14 px radius, gold glow — like the
app's START buttons. Cards: 12–14 px radius, violet border. Never pure black/white.

---

## 6. Screenshots — real app frames only
iPhone, dark, `apptrainingmode.com`, 2× WebP, longest side 1600 px:
1. The current drop's concept page (FIT MODE tab, ROOKIE / NORMAL / ELITE)
2. Fight Focus mid-round with the coach's focus card
3. Combo Coach with a teal `SWITCH!` call (multiple opponents)
4. Training Arcade carousel (drop card first)
5. An Arcade stage pop-up — `CHOOSE YOUR PATH: FIT · FIGHT · BOTH`
6. Cardio Mode setup
No stock photos, no AI hero art (the drop art from `drops.json` is the exception —
it is the app's own art). Preload the first two, lazy-load the rest.

---

## 7. SEO + sharing
```html
<title>Training Mode — Fight & Fit Workout Trainer</title>
<meta name="description" content="A coach in your ear for every round. Fight Mode, Fit Mode, an Arcade you climb, and a new limited training drop every two months.">
<link rel="canonical" href="https://trainingmode.co/">
<meta name="theme-color" content="#080012">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Training Mode">
<meta property="og:title" content="Training Mode — Fight & Fit Workout Trainer">
<meta property="og:description" content="Fight Mode. Fit Mode. A new limited drop every two months.">
<meta property="og:url" content="https://trainingmode.co/">
<meta property="og:image" content="https://apptrainingmode.com/social/training-mode-share-card-template.png">
<meta name="twitter:card" content="summary_large_image">
```
Optional: at build time, set `og:image` to the live drop's `poster.webp` so
shared links preview the current drop.

**Analytics:** add `trainingmode.co` as its **own** site in Plausible and paste
the site-specific snippet Plausible gives you (it is per-site, like the app's
`pa-…js` snippet — don't reuse the app's). Fire custom events:
`install_click {from}`, `drop_click {drop}`, `price_click {plan}`, `coach_mail`.

`robots.txt` allow all; `sitemap.xml` with the one URL.

---

## 8. Not on this page
FAQ · blog · newsletter/email capture · testimonials unless real and attributed
· comparisons to other apps · companion-game screenshots or launch dates ·
any feature the app doesn't ship · character/franchise names (1i) · Stripe links.

---

## 9. Done means
1. `trainingmode.co` returns 200, no console errors on iOS Safari, Android Chrome, desktop Chrome.
2. Lighthouse mobile ≥ 95 in all four; LCP < 2 s, CLS < 0.05.
3. With the device clock in each window, the drop card shows the right drop
   (Oct 23 → Shoto live; Oct 20 → "SHOTO · DROPS OCT 23"; Dec 5 → Ultra Ego).
4. `trainingmode.co/?src=qr` → install button href contains `src=qr`;
   `trainingmode.co/?ch=TMC1.x` redirects straight to `apptrainingmode.com/?ch=TMC1.x`.
5. The five Pro lines match the app's `BENEFITS` byte-for-byte.
6. `grep -iE "ryu|akuma|street fighter|goku|vegeta|dragon ball|ultra instinct|saitama|one.?punch|batman|gotham|wonder woman|skins|avatar tier"` on the built HTML + `drops.json` returns nothing.
7. Sharing the URL in iMessage, Instagram DM and X shows the preview card.
8. Plausible (trainingmode.co site) receives a pageview and an `install_click`.

Then, in the app, set `EXPO_PUBLIC_SHARE_TARGET=site` in Netlify and redeploy
so the share QR points here (PROMPT-SHARE-QR-1).
