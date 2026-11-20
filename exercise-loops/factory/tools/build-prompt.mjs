#!/usr/bin/env node
// build-prompt.mjs: the motion prompt of RUNBOOK B6, built from its blocks, so every prompt has the same background and emblem text.
//
// Usage:
//   node build-prompt.mjs --view front|side|back --opening "<what the character does, one repetition>" [--equip <list>] [--extra "<sentence>"] [--others]
//
//   --view     the camera view of the exercise: back -> BACK reference picture, "seen from behind" and the upper-back emblem text; side -> "seen from the side"
//              (FRONT picture); front or anything else -> "seen from the front" (FRONT picture).
//   --opening  from the start position to the end of one repetition and back, then the plain name in brackets, for example
//              "standing tall with one kettlebell held at the chest in the rack position, bending the knees and sinking the hips down into a deep squat, then driving back up to standing (kettlebell front squat)"
//              For a hold: "holds the plank perfectly still (plank)" with --hold.
//   --equip    comma list of: barbell, dumbbells, kettlebell, bench-back, bench-hips, pullup-bar, dipbars (anything else: use --extra)
//   --extra    one more sentence about equipment, written like the others: "Draw the <thing> as a <shape> dark violet ... with glowing neon magenta edges."
//   --others   someone else was in the raw picture
// Prints ONE line of JSON: { refImage: "FRONT"|"BACK", refId, prompt }.
import { args, fail } from './_lib.mjs';
const a = args(process.argv.slice(2), ['others', 'hold']);
const view = String(a.view || 'front').toLowerCase(); const back = view === 'back';
if (!a.opening || a.opening === true) fail('usage: node build-prompt.mjs --view front|side|back --opening "<text>" [--equip barbell,dumbbells,kettlebell,bench-back,bench-hips,pullup-bar,dipbars] [--extra "<sentence>"] [--others] [--hold]');
const FRONT = 'eb56d9ea-c749-4fcd-9eb9-236531afc656', BACK = 'aa0b5c45-9d02-432c-8438-59175a4b1c9a';
const from = back ? 'behind' : view === 'side' ? 'the side' : 'the front';
const EQUIP = {
  barbell: 'Keep the barbell: one straight bar with a round weight plate on each end, drawn as a glossy dark violet bar and plates with glowing neon magenta edges.',
  dumbbells: 'Draw each dumbbell as a short glossy dark violet bar with a round weight on each end and glowing neon magenta edges.',
  kettlebell: 'Draw the kettlebell as a round glossy dark violet bell with a curved handle and glowing neon magenta edges.',
  'bench-back': 'Draw the bench as one simple dark violet block with glowing neon magenta edges under the back.',
  'bench-hips': 'Draw the bench as one simple dark violet block with glowing neon magenta edges under the hips.',
  'pullup-bar': 'Draw the bar as a thin glowing gold bar that stays still at the top.',
  dipbars: 'Draw the two bars as thin glowing gold bars that stay still at hip height.',
};
const parts = [];
let opening = String(a.opening).trim().replace(/\.$/, '');
parts.push(a.hold ? `The character from the reference image, seen from ${from}, ${opening}.` : `The character from the reference image, seen from ${from}, ${opening}.`);
for (const e of String(a.equip || '').split(',').map((s) => s.trim()).filter(Boolean)) { if (!EQUIP[e]) fail(`unknown equipment "${e}": use ${Object.keys(EQUIP).join(', ')} or --extra`); parts.push(EQUIP[e]); }
if (a.extra && a.extra !== true) parts.push(String(a.extra).trim());
parts.push('Plain flat very dark purple studio background, colour #0a0014, empty space with no scenery: no gym, no machines, no rack, no mirrors, no posts, no sky, no grass, no people, no mat, no other objects, only a faint violet glow on the floor under the body.');
parts.push(back
  ? 'The large gold emblem on the upper back and the small gold emblems on the upper arms keep exactly the same shape, size and place on the body throughout, and no emblem appears anywhere else.'
  : 'The gold emblem on the chest and the small gold emblems on the upper arms keep exactly the same shape, size and place on the body throughout, and no emblem appears anywhere else.');
if (a.others) parts.push('Only this one character, nobody else in the picture.');
process.stdout.write(`${JSON.stringify({ refImage: back ? 'BACK' : 'FRONT', refId: back ? BACK : FRONT, prompt: parts.join(' ') })}\n`);
