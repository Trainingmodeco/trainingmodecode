import { useEffect, useState } from 'react';
import { speakTest, getSpeechHealth, setVoiceGender, onSpeechHealth, resetVoiceChoice, clearVoiceMisses } from '../voiceCoach';
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
// many of those lines it actually started. Also whether this build carries
// the recorded coach voice (clips the coach plays instead of asking the
// phone's speech engine) and, when the test line came from those clips, says so.
// It shows a pass only when sound really started, and lists the lines the
// recorded voice could not say on this phone (kept on the device only).

const FONT = "'Rajdhani',sans-serif";

function explain(result, health) {
  if (!result) return null;
  if (result.engine === 'clips' && result.started) {
    if (result.volume <= 0 || health.muted) return { tone: 'bad', text: 'The VOICE level is at 0. Open the speaker icon in any session and raise VOICE.' };
    return { tone: 'ok', text: 'The coach speaks from recorded clips on this phone; the phone\u2019s speech engine only reads long text. If you heard the line, you\u2019re set.' };
  }
  if (result.engine === 'clips') return { tone: 'bad', text: 'The recorded voice was sent, but the phone\u2019s sound did not start. End any call, check the media volume and Bluetooth, then tap TEST THE VOICE again.' };
  if (!result.supported) return { tone: 'bad', text: 'This browser has no speech engine, so the coach cannot talk here. Chrome or Safari on a phone both have one.' };
  if (result.volume <= 0 || health.muted) return { tone: 'bad', text: 'The VOICE level is at 0. Open the speaker icon in any session and raise VOICE.' };
  const tried = result.tried || [];
  const worked = result.started || result.ended;
  if (worked && tried.length > 1) {
    const failed = tried.filter((t) => t.error).map((t) => t.voice).join(', ');
    return { tone: 'ok', text: `The phone\u2019s first voice${tried.length > 2 ? 's' : ''} (${failed}) would not speak, so the app switched to ${result.voice} and will keep using it. If you heard the line, you\u2019re set.` };
  }
  if (result.error === 'not-allowed') return { tone: 'bad', text: 'The browser blocked speech. Tap TEST THE VOICE again; if it stays blocked, allow Sound for this site in the browser\u2019s site settings.' };
  if (result.error === 'no_events') return { tone: 'bad', text: 'The phone\u2019s speech engine did not answer. On Android: Settings \u2192 search \u201cText-to-speech\u201d \u2192 preferred engine Speech Services by Google \u2192 open it, update it, and play its sample. Then tap TEST THE VOICE again.' };
  if (!worked && tried.length > 1) return { tone: 'bad', text: `Every voice the app tried failed (${tried.map((t) => t.voice).join(', ')}). The speech engine is missing its voice data. On Android: Settings \u2192 search \u201cText-to-speech\u201d \u2192 Speech Services by Google \u2192 Install voice data \u2192 download English (United Kingdom) or (United States); also update Speech Services by Google in the Play Store. Then tap RESET and TEST again.` };
  if (result.error && !worked) return { tone: 'bad', text: `The engine refused the line (${result.error}). On Android: Settings \u2192 search \u201cText-to-speech\u201d \u2192 Speech Services by Google \u2192 Install voice data, and update the app in the Play Store. Then tap TEST THE VOICE again.` };
  if (result.started && !result.ended) return { tone: 'warn', text: 'The line started but never reported finishing. The coach will still talk; lines may run a little long.' };
  if (!result.started) return { tone: 'warn', text: 'The phone never said the line started. If you heard nothing, raise the media volume (not the ring volume) and check Bluetooth is not sending sound elsewhere.' };
  if (result.clipLine && result.clipError) return { tone: 'warn', text: `The recorded voice did not play (${result.clipError}), so the phone\u2019s speech engine said the line. Tap TEST THE VOICE again; if it stays this way, the coach may be quiet in sessions.` };
  return { tone: 'ok', text: 'If you heard the line, the coach works on this phone. If you saw this but heard nothing, raise the media volume (not the ring volume) and check Bluetooth is not sending sound elsewhere.' };
}

const MISS_LABEL = { 'no-clip': 'no clip', partial: 'said in part', dropped: 'replaced in queue', late: 'clips not ready' };

function clipsLabel(health) {
  const c = health.clips || {};
  if (c.ready) return `ready (${c.count} clips)`;
  if (c.status === 'loading' || c.status === 'none') return 'loading';
  return 'not on this build';
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
  const misses = health.misses || { count: 0, list: [] };
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
      {result && result.engine !== 'clips' && !(result.started || result.ended) && (
        <button type="button" onClick={() => { resetVoiceChoice(); run(); }} style={{ marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'none', border: '1px dashed rgba(168,85,247,0.4)', color: '#9a90b8', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.08em' }}>RESET AND TRY EVERY VOICE AGAIN</button>
      )}
      {result && (
        <div style={{
          marginTop: 8, padding: '9px 12px', borderRadius: 10,
          background: 'rgba(12,2,24,0.8)', border: `1px solid ${toneColor}55`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {row('Recorded coach voice', clipsLabel(health))}
          {row('Speech engine', result.supported ? 'found' : 'none')}
          {row('Voices on this phone', String(result.voices ?? 0))}
          {row('Voice used', result.voice || 'phone default')}
          {row('VOICE level', `${Math.round((result.volume ?? 1) * 100)}%`)}
          {(result.tried || []).length > 1 && row('Voices tried', (result.tried || []).map((t) => `${t.voice}${t.error ? ' \u2717' : ' \u2713'}`).join(', '))}
          {row('Test line', `${result.ended ? `spoken (${(result.ms / 1000).toFixed(1)} s)` : result.started ? 'started, no end' : result.error === 'no_events' ? 'never started' : result.error === 'no_sound' ? 'no sound started' : `error: ${result.error}`}${result.engine === 'clips' ? ' from recorded clips' : ' by the phone\u2019s speech engine'}`)}
          {result.engine !== 'clips' && health.clips && health.clips.ready && row('Recorded voice', `no recorded clip played${result.clipError ? ` (${result.clipError})` : ''}`)}
          {health.attempted > 0 && row('Lines asked / started', `${health.attempted} / ${health.spoken}${health.silent ? ' · engine silent' : ''}`)}
          {verdict && (
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, color: toneColor, lineHeight: 1.4, marginTop: 4 }}>
              {verdict.text}
            </div>
          )}
        </div>
      )}
      {misses.list.length > 0 && (
        <div style={{ marginTop: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(12,2,24,0.8)', border: '1px solid rgba(251,146,60,0.35)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {row('Lines not fully said from the recorded voice', misses.count > 0 ? `${misses.count} since the app opened` : `${misses.list.length} kept`)}
          {misses.list.slice(0, 5).map((m) => (
            <div key={`${m.at}-${m.line}`} style={{ fontFamily: FONT, fontWeight: 600, fontSize: 10.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
              <span style={{ color: '#fb923c' }}>{MISS_LABEL[m.reason] || m.reason}</span> · {m.line}
            </div>
          ))}
          <button type="button" onClick={() => clearVoiceMisses()} style={{ marginTop: 4, alignSelf: 'flex-start', minHeight: 32, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: 'none', border: '1px solid rgba(251,146,60,0.45)', color: '#fb923c', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.08em' }}>CLEAR THE LIST</button>
        </div>
      )}
    </div>
  );
}
