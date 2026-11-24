// The retention features' switches (docs/retention/BUILD-SPEC.md). Each is off
// for everyone until the App Store launch, and on for the owner's phone (the
// owner preview, data/concepts). Read once per mount (a useState initialiser),
// never in a render body: the preview flag can change while a screen is up.
//   weeks    — weekly streak + daily mission + freezes
//   path     — the path + stars
//   nearMiss — near-miss retry
//   power    — POWER, RUSTY and REVIVE (the fighter drains while away)
//   fitCard  — the Fit WORKOUT CARD on Quick Mission, program days, YOUR
//              WORKOUTS (docs/fit-challenge/BUILD-NOTES.md). Off: Fit Mode
//              is exactly as before.
import { isOwnerPreview } from './concepts';

const FOR_EVERYONE = { weeks: false, path: false, nearMiss: false, power: false, fitCard: false };

// `tm_preview_off` (a comma list of keys) holds one switch off inside the
// owner preview: the smoke test keeps the old Quick Mission page under the
// preview this way ('fitCard'), and the owner could too. It never turns a
// switch on.
function heldOff(key) {
  try { return String(localStorage.getItem('tm_preview_off') || '').split(',').map((k) => k.trim()).includes(key); } catch { return false; }
}

export const retentionOn = (key) => !!FOR_EVERYONE[key] || (isOwnerPreview() && !heldOff(key));
