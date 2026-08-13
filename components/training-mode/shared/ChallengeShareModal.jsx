import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import QRCode from './QRCode';
import { challengeFromStage, challengeURL, challengeLabel } from '../data/challengeCodes';
import { loadProfile } from '../data/userProfile';

const GOLD = '#fde047';

// Challenge a friend to the EXACT stage you're on: shows a scannable QR + a
// copyable code/link. They scan (the URL deep-links into the app) or paste the
// code into "Start from a challenge" on the Arcade hub.
export default function ChallengeShareModal({ series, stage, mode = 'fit', difficulty = 'normal', onClose }) {
  const from = loadProfile()?.name || loadProfile()?.username || '';
  const code = useMemo(
    () => challengeFromStage(series, stage, mode, difficulty, from),
    [series, stage, mode, difficulty, from],
  );
  const url = code ? challengeURL(code) : '';
  const label = challengeLabel({ series, stage, mode, difficulty });
  const [copied, setCopied] = useState('');

  const copy = async (text, which) => {
    try {
      if (navigator?.clipboard) await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* noop */ }
  };
  const share = async () => {
    try {
      if (navigator?.share) await navigator.share({ title: 'Training Mode challenge', text: `Race me — ${label}`, url });
      else copy(url, 'link');
    } catch { /* noop (user cancelled) */ }
  };

  const btn = {
    flex: 1, height: 38, borderRadius: 10, cursor: 'pointer',
    font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.05em',
    border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#c9a6ff',
  };

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: 320, background: 'rgba(16,7,32,0.96)', border: `1px solid ${GOLD}66`, borderRadius: 16, padding: '16px', boxShadow: '0 20px 55px rgba(0,0,0,0.7)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#8b83a8', padding: 4 }}><X size={16} /></button>

        <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em' }}>⚔️ CHALLENGE A FRIEND</div>
        <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff', margin: '3px 0 2px' }}>{series.title}</div>
        <div style={{ font: "700 9px 'Rajdhani',sans-serif", color: GOLD, letterSpacing: '0.03em', marginBottom: 12 }}>{label}</div>

        {url ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ padding: 10, background: '#fff', borderRadius: 12 }}>
                <QRCode value={url} size={168} />
              </div>
            </div>
            <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#b9a8d6', textAlign: 'center', marginBottom: 10 }}>
              Scan to jump straight into this stage — or share the code.
            </div>
            <div style={{ background: 'rgba(8,2,18,0.6)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '8px 10px', marginBottom: 10, font: "700 8.5px 'Rajdhani',monospace", color: '#e6d9ff', wordBreak: 'break-all', textAlign: 'center' }}>{code}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} onClick={() => copy(code, 'code')}>{copied === 'code' ? '✓ COPIED' : 'COPY CODE'}</button>
              <button style={btn} onClick={() => copy(url, 'link')}>{copied === 'link' ? '✓ COPIED' : 'COPY LINK'}</button>
              <button style={{ ...btn, border: 'none', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#0a0014' }} onClick={share}>SHARE</button>
            </div>
          </>
        ) : (
          <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#ff9a9a', textAlign: 'center', padding: '12px 0' }}>Couldn&apos;t build a code for this stage.</div>
        )}
      </div>
    </div>
  );
}
