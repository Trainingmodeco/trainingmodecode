import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getAudioSettings, setVoiceVolume } from '../data/audioEngine';

// LT-1 — mid-session cue level. A web PWA can't turn the phone's own music
// down, so when cues get buried the athlete needs to push OUR voice up without
// breaking stride: tap the speaker, drag, and it's gone again in 3s. Never
// pauses the session, and the level persists as the new default.
//
// The MUSIC slider is deliberately absent — there is no in-app music yet, so a
// music fader here would do nothing. It returns with the Pro music player.
const AUTO_HIDE_MS = 3000;

export default function VoiceMixer({ top = 12, right = 12 }) {
  const [open, setOpen] = useState(false);
  const [vol, setVol] = useState(() => getAudioSettings().voiceVolume ?? 1);
  const hideTimer = useRef(null);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const onChange = (e) => {
    const v = Number(e.target.value) / 100;
    setVol(v);
    setVoiceVolume(v);
    scheduleHide();
  };

  const muted = vol <= 0.001;
  const pct = Math.round(vol * 100);

  return (
    <div style={{ position: 'absolute', top, right, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8 }}>
      {open && (
        <div
          onPointerDown={scheduleHide}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 11px', borderRadius: 11,
            background: 'rgba(12,2,24,0.95)',
            border: '1px solid rgba(253,224,71,0.35)',
            boxShadow: '0 6px 22px rgba(0,0,0,0.55)',
            animation: 'vm-in 0.18s ease both',
          }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes vm-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: none; } }
            .vm-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; }
            .vm-range::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: #fde047; border: none; cursor: pointer; box-shadow: 0 0 8px rgba(253,224,71,0.6); }
            .vm-range::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: #fde047; border: none; cursor: pointer; }
          ` }}/>
          <span style={{ font: "700 7px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
            🔊 VOICE
          </span>
          <input
            className="vm-range"
            type="range" min={0} max={100} step={5}
            value={pct}
            onChange={onChange}
            aria-label="Voice cue volume"
            style={{
              width: 96,
              background: `linear-gradient(90deg, #fde047 ${pct}%, rgba(255,255,255,0.14) ${pct}%)`,
            }}
          />
          <span style={{ font: "700 9px 'Orbitron',sans-serif", color: muted ? '#f87171' : '#fff', width: 26, textAlign: 'right' }}>
            {pct}
          </span>
        </div>
      )}

      <button
        onClick={() => { setOpen(o => !o); scheduleHide(); }}
        aria-label="Cue volume"
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(12,2,24,0.9)',
          border: `1px solid ${muted ? 'rgba(248,113,113,0.5)' : 'rgba(253,224,71,0.35)'}`,
          cursor: 'pointer', padding: 0,
        }}>
        {muted ? <VolumeX size={16} color="#f87171"/> : <Volume2 size={16} color="#fde047"/>}
      </button>
    </div>
  );
}
