import { Component } from 'react';
import App from '@/components/training-mode/App';
import { reportError, installErrorReporting } from '@/components/training-mode/data/analytics';
import { STALE_BUNDLE, createStaleReloadGuard } from '@/components/training-mode/data/staleBundleGuard';

// Script errors and rejected promises outside React's reach go to Plausible
// as "App Error" events (see data/analytics.js).
if (typeof window !== 'undefined') installErrorReporting();

// A lazy screen (Training Arcade, Camp map, Codec…) loads its chunk on
// demand. If the page's main bundle and that chunk come from DIFFERENT
// builds, the chunk asks for a module id the bundle has never heard of and
// React throws "Requiring unknown module N". It happens when a deploy lands
// (or the dev server restarts) while a tab is sitting open — the tab is
// running yesterday's bundle and fetches today's chunk.
//
// The bundle is never coming back: the only cure is a fresh page. So instead
// of stranding the athlete on an error screen mid-session, catch exactly that
// class of error and reload once — a blink instead of a dead end. Guarded by
// sessionStorage so a genuinely broken build can't spin in a reload loop.

// sessionStorage can throw on access (private mode, blocked site data).
function safeStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  guard = createStaleReloadGuard({
    storage: safeStorage(),
    setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
    reload: () => window.location.reload(),
  });

  componentDidMount() {
    // Mounted clean — arm the one-shot reload again for a future mismatch, but
    // not yet: this also runs when the first render threw, just before
    // componentDidCatch, and the flag has to survive until that check.
    this.guard.onMount(() => !!this.state.error);
  }

  componentWillUnmount() {
    this.guard.onUnmount((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
  }

  componentDidCatch(error: Error) {
    // A real crash (the athlete sees the error screen) is reported; a stale
    // bundle after a deploy is expected and fixes itself with a reload.
    if (!STALE_BUNDLE.test(error?.message || '')) { reportError(error, 'crash-screen'); return; }
    this.guard.onCatch(error?.message || '');
  }

  render() {
    if (this.state.error) {
      const stale = STALE_BUNDLE.test(this.state.error.message || '');
      return (
        <div style={{
          minHeight: '100dvh', background: '#0a0014', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace', color: '#f5e9ff',
        }}>
          <h1 style={{ fontSize: 18, marginBottom: 12, color: stale ? '#fde047' : '#ef4444' }}>
            {stale ? 'Updating Training Mode…' : 'Training Mode runtime error'}
          </h1>
          <p style={{ fontSize: 14, color: '#a78bb8', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
            {stale
              ? 'A newer version shipped while this was open. Reloading…'
              : this.state.error.message}
          </p>
          {/* Never a dead end: any error can be escaped by hand. */}
          <button
            onClick={() => { try { window.location.reload(); } catch { /* no-op */ } }}
            style={{
              marginTop: 18, padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.08em',
            }}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Index() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
