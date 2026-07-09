import { Circle as HelpCircle, X, Target, Sparkles, Gauge, ShieldCheck, Repeat, Flag } from 'lucide-react';
import { C } from '../Styles';

const GOLD = C.yellow;

// Content presets keyed by screen context. Each preset describes what the mode
// is for and how a beginner should approach it, so the copy stays consistent
// wherever the help button appears.
export const HELP_CONTENT = {
  workout_builder: {
    title: 'WORKOUT BUILDER',
    purpose: 'Build a targeted strength session by choosing the muscles you want to train, your equipment, and how hard you want to go.',
    cues: [
      'Pick 1-4 muscle groups. Fewer groups means more focused volume per muscle.',
      'Set equipment to what you actually have so every exercise is doable.',
      'Move with control. A clean rep beats a rushed one.',
    ],
    howHard: 'Easy keeps reps lighter and rest longer. Normal is a balanced challenge. Hard and Advanced add volume and cut rest.',
    safety: 'Warm up first. Stop any movement that causes sharp joint pain, and keep your core braced on loaded lifts.',
    modifications: 'Too tough? Drop a difficulty tier or remove a muscle group. Too easy? Add a group or turn on the cardio finisher.',
    completion: 'You are done when you finish every listed exercise for the prescribed sets. Logging it banks your XP.',
  },
  fit_builder_active: {
    title: 'YOUR WORKOUT',
    purpose: 'This is your generated strength mission. Work through each exercise for the listed sets and reps.',
    cues: [
      'Rest between sets is part of the plan. Use it to recover, not to scroll.',
      'Match the tempo to the coach cadence if it is on.',
      'Full range of motion first, weight second.',
    ],
    howHard: 'Aim to finish each set with 1-2 solid reps left in the tank on Normal. Push closer to failure on Hard.',
    safety: 'Keep water nearby. If your form breaks down, end the set early rather than grinding out sloppy reps.',
    modifications: 'Swap a weighted move for its bodyweight version if needed, or reduce reps and keep the movement pattern.',
    completion: 'Complete every exercise to finish the mission. Partial sessions still log the work you did.',
  },
  quick_mission_setup: {
    title: 'QUICK MISSION',
    purpose: 'A fast, no-planning workout. Pick a type, time, and difficulty and the app builds the session for you.',
    cues: [
      'Bodyweight needs no gear. Weighted and Hybrid mix in loaded moves.',
      'Duration sets the target length. Shorter means denser work.',
      'Turn on the cardio finisher for an extra conditioning burst.',
    ],
    howHard: 'Difficulty scales the intensity and rest. Start at Normal if you are unsure.',
    safety: 'Warm up for a minute or two before starting. Move within a range you can control.',
    modifications: 'Shorten the duration or lower difficulty anytime. You can also switch to Cardio Only for pure conditioning.',
    completion: 'Finish the timed mission to complete it and log your effort.',
  },
  quick_mission_active: {
    title: 'QUICK MISSION',
    purpose: 'Follow the guided flow. The timer and coach move you from one movement to the next.',
    cues: [
      'Keep moving through work intervals and breathe on the rest.',
      'Quality reps count more than fast reps.',
      'Pace yourself so you can finish strong.',
    ],
    howHard: 'You should feel worked but in control. Back off the pace if your form slips.',
    safety: 'Stop and reset if you feel dizzy or sharp pain. Hydrate on the rest breaks.',
    modifications: 'March in place instead of jumping, or slow the tempo to stay safe.',
    completion: 'The mission ends when the timer runs out. Your session logs automatically.',
  },
  combat_conditioning_setup: {
    title: 'COMBAT CONDITIONING',
    purpose: 'Ring-ready circuits that build your fight gas tank with explosive, athletic conditioning.',
    cues: [
      'Pick a style that matches how you want to move.',
      'Equipment tells the app whether to include bag or gear work.',
      'Stay light on your feet and keep your guard up during rounds.',
    ],
    howHard: 'These circuits run hot. Easy still moves fast, Hard and Advanced push your engine hard.',
    safety: 'Warm up your shoulders and hips. Land softly on jumps and keep your wrists straight on strikes.',
    modifications: 'Cut the duration, drop a difficulty, or switch to Cardio Only for a steadier session.',
    completion: 'Complete every round in the circuit to finish. Effort logs even if you cut it short.',
  },
  combat_conditioning_active: {
    title: 'COMBAT CIRCUIT',
    purpose: 'Work each round at fight pace. Recover on the rest and reset for the next drill.',
    cues: [
      'Snap your movements. Explosive intent builds power.',
      'Reset your stance and guard between reps.',
      'Breathe out on every strike or effort.',
    ],
    howHard: 'Push the work intervals, then actively recover. You should be breathing hard by the end.',
    safety: 'Keep joints soft on landings. Ease off immediately on any sharp pain.',
    modifications: 'Shadow the movement without power, or slow the pace while keeping the pattern.',
    completion: 'Finish all rounds to complete the circuit. Your session logs your effort.',
  },
  cardio_mode: {
    title: 'CARDIO MODE',
    purpose: 'A standalone cardio session. Pick a method and protocol, run the timer, and log your effort.',
    cues: [
      'Steady holds one effort for the whole duration.',
      'Intervals and Tabata alternate hard work with recovery.',
      'Find a sustainable pace before you push the hard intervals.',
    ],
    howHard: 'Steady should feel conversational to moderate. Intervals should feel hard on the work, easy on the rest.',
    safety: 'Warm up gradually and cool down at the end. Slow down if you cannot breathe steadily.',
    modifications: 'Shorten the duration or choose a gentler protocol like Beginner intervals.',
    completion: 'Finish the timed protocol to complete the session and bank your XP.',
  },
};

