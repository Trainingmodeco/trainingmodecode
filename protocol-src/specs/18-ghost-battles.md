# 18 · GHOST BATTLES (build prompts)

Race against the recorded strike-pace of a past VERIFIED session — like a
racing game's ghost lap, for a fight workout. No live multiplayer: a ghost is
saved numbers, replayed. Data model: `protocol-src/data/ghost-battles.json`.
Engine (tested, pure): `protocol-src/engine/ghost-engine.ts`. Designer
visuals: design 40d. Depends on the strike counter (Fight Mode revamp 1.4)
and the anti-cheat verify flag (only verified sessions become ghosts).

--- PROMPT 1: Record ghosts on every verified session ---

Wire ghost recording into the Fight Mode session runner:
- During any Fight Mode session (Combo Coach, Fight Focus, Arcade fight,
  Camp fight), collect strike timestamps from the existing strike counter.
- On completion, if the session PASSED the anti-cheat integrity check, build
  a ghost with `makeGhost(...)` (it returns null for unverified sessions —
  those never become ghosts). Store it locally as the user's ghost for that
  mode/discipline/difficulty; keep MY BEST (highest verified total) per
  mode+discipline.
- Ghost = per-10s strike buckets + totals + display identity (avatar tier,
  name). Small; safe to store and share. Never auto-publish — sharing is
  user-initiated (Prompt 4).

--- PROMPT 2: Ghost battle session (the race) ---

Add a ghost-battle run built on the existing Combo Coach / Fight Focus timer:
- SETUP inherits the ghost's rounds_config (you fight its format — show it
  read-only for a fair race).
- LIVE HUD (design 40d): split strike bar at top — your avatar + live strike
  count (gold) vs the ghost's avatar + replayed count (violet). Drive the
  ghost number every tick with `ghostCountAtTime(ghost, elapsedSec)` so it
  climbs in real time — it should FEEL like they're punching now. Lead chip
  between them from `liveLead(...)` ("+12 AHEAD" green / "-8 BEHIND" red).
  Per-round mini bars underneath.
- END: `resolveGhostBattle(you, ghost)` → VICTORY (gold radial) / DEFEAT
  (red) / TIE. Both avatars faced off, per-round comparison, totals (STRIKES
  · BEST ROUND · MARGIN), "↻ REMATCH" + "SET AS CHALLENGE" + share card
  (both avatars + result + the VERIFIED shield). Victory grants bonus XP; a
  loss still grants the normal session XP — never punish showing up.

--- PROMPT 3: Surfacing — Combo Coach icon + VS pop-up ---

Two entry points beyond the outcome screen (per product direction + 40d):
- COMBO COACH GHOST ICON: a small 👻 icon on the Combo Coach setup screen,
  visible from the start. Tap → ghost opponent picker (MY BEST / recent
  ghosts / "⚔ ENTER CHALLENGE CODE") → starts a ghost battle using Combo
  Coach. Empty state (no ghost yet): keep the icon, explain "Finish a
  session to create your first ghost, then race it." Suggested opponents use
  `pickSuggestedGhost(...)` (a ghost within ~15% of your best — beatable but
  challenging).
- VS POP-UP: an occasional fighting-game "VS" screen. Gate it with
  `shouldShowVsPrompt(state, today)` — at most once every ~2 days, ONLY when
  there's a fresh event (a newly downloaded friend ghost, or "someone beat
  your challenge"), and NEVER mid-session. Content: both avatars faced off,
  the challenge ("RYAN threw 214 — beat it"), gold "ACCEPT · VS" (starts the
  matching session) + "later". Always dismissible; dismissing doesn't
  re-prompt the same event.

--- PROMPT 4: Challenge codes + verified sharing ---

- On every verified Fight Mode outcome screen, "SET AS CHALLENGE" generates a
  short challenge code / share link carrying the ghost record.
- Recipient enters the code (or opens the link) → downloads the ghost into
  their RECENT GHOSTS → can race it.
- ONLY verified ghosts can be set as a challenge — surface this as a feature:
  "Ghosts are verified. No fake scores." The share card carries the VERIFIED
  shield so the claim travels with every share.
- Privacy: sharing is opt-in; only the ghost_record fields (pace + display
  identity) are shared — no location, no health data. Downloaded ghosts
  replay locally (recordings, not live connections).

--- END ---
