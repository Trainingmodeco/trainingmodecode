// The fight setups' fixed choices, kept in one plain module so the setup
// screens and the score board's rules (data/scoreBoardRules.js) read the same
// numbers: Just Train's four built-in presets and Combo Coach's cadence for
// each difficulty. The screens behave exactly as when these lived inside them.

// Just Train: the design's four starters. Tabata runs 20-second rounds, below
// the ROUND LENGTH stepper's 30-second floor; a preset may sit outside the
// stepper range. `id` names the preset on a score board (jt:boxing:bag6x3).
export const JUST_TRAIN_PRESETS = [
  { id: 'bag6x3', label: 'Bag 6×3', rounds: 6, lenSec: 180, restSec: 60 },
  { id: 'pads8x2', label: 'Pads 8×2', rounds: 8, lenSec: 120, restSec: 45 },
  { id: 'spar5x3', label: 'Spar 5×3', rounds: 5, lenSec: 180, restSec: 60 },
  { id: 'tabata8x20', label: 'Tabata 8×0:20', rounds: 8, lenSec: 20, restSec: 10 },
];

// Combo Coach: picking a difficulty sets a default cadence (seconds between
// calls, faster as it gets harder); the CADENCE stepper can move it after.
export const COMBO_CADENCE_BY_DIFF = { Easy: 4, Normal: 3.5, Hard: 3, Advanced: 2.5 };
export const COMBO_DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
export const COMBO_MODES = ['Technical', 'Combo'];

// Fight Focus's three levels.
export const FIGHT_DIFFICULTIES = ['Easy', 'Normal', 'Hard'];

// The four disciplines, as the tabs name them (shared/DisciplineTabs) and as a
// board key spells them.
export const FIGHT_DISCIPLINES = [
  { id: 'Boxing', key: 'boxing', label: 'BOXING' },
  { id: 'Kickboxing', key: 'kickboxing', label: 'KICKBOXING' },
  { id: 'Muay Thai', key: 'muay_thai', label: 'MUAY THAI' },
  { id: 'MMA', key: 'mma', label: 'MMA' },
];
