# Platforms: where each post goes and how

Status as of 2026-10-30. Update this file when a connection changes.

| Platform | Route | Status |
|---|---|---|
| TikTok | Higgsfield connector (`tiktok_*` tools) | Higgsfield connected (Ultra plan); **TikTok account not linked yet**: run `tiktok_connect` and open the link it returns |
| Instagram | Claude in Chrome → Meta Business Suite (laptop) | needs Claude in Chrome on the laptop |
| Facebook | same as Instagram (Business Suite posts to both) | same |
| YouTube | Claude in Chrome → YouTube Studio (laptop) | API later (below) |
| Reddit | drafts only, owner posts | n/a |
| ManyChat | Instagram comment → DM | account created; flow in `manychat.md` |
| Google Drive | Drive connector (the Training Mode Google account) | connected; source of the scripts |

## Video spec (one master fits all)

1080×1920, 30 fps, H.264 + AAC, under 60 s for full reach everywhere
(`npm run render` produces exactly this). Cover: `exports/<id>/cover.jpg`.
Keep text out of the bottom ~350 px and right ~140 px (platform buttons).

## Caption style per platform

- **TikTok**: one punchy line, what it is, "Link in bio", 3–5 hashtags.
- **Instagram**: hook line, 2–3 short lines on what the app does, **"Comment
  TRAIN and I'll DM you the link."** (ManyChat), 5–8 hashtags at the end.
  Max 2,200 characters, 30 hashtags.
- **Facebook**: like Instagram, fewer hashtags, "Comment TRAIN for the link."
- **YouTube Shorts**: title under 100 characters ending in `#shorts`,
  description with the full link `https://apptrainingmode.com`, 5–8 tags.
- **Reddit**: no ads. A real post written for that sub (build story for
  r/SideProject or r/apps; useful workout or technique for fitness and combat
  subs; app link only where the sub allows it). Owner posts it.

Hashtag pool: #trainingmode #combatfitness #shadowboxing #boxingworkout
#homeworkout #kickboxing #muaythai #mma #fitnessapp #gymmotivation
#animegym.

## Later: full automation (step 2)

- **YouTube Data API**: Google Cloud project → enable YouTube Data API v3 →
  OAuth consent screen → OAuth client. Uploads from an unverified project are
  forced private until Google's audit passes, so keep the Chrome route until
  then.
- **Meta Graph API** (Instagram + Facebook): Instagram must be a Professional
  account linked to the Facebook Page; a Meta developer app with
  `instagram_content_publish`; the video must be at a public URL when posted.
- **Reddit API**: script app at reddit.com/prefs/apps, used for drafts and
  scheduling only, never blind posting.
