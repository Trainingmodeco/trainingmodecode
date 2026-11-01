// Quick Mission v2 gate: the loadout shelf, SOLO, swaps and the new voice.
// Public since Nov 2026 (the owner tested it first via the Strike Lab
// preview). Set the flag back to false to hide v2 from everyone but the owner.
// Read once per mount (useState), never in a render body.
import { isOwnerPreview } from './concepts';

export const QM_V2_FOR_EVERYONE = true;
export function qmV2Enabled() { return QM_V2_FOR_EVERYONE || isOwnerPreview(); }
