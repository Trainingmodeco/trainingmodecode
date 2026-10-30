import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from '../brand';

// Scripts mark highlight words with *stars*: "Get a *coach* in your ear".
// Punctuation right after a highlight stays plain and sticks to its word.
type Token = { text: string; hot: boolean; tail: string };

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let hot = false;
  for (const part of text.split(/(\*)/)) {
    if (part === '*') {
      hot = !hot;
      continue;
    }
    part
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w, i) => {
        const prev = out[out.length - 1];
        // Text glued to the end of a highlight ("*Fight Focus*:") rides along, unhighlighted.
        if (i === 0 && prev?.hot && !hot && !/^\s/.test(part)) prev.tail += w;
        else out.push({ text: w, hot, tail: '' });
      });
  }
  return out;
}

export const plain = (text: string) => text.replace(/\*/g, '');

// Width of one character as a share of font size, uppercase, per face.
const CHAR_W = { display: 0.82, body: 0.52 } as const;

// Largest size (up to `max`) at which the longest word still fits `width`.
export function fitSize(text: string, face: keyof typeof CHAR_W, max: number, width = 900) {
  const longest = Math.max(...tokenize(text).map((t) => t.text.length + t.tail.length), 1);
  return Math.min(max, Math.floor(width / (longest * CHAR_W[face])));
}

type Props = {
  text: string;
  face: 'display' | 'body';
  max: number;
  color: string;
  hot: string;
  // Highlighted words as a solid chip (for the gold scenes) instead of a glow.
  hotChip?: string;
  stagger?: number;
  delay?: number;
};

// Words land one after another with a springy pop; highlighted words glow.
export const KineticText: React.FC<Props> = ({ text, face, max, color, hot, hotChip, stagger = 3, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = fitSize(text, face, max);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `${Math.round(size * 0.14)}px ${Math.round(size * 0.26)}px`,
        width: 920,
        lineHeight: 1.04,
      }}
    >
      {tokenize(text).map((t, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 13, stiffness: 190, mass: 0.6 } });
        const chip = t.hot && hotChip;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily: FONT[face],
              fontWeight: face === 'display' ? 900 : 700,
              fontSize: size,
              letterSpacing: face === 'display' ? '0.01em' : '0.02em',
              textTransform: 'uppercase',
              color,
              opacity: Math.min(1, s * 1.4),
              transform: `translateY(${(1 - s) * 46}px) scale(${0.72 + 0.28 * s})`,
            }}
          >
            <span
              style={{
                color: t.hot ? hot : color,
                background: chip ? hotChip : 'transparent',
                padding: chip ? `0 ${Math.round(size * 0.14)}px` : 0,
                textShadow: t.hot && !chip ? `0 0 ${Math.round(size * 0.4)}px ${hot}99` : 'none',
              }}
            >
              {t.text}
            </span>
            {t.tail}
          </span>
        );
      })}
    </div>
  );
};
