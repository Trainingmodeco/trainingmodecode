import { MiniTag } from '../../shared/MoveSwapSheet';
import { HEAD, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';

// The card's small tags, in MoveSwapSheet's MiniTag (the SWAPPED tag's look),
// at 10px so the caps read on a 360px phone (8px read as specks).
//
// PatternTag: what a move works in the balanced deal (PUSH, PULL, LEGS, CORE,
// ARMS). Push is gold, pull violet, the rest plain, so a 3 push / 2 pull deal
// reads at a glance without a legend. One fixed width for every pattern, so
// the move names after it start in one column (as on a card without tags).
// NoBarTag: a move standing in for a bar move (the PULL-UP BAR switch is off).

const TAG_FONT = `700 10px ${HEAD}`;
export const PATTERN_TAG_WIDTH = 42;

const PATTERN_TONE = {
  push: { background: 'rgba(242,190,69,0.16)', color: GOLD },
  pull: { background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT },
};

export function PatternTag({ pattern }) {
  return (
    <MiniTag style={{
      font: TAG_FONT, letterSpacing: '0.08em', width: PATTERN_TAG_WIDTH, boxSizing: 'border-box', padding: '3px 0',
      textAlign: 'center', display: 'inline-block', ...(PATTERN_TONE[pattern] || {}),
    }}>
      {String(pattern || '').toUpperCase()}
    </MiniTag>
  );
}

export function NoBarTag() {
  return (
    <MiniTag style={{ font: TAG_FONT, letterSpacing: '0.1em', padding: '3px 5px', background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT }}>
      NO BAR
    </MiniTag>
  );
}
