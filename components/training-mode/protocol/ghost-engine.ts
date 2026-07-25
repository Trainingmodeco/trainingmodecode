/**
 * Ghost Battles — pure engine.
 * A ghost is the recorded per-interval strike output of a VERIFIED session.
 * You race its replay (no live multiplayer). Framework-free; drop in anywhere.
 * Config + data model: ../data/ghost-battles.json. Share card: design 40e.
 */

export type GhostMode = "combo_coach" | "fight_focus" | "arcade" | "camp";
export type Difficulty = "easy" | "normal" | "hard";
export type BattleOutcome = "victory" | "defeat" | "tie";

/**
 * How a ghost battle is decided:
 * - "strikes": more verified strikes wins — open sessions (Combo Coach / Fight
 *   Focus) with no fixed end.
 * - "time": faster completion wins — stage-based runs (Arcade / Camp) that have
 *   a defined finish. This is what designer card 40e shows ("26s FASTER").
 */
export type WinMetric = "strikes" | "time";

export interface RoundsConfig { rounds: number; roundSec: number; restSec: number; }

export interface GhostRecord {
  ghostId: string;
  ownerId: string;
  ownerName: string;
  avatarTier: string;
  gender: "male" | "female";
  source: { mode: GhostMode; disciplineOrCampaign: string; difficulty: Difficulty; roundsConfig: RoundsConfig };
  winMetric: WinMetric;    // "strikes" (open sessions) | "time" (stage runs)
  bucketSec: number;       // interval size, default 10
  buckets: number[];       // strikes per interval across the session (drives live replay in BOTH metrics)
  totalStrikes: number;
  bestRound: number;       // highest single-round strike count (strikes tiebreak)
  completionSec?: number;  // total time to finish — required for winMetric "time"
  stageLabel?: string;     // e.g. "Stage 3" — for the share card (40e)
  streak?: number;         // streak at run time — secondary stat on the card (40e)
  verified: boolean;       // only verified sessions may become ghosts
  createdAt: number;       // stamped by the app, not the engine
}

// ---------- Recording ----------

/**
 * Bucket a list of strike timestamps (seconds from session start) into
 * fixed intervals so a ghost can be replayed. Rest phases naturally produce
 * empty buckets. Pass the session's total duration so trailing empty
 * intervals are preserved (keeps ghost and live clocks aligned).
 */
export function bucketStrikes(strikeTimesSec: number[], totalSec: number, bucketSec = 10): number[] {
  const n = Math.max(1, Math.ceil(totalSec / bucketSec));
  const buckets = new Array(n).fill(0);
  for (const t of strikeTimesSec) {
    if (t < 0 || t >= totalSec) continue;
    buckets[Math.floor(t / bucketSec)] += 1;
  }
  return buckets;
}

/**
 * Build a ghost record from a finished session. Returns null if the session
 * was NOT verified — unverified sessions can never become ghosts.
 */
export function makeGhost(
  input: Omit<GhostRecord, "buckets" | "totalStrikes" | "bestRound"> & {
    strikeTimesSec: number[];
    totalSec: number;
    perRoundStrikes: number[];
  }
): GhostRecord | null {
  if (!input.verified) return null;
  const buckets = bucketStrikes(input.strikeTimesSec, input.totalSec, input.bucketSec || 10);
  return {
    ghostId: input.ghostId,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    avatarTier: input.avatarTier,
    gender: input.gender,
    source: input.source,
    winMetric: input.winMetric,
    bucketSec: input.bucketSec || 10,
    buckets,
    totalStrikes: buckets.reduce((a, b) => a + b, 0),
    bestRound: input.perRoundStrikes.length ? Math.max(...input.perRoundStrikes) : 0,
    completionSec: input.completionSec,
    stageLabel: input.stageLabel,
    streak: input.streak,
    verified: true,
    createdAt: input.createdAt,
  };
}

// ---------- Replay ----------

/**
 * The ghost's cumulative strike count at a given elapsed time — call every
 * tick to drive the on-screen ghost counter so it "punches" in real time.
 * Interpolates within the current bucket for a smooth climb.
 */
export function ghostCountAtTime(ghost: GhostRecord, elapsedSec: number): number {
  const { buckets, bucketSec } = ghost;
  if (elapsedSec <= 0) return 0;
  const full = Math.floor(elapsedSec / bucketSec);
  let count = 0;
  for (let i = 0; i < Math.min(full, buckets.length); i++) count += buckets[i];
  if (full < buckets.length) {
    const frac = (elapsedSec - full * bucketSec) / bucketSec;
    count += Math.floor(buckets[full] * frac);
  }
  return count;
}

/** Live lead: +ve = user ahead, -ve = behind. For the HUD lead chip. */
export function liveLead(ghost: GhostRecord, elapsedSec: number, yourStrikes: number): number {
  return yourStrikes - ghostCountAtTime(ghost, elapsedSec);
}

// ---------- Resolve ----------

