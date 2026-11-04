// Eat the next click, anywhere, for a moment.
//
// A tap that swaps the screen out from under the finger is followed by a
// click the browser hit-tests again on whatever is there now: a row started
// on pointerup (a slow tap on the workout map) lands on the player control
// under it (SKIP EXERCISE, REWIND, STOP), and the second tap of a double tap
// on FINISH lands on the summary's RETURN HOME. The trap sits at window
// capture, so that click never reaches React. A press that long may get no
// click at all, so it only waits a moment.
export default function swallowNextClick(ms = 600) {
  if (typeof window === 'undefined') return;
  const eat = (e) => { e.preventDefault(); e.stopPropagation(); release(); };
  const release = () => { clearTimeout(t); window.removeEventListener('click', eat, true); };
  const t = setTimeout(release, ms);
  window.addEventListener('click', eat, true);
}
