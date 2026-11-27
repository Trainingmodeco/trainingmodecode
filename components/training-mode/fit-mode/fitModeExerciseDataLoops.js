// Library exercises that have an approved demo loop (exercise-loops/factory-loops), written from the loops the owner filmed and named.
//
// Same shape as fitModeExerciseDataCore (it builds them with its own ex() helper) and spread into FIT_MODE_EXERCISES after the staples.
// Written once by exercise-loops/factory/tools/library-entries.mjs from the drafts that were each checked by a second reader; edit them here like any other record.
// The coachNote (shown on the card and the info sheet) and combatCarryover were written from the standard form of each lift and what the loop shows, not by the owner.
// The coach says only the NAME of each (clips in public/voice/female and /male: see CLAUDE.md, npm run voice:coverage and test:spoken).
// The demo videos stay staged in exercise-loops/factory-loops until a majority of the app's exercises have one: no videoUrl here.
// Cable and Machine moves are never dealt by the Workout Builder (GYM_ONLY in fitModeGenerator); they show in the library and the info sheet.

import { ex } from './fitModeExerciseDataCore';

export const FIT_MODE_LOOP_EXERCISES = [
  // ── Chest ─────────────────────────────────────────────────────────
  // loop: alternating-arm-level-push-ups
  ex('Alternating Arm Level Push-Ups', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Set one hand a step ahead of the other, lower the chest between them, press up and swap the hands each rep.', 'Staggered pressing builds the shoulder balance a boxer needs when one hand leads.', { reps: '12-16' }),
  // loop: alternating-level-change-push-ups
  ex('Alternating Level-Change Push-Ups', 'Chest', ['Core', 'Shoulders', 'Triceps'], 'Bodyweight', 'Normal', 'Compound',
    'Lower into a push-up, press up, then drive one knee toward the chest and switch sides each rep.', 'Pressing through changing levels, the way a fighter ducks and rises.', { reps: '12-16' }),
  // loop: arm-march-push-ups
  ex('Arm March Push-Ups', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Lower into a push-up, press up, then march the hands one at a time up onto a platform and back down.', 'Shoulder stability while the hands keep moving, like a guard that never stops working.', { reps: '8-12' }),
  // loop: barbell-floor-press
  ex('Barbell Floor Press', 'Chest', ['Triceps', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Lie on the floor with the bar over the chest, lower until the elbows touch down, then press to lockout.', 'Pressing strength behind the cross, with the floor protecting the shoulders.', { reps: '6-10', rest: 90 }),
  // loop: cat-stretch-push-ups
  ex('Cat Stretch Push-Ups', 'Chest', ['Shoulders', 'Triceps', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Lower into a push-up, press up, then push the hips high and drop the head between the arms.', 'Chest and shoulder strength plus a loose upper back for a fast, free guard.', { reps: '8-12' }),
  // loop: chest-bench-dips
  ex('Chest Bench Dips', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hands on the bench edge with the chest leading, lower until the elbows reach ninety degrees, then press up.', 'Chest and shoulder pressing strength for pushing an opponent off.', { reps: '8-12' }),
  // loop: cross-push-ups
  ex('Cross Push-Ups', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Set one hand out front and across toward the other side, lower the chest between the hands, press up and switch hands each rep.', 'Pressing through a crossed, uneven base, the shoulder balance of throwing a cross.', { reps: '10-14' }),
  // loop: high-push-ups
  ex('High Push-Ups', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Place the hands ahead of the chest line, keep the body straight, lower the chest and press all the way up.', 'The base of every punch: chest, shoulders and triceps working as one.'),
  // loop: iron-cross-push-ups
  ex('Iron Cross Push-Ups', 'Chest', ['Shoulders', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Set the hands far out to the sides like a cross, lower the chest between them with control and press up.', 'Wide-chest strength for hooks and clinch pressing.', { reps: '6-8', rest: 90 }),
  // loop: knuckle-push-ups
  ex('Knuckle Push-Ups', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Make tight fists, keep the wrists straight over the knuckles, lower the chest and press up.', 'Fist and wrist strength so punches land on straight, solid knuckles.'),
  // loop: landmine-floor-press
  ex('Landmine Floor Press', 'Chest', ['Triceps', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Lie on the floor, press the bar end up in one hand to lockout, lower slowly, then switch to work each side.', 'Single-arm pressing power and shoulder stability for straight punches.', { reps: '8-10', rest: 75 }),
  // loop: low-push-ups
  ex('Low Push-Ups', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Body in one line, lower until the chest hovers just above the floor, pause, then press up.', 'Chest and shoulder strength at the bottom of the press, where punches start from the guard.', { reps: '8-12' }),
  // loop: one-arm-dumbbell-bench-press
  ex('One-Arm Dumbbell Bench Press', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Lie on the bench, one dumbbell over the chest, free arm out for balance, press to lockout and work each side.', 'Single-arm pressing strength and a braced core that stops the body twisting.', { reps: '8-12', rest: 75 }),
  // loop: parallel-chest-bar-dips
  ex('Parallel Bar Chest Dips', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Grip the parallel bars, lean the chest forward, lower until the shoulders reach elbow height, then press back up.', 'Heavy chest and triceps pressing for pushing opponents away and framing.', { reps: '6-10', rest: 75 }),
  // loop: push-ups-off-parrell-bar
  ex('Parallel Bar Push-Ups', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hands on the parallel bars, elbows tucked, lower the chest toward the bars and press up with the body in one line.', 'A deeper chest press for more punching power through the full range.'),
  // loop: sky-touch-push-ups
  ex('Sky Touch Push-Ups', 'Chest', ['Shoulders', 'Core', 'Triceps'], 'Bodyweight', 'Normal', 'Compound',
    'Lower into a push-up, press up, turn the chest to the side and reach one arm to the sky, alternating sides.', 'Rotating shoulder and core strength, like twisting through a hook.', { reps: '12-16' }),
  // loop: speed-hindu-push-ups
  ex('Speed Hindu Push-Ups', 'Chest', ['Shoulders', 'Triceps', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Start with the hips high, dive the chest low and sweep forward and up, then push the hips back fast and smooth.', 'Fast chest and shoulder strength with the hip and spine flow of getting up off the mat.', { reps: '10-15', tempo: 'fast and smooth' }),
  // loop: table-touch-push-ups
  ex('Table Touch Push-Ups', 'Chest', ['Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Lower into a push-up, press up, then reach one hand forward to touch the table and return, alternating hands.', 'A one-arm reach with a steady trunk, like keeping balance through a long punch.', { reps: '12-16' }),
  // loop: three-position-push-ups
  ex('Three-Position Push-Ups', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Do one push-up with the hands narrow, one at shoulder width and one wide, then repeat, body in one line.', 'Control at every point of the press, like holding a guard through the whole round.', { reps: '9-12', rest: 60 }),
  // loops: tiger-push-ups, tiger-pushups
  ex('Tiger Push-Ups', 'Chest', ['Triceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Lower the chest low with the elbows tucked and sweep the head forward past the hands, then press up to straight arms.', 'Pressing power from low to high, like driving up off the mat.', { reps: '8-12' }),
  // loop: uneven-one-arm-push-up
  ex('Uneven One-Arm Push-Ups', 'Chest', ['Triceps', 'Core', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'One hand under the chest, the other resting out on a raised block, lower and press with the floor arm, each side.', 'One-arm pushing strength and a stiff trunk for the power behind a single punch.', { reps: '6-8', rest: 90 }),
  // loop: uneven-push-ups
  ex('Uneven Push-Ups', 'Chest', ['Triceps', 'Shoulders', 'Core'], 'Weighted', 'Normal', 'Compound',
    'One hand on the floor, the other on a kettlebell, lower the chest between them, press up, then switch hands.', 'Unequal pressing that builds one-side-at-a-time strength for the lead and rear hand.', { reps: '8-12' }),

  // ── Back ──────────────────────────────────────────────────────────
  // loop: alternate-arm-dead-hang
  ex('Alternating-Arm Dead Hangs', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Isolation',
    'Hang from the bar with the shoulders pulled down, take one hand off, put it back, then swap arms.', 'Grip and shoulder strength for hand fighting.', { hold: 30, rest: 60 }),
  // loop: archer-over-pull-ups
  ex('Archer Over Pull-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Wide grip, pull up and over toward one hand with the other arm straight, lower slowly, and work each side.', 'One-side pulling strength for hand fighting and dragging an opponent off balance.', { reps: '4-6', rest: 90 }),
  // loop: around-the-world-chin-ups
  ex('Around the World Chin-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Palms facing you, pull up and travel the chin around the bar in a smooth circle, then lower under control.', 'Pulling strength through a full circle of motion for grappling and clinch control.', { reps: '4-6', rest: 90 }),
  // loop: close-grip-cable-row
  ex('Close-Grip Cable Rows', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Sit tall, hands close on the handle, pull to the stomach with the elbows tight, squeeze the shoulder blades, and return slowly.', 'Arm-heavy back strength for pulling an opponent in tight in the clinch.', { reps: '8-12' }),
  // loop: close-grip-inverted-rows
  ex('Close-Grip Inverted Rows', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hang under the bar with the hands close together, body straight, pull the chest to the bar and lower slowly.', 'Arm-heavy pulling strength for hand fighting and steady shoulders under punching volume.', { reps: '10-15' }),
  // loop: close-grip-lat-pulldowns
  ex('Close-Grip Lat Pulldowns', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Narrow grip, sit tall with the thighs under the pad, pull the handle to the upper chest, squeeze the lats and let it rise slowly.', 'Pulling strength through the lower lats for dragging an opponent in and holding them close.', { reps: '8-12' }),
  // loop: commando-pull-ups
  ex('Commando Pull-Ups', 'Back', ['Biceps', 'Shoulders', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Hands one in front of the other on the bar, pull the head up past one side, lower, and work each side.', 'Offset-grip pulling strength for grappling exchanges where the hands are never even.', { reps: '4-6', rest: 90 }),
  // loop: dumbbell-hanging-row
  ex('Dumbbell Hanging Rows', 'Back', ['Biceps', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Hinge deep with a flat back, let the weight hang straight down, row it to the ribs and lower slowly.', 'Back and hamstring strength for a strong hinge when pulling or defending a takedown.', { reps: '8-12' }),
  // loop: half-archer-pull-ups
  ex('Half Archer Pull-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Wide grip, pull up toward one hand while the other arm stays partly straight, lower slowly, and work each side.', 'A step toward single-arm pulling strength for hand fighting and the clinch.', { reps: '4-6', rest: 90 }),
  // loop: hanging-leg-pull-up
  ex('Hanging Leg Pull-Ups', 'Back', ['Biceps', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Hang with the legs held straight out in front, pull the chin over the bar and lower slowly.', 'Pulling strength plus a tight midsection for the clinch and for throwing knees.', { reps: '4-6', rest: 90 }),
  // loop: high-pull-ups
  ex('High Pull-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Pull as high as you can, chest toward the bar, then lower with control.', 'Pulling power through the full range for climbing into and out of the clinch.', { reps: '4-6', rest: 90 }),
  // loop: ketabelle-alternating-bent-over-rows
  ex('Kettlebell Alternating Bent-Over Rows', 'Back', ['Biceps', 'Shoulders', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Hinge with a flat back and the bell on the floor, row it to the hip, lower it and switch arms.', 'Pulling strength for the clinch and a braced back when someone pulls on you.', { reps: '8-12', rest: 60 }),
  // loops: landmind-single-arm-row, landmine-rows, landmine-single-side-row
  ex('Landmine Single-Arm Rows', 'Back', ['Biceps', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Hinge with a flat back, one hand on the bar, pull the plate end to the hip, lower slowly, each side.', 'Single-side pulling and hip strength for grappling and clinch exchanges.', { reps: '8-12' }),
  // loop: lat-pulldowns
  ex('Lat Pulldowns', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Sit tall with the thighs under the pad, pull the bar to the upper chest, squeeze the shoulder blades and let it rise slowly.', 'Lat strength for pulling an opponent in and keeping them there.', { reps: '8-12' }),
  // loop: muscule-ups
  ex('Muscle-Ups', 'Back', ['Triceps', 'Chest', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Pull explosively to the chest, lean over the bar and press out to straight arms on top, then lower with control.', 'Explosive pull and press power for winning the scramble out of the clinch.', { reps: '3-5', rest: 120, style: 'Power' }),
  // loop: neck-bridge
  ex('Neck Bridge', 'Back', ['Shoulders', 'Glutes'], 'Bodyweight', 'Hard', 'Isolation',
    'Rest on the head and feet, lift the hips, and rock slowly with small controlled movements, stopping if the neck hurts.', 'Neck strength to absorb a punch and to survive being driven down or turned.', { reps: '6-8', rest: 60 }),
  // loop: prone-neck-extension
  ex('Prone Neck Extension', 'Back', ['Shoulders'], 'Bodyweight', 'Easy', 'Isolation',
    'Lie face down with the head past the end of the bench, lift the head level with the body, then lower slowly.', 'Back-of-the-neck strength to keep the head up when you take a punch.', { reps: '10-15', rest: 45 }),
  // loop: pull-up-hold
  ex('Pull-Up Hold', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Isolation',
    'Chin over the bar, palms facing away, hold the top and keep breathing.', 'Isometric pulling strength for the clinch.', { hold: 20, rest: 60 }),
  // loop: pull-up-negatives
  ex('Pull-Up Negatives', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Start with the chin over the bar, lower yourself as slowly as you can, then reset and go again.', 'Builds the pulling strength for the clinch when the opponent pulls back.', { reps: '3-5', rest: 90 }),
  // loop: pull-up-swift-weight-between-legs
  ex('Pull-Ups with Weight Between Legs', 'Back', ['Biceps', 'Core'], 'Weighted', 'Hard', 'Compound',
    'Hold the weight between the legs, hang long, pull the chin over the bar and lower under control.', 'Loaded pulling strength and a tight core for the clinch and for kicking power.', { reps: '4-6', rest: 90 }),
  // loop: seated-cable-rows
  ex('Seated Cable Rows', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Sit tall, pull the handle to the stomach, squeeze the shoulder blades together and let the arms reach out slowly.', 'Pulling strength for the clinch and a tall posture under pressure.', { reps: '8-12' }),
  // loop: seated-wide-cable-row
  ex('Seated Wide Cable Rows', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Sit tall, wide grip, pull the handle to the chest with the elbows out, squeeze the shoulder blades, and return slowly.', 'Upper-back strength for posture and for pulling an opponent\'s head and arms down.', { reps: '8-12' }),
  // loops: side-lying-neck-raises, side-lying-neck-raises-2
  ex('Side-Lying Neck Raises', 'Back', ['Shoulders'], 'Bodyweight', 'Easy', 'Isolation',
    'Lie on your side, lift the head sideways toward the ceiling, lower slowly, and work each side.', 'Side-neck strength to stay steady when a hook turns the head.', { reps: '10-15', rest: 45 }),
  // loop: single-arm-lat-pulldowns
  ex('Single-Arm Lat Pulldowns', 'Back', ['Biceps', 'Core', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Sit tall, one handle in one hand, pull the elbow down to the ribs, squeeze the lat and let the arm rise slowly, each side.', 'One-sided pulling strength and trunk control, for a strong underhook and for pulling a single arm.', { reps: '8-12' }),
  // loop: straight-arm-pulldowns
  ex('Straight-Arm Pulldowns', 'Back', ['Triceps', 'Core'], 'Cable', 'Normal', 'Isolation',
    'Arms nearly straight, hinge slightly forward, sweep the bar down to the thighs and let it rise slowly.', 'Lat strength for pulling an opponent in and keeping them there.', { reps: '10-12' }),
  // loop: wide-grip-pull-ups
  ex('Typewriter Pull-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Wide grip, pull up to one hand, slide across to the other hand at the top, then lower with control.', 'Lat and grip strength working side to side, for pulling and controlling an opponent in the clinch.', { reps: '4-6', rest: 90 }),
  // loop: wide-inverted-rows
  ex('Wide Inverted Rows', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hang under the bar with a wide grip, body straight, pull the chest to the bar and squeeze the shoulder blades.', 'Upper-back strength that keeps the shoulders healthy under punching volume.', { reps: '10-15' }),
  // loop: wide-to-narrow-pull-ups
  ex('Wide to Narrow Pull-Ups', 'Back', ['Biceps', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Pull up on a wide grip, lower, bring the hands in close and pull up again, keeping the body still.', 'Lats and arms trained at two widths for pulling strength in the clinch.', { reps: '4-6', rest: 90 }),
  // loop: wide-grip-lat-pulldowns
  ex('Wide-Grip Lat Pulldowns', 'Back', ['Biceps', 'Shoulders'], 'Cable', 'Normal', 'Compound',
    'Wide grip, sit tall with the thighs under the pad, pull the bar to the upper chest with the elbows out, squeeze the shoulder blades and let it rise slowly.', 'Width and strength across the upper back for a strong frame and for pulling an opponent off balance.', { reps: '8-12' }),
  // loop: wrist-grip-single-arm-pull-ups
  ex('Wrist-Grip Single-Arm Pull-Ups', 'Back', ['Biceps', 'Shoulders', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Grip the bar with one hand and hold that wrist with the other, pull up, lower slowly, and work each side.', 'Single-arm pulling strength and a strong grip for hand fighting and clinch control.', { reps: '3-5', rest: 120 }),

  // ── Shoulders ─────────────────────────────────────────────────────
  // loop: alternating-dumbbell-punches-to-the-sky
  ex('Alternating Dumbbell Punches to the Sky', 'Shoulders', ['Triceps', 'Core', 'Chest'], 'Weighted', 'Normal', 'Compound',
    'Stand tall with a dumbbell in each fist at the chin, punch one straight up to the sky, bring it back and alternate.', 'Overhead punching power and shoulder endurance for uppercuts and for keeping the hands up late in a round.', { reps: '20-30', rest: 45, style: 'Endurance' }),
  // loop: decline-pike-push-ups
  ex('Decline Pike Push-Ups', 'Shoulders', ['Triceps', 'Chest'], 'Bodyweight', 'Hard', 'Compound',
    'Feet on a box, hips high, lower the head between the hands and press back up.', 'Shoulder strength for overhead pressing and framing.', { reps: '6-10', rest: 75 }),
  // loop: dolphin-push-ups
  ex('Dolphin Push-Ups', 'Shoulders', ['Chest', 'Triceps', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Hips high to start, dive the head and chest low between the hands, sweep forward and up, then push back slowly.', 'Shoulder and spine mobility with pressing power for quick resets off the floor.', { reps: '8-12' }),
  // loop: extended-straight-arm-push-up
  ex('Extended Straight-Arm Push-Ups', 'Shoulders', ['Core', 'Chest'], 'Bodyweight', 'Normal', 'Compound',
    'Hands far ahead of the shoulders, arms locked straight, press the floor away to lift the hips, then lower slowly.', 'Braced, long-lever strength through the shoulders and core for sprawls and clinch battles.', { reps: '8-12' }),
  // loops: landmine-press, landmine-press-2
  ex('Landmine Press', 'Shoulders', ['Chest', 'Triceps'], 'Weighted', 'Normal', 'Compound',
    'Hold the bar end at the chest with both hands, press up and forward to full extension, then lower with control.', 'Pressing power on the same upward arc as a straight punch.', { reps: '8-12' }),
  // loop: maltese-push-ups
  ex('Maltese Push-Ups', 'Shoulders', ['Chest', 'Triceps', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Place the hands back near the hips, lean the shoulders far past them, lower with control and press up.', 'Heavy front-shoulder strength so punches and presses finish strong.', { reps: '4-6', rest: 90 }),
  // loop: overhead-shoulder-toss
  ex('Overhead Shoulder Toss', 'Shoulders', ['Triceps', 'Core', 'Back'], 'Weighted', 'Normal', 'Compound',
    'Hold the weight at the shoulders with both hands, send it overhead in one smooth motion, then bring it back under control.', 'Overhead power and shoulder strength for framing and uppercut drive.', { reps: '8-10', rest: 60, style: 'Power' }),

  // ── Biceps ────────────────────────────────────────────────────────
  // loops: barbell-close-grip-curls, barbell-close-grip-curls-2
  ex('Barbell Close-Grip Curls', 'Biceps', [], 'Weighted', 'Normal', 'Isolation',
    'Hands close together on the bar, elbows pinned to the ribs, curl to the chest and lower slowly.', 'Biceps and forearm strength for pulling and hand fighting in the clinch.', { reps: '8-12' }),
  // loop: barbell-wide-curls
  ex('Barbell Wide Curls', 'Biceps', [], 'Weighted', 'Normal', 'Isolation',
    'Hands wider than the shoulders, elbows still, curl the bar to the chest and lower under control.', 'Biceps strength for pulling an opponent in and holding them there.', { reps: '8-12' }),
  // loop: kettlebell-hammer-curls
  ex('Kettlebell Hammer Curls', 'Biceps', ['Shoulders'], 'Weighted', 'Normal', 'Isolation',
    'Hold the bell by the handle in both hands, elbows tucked, curl it to the chest and lower slowly.', 'Forearm and grip strength for grappling, curling a load close to the body.', { reps: '10-12', rest: 45 }),

  // ── Triceps ───────────────────────────────────────────────────────
  // loop: decline-diamond-push-ups
  ex('Decline Diamond Push-Ups', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Feet on a box, hands in a diamond under the chest, elbows tucked, lower the chest to the hands and press up.', 'Heavy triceps and upper-chest strength for a hard lockout on the jab and cross.', { reps: '6-10', rest: 75 }),
  // loop: deep-tricep-extensions-off-bench
  ex('Deep Tricep Extensions Off Bench', 'Triceps', ['Shoulders', 'Chest'], 'Bodyweight', 'Normal', 'Isolation',
    'Hands on the bench edge, body in one line, bend the elbows to lower the head deep past the hands, then press out.', 'Triceps lockout strength for the snap at the end of a straight punch.', { reps: '8-12', rest: 60 }),
  // loop: elevated-bench-dip-to-tricep-extension
  ex('Elevated Bench Dip to Tricep Extension', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Dip with the hands on the bench behind you, press up, then turn to face it and finish with a tricep extension.', 'Triceps endurance and lockout strength for long exchanges.', { reps: '6-10', rest: 75 }),
  // loop: explosive-tricep-extensions
  ex('Explosive Tricep Extensions', 'Triceps', ['Shoulders', 'Chest'], 'Bodyweight', 'Normal', 'Isolation',
    'Hands on a bench edge, lower the head by bending the elbows, then drive up fast and lock out.', 'Fast triceps extension for a snappy jab and a hard lockout.', { reps: '6-10', rest: 60, style: 'Power' }),
  // loop: hanging-bench-dips
  ex('Hanging Bench Dips', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hands on the bench edge, hips hanging in front of it, knees bent, bend the elbows straight back and press up.', 'Triceps lockout strength for the end of every straight punch.', { reps: '8-12' }),
  // loop: incline-deep-lean-tricep-pushup
  ex('Incline Deep Lean Tricep Push-Ups', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hands on a raised box, lean deep over them with the elbows tucked, lower the chest down and press up.', 'Triceps lockout power behind the jab and cross.'),
  // loop: incline-diamond-push-ups
  ex('Incline Diamond Push-Ups', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Hands in a diamond on a raised box, body in one line, lower the chest to the hands and press up.', 'Triceps lockout for the snap on a straight punch, with a lighter load than the floor version.'),
  // loop: isolated-tricep-row
  ex('Isolated Tricep Rows', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Kneel at the bench, hands on the edge, keep the elbows tight to the sides, lower the chest and press up.', 'Triceps endurance for a snappy jab late in the round.', { reps: '10-15' }),
  // loop: single-arm-bench-dips
  ex('Single-Arm Bench Dips', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Hard', 'Compound',
    'Support yourself on one hand on the bench behind you, lower under control, press up, and switch to work each side.', 'Single-arm triceps strength for powerful straight punches and posting off the floor.', { reps: '6-8', rest: 75 }),
  // loop: tricep-bench-walk-outs-to-tiger-push-ups
  ex('Tricep Bench Walk-Outs to Tiger Push-Ups', 'Triceps', ['Chest', 'Shoulders', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Feet up on the bench, walk the hands out, lower into a tiger push-up and press back to the start.', 'Triceps, shoulder and core stamina for ground scrambles.', { reps: '6-10', rest: 90 }),

  // ── Core ──────────────────────────────────────────────────────────
  // loop: 3-level-sit-ups
  ex('3 Level Sit-Ups', 'Core', ['Quads'], 'Bodyweight', 'Normal', 'Compound',
    'Hands behind the head, curl up in three stages with a short pause at each level, then lower slowly.', 'Abs and hip flexors that stay strong deep into the late rounds.', { reps: '8-12', rest: 45 }),
  // loop: battle-rope-transversal-slams
  ex('Battle Rope Transversal Slams', 'Core', ['Shoulders', 'Back'], 'Cable', 'Normal', 'Compound',
    'Raise both ropes overhead, twist the hips and slam them to one side, then switch to work each side.', 'Rotational power for hooks and a core that carries force up from the legs.', { reps: '10-15', rest: 45, style: 'Power' }),
  // loop: cross-leg-sit-ups
  ex('Cross-Leg Sit-Ups', 'Core', [], 'Bodyweight', 'Normal', 'Compound',
    'Cross one ankle over the opposite knee, hands behind the head, sit up toward it, lower slowly, then swap legs.', 'Oblique and ab strength for twisting kicks and hooks.', { reps: '10-15', rest: 30 }),
  // loop: crossed-leg-crunches
  ex('Crossed-Leg Crunches', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'On your back with one ankle crossed over the opposite knee, hands behind the head, curl the shoulders up toward the knee and lower slowly.', 'Upper-ab strength and control for absorbing body shots and driving punches.', { reps: '12-20', rest: 30 }),
  // loop: hanging-knee-raises
  ex('Hanging Knee Raises', 'Core', ['Quads', 'Back'], 'Bodyweight', 'Normal', 'Isolation',
    'Hang from the bar, pull the knees up toward the chest without swinging, lower slowly.', 'Lower-ab strength for knee strikes.', { reps: '8-12', rest: 45 }),
  // loop: heel-touches
  ex('Heel Touches', 'Core', [], 'Bodyweight', 'Easy', 'Isolation',
    'On your back, knees bent, lift the shoulders slightly and reach one hand to the same-side heel, then switch.', 'Side-ab control for hooks and body rotation.', { reps: '20-30', rest: 30 }),
  // loop: kettlebell-around-thr-legs
  ex('Kettlebell Around the Legs', 'Core', ['Hamstrings', 'Back'], 'Weighted', 'Easy', 'Compound',
    'Feet wide, soft knees, flat back, circle the bell around the legs and pass it hand to hand.', 'A braced, low stance with fast hands, the position of a fighter working from a crouch.', { reps: '10-12', rest: 45 }),
  // loop: kettlebell-around-the-world-around-the-leg
  ex('Kettlebell Around the World and Leg', 'Core', ['Shoulders', 'Back'], 'Weighted', 'Easy', 'Compound',
    'Pass the bell around the waist hand to hand, then circle it around one leg, hips still and chest tall.', 'Hand speed and grip security, with a braced core while the arms work around it.', { reps: '8-12', rest: 45 }),
  // loop: kettlebell-halos-to-tranverse-swings
  ex('Kettlebell Halos to Transverse Swings', 'Core', ['Shoulders', 'Back', 'Glutes'], 'Weighted', 'Normal', 'Compound',
    'Circle the bell around the head, then swing it across the body with the hips and torso turning together.', 'Rotational power and shoulder mobility for hooks and body shots.', { reps: '8-12', rest: 45 }),
  // loop: knee-high-crunch
  ex('Knee-High Crunches', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'On your back with the knees held high over the hips, reach the hands toward the shins and curl the shoulders up.', 'Lower-ab control for knee strikes and staying compact on the ground.', { reps: '12-15', rest: 30 }),
  // loop: lying-neck-flexion
  ex('Lying Neck Flexion', 'Core', [], 'Bodyweight', 'Easy', 'Isolation',
    'Lie on your back, tuck the chin toward the chest to lift the head, then lower slowly.', 'A strong neck helps you take a punch and stay steady when your head is pulled down.', { reps: '10-15', rest: 45 }),
  // loop: plank-side-tucks
  ex('Plank Side Tucks', 'Core', ['Shoulders', 'Quads'], 'Bodyweight', 'Normal', 'Core',
    'High plank with the hips level, draw one knee out toward the same-side elbow, return it, then switch to work each side.', 'Oblique strength and hip mobility for fast ground movement and scrambles.', { reps: '12-16', rest: 30 }),
  // loop: scissor-kicks
  ex('Scissor Kicks', 'Core', ['Quads'], 'Bodyweight', 'Normal', 'Isolation',
    'Lean back on the hands, legs long and low, open and cross them like scissors with the abs tight.', 'Lower-ab endurance and hip control for kicking and staying composed late in a round.', { reps: '20-30', rest: 30 }),
  // loops: seated-knee-tucks, windshield-wipers
  ex('Seated Ab Windshield Wipers', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'Lean back on your hands, lift both feet and swing the legs from side to side like wipers, abs tight.', 'Oblique and lower-ab control for twisting kicks and hooks.', { reps: '10-15', rest: 30 }),
  // loop: side-ab-crunch
  ex('Side Ab Crunches', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'Lie back, lift the shoulders and draw both knees up toward one side, lower with control, then switch to work each side.', 'Side-ab strength for hooks, body rotation and absorbing body shots.', { reps: '12-16', rest: 30 }),
  // loop: straight-leg-app-circles
  ex('Straight-Leg Ab Circles', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'On your back, lower back pressed down, hands behind the head, keep the legs straight and draw slow circles in the air.', 'Lower-ab control for kicks and knee strikes.', { reps: '8-12', rest: 30 }),
  // loop: stritch-sit-ups
  ex('Stretch Sit-Ups', 'Core', ['Quads'], 'Bodyweight', 'Normal', 'Compound',
    'Lie back with the knees bent and the hands behind the head, curl all the way up and lower under control.', 'Trunk strength and endurance for absorbing body shots and driving punches.', { reps: '12-15', rest: 45 }),
  // loop: tuck-ups
  ex('Tuck-Ups', 'Core', ['Quads'], 'Bodyweight', 'Normal', 'Compound',
    'Lie flat, curl up and pull the knees in to meet the chest, lower with control.', 'Abs and hip flexors for knees and kicks.', { reps: '12-15', rest: 30 }),
  // loops: vertical-leg-crunches, vertical-leg-crunches-2
  ex('Vertical Leg Crunches', 'Core', [], 'Bodyweight', 'Normal', 'Isolation',
    'On your back with the legs straight up, lift the shoulders and reach the hands toward the toes, then lower slowly.', 'Ab strength and bracing for taking body shots.', { reps: '12-15', rest: 30 }),

  // ── Quads ─────────────────────────────────────────────────────────
  // loop: alternating-kettlebell-swing-to-squat
  ex('Alternating Kettlebell Swing to Squat', 'Quads', ['Glutes', 'Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell up to the shoulder, sit into a squat with it racked, stand tall and switch hands each rep.', 'Hip snap plus leg drive, the engine for shooting in and exploding out of a stance.', { reps: '10-14', rest: 60, style: 'Power' }),
  // loop: barbell-cross-arm-front-squats
  ex('Barbell Cross-Arm Front Squats', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Hard', 'Compound',
    'Bar on the front of the shoulders, arms crossed over it, elbows high, squat deep with the chest tall and drive up.', 'Front-loaded leg strength that keeps the chest upright, the base for a strong clinch and a powerful shot.', { reps: '5-8', rest: 120 }),
  // loop: boxing-box-squat-bounce
  ex('Boxing Squat Bounces', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Cardio',
    'Sink into a low squat with the fists up in guard and bounce lightly on the feet, chest tall.', 'Low-stance leg endurance for fighting from a crouch while staying light on the feet.', { hold: 30, rest: 30 }),
  // loops: bulgarian-jump-lunges-with-high-knee, bulgarian-jump-lunges-with-high-knee-2
  ex('Bulgarian Jump Lunges with High Knee', 'Quads', ['Glutes', 'Hamstrings', 'Calves', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Rear foot on a bench, drop into the lunge, jump straight up and drive the front knee high, then land soft in the lunge, each side.', 'Single-leg explosive power into a high knee, the drive behind a knee strike and a fast step in.', { reps: '6-8', rest: 60, style: 'Power' }),
  // loop: crab-walk-squats
  ex('Crab Walk Squats', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Compound',
    'Arms crossed, step wide to the side, sink into a wide squat and keep stepping sideways with the chest tall.', 'Lateral leg strength and a wide, low base for moving sideways under pressure.', { hold: 40, rest: 45 }),
  // loop: duck-walks
  ex('Duck Walks', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Compound',
    'Sink into a deep squat, hands together in front, and walk forward in small steps without standing up.', 'Deep-squat leg endurance and ankle strength for a low, mobile stance.', { hold: 30, rest: 45 }),
  // loop: dumbbell-alternating-back-lunge
  ex('Dumbbell Alternating Back Lunges', 'Quads', ['Glutes', 'Hamstrings'], 'Weighted', 'Normal', 'Compound',
    'Dumbbells at the sides, step one leg back, drop the back knee toward the floor, drive up and switch legs.', 'Loaded single-leg drive for stepping back out of range and countering.', { reps: '8-12', rest: 60 }),
  // loop: front-barbell-squats
  ex('Front Barbell Squats', 'Quads', ['Glutes', 'Core', 'Back'], 'Weighted', 'Hard', 'Compound',
    'Bar on the front of the shoulders with the arms crossed over it, elbows up, sit down tall and drive back up.', 'Leg drive with the chest held tall, like staying upright under an opponent\'s pressure.', { reps: '5-8', rest: 120 }),
  // loop: front-to-back-lunge
  ex('Front to Back Lunges', 'Quads', ['Glutes', 'Hamstrings'], 'Bodyweight', 'Normal', 'Compound',
    'Hands on the hips, lunge forward, push back to standing, then step back into a reverse lunge, and repeat each side.', 'Balanced single-leg strength for stepping in and out of range.', { reps: '6-10', rest: 60 }),
  // loop: hack-squat-machine
  ex('Hack Squat Machine', 'Quads', ['Glutes', 'Hamstrings'], 'Machine', 'Normal', 'Compound',
    'Back flat on the pad, feet shoulder-width, lower under control until the thighs are parallel and press up without locking the knees.', 'Heavy leg drive for explosive takedown defence and the power behind every kick.', { reps: '8-12', rest: 75 }),
  // loop: jumping-jack-squats
  ex('Jumping Jack Squats', 'Quads', ['Glutes', 'Calves', 'Shoulders'], 'Bodyweight', 'Normal', 'Cardio',
    'Sink into a squat, stand into a jumping jack with the arms overhead, then drop back into the squat.', 'Leg endurance and quick feet, with the squat and the jack back to back keeping the heart rate high.', { reps: '12-15', rest: 45, style: 'Endurance' }),
  // loop: kettlebell-around-the-world-to-squat
  ex('Kettlebell Around the World to Squat', 'Quads', ['Core', 'Shoulders', 'Glutes'], 'Weighted', 'Normal', 'Compound',
    'Circle the bell around the waist hand to hand, then sit into a squat with it held in front and stand tall.', 'Leg strength and hand coordination together, for moving well while the hands stay busy.', { reps: '8-12', rest: 60 }),
  // loop: ketabel-catch-to-knee
  ex('Kettlebell Catch to Knee', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Hold the bell at the chest, stand tall, drop to one knee with control, then rise and repeat on the other side.', 'Controlled drops to the floor and fast recovery to your feet.', { reps: '8-10', rest: 60 }),
  // loop: kettlebell-clean-to-lunge
  ex('Kettlebell Clean to Lunge', 'Quads', ['Glutes', 'Hamstrings', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Clean the bell to the shoulder, step back into a lunge with it racked, drive up and repeat on each side.', 'Explosive hips into single-leg strength, the base of movement in and out of range.', { reps: '8-10', rest: 60, style: 'Power' }),
  // loop: tell-about-clean-to-turn-lunge
  ex('Kettlebell Clean to Turn Lunge', 'Quads', ['Glutes', 'Shoulders', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Clean the kettlebell to the chest, turn into a lunge with the back knee low, stand and lower the bell, each side.', 'Explosive hip drive into a pivoting lunge, the power and footwork of turning off a stance.', { reps: '8-10', rest: 60, style: 'Power' }),
  // loop: kettlebell-cross-arm-squat
  ex('Kettlebell Cross-Arm Squats', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Cross the arms over the bell at the chest, sit the hips back and down, keep the chest tall and drive up.', 'Upright squat strength behind a guarded chest, the posture of a fighter who stays tall under pressure.', { reps: '8-12', rest: 60 }),
  // loop: ketabel-elevator-squats
  ex('Kettlebell Elevator Squats', 'Quads', ['Glutes', 'Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Hold the bell low, sit down and back, pause halfway like an elevator stopping at a floor, then drive up through the heels.', 'Deep loaded squat strength for a low, powerful stance.', { reps: '8-12', rest: 60 }),
  // loop: kettlebell
  ex('Kettlebell Goblet Squats', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Hold the bell at the chest with the elbows tucked, sit deep between the knees and drive up through the heels.', 'Loaded leg strength for a heavier, lower stance.', { reps: '8-12', rest: 75 }),
  // loop: goblet-reverse-lunges
  ex('Kettlebell Hold Static Lunges', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Hold the kettlebell at the chest, feet split and planted, lower the back knee toward the floor and drive up, each side.', 'Loaded single-leg strength and a braced core for holding a stance under pressure.', { reps: '8-12', rest: 60 }),
  // loop: kettlebell-kneel-to-stand
  ex('Kettlebell Kneel to Stand', 'Quads', ['Glutes', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Bell at the chest, rise from the knees by stepping one foot up, stand tall, lower back down and alternate feet.', 'Getting up from the floor under load, a base skill for scrambles and returning to your feet.', { reps: '8-10', rest: 60 }),
  // loop: ketabel-swing-narrow-to-wide-squats
  ex('Kettlebell Swing Narrow to Wide Squats', 'Quads', ['Glutes', 'Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell with the feet together, step wide into a squat with the bell low, then bring the feet back in.', 'Stance changes under load, the footwork of switching from a narrow guard to a wide base.', { reps: '10-12', rest: 60 }),
  // loops: catabelle-swing-to-back-lunge, kettlebell-swing-to-back-lunge
  ex('Kettlebell Swing to Back Lunge', 'Quads', ['Glutes', 'Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell to the shoulder with the hips, step back into a lunge, drive up, then swing and switch sides.', 'Hip snap into single-leg strength, the footwork of retreating and countering.', { reps: '8-12', rest: 60 }),
  // loop: catabelle-swing-to-lateral-lunch
  ex('Kettlebell Swing to Lateral Lunge', 'Quads', ['Glutes', 'Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell with the hips, step wide and sit back over one leg, push back to centre and alternate sides.', 'Lateral leg strength for slipping, cutting angles and sidestepping a rush.', { reps: '8-12', rest: 60 }),
  // loop: kettlebell-swings-to-jump-squat
  ex('Kettlebell Swings to Jump Squat', 'Quads', ['Glutes', 'Hamstrings', 'Calves'], 'Weighted', 'Hard', 'Compound',
    'Swing the bell with the hips, bring it to the chest, sink and jump, then land softly before the next swing.', 'Explosive leg drive for closing distance, built on the hip snap of a swing.', { reps: '6-10', rest: 75, style: 'Power' }),
  // loop: playing-kickouts-to-squat
  ex('Kickouts to Squat', 'Quads', ['Glutes', 'Core', 'Shoulders'], 'Bodyweight', 'Normal', 'Compound',
    'Drop into a deep squat with the hands on the floor, kick one leg out to the side, return and alternate.', 'Hip mobility and leg control for scrambles and getting up from the ground.', { reps: '10-15', rest: 45 }),
  // loop: leg-press
  ex('Leg Press', 'Quads', ['Glutes', 'Hamstrings'], 'Machine', 'Normal', 'Compound',
    'Back flat on the pad, feet shoulder-width on the plate, lower to ninety degrees at the knee and press without locking out.', 'Raw leg strength for driving off the back foot and powering through a clinch.', { reps: '8-12', rest: 75 }),
  // loop: narrow-regular-wide-squats
  ex('Narrow Regular Wide Squats', 'Quads', ['Glutes', 'Hamstrings'], 'Bodyweight', 'Normal', 'Compound',
    'Squat with the feet close together, then shoulder width, then wide, chest tall and heels down every time.', 'Leg strength in every stance width for moving between narrow, neutral and wide fighting stances.', { reps: '12-15' }),
  // loop: ninja-squats
  ex('Ninja Squats', 'Quads', ['Glutes', 'Hamstrings'], 'Bodyweight', 'Normal', 'Compound',
    'Arms crossed, feet wide, sink onto one bent leg with the other leg straight, then stand and switch sides.', 'Lateral leg strength and hip mobility for pivoting, slipping and changing angles.', { reps: '10-14', rest: 45 }),
  // loop: overhead-squat
  ex('Overhead Squats', 'Quads', ['Shoulders', 'Core', 'Glutes'], 'Bodyweight', 'Normal', 'Compound',
    'Arms straight overhead, chest tall, sit down between the hips and stand up without letting the arms drop.', 'Shoulder and hip mobility with leg strength, keeping the hands high while sitting low.', { reps: '8-12', rest: 60 }),
  // loop: power-squats
  ex('Power Squats', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Compound',
    'Arms crossed on the chest, squat down under control, then drive up fast and finish tall.', 'Explosive leg drive for closing distance and powering the first step.', { reps: '8-12', rest: 45, style: 'Power' }),
  // loops: prison-squats, prison-squats-2
  ex('Prison Squats', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Easy', 'Compound',
    'Hands behind the head, elbows wide, chest tall, sit down between the hips and drive back up.', 'Leg strength and an open, upright chest with the hands locked behind the head, like holding a clinch.', { reps: '12-15' }),
  // loop: reverse-lunge-knee-drives
  ex('Reverse Lunge Knee Drives', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Step back into a lunge, then drive the back knee up as you stand tall on the front leg, each side.', 'The leg drive behind a retreat and counter, finished with a knee strike.', { reps: '8-12', rest: 60 }),
  // loop: side-shuffles
  ex('Side Shuffles', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Cardio',
    'Stay low in an athletic stance on the balls of the feet and shuffle quickly side to side without crossing the feet.', 'Quick lateral footwork for circling, slipping out of range and cutting off the ring.', { hold: 30, rest: 30 }),
  // loop: side-shuffles-to-touch-downs
  ex('Side Shuffles to Touch Downs', 'Quads', ['Glutes', 'Calves'], 'Bodyweight', 'Normal', 'Cardio',
    'Shuffle sideways in a low stance and touch the floor with the near hand, then shuffle the other way.', 'Lateral footwork with a level change, the quick drop and recover of slipping and shooting.', { hold: 30, rest: 30 }),
  // loop: sissy-squat
  ex('Sissy Squats', 'Quads', ['Core'], 'Bodyweight', 'Hard', 'Isolation',
    'Rise onto the toes, let the knees travel forward over them, lower slowly and press back up through the thighs.', 'Quad strength and knee control for kicking and stepping in on a bent front leg.', { reps: '6-10', rest: 75 }),
  // loop: squats-hold-thrust-jump
  ex('Squat Hold Thrust Jumps', 'Quads', ['Glutes', 'Calves', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Sink into a squat and hold it, then thrust up hard into a jump and land soft back in the squat.', 'Explosive leg drive out of a held low position, the power of a sudden shot or a spring away.', { reps: '6-10', rest: 60, style: 'Power' }),
  // loop: squat-to-fake-thai-roundhouse
  ex('Squat to Fake Thai Roundhouse', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Sit into a deep squat, drive up with the guard high, turn the hip over like a Thai roundhouse without landing it, then reset and alternate.', 'Leg drive into a rotating feint, the hip turn and balance behind a roundhouse that sets up the real one.', { reps: '10-14', rest: 45, style: 'Power' }),
  // loop: squat-to-flick-kick
  ex('Squat to Flick Kick', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Sit into a deep squat, drive up and flick the kick out fast, land balanced and alternate legs.', 'Leg drive into a quick snap kick, with the balance to land it and reset.', { reps: '10-14', rest: 45, style: 'Power' }),
  // loop: squat-to-roundhouse-kick
  ex('Squat to Roundhouse Kick', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Sit into a deep squat, drive up, pivot on the standing foot and swing the leg through, then reset and alternate.', 'Squat strength flowing into a rotating kick, the leg power and pivot of a roundhouse.', { reps: '10-14', rest: 45, style: 'Power' }),
  // loops: squat-to-standing-knee-drives, squat-to-knee
  ex('Squat to Standing Knee Drives', 'Quads', ['Core', 'Glutes'], 'Bodyweight', 'Normal', 'Compound',
    'Sink into a squat, stand up fast, drive one knee to the chest, then squat again and drive the other knee.', 'Leg power into a knee strike, from a low stance up to the clinch.', { reps: '10-14', rest: 45, style: 'Power' }),
  // loop: squats-tuck-jumps
  ex('Squat Tuck Jumps', 'Quads', ['Glutes', 'Calves', 'Core'], 'Bodyweight', 'Hard', 'Compound',
    'Squat down, explode up and pull the knees to the chest in the air, then land soft and squat again.', 'Explosive leg power and fast recovery for springing in and out of range.', { reps: '6-10', rest: 75, style: 'Power' }),
  // loop: stienborn-squat
  ex('Stienborn Squat', 'Quads', ['Glutes', 'Hamstrings', 'Back', 'Core'], 'Weighted', 'Hard', 'Compound',
    'Pick the bar up off the floor and roll it onto the shoulders, squat deep with the chest tall, stand, then lower the bar to the floor under control.', 'Full-chain strength from the floor to a loaded squat, the power to lift and drive through an opponent.', { reps: '4-6', rest: 120 }),
  // loop: tippy-toe-squats
  ex('Tippy-Toe Squats', 'Quads', ['Calves', 'Glutes'], 'Bodyweight', 'Normal', 'Compound',
    'Hands together at the chest, rise onto the toes and squat down with the heels off the floor, then stand tall.', 'Quad and calf strength for staying on the balls of the feet, light and ready to move.', { reps: '10-15', rest: 45 }),
  // loop: tiptoe-down-squats
  ex('Tiptoe Down Squats', 'Quads', ['Calves', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Arms straight out in front, rise onto the toes as you lower into the squat, then drive up and settle the heels.', 'Quad and calf strength on the balls of the feet, the springy stance a boxer fights from.', { reps: '10-15', rest: 45 }),
  // loop: toe-touch-to-front-squat
  ex('Toe Touch to Front Squat', 'Quads', ['Hamstrings', 'Glutes', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Fold forward and touch the toes, stand tall, then sink into a squat with the arms held in front.', 'Hamstring mobility linked to leg strength, the hinge and squat of getting low and back up.', { reps: '8-12', rest: 60 }),
  // loop: water-splash-squats
  ex('Water Splash Squats', 'Quads', ['Glutes', 'Core'], 'Bodyweight', 'Easy', 'Compound',
    'Squat down and reach the hands toward the floor like scooping water, then stand and flick them up in a splash.', 'Low-to-high leg drive with loose, fast arms for staying relaxed and explosive.', { reps: '10-15', rest: 45 }),
  // loop: wide-squats
  ex('Wide Squats', 'Quads', ['Glutes', 'Hamstrings'], 'Bodyweight', 'Easy', 'Compound',
    'Feet wider than the shoulders, chest tall, sit down between the hips and drive up through the heels.', 'A wide, low base for sprawls, takedown defence and a solid stance.', { reps: '12-15' }),
  // loop: zercher-squats
  ex('Zercher Squats', 'Quads', ['Glutes', 'Core', 'Back'], 'Weighted', 'Hard', 'Compound',
    'Bar in the crooks of the elbows, hands clasped, chest tall, squat deep and drive up through the floor.', 'Leg strength under a front load, like driving up with an opponent\'s weight on your chest and arms.', { reps: '6-8', rest: 90 }),

  // ── Hamstrings ────────────────────────────────────────────────────
  // loop: elevator-kettlebell-swings
  ex('Elevator Kettlebell Swings', 'Hamstrings', ['Glutes', 'Quads', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell up, pause halfway down like an elevator stopping at a floor, then sink low and drive the hips again.', 'Hip snap that powers every punch and kick, trained through a deeper range.', { reps: '8-12', rest: 60 }),
  // loop: hamstring-barbell-extension
  ex('Hamstring Barbell Extensions', 'Hamstrings', ['Glutes', 'Back'], 'Weighted', 'Normal', 'Compound',
    'Soft knees and a flat back, hinge until the bar reaches the shins and the hamstrings stretch, then drive the hips forward.', 'Hamstring and hip strength for explosive sprawls and a rooted stance.', { reps: '8-10', rest: 90 }),
  // loop: one-arm-kettlebell-swings-around-the-legs
  ex('One-Arm Kettlebell Swings Around the Legs', 'Hamstrings', ['Glutes', 'Core', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Hinge with a flat back, swing the bell with one arm around the legs, keep the hips driving, then switch arms.', 'Hip snap and grip control one arm at a time, the timing of a fast reset.', { reps: '10-12', rest: 60, style: 'Power' }),
  // loop: single-side-dumbbell-deadliff
  ex('Single-Side Dumbbell Deadlifts', 'Hamstrings', ['Glutes', 'Core', 'Back'], 'Weighted', 'Normal', 'Compound',
    'Hold one dumbbell at your side, hinge with a flat back, touch it down, stand tall without leaning, and work each side.', 'Hip strength and a core that resists leaning when an opponent pulls you off balance.', { reps: '8-10', rest: 75 }),
  // loop: smith-machine-good-morning-s
  ex('Smith Machine Good Mornings', 'Hamstrings', ['Glutes', 'Back'], 'Machine', 'Normal', 'Compound',
    'Bar on the upper back, soft knees, push the hips back until the torso tips forward, then drive the hips through.', 'Hamstring and lower-back strength for explosive hips in kicks and takedown defence.', { reps: '8-12', rest: 75 }),

  // ── Glutes ────────────────────────────────────────────────────────
  // loop: kettlebell-hip-thrust
  ex('Kettlebell Hip Thrusts', 'Glutes', ['Hamstrings', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Drive the hips forward with the bell held close, squeeze the glutes hard at the top and lower with control.', 'The hip drive behind every knee strike and every push off the floor.', { reps: '8-12', rest: 60 }),
  // loop: kettlebell-kneeling-hip-thrust
  ex('Kettlebell Kneeling Hip Thrusts', 'Glutes', ['Quads', 'Core'], 'Weighted', 'Normal', 'Compound',
    'Kneel tall with the bell at the chest, sit the hips back, then drive them forward and squeeze the glutes.', 'Hip drive for knee strikes and for powering out of the ground.', { reps: '10-15', rest: 45 }),

  // ── Full Body ─────────────────────────────────────────────────────
  // loop: alternating-kettlebell-clean-and-press
  ex('Alternating Kettlebell Clean and Press', 'Full Body', ['Shoulders', 'Hamstrings', 'Core'], 'Weighted', 'Hard', 'Compound',
    'Pull the bell to the shoulder with the hips, press it overhead, lower it with control and switch arms each rep.', 'Hip-to-hand power for punching from the ground up, with each arm trained on its own.', { reps: '6-8', rest: 90, style: 'Power' }),
  // loop: barbell-clean
  ex('Barbell Cleans', 'Full Body', ['Back', 'Hamstrings', 'Shoulders'], 'Weighted', 'Hard', 'Compound',
    'Bar over the mid-foot, drive through the floor, pull the bar up the body and catch it on the shoulders.', 'Explosive hip drive for lifting an opponent and driving through them.', { reps: '3-5', rest: 120, style: 'Power', fixedDose: true }),
  // loop: snatch-negative-downward
  ex('Barbell Snatch Negatives', 'Full Body', ['Shoulders', 'Back', 'Hamstrings'], 'Weighted', 'Hard', 'Compound',
    'Get the bar overhead with a wide grip, lower it as slowly as you can to the hips, then reset and repeat.', 'Eccentric strength that keeps the shoulders and hips stable under a heavy load.', { reps: '3-5', rest: 120 }),
  // loop: battle-rope-to-slam
  ex('Battle Rope to Slam', 'Full Body', ['Shoulders', 'Core', 'Back'], 'Cable', 'Normal', 'Compound',
    'Squat low with a rope in each hand, whip both overhead, slam them down hard, then reset low.', 'Explosive shoulder and hip power for fast, heavy hands late in a round.', { reps: '10-15', rest: 45, style: 'Power' }),
  // loop: burpees-to-side-shuffle
  ex('Burpees to Side Shuffle', 'Full Body', ['Quads', 'Chest', 'Core'], 'Bodyweight', 'Normal', 'Cardio',
    'Drop into the burpee, pop back up and shuffle quickly to the side, then repeat the other way.', 'Ground-to-feet speed followed by lateral footwork, the scramble and reset of a real fight.', { reps: '8-12', rest: 45, style: 'Endurance' }),
  // loop: inchworms-push-ups
  ex('Inchworm Push-Ups', 'Full Body', ['Chest', 'Shoulders', 'Core'], 'Bodyweight', 'Normal', 'Compound',
    'Fold forward, walk the hands out to a plank, do a push-up, then walk the feet back to the hands and stand.', 'Floor-to-feet transitions with pressing strength, like getting back up after a sprawl.', { reps: '8-12' }),
  // loop: kettlebell-clean-press
  ex('Kettlebell Clean and Press', 'Full Body', ['Shoulders', 'Hamstrings', 'Core'], 'Weighted', 'Hard', 'Compound',
    'Hinge, pull the bell to the shoulder in one move, press it overhead, then lower it and repeat on each side.', 'Explosive hip drive into a one-arm press, the power behind a straight punch.', { reps: '6-8', rest: 90, style: 'Power' }),
  // loop: cross-arm-snatch
  ex('Kettlebell Cross-Arm Snatches', 'Full Body', ['Shoulders', 'Hamstrings', 'Back'], 'Weighted', 'Hard', 'Compound',
    'Reach diagonally across the body to grab the bell, snap the hips and snatch it overhead, then work each side.', 'Hip snap into an overhead lockout for explosive pulling and punching power.', { reps: '6-8', rest: 75, style: 'Power' }),
  // loop: kettlebell-swing-throw-catch-squat
  ex('Kettlebell Swing Throw Catch Squat', 'Full Body', ['Quads', 'Hamstrings', 'Shoulders'], 'Weighted', 'Hard', 'Compound',
    'Clear the space, swing the bell up with the hips and throw it, catch it at the chest and squat.', 'Explosive hips and fast hands with a catch, training reflexes under load.', { reps: '6-10', rest: 75, style: 'Power' }),
  // loop: kettlebell-swing-to-front-row
  ex('Kettlebell Swing to Front Row', 'Full Body', ['Hamstrings', 'Back', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Swing the bell with the hips, then pull it in to the chest with the elbows high before the next swing.', 'Hip snap into a quick pull, the rhythm of snapping an opponent in.', { reps: '10-14', rest: 60, style: 'Power' }),
  // loop: kb-swing-to-punch-kick
  ex('Kettlebell Swing to Punch Kick', 'Full Body', ['Hamstrings', 'Glutes', 'Shoulders'], 'Weighted', 'Normal', 'Compound',
    'Hinge and swing the bell with the hips, stand tall, then throw a punch and a kick before the next swing.', 'Links hip power straight into a strike, the way a fighter turns a lift into a combination.', { reps: '8-12', rest: 60, style: 'Power' }),
  // loop: kettlebell-swings-side-shuffle
  ex('Kettlebell Swings and Side Shuffle', 'Full Body', ['Hamstrings', 'Glutes', 'Quads'], 'Weighted', 'Normal', 'Cardio',
    'Swing the bell with the hips, then shuffle sideways in a low athletic stance and swing again.', 'Hip power with lateral footwork, the movement of cutting off the ring.', { reps: '8-12', rest: 45, style: 'Endurance' }),
  // loop: star-jacks
  ex('Star Jacks', 'Full Body', ['Quads', 'Shoulders', 'Calves'], 'Bodyweight', 'Normal', 'Cardio',
    'Sink into a squat, explode up spreading the arms and legs wide like a star, land soft and go again.', 'Explosive full-body conditioning that keeps the legs springy and the heart rate high.', { reps: '10-15', rest: 45, style: 'Power' }),
];
