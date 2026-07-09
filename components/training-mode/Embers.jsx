// The floating flame/spark effect is reserved for the hero/entry screen only
// (SplashScreen renders its own dedicated spark animation). Everywhere else this
// is a no-op so the ambient embers don't distract from screen content. Kept as a
// component so the existing call sites need no changes.
export default function Embers() {
  return null;
}
