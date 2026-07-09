export const CC = {
  bg: '#0a0014',
  panel: '#110020',
  violet: '#2a0a3e',
  neon: '#a855f7',
  magenta: '#d946ef',
  gold: '#facc15',
  goldDim: 'rgba(250,204,21,0.7)',
  text: '#f5e9ff',
  muted: '#a78bb8',
  danger: '#ef4444',
  success: '#22c55e',
};

export const CODEC_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${CC.bg}; color: ${CC.text}; font-family: 'Rajdhani', sans-serif; -webkit-font-smoothing: antialiased; }

.codec-bg {
  background-color: ${CC.bg};
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.15) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.06) 0%, transparent 60%),
    linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 28px 28px, 28px 28px;
  background-attachment: fixed;
}

.codec-scanlines::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(to bottom,
    rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px,
    transparent 1px, transparent 3px);
  mix-blend-mode: overlay; z-index: 50;
}

.codec-panel {
  background: rgba(10,0,20,0.8);
  border: 1px solid rgba(168,85,247,0.2);
  border-radius: 14px;
  box-shadow: 0 0 20px rgba(168,85,247,0.06);
}

.codec-card {
  background: rgba(17,0,32,0.9);
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.codec-card:hover {
  border-color: rgba(168,85,247,0.45);
  box-shadow: 0 0 16px rgba(168,85,247,0.15);
}

.codec-card-gold {
  background: rgba(17,0,32,0.9);
  border: 1px solid rgba(250,204,21,0.3);
  border-radius: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.codec-card-gold:hover {
  border-color: rgba(250,204,21,0.55);
  box-shadow: 0 0 16px rgba(250,204,21,0.15);
}

.codec-btn {
  background: rgba(10,0,20,0.7);
  border: 1.5px solid rgba(168,85,247,0.35);
  border-radius: 10px;
  color: ${CC.text};
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 14px 24px;
  cursor: pointer;
  transition: all 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
.codec-btn:hover {
  border-color: rgba(168,85,247,0.65);
  box-shadow: 0 0 16px rgba(168,85,247,0.25);
  transform: translateY(-2px);
}
.codec-btn:active {
  transform: scale(0.97);
}

.codec-btn-gold {
  background: linear-gradient(135deg, rgba(250,204,21,0.15) 0%, rgba(168,85,247,0.1) 100%);
  border: 1.5px solid rgba(250,204,21,0.6);
  border-radius: 10px;
  color: ${CC.gold};
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.06em;
  padding: 16px 28px;
  cursor: pointer;
  transition: all 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
.codec-btn-gold:hover {
  border-color: rgba(250,204,21,0.9);
  box-shadow: 0 0 20px rgba(250,204,21,0.3), 0 0 40px rgba(250,204,21,0.12);
  transform: translateY(-2px);
}
.codec-btn-gold:active {
  transform: scale(0.97);
}

.codec-btn-danger {
  background: rgba(239,68,68,0.08);
  border: 1.5px solid rgba(239,68,68,0.4);
  border-radius: 10px;
  color: #ef4444;
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 10px 18px;
  cursor: pointer;
  transition: all 0.18s ease;
}
.codec-btn-danger:hover {
  border-color: rgba(239,68,68,0.7);
  box-shadow: 0 0 12px rgba(239,68,68,0.2);
}

.codec-input {
  background: rgba(10,0,20,0.9);
  border: 1px solid rgba(168,85,247,0.3);
  border-radius: 8px;
  color: ${CC.text};
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.2s ease;
  width: 100%;
}
.codec-input:focus {
  border-color: rgba(168,85,247,0.7);
  box-shadow: 0 0 8px rgba(168,85,247,0.15);
}

.codec-textarea {
  background: rgba(10,0,20,0.9);
  border: 1px solid rgba(168,85,247,0.3);
  border-radius: 10px;
  color: ${CC.text};
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  font-weight: 500;
  padding: 14px 16px;
  outline: none;
  resize: none;
  min-height: 140px;
  transition: border-color 0.2s ease;
  width: 100%;
  line-height: 1.5;
  scrollbar-width: thin;
  scrollbar-color: rgba(168,85,247,0.3) transparent;
}
.codec-textarea::-webkit-scrollbar { width: 6px; }
.codec-textarea::-webkit-scrollbar-track { background: transparent; }
.codec-textarea::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.3); border-radius: 3px; }
.codec-textarea:focus {
  border-color: rgba(168,85,247,0.7);
  box-shadow: 0 0 8px rgba(168,85,247,0.15);
}

.codec-progress-ring {
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s ease;
}

@keyframes codec-decode {
  0% { opacity: 0; transform: translateY(8px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes codec-scan-line {
  0% { top: -2px; }
  100% { top: 100%; }
}
@keyframes codec-pulse {
  0%, 100% { opacity: 0.6; box-shadow: 0 0 8px rgba(168,85,247,0.3); }
  50% { opacity: 1; box-shadow: 0 0 20px rgba(168,85,247,0.6); }
}
@keyframes codec-glow-gold {
  0%, 100% { box-shadow: 0 0 12px rgba(250,204,21,0.3); }
  50% { box-shadow: 0 0 28px rgba(250,204,21,0.6), 0 0 48px rgba(250,204,21,0.2); }
}
@keyframes codec-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes codec-shimmer {
  0% { left: -60%; }
  100% { left: 160%; }
}
@keyframes codec-blink {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
@keyframes codec-title-reveal {
  0% { opacity: 0; letter-spacing: 0.3em; }
  60% { opacity: 1; letter-spacing: 0.12em; }
  100% { opacity: 1; letter-spacing: 0.08em; }
}
@keyframes codec-check {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}

.anim-decode { animation: codec-decode 0.35s ease forwards; }
.anim-codec-pulse { animation: codec-pulse 2s ease-in-out infinite; }
.anim-codec-glow { animation: codec-glow-gold 2.5s ease-in-out infinite; }
.anim-codec-fade-up { animation: codec-fade-up 0.4s ease forwards; }
.anim-codec-blink { animation: codec-blink 1.2s ease-in-out infinite; }
.anim-codec-title { animation: codec-title-reveal 0.8s ease forwards; }
.anim-codec-check { animation: codec-check 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.2) forwards; }

.codec-timer-ring {
  transition: stroke-dashoffset 1s linear;
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
button { -webkit-tap-highlight-color: transparent; cursor: pointer; }
`;
