// Cadence from the accelerometer — steps per minute with no GPS and no machine.
//
// WHY NOT THE PUNCH DETECTOR. The app already ships an accelerometer pipeline
// in data/strikeCounter.js, and a footstrike is the same shape as a punch: a
// short sharp spike. It is tempting to just retune the thresholds. It does not
// work, for a specific reason — that detector holds an adaptive noise floor
// (a slow EMA of recent linear acceleration) and requires a peak to stand
// `peakFactor`× above it. Punches come with rest between them, so the floor
// stays low. Running is CONTINUOUS: within a second or two the floor rises to
// include the running signal itself and the detector goes deaf. The property
// that makes running easy is the one peak-counting throws away — it is
// PERIODIC. So measure the period, not the peaks.
//
// HOW. Gravity is removed with a slow low-pass, leaving linear acceleration;
// its magnitude is buffered with timestamps; and the dominant frequency in the
// plausible band is found with a direct discrete Fourier transform evaluated at
// candidate frequencies. Amplitude is irrelevant to where the peak lands, which
// is what makes this work in both placements the athlete will actually use:
//
//   • phone on the body (armband, pocket, hand) — big clean footstrike spikes
//   • phone on the console tray — much smaller, because the signal has travelled
//     through the deck and the frame, and riding on the belt motor's hum. The
//     hum is at a different, higher frequency and the footstrike rhythm is still
//     the strongest thing in the running band.
//
// The transform is evaluated against REAL TIMESTAMPS rather than assuming a
// fixed sample rate. DeviceMotion delivers ~60 Hz on iOS and anywhere from 50
// to 200 Hz on Android, jittering under load, and a wrong rate assumption would
// scale the answer — a 5 % rate error is a 9 spm error, which is the difference
// between "good cadence" and a correction the athlete does not need.
//
// WHAT THIS IS FOR. Cadence, which is a real coaching metric: 170–180 spm is
// the standard target and "quicken your feet, shorten your stride" is the most
// useful treadmill cue there is. It is NOT a distance source. Distance would be
// steps × stride length, and stride varies with speed, incline and fatigue;
// estimating it from height carries ±10–15 % that compounds over a run. Paired
// with the speed dial, though, the arithmetic runs the other way and gives
// something better than either alone: stride = speed ÷ cadence, MEASURED.

// Plausible bands, per activity. Narrow bands are not an optimisation — they
// are what stops the meter locking onto a harmonic or onto the machine itself.
export const CADENCE_BANDS = {
  // Footstrikes, both feet. 78–210 spm covers a walk to a sprint.
  run: { minHz: 1.3, maxHz: 3.5, windowSec: 6, label: 'CADENCE', unit: 'SPM', ideal: [170, 182], harmonicMin: 3 },
  // Pedal revolutions. 48–126 rpm.
  // Pedalling is SMOOTH, close to a sinusoid, so it carries far less harmonic
  // content than a footstrike and the impulse test barely applies. Effectively off.
  bike: { minHz: 0.8, maxHz: 2.1, windowSec: 8, label: 'CADENCE', unit: 'RPM', ideal: [80, 100], harmonicMin: 1.2 },
  // Strokes. 15–45 spm — slow enough to need a much longer window.
  row: { minHz: 0.25, maxHz: 0.75, windowSec: 16, label: 'STROKE RATE', unit: 'SPM', ideal: [24, 30], harmonicMin: 2.5 },
  // Steps on a stair machine, roughly half a run's rate.
  stairs: { minHz: 0.7, maxHz: 2.0, windowSec: 8, label: 'STEP RATE', unit: 'SPM', ideal: [95, 115], harmonicMin: 2.5 },
};

export const bandFor = (kind) => CADENCE_BANDS[kind] || CADENCE_BANDS.run;

const GRAVITY_ALPHA = 0.9;   // low-pass for the gravity estimate
const FREQ_STEPS = 72;       // candidate frequencies across the band
const MIN_SAMPLES = 48;      // below this the transform is meaningless
const MIN_SPAN_RATIO = 0.6;  // need this fraction of the window actually filled

// A phone lying on a bench still produces a spectrum, and its strongest bin is
// as arbitrary as the noise that made it. Peak-sharpness alone does NOT catch
// this — measured against synthetic signals, a motionless phone scored HIGHER
// confidence (0.17) than a real footstrike rhythm read through a treadmill tray
// (0.12), because with 73 correlated candidate bins the band average is smoothed
// either way. So the first gate is not shape, it is ENERGY: below this much
// linear acceleration nothing is happening and we say so, rather than reporting
// whichever noise bin happened to win.
const MIN_RMS = 0.08;        // m/s² of linear acceleration, RMS over the window

