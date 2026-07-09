import IMG1 from './IMG1';
import BrandBg from './BrandBg';

export default function PhoneFrame({ children, usePhoto = false, useBrandBg = false, extraClass = '' }) {
  return (
    <div
      className={`scanlines grain ${usePhoto ? 'fighter-silhouette' : 'app-bg checker-bg'} ${extraClass}`}
      style={{
        width: '100%', maxWidth: 440, minHeight: '100dvh',
        margin: '0 auto', position: 'relative', isolation: 'isolate',
      }}>
      {usePhoto && (
        <>
          <img
            src={IMG1}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75, zIndex: 0 }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(10,0,20,0.1) 0%, rgba(10,0,20,0.35) 40%, rgba(10,0,20,0.92) 100%)',
            zIndex: 1,
          }}/>
        </>
      )}
      {useBrandBg && (
        <>
          <img
            src={BrandBg}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.2, zIndex: 0 }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,2,18,0.45)',
            zIndex: 1,
          }}/>
        </>
      )}
      {children}
    </div>
  );
}
