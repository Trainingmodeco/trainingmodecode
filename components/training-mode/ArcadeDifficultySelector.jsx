import { C } from './Styles';
import { Volume2, VolumeX } from 'lucide-react';

const DIFFICULTY_INFO = {
  rookie: { label: 'ROOKIE', desc: '50-60% reps, longer rest, slower cadence', color: '#22c55e' },
  standard: { label: 'STANDARD', desc: 'Original stage reps, normal rest & cadence', color: '#3b82f6' },
  heroic: { label: 'HEROIC', desc: '125-150% reps, shorter rest, fast cadence', color: '#f59e0b' },
  boss: { label: 'BOSS', desc: 'Hardest variations, minimal rest, max XP', color: '#ef4444' },
};

const CADENCE_INFO = {
  slow: { label: 'SLOW', desc: '3\u20134s per rep', color: '#22c55e' },
  moderate: { label: 'MODERATE', desc: '2s per rep', color: '#3b82f6' },
  normal: { label: 'NORMAL', desc: '2s per rep', color: '#3b82f6' },
  fast: { label: 'FAST', desc: '1s per rep', color: '#f59e0b' },
};

const REST_INFO = {
  short: { label: 'SHORT', desc: '15-20 sec', color: '#f59e0b' },
  normal: { label: 'NORMAL', desc: '30-45 sec', color: '#3b82f6' },
  extended: { label: 'EXTENDED', desc: '60-90 sec', color: '#22c55e' },
};

function OptionRow({ label, options, selected, onSelect, infoMap }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
        color: C.muted, letterSpacing: '0.12em', display: 'block', marginBottom: 8,
      }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const info = infoMap[opt] || { label: String(opt).toUpperCase(), desc: '', color: C.neon || '#a855f7' };
          const isSelected = selected === opt;
          return (
            <button key={opt} onClick={() => onSelect(opt)} style={{
              flex: 1, minWidth: 70, padding: '8px 6px', borderRadius: 8,
              background: isSelected ? `${info.color}12` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isSelected ? info.color + '60' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 900,
                color: isSelected ? info.color : C.muted, letterSpacing: '0.06em',
              }}>{info.label}</span>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 8, color: C.muted,
                fontWeight: 400, textAlign: 'center', lineHeight: 1.2,
              }}>{info.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ArcadeDifficultySelector({ series, settings, onSettingsChange }) {
  if (!series || !settings) return null;

  const { difficulty, cadence, rest, sound } = settings;

  const hasDifficulty = series.difficultyOptions?.length > 0;
  const hasCadence = series.cadenceOptions?.length > 0;
  const hasRest = series.restOptions?.length > 0;
  const hasSound = series.soundOptions?.length > 0;

  return (
    <div style={{
      background: 'rgba(14,0,28,0.9)', borderRadius: 12, padding: 14,
      border: '1px solid rgba(168,85,247,0.15)', marginBottom: 14,
    }}>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 900,
        color: C.yellow, letterSpacing: '0.12em', display: 'block', marginBottom: 14,
      }}>SESSION OPTIONS</span>

      {hasDifficulty && (
        <OptionRow
          label="DIFFICULTY"
          options={series.difficultyOptions}
          selected={difficulty}
          onSelect={(v) => onSettingsChange({ ...settings, difficulty: v })}
          infoMap={DIFFICULTY_INFO}
        />
      )}

      {hasCadence && (
        <OptionRow
          label="CADENCE"
          options={series.cadenceOptions}
          selected={cadence}
          onSelect={(v) => onSettingsChange({ ...settings, cadence: v })}
          infoMap={CADENCE_INFO}
        />
      )}

      {hasRest && (
        <OptionRow
          label="REST STYLE"
          options={series.restOptions}
          selected={rest}
          onSelect={(v) => onSettingsChange({ ...settings, rest: v })}
          infoMap={REST_INFO}
        />
      )}

      {hasSound && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
            color: C.muted, letterSpacing: '0.12em',
          }}>SOUND</span>
          <button onClick={() => onSettingsChange({ ...settings, sound: sound === 'on' ? 'off' : 'on' })} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, border: `1px solid ${sound === 'on' ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            background: sound === 'on' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {sound === 'on' ? <Volume2 size={12} color="#22c55e"/> : <VolumeX size={12} color={C.muted}/>}
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: sound === 'on' ? '#22c55e' : C.muted,
            }}>{sound === 'on' ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
