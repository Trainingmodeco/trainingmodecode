/**
 * Workout text parser - converts raw text into structured workout blocks.
 *
 * TEST EXAMPLES (paste these to verify parser behavior):
 * --------------------------------------------------
 * Push Ups 3x15
 * Squats 4 sets of 12
 * Plank 3 x 45 sec
 * Jump Rope 5 rounds x 1 min
 * Rest 60 sec
 * Burpees 3 rounds of 20 reps
 * Bench Press: 5x5
 * 30 seconds work / 15 seconds rest
 * Battle Ropes - 4 rounds x 30 sec
 * Push Ups - 3 sets of 20 reps - rest 45 sec
 * Deadlifts 5x5
 * Mountain Climbers 3x30 sec
 * Box Jumps: 4 sets of 8
 * Kettlebell Swings - 5 rounds x 20 reps
 * Bicep Curls 3x12 - rest 90 sec
 * --------------------------------------------------
 *
 * Future: OCR upgrade, AI cleanup, Supabase save, PDF history
 */

let idCounter = 0;
function uid() {
  return 'block_' + Date.now().toString(36) + '_' + (++idCounter);
}

// --- Helper: parse a time unit string into seconds ---
function parseToSeconds(value, unit) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return null;
  if (!unit) return n;
  const u = unit.toLowerCase().replace(/\.$/, '');
  if (u.startsWith('m')) return n * 60;
  return n;
}

