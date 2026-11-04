// Build Workout: ending a session with exercises still left.
//
// FINISH WORKOUT (under START on the list, and on the map that slides up
// after an exercise) ends the session to the summary like STOP does. The
// confirm says what that means: the rows left open or skipped don't count.
// With every exercise done the gold COMPLETE WORKOUT takes over, and it needs
// no confirm.

// FINISH WORKOUT shows once something is done and something is still left.
export function canFinishEarly(done, total) {
  return total > 0 && done > 0 && done < total;
}

// The confirm's title and line: "Finish with 6 of 8 done?" / "The 2 left
// won't count."
export function finishPrompt(done, total) {
  const left = Math.max(0, total - done);
  return {
    title: `Finish with ${done} of ${total} done?`,
    line: `The ${left} left won't count.`,
  };
}
