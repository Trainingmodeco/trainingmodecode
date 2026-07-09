const START_HERE_KEY = 'tm_starthere_completed';
const FIRST_LESSON_KEY = 'trainingModeStartHereFirstLessonComplete';

export function hasCompletedFirstLesson() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(FIRST_LESSON_KEY) === 'true';
}

export function getStartHereCompleted() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(START_HERE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getLastSession(stats, typeFilter) {
  const filtered = stats.sessions.filter(s => typeFilter.includes(s.type));
  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

function isCombatGoal(goal) {
  return ['Learn Combat Basics', 'Build Fight Conditioning', 'Train Like a Fighter'].includes(goal);
}

export function getFightMiniSuggestion({ profile, stats, dailyMission }) {
  const goal = profile?.goal || '';
  const exp = profile?.experience || '';
  const isBeginner = exp === 'Beginner' || exp === 'Some Training' || !exp;
  const firstLessonDone = hasCompletedFirstLesson();
  const completedLessons = getStartHereCompleted();

  // Mission of the Day override for fight-related missions
  if (dailyMission && !dailyMission.completed) {
    const fightActions = ['fightFocus', 'comboCoach', 'practice', 'startHere'];
    if (fightActions.includes(dailyMission.action)) {
      return {
        title: dailyMission.title,
        subtitle: dailyMission.desc,
        reason: "Today's Mission",
        actionType: dailyMission.action,
        actionPayload: null,
        isMissionOfTheDay: true,
      };
    }
  }

  // Beginner combat path
  if (isBeginner && isCombatGoal(goal) && !firstLessonDone) {
    return {
      title: 'Start Here — Learn the Basics',
      subtitle: 'Complete your first beginner lesson before Fight Focus.',
      reason: 'Beginner combat path',
      actionType: 'startHere',
      actionPayload: null,
      isMissionOfTheDay: false,
    };
  }

  // Beginner who has done first lesson — suggest next lesson
  if (isBeginner && isCombatGoal(goal) && firstLessonDone) {
    const lessonOrder = ['boxing_stance', 'boxing_guard', 'boxing_jab', 'boxing_cross', 'boxing_jab_cross', 'boxing_defense'];
    const lessonTitles = {
      boxing_stance: 'Boxing Stance',
      boxing_guard: 'Guard + Footwork',
      boxing_jab: 'Jab',
      boxing_cross: 'Cross',
      boxing_jab_cross: 'Jab-Cross',
      boxing_defense: 'Basic Defense',
    };
    const next = lessonOrder.find(l => !completedLessons.includes(l));
    if (next) {
      return {
        title: `Basic — ${lessonTitles[next]}`,
        subtitle: 'Continue your beginner combat training.',
        reason: 'Next beginner lesson',
        actionType: 'startHere',
        actionPayload: null,
        isMissionOfTheDay: false,
      };
    }
    // All Basic lessons complete — suggest Fight Focus
    return {
      title: 'Fight Focus — 3 Round Starter',
      subtitle: 'You completed Basic! Ready for timed rounds.',
      reason: 'Basic complete',
      actionType: 'fightFocus',
      actionPayload: 'Boxing',
      isMissionOfTheDay: false,
    };
  }

  // Experienced users — alternate between Fight Focus and Combo Coach
  const lastFight = getLastSession(stats, ['Fight Focus', 'Combo Coach']);
  if (lastFight) {
    if (lastFight.type === 'Fight Focus') {
      return {
        title: 'Combo Coach — Speed Drill',
        subtitle: 'Switch it up with fast combo training.',
        reason: 'Based on your last session',
        actionType: 'comboCoach',
        actionPayload: 'Boxing',
        isMissionOfTheDay: false,
      };
    }
    return {
      title: 'Fight Focus — 3 Round Starter',
      subtitle: 'Timed rounds with voice coaching prompts.',
      reason: 'Based on your last session',
      actionType: 'fightFocus',
      actionPayload: 'Boxing',
      isMissionOfTheDay: false,
    };
  }

  // No fight history — default
  if (!isBeginner || !isCombatGoal(goal)) {
    return {
      title: 'Fight Focus — 3 Round Starter',
      subtitle: 'Timed rounds with coach prompts. Built for fighters.',
      reason: 'Starter recommendation',
      actionType: 'fightFocus',
      actionPayload: 'Boxing',
      isMissionOfTheDay: false,
    };
  }

  // Fallback for beginners without combat goal
  return {
    title: 'Start Here — Learn the Basics',
    subtitle: 'Learn stance, guard, and your first strike.',
    reason: 'Beginner combat path',
    actionType: 'startHere',
    actionPayload: null,
    isMissionOfTheDay: false,
  };
}

export function getFitMiniSuggestion({ profile, stats, dailyMission }) {
  const goal = profile?.goal || '';
  const exp = profile?.experience || '';
  const isBeginner = exp === 'Beginner' || exp === 'Some Training' || !exp;

  // Mission of the Day override for fit-related missions
  if (dailyMission && !dailyMission.completed) {
    const fitActions = ['quickMission', 'fitSetup', 'combatConditioning'];
    if (fitActions.includes(dailyMission.action)) {
      return {
        title: dailyMission.title,
        subtitle: dailyMission.desc,
        reason: "Today's Mission",
        actionType: dailyMission.action,
        actionPayload: null,
        isMissionOfTheDay: true,
      };
    }
  }

  // Goal-based suggestions
  if (isBeginner && (goal === 'Get Fit' || goal === 'Lose Weight')) {
    return {
      title: 'Quick Mission — 12 Min Starter',
      subtitle: 'A short bodyweight circuit to get moving.',
      reason: 'Beginner fitness path',
      actionType: 'quickMission',
      actionPayload: null,
      isMissionOfTheDay: false,
    };
  }

  if (goal === 'Build Strength') {
    return {
      title: 'Workout Builder — Strength Starter',
      subtitle: 'Weighted compound moves to build raw power.',
      reason: 'Based on your goal',
      actionType: 'fitSetup',
      actionPayload: null,
      isMissionOfTheDay: false,
    };
  }

  if (goal === 'Build Fight Conditioning') {
    return {
      title: 'Combat Conditioning — Fighter Circuit',
      subtitle: 'Explosive fighter-style conditioning drills.',
      reason: 'Based on your goal',
      actionType: 'combatConditioning',
      actionPayload: null,
      isMissionOfTheDay: false,
    };
  }

  // Last session avoidance
  const lastFit = getLastSession(stats, ['Fit Mode', 'Quick Mission', 'Combat Conditioning']);
  if (lastFit) {
    if (lastFit.type === 'Combat Conditioning') {
      if (goal === 'Build Strength') {
        return {
          title: 'Workout Builder — Custom Build',
          subtitle: 'Build a workout targeting your weak points.',
          reason: 'Based on your last session',
          actionType: 'fitSetup',
          actionPayload: null,
          isMissionOfTheDay: false,
        };
      }
      return {
        title: 'Quick Mission — Active Recovery',
        subtitle: 'Light conditioning to stay active after combat work.',
        reason: 'Based on your last session',
        actionType: 'quickMission',
        actionPayload: null,
        isMissionOfTheDay: false,
      };
    }
    if (lastFit.type === 'Quick Mission') {
      if (goal === 'Build Strength' || goal === 'Train Like a Fighter') {
        return {
          title: 'Workout Builder — Custom Build',
          subtitle: 'Build a workout targeting your weak points.',
          reason: 'Based on your last session',
          actionType: 'fitSetup',
          actionPayload: null,
          isMissionOfTheDay: false,
        };
      }
      return {
        title: 'Quick Mission — New Challenge',
        subtitle: 'Fresh circuit to keep momentum going.',
        reason: 'Based on your last session',
        actionType: 'quickMission',
        actionPayload: null,
        isMissionOfTheDay: false,
      };
    }
    // Last was Fit Mode (Workout Builder)
    return {
      title: 'Quick Mission — Recovery Circuit',
      subtitle: 'Light conditioning to stay active.',
      reason: 'Based on your last session',
      actionType: 'quickMission',
      actionPayload: null,
      isMissionOfTheDay: false,
    };
  }

  // Fallback
  return {
    title: 'Quick Mission — 12 Min Starter',
    subtitle: 'A quick guided session to get you moving.',
    reason: 'Starter recommendation',
    actionType: 'quickMission',
    actionPayload: null,
    isMissionOfTheDay: false,
  };
}
