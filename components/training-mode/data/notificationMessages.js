const MESSAGES = {
  streak: [
    'Your next mission is ready. Keep the streak alive.',
    'Your streak needs attention. Keep it alive today.',
    'Rebuild the streak. Start today.',
    'One round can restart the whole rhythm.',
    'Small session. Big momentum.',
  ],
  inactivity1: [
    'One quick session today keeps the momentum going.',
    'Your training arc is not finished.',
    'The app is ready when you are.',
    'Five minutes is better than zero.',
    "Today's training can be simple. Just begin.",
  ],
  inactivity2: [
    'You have not trained in 2 days. Let\'s get back in.',
    "Don't overthink it. Open the app and move.",
    'Your progress is too valuable to abandon.',
    'You are not starting over. You are continuing.',
    'Discipline is built on days like this.',
  ],
  inactivity3: [
    'Three days off. No guilt. Just restart with one round.',
    'Training Mode is waiting. Start with something simple.',
    'You paused. Now reload.',
    'No pressure. Just one clean workout.',
    'Get back in. The mission is still active.',
  ],
  inactivity7: [
    'Training Mode is still here. Restart with a quick mission.',
    'Your fighter stats are waiting for an upgrade.',
    'Your future self needs this session.',
    'Open Training Mode and clear today\'s mission.',
    'The app is ready when you are.',
  ],
  progress: [
    'You are close to leveling up. One session could push you forward.',
    'Your next level is closer than you think.',
    'Complete one mission and collect your XP.',
    'Your fighter stats are waiting for an upgrade.',
  ],
  program: [
    'Your challenge progress is still active.',
    'Your program day is waiting.',
    "You're on track. Complete today's mission.",
    'Get back in. The mission is still active.',
    'Your challenge is waiting. Complete today\'s stage.',
  ],
  fightMode: [
    'Fight Mode is ready. Three rounds is better than zero.',
    'Your combat skills need reps. Jump in for a quick round.',
  ],
  fitMode: [
    'Fit Mode is ready. Build strength one session at a time.',
    'A short workout is still a workout. Start building.',
  ],
};

export function getRandomMessage(category) {
  const pool = MESSAGES[category];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getAllCategories() {
  return Object.keys(MESSAGES);
}
