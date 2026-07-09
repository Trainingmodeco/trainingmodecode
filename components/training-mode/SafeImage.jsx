import { useState, useRef, useEffect } from 'react';
import { C } from './Styles';
import { WEBP_FILES } from './data/webpManifest';

const WEBP_SET = new Set(WEBP_FILES);

function getWebpPath(src) {
  if (!src) return null;
  const match = src.match(/^(.+)\.(png|jpg|jpeg)$/i);
  if (!match) return null;
  const webp = match[1] + '.webp';
  // Only offer the WebP candidate if it was actually generated on disk,
  // so we never fire a request for a .webp that does not exist.
  return WEBP_SET.has(webp) ? webp : null;
}

export default function SafeImage({
  src,
  fallbackSrc,
  alt,
  style,
  className,
  loading = 'lazy',
  decoding = 'async',
  preferWebp = true,
  onFail,
}) {
  const webpCandidate = preferWebp ? getWebpPath(src) : null;
  const [currentSrc, setCurrentSrc] = useState(webpCandidate || src);
  const [failed, setFailed] = useState(false);
  const triedWebp = useRef(false);
  const triedOriginal = useRef(false);

  useEffect(() => {
    const nextWebp = preferWebp ? getWebpPath(src) : null;
    setCurrentSrc(nextWebp || src);
    setFailed(false);
    triedWebp.current = false;
    triedOriginal.current = false;
  }, [src, preferWebp]);

  const handleError = () => {
    if (webpCandidate && currentSrc === webpCandidate && !triedWebp.current) {
      triedWebp.current = true;
      setCurrentSrc(src);
      return;
    }

    if (currentSrc === src && !triedOriginal.current) {
      triedOriginal.current = true;
      if (fallbackSrc && fallbackSrc !== src) {
        setCurrentSrc(fallbackSrc);
        return;
      }
    }

    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }

    setFailed(true);
    onFail?.();
  };

  const handleLoad = (e) => {
    const img = e.target;
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      handleError();
    }
  };

  if (failed) {
    return (
      <div
        className={className}
        style={{
          ...style,
          height: style?.height === 'auto' ? '100%' : style?.height,
          minHeight: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(10,0,20,0.95), rgba(30,5,50,0.7))',
          border: '1px solid rgba(253,224,71,0.1)',
        }}
      >
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
          color: C.yellow, letterSpacing: '0.1em', opacity: 0.5, textAlign: 'center',
          padding: '0 8px',
        }}>{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}
