// Reusable "cardio finisher" add-on shared by Workout Builder, Quick Mission,
// and Combat Conditioning. A single config object describes the cardio bolt-on
// that runs after the main workout. Kept intentionally simple and modular so any
// mode can attach, summarize, and play it the same way.

export const CARDIO_ADDON_TYPES = [
  { id: 'outdoor-run', label: 'Outdoor Run', methodId: 'outdoor-run', supportsDistance: true },
  { id: 'treadmill', label: 'Treadmill', methodId: 'treadmill', supportsDistance: true },
  { id: 'bike', label: 'Bike', methodId: 'bike', supportsDistance: true },
  { id: 'assault-bike', label: 'Assault / Air Bike', methodId: 'assault-bike', supportsDistance: true },
  { id: 'row-machine', label: 'Row Machine', methodId: 'row-machine', supportsDistance: true },
  { id: 'elliptical', label: 'Elliptical', methodId: 'elliptical', supportsDistance: false },
  { id: 'jump-rope', label: 'Jump Rope', methodId: 'jump-rope', supportsDistance: false },
  { id: 'stair-climber', label: 'Stair Climber', methodId: 'stair-climber', supportsDistance: false },
  { id: 'swimming', label: 'Swimming', methodId: 'swimming', supportsDistance: true },
  { id: 'shadowbox-footwork', label: 'Shadowboxing Footwork', methodId: 'shadowbox-footwork', supportsDistance: false },
  { id: 'burpees', label: 'Burpees', methodId: 'burpees', supportsDistance: false },
  { id: 'sprint-intervals', label: 'Sprint Intervals', methodId: 'sprint-intervals', supportsDistance: false },
  { id: 'step-ups', label: 'Step-Ups', methodId: 'step-ups', supportsDistance: false },
  { id: 'low-impact', label: 'Low-Impact Cardio', methodId: 'low-impact', supportsDistance: false },
  { id: 'manual-cardio', label: 'Other / Manual Cardio', methodId: 'manual-cardio', supportsDistance: true },
  { id: 'custom-cardio', label: 'Custom Cardio', methodId: 'custom-cardio', supportsDistance: true },
];

// Legacy saved cardioType values mapped to their current IDs.
const CARDIO_TYPE_ALIASES = {
  running: 'outdoor-run',
  row: 'row-machine',
  manual: 'manual-cardio',
};

export const CARDIO_TARGET_TYPES = [
  { id: 'time', label: 'Time' },
  { id: 'distance', label: 'Distance' },
  { id: 'manual', label: 'Manual' },
];

export const CARDIO_STYLES = [
  { id: 'steady', label: 'Steady Pace' },
  { id: 'roadwork', label: 'Roadwork' },
  { id: 'intervals', label: 'Intervals' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'tabata', label: 'Tabata' },
  { id: 'custom', label: 'Custom' },
];

// Time presets in seconds (10 / 20 / 30 min)
export const TIME_PRESETS = [
  { seconds: 600, label: '10 min' },
  { seconds: 1200, label: '20 min' },
  { seconds: 1800, label: '30 min' },
];

// Distance presets. km is used for 5K/10K, mi for shorter road distances.
export const DISTANCE_PRESETS = [
  { value: 1, unit: 'mi', label: '1 mi' },
  { value: 3, unit: 'mi', label: '3 mi' },
  { value: 5, unit: 'km', label: '5K' },
  { value: 10, unit: 'km', label: '10K' },
];

// Interval / Tabata timing presets keyed by cardio style.
export const INTERVAL_PRESETS = {
  intervals: { easySeconds: 60, fastSeconds: 30, rounds: 8 },
  sprints: { easySeconds: 30, fastSeconds: 30, rounds: 10 },
  roadwork: { easySeconds: 60, fastSeconds: 60, rounds: 10 },
  hiit: { easySeconds: 15, fastSeconds: 45, rounds: 10 },
  tabata: { hardSeconds: 20, restSeconds: 10, rounds: 8 },
};

