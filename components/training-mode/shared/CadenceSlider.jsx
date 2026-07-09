import { useMemo } from 'react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';

const GOLD = C.yellow;

export const CADENCE_PRESETS = {
  slow: 3000,
  moderate: 2000,
  fast: 1250,
};

export const CADENCE_MIN_MS = 750;
export const CADENCE_MAX_MS = 4000;
export const CADENCE_STEP_MS = 250;

const PRESET_OPTIONS = ['slow', 'moderate', 'fast', 'custom'];
const PRESET_LABELS = { slow: 'SLOW', moderate: 'MODERATE', fast: 'FAST', custom: 'CUSTOM' };

const SLIDER_STYLES = `
.cadence-slider-input {
  width: 100%;
  height: 6px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 3px;
  cursor: pointer;
  outline: none;
}
.cadence-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c2, ${GOLD} 55%, #b8860b 100%);
  border: 1px solid rgba(10,0,20,0.6);
  box-shadow: 0 0 8px rgba(253,224,71,0.55);
  cursor: pointer;
}
.cadence-slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c2, ${GOLD} 55%, #b8860b 100%);
  border: 1px solid rgba(10,0,20,0.6);
  box-shadow: 0 0 8px rgba(253,224,71,0.55);
  cursor: pointer;
}
.cadence-slider-input:disabled { cursor: not-allowed; }
.cadence-slider-input:disabled::-webkit-slider-thumb { box-shadow: none; opacity: 0.5; }
.cadence-slider-input:disabled::-moz-range-thumb { box-shadow: none; opacity: 0.5; }
`;

function presetFromValue(value) {
  if (value === CADENCE_PRESETS.slow) return 'slow';
  if (value === CADENCE_PRESETS.moderate) return 'moderate';
  if (value === CADENCE_PRESETS.fast) return 'fast';
  return 'custom';
}

function clampMs(ms) {
  const stepped = Math.round(ms / CADENCE_STEP_MS) * CADENCE_STEP_MS;
  return Math.min(CADENCE_MAX_MS, Math.max(CADENCE_MIN_MS, stepped));
}

export default function CadenceSlider({
  value = CADENCE_PRESETS.moderate,
  onChange,
  preset: presetProp,
  onPresetChange,
  disabled = false,
  lockedMessage = 'Cadence locked for this mode.',
}) {
  const cadenceMs = clampMs(value);
  const activePreset = presetProp || presetFromValue(cadenceMs);
  const showSlider = activePreset === 'custom';

  const fillPct = useMemo(
    () => ((cadenceMs - CADENCE_MIN_MS) / (CADENCE_MAX_MS - CADENCE_MIN_MS)) * 100,
    [cadenceMs]
  );

  function selectPreset(next) {
    if (disabled) return;
    onPresetChange?.(next);
    if (next !== 'custom') onChange?.(CADENCE_PRESETS[next]);
  }

  function handleSlider(e) {
    if (disabled) return;
    onChange?.(clampMs(Number(e.target.value)));
  }

  if (disabled) {
    return (
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
        opacity: 0.85,
      }}>
        <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: 'rgba(239,68,68,0.85)', fontWeight: 600 }}>
          {lockedMessage}
        </span>
      </div>
    );
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: SLIDER_STYLES }}/>

      {/* Preset segmented control */}
      <div style={{
        display: 'flex', borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${ARCADE.violetBorderSoft}`, marginBottom: 8,
      }}>
        {PRESET_OPTIONS.map((opt, idx) => {
          const active = opt === activePreset;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => selectPreset(opt)}
              style={{
                flex: 1, padding: '9px 4px', border: 'none',
                borderRight: idx < PRESET_OPTIONS.length - 1 ? `1px solid ${ARCADE.violetBorderSoft}` : 'none',
                fontFamily: ARCADE.fontHead, fontWeight: 700,
                fontSize: 8, letterSpacing: '0.06em',
                transition: 'all 0.2s ease',
                background: active ? 'rgba(253,224,71,0.15)' : 'rgba(10,0,20,0.5)',
                color: active ? GOLD : 'rgba(196,181,253,0.7)',
                boxShadow: active ? 'inset 0 0 12px rgba(253,224,71,0.18)' : 'none',
                cursor: 'pointer',
              }}
            >
              {PRESET_LABELS[opt]}
            </button>
          );
        })}
      </div>

      {/* Custom slider panel */}
      {showSlider && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(10,0,20,0.6)', border: `1px solid ${ARCADE.violetBorderSoft}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 20, color: GOLD }}>
              {(cadenceMs / 1000).toFixed(2)}
            </span>
            <span style={{ fontFamily: ARCADE.fontBody, fontWeight: 600, fontSize: 12, color: C.muted }}>
              sec / rep
            </span>
          </div>
          <input
            className="cadence-slider-input"
            type="range"
            min={CADENCE_MIN_MS}
            max={CADENCE_MAX_MS}
            step={CADENCE_STEP_MS}
            value={cadenceMs}
            onChange={handleSlider}
            style={{
              background: `linear-gradient(to right, #a855f7 0%, ${GOLD} ${fillPct}%, rgba(255,255,255,0.08) ${fillPct}%, rgba(255,255,255,0.08) 100%)`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted }}>FAST</span>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: GOLD }}>TARGET</span>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted }}>SLOW</span>
          </div>
        </div>
      )}
    </div>
  );
}
