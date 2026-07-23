import { useState } from 'react';
import FightFocusTimer from './FightFocusTimer';
import CampFitRunner from './CampFitRunner';
import CampTransitionCard from './shared/CampTransitionCard';

// Phase 2 · 2.4 — FULL CAMP: the split level's two missions run back-to-back as
// ONE continuous session — skill block (fresh) → an 8–15 min transition →
// conditioning block. Reports a combined result so both S1 + S2 mark done at
// ✓✓ and the level clears in a single sitting. Reuses the same two runners, so
// the 1.6 anti-cheat gate applies to each block.
function judge(rounds, cfg, completed, ir) {
  const total = cfg.rounds || (Array.isArray(rounds) ? rounds.length : 1);
  const done = typeof completed === 'number' ? completed : (Array.isArray(rounds) ? rounds.length : 0);
  const awarded = !ir || ir.awardXp !== false;
  const fully = !ir || ir.isFullyValid;
  return { total, done, valid: done >= total && awarded && fully };
}

export default function CampFullSession({ discipline, cfgSkill, cfgFit, onComplete }) {
  const [stage, setStage] = useState('intro1');   // intro1 | skill | intro2 | fit
  const [skill, setSkill] = useState(null);

  if (stage === 'intro1') {
    return <CampTransitionCard label="S1 · SKILL" sub="FULL CAMP · BLOCK 1 OF 2" detail="Combat work — fresh legs" onDone={() => setStage('skill')} />;
  }
  if (stage === 'skill') {
    return <FightFocusTimer discipline={discipline} cfg={cfgSkill} initialPaused={false}
      onEnd={(r, c, comp, ir) => { setSkill(judge(r, c, comp, ir)); setStage('intro2'); }} />;
  }
  if (stage === 'intro2') {
    return <CampTransitionCard label="S2 · CONDITIONING" sub="FULL CAMP · BLOCK 2 OF 2" detail="Short recover, then push" onDone={() => setStage('fit')} />;
  }
  return <CampFitRunner cfg={cfgFit}
    onEnd={(r, c, comp, ir) => onComplete({ skill, fit: judge(r, c, comp, ir) })} />;
}
