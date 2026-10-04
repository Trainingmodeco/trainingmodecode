# PROMPT SHARE-QR-1 — a share QR that actually scans, pointing at the app or the site

**Scope: the "QR" panel in the share prompt shown after a workout
(`SharePromptModal`), plus one link switch. Nothing else.** Reference:
`trainingmodeco/trainingmodecode`, branch `app` (the commit that adds this
file). Read the files below and match them line-close; where this prompt and
the source disagree, the source wins.

| Purpose | Path |
|---|---|
| The share prompt with the QR toggle | `components/training-mode/SharePromptModal.jsx` |
| Live QR renderer (SVG) | `components/training-mode/shared/QRCode.jsx` |
| QR encoder (byte mode, EC-L, v1–5, ≤108 bytes) | `components/training-mode/data/qrCode.js` |
| Link constants | `components/training-mode/data/links.js` |
| Poster art used as the frame | `public/social/qr-code-poster.png` (+ `.svg` fallback) |

## 1. The problem
The QR panel showed `public/social/qr-code-poster.png` — generated art whose
QR is **decorative and does not scan** (a QR decoder reads nothing from it).
Every "scan to join" since launch has gone nowhere.

## 2. One switch for where it goes — `data/links.js`
```js
// 'app'  → straight into the PWA (works today)
// 'site' → the trainingmode.co landing page (once PROMPT-WEB-1 is live)
const SHARE_TARGET = process.env.EXPO_PUBLIC_SHARE_TARGET || 'app';
export const SHARE_URL = SHARE_TARGET === 'site'
  ? 'https://trainingmode.co/?src=qr'
  : 'https://apptrainingmode.com/?src=qr';
```
- Default **app** now. Flip to **site** by setting `EXPO_PUBLIC_SHARE_TARGET=site`
  in Netlify and redeploying (EXPO_PUBLIC_* is inlined at build time), or by
  changing the default once the landing page is live.
- `?src=qr` lets Plausible count QR scans as a traffic source.
- Both URLs fit the encoder (36 and 31 bytes; limit 108).

## 3. `QRCode.jsx` — two optional props
- `style` — merged into the `<svg>` style (`{ display:'block', borderRadius:8, ...style }`),
  so a caller can size it with `width/height: '94%'`.
- `label` — the `aria-label` (default stays `'Challenge QR code'`).

## 4. `SharePromptModal.jsx` — poster as the frame, live QR on top
Replace the `<SafeImage src="/social/qr-code-poster.png" …>` block with:
- A square wrapper: `position: relative; width: 100%; maxWidth: 300; margin: 0 auto; aspectRatio: 1/1`.
- The poster `SafeImage` filling it (`position:absolute; inset:0; objectFit:cover; borderRadius:8`).
- Over the poster's QR area: a white box at `left 31.5%, top 37%, width 37%,
  height 37%`, `borderRadius 6`, centred flex, `data-testid="share-qr"`,
  containing `<QRCode value={SHARE_URL} size={200} quiet={2}
  label="Scan to join Training Mode" style={{ width:'94%', height:'94%' }} />`.
- Caption: `Scan to join Training Mode · <host>` (host from `SHARE_URL`, e.g.
  `apptrainingmode.com`).

## 5. Verify
1. `npm run check:all` passes.
2. Finish any session with XP → share prompt → **QR**: the poster shows with a
   crisp QR in the middle. Scan it with a second phone's camera: it opens
   `apptrainingmode.com/?src=qr` (or `trainingmode.co/?src=qr` with `site`).
3. In Plausible, the visit shows `src=qr` as its source.

## 6. Not in scope (tracked in PROMPT-MONEY-90 §4)
Personal referral links and challenge codes in the QR. `PUBLIC_SITE_URL`
(share text links, still `trainingmode.co`) and the hard-coded
`'https://trainingmode.co'` in `ShareActions.jsx` are MONEY-90 §4a — fix them
there, at the same time you decide app vs site.
