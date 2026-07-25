// Minimal, dependency-free QR encoder — byte mode, EC level L, versions 1–5
// (single data block, so no interleaving; no version-info modules below v7).
// That envelope (up to 108 data bytes) comfortably holds a challenge URL while
// keeping the spec surface small and verifiable. Returns a boolean matrix
// (true = dark). Returns null if the text doesn't fit v5-L.
//
// The QR algorithm is an ISO/IEC 18004 standard; this is an original, compact
// expression of it (GF(256) Reed–Solomon, standard mask penalty selection).

// ── GF(256) tables (primitive polynomial 0x11d) ─────────────────────────────
const EXP = new Array(512);
const LOG = new Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(ecLen) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen); // length ecLen+1, gen[0] = 1 (leading term)
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    // Shift the remainder window left and subtract factor·gen (using the
    // non-leading generator coefficients gen[1..ecLen]).
    for (let j = 0; j < ecLen - 1; j++) res[j] = res[j + 1] ^ gfMul(gen[j + 1], factor);
    res[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return res;
}

// ── Version tables (level L, single block) ──────────────────────────────────
// [size, totalCodewords, dataCodewords, ecCodewords, alignCenter(0=none)]
const VERSIONS = [
  { v: 1, size: 21, data: 19, ec: 7, align: 0 },
  { v: 2, size: 25, data: 34, ec: 10, align: 18 },
  { v: 3, size: 29, data: 55, ec: 15, align: 22 },
  { v: 4, size: 33, data: 80, ec: 20, align: 26 },
  { v: 5, size: 37, data: 108, ec: 26, align: 30 },
];

// ── Bit buffer ──────────────────────────────────────────────────────────────
function encodeData(bytes, cap) {
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);          // byte mode
  push(bytes.length, 8);    // char count (8 bits for v1–9)
  for (const b of bytes) push(b, 8);
  const capBits = cap * 8;
  if (bits.length > capBits) return null;
  // terminator (up to 4 zero bits)
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  // pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // pad bytes
  const pads = [0xec, 0x11];
  let p = 0;
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  while (out.length < cap) { out.push(pads[p % 2]); p++; }
  return out;
}

// ── Matrix scaffolding ──────────────────────────────────────────────────────
// The 30 format-info module coordinates, ordered by bit index 0..14 in each of
// the two copies (copy 1 = around the top-left finder; copy 2 = split along the
// top-right and bottom-left). Reserve + write both derive from this so they can
// never drift apart.
function formatCells(size) {
  const c1 = [];
  for (let i = 0; i <= 5; i++) c1.push([8, i]);
  c1.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i <= 14; i++) c1.push([14 - i, 8]);
  const c2 = [];
  for (let i = 0; i <= 7; i++) c2.push([size - 1 - i, 8]);
  for (let i = 8; i <= 14; i++) c2.push([8, size - 15 + i]);
  return { c1, c2 };
}

function buildMatrix(codewords, ver) {
  const { size, align } = ver;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // function module?

  const setF = (r, c, val) => { m[r][c] = val ? 1 : 0; fn[r][c] = true; };

  // Finder + separators
  const placeFinder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setF(rr, cc, on);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }

  // Alignment pattern (single, centered) for v2–5
  if (align) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const on = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        setF(align + r, align + c, on);
      }
    }
  }

  // Dark module
  setF(size - 8, 8, true);

  // Reserve the full format-info strips (row 8 + col 8 near the finders, plus
  // the always-dark module) so data placement skips them; applyFormat() writes
  // the real bits after masking.
  for (let i = 0; i < 9; i++) {
    if (!fn[8][i]) { m[8][i] = 0; fn[8][i] = true; }
    if (!fn[i][8]) { m[i][8] = 0; fn[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    const rc = size - 1 - i;
    if (!fn[8][rc]) { m[8][rc] = 0; fn[8][rc] = true; }
    if (!fn[rc][8]) { m[rc][8] = 0; fn[rc][8] = true; }
  }

  // Place data bits — two-module-wide columns walked right→left, zigzagging
  // up/down; the timing column (6) is skipped by collapsing the loop variable.
  const bitAt = (i) => (codewords[i >> 3] >> (7 - (i & 7))) & 1;
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (fn[row][c]) continue;
        m[row][c] = bitIdx < totalBits ? bitAt(bitIdx) : 0;
        bitIdx++;
      }
    }
  }

  return { m, fn };
}

// ── Masking ──────────────────────────────────────────────────────────────────
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// Format info (EC level L = 0b01) with mask, BCH + XOR mask 0x5412.
function formatBits(mask) {
  const data = (0b01 << 3) | mask; // 5 bits
  let v = data << 10;
  const g = 0b10100110111;
  for (let i = 4; i >= 0; i--) if ((v >> (i + 10)) & 1) v ^= g << i;
  return ((data << 10) | v) ^ 0b101010000010010;
}

function applyFormat(m, size, mask) {
  const bits = formatBits(mask);
  // Format bits are placed MSB-first: cell index i carries bit (14 - i).
  const get = (i) => (bits >> (14 - i)) & 1;
  const { c1, c2 } = formatCells(size);
  c1.forEach(([r, c], i) => { m[r][c] = get(i); });
  c2.forEach(([r, c], i) => { m[r][c] = get(i); });
  m[size - 8][8] = 1; // always-dark module
}

function penalty(m, size) {
  let score = 0;
  // Rule 1: runs of ≥5 same color in rows/cols
  const runScore = (get) => {
    let s = 0;
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; }
        else run = 1;
      }
    }
    return s;
  };
  score += runScore((a, b) => m[a][b]);
  score += runScore((a, b) => m[b][a]);
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }
  // Rule 3: finder-like patterns 1:1:3:1:1 with 4 light
  const patt = [1, 0, 1, 1, 1, 0, 1];
  const check = (line) => {
    let s = 0;
    for (let i = 0; i + 11 <= size; i++) {
      const seg = line.slice(i, i + 7);
      const pre = line.slice(i + 7, i + 11);
      const post = line.slice(i - 4, i);
      if (seg.every((x, k) => x === patt[k]) &&
        ((i + 11 <= size && pre.every((x) => x === 0)) || (i - 4 >= 0 && post.every((x) => x === 0)))) s += 40;
    }
    return s;
  };
  for (let r = 0; r < size; r++) score += check(m[r]);
  for (let c = 0; c < size; c++) score += check(m.map((row) => row[c]));
  // Rule 4: dark proportion
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** Encode `text` → { size, modules: boolean[][] } (true = dark), or null. */
export function qrMatrix(text, forceMask = null) {
  const bytes = [];
  // UTF-8 encode
  const str = unescape(encodeURIComponent(String(text)));
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);

  const ver = VERSIONS.find((V) => bytes.length + 3 <= V.data); // +mode/count overhead ≈ small
  if (!ver) return null;
  const dataCw = encodeData(bytes, ver.data);
  if (!dataCw) return null;
  const ecCw = rsEncode(dataCw, ver.ec);
  const codewords = dataCw.concat(ecCw);

  const { m, fn } = buildMatrix(codewords, ver);
  const size = ver.size;

  // Choose the best mask.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask != null && mask !== forceMask) continue;
    const test = m.map((row) => row.slice());
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!fn[r][c] && MASKS[mask](r, c)) test[r][c] ^= 1;
    }
    applyFormat(test, size, mask);
    const p = penalty(test, size);
    if (!best || p < best.p) best = { p, mask, grid: test };
  }

  const modules = best.grid.map((row) => row.map((v) => v === 1));
  return { size, modules };
}
