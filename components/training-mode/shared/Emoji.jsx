// An emoji that renders as an emoji.
//
// 'Press Start 2P' is a pixel font with no emoji coverage, and unlike most
// fonts it maps unsupported codepoints to a box rather than letting the
// browser fall back. That is the stray "x" the beta report saw in front of
// TODAY'S BOUT (TM-19): the sword was there, the font just could not draw it.
//
// Wrapping the character in the system emoji stack takes it out of the pixel
// font for that glyph only, so the label keeps its arcade type and the emoji
// keeps its colour. Use this anywhere an emoji sits inside Press Start 2P.
const EMOJI_STACK = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Android Emoji",sans-serif';

export default function Emoji({ children, style }) {
  return (
    <span style={{ fontFamily: EMOJI_STACK, ...style }}>{children}</span>
  );
}
