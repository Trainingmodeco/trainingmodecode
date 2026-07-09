import { useState, useEffect } from 'react';
import SafeImage from './SafeImage';
import { C } from './Styles';

const GOLD = C.yellow;

const baseStyles = `
.banner-reveal-card {
  width: 100%;
  max-width: 360px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.banner-reveal-card:hover {
  transform: scale(1.01) translateY(-2px);
}
.banner-reveal-card:active {
  transform: scale(0.98);
}
.banner-reveal-card.compact:hover {
  transform: scale(1.005) translateY(-1px);
}
.banner-reveal-desc {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease, padding 0.3s ease;
  padding: 0 16px;
}
.banner-reveal-desc.open {
  max-height: 320px;
  opacity: 1;
  padding: 14px 16px;
}
.banner-reveal-desc.open.compact-desc {
  max-height: 180px;
  padding: 9px 12px;
}
`;

function useSupportsHover() {
  const [hover, setHover] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHover(mq.matches);
    const handler = (e) => setHover(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return hover;
}

export default function BannerRevealCard({
  title, subtitle, imageSrc, fallbackSrc, fallbackIcon, accentColor = GOLD,
  description, bullets, buttonLabel, onClick,
  isOpen: controlledOpen, onToggle,
  variant = 'full', imageHeight, compact,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const supportsHover = useSupportsHover();

  const isCompact = variant === 'compact' || compact;

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleToggle = (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.action === 'start') return;
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen(o => !o);
    }
  };

  const handleMouseEnter = () => {
    if (!supportsHover) return;
    if (isControlled) {
      if (!controlledOpen) onToggle?.();
    } else {
      setInternalOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!supportsHover) return;
    if (isControlled) {
      if (controlledOpen) onToggle?.();
    } else {
      setInternalOpen(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: baseStyles }}/>
      <div
        className={`banner-reveal-card${isCompact ? ' compact' : ''}`}
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          background: 'rgba(14,2,28,0.85)',
          border: `1.5px solid ${accentColor}45`,
          boxShadow: open ? `0 0 24px ${accentColor}30` : `0 0 12px ${accentColor}18`,
        }}
      >
        {/* Banner Image
          Recommended banner export size: 1200 x 360 px
          Safe zone: Keep important text, faces, logos, and characters away from the outer 80px left/right and 45px top/bottom.
        */}
        <div style={{
          width: '100%',
          aspectRatio: '16 / 5',
          minHeight: isCompact ? 72 : 120,
          maxHeight: isCompact ? 82 : 160,
          position: 'relative',
          overflow: 'hidden',
          background: '#0c0318',
        }}>
          {imageSrc ? (
            <SafeImage
              src={imageSrc}
              fallbackSrc={fallbackSrc}
              alt={title}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, rgba(10,0,20,0.9), ${accentColor}08)`,
            }}>
              {fallbackIcon || (
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                  fontSize: isCompact ? 14 : 20,
                  color: accentColor, letterSpacing: '0.1em', opacity: 0.5,
                }}>{title}</div>
              )}
            </div>
          )}
        </div>

        {/* Title strip */}
        <div style={{ padding: isCompact ? '6px 10px 5px' : '12px 16px 10px' }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: isCompact ? 11.5 : 15,
            color: '#fff', letterSpacing: '0.1em',
            textShadow: `0 0 12px ${accentColor}55`,
          }}>{title}</div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 500,
            fontSize: isCompact ? 10.5 : 12,
            color: C.muted, marginTop: isCompact ? 1 : 3,
          }}>{subtitle}</div>
        </div>

        {/* Reveal Description */}
        <div className={`banner-reveal-desc${open ? ' open' : ''}${isCompact ? ' compact-desc' : ''}`} style={{
          background: 'rgba(14,2,28,0.55)',
          borderTop: open ? `1px solid ${accentColor}25` : '1px solid transparent',
        }}>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 500,
            fontSize: isCompact ? 12 : 13,
            color: C.text, lineHeight: 1.45, marginBottom: isCompact ? 8 : 10,
          }}>{description}</div>

          {bullets && bullets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isCompact ? 4 : 5, marginBottom: isCompact ? 8 : 12 }}>
              {bullets.map((b, i) => (
                <span key={i} style={{
                  fontFamily: "'Orbitron',sans-serif",
                  fontSize: isCompact ? 7 : 8, fontWeight: 700,
                  color: accentColor, padding: isCompact ? '2px 6px' : '3px 8px',
                  borderRadius: 5,
                  background: `${accentColor}15`, border: `1px solid ${accentColor}35`,
                  letterSpacing: '0.06em',
                }}>{b}</span>
              ))}
            </div>
          )}

          {buttonLabel && (
            <button
              data-action="start"
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              style={{
                width: '100%', padding: isCompact ? '10px 0' : '12px 0',
                borderRadius: isCompact ? 8 : 10, border: 'none',
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                fontSize: isCompact ? 10 : 12,
                letterSpacing: '0.14em', cursor: 'pointer',
                boxShadow: `0 0 22px ${accentColor}50`,
              }}
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
