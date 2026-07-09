export const COMBOS: Record<string, Record<string, string[]>> = {
  Boxing: {
    easy: ['Jab', 'Jab Cross', 'Double Jab', 'Cross Hook', 'Jab Cross Hook'],
    normal: ['Jab Cross Hook', 'Jab Cross Hook Cross', 'Double Jab Cross Hook',
             'Jab Slip Cross', 'Cross Hook Cross', 'Jab Cross Body Hook'],
    hard: ['Jab Cross Hook Cross Hook', 'Slip Cross Hook Cross', 'Jab Cross Hook Body Cross',
           'Double Jab Cross Body Hook Hook', 'Jab Cross Roll Hook Cross'],
  },
  Kickboxing: {
    easy: ['Jab Cross', 'Jab Low Kick', 'Cross Low Kick', 'Jab Cross Low Kick'],
    normal: ['Jab Cross Hook Low Kick', 'Jab Low Kick Cross', 'Cross Hook Body Kick',
             'Jab Cross High Kick', 'Switch Kick Cross'],
    hard: ['Jab Cross Hook Low Kick Cross High Kick', 'Switch Kick Cross Hook Low Kick',
           'Jab Cross Spinning Back Kick', 'Low Kick Cross Hook High Kick'],
  },
  'Muay Thai': {
    easy: ['Jab Teep', 'Cross Low Kick', 'Jab Cross Knee', 'Teep Cross'],
    normal: ['Jab Cross Elbow', 'Cross Hook Knee', 'Teep Cross Low Kick',
             'Jab Cross Body Kick', 'Switch Kick Elbow'],
    hard: ['Jab Cross Elbow Knee Low Kick', 'Clinch Knee Knee Throw',
           'Teep Cross Hook Body Kick', 'Jab Elbow Knee Cross Low Kick'],
  },
  MMA: {
    easy: ['Jab Cross', 'Jab Cross Sprawl', 'Cross Low Kick', 'Jab Cross Takedown'],
    normal: ['Jab Cross Hook Takedown', 'Sprawl Cross Hook', 'Jab Cross Knee Clinch',
             'Cross Hook Body Kick Sprawl'],
    hard: ['Jab Cross Fake Shot Flying Knee', 'Sprawl Cross Hook Takedown Ground Pound',
           'Jab Cross Clinch Knee Throw', 'Switch Kick Cross Takedown Pass Mount'],
  },
};
