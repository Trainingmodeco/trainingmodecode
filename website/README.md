# trainingmode.co — the website

The marketing site, kept here next to the app so everything lives in one
place. It is plain HTML, CSS and JavaScript (no build step) and is hosted on
Hostinger, separately from the app (apptrainingmode.com on Netlify). Nothing
in this folder changes how the app builds or deploys.

## Preview

- Claude desktop app: open the preview pane and pick **website**.
- Terminal: `npm run website`, then open http://localhost:5050

## Publish

Upload the contents of this folder to Hostinger's `public_html`
(File Manager → public_html → upload, or zip it and extract there).
Back up the live `public_html` first and clear Hostinger's cache after.
