import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getAudioSettings, getVoiceVolume, setVoiceVolume, setMusicVolume, VOICE_MAX } from '../data/audioEngine';

// The ONLY place volume is adjusted: a speaker button in the timer corner opens
// this overlay mid-session — no pause — with a 🔊 VOICE and a 🎵 MUSIC slider.
// It auto-hides after 3s of no touch and every change persists as the new
// default.
//
// VOICE runs 0–200% (default 150%). Browser TTS itself caps at 100%, but the
// slider drives the app's own cue sounds (bells/beeps) across the full range so
// they cut through even over external music; the true >100% voice boost and
// ducking of other apps' audio land with the native wrapper. MUSIC controls
// in-app music (0–100%); it's wired now and takes effect once in-app music
// ships (a Pro perk).
const AUTO_HIDE_MS = 3000;
const VOICE_PCT_MAX = Math.round(VOICE_MAX * 100);

function Slider({ icon, label, pct, max, warn, onChange }) {
  const fill = Math.round((pct / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ font: "700 8px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.1em', width: 58, whiteSpace: 'nowrap' }}>
        {icon} {label}
      </span>
      <input
        className="vm-range"
        type="range" min={0} max={max} step={5}
        value={pct}
        onChange={onChange}
        aria-label={`${label} volume`}
        style={{ width: 104, background: `linear-gradient(90deg, #fde047 ${fill}%, rgba(255,255,255,0.14) ${fill}%)` }}
      />
      <span style={{ font: "700 9px 'Orbitron',sans-serif", color: warn ? '#f87171' : '#fff', width: 34, textAlign: 'right' }}>
        {pct}
      </span>
    </div>
  );
}

export default function VoiceMixer({ top = 12, right = 12 }) {
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(() => Math.round((getVoiceVolume() ?? 1.5) * 100));
  const [music, setMusic] = useState(() => Math.round((getAudioSettings().musicVolume ?? 0.6) * 100));
  const hideTimer = useRef(null);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const onVoice = (e) => { const v = Number(e.target.value); setVoice(v); setVoiceVolume(v / 100); scheduleHide(); };
  const onMusic = (e) => { const v = Number(e.target.value); setMusic(v); setMusicVolume(v / 100); scheduleHide(); };

  const muted = voice <= 0;

  return (
    <div style={{ position: 'absolute', top, right, zIndex: 60, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {open && (
        <div
          onPointerDown={scheduleHide}
          style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '9px 12px', borderRadius: 12,
            background: 'rgba(12,2,24,0.96)',
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
          <Slider icon="🔊" label="VOICE" pct={voice} max={VOICE_PCT_MAX} warn={muted} onChange={onVoice}/>
          <Slider icon="🎵" label="MUSIC" pct={music} max={100} onChange={onMusic}/>
        </div>
      )}

      <button
        onClick={() => { setOpen(o => !o); scheduleHide(); }}
        aria-label="Volume"
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
