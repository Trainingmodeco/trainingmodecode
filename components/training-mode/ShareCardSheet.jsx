import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Download, Copy } from 'lucide-react';
import { C } from './Styles';
import { renderShareCard, blobToFile, canShareFile, downloadBlob, FORMATS } from './data/shareCard';
import { buildShareText, copyShareText, showShareToast } from './data/shareUtils';
import { trackEvent } from './data/analytics';

// LT-4 — the preview IS the rendered image, so what you see is exactly what
// gets shared. Never a mock-up standing in for the real card.
const sheetCSS = `
@keyframes scs-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes scs-shimmer { 0% { background-position: -420px 0; } 100% { background-position: 420px 0; } }
.scs-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(168,85,247,0.14) 50%, rgba(255,255,255,0.03) 100%);
  background-size: 420px 100%;
  animation: scs-shimmer 1.1s linear infinite;
}
`;

export default function ShareCardSheet({ shareData, cardData, onClose }) {
  const [format, setFormat] = useState('story');
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef(null);
  const urlRef = useRef(null);

  const render = useCallback(async (fmt) => {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await renderShareCard({ format: fmt, data: cardData });
      if (!blob) throw new Error('no blob');
      blobRef.current = blob;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setUrl(urlRef.current);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [cardData]);

  useEffect(() => { render(format); }, [format, render]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const onShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = blobToFile(blob, format);
    const text = buildShareText(shareData);
    trackEvent('share', { mode: shareData?.mode || 'unknown', kind: 'image', format });

    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        // User dismissed the sheet — that's not a failure worth shouting about.
        if (e && e.name === 'AbortError') return;
      }
    }
    // No file-share support (most desktop browsers): save it instead, so the
    // athlete still ends up with the image rather than nothing.
    downloadBlob(blob, `training-mode-${format}.png`);
    showShareToast('Card saved — attach it to your post.');
  };

  const onSave = () => {
    if (!blobRef.current) return;
    trackEvent('share', { mode: shareData?.mode || 'unknown', kind: 'save', format });
    downloadBlob(blobRef.current, `training-mode-${format}.png`);
    showShareToast('Card saved to your device.');
  };

  const aspect = FORMATS[format].w / FORMATS[format].h;

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(4,0,10,0.86)', backdropFilter: 'blur(4px)',
    }}>
      <style dangerouslySetInnerHTML={{ __html: sheetCSS }}/>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 340, maxHeight: '92dvh', overflowY: 'auto',
        background: 'linear-gradient(180deg,#140a24,#0a0106)',
        borderRadius: 18, border: '1px solid rgba(253,224,71,0.4)',
        boxShadow: '0 0 40px rgba(168,85,247,0.25), 0 20px 50px rgba(0,0,0,0.6)',
        padding: '14px 14px 16px', animation: 'scs-in 0.24s ease both',
      }} className="no-scrollbar">

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ font: "900 12px 'Orbitron',sans-serif", color: C.yellow, letterSpacing: '0.1em' }}>SHARE YOUR WIN</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* Format toggle */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 11 }}>
          {Object.entries(FORMATS).map(([id, f]) => {
            const active = id === format;
            return (
              <button key={id} onClick={() => setFormat(id)} style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                background: active ? C.yellow : 'rgba(16,4,30,0.8)',
                border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
                color: active ? '#0a0014' : '#d9d1ef',
              }}>
                <div style={{ font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.08em' }}>{f.label}</div>
                <div style={{ font: "600 8px 'Rajdhani',sans-serif", opacity: 0.8, marginTop: 1 }}>{f.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Preview — this is the actual PNG that gets shared */}
        <div style={{
          width: '100%', aspectRatio: String(aspect), borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(168,85,247,0.3)', marginBottom: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#080012',
        }} className={busy ? 'scs-shimmer' : undefined}>
          {!busy && url && <img src={url} alt="Share card preview" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>}
          {!busy && failed && (
            <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#f87171', padding: 16, textAlign: 'center' }}>
              Couldn&apos;t render the card. You can still share the text version.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button onClick={onShare} disabled={busy || failed} style={{
            width: '100%', height: 44, borderRadius: 11, border: 'none',
            background: busy || failed ? 'rgba(253,224,71,0.25)' : 'linear-gradient(135deg,#fde047,#f59e0b)',
            color: '#0a0014', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.08em',
            cursor: busy || failed ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}><Share2 size={15}/> SHARE IMAGE</button>

          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={onSave} disabled={busy || failed} style={{
              flex: 1, height: 40, borderRadius: 11,
              background: 'rgba(176,106,255,0.1)', border: '1px solid rgba(176,106,255,0.4)',
              color: '#b06aff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em',
              cursor: busy || failed ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><Download size={13}/> SAVE</button>
            <button onClick={() => copyShareText(buildShareText(shareData))} style={{
              flex: 1, height: 40, borderRadius: 11,
              background: 'transparent', border: '1px solid rgba(253,224,71,0.3)',
              color: C.yellow, font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><Copy size={13}/> COPY TEXT</button>
          </div>
        </div>

        <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#6f6590', textAlign: 'center', marginTop: 9, lineHeight: 1.4 }}>
          SHARE hands the image to your phone&apos;s share sheet — pick Instagram,
          TikTok or anywhere else from there.
        </div>
      </div>
    </div>,
    document.body
  );
}
