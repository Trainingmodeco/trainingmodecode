export const VOICE_PROMPTS = [
  { id: 'start_set', type: 'start_set', text: 'On my count. Ready. Begin.', useCase: 'Rep-count bodyweight sets', active: true },
  { id: 'complete_set', type: 'complete_set', text: 'Complete. Rest now.', useCase: 'After set completion', active: true },
  { id: 'rest_30', type: 'rest', text: 'Rest 30 seconds. Breathe and reset.', useCase: 'Short rest', active: true },
  { id: 'rest_60', type: 'rest', text: 'Rest 60 seconds. Next set coming up.', useCase: 'Standard rest', active: true },
  { id: 'halfway', type: 'halfway', text: 'Halfway there. Keep working.', useCase: 'Timed exercises', active: true },
  { id: 'final_10', type: 'final_countdown', text: 'Final 10 seconds. Push.', useCase: 'Timed intervals', active: true },
  { id: 'next_exercise', type: 'next_exercise', text: 'Next exercise coming up.', useCase: 'Between exercises', active: true },
  { id: 'finish_workout', type: 'finish', text: 'Workout complete. Good work.', useCase: 'Workout complete', active: true },
];

export function getPrompt(type) {
  return VOICE_PROMPTS.find(p => p.type === type && p.active);
}
