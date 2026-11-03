# trainingmode.co

The marketing site for Training Mode. Plain HTML, CSS and vanilla JS with no build step. The app (apptrainingmode.com) is the rest of this repo.

Copied from `Trainingmodeco/trainingmode-website` at commit `8ecb020` (Oct 6 2026). Until the Netlify project is pointed at this folder, the live site still deploys from that repo, so a change made here only goes live once it's also made there (or once Netlify is re-pointed).

## Preview

- Claude desktop: pick **website** in the preview pane.
- Terminal: `npm run website` from the repo root, then open http://localhost:5050. Pages reload from disk, so refresh after an edit.

| Page | File |
|---|---|
| Home | `index.html` (stages 01–06: hero, Pick your mode, the saga carousel, No fake reps, testimonials, sign-up) |
| Features | `features.html` |
| FAQ | `faq.html` |
| Feedback / beta | `beta.html` (embeds the Google Form) |

Styles: `css/concept-shared.css` (app tokens and `.tm-*` components), `css/concept-home.css`, `css/concept-features.css`, plus the older `css/site.css`. Scripts: `js/home.js` (tabs, Stage 02 cards, saga carousel, testimonials, email form), `js/install-modal.js` (any `data-install` link opens the install sheet), `js/main.js`.

## Hosting

Netlify project `stellar-youtiao-f5f163`. The domain's DNS is at Hostinger. `_redirects` and `_headers` are Netlify config. `.htaccess` is unused on Netlify and kept for portability.

## Deploying

**In `Trainingmodeco/trainingmode-website`, every push to `main` deploys to production automatically.** Netlify is linked to that repo for now. There's no build step: `netlify.toml` publishes the repo root after deleting `_tools/`, this README and the git dotfiles from the build copy. Pull requests and other branches get deploy previews, which don't affect the live site.

1. Edit, then run the checks below.
2. Commit and push to `main` (of the deploying repo).
3. Watch the deploy on app.netlify.com → the project → Deploys, then check the live site.

Fallback if Netlify can't build from git: run `powershell -NoProfile -ExecutionPolicy Bypass -File _tools\make-deploy-zip.ps1` and drop the zip onto Deploys → "browse files to upload". It skips the same repo-only files.

## Rules that bite

- **Cache:** `_headers` caches `/css/*` and `/js/*` for 7 days and `/assets/*` for 30 days. When you edit an existing CSS or JS file, bump its `?v=` in the HTML that loads it. When you change an image, give it a new filename rather than overwriting it.
- **Saga names and art follow the app.** The carousel (`#sagaCar` in `index.html`) and the features shelf list the 13 sagas from the app's `VISIBLE_SERIES_IDS` (`components/training-mode/data/trainingArcadeData.js`). Posters are the app's titleless art, saved under `assets/arcade/sagas/<title-slug>.webp` (560 px wide) and `-sm.webp` (380 px wide). When the app renames a saga, update both places.
- **Wording:** "Free to start" everywhere, never "free during beta". Every CTA is START FREE, which opens the install sheet.

## Checks

Use the scripts in `_tools/` (Node + `playwright-core` + system Chrome). Run them from this folder with `NODE_PATH=../node_modules` (the app's `node_modules`):

- `node _tools/check-page.cjs . index.html` checks one page at 1440 px and 390 px: errors, broken images, sideways scroll.
- `node _tools/verify-stage02.cjs <dir|https://trainingmode.co> <prefix>` tests Stage 02 (goal row, mode cards, row previews) at desktop, tablet and phone widths.
- `node _tools/verify-carousel.cjs <dir|https://trainingmode.co> <prefix>` tests the saga carousel and the follow links.

The two verify scripts save screenshots to a `shots/` folder next to themselves, and git ignores that folder.