// The second gate, and the one that actually works, is HARMONIC STRUCTURE.
// Neither energy nor peak sharpness nor agreement-over-time separates a runner
// from a treadmill running with nobody on it: the belt's confidence reaches
// 0.83 against the real signal's median of 0.25, and consecutive reads a second
// apart share five of their six seconds of data, so they are correlated and
// "three reads agreed" is not the independent evidence it looks like.
//
// What does separate them is physics. A footstrike is an IMPULSE, so its energy
// appears at the step frequency AND at twice it; a narrowband noise peak has no
// such partner. Measured against the local spectrum around 2f: a runner on the
// body scores in the thousands, the same runner read through a console tray
// scores 13 (5th percentile 4.2), and an empty running belt scores 0.8
// (95th percentile 5.4). A threshold of 3 keeps essentially every real read and
// rejects essentially every empty-belt one.
const HARMONIC_NEIGHBOURS = [0.75, 0.85, 1.15, 1.25];

/**
 * A cadence meter. Feed it DeviceMotion samples; ask it for a reading.
 * Pure and framework-free so it can be driven by synthetic signals in a test.
 */
export function createCadenceMeter(kind = 'run') {
  const band = bandFor(kind);
  let gx = 0, gy = 0, gz = 0;
  let gravityInit = false;
  const buf = [];               // { t (seconds), v (linear accel magnitude) }
  let windowSec = band.windowSec;

  function resetBuffers() {
    buf.length = 0;
    gravityInit = false;
  }

  /**
   * ax/ay/az: accelerationIncludingGravity in m/s². tMs: monotonic ms.
   * When linear acceleration is available pass hasGravity=false.
   */
  function onSample(ax, ay, az, hasGravity, tMs) {
    if (ax == null || ay == null || az == null) return;
    let lx, ly, lz;
    if (hasGravity) {
      if (!gravityInit) { gx = ax; gy = ay; gz = az; gravityInit = true; }
      gx = GRAVITY_ALPHA * gx + (1 - GRAVITY_ALPHA) * ax;
      gy = GRAVITY_ALPHA * gy + (1 - GRAVITY_ALPHA) * ay;
      gz = GRAVITY_ALPHA * gz + (1 - GRAVITY_ALPHA) * az;
      lx = ax - gx; ly = ay - gy; lz = az - gz;
    } else {
      lx = ax; ly = ay; lz = az;
    }
    const t = (Number(tMs) || 0) / 1000;
    buf.push({ t, v: Math.sqrt(lx * lx + ly * ly + lz * lz) });
    const cutoff = t - windowSec;
    let drop = 0;
    while (drop < buf.length && buf[drop].t < cutoff) drop++;
    if (drop > 0) buf.splice(0, drop);
  }

  /**
   * The current reading, or null while there is not enough signal to claim one.
   * { rate, hz, confidence, samples } — rate is per MINUTE, in the band's unit.
   */
  function read() {
    if (buf.length < MIN_SAMPLES) return null;
    const span = buf[buf.length - 1].t - buf[0].t;
    if (span < windowSec * MIN_SPAN_RATIO) return null;

    // Detrend: the transform should see the oscillation, not the mean level.
    let mean = 0;
    for (const s of buf) mean += s.v;
    mean /= buf.length;

    // Energy gate: is anything moving at all?
    let sq = 0;
    for (const s of buf) { const dv = s.v - mean; sq += dv * dv; }
    const rms = Math.sqrt(sq / buf.length);
    if (rms < MIN_RMS) return null;

    // Hann window over the buffer's real time span, so the ends taper and a
    // partial cycle at either edge cannot masquerade as a peak.
    const t0 = buf[0].t;
    const n = buf.length;
    const x = new Float64Array(n);
    const ts = new Float64Array(n);
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const frac = span > 0 ? (buf[i].t - t0) / span : 0;
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * frac);
      x[i] = (buf[i].v - mean) * w;
      ts[i] = buf[i].t - t0;
      energy += x[i] * x[i];
    }
    if (energy < 1e-6) return null;

    // Direct DFT at candidate frequencies. Non-uniform sampling is handled by
    // using each sample's own timestamp in the exponent.
    const powerAt = (hz) => {
      const w = 2 * Math.PI * hz;
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const a = w * ts[i];
        re += x[i] * Math.cos(a);
        im -= x[i] * Math.sin(a);
      }
      return (re * re + im * im) / (n * n);
    };

    let bestHz = 0, bestPower = 0;
    const powers = new Float64Array(FREQ_STEPS + 1);
    for (let k = 0; k <= FREQ_STEPS; k++) {
      const hz = band.minHz + ((band.maxHz - band.minHz) * k) / FREQ_STEPS;
      const power = powerAt(hz);
      powers[k] = power;
      if (power > bestPower) { bestPower = power; bestHz = hz; }
    }
    if (bestPower <= 0) return null;

    // The impulse test: how far the second harmonic stands above the local
    // spectrum around it. Real footfalls put energy at 2f; noise does not.
    const p2 = powerAt(bestHz * 2);
    const nb = HARMONIC_NEIGHBOURS.map(m => powerAt(bestHz * 2 * m)).sort((a, b) => a - b);
    const localBase = (nb[1] + nb[2]) / 2 || 1e-15;
    const harmonic = p2 / localBase;

    // A real rhythm is one sharp peak on an otherwise flat band. Measured
    // against the MEDIAN rather than the mean, because the mean is dragged up
    // by the peak itself and by its harmonic, which is exactly the case where
    // the peak is most real — using the mean understated the confidence of
    // strong signals and flattered noisy ones.
    const sorted = Array.from(powers).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1e-12;
    const ratio = bestPower / median;
    const confidence = Math.max(0, Math.min(1, (ratio - 3) / 25));
    return { rate: Math.round(bestHz * 60), hz: bestHz, confidence, rms, harmonic, samples: n };
  }

  // ── stabilisation ────────────────────────────────────────────────────────
  // A single read of a WEAK signal is correct but jumpy: measured on a
  // synthetic console-tray rhythm the rate came back as 172 spm every time
  // while the confidence swung between 0.15 and 1.00 run to run. Displaying
  // that raw would make the cadence chip flicker in and out once a second,
  // which reads as broken even though the number underneath is right.
  //
  // So the displayed value is a VOTE, not a sample. Agreement across several
  // consecutive reads is itself evidence — noise does not land on the same
  // frequency three times running — and once a rate is established it is held
  // briefly through a bad read rather than blinking away.
  // The vote is on the RATE, and confidence is deliberately NOT used to admit
  // or reject a read. That is what the measurements said to do. Across a
  // simulated 3-minute tray run the rate came back correct 163 times and wrong
  // zero times, while its confidence wandered between 0.03 and 1.00; and on an
  // empty running belt the confidence reached 0.83 at its peak, overlapping the
  // real signal completely. Single-read confidence therefore cannot separate
  // "someone is running" from "the motor is running" — but AGREEMENT can, and
  // trivially: a real rhythm lands on the same frequency read after read, while
  // the belt's strongest in-band bin is a different random one each time.
  const history = [];
  const HISTORY = 6;
  // 4 of 6 with a 16 s hold, chosen by sweeping both against ~100 simulated
  // minutes of each case. That corner gives 90 % availability on the weak tray
  // signal with a 0.00 % false-positive rate on an empty running belt; 3 of 6
  // gained 6 points of availability but let the belt through 2-3 % of the time,
  // and 5 of 6 cost 23 points of availability and bought nothing, since the
  // impulse test had already taken the belt to zero. Worth noting from the same
  // sweep: the reported rate was NEVER wrong in any configuration. Agreement
  // and hold buy availability and steadiness, not correctness.
  const NEED_AGREE = 4;
  const AGREE_TOL = 8;       // spm; wider than real drift, tighter than noise
  const JUNK_CONF = 0.05;    // below this a read is not evidence of anything
  const harmonicMin = band.harmonicMin ?? 3;
  const HOLD_SEC = 16;
  let stable = null;         // { rate, confidence, atSec }

  /**
   * Call about once a second. Returns the value to SHOW: a rate only once
   * several consecutive reads agree on one, held briefly through a dropout,
   * else null. Never a guess.
   */
  function track(nowSec) {
    const r = read();
    const usable = r && r.confidence >= JUNK_CONF && r.harmonic >= harmonicMin;
    history.push(usable ? r : null);
    if (history.length > HISTORY) history.shift();

    const good = history.filter(Boolean);
    if (good.length >= NEED_AGREE) {
      const rates = good.map(g => g.rate).sort((a, b) => a - b);
      const median = rates[Math.floor(rates.length / 2)];
      const agreeing = good.filter(g => Math.abs(g.rate - median) <= AGREE_TOL);
      if (agreeing.length >= NEED_AGREE) {
        const conf = agreeing.reduce((s, g) => s + g.confidence, 0) / agreeing.length;
        stable = { rate: Math.round(median), confidence: conf, atSec: nowSec };
        return { ...stable, held: false };
      }
    }
    // Nothing agreed this time. Hold the last established value — the athlete
    // has not stopped running because one window was noisy.
    //
    // An extra condition was tried here and REJECTED on measurement: requiring
    // that at least one of the last N reads still qualified, on the theory that
    // it would stop a lone fluke on an empty belt being stretched across the
    // whole hold. Swept over ~23 simulated minutes per setting, every variant
    // was worse on every axis than not having it — N=3 took tray availability
    // from 91 % to 49 % and quintupled the flicker, and even the softest, N=6,
    // cost 13 points and doubled it, while the false-positive rate was already
    // 0.00 % without it. The impulse test is doing this job upstream and does
    // not need help.
    if (stable && nowSec - stable.atSec <= HOLD_SEC) return { ...stable, held: true };
    stable = null;
    return null;
  }

  return {
    onSample,
    read,
    track,
    reset() { resetBuffers(); history.length = 0; stable = null; },
    band,
    setWindowSec: (s) => { windowSec = s; },
  };
}

