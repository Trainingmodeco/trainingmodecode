import { useRef, useEffect, useCallback } from 'react';
import { IntegritySession, MODE_RULES, canManualComplete, saveIntegrityResult } from '../utils/missionIntegrity';

export default function useIntegritySession(mode, totalUnits, customRules) {
  const sessionRef = useRef(null);

  if (!sessionRef.current) {
    const rules = customRules || MODE_RULES[mode];
    sessionRef.current = new IntegritySession(mode, totalUnits, rules);
  }

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
      }
    };
  }, []);

  const startUnit = useCallback((unitType) => {
    return sessionRef.current?.startUnit(unitType) || null;
  }, []);

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

  const recordAction = useCallback((actionType) => {
    return sessionRef.current?.recordAction(actionType) || { suspicious: false };
  }, []);

  const checkIdle = useCallback(() => {
    return sessionRef.current?.checkIdle() || { idle: false };
  }, []);

  const finalize = useCallback(() => {
    return sessionRef.current?.finalize() || null;
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
    completeUnit,
    skipUnit,
    pause,
    resume,
    recordAction,
    checkIdle,
    finalize,
    checkManualComplete,
    saveResult,
    getSession,
  };
}
