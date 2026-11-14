// Fight Mode practice rounds, the Just Train round brief, and the Workout Builder weight call: three sources of
// spoken lines that no sweep or coverage walk built (found by the second look of the 2026-11-14 audit).
//
// Practice (PracticeMode.jsx roundFor, about lines 326-345; PracticeRound.jsx line 81 says spokenCall(call), line 120 the rest):
//   a lesson's round is built from the lesson's own calls; a Technique Library move's round from [NAME, NAME x 2] plus the
//   three moves before it, so "double lead hook" and "slip outside, bob and weave" are said. getTechniquesFor and techCall are
//   re-typed from PracticeMode.jsx lines 56-82. The athlete's learned count changes which calls join the round: every tier.
// Just Train (JustTrainSetup.jsx lines 62-64, 148; FightFocusTimer.jsx line 336): every round says "Round N. Free flow. Your round, your pace."
// Load (FitBuilderGuidedPlayer.jsx lines 506 and 526): "Load W. Get ready. Lift." where W is the athlete's weight; in kg the step is
//   2.5 (data/weightLog.js stepFor), so W runs over halves (22.5). Whole numbers over 100 are the number composer's.
const ROOT = new URL('../../components/training-mode/', import.meta.url);
const imp = (p) => import(new URL(p, ROOT).href);

export default async () => {
  const { TECHNIQUES, PRACTICE_DISCIPLINES, PRACTICE_CATEGORIES } = await imp('practiceData.js');
  const { basicsFor } = await imp('data/practiceLessons.js');
  const { buildRound, spokenCall } = await imp('data/practiceRound.js');
  const INC = { Boxing: ['Boxing'], Kickboxing: ['Boxing', 'Kickboxing'], 'Muay Thai': ['Boxing', 'Kickboxing', 'Muay Thai'], MMA: ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'] };
  const getTechniquesFor = (discipline, category) => {
    if (category === 'Strikes') return TECHNIQUES.filter((t) => t.discipline === discipline && t.category === 'Strikes');
    const seen = new Set(); const result = [];
    for (const src of INC[discipline] || [discipline]) for (const t of TECHNIQUES) if (t.discipline === src && t.category === category && !seen.has(t.name)) { seen.add(t.name); result.push(t); }
    return result;
  };
  const techCall = (n) => n.toUpperCase();
  const LEARNED = [1, 3, 7, 11, 20];
  const lessonCalls = [], libraryCalls = [], rests = [];
  for (const disc of PRACTICE_DISCIPLINES) {
    const basics = basicsFor(disc);
    basics.forEach((lesson, i) => {
      for (const learned of LEARNED) {
        const r = buildRound({ focus: { id: lesson.id, name: lesson.title, calls: lesson.calls }, prior: basics.slice(0, i).map((l) => ({ name: l.title, calls: l.calls })), learned });
        for (const g of r.groups) for (const c of g.calls) lessonCalls.push(spokenCall(c));
        for (let n = 1; n < r.plan.rounds; n++) rests.push(`Rest. Round ${n + 1} next.`);
      }
    });
    for (const cat of PRACTICE_CATEGORIES) {
      const list = getTechniquesFor(disc, cat);
      list.forEach((t, i) => {
        for (const learned of LEARNED) {
          const r = buildRound({ focus: { name: t.name, calls: [techCall(t.name), `${techCall(t.name)} × 2`] }, prior: list.slice(Math.max(0, i - 3), i).map((p) => ({ name: p.name, calls: [techCall(p.name)] })), learned });
          for (const g of r.groups) for (const c of g.calls) libraryCalls.push(spokenCall(c));
        }
      });
    }
  }
  const justTrain = [];
  for (let n = 1; n <= 20; n++) justTrain.push(`Round ${n}. Free flow. Your round, your pace.`, `Round ${n}. Free flow.`);
  // kg halves (2.5 to 300 in 2.5); lb is whole numbers, proven by the composer. Load is said by the guided player at 506 and 526.
  const loads = []; for (let w = 2.5; w <= 300 + 1e-9; w += 2.5) loads.push(`Load ${Math.round(w * 10) / 10}. Get ready. Lift.`);
  return [
    { feature: 'Fight Mode', name: 'Practice rounds of the lessons: every call said (PracticeRound.jsx:81), every discipline and learned count', lines: [...new Set(lessonCalls)] },
    { feature: 'Fight Mode', name: 'Practice rounds of Technique Library moves: the move, double, and the moves before it (PracticeRound.jsx:81)', lines: [...new Set(libraryCalls)] },
    { feature: 'Fight Mode', name: 'Practice round rest (PracticeRound.jsx:120)', lines: [...new Set(rests)] },
    { feature: 'Fight Mode', name: 'Just Train round start (FightFocusTimer.jsx:336)', lines: justTrain },
    { feature: 'Workout Builder', name: 'Load call over kg halves (FitBuilderGuidedPlayer.jsx:506 and :526)', lines: loads },
  ];
};
