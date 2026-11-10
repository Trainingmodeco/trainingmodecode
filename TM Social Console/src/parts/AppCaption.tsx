import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../brand';
import { fitSize, KineticText, tokenize } from './KineticText';

// The words over an app screen recording (ScriptShort with brollGrade 'app').
// The footage is a phone UI the viewer has to read, so the words sit in an
// arcade caption panel that can be placed per scene (`broll[i].textY`, the
// panel's centre line in px) over the part of the screen that is not live.
// The panel stays inside x 70 to 930: clear of the right 140 px the platforms
// use for their buttons, and well above the bottom 350 px.
export const CAPTION_X = 70;
export const CAPTION_W = 860;
const PAD_X = 36;
const PAD_Y = 20;
const BAR = 10;

// Uppercase advance per face as a share of the font size, a touch generous.
const ADV = { display: 0.86, body: 0.55 } as const;

// How many lines the words take at a size (words wrap greedily).
function lineCount(text: string, face: keyof typeof ADV, size: number, width: number) {
  const gap = size * 0.26;
  let lines = 1;
  let used = 0;
  for (const t of tokenize(text)) {
    const w = (t.text.length + t.tail.length) * ADV[face] * size;
    if (used === 0) used = w;
    else if (used + gap + w <= width) used += gap + w;
    else {
      lines++;
      used = w;
    }
  }
  return lines;
}

// The largest size, from `max` down to `min`, that keeps the words to `maxLines`
// lines and the longest word on one line; null when none does.
function fitLines(text: string, face: keyof typeof ADV, max: number, min: number, maxLines: number, width: number) {
  const cap = Math.min(max, fitSize(text, face, max, width));
  for (let s = cap; s >= min; s -= 2) if (lineCount(text, face, s, width) <= maxLines) return s;
  return null;
}

// Two lines when they can stay big (so less of the screen is covered), else three.
export function captionSize(text: string, face: keyof typeof ADV, max: number, width: number) {
  return fitLines(text, face, max, 68, 2, width) ?? fitLines(text, face, max, 52, 3, width) ?? 52;
}

export const AppCaption: React.FC<{ text: string; first: boolean; gold: boolean; y: number }> = ({ text, first, gold, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = first ? 'display' : 'body';
  const inner = CAPTION_W - PAD_X * 2 - BAR;
  const size = captionSize(text, face, 84, inner);
  // The hook is already on screen at frame 0 (its words pop in around it); later cards slide in fast.
  const s = first ? 1 : spring({ frame, fps, config: { damping: 16, stiffness: 240, mass: 0.5 } });
  const cut = 26;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: CAPTION_X,
          top: y,
          width: CAPTION_W,
          transform: `translateY(-50%) translateX(${(1 - s) * -70}px)`,
          opacity: Math.min(1, s * 1.8),
          filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.6))',
        }}
      >
        <div
          style={{
            background: gold ? C.gold : 'rgba(8,0,18,0.96)',
            boxShadow: `inset ${BAR}px 0 0 ${gold ? C.bg : C.gold}, inset 0 0 0 3px ${gold ? 'rgba(8,0,18,0.35)' : `${C.violet}88`}`,
            clipPath: `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, ${cut}px 100%, 0 calc(100% - ${cut}px))`,
            padding: `${PAD_Y}px ${PAD_X}px ${PAD_Y}px ${PAD_X + BAR}px`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <KineticText
            text={text}
            face={face}
            max={size}
            size={size}
            width={inner}
            color={gold ? C.bg : C.text}
            hot={C.gold}
            hotChip={gold ? C.bg : undefined}
            stagger={first ? 4 : 3}
            delay={first ? -10 : 0}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
