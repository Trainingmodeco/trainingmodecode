import { useRef, useEffect, useCallback } from 'react';
import { IntegritySession, MODE_RULES, canManualComplete, saveIntegrityResult } from '../utils/missionIntegrity';

// seedValid: rounds already banked before a restore (see IntegritySession.seedValid).
export default function useIntegritySession(mode, totalUnits, customRules, seedValid = 0) {
  const sessionRef = useRef(null);

  if (!sessionRef.current) {
    const rules = customRules || MODE_RULES[mode];
    sessionRef.current = new IntegritySession(mode, totalUnits, rules);
    if (seedValid > 0) sessionRef.current.seedValid(seedValid);
  }

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
      }
    };
  }, []);

  const startUnit = useCallback((unitType, carrySeconds) => {
    return sessionRef.current?.startUnit(unitType, carrySeconds) || null;
  }, []);

  const validCount = useCallback(() => sessionRef.current?.validCount() || 0, []);

  const completeUnit = useCallback(() => {
    return sessionRef.current?.completeUnit() || null;
  }, []);

  const skipUnit = useCallback(() => {
    sessionRef.current?.skipUnit();
  }, []);

  const pause = useCallback(() => {
    sessionRef.current?.pauseSession();
  }, []);

  const resume = useCallback(() => {
    sessionRef.current?.resumeSession();
  }, []);

  // Backgrounding handled as an honest auto-pause → don't tally it as a flag.
  const noteHonestPause = useCallback(() => {
    sessionRef.current?.noteHonestPause();
  }, []);

  const recordAction = useCallback((actionType) => {
    return sessionRef.current?.recordAction(actionType) || { suspicious: false };
  }, []);

  const checkIdle = useCallback(() => {
    return sessionRef.current?.checkIdle() || { idle: false };
  }, []);

  const finalize = useCallback((motion) => {
    return sessionRef.current?.finalize(motion) || null;
  }, []);

  const checkManualComplete = useCallback(() => {
    if (!sessionRef.current) return { allowed: true, message: '' };
    return canManualComplete(sessionRef.current);
  }, []);

  const saveResult = useCallback((missionId, integrityResult, xpAwarded) => {
    saveIntegrityResult(missionId, mode, integrityResult, xpAwarded);
  }, [mode]);

  const getSession = useCallback(() => {
    return sessionRef.current;
  }, []);

  return {
    startUnit,
    validCount,
    completeUnit,
    skipUnit,
    pause,
    resume,
    noteHonestPause,
    recordAction,
    checkIdle,
    finalize,
    checkManualComplete,
    saveResult,
    getSession,
  };
}