/**
 * Stride length implied by a speed and a cadence — the one number that IS
 * trustworthy when both sources are present, because neither half is guessed.
 * speed in units/hour, rate in steps/min → stride in metres.
 */
export function strideFromSpeedAndCadence(speed, rate, unit = 'mi') {
  const s = Number(speed) || 0;
  const r = Number(rate) || 0;
  if (!(s > 0) || !(r > 0)) return null;
  const metersPerHour = s * (unit === 'km' ? 1000 : 1609.344);
  const stepsPerHour = r * 60;
  return metersPerHour / stepsPerHour;
}

// Plausible stride lengths, in metres. Below the floor the athlete would be
// shuffling; above the ceiling they would be bounding, which nobody does on a
// belt. Walking strides sit near 0.7, easy running 0.9-1.2, a fast run 1.5.
const STRIDE_RANGE = { run: [0.4, 2.0], stairs: [0.15, 0.6] };

/**
 * Cross-check a cadence against a KNOWN speed — the dial on a machine, or GPS
 * outdoors. This is the pairing of the two tracking methods doing something
 * neither can do alone, and it is the practical answer to the meter's last
 * failure mode: an empty running belt occasionally produces a brief false
 * reading that survives the impulse test, but it lands on a random frequency,
 * and a random frequency against a real speed implies an impossible stride.
 * At 6 mph a true 172 spm implies 0.89 m; a false 109 spm implies 1.47 m.
 *
 * Returns true when no speed is known — this narrows readings, never invents
 * them, and must not suppress cadence for someone with no speed source at all.
 */
export function strideIsPlausible(rate, speed, unit = 'mi', kind = 'run') {
  const range = STRIDE_RANGE[kind];
  if (!range || !(Number(speed) > 0)) return true;
  const stride = strideFromSpeedAndCadence(speed, rate, unit);
  if (stride == null) return true;
  return stride >= range[0] && stride <= range[1];
}

/** 'low' | 'good' | 'high' against the band's ideal window, or null. */
export function cadenceVerdict(rate, kind = 'run') {
  const band = bandFor(kind);
  if (!(Number(rate) > 0) || !band.ideal) return null;
  const [lo, hi] = band.ideal;
  if (rate < lo - 4) return 'low';
  if (rate > hi + 6) return 'high';
  return 'good';
}

// What the coach says about it. Deliberately about FORM, not effort — cadence
// is the one thing an athlete can change instantly without changing pace, and
// over-striding is the most common fault on a belt.
export const CADENCE_CUES = {
  run: {
    low: [
      'Your feet are slow. Quicken them up — shorter steps, same speed.',
      'You are over-striding. Take quicker, lighter steps and let your foot land under you.',
      'Pick the cadence up. Think quick and light, not long and hard.',
    ],
    good: [
      'Good cadence. Quick, light feet — hold that.',
      'Your turnover is right where it should be. Stay there.',
      'Nice rhythm. That is the cadence to remember.',
    ],
    high: [
      'Great turnover. Let your stride open up a touch.',
      'Cadence is high — relax and let each step carry you a little further.',
    ],
  },
  bike: {
    low: ['Cadence is low. Spin a little lighter and faster.', 'Drop a gear and pick the revolutions up.'],
    good: ['Good cadence. Smooth circles — hold it.', 'That is a strong spin. Stay there.'],
    high: ['Spinning fast. Add a touch of resistance and settle.'],
  },
  row: {
    low: ['Stroke rate is low. Quicken the recovery, keep the drive strong.', 'Pick the rate up — fast hands away.'],
    good: ['Good rating. Strong drive, patient slide.', 'That is the rhythm. Hold it.'],
    high: ['Rate is high — lengthen the slide and make each stroke count.'],
  },
  stairs: {
    low: ['Step rate is low. Quicker feet, full steps.', 'Pick the pace up — drive through the whole foot.'],
    good: ['Good step rate. Tall through the hips — hold it.'],
    high: ['Quick feet. Take the full step rather than the fast half one.'],
  },
};

export function cadenceCue(verdict, kind = 'run', lastIndex = -1) {
  const pool = (CADENCE_CUES[kind] || CADENCE_CUES.run)[verdict];
  if (!pool || pool.length === 0) return { text: '', index: lastIndex };
  const index = (lastIndex + 1) % pool.length;
  return { text: pool[index], index };
}
