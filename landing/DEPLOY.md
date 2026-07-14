# Deploying the Landing Page to Hostinger

This folder is the complete redesigned trainingmode.co landing page. It is
fully static — one HTML file plus an `assets/` folder (images already
optimized, fonts self-hosted). No build step, no server code.

## Upload steps (Hostinger hPanel)

1. Log in to Hostinger → **Websites** → trainingmode.co → **File Manager**
   (or connect via FTP).
2. Open the site's web root: `public_html/`.
3. **Back up the current site first**: select the existing files →
   Download (or rename `index.html` to `index-old.html`).
4. Upload the contents of this `landing/` folder into `public_html/` so it
   looks like:
   ```
   public_html/
   ├── index.html
   └── assets/
       ├── fonts/…
       ├── hub/…
       ├── tiers/…
       ├── fitmode/…
       ├── trophies/…
       ├── hero-enter.webp
       ├── app-bg.webp
       ├── app-icon.webp
       └── logo-mark.png
   ```
5. Visit https://trainingmode.co in a private/incognito window (Hostinger
   caches aggressively — if you see the old site, clear the cache under
   hPanel → Website → Cache Manager).

## Links to double-check before/after upload

- Both gold CTAs ("Enter Training Mode" / "Join the Beta") currently point
  to the Google Play listing:
  `https://play.google.com/store/apps/details?id=app.trainingmode.pro`
  Swap these if you have a different beta signup link (TestFlight, form, etc.).
- The "Send Feedback" button and footer link use
  `mailto:trainingmode.co@gmail.com`.

## Notes

- Fonts (Orbitron / Rajdhani) are self-hosted in `assets/fonts/` — no
  Google Fonts dependency, faster first paint.
- Total page weight is roughly 0.9 MB, mostly the hero art. All images are
  lazy-loaded except the hero.
- The page is a single dark theme by design, matching the app.
