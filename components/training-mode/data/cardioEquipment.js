// What you are actually standing on, and how that thing can be tracked.
//
// The old model had four METHOD cards — RUNNING, MACHINE, ALTERNATE, EXERCISE —
// and the card WAS the selection. That collapsed real differences: "RUNNING"
// covered both a park and a belt, which need opposite tracking, and "MACHINE"
// covered a bike (whose console shows speed, so distance is recoverable) and an
// elliptical (whose console mostly does not, so distance would be a guess).
// Equipment is now its own step, and each piece of equipment declares how it
// can honestly be measured.
//
// The four tracking modes, in descending order of how much the app knows:
//
//   'gps'      Satellites measure the distance. Outdoors only.
//   'speed'    The athlete matches a dial to the console and distance is that
//              speed integrated over time. As good as the machine's calibration.
//   'console'  No trustworthy live distance, but the console keeps a real one.
//              Run on time, then take its number at the end.
//   'time'     No trustworthy distance at all. The goal is minutes. Cadence and
//              calories carry the session; nothing invents a distance.
//
// The rule behind that list: never show a distance the app cannot stand behind.
// An estimated distance is worse than no distance, because it looks like a
// measurement and cannot be argued with.

export const CARDIO_EQUIPMENT = [
  {
    id: 'gps-run',
    group: 'running',
    label: 'GPS RUN',
    icon: '🛰',
    blurb: 'Outdoors. Satellite distance, route map, splits.',
    tracking: 'gps',
    cardioType: 'outdoor-run',
    cadenceKind: 'run',
    methodLabel: 'Running',
  },
  {
    id: 'treadmill',
    group: 'running',
    label: 'TREADMILL',
    icon: '🏃',
    blurb: 'Match the belt speed. Real distance, pace and cadence.',
    tracking: 'speed',
    cardioType: 'treadmill',
    cadenceKind: 'run',
    methodLabel: 'Treadmill',
  },
  {
    id: 'bike',
    group: 'machine',
    label: 'BIKE',
    icon: '🚲',
    blurb: 'Match the console speed. Distance and pedal cadence.',
    tracking: 'speed',
    cardioType: 'bike',
    cadenceKind: 'bike',
    methodLabel: 'Bike',
  },
  {
    id: 'rower',
    group: 'machine',
    label: 'ROWER',
    icon: '🚣',
    blurb: 'Timed, with stroke rate. Enter the metres at the end.',
    tracking: 'console',
    cardioType: 'row-machine',
    cadenceKind: 'row',
    methodLabel: 'Rower',
    consoleUnit: 'm',
  },
  {
    id: 'elliptical',
    group: 'machine',
    label: 'ELLIPTICAL',
    icon: '⚙️',
    blurb: 'Timed. Cadence and calories — no guessed distance.',
    tracking: 'time',
    cardioType: 'elliptical',
    cadenceKind: 'bike',
    methodLabel: 'Elliptical',
  },
  {
    id: 'stairs',
    group: 'machine',
    label: 'STAIR CLIMBER',
    icon: '🪜',
    blurb: 'Timed. Step rate and calories.',
    tracking: 'time',
    cardioType: 'stair-climber',
    cadenceKind: 'stairs',
    methodLabel: 'Stair Climber',
  },
];

export const equipmentById = (id) => CARDIO_EQUIPMENT.find(e => e.id === id) || CARDIO_EQUIPMENT[0];
export const equipmentInGroup = (group) => CARDIO_EQUIPMENT.filter(e => e.group === group);

/** The default piece of equipment for a group — the one most people mean. */
export const defaultEquipment = (group) => (equipmentInGroup(group)[0] || CARDIO_EQUIPMENT[0]).id;

/** Can this equipment produce a distance we are willing to put on screen? */
export const tracksDistance = (eq) => eq.tracking === 'gps' || eq.tracking === 'speed';

/** Short line for the METHOD card, so the choice is visible without opening it. */
export const trackingLabel = (eq) => {
  switch (eq.tracking) {
    case 'gps': return 'GPS distance';
    case 'speed': return 'Speed dial → distance';
    case 'console': return 'Timed · metres at the end';
    default: return 'Timed · cadence';
  }
};
