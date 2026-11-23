// The retention features' switches (docs/retention/BUILD-SPEC.md). Each is off
// for everyone until the App Store launch, and on for the owner's phone (the
// owner preview, data/concepts). Read once per mount (a useState initialiser),
// never in a render body: the preview flag can change while a screen is up.
//   weeks    — weekly streak + daily mission + freezes
//   path     — the path + stars
//   nearMiss — near-miss retry
//   power    — POWER, RUSTY and REVIVE (the fighter drains while away)
import { isOwnerPreview } from './concepts';

const FOR_EVERYONE = { weeks: false, path: false, nearMiss: false, power: false };

export const retentionOn = (key) => !!FOR_EVERYONE[key] || isOwnerPreview();
