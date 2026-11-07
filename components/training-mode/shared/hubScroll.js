import { useEffect, useRef, useState } from 'react';

// Shared by the Fit and Fight hubs. Each hub is exactly one screen tall and its
// stack of cards sizes itself to the room it has (flex, down to floors that
// still read and tap). Only on a very short phone do the floors not fit and the
// stack scrolls; these two helpers make that case honest.

// A fade on the stack's lower edge while there is more below it: the "this
// scrolls" hint. It disappears once the stack is scrolled to its end.
export const STACK_FADE = 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)';

// Returns the ref for the scrolling stack and the mask to put on it. `key` is
// anything that changes when the stack's children change (a card appearing),
// so the observers are attached to the new set.
export function useScrollFade(key) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    check();
    el.addEventListener('scroll', check, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(el);
      // A card that grows (a wrapped title) changes the content, not the stack.
      Array.from(el.children).forEach((c) => ro.observe(c));
    }
    return () => { el.removeEventListener('scroll', check); ro?.disconnect(); };
  }, [key]);
  return { ref, fade: more ? STACK_FADE : 'none' };
}

// ScreenGuide's onStep for a hub: the spotlight sits on the real element, so on
// a short phone, where the stack scrolls, bring the step's target into view
// first (the stack, not the page, scrolls). Without it the ring can land on the
// header or under the tab bar.
export function scrollGuideTarget(_i, step) {
  if (!step?.target) return;
  try { document.querySelector(`[data-guide="${step.target}"]`)?.scrollIntoView({ block: 'nearest' }); } catch { /* noop */ }
}
