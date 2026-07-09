import GoldLogo from './GoldLogo';

export default function IntroLogo({ size = 64, glow = false }) {
  return (
    <img
      src={GoldLogo}
      alt="Training Mode"
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        filter: glow
          ? 'drop-shadow(0 0 12px rgba(253,224,71,0.6)) drop-shadow(0 0 24px rgba(253,224,71,0.35))'
          : undefined,
      }}
    />
  );
}