// --- Helper: clean exercise name by removing trailing noise ---
function cleanExerciseName(name) {
  if (!name) return '';
  return name
    .replace(/^[\s\-–—:.,]+/, '')
    .replace(/[\s\-–—:.,]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// --- Helper: extract inline rest from a line (e.g. "- rest 45 sec") ---
function parseRestFromLine(line) {
  const restInline = line.match(/[-–—]\s*rest\s+(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)?\b/i);
  if (restInline) {
    const seconds = parseToSeconds(restInline[1], restInline[2] || 'sec');
    const cleaned = line.replace(restInline[0], '').trim();
    return { restSeconds: seconds, cleanedLine: cleaned };
  }
  return { restSeconds: null, cleanedLine: line };
}

// --- Helper: detect if a line is a standalone rest instruction ---
function isRestLine(line) {
  return /^rest\s*[:.]?\s*(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)?\s*$/i.test(line);
}

function parseRestLineSeconds(line) {
  const m = line.match(/^rest\s*[:.]?\s*(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)?/i);
  if (!m) return 60;
  return parseToSeconds(m[1], m[2] || 'sec') || 60;
}

// --- Main patterns ---
const WORK_REST_PATTERN = /(\d+)\s*(?:sec(?:ond)?s?|s)\s*work\s*[\/,]\s*(\d+)\s*(?:sec(?:ond)?s?|s)\s*rest/i;
const SETS_X_DURATION = /(\d+)\s*[xX×]\s*(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)\b/;
const ROUNDS_X_DURATION = /(\d+)\s*(?:rounds?\s*[xX×]?\s*)(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)\b/i;
const SETS_OF_REPS = /(\d+)\s*(?:sets?\s+of|rounds?\s+of)\s+(\d+)\s*(?:reps?)?\b/i;
const SETS_X_REPS_WORD = /(\d+)\s*(?:sets?|rounds?)\s*[xX×]\s*(\d+)\s*(?:reps?)?\b/i;
const SETS_X_REPS = /(\d+)\s*[xX×]\s*(\d+)\b/;
const DURATION_ONLY = /(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?|s|m)\b/i;
const DURATION_WORD = /(\d+)\s*(minutes?|seconds?)\b/i;

function parseWorkoutText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip decorative/separator lines
    if (/^[-=_*#]{2,}$/.test(line)) continue;
    // Skip section headers with no content
    if (/^(warm\s*up|cool\s*down|stretch|notes?|superset|circuit)\s*:?\s*$/i.test(line)) continue;

    // --- Standalone rest line: apply to previous block ---
    if (isRestLine(line)) {
      const restSec = parseRestLineSeconds(line);
      if (blocks.length > 0) {
        blocks[blocks.length - 1].restSeconds = restSec;
      }
      continue;
    }

    // --- Extract inline rest (e.g. "- rest 45 sec" at end of line) ---
    const { restSeconds: inlineRest, cleanedLine } = parseRestFromLine(line);
    line = cleanedLine;

    const block = {
      id: uid(),
      exercise: '',
      sets: 1,
      reps: '',
      durationSeconds: null,
      restSeconds: inlineRest || 60,
      equipment: '',
      notes: '',
      needsReview: false,
    };

    // --- Pattern: "30 seconds work / 15 seconds rest" ---
    const workRestMatch = line.match(WORK_REST_PATTERN);
    if (workRestMatch) {
      const namePart = cleanExerciseName(line.replace(WORK_REST_PATTERN, ''));
      block.exercise = namePart || 'Interval';
      block.durationSeconds = parseInt(workRestMatch[1], 10);
      block.restSeconds = parseInt(workRestMatch[2], 10);
      blocks.push(block);
      continue;
    }

    // --- Split on major separators (colon, dash) to get name vs details ---
    let namePart = '';
    let detailPart = line;

    const separatorMatch = line.match(/^([A-Za-z][A-Za-z\s]*?)\s*[-–—:]\s+(.+)$/);
    if (separatorMatch) {
      namePart = separatorMatch[1].trim();
      detailPart = separatorMatch[2].trim();
    }

    // --- Pattern: NxDuration (e.g. "3x45 sec" or "4 rounds x 30 sec") ---
    const sxd = detailPart.match(SETS_X_DURATION);
    if (sxd) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(SETS_X_DURATION, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.sets = parseInt(sxd[1], 10);
      block.durationSeconds = parseToSeconds(sxd[2], sxd[3]);
      blocks.push(block);
      continue;
    }

    // --- Pattern: "5 rounds x 1 min" ---
    const rxd = detailPart.match(ROUNDS_X_DURATION);
    if (rxd) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(ROUNDS_X_DURATION, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.sets = parseInt(rxd[1], 10);
      block.durationSeconds = parseToSeconds(rxd[2], rxd[3]);
      blocks.push(block);
      continue;
    }

    // --- Pattern: "4 sets of 12 reps" ---
    const sofr = detailPart.match(SETS_OF_REPS);
    if (sofr) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(SETS_OF_REPS, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.sets = parseInt(sofr[1], 10);
      block.reps = sofr[2];
      blocks.push(block);
      continue;
    }

    // --- Pattern: "3 sets x 20 reps" ---
    const sxrw = detailPart.match(SETS_X_REPS_WORD);
    if (sxrw) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(SETS_X_REPS_WORD, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.sets = parseInt(sxrw[1], 10);
      block.reps = sxrw[2];
      blocks.push(block);
      continue;
    }

    // --- Pattern: "3x15" (sets x reps, no duration unit) ---
    const sxr = detailPart.match(SETS_X_REPS);
    if (sxr) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(SETS_X_REPS, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.sets = parseInt(sxr[1], 10);
      block.reps = sxr[2];
      blocks.push(block);
      continue;
    }

    // --- Pattern: standalone duration (e.g. "Plank 45 sec" or "Jump rope 5 minutes") ---
    const durWord = detailPart.match(DURATION_WORD);
    if (durWord) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(DURATION_WORD, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.durationSeconds = parseToSeconds(durWord[1], durWord[2]);
      blocks.push(block);
      continue;
    }

    const durOnly = detailPart.match(DURATION_ONLY);
    if (durOnly) {
      if (!namePart) {
        namePart = cleanExerciseName(detailPart.replace(DURATION_ONLY, ''));
      }
      block.exercise = cleanExerciseName(namePart) || 'Exercise';
      block.durationSeconds = parseToSeconds(durOnly[1], durOnly[2]);
      blocks.push(block);
      continue;
    }

    // --- Fallback: treat the whole line as exercise name, needs review ---
    block.exercise = cleanExerciseName(namePart || detailPart) || line;
    block.needsReview = true;
    block.notes = 'Could not parse details - please edit';
    blocks.push(block);
  }

  return blocks;
}

function createWorkoutMission(blocks, title, source) {
  return {
    title: title || 'Decoded Mission',
    source: source || 'Text Upload',
    createdAt: new Date().toISOString(),
    blocks,
  };
}

export { parseWorkoutText, createWorkoutMission, uid };