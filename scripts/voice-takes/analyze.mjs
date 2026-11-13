// Edge analysis of a recording (a snapshot of the checker used all session): the loud blip some recordings end with,
// and recordings that start or stop mid-sound.
const SR = 24000, F = 240; const ms = (n) => Math.round(n * SR / 1000); const db = (v, p) => (v <= 0 || p <= 0 ? -99 : 20 * Math.log10(v / p));
export function analyze(s, P) {
  const fr = []; for (let i = 0; i < s.length; i += F) { let p = 0; for (let j = i; j < Math.min(s.length, i + F); j++) p = Math.max(p, Math.abs(s[j])); fr.push(p); }
  const n = fr.length; const qa = { burst: false, cutStart: false, cutEnd: false };
  if (n < 8) return { fr, segs: [], sp: 0, endAt: s.length, qa };
  const body = fr.slice(0, Math.max(4, n - 15));
  const sorted = [...body].sort((a, b) => b - a); const sp = sorted[Math.floor(sorted.length * 0.02)] || sorted[0] || 1e-6;
  // A blip at the end: within the last 120 ms a frame jumps well above what came just before it.
  let endFrame = n;
  for (let i = Math.max(6, n - 12); i < n; i++) {
    let local = 0; for (let j = Math.max(0, i - 12); j < i - 1; j++) local = Math.max(local, fr[j]);
    if (fr[i] > sp * 0.7 && fr[i] > local * 2.2) { endFrame = Math.max(0, i - 1); qa.burst = true; break; }
  }
  const th = sp * Math.pow(10, P.thDb / 20);
  const raw = []; let cur = null;
  for (let i = 0; i < endFrame; i++) { if (fr[i] > th) { if (!cur) cur = { a: i, b: i }; else cur.b = i; } else if (cur) { raw.push(cur); cur = null; } }
  if (cur) raw.push(cur);
  let segs = []; for (const g of raw) { const L = segs[segs.length - 1]; if (L && (g.a - L.b) * 10 < 120) L.b = g.b; else segs.push({ ...g }); }
  // Edge blips: a short first or last segment standing well apart from the rest (a breath, a click).
  const len = (g) => (g.b - g.a + 1) * 10; const gap = (p, q) => (q.a - p.b - 1) * 10;
  let changed = true;
  while (changed && segs.length > 1) {
    changed = false;
    if (len(segs[0]) < 200 && gap(segs[0], segs[1]) >= 250) { segs.shift(); changed = true; continue; }
    const k = segs.length; if (len(segs[k - 1]) < 200 && gap(segs[k - 2], segs[k - 1]) >= 250) { segs.pop(); changed = true; continue; }
    // a short last segment that runs to the end of the file after a clear dip is the blip's foot
    if (len(segs[k - 1]) <= 120 && segs[k - 1].b >= endFrame - 2 && gap(segs[k - 2], segs[k - 1]) >= 80) { segs.pop(); qa.burst = true; changed = true; }
  }
  if (segs.length) {
    // the recording starts / stops while the sound is still loud: the generator cut it
    const first = segs[0], last = segs[segs.length - 1];
    let head = 0; for (let i = 0; i < Math.min(s.length, ms(3)); i++) head = Math.max(head, Math.abs(s[i]));
    if (first.a === 0 && db(head, sp) > -14) qa.cutStart = true;
    const endSample = Math.min(s.length, endFrame * F);
    let foot = 0; for (let i = Math.max(0, endSample - ms(4)); i < endSample; i++) foot = Math.max(foot, Math.abs(s[i]));
    if (last.b >= endFrame - 1 && db(foot, sp) > -14 && !qa.burst) qa.cutEnd = true;
  }
  return { fr, segs, sp, endAt: Math.min(s.length, endFrame * F), qa };
}
