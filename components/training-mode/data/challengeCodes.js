// Challenge codes — encode a specific arcade stage-start (campaign · stage ·
// mode · difficulty) into a compact, shareable code + URL so a friend can
// scan/paste it and jump straight into the EXACT same session. Local v1: the
// code is self-contained (no server round-trip), format `TMC1.<base64(json)>`.
// The URL form (…/?ch=<code>) makes any QR scanner a "scan-to-start" entry: the
// scanned link opens the app, which deep-links into the stage (see App.jsx).
import { CAMPAIGN_SERIES_BY_ID } from './arcadeCampaignSeries';
import { trackEvent } from './analytics';

const PREFIX = 'TMC1.';
// Compact, URL-safe base64 so both the code and its QR stay small (the QR
// encoder caps at ~108 bytes). Payload is a pipe-delimited record, not JSON.
const b64urlEncode = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return decodeURIComponent(escape(atob(t)));
};
const MODE_TO = { fit: 'f', fight: 'g', both: 'b' };
const MODE_FROM = { f: 'fit', g: 'fight', b: 'both' };
const DIFF_TO = { easy: 'e', normal: 'n', hard: 'h' };
const DIFF_FROM = { e: 'easy', n: 'normal', h: 'hard' };

export function encodeChallenge({ seriesId, stageId, mode = 'fit', difficulty = 'normal', from } = {}) {
  try {
    if (!seriesId || !stageId) return null;
    // Fields are pipe-delimited; strip pipes from free values to keep parsing safe.
    const clean = (v) => String(v).replace(/\|/g, '');
    const parts = [
      clean(seriesId),
      clean(stageId),
      MODE_TO[mode] || 'f',
      DIFF_TO[difficulty] || 'n',
      from ? clean(from).slice(0, 24) : '',
    ];
    return PREFIX + b64urlEncode(parts.join('|'));
  } catch { return null; }
}

export function decodeChallenge(code) {
  try {
    const raw = String(code || '').trim();
    // Accept a bare code, a full URL, or a URL fragment carrying ch=<code>.
    const m = raw.match(/(?:[?&#]ch=)([^&\s]+)/i);
    const token = (m ? decodeURIComponent(m[1]) : raw).trim();
    if (!token.startsWith(PREFIX)) return null;
    const parts = b64urlDecode(token.slice(PREFIX.length)).split('|');
    const [seriesId, stageId, m2, d2, from] = parts;
    if (!seriesId || !stageId) return null;
    return {
      seriesId,
      stageId,
      mode: MODE_FROM[m2] || 'fit',
      difficulty: DIFF_FROM[d2] || 'normal',
      from: from || null,
    };
  } catch { return null; }
}

// Resolve a decoded challenge to real series + stage objects (null if unknown).
export function resolveChallenge(decoded) {
  if (!decoded) return null;
  const series = CAMPAIGN_SERIES_BY_ID[decoded.seriesId];
  if (!series) return null;
  const stage = (series.stages || []).find((s) => s.id === decoded.stageId);
  if (!stage) return null;
  return { series, stage, mode: decoded.mode, difficulty: decoded.difficulty, from: decoded.from };
}

const ORIGIN = () =>
  (typeof location !== 'undefined' && location.origin && location.origin !== 'null')
    ? location.origin
    : 'https://apptrainingmode.com';

export function challengeURL(code) {
  return `${ORIGIN()}/?ch=${encodeURIComponent(code)}`;
}

// Read a challenge from the current URL (query or hash), if any.
export function challengeFromLocation() {
  try {
    if (typeof location === 'undefined') return null;
    const hay = `${location.search || ''} ${location.hash || ''}`;
    const m = hay.match(/[?&#]ch=([^&\s]+)/i);
    if (!m) return null;
    return decodeChallenge(decodeURIComponent(m[1]));
  } catch { return null; }
}

// Strip ch= from the URL after we've consumed it so a reload doesn't re-fire it.
export function clearChallengeFromURL() {
  try {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const url = new URL(location.href);
    url.searchParams.delete('ch');
    let hash = (url.hash || '').replace(/([#&])ch=[^&]*/i, '$1').replace(/[#&]+$/, '');
    if (hash === '#') hash = '';
    history.replaceState(null, '', url.pathname + url.search + hash);
  } catch { /* noop */ }
}

export function challengeLabel(resolved) {
  if (!resolved) return '';
  const mode = resolved.mode === 'both' ? 'FULL ARC' : String(resolved.mode).toUpperCase();
  return `${resolved.series.title} · Stage ${resolved.stage.stageNumber} · ${mode} · ${String(resolved.difficulty).toUpperCase()}`;
}

// Convenience: build a code straight from a series + stage the user is on.
export function challengeFromStage(series, stage, mode = 'fit', difficulty = 'normal', from) {
  const code = encodeChallenge({ seriesId: series?.id, stageId: stage?.id, mode, difficulty, from });
  if (code) trackEvent('challenge_created', { series: series?.id, mode, difficulty });
  return code;
}
