import { Component } from 'react';
import App from '@/components/training-mode/App';

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
const STALE_BUNDLE = /Requiring unknown module|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i;
const RELOAD_FLAG = 'tm_stale_bundle_reload';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    // Mounted clean — arm the one-shot reload again for a future mismatch.
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* private mode */ }
  }

  componentDidCatch(error: Error) {
    if (!STALE_BUNDLE.test(error?.message || '')) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried once
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch { /* private mode — fall through and reload anyway */ }
    // Navigations are network-first, so this pulls a matching bundle + chunks.
    setTimeout(() => { try { window.location.reload(); } catch { /* no-op */ } }, 60);
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