export function getCardioType(typeId) {
  const normalized = CARDIO_TYPE_ALIASES[typeId] || typeId;
  return CARDIO_ADDON_TYPES.find(t => t.id === normalized) || CARDIO_ADDON_TYPES[0];
}

export function getCardioStyleLabel(styleId) {
  return CARDIO_STYLES.find(s => s.id === styleId)?.label || 'Steady Pace';
}

export function createCardioAddon(partial = {}) {
  const type = getCardioType(partial.cardioType || 'outdoor-run');
  return {
    enabled: true,
    sourceMode: partial.sourceMode || 'Workout Builder',
    placement: 'finisher',
    cardioType: type.id,
    cardioLabel: type.label,
    targetType: partial.targetType || 'time',
    targetTimeSeconds: partial.targetTimeSeconds ?? 600,
    targetDistance: partial.targetDistance ?? null,
    distanceUnit: partial.distanceUnit || 'mi',
    style: partial.style || 'steady',
    intervals: partial.intervals ?? null,
    notes: partial.notes || '',
    bonusEligible: partial.bonusEligible !== false,
  };
}

function distanceLabel(addon) {
  if (addon.targetDistance == null) return null;
  const match = DISTANCE_PRESETS.find(
    d => d.value === addon.targetDistance && d.unit === addon.distanceUnit
  );
  if (match) return match.label;
  return `${addon.targetDistance} ${addon.distanceUnit}`;
}

function timeLabel(seconds) {
  const preset = TIME_PRESETS.find(t => t.seconds === seconds);
  if (preset) return preset.label;
  return `${Math.round(seconds / 60)} min`;
}

// Middle segment of the summary line: the target ("10 min", "5K", "Manual").
export function cardioTargetLabel(addon) {
  if (addon.targetType === 'distance') return distanceLabel(addon) || 'Distance';
  if (addon.targetType === 'manual') return 'Manual';
  return timeLabel(addon.targetTimeSeconds);
}

// "Running • 10 min • Steady Pace"
export function summarizeCardioAddon(addon) {
  if (!addon) return '';
  return `${addon.cardioLabel} \u2022 ${cardioTargetLabel(addon)} \u2022 ${getCardioStyleLabel(addon.style)}`;
}

// Maps the config to CardioProtocolPlayer props (format + timing).
export function cardioAddonToPlayer(addon) {
  const type = getCardioType(addon.cardioType);
  const methodLabel = `${addon.cardioLabel} \u2022 ${getCardioStyleLabel(addon.style)}`;
  const distLabel = addon.targetType === 'distance' ? distanceLabel(addon) : null;

  if (addon.style === 'tabata') {
    const cfg = addon.intervals || INTERVAL_PRESETS.tabata;
    return {
      format: 'tabata',
      intervalConfig: cfg,
      durationSeconds: null,
      methodLabel,
      distanceLabel: distLabel,
      estimatedSeconds: cfg.rounds * (cfg.hardSeconds + cfg.restSeconds),
      methodId: type.methodId,
    };
  }

  if (addon.style === 'intervals' || addon.style === 'sprints' || addon.style === 'roadwork' || addon.style === 'hiit') {
    const cfg = addon.intervals || INTERVAL_PRESETS[addon.style];
    return {
      format: 'interval',
      intervalConfig: cfg,
      durationSeconds: null,
      methodLabel,
      distanceLabel: distLabel,
      estimatedSeconds: cfg.rounds * (cfg.easySeconds + cfg.fastSeconds),
      methodId: type.methodId,
    };
  }

  // steady / custom: timer runs to targetTimeSeconds (or a sensible default)
  const seconds = addon.targetType === 'time' ? addon.targetTimeSeconds : (addon.targetTimeSeconds || 600);
  return {
    format: 'steady',
    intervalConfig: null,
    durationSeconds: seconds,
    methodLabel,
    distanceLabel: distLabel,
    estimatedSeconds: seconds,
    methodId: type.methodId,
  };
}
