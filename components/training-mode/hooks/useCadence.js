import { useState, useRef, useEffect, useCallback } from 'react';
import { createCadenceMeter, strideIsPlausible, cadenceVerdict } from '../data/cadence';

// React glue for the cadence meter: owns the DeviceMotion subscription, the
// iOS permission flow, and the once-a-second tick that turns raw reads into the
// steady number the HUD shows.
//
// The permission grant is shared with useStrikeCounter under the SAME storage
// key, deliberately. An athlete who already allowed motion so Fight Mode could
// count their punches has answered this question, and asking again on the
// treadmill would be the app failing to remember something it was told.
const GRANT_KEY = 'tm_motion_granted';

const detectSupport = () => typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
const needsPrompt = () => detectSupport() && typeof window.DeviceMotionEvent.requestPermission === 'function';

/**
 * @param active    sample only while this is true (the live, unpaused session)
 * @param kind      'run' | 'bike' | 'row' | 'stairs' — picks the frequency band
 * @param speed     the known speed, if any, for the stride cross-check
 * @param unit      'mi' | 'km', for that cross-check
 */
export default function useCadence({ active, kind = 'run', speed = 0, unit = 'mi' }) {
  const [supported] = useState(detectSupport);
  const [permission, setPermission] = useState(() => {
    if (!detectSupport()) return 'unsupported';
    try { return localStorage.getItem(GRANT_KEY) === 'true' ? 'granted' : 'prompt'; } catch { return 'prompt'; }
  });
  const [reading, setReading] = useState(null);   // { rate, confidence, held }
  const [motionSeen, setMotionSeen] = useState(false);

  const meterRef = useRef(null);
  if (!meterRef.current) meterRef.current = createCadenceMeter(kind);
  // The cross-check inputs change every second; a ref keeps the tick effect from
  // being torn down and rebuilt each time, which would reset the vote history.
  const checkRef = useRef({ speed, unit, kind });
  useEffect(() => { checkRef.current = { speed, unit, kind }; }, [speed, unit, kind]);

  const requestPermission = useCallback(async () => {
    if (!detectSupport()) { setPermission('unsupported'); return 'unsupported'; }
    if (needsPrompt()) {
      try {
        const res = await window.DeviceMotionEvent.requestPermission();
        setPermission(res === 'granted' ? 'granted' : 'denied');
        if (res === 'granted') { try { localStorage.setItem(GRANT_KEY, 'true'); } catch { /* quota */ } }
        return res;
      } catch { setPermission('denied'); return 'denied'; }
    }
    setPermission('granted');
    try { localStorage.setItem(GRANT_KEY, 'true'); } catch { /* quota */ }
    return 'granted';
  }, []);

  // Sample.
  useEffect(() => {
    if (!active || permission !== 'granted' || !supported) return undefined;
    const meter = meterRef.current;
    let seen = false;
    const handler = (e) => {
      const lin = e.acceleration;
      const raw = e.accelerationIncludingGravity;
      const src = (lin && lin.x != null) ? lin : raw;
      if (!src || src.x == null) return;
      if (!seen) { seen = true; setMotionSeen(true); }
      const t = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
      meter.onSample(src.x, src.y, src.z, src === raw, t);
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [active, permission, supported]);

  // Decide, once a second. The meter wants to be asked at a steady rate — its
  // vote is over the last six asks, so the interval IS the window it reasons in.
  useEffect(() => {
    if (!active || permission !== 'granted' || !supported) { setReading(null); return undefined; }
    const meter = meterRef.current;
    const started = Date.now();
    const id = setInterval(() => {
      const r = meter.track((Date.now() - started) / 1000);
      if (!r) { setReading(null); return; }
      // Reject a rate that a known speed makes physically impossible. This is
      // what removes the meter's last failure mode — a treadmill left running
      // with nobody on it can briefly produce a reading, but it lands on an
      // arbitrary frequency, and an arbitrary frequency against a real speed
      // implies a stride nobody could take.
      const { speed: sp, unit: u, kind: k } = checkRef.current;
      if (!strideIsPlausible(r.rate, sp, u, k)) { setReading(null); return; }
      setReading(r);
    }, 1000);
    return () => clearInterval(id);
  }, [active, permission, supported]);

  // Reset when the activity changes — a bike's band is not a run's, and the
  // vote history from one is meaningless to the other.
  useEffect(() => {
    meterRef.current = createCadenceMeter(kind);
    setReading(null);
  }, [kind]);

  return {
    supported,
    permission,
    motionSeen,
    requestPermission,
    rate: reading?.rate ?? null,
    confidence: reading?.confidence ?? 0,
    held: !!reading?.held,
    verdict: reading ? cadenceVerdict(reading.rate, kind) : null,
    band: meterRef.current.band,
  };
}
