import PassionLogo from './PassionLogo';

export default function IntroTitle({ flickering }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '100%', paddingTop: 24,
    }}>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
        fontSize: 'clamp(0.6rem,2.8vw,0.8rem)',
        color: '#C9A84C',
        letterSpacing: '0.3em',
        textAlign: 'center',
        marginBottom: 14,
        textShadow: '0 0 10px rgba(201,168,76,0.5)',
      }}>
        TACTICAL COMBAT FITNESS SYSTEM
      </div>
      <img
        src={PassionLogo}
        style={{ width: 90, height: 'auto', display: 'block', marginBottom: 18 }}
        alt=""
      />
      <h1
        className={flickering ? 'anim-title-flicker' : 'anim-glitch-rgb-white'}
        style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center', letterSpacing: '0.1em',
          fontSize: 'clamp(2.08rem,9.6vw,3.2rem)',
          textShadow: '0 0 18px rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.7)',
          lineHeight: 1.05,
        }}>
        TRAINING<br/>MODE
      </h1>
    </div>
  );
}