export interface BattleResult {
  outcome: BattleOutcome;
  metric: WinMetric;
  yourValue: number;       // your strikes (strikes) or your seconds (time)
  ghostValue: number;      // ghost's strikes or seconds
  margin: number;          // strikes: +ve = you threw more · time: +ve = you were FASTER (ghostSec - yourSec)
  decidedByTiebreak: boolean;
}

/**
 * Decide the battle at session end, per the ghost's win metric.
 * - strikes: more verified strikes wins; tie broken by best round; else draw.
 * - time: faster completion wins (lower seconds); tie broken by more strikes;
 *   else draw.
 * A loss is still a completed session (app grants normal XP; victory adds
 * bonus) — never punish showing up.
 */
export function resolveGhostBattle(
  you: { totalStrikes: number; bestRound: number; completionSec?: number },
  ghost: GhostRecord
): BattleResult {
  if (ghost.winMetric === "time") {
    const yourSec = you.completionSec ?? Infinity;
    const ghostSec = ghost.completionSec ?? Infinity;
    const margin = ghostSec - yourSec;                 // +ve = you were faster
    if (margin !== 0 && Number.isFinite(margin)) {
      return { outcome: margin > 0 ? "victory" : "defeat", metric: "time", yourValue: yourSec, ghostValue: ghostSec, margin, decidedByTiebreak: false };
    }
    const tb = you.totalStrikes - ghost.totalStrikes;  // tie on time → more strikes wins
    if (tb !== 0) {
      return { outcome: tb > 0 ? "victory" : "defeat", metric: "time", yourValue: yourSec, ghostValue: ghostSec, margin: 0, decidedByTiebreak: true };
    }
    return { outcome: "tie", metric: "time", yourValue: yourSec, ghostValue: ghostSec, margin: 0, decidedByTiebreak: true };
  }

  const margin = you.totalStrikes - ghost.totalStrikes;
  if (margin !== 0) {
    return { outcome: margin > 0 ? "victory" : "defeat", metric: "strikes", yourValue: you.totalStrikes, ghostValue: ghost.totalStrikes, margin, decidedByTiebreak: false };
  }
  const tb = you.bestRound - ghost.bestRound;
  if (tb !== 0) {
    return { outcome: tb > 0 ? "victory" : "defeat", metric: "strikes", yourValue: you.totalStrikes, ghostValue: ghost.totalStrikes, margin: 0, decidedByTiebreak: true };
  }
  return { outcome: "tie", metric: "strikes", yourValue: you.totalStrikes, ghostValue: ghost.totalStrikes, margin: 0, decidedByTiebreak: true };
}

/**
 * The share-card headline (design 40e), e.g. "▲ 26s FASTER · GHOST DEFEATED"
 * or "▲ +12 STRIKES · GHOST DEFEATED". Pure string formatting for the card.
 */
export function battleHeadline(r: BattleResult): string {
  if (r.outcome === "tie") return "DEAD HEAT · DRAW";
  const beat = r.outcome === "victory";
  const tag = beat ? "GHOST DEFEATED" : "GHOST WINS";
  const arrow = beat ? "▲" : "▼";
  if (r.metric === "time") {
    const secs = Math.abs(Math.round(r.margin));
    return `${arrow} ${secs}s ${beat ? "FASTER" : "SLOWER"} · ${tag}`;
  }
  const n = Math.abs(r.margin);
  return `${arrow} ${beat ? "+" : "-"}${n} STRIKES · ${tag}`;
}

// ---------- Matchmaking ----------

/**
 * Pick a "suggested" ghost near the user's own best — a beatable but
 * challenging race (within `tolerance`, default ±15%). Falls back to the
 * user's own best ghost if nothing fits. Never returns an unverified ghost.
 */
export function pickSuggestedGhost(
  pool: GhostRecord[],
  userBestTotal: number,
  myBest: GhostRecord | null,
  tolerance = 0.15
): GhostRecord | null {
  const lo = userBestTotal * (1 - tolerance);
  const hi = userBestTotal * (1 + tolerance);
  const inBand = pool
    .filter((g) => g.verified && g.totalStrikes >= lo && g.totalStrikes <= hi)
    .sort((a, b) => Math.abs(a.totalStrikes - userBestTotal) - Math.abs(b.totalStrikes - userBestTotal));
  return inBand[0] ?? myBest ?? null;
}

// ---------- VS pop-up cadence ----------

export interface VsPromptState {
  lastPromptDay: number | null;   // day-number of last VS pop-up shown
  hasFreshEvent: boolean;         // a new friend ghost, or "someone beat your challenge"
  inActiveSession: boolean;
}

/**
 * Whether to show the occasional VS-mode pop-up. At most once every
 * `minDaysBetween` (default 2), only with a fresh event, never mid-session.
 * `today` is a day-number the app supplies (engine stays time-free).
 */
export function shouldShowVsPrompt(state: VsPromptState, today: number, minDaysBetween = 2): boolean {
  if (state.inActiveSession || !state.hasFreshEvent) return false;
  if (state.lastPromptDay === null) return true;
  return today - state.lastPromptDay >= minDaysBetween;
}