function Section({ icon: Icon, label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon size={13} color={GOLD}/>
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD,
          fontSize: 9, letterSpacing: '0.16em',
        }}>{label}</span>
      </div>
      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
        color: C.text, lineHeight: 1.5,
      }}>{children}</div>
    </div>
  );
}

export function HelpButton({ onClick, size = 20 }) {
  return (
    <button
      onClick={onClick}
      aria-label="Workout help"
      style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(8,0,18,0.86)', border: '1px solid rgba(253,224,71,0.25)',
        color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
      }}
    >
      <HelpCircle size={size}/>
    </button>
  );
}

export default function WorkoutHelpPanel({ contentKey, content, open, onClose }) {
  const data = content || HELP_CONTENT[contentKey];
  if (!open || !data) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(4,0,10,0.78)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'tm-help-fade 0.2s ease forwards',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tm-help-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tm-help-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      ` }}/>
      <div
        onClick={e => e.stopPropagation()}
        className="no-scrollbar"
        style={{
          width: '100%', maxWidth: 420, maxHeight: '82vh', overflowY: 'auto',
          background: 'rgba(12,2,24,0.98)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: '1.5px solid rgba(253,224,71,0.3)', borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(253,224,71,0.1)',
          padding: '18px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
          animation: 'tm-help-up 0.28s ease forwards',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle size={18} color={GOLD}/>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD,
              fontSize: 14, letterSpacing: '0.1em',
            }}>{data.title}</span>
          </div>
          <button onClick={onClose} aria-label="Close help" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', padding: 4,
          }}>
            <X size={18}/>
          </button>
        </div>

        <Section icon={Target} label="WHAT IT IS">{data.purpose}</Section>

        <Section icon={Sparkles} label="BEGINNER CUES">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.cues.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
          </ul>
        </Section>

        <Section icon={Gauge} label="HOW HARD">{data.howHard}</Section>
        <Section icon={ShieldCheck} label="STAY SAFE">{data.safety}</Section>
        <Section icon={Repeat} label="MAKE IT EASIER">{data.modifications}</Section>
        <Section icon={Flag} label="WHEN YOU'RE DONE">{data.completion}</Section>
      </div>
    </div>
  );
}
