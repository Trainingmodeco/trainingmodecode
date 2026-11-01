// Quick Mission v2 gate. Owner-only until the flag flips: the phone that
// unlocked the Strike Lab sees the new shelf, SOLO and the new voice first.
// Read once per mount (useState), never in a render body.
import { isOwnerPreview } from './concepts';

export const QM_V2_FOR_EVERYONE = false;
export function qmV2Enabled() { return QM_V2_FOR_EVERYONE || isOwnerPreview(); }
