import { MiniTag } from '../../shared/MoveSwapSheet';
import { HEAD, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';

// The card's small tags, in MoveSwapSheet's MiniTag (the SWAPPED tag's look).
//
// PatternTag: what a move works in the balanced deal (PUSH, PULL, LEGS, CORE,
// ARMS). Push is gold, pull violet, the rest plain, so a 3 push / 2 pull deal
// reads at a glance without a legend.
// NoBarTag: a move standing in for a bar move (the PULL-UP BAR switch is off).

const PATTERN_TONE = {
  push: { background: 'rgba(242,190,69,0.16)', color: GOLD },
  pull: { background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT },
};

export function PatternTag({ pattern }) {
  return (
    <MiniTag style={{ font: `700 8px ${HEAD}`, letterSpacing: '0.12em', padding: '2px 4px', ...(PATTERN_TONE[pattern] || {}) }}>
      {String(pattern || '').toUpperCase()}
    </MiniTag>
  );
}

export function NoBarTag() {
  return (
    <MiniTag style={{ font: `700 8px ${HEAD}`, letterSpacing: '0.12em', padding: '2px 4px', background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT }}>
      NO BAR
    </MiniTag>
  );
}
