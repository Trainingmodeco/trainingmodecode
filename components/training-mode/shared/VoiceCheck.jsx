import { useEffect, useState } from 'react';
import { speakTest, getSpeechHealth, setVoiceGender, onSpeechHealth } from '../voiceCoach';
import { unlockAudio } from '../data/audioEngine';
import { C } from '../Styles';

// VOICE CHECK (Profile → Settings): one tap says a test line and reports what
// the phone's speech engine did with it, in plain words. Before this the only
// sign of a silent coach was silence (voice audit ENG-11 / VP-05 / ACP-09).
//
// What it shows: whether the browser has a speech engine at all, how many
// voices the phone offers, which voice the coach uses, the VOICE level, and
// the outcome of the test line (started and finished / never started / an
// error code), plus what the last session asked the engine to say and how
// many of those lines it actually started.

const FONT = "'Rajdhani',sans-serif";

function explain(result, health) {
  if (!result) return null;
  if (!result.supported) return { tone: 'bad', text: 'This browser has no speech engine, so the coach cannot talk here. Chrome or Safari on a phone both have one.' };
  if (result.volume <= 0 || health.muted) return { tone: 'bad', text: 'The VOICE level is at 0. Open the speaker icon in any session and raise VOICE.' };
  if (result.error === 'not-allowed') return { tone: 'bad', text: 'The browser blocked speech. Tap TEST THE VOICE again; if it stays blocked, allow Sound for this site in the browser’s site settings.' };
  if (result.error === 'no_events') return { tone: 'bad', text: 'The phone’s speech engine did not answer. On Android: Settings → search “Text-to-speech” → preferred engine Speech Services by Google → open it, update it, and play its sample. Then tap TEST THE VOICE again.' };
  if (result.error && !result.started) return { tone: 'bad', text: `The engine refused the line (${result.error}). The coach will fall back to the phone’s default voice; if this keeps happening, pick a different voice in the phone’s Text-to-speech settings.` };
  if (result.started && !result.ended) return { tone: 'warn', text: 'The line started but never reported finishing. The coach will still talk; lines may run a little long.' };
  return { tone: 'ok', text: 'If you heard the line, the coach works on this phone. If you saw this but heard nothing, raise the media volume (not the ring volume) and check Bluetooth is not sending sound elsewhere.' };
}

export default function VoiceCheck({ voiceCoach }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(() => getSpeechHealth());

  useEffect(() => onSpeechHealth(setHealth), []);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      unlockAudio();
      setVoiceGender(voiceCoach || 'FEMALE');
      const r = await speakTest('Voice check. Three. Two. One. Go!');
      setResult(r);
    } catch (e) {
      setResult({ supported: true, started: false, ended: false, error: String(e?.message || e), voices: 0, voice: null, volume: 1, ms: 0 });
    } finally {
      setHealth(getSpeechHealth());
      setBusy(false);
    }
  };

  const verdict = explain(result, health);
  const toneColor = verdict?.tone === 'ok' ? '#4ade80' : verdict?.tone === 'warn' ? '#facc15' : '#f87171';
  const row = (k, v) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: FONT, fontWeight: 600, fontSize: 11, color: 'rgba(255,255,255,0.78)' }}>
      <span style={{ color: C.muted }}>{k}</span><span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  );

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-label="Test the coach voice"
        style={{
          width: '100%', padding: '11px 12px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
          background: busy ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.14)',
          border: '1px solid rgba(168,85,247,0.5)',
          color: C.neon, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.1em',
        }}>
        {busy ? 'SPEAKING…' : '🔊 TEST THE VOICE'}
      </button>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.35 }}>
        Says a test line with the coach voice and shows what your phone did with it.
      </div>
      {result && (
        <div style={{
          marginTop: 8, padding: '9px 12px', borderRadius: 10,
          background: 'rgba(12,2,24,0.8)', border: `1px solid ${toneColor}55`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {row('Speech engine', result.supported ? 'found' : 'none')}
          {row('Voices on this phone', String(result.voices ?? 0))}
          {row('Voice used', result.voice || 'phone default')}
          {row('VOICE level', `${Math.round((result.volume ?? 1) * 100)}%`)}
          {row('Test line', result.ended ? `spoken (${(result.ms / 1000).toFixed(1)} s)` : result.started ? 'started, no end' : result.error === 'no_events' ? 'never started' : `error: ${result.error}`)}
          {health.attempted > 0 && row('Lines asked / started', `${health.attempted} / ${health.spoken}${health.silent ? ' · engine silent' : ''}`)}
          {verdict && (
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, color: toneColor, lineHeight: 1.4, marginTop: 4 }}>
              {verdict.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
