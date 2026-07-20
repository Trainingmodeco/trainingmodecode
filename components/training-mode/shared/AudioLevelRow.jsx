import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getAudioSettings, setVoiceVolume } from '../data/audioEngine';

// LT-1 — setup-screen AUDIO row. The old voice on/off toggle was a blunt
// instrument; what athletes actually needed in testing was "make the coach
// louder", so this shows the cue level and lets them set it before starting.
// Matches StepperRow's shape so it sits naturally in the setup stack.
//
// A web PWA can't turn down the phone's own music player — only our own cues
// go up — so the row says so plainly rather than pretending otherwise.
export default function AudioLevelRow({ accent = '#fde047' }) {
  const [vol, setVol] = useState(() => getAudioSettings().voiceVolume ?? 1);
  const pct = Math.round(vol * 100);
  const muted = vol <= 0.001;

  const onChange = (e) => {
    const v = Number(e.target.value) / 100;
    setVol(v);
    setVoiceVolume(v);
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: 'rgba(8,2,18,0.82)', border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: 11, padding: '7px 10px',
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .alr-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; }
          .alr-range::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: #fde047; border: none; cursor: pointer; box-shadow: 0 0 8px rgba(253,224,71,0.6); }
          .alr-range::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: #fde047; border: none; cursor: pointer; }
        ` }}/>
        {muted
          ? <VolumeX size={15} color="#f87171" style={{ flexShrink: 0 }}/>
          : <Volume2 size={15} color={accent} style={{ flexShrink: 0 }}/>}
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
          letterSpacing: '0.07em', color: '#d9d1ef', flexShrink: 0,
        }}>AUDIO</span>
        <input
          className="alr-range"
          type="range" min={0} max={100} step={5}
          value={pct}
          onChange={onChange}
          aria-label="Voice cue volume"
          style={{
            flex: 1, minWidth: 0,
            background: `linear-gradient(90deg, ${accent} ${pct}%, rgba(255,255,255,0.14) ${pct}%)`,
          }}
        />
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
          color: muted ? '#f87171' : '#fff', width: 34, textAlign: 'right', flexShrink: 0,
        }}>{pct}%</span>
      </div>

      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5,
        color: muted ? '#f87171' : '#8b83a8', marginTop: 4, paddingLeft: 2, lineHeight: 1.3,
      }}>
        {muted
          ? 'Voice cues are off — you won’t hear call-outs or the coach.'
          : 'Cue volume. If your own music drowns it out, turn the music down on your phone — the app can’t.'}
      </div>
    </div>
  );
}
