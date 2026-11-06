// Quick Mission · what today's generated mission pays, by the minutes it is
// built for and the level it is at.
//
// It used to pay a flat 15 XP a set. But the generator fits the minutes, so a
// harder level (longer sets, shorter rests) fits FEWER sets into the same time,
// and ADVANCED paid the least of the four for the same minutes (a 45 minute
// mission: 780 XP at EASY, 630 at ADVANCED). Now the whole mission's work pays
// minutes x the level's rate, and the sets only split it (a set pays its share,
// so a run stopped halfway keeps half). The same minutes pay the same at EASY
// and MEDIUM, a little more at HARD, and the most at ADVANCED, whatever the
// seed dealt. The finish bonus (userStats XP_FIT_FULL_BONUS) is unchanged.
//
// Only a mission the generator dealt is paid this way: a library mission, a
// classic or a plan day keeps the rule it always had (15 a set, or its minutes
// on a clock). Pure: no React, no storage.
export const QM_XP_PER_MIN = { easy: 15, normal: 15, hard: 16, advanced: 18 };

// The XP the whole mission's work pays, or null when it is not a generated
// mission (or has no minutes or no known level), so the caller keeps its rule.
export function generatedMissionXp(mission) {
  if (!mission || mission.v2 || mission.named || mission.planId) return null;
  const rate = QM_XP_PER_MIN[String(mission.difficulty || '').toLowerCase()];
  const mins = Number(mission.duration);
  if (!rate || !(mins > 0)) return null;
  return Math.round(mins * rate);
}
