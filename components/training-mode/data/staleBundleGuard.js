// The one-shot reload for a stale bundle (see app/index.tsx), kept apart from
// React so the ordering can be tested in Node.
//
// The flag says "I already reloaded once for this". It must NOT be cleared the
// moment the boundary mounts: when the first render throws, React still mounts
// the fallback and runs componentDidMount BEFORE componentDidCatch, so the
// flag was always gone by the time it was checked and a chunk that kept
// failing reloaded the page for ever. Instead it is cleared after the page has
// stayed up for a while with no error on screen; a reload kills that timer.
export const STALE_BUNDLE = /Requiring unknown module|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i;
export const RELOAD_FLAG = 'tm_stale_bundle_reload';
export const REARM_MS = 15000;

export function createStaleReloadGuard({ storage, setTimer, reload, rearmMs = REARM_MS }) {
  let timer = null;
  return {
    // Mounted: arm the reload again for a future mismatch, but only if the page
    // survives rearmMs without an error screen.
    onMount(hasError) {
      timer = setTimer(() => {
        timer = null;
        if (hasError()) return;
        try { storage?.removeItem(RELOAD_FLAG); } catch { /* private mode */ }
      }, rearmMs);
    },
    onUnmount(clearTimer) { if (timer != null) clearTimer(timer); timer = null; },
    // Returns true when a reload was scheduled.
    onCatch(message) {
      if (!STALE_BUNDLE.test(message || '')) return false;
      try {
        if (storage?.getItem(RELOAD_FLAG)) return false; // already tried once
        storage?.setItem(RELOAD_FLAG, '1');
      } catch { /* private mode — fall through and reload anyway */ }
      // Navigations are network-first, so this pulls a matching bundle + chunks.
      setTimer(() => { try { reload(); } catch { /* no-op */ } }, 60);
      return true;
    },
  };
}
