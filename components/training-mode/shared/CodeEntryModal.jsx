import { useState } from 'react';
import { X } from 'lucide-react';

// In-app replacement for window.prompt (which throws "prompt() is not supported"
// on React Native Web / Expo). Paste a code and submit. onSubmit(code) returns
// true on success (modal closes) or false (an inline error shows).
export default function CodeEntryModal({
  title = 'ENTER CODE',
  label = 'Paste your code below.',
  placeholder = 'TMC1.…',
  submitLabel = 'START',
  accent = '#a855f7',
  onSubmit,
  onClose,
}) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    const code = val.trim();
    if (!code) return;
    const ok = onSubmit?.(code);
    if (ok) onClose?.();
    else setErr('That code didn’t scan — check it and try again.');
  };

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: 320, background: 'rgba(16,7,32,0.97)', border: `1px solid ${accent}66`, borderRadius: 16, padding: '16px', boxShadow: '0 20px 55px rgba(0,0,0,0.72)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#8b83a8', padding: 4 }}><X size={16} /></button>
        <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.06em', marginBottom: 4 }}>{title}</div>
        <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#b9a8d6', marginBottom: 12 }}>{label}</div>
        <input
          autoFocus
          value={val}
          onChange={(e) => { setVal(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(8,2,18,0.7)', border: `1px solid ${err ? 'rgba(239,68,68,0.6)' : `${accent}55`}`, borderRadius: 10, color: '#eafffb', font: "700 11px 'Rajdhani',monospace", padding: '11px 12px', outline: 'none' }}
        />
        {err && <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#ff9a9a', marginTop: 7 }}>{err}</div>}
        <button onClick={submit} disabled={!val.trim()} style={{ width: '100%', height: 44, marginTop: 12, borderRadius: 11, border: 'none', cursor: val.trim() ? 'pointer' : 'not-allowed', background: val.trim() ? `linear-gradient(135deg,${accent},#6d28d9)` : 'rgba(255,255,255,0.08)', color: val.trim() ? '#fff' : '#6f6690', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.08em' }}>{submitLabel}</button>
      </div>
    </div>
  );
}
