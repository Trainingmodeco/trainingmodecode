const INTEGRITY_LOG_KEY = 'tm_integrity_log';

// --- Validity Statuses ---
export const VALIDITY = {
  VALID: 'valid',
  TOO_FAST: 'tooFast',
  EXPIRED: 'expired',
  IDLE_TIMEOUT: 'idleTimeout',
  SKIPPED: 'skipped',
  INCOMPLETE: 'incomplete',
  SUSPICIOUS: 'suspicious',
};

// --- Default integrity rules per mode ---
export const MODE_RULES = {
  quickMission: {
    minValidSeconds: 8,
    maxValidSeconds: 600,
    maxIdleSeconds: 300,
    maxRapidActions: 5,
    allowPartialCredit: true,
    allowPause: true,
    validationMode: 'rounds',
    failAction: 'partialCredit',
    rapidWindowMs: 3000,
  },
  combatConditioning: {
    minValidSeconds: 10,
    maxValidSeconds: 600,
    maxIdleSeconds: 300,
    maxRapidActions: 5,
    allowPartialCredit: true,
    allowPause: true,
    validationMode: 'circuit',
    failAction: 'partialCredit',
    rapidWindowMs: 3000,
  },
  fightFocus: {
    minValidSeconds: 15,
    maxValidSeconds: 900,
    maxIdleSeconds: 300,
    maxRapidActions: 4,
    allowPartialCredit: true,
    allowPause: true,
    validationMode: 'rounds',
    failAction: 'partialCredit',
    rapidWindowMs: 2500,
  },
  comboCoach: {
    minValidSeconds: 15,
    maxValidSeconds: 900,
    maxIdleSeconds: 300,
    maxRapidActions: 4,
    allowPartialCredit: true,
    allowPause: true,
    validationMode: 'rounds',
    failAction: 'partialCredit',
    rapidWindowMs: 2500,
  },
  trainingArcade: {
    minValidSeconds: 12,
    maxValidSeconds: 1200,
    maxIdleSeconds: 240,
    maxRapidActions: 3,
    allowPartialCredit: true,
    allowPause: true,
    validationMode: 'hybrid',
    failAction: 'noXpRetry',
    rapidWindowMs: 2000,
    strictMode: true,
  },
};

// --- Session Tracker Class ---
export class IntegritySession {
  constructor(mode, totalUnits, rules) {
    this.mode = mode;
    this.rules = rules || MODE_RULES[mode] || MODE_RULES.quickMission;
    this.totalUnits = totalUnits;
    this.units = [];
    this.missionStartedAt = Date.now();
    this.missionEndedAt = null;
    this.lastUserActionAt = Date.now();
    this.rapidActions = [];
    this.backgroundedCount = 0;
    this.pausedAt = null;
    this.totalPausedMs = 0;
    this.currentUnitIndex = -1;
    this._visibilityHandler = null;
    this._setupVisibilityListener();
  }

