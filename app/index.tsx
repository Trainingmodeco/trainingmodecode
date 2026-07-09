import { Component } from 'react';
import App from '@/components/training-mode/App';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', background: '#0a0014', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace', color: '#f5e9ff',
        }}>
          <h1 style={{ fontSize: 18, marginBottom: 12, color: '#ef4444' }}>
            Training Mode runtime error
          </h1>
          <p style={{ fontSize: 14, color: '#a78bb8', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
            {this.state.error.message}
          </p>
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
