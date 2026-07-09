export const CARDIO_METHODS = [
  { id: 'outdoor-run', label: 'Outdoor Run', supportsDistance: true, supportsTimer: true, supportsIntervals: true, description: 'Run outdoors. Log distance and time manually after your run.' },
  { id: 'treadmill', label: 'Treadmill', supportsDistance: true, supportsTimer: true, supportsIntervals: true, description: 'Indoor run. Enter distance from the machine display.' },
  { id: 'bike', label: 'Bike', supportsDistance: true, supportsTimer: true, supportsIntervals: true },
  { id: 'assault-bike', label: 'Assault / Air Bike', supportsDistance: true, supportsTimer: true, supportsIntervals: true, description: 'Fan bike. Log distance or calories from the console.' },
  { id: 'elliptical', label: 'Elliptical', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'row-machine', label: 'Row Machine', supportsDistance: true, supportsTimer: true, supportsIntervals: true },
  { id: 'swimming', label: 'Swimming', supportsDistance: true, supportsTimer: true, supportsIntervals: true, manualOnly: true, description: 'Pool or open water. Log laps or distance and time after you finish.' },
  { id: 'jump-rope', label: 'Jump Rope', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'jumping-jacks', label: 'Jumping Jacks', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'high-knees', label: 'High Knees', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'mountain-climbers', label: 'Mountain Climbers', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'stair-climber', label: 'Stair Climber', supportsDistance: false, supportsTimer: true, supportsIntervals: true, description: 'Stair machine or real stairs. Timer-based.' },
  { id: 'shadowboxing-footwork', label: 'Shadowboxing Footwork', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'battle-rope', label: 'Battle Rope', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'burpees', label: 'Burpees', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'sprint-intervals', label: 'Sprint Intervals', supportsDistance: true, supportsTimer: true, supportsIntervals: true },
  { id: 'incline-walk', label: 'Incline Walk', supportsDistance: true, supportsTimer: true, supportsIntervals: false },
  { id: 'step-ups', label: 'Step-Ups', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'skater-hops', label: 'Skater Hops', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
  { id: 'marching-high-knees', label: 'Marching High Knees', supportsDistance: false, supportsTimer: true, supportsIntervals: false },
  { id: 'low-impact-cardio', label: 'Low-Impact Cardio', supportsDistance: false, supportsTimer: true, supportsIntervals: false },
  { id: 'manual-cardio', label: 'Other / Manual Cardio', supportsDistance: true, supportsTimer: true, supportsIntervals: false, manualOnly: true, description: 'Any other cardio. Log your time, and optionally distance, after finishing.' },
  { id: 'custom-cardio', label: 'Custom Cardio', supportsDistance: false, supportsTimer: true, supportsIntervals: true },
];

export const CARDIO_FORMATS = [
  { id: 'steady', label: 'Steady Cardio', description: 'Move at a controlled pace for the full timer.' },
  { id: 'interval', label: 'Interval Cardio', description: 'Alternate easy pace and fast pace.' },
  { id: 'tabata', label: 'Tabata Cardio', description: 'Short hard bursts with brief rest.' },
];

export const CARDIO_SAFETY_COPY = 'Choose a safe pace. Stop if you feel chest pain, dizziness, unusual shortness of breath, or sharp pain.';
