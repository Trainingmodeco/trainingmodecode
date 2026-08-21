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
   ├── styles.css
   ├── script.js
   ├── 404.html
   ├── favicon.ico
   ├── robots.txt
   ├── sitemap.xml
   ├── .htaccess        ← IMPORTANT: hidden file — enable "show hidden
   │                      files" in Hostinger File Manager or it won't upload
   └── assets/
       ├── fonts/…
       ├── tiers/…
       ├── features/…
       ├── phones/…
       ├── social/…
       ├── app-icon.webp
       ├── logo-mark.png
       └── training-mode-logo.png
   ```
5. Visit https://trainingmode.co in a private/incognito window (Hostinger
   caches aggressively — if you see the old site, clear the cache under
   hPanel → Website → Cache Manager).

## Links to double-check before/after upload

- "Go To App" buttons and the Google Play store button point to
  `https://play.google.com/store/apps/details?id=app.trainingmode.pro`.
- The App Store button, Subscribe button, and the social icons in the
  footer are placeholders (`#app-store-placeholder`, `#subscribe-placeholder`,
  `#instagram-placeholder`, …) — swap in the real URLs when ready.
- "Join Community" and the contact form hand off to
  `mailto:trainingmode.co@gmail.com`. Replace the form with a real
  newsletter endpoint (e.g. Mailchimp, Beehiiv) when you have one.

## After deploying — 404 / SEO checklist

- `.htaccess` 301-redirects the old site's pages (`/about`,
  `/training-paths`, `/try-beta`, `/founders-club`, `/investors`, …) to the
  matching sections of the new single-page site, and serves the branded
  `404.html` for anything else. Delete the old site's leftover folders from
  `public_html` so stale half-broken pages stop being served.
- Verify after upload: `trainingmode.co/favicon.ico`,
  `/robots.txt`, `/sitemap.xml`, `/founders-club` (should redirect), and a
  garbage URL like `/asdf` (should show the branded 404 page).
- Submit `https://trainingmode.co/sitemap.xml` in Google Search Console —
  it also shows every 404 Google has found, with the exact URLs.
- The footer social icons are commented out in `index.html` until you add
  the real profile URLs (dead links get flagged by audit tools).

## Notes

- Fonts (Orbitron / Rajdhani) are self-hosted in `assets/fonts/` — no
  Google Fonts dependency, faster first paint.
- Total page weight is roughly 0.9 MB, mostly the hero art. All images are
  lazy-loaded except the hero.
- The page is a single dark theme by design, matching the app.
