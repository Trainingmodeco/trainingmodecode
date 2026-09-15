import { useState, useRef, useCallback } from 'react';
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

export default function CampFullSession({
  discipline, cfgSkill, cfgFit, onComplete,
  initialPaused, onStateChange, initialResumeData,
}) {
  const [stage, setStage] = useState(initialResumeData?.stage ?? 'intro1');   // intro1 | skill | intro2 | fit
  const [skill, setSkill] = useState(initialResumeData?.skill ?? null);

  // A full camp is two sessions in one sitting, so the snapshot has to say
  // WHICH block was running as well as where that block was. The child's own
  // report is wrapped rather than forwarded: on its own it would restore the
  // right round of the wrong block, and a finished skill block would be thrown
  // away on the way back in.
  const report = useCallback((block) => {
    if (typeof onStateChange === 'function') onStateChange({ stage, skill, block });
  }, [onStateChange, stage, skill]);

  // Only the block that was actually interrupted restores. Once the athlete
  // moves on to the next one it starts clean and unpaused, rather than
  // inheriting a hold from a block that finished ten minutes ago.
  const resumedStage = useRef(initialResumeData?.stage ?? null);
  const resumeFor = (s) => (s === resumedStage.current
    ? { initialPaused: !!initialPaused, initialResumeData: initialResumeData?.block || null }
    : { initialPaused: false, initialResumeData: null });

  if (stage === 'intro1') {
    return <CampTransitionCard label="S1 · SKILL" sub="FULL CAMP · BLOCK 1 OF 2" detail="Combat work — fresh legs" onDone={() => setStage('skill')} />;
  }
  if (stage === 'skill') {
    return <FightFocusTimer discipline={discipline} cfg={cfgSkill} {...resumeFor('skill')} onStateChange={report}
      onEnd={(r, c, comp, ir) => { setSkill(judge(r, c, comp, ir)); setStage('intro2'); }} />;
  }
  if (stage === 'intro2') {
    return <CampTransitionCard label="S2 · CONDITIONING" sub="FULL CAMP · BLOCK 2 OF 2" detail="Short recover, then push" onDone={() => setStage('fit')} />;
  }
  return <CampFitRunner cfg={cfgFit} {...resumeFor('fit')} onStateChange={report}
    onEnd={(r, c, comp, ir) => onComplete({ skill, fit: judge(r, c, comp, ir) })} />;
}
