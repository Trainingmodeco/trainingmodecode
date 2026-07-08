# 02 · HOME + TRAIN HUB

--- PROMPT 1: Home screen ---

Build the HOME tab:
- Header: small logo wordmark left; right side shows LV badge + 🔥 streak count.
- TODAY'S BOUT hero card (~200px tall): background image /assets/bout-bg.png (cover) under a left-to-right dark gradient + extra rgba(8,1,15,0.35) dim so text pops. Left side: "TODAY'S BOUT" gold Orbitron label, session title (e.g. "FIGHT CONDITIONING · 40 MIN"), sub-line (focus + est. XP), gold "▶ START" button. Right side: the user's current avatar (assets/tiers/{tier}-{gender}.png) in a 100×126 rounded frame with a gold LV number badge top-left. Today's Bout = a recommended session generated daily from the user's discipline, experience and recent history; completing it feeds streak + XP.
- WEEKLY TRACKER card: 7 day-circles (M–S), filled gold for trained days, ring for today, dim for rest; "X OF 7 THIS WEEK" label.
- TRAINING ARCADE preview card (bigger display): current protocol name, mini stage badge image (/assets/stages/s{n}.webp), "STAGE n · NAME" + "UP NEXT" framing, progress "n/10 cleared", CTA "CONTINUE ›". Works like Today's Bout but for the arcade ladder — always tells you the next stage.
- Level/XP bar under header: thin bar, violet→gold gradient fill, "LV n · x/y XP".

--- PROMPT 2: Train hub ---

Build the TRAIN tab — the mode selector:
- Title "TRAIN" + subtitle "Choose your path".
- Three large banner cards (~126px, rounded 14px, full-bleed art + gradient scrim + text): FIGHT MODE (/assets/hub/fight.png, red border glow) "Combo coach · fight focus · practice"; FIT MODE (/assets/hub/fit.png, violet) "Builder · quick mission · cardio"; TRAINING ARCADE (/assets/hub/arcade.png, green) "Timed stages & bosses". Use text overlays, not baked-in image text.
- COMBAT CONDITIONING cross-listed strip below (~88px, /assets/hub/combat-banner.png, red/orange accent): "HYBRID · fit × fight circuit". Tapping it goes to the same Combat Conditioning setup as from Fit Mode.
- Each card navigates to its mode's landing screen.

--- END ---