  _setupVisibilityListener() {
    if (typeof document === 'undefined') return;
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.backgroundedCount++;
        if (this.rules.allowPause && this.currentUnitIndex >= 0) {
          this._autoPauseCurrentUnit();
        }
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  _autoPauseCurrentUnit() {
    const unit = this.units[this.currentUnitIndex];
    if (unit && !unit.completedAt && !unit._pausedAt) {
      unit._pausedAt = Date.now();
    }
  }

  destroy() {
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  startUnit(unitType) {
    const unit = {
      unitId: `${this.mode}_${Date.now()}_${this.units.length}`,
      unitType: unitType || this.rules.validationMode,
      startedAt: Date.now(),
      completedAt: null,
      activeElapsedSeconds: 0,
      pausedElapsedSeconds: 0,
      idleElapsedSeconds: 0,
      minValidSeconds: this.rules.minValidSeconds,
      maxValidSeconds: this.rules.maxValidSeconds,
      validityStatus: VALIDITY.INCOMPLETE,
      _pausedAt: null,
    };
    this.units.push(unit);
    this.currentUnitIndex = this.units.length - 1;
    this.lastUserActionAt = Date.now();
    return unit;
  }

  completeUnit() {
    const unit = this.units[this.currentUnitIndex];
    if (!unit || unit.completedAt) return null;

    unit.completedAt = Date.now();
    const totalMs = unit.completedAt - unit.startedAt;
    const pausedMs = unit.pausedElapsedSeconds * 1000;
    unit.activeElapsedSeconds = Math.max(0, (totalMs - pausedMs) / 1000);

    unit.validityStatus = this._validateUnit(unit);
    this.lastUserActionAt = Date.now();
    return unit;
  }

  skipUnit() {
    const unit = this.units[this.currentUnitIndex];
    if (unit && !unit.completedAt) {
      unit.completedAt = Date.now();
      unit.validityStatus = VALIDITY.SKIPPED;
    }
  }

  pauseSession() {
    this.pausedAt = Date.now();
    const unit = this.units[this.currentUnitIndex];
    if (unit && !unit.completedAt) {
      unit._pausedAt = Date.now();
    }
  }

  resumeSession() {
    if (this.pausedAt) {
      this.totalPausedMs += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
    const unit = this.units[this.currentUnitIndex];
    if (unit && unit._pausedAt) {
      unit.pausedElapsedSeconds += (Date.now() - unit._pausedAt) / 1000;
      unit._pausedAt = null;
    }
    this.lastUserActionAt = Date.now();
  }

  recordAction(actionType) {
    const now = Date.now();
    this.lastUserActionAt = now;
    this.rapidActions.push({ type: actionType, at: now });

    const windowStart = now - this.rules.rapidWindowMs;
    this.rapidActions = this.rapidActions.filter(a => a.at >= windowStart);

    if (this.rapidActions.length > this.rules.maxRapidActions) {
      const unit = this.units[this.currentUnitIndex];
      if (unit && !unit.completedAt) {
        unit.validityStatus = VALIDITY.SUSPICIOUS;
      }
      return { suspicious: true, message: 'Action too fast to verify.' };
    }
    return { suspicious: false };
  }

  checkIdle() {
    const elapsed = (Date.now() - this.lastUserActionAt) / 1000;
    if (elapsed > this.rules.maxIdleSeconds) {
      const unit = this.units[this.currentUnitIndex];
      if (unit && !unit.completedAt) {
        unit.idleElapsedSeconds = elapsed;
        unit.validityStatus = VALIDITY.IDLE_TIMEOUT;
        unit.completedAt = Date.now();
      }
      return { idle: true, message: 'Session paused due to inactivity.' };
    }
    return { idle: false };
  }

  finalize(motion) {
    this.missionEndedAt = Date.now();

    const unit = this.units[this.currentUnitIndex];
    if (unit && !unit.completedAt) {
      unit.completedAt = Date.now();
      unit.validityStatus = VALIDITY.INCOMPLETE;
    }

    return calculateMissionIntegrity(this, motion);
  }

  _validateUnit(unit) {
    if (unit.validityStatus === VALIDITY.SUSPICIOUS) return VALIDITY.SUSPICIOUS;
    if (unit.activeElapsedSeconds < unit.minValidSeconds) return VALIDITY.TOO_FAST;
    if (unit.activeElapsedSeconds > unit.maxValidSeconds) return VALIDITY.EXPIRED;
    if (unit.idleElapsedSeconds > this.rules.maxIdleSeconds) return VALIDITY.IDLE_TIMEOUT;
    return VALIDITY.VALID;
  }
}

// --- Core calculation functions ---

// 1.6 — on-body strike count (per completed round) that earns the motion-
// verified ✓ bonus. Bonus-only: falling short is NEVER penalized, so the bar
// can stay meaningful without risking a false flag on a phone that's off the
// body. Kept generous so a genuine in-pocket/on-wrap session clears it. Real-
// device calibration still pending a phone.
const VERIFY_STRIKES_PER_UNIT = 6;

export function calculateMissionIntegrity(session, motion = {}) {
  const validUnits = session.units.filter(u => u.validityStatus === VALIDITY.VALID);
  const validCompletedUnits = validUnits.length;
  const totalRequiredUnits = session.totalUnits;
  const partialCompletionRatio = totalRequiredUnits > 0
    ? validCompletedUnits / totalRequiredUnits
    : 0;

  const isFullyValid = validCompletedUnits >= totalRequiredUnits;
  const isPartiallyValid = validCompletedUnits > 0 && !isFullyValid;

  let validityStatus = 'incomplete';
  if (isFullyValid) {
    validityStatus = 'complete';
  } else if (isPartiallyValid) {
    validityStatus = 'partial';
  } else {
    const lastUnit = session.units[session.units.length - 1];
    if (lastUnit) {
      if (lastUnit.validityStatus === VALIDITY.TOO_FAST) validityStatus = 'tooFast';
      else if (lastUnit.validityStatus === VALIDITY.EXPIRED) validityStatus = 'expired';
      else if (lastUnit.validityStatus === VALIDITY.IDLE_TIMEOUT) validityStatus = 'idleTimeout';
      else if (lastUnit.validityStatus === VALIDITY.SUSPICIOUS) validityStatus = 'suspicious';
    }
  }

  const rules = session.rules;
  let awardXp = false;
  let xpMultiplier = 0;

  if (isFullyValid) {
    awardXp = true;
    xpMultiplier = 1.0;
  } else if (isPartiallyValid && rules.allowPartialCredit) {
    if (partialCompletionRatio >= 0.25) {
      awardXp = true;
      xpMultiplier = partialCompletionRatio;
    } else {
      awardXp = false;
      xpMultiplier = 0;
    }
  }

  const message = getResultMessage(validityStatus, validCompletedUnits, totalRequiredUnits, partialCompletionRatio);

  // 1.6 (revamped) — motion is a POSITIVE-ONLY signal, never a gate.
  //
  // A phone's accelerometer can only feel strikes when the phone is ON the
  // athlete (pocket, armband, hand wraps). But the common — and correct — setup
  // is the phone OFF the body: on the floor by the bag, propped up, or mounted
  // to watch the timer. A stationary phone there is the NORMAL case, and the
  // accelerometer genuinely cannot tell "phone on the floor, working hard" from
  // "did nothing." Penalizing a low count would false-flag that exact setup.
  //
  // So motion NEVER subtracts trust and NEVER withholds credit. It can only ADD
  // a verification bonus when on-body strikes are clearly detected. The baseline
  // anti-cheat remains the time / idle / rapid-action gate computed above, which
  // holds no matter where the phone sits. Real motion verification for the
  // competitive layer will come from camera pose tracking later (see Phase 3),
  // which works precisely for the mounted/floor-facing setup.
  const motionUsed = !!motion.motionUsed;
  const strikesThrown = Math.max(0, Math.round(motion.thrown || 0));
  let effort = 'unmeasured';   // motion off, or phone off-body — no signal, no penalty
  let motionVerified = false;
  const leaderboardEligible = isFullyValid;   // time gate only; motion never gates

  if (motionUsed && validCompletedUnits > 0 && strikesThrown > 0) {
    if (strikesThrown >= validCompletedUnits * VERIFY_STRIKES_PER_UNIT) {
      effort = 'verified';       // clearly on-body + working → ✓ bonus
      motionVerified = true;
    } else {
      effort = 'measured';       // some on-body motion, below the ✓ bar — no penalty
    }
  }

  return {
    isFullyValid,
    isPartiallyValid,
    validCompletedUnits,
    totalRequiredUnits,
    partialCompletionRatio,
    validityStatus,
    awardXp,
    xpMultiplier,
    message,
    leaderboardEligible,
    effort,
    motionUsed,
    motionVerified,
    strikesThrown,
  };
}

export function validateMissionUnit(unit, rules) {
  if (unit.activeElapsedSeconds < (rules.minValidSeconds || 8)) return VALIDITY.TOO_FAST;
  if (unit.activeElapsedSeconds > (rules.maxValidSeconds || 600)) return VALIDITY.EXPIRED;
  if (unit.idleElapsedSeconds > (rules.maxIdleSeconds || 300)) return VALIDITY.IDLE_TIMEOUT;
  return VALIDITY.VALID;
}

export function calculatePartialXp(baseXp, validCompletedUnits, totalRequiredUnits) {
  if (totalRequiredUnits <= 0) return 0;
  const ratio = validCompletedUnits / totalRequiredUnits;
  if (ratio >= 1) return baseXp;
  if (ratio < 0.25) return 0;
  return Math.round(baseXp * ratio);
}

export function shouldAwardLeaderboardCredit(integrityResult) {
  return integrityResult.isFullyValid && integrityResult.leaderboardEligible;
}

// --- Result messages ---

function getResultMessage(status, valid, total, ratio) {
  switch (status) {
    case 'complete':
      return 'Mission Complete';
    case 'partial':
      return `Partial Completion - ${valid} of ${total} valid rounds completed`;
    case 'tooFast':
      if (valid > 0) return `Partial Completion - ${valid} verified rounds`;
      return 'Too Fast to Verify - No XP Awarded';
    case 'expired':
      if (valid > 0) return `Session Expired - ${valid} valid rounds counted`;
      return 'Stage Expired - No XP Awarded';
    case 'idleTimeout':
      if (valid > 0) return `Session Expired - ${valid} valid rounds counted`;
      return 'Session Expired due to inactivity';
    case 'suspicious':
      return 'Mission Validation Failed - Unverified Completion';
    default:
      return 'Incomplete - No XP Awarded';
  }
}

// --- Persistence helpers ---

export function saveIntegrityResult(missionId, mode, integrityResult, xpAwarded) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(INTEGRITY_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({
      missionId,
      mode,
      completedAt: new Date().toISOString(),
      validityStatus: integrityResult.validityStatus,
      validCompletedUnits: integrityResult.validCompletedUnits,
      totalRequiredUnits: integrityResult.totalRequiredUnits,
      partialCompletionRatio: integrityResult.partialCompletionRatio,
      xpAwarded,
      leaderboardEligible: integrityResult.leaderboardEligible,
      // 1.6 — motion effort for anti-cheat analytics.
      effort: integrityResult.effort,
      motionVerified: integrityResult.motionVerified,
      strikesThrown: integrityResult.strikesThrown,
    });
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem(INTEGRITY_LOG_KEY, JSON.stringify(log));
  } catch { /* silent */ }
}

export function loadIntegrityLog() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INTEGRITY_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// --- Quick helper for manual-complete gating ---

export function canManualComplete(session) {
  const unit = session.units[session.currentUnitIndex];
  if (!unit) return { allowed: false, message: 'No active unit.' };
  const elapsed = (Date.now() - unit.startedAt) / 1000;
  if (elapsed < session.rules.minValidSeconds) {
    return { allowed: false, message: 'Too early to verify. Keep going.' };
  }
  return { allowed: true, message: '' };
}

// --- Arcade-specific: strict stage validation ---

export function isStageFullyValid(session) {
  if (!session.rules.strictMode) return session.units.every(u => u.validityStatus === VALIDITY.VALID);
  return session.units.length >= session.totalUnits &&
    session.units.every(u => u.validityStatus === VALIDITY.VALID);
}
