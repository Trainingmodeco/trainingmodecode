# Rewards — the three systems, and which is which

There are three separate reward systems in Training Mode. They were built at
different times for different reasons, and confusing them is easy. This is the
map.

| System | Count | Art? | Source | Earned state |
|---|---|---|---|---|
| **Fight Trophies** | 9 | ✅ shipped | `data/fightTrophies.js` | none — derived live from `userStats` |
| **Milestones** | 9 | ❌ glyph | `protocol/data/achievements.json` | `tm_achievements` |
| **Campaign Badges** | 71 | ❌ glyph | each `campaign.json` → `achievements[]` | `tm_achievements` |

All three appear on the Progress tab, now under three distinct headings:
**FIGHT TROPHIES** · **MILESTONES** · **CAMPAIGN BADGES**.

---

## 1 · Fight Trophies (9) — the owner-designed set

These are the nine trophies with commissioned art. They already worked before
the achievements system existed and are **not** managed by
`data/achievements.js`; they have no stored earned-state because each one is
evaluated live from real stats every time the Progress tab renders.

| Trophy | Unlocks on |
|---|---|
| Camp Champion | Clear Training Camp Level 12 — the Title Fight |
| Combo Machine | 1,000 called strikes across fight sessions |
| Sweet Science | Complete 5 Start Here technique lessons |
| Iron Rounds | 100 total fight rounds on the bell |
| Knockout King | 25 fight sessions with every round completed |
| Power Surge | Hit a 50-strike streak in a single session |
| Rhythm Breaker | 10 Combo Coach sessions and 10 Fight Focus sessions |
| Ring General | 500 total fight rounds |
| Shadow Striker | 5,000 total strikes thrown |

**Ghost battles feed these.** A ghost battle IS a Fight Focus session, so it
counts toward Combo Machine, Iron Rounds, Ring General and Shadow Striker.
There is no separate ghost trophy — that connection is indirect and correct.

## 2 · Milestones (9) — cross-cutting protocol goals

From the original Phase-2 protocol spec, not owner-authored. They span the
whole app rather than any one campaign.

Fit Clear · Fight Clear · Full Arc Clear · No-Drop Run · Perfect Defense ·
Late-Round Surge · Tactical Boss Clear · Minimal Equipment Master ·
Consistency Streak

⚠️ **These overlap the trophies conceptually.** "Tactical Boss Clear" and
"Camp Champion" are close to the same idea. Kept for now because
`achievementTriggers.js` awards Fit/Fight/Full-Arc Clear on real campaign
completion, which nothing else tracks — but this is the layer to cut first if
the rewards ever feel bloated.

## 3 · Campaign Badges (71) — per campaign

8–12 per campaign, authored alongside each campaign. Baki's, for example:
Iron Core · The Phantom · One-Punch Power · Sea King · Iron Grip · Ground Flow
· Beat the Ogre · Strongest Teen.

Awarded by `data/achievementTriggers.js` → `onStageClear()`, which parses every
stage number a trigger names and requires all of them cleared — so a badge
naming "stages (1-2)" waits for stage 2 rather than firing on stage 1.

| Campaign | Badges |
|---|---|
| Garou | 12 |
| Sonic | 11 |
| Baki · Berserk · Dark Knight · Gravity · Ultra Ego · Ultra Instinct | 8 each |

---

## Art: how much is actually needed?

**None.** The nine trophies that need art already have it.

Milestones and campaign badges render a themed glyph. That is a deliberate
choice, not a placeholder waiting on a designer — 80 commissioned badges would
be weeks of work for markers most athletes never look at individually.

If more art is ever wanted, the cheapest meaningful step is **one badge per
campaign clear — 8 pieces, not 80.** Everything stage-level stays text.

---

## Where each lives

```
data/fightTrophies.js            trophies (1) — live from stats, has art
data/achievements.js             store for (2) + (3), earned state
data/achievementTriggers.js      awards (2) + (3) on real app events
protocol/data/achievements.json  the 9 milestones
protocol/data/campaigns/*/campaign.json → achievements[]   the 71 badges
ProgressScreen.jsx               renders all three, separately labelled
```
