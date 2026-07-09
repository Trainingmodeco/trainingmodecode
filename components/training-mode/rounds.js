export function generateRounds(discipline, difficulty, mode, count) {
  const titles = {
    Boxing:       ['Jab-Cross Combos', 'Defense & Counter', 'Body Work', 'Head Movement', 'Power Shots'],
    Kickboxing:   ['Switch Kicks', 'High-Low Combos', 'Teep Pressure', 'Spinning Attacks', 'Clinch Exits'],
    'Muay Thai':  ['Elbow Clinch', 'Knee Strikes', 'Teep & Push', 'Eight-Limb Flow', 'Destruction'],
    MMA:          ['Takedown Defense', 'Ground & Pound', 'Clinch Grapple', 'Cage Control', 'Submission Defense'],
  };
  const prompts = [
    'Stay light on your feet, breathe through every combo.',
    'Keep your guard tight. Counter every jab.',
    'Drive through your hips. Power from the core.',
    'Eyes on the chest, not the hands.',
    "Flow, don't force. Trust your training.",
  ];
  const t = titles[discipline] || titles.Boxing;
  return Array.from({ length: count }, (_, i) => ({
    round_title:  t[i % t.length],
    coach_prompt: prompts[i % prompts.length],
    session_type: mode,
  }));
}
