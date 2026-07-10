const COMBO_POOL = [
  // ======================== BOXING (30) ========================
  // Easy
  { id: 'bc-01', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab', category: 'single', coachingCue: 'Snap it back.' },
  { id: 'bc-02', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Cross', category: 'basic', coachingCue: 'Straight down the pipe.' },
  { id: 'bc-03', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Double Jab', category: 'basic', coachingCue: 'First measures, second commits.' },
  { id: 'bc-04', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Jab Cross', category: 'basic', coachingCue: 'Triple up.' },
  { id: 'bc-05', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Cross Hook', category: 'basic', coachingCue: 'Turn into the hook.' },
  { id: 'bc-06', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Body Cross', category: 'basic', coachingCue: 'Go low then high.' },
  { id: 'bc-07', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Cross Hook', category: 'basic', coachingCue: 'The classic three-piece.' },
  // Normal
  { id: 'bc-08', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Jab Cross Hook Cross', category: 'combination', coachingCue: 'Four-piece. Stay balanced.' },
  { id: 'bc-09', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Double Jab Cross Hook', category: 'combination', coachingCue: 'Set it up with the double jab.' },
  { id: 'bc-10', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Jab Slip Cross', category: 'counter', coachingCue: 'Throw, evade, counter.' },
  { id: 'bc-11', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Cross Hook Body Cross', category: 'combination', coachingCue: 'Mix the levels.' },
  { id: 'bc-12', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Jab Cross Body Hook', category: 'combination', coachingCue: 'Drop that body hook deep.' },
  { id: 'bc-13', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Hook Body Hook Head', category: 'combination', coachingCue: 'Rip body then come upstairs.' },
  { id: 'bc-14', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Jab Cross Uppercut', category: 'combination', coachingCue: 'Split the guard with the upper.' },
  { id: 'bc-15', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Slip Slip Cross Hook', category: 'counter', coachingCue: 'Evade then explode.' },
  { id: 'bc-16', discipline: 'boxing', minDifficulty: 'normal', comboText: 'Jab Body Jab Head Cross', category: 'combination', coachingCue: 'Change levels with the jab.' },
  // Hard
  { id: 'bc-17', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Jab Cross Hook Cross Hook', category: 'advanced', coachingCue: 'Five-piece. Keep your base.' },
  { id: 'bc-18', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Slip Cross Hook Body Cross', category: 'counter', coachingCue: 'Counter then dig to the body.' },
  { id: 'bc-19', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Double Jab Cross Body Hook Hook', category: 'advanced', coachingCue: 'Volume and level changes.' },
  { id: 'bc-20', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Jab Cross Roll Hook Cross', category: 'advanced', coachingCue: 'Roll under then counter.' },
  { id: 'bc-21', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Cross Hook Uppercut Cross', category: 'advanced', coachingCue: 'Keep them guessing which angle.' },
  { id: 'bc-22', discipline: 'boxing', minDifficulty: 'hard', comboText: 'Jab Jab Cross Hook Body Hook', category: 'advanced', coachingCue: 'Six punches. Keep it tight.' },
  // Advanced
  { id: 'bc-23', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Feint Jab Slip Cross Hook Cross Body Hook', category: 'elite', coachingCue: 'Feint to create the opening.' },
  { id: 'bc-24', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Jab Cross Pivot Hook Cross Hook', category: 'elite', coachingCue: 'Angle change mid-combo.' },
  { id: 'bc-25', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Roll Cross Hook Body Cross Uppercut', category: 'elite', coachingCue: 'Start from the roll. Punish.' },
  { id: 'bc-26', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Double Jab Body Cross Body Hook Hook Cross', category: 'elite', coachingCue: 'Eight punches. Relentless.' },
  { id: 'bc-27', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Feint Cross Pull Counter Cross Hook', category: 'elite', coachingCue: 'Make them miss then make them pay.' },
  { id: 'bc-28', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Jab Cross Slip Cross Body Hook Uppercut Cross', category: 'elite', coachingCue: 'Full combination mastery.' },
  { id: 'bc-29', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Parry Cross Hook Cross Hook Body Cross', category: 'elite', coachingCue: 'Defensive counter sequence.' },
  { id: 'bc-30', discipline: 'boxing', minDifficulty: 'advanced', comboText: 'Jab Hook Cross Uppercut Hook Cross', category: 'elite', coachingCue: 'Mix every angle.' },

  // ======================== KICKBOXING (30) ========================
  // Easy
  { id: 'kb-01', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Cross', category: 'basic', coachingCue: 'Hands first.' },
  { id: 'kb-02', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Low Kick', category: 'basic', coachingCue: 'High then low.' },
  { id: 'kb-03', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Cross Low Kick', category: 'basic', coachingCue: 'Power then chop.' },
  { id: 'kb-04', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Cross Low Kick', category: 'basic', coachingCue: 'Punch punch kick.' },
  { id: 'kb-05', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Teep', category: 'single', coachingCue: 'Push them back.' },
  { id: 'kb-06', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Lead Kick', category: 'single', coachingCue: 'Fast off the front leg.' },
  { id: 'kb-07', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Teep', category: 'basic', coachingCue: 'Measure then push.' },
  // Normal
  { id: 'kb-08', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Cross Hook Low Kick', category: 'combination', coachingCue: 'Hands then legs.' },
  { id: 'kb-09', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Low Kick Cross', category: 'combination', coachingCue: 'Kick between the punches.' },
  { id: 'kb-10', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Cross Hook Body Kick', category: 'combination', coachingCue: 'Punch up high, kick the body.' },
  { id: 'kb-11', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Cross High Kick', category: 'combination', coachingCue: 'Set up the head kick.' },
  { id: 'kb-12', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Switch Kick Cross', category: 'combination', coachingCue: 'Switch then hands.' },
  { id: 'kb-13', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Low Kick Low Kick Cross', category: 'combination', coachingCue: 'Double up the leg kicks.' },
  { id: 'kb-14', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Body Kick', category: 'combination', coachingCue: 'Jab high, kick the liver.' },
  { id: 'kb-15', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Hook Low Kick', category: 'combination', coachingCue: 'Same side hook to kick.' },
  { id: 'kb-16', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Cross Switch Kick', category: 'combination', coachingCue: 'Hands to switch kick.' },
  // Hard
  { id: 'kb-17', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Jab Cross Hook Low Kick Cross High Kick', category: 'advanced', coachingCue: 'Long combo. Stay sharp.' },
  { id: 'kb-18', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Switch Kick Cross Hook Low Kick', category: 'advanced', coachingCue: 'Start with the kick.' },
  { id: 'kb-19', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Low Kick Cross Hook High Kick', category: 'advanced', coachingCue: 'Low to high. Change the angle.' },
  { id: 'kb-20', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Jab Cross Body Kick Cross', category: 'advanced', coachingCue: 'Kick in the middle of the combo.' },
  { id: 'kb-21', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Teep Cross Hook Roundhouse', category: 'advanced', coachingCue: 'Push then attack.' },
  { id: 'kb-22', discipline: 'kickboxing', minDifficulty: 'hard', comboText: 'Check Cross Hook Body Kick', category: 'advanced', coachingCue: 'Defend then attack.' },
  // Advanced
  { id: 'kb-23', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Jab Cross Spinning Back Kick', category: 'elite', coachingCue: 'Set up the spin.' },
  { id: 'kb-24', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Low Kick Jab Cross Hook High Kick Cross', category: 'elite', coachingCue: 'Full arsenal.' },
  { id: 'kb-25', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Feint High Kick Low Kick Cross Hook', category: 'elite', coachingCue: 'Feint high, go low.' },
  { id: 'kb-26', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Switch Kick Hook Cross Roundhouse', category: 'elite', coachingCue: 'Constant rotation.' },
  { id: 'kb-27', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Body Kick Cross Hook Low Kick High Kick', category: 'elite', coachingCue: 'Three kicks in one combo.' },
  { id: 'kb-28', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Jab Spinning Back Fist Roundhouse', category: 'elite', coachingCue: 'Creative striking.' },
  { id: 'kb-29', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Check Counter Kick Cross Hook Kick', category: 'elite', coachingCue: 'Defensive counter flow.' },
  { id: 'kb-30', discipline: 'kickboxing', minDifficulty: 'advanced', comboText: 'Double Low Kick Cross Hook Spinning Kick', category: 'elite', coachingCue: 'Build then explode.' },

  // ======================== MUAY THAI (30) ========================
  // Easy
  { id: 'mt-01', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Teep', category: 'basic', coachingCue: 'Measure then push.' },
  { id: 'mt-02', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Cross Low Kick', category: 'basic', coachingCue: 'Heavy hand then heavy leg.' },
  { id: 'mt-03', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Cross Knee', category: 'basic', coachingCue: 'Close the distance with the knee.' },
  { id: 'mt-04', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Teep Cross', category: 'basic', coachingCue: 'Push then punch.' },
  { id: 'mt-05', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Roundhouse', category: 'basic', coachingCue: 'Set it with the jab.' },
  { id: 'mt-06', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Cross Body Kick', category: 'basic', coachingCue: 'Power cross into body kick.' },
  { id: 'mt-07', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Cross Low Kick', category: 'basic', coachingCue: 'Basic Muay Thai bread and butter.' },
  // Normal
  { id: 'mt-08', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Jab Cross Elbow', category: 'combination', coachingCue: 'Close in for the elbow.' },
  { id: 'mt-09', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Cross Hook Knee', category: 'combination', coachingCue: 'Hands to knee.' },
  { id: 'mt-10', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Teep Cross Low Kick', category: 'combination', coachingCue: 'Range control then attack.' },
  { id: 'mt-11', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Jab Cross Body Kick', category: 'combination', coachingCue: 'Punches set up the kick.' },
  { id: 'mt-12', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Switch Kick Elbow', category: 'combination', coachingCue: 'Kick then close for the elbow.' },
  { id: 'mt-13', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Hook Body Kick Knee', category: 'combination', coachingCue: 'Three different weapons.' },
  { id: 'mt-14', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Jab Knee Cross', category: 'combination', coachingCue: 'Mix in the knee.' },
  { id: 'mt-15', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Check Cross Kick', category: 'counter', coachingCue: 'Defend then punish.' },
  { id: 'mt-16', discipline: 'muay-thai', minDifficulty: 'normal', comboText: 'Cross Elbow Knee', category: 'combination', coachingCue: 'All the weapons in one flow.' },
  // Hard
  { id: 'mt-17', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Jab Cross Elbow Knee Low Kick', category: 'advanced', coachingCue: 'Five strikes. All eight limbs.' },
  { id: 'mt-18', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Clinch Knee Knee Elbow', category: 'advanced', coachingCue: 'Clinch warfare.' },
  { id: 'mt-19', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Teep Cross Hook Body Kick', category: 'advanced', coachingCue: 'Push then unload.' },
  { id: 'mt-20', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Jab Elbow Knee Cross Low Kick', category: 'advanced', coachingCue: 'Every weapon in sequence.' },
  { id: 'mt-21', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Hook Elbow Cross Body Kick', category: 'advanced', coachingCue: 'Close range to long range.' },
  { id: 'mt-22', discipline: 'muay-thai', minDifficulty: 'hard', comboText: 'Step Knee Cross Hook Roundhouse', category: 'advanced', coachingCue: 'Knee opens then follow up.' },
  // Advanced
  { id: 'mt-23', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Feint Teep Step Knee Elbow Cross Roundhouse', category: 'elite', coachingCue: 'Full Muay Thai mastery.' },
  { id: 'mt-24', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Clinch Knee Knee Elbow Push Roundhouse', category: 'elite', coachingCue: 'Clinch to range.' },
  { id: 'mt-25', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Check Counter Kick Elbow Knee', category: 'elite', coachingCue: 'Defense into offense chain.' },
  { id: 'mt-26', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Jab Cross Spinning Elbow Knee', category: 'elite', coachingCue: 'Spinning elbow surprise.' },
  { id: 'mt-27', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Low Kick Cross Elbow Clinch Knee Knee', category: 'elite', coachingCue: 'Range to clinch transition.' },
  { id: 'mt-28', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Teep Cross Hook Elbow Knee Roundhouse', category: 'elite', coachingCue: 'Six strikes. Relentless.' },
  { id: 'mt-29', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Frame Knee Elbow Push Cross Body Kick', category: 'elite', coachingCue: 'Frame to finish.' },
  { id: 'mt-30', discipline: 'muay-thai', minDifficulty: 'advanced', comboText: 'Catch Kick Sweep Cross Ground Knee', category: 'elite', coachingCue: 'Catch and punish.' },

  // ======================== MMA (30) ========================
  // Easy
  { id: 'mma-01', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Cross', category: 'basic', coachingCue: 'Straight punches.' },
  { id: 'mma-02', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Cross Sprawl', category: 'basic', coachingCue: 'Punch then defend.' },
  { id: 'mma-03', discipline: 'mma', minDifficulty: 'easy', comboText: 'Cross Low Kick', category: 'basic', coachingCue: 'Power then chop.' },
  { id: 'mma-04', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Cross Level Change', category: 'basic', coachingCue: 'Punch to shot.' },
  { id: 'mma-05', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Teep', category: 'basic', coachingCue: 'Keep them at range.' },
  { id: 'mma-06', discipline: 'mma', minDifficulty: 'easy', comboText: 'Cross Sprawl', category: 'basic', coachingCue: 'Strike then stuff.' },
  { id: 'mma-07', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Low Kick Exit', category: 'basic', coachingCue: 'In and out.' },
  // Normal
  { id: 'mma-08', discipline: 'mma', minDifficulty: 'normal', comboText: 'Jab Cross Hook Level Change', category: 'combination', coachingCue: 'Hands to shot.' },
  { id: 'mma-09', discipline: 'mma', minDifficulty: 'normal', comboText: 'Sprawl Cross Hook', category: 'counter', coachingCue: 'Stuff it then punish.' },
  { id: 'mma-10', discipline: 'mma', minDifficulty: 'normal', comboText: 'Jab Cross Knee Clinch', category: 'combination', coachingCue: 'Strikes into clinch.' },
  { id: 'mma-11', discipline: 'mma', minDifficulty: 'normal', comboText: 'Cross Hook Body Kick Sprawl', category: 'combination', coachingCue: 'Offense then defense.' },
  { id: 'mma-12', discipline: 'mma', minDifficulty: 'normal', comboText: 'Low Kick Cross Level Change', category: 'combination', coachingCue: 'Kick to takedown threat.' },
  { id: 'mma-13', discipline: 'mma', minDifficulty: 'normal', comboText: 'Jab Overhand Clinch', category: 'combination', coachingCue: 'Overhand closes the distance.' },
  { id: 'mma-14', discipline: 'mma', minDifficulty: 'normal', comboText: 'Hook Body Kick Exit', category: 'combination', coachingCue: 'Damage then escape.' },
  { id: 'mma-15', discipline: 'mma', minDifficulty: 'normal', comboText: 'Feint Level Change Cross', category: 'combination', coachingCue: 'Fake the shot then strike.' },
  { id: 'mma-16', discipline: 'mma', minDifficulty: 'normal', comboText: 'Jab Cross Clinch Knee', category: 'combination', coachingCue: 'Punch into the plum.' },
  // Hard
  { id: 'mma-17', discipline: 'mma', minDifficulty: 'hard', comboText: 'Jab Cross Fake Shot Overhand', category: 'advanced', coachingCue: 'Level change is the feint.' },
  { id: 'mma-18', discipline: 'mma', minDifficulty: 'hard', comboText: 'Sprawl Cross Hook Level Change Ground Pound', category: 'advanced', coachingCue: 'Wrestle-box flow.' },
  { id: 'mma-19', discipline: 'mma', minDifficulty: 'hard', comboText: 'Jab Cross Clinch Knee Elbow', category: 'advanced', coachingCue: 'Close and destroy.' },
  { id: 'mma-20', discipline: 'mma', minDifficulty: 'hard', comboText: 'Switch Kick Cross Level Change', category: 'advanced', coachingCue: 'Kick to shot.' },
  { id: 'mma-21', discipline: 'mma', minDifficulty: 'hard', comboText: 'Cross Hook Body Kick Clinch Knee', category: 'advanced', coachingCue: 'Multiple ranges.' },
  { id: 'mma-22', discipline: 'mma', minDifficulty: 'hard', comboText: 'Overhand Clinch Knee Knee Push Cross', category: 'advanced', coachingCue: 'Clinch to exit striking.' },
  // Advanced
  { id: 'mma-23', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Jab Cross Fake Shot Flying Knee', category: 'elite', coachingCue: 'The highlight reel.' },
  { id: 'mma-24', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Sprawl Cross Hook Level Change Ground Pound Pass', category: 'elite', coachingCue: 'Full MMA chain.' },
  { id: 'mma-25', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Low Kick Jab Overhand Clinch Knee Knee Elbow', category: 'elite', coachingCue: 'Every weapon flows.' },
  { id: 'mma-26', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Feint Shot Overhand Hook Body Kick Level Change', category: 'elite', coachingCue: 'Keep them guessing the level.' },
  { id: 'mma-27', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Clinch Knee Push Cross Hook Roundhouse Sprawl', category: 'elite', coachingCue: 'Full range combat flow.' },
  { id: 'mma-28', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Jab Cross Elbow Clinch Knee Throw Ground Pound', category: 'elite', coachingCue: 'Complete sequence domination.' },
  { id: 'mma-29', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Switch Kick Cross Hook Fake Shot Overhand', category: 'elite', coachingCue: 'Layer the threats.' },
  { id: 'mma-30', discipline: 'mma', minDifficulty: 'advanced', comboText: 'Sprawl Cross Clinch Knee Push Body Kick Exit', category: 'elite', coachingCue: 'Defend to finish sequence.' },

  // ===== BOXING — easy expansion =====
  { id: 'bc-31', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Cross', category: 'single', coachingCue: 'Turn the hip. Full extension.' },
  { id: 'bc-32', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Hook', category: 'basic', coachingCue: 'Blind them, then bend it around.' },
  { id: 'bc-33', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Hook Cross', category: 'basic', coachingCue: 'Hook opens the door, cross walks through.' },
  { id: 'bc-34', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Cross Jab', category: 'basic', coachingCue: 'Finish behind the jab and reset.' },
  { id: 'bc-35', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Body Jab', category: 'single', coachingCue: 'Bend the knees, not the waist.' },
  { id: 'bc-36', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Body Hook', category: 'basic', coachingCue: 'Upstairs, then dig downstairs.' },
  { id: 'bc-37', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Double Jab Cross', category: 'basic', coachingCue: 'Two to measure, one to hurt.' },
  { id: 'bc-38', discipline: 'boxing', minDifficulty: 'easy', comboText: 'Jab Cross Step Back', category: 'basic', coachingCue: 'Hit and get out clean.' },

  // ===== KICKBOXING — easy expansion =====
  { id: 'kb-31', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Rear Kick', category: 'single', coachingCue: 'Full hip. Swing the bat.' },
  { id: 'kb-32', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Double Teep', category: 'basic', coachingCue: 'Stack them. Keep the range.' },
  { id: 'kb-33', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Cross Rear Kick', category: 'basic', coachingCue: 'Hands open the hips.' },
  { id: 'kb-34', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Lead Kick', category: 'basic', coachingCue: 'Jab covers the lead leg.' },
  { id: 'kb-35', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Low Kick Cross', category: 'basic', coachingCue: 'Kick pulls the guard down, cross comes over.' },
  { id: 'kb-36', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Teep Cross', category: 'basic', coachingCue: 'Push, then punch.' },
  { id: 'kb-37', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Cross Hook', category: 'basic', coachingCue: 'Hands only. Keep the base for kicks.' },
  { id: 'kb-38', discipline: 'kickboxing', minDifficulty: 'easy', comboText: 'Jab Body Kick', category: 'basic', coachingCue: 'Jab high, kick the ribs.' },

  // ===== MUAY THAI — easy expansion =====
  { id: 'mt-31', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Rear Roundhouse', category: 'single', coachingCue: 'Step across. Swing through them.' },
  { id: 'mt-32', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Double Teep', category: 'basic', coachingCue: 'Own the range. Push twice.' },
  { id: 'mt-33', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Cross Roundhouse', category: 'basic', coachingCue: 'Hands set it, kick finishes it.' },
  { id: 'mt-34', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Cross Knee', category: 'basic', coachingCue: 'Punch pulls them in, knee meets them.' },
  { id: 'mt-35', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Teep Roundhouse', category: 'basic', coachingCue: 'Reset them, kick before they settle.' },
  { id: 'mt-36', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Low Kick', category: 'basic', coachingCue: 'Blind high, chop low.' },
  { id: 'mt-37', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Jab Cross Teep', category: 'basic', coachingCue: 'Punch, then push them out.' },
  { id: 'mt-38', discipline: 'muay-thai', minDifficulty: 'easy', comboText: 'Rear Knee', category: 'single', coachingCue: 'Hips forward. Spear it.' },

  // ===== MMA — easy expansion =====
  { id: 'mma-31', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Cross Hook', category: 'basic', coachingCue: 'Basic hands. Chin down.' },
  { id: 'mma-32', discipline: 'mma', minDifficulty: 'easy', comboText: 'Sprawl Cross', category: 'basic', coachingCue: 'Stuff it, then make them pay.' },
  { id: 'mma-33', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Sprawl', category: 'basic', coachingCue: 'Punch, then hips down when they shoot.' },
  { id: 'mma-34', discipline: 'mma', minDifficulty: 'easy', comboText: 'Cross Knee', category: 'basic', coachingCue: 'Straight punch into the knee.' },
  { id: 'mma-35', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Cross Circle Out', category: 'basic', coachingCue: 'Strike and angle off.' },
  { id: 'mma-36', discipline: 'mma', minDifficulty: 'easy', comboText: 'Teep Cross', category: 'basic', coachingCue: 'Push the range, follow with power.' },
  { id: 'mma-37', discipline: 'mma', minDifficulty: 'easy', comboText: 'Jab Level Change', category: 'basic', coachingCue: 'Show high, threaten low.' },
  { id: 'mma-38', discipline: 'mma', minDifficulty: 'easy', comboText: 'Double Jab Low Kick', category: 'basic', coachingCue: 'Stack jabs, chop the leg.' },
];

// Single strikes per discipline — used by Combo Coach's TECHNICAL mode, which
// drills mostly single shots (with some short combos mixed in) for beginners.
const BOXING_SINGLES = ['Jab', 'Cross', 'Lead Hook', 'Rear Hook', 'Lead Uppercut', 'Rear Uppercut', 'Body Jab', 'Body Cross'];
export const SINGLE_STRIKES = {
  boxing: BOXING_SINGLES,
  kickboxing: [...BOXING_SINGLES, 'Teep', 'Lead Kick', 'Low Kick', 'Rear Roundhouse', 'Lead Knee', 'Rear Knee'],
  'muay-thai': [...BOXING_SINGLES, 'Teep', 'Roundhouse', 'Low Kick', 'Lead Knee', 'Rear Knee', 'Lead Elbow', 'Rear Elbow'],
  mma: [...BOXING_SINGLES, 'Teep', 'Low Kick', 'Rear Roundhouse', 'Lead Knee', 'Rear Knee', 'Overhand'],
};

// Flashy / advanced single techniques — introduced in Technical mode at the
// Hard and Advanced difficulties (spinning kicks, bolo punch, flying knees, …).
export const ADVANCED_STRIKES = {
  boxing: ['Bolo Punch', 'Check Hook', 'Shovel Hook', 'Overhand'],
  kickboxing: ['Spinning Back Kick', 'Tornado Kick', 'Question Mark Kick', 'Axe Kick', 'Superman Punch', 'Spinning Backfist', 'Flying Knee', 'Hook Kick'],
  'muay-thai': ['Spinning Back Elbow', 'Spinning Back Kick', 'Question Mark Kick', 'Flying Knee', 'Jumping Elbow', 'Axe Kick', 'Spinning Heel Kick'],
  mma: ['Spinning Back Kick', 'Spinning Backfist', 'Superman Punch', 'Flying Knee', 'Question Mark Kick', 'Wheel Kick', 'Oblique Kick'],
};

export default COMBO_POOL;
