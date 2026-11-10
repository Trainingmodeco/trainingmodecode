# Shoot list

What the Practice tutorials still need on film, and how to shoot it so the
cut works (the pipeline finds your body with MediaPipe and zooms on feet,
knees, hips, hands and chin, so the whole body has to be in frame and sharp).

## Still to film (the owner's list, 2026-11-03)

| What | When | Notes |
|---|---|---|
| Four stances: boxing, kickboxing, Muay Thai, MMA | Saturday | lesson 1 of each path; the deblurred boxing stance was taken out as too blurry |
| All the punches | Saturday | jab, cross, lead and rear hook, lead and rear uppercut, overhand, body jab, body cross; one clip per stance (below) |
| Flying knee | | special move; Thai khao loi (เข่าลอย) |
| Hurricane kick | | special move: the jumping spinning kick (the spinning back kick, clip 22, is already filed) |
| Spinning back fist | | special move |
| Double-hand punch | | special move: the SHOTO fireball theme (data/concepts/shoto.js) |
| Fake teep to sliding elbow | | special move: the SHOTO demon theme, sliding fake teep into the rear elbow |
| Spinning jump kick | optional | the owner: not necessary, but can do it |
| Clinch knee | | fills the Lead Knee entries, which are the clinch knee (pull the opponent in) |
| Clinch side knee | | the owner's clinch oblique or transverse knee, coming out to the side in the clinch; Thai khao tat (เข่าตัด), the horizontal knee; name to confirm |
| Lead and rear spear elbow | | unless clips 13 and 15 are them: the owner names them |
| Elbow to the body | maybe | the owner isn't sure it's filmed |

Also in the app with no footage yet, not on the owner's list: lead and rear
teep, low kick, rear side kick, check (all in Kickboxing, Muay Thai and/or
MMA), Muay Thai clinch entry, the MMA grappling entries (sprawl, level
change, basic shoot entry, ground-and-pound posture), and every Defense and
Footwork entry.

## Two-day plan (2026-11-10, for Friday and Saturday)

**One take, three uses.** Every move is one continuous clip: say the move
name to the camera first (the console labels clips from it; footage audio
never reaches a video), 3 reps facing, turn 45° for 2, 1 slow, 1 wrong rep
then the fix. The Practice tutorial, the Fit demo and the social B-roll all
come out of that one clip. Phone on a tripod that never moves; check focus
on the first take only.

**Friday: Fit Mode** (a full commercial gym: barbell, kettlebell, dumbbells,
pull-up bar, box, rower). The Quick Mission catalog
(components/training-mode/data/missionMoves.js) is what the app runs today:
135 moves, none filmed. About 1 to 1.5 min each.
1. No gear (64): sprawl and burpee family, squats and Hindu squats, push-up
   family, lunges, core, the striking conditioning moves (one-two, knee
   strikes, switch and roundhouse kicks, windshield wipers), backpack moves.
2. Kettlebell (21), then dumbbell (16).
3. Barbell (25) and plate (2): Olympic lifts last, while fresh enough to
   lift well but after the light work.
4. Pull-up bar (3), heavy bag (3), rower (1).
Morning before the gym: the talking-head pieces (founder story, beta invite,
what is Fight / Fit / Practice / Arcade) somewhere quiet; the app screen
recordings any time on the phone itself.

**Saturday: Fight Mode** (one martial arts location, one outfit, black
shirt and tiger shorts to match the library). In priority order:
1. The four stances (lesson 1 of every path).
2. Punches in boxing stance: jab, cross, lead and rear hook, lead and rear
   uppercut, overhand, body jab, body cross. Then jab-cross in the
   kickboxing, Muay Thai and MMA stances.
3. Kicks and knees still missing: lead and rear teep, low kick, rear side
   kick, check, clinch knee, clinch side knee, clinch entry.
4. Specials: double-hand punch, fake teep to sliding elbow, spinning back
   fist, flying knee, hurricane kick, spinning jump kick (optional).
5. Elbows: lead and rear spear, elbow to the body.
6. If there's time: MMA sprawl, level change, shoot entry,
   ground-and-pound posture; the defense and footwork entries.
7. Social B-roll while warm: 3 rounds of shadowboxing, bag rounds, the
   round-finish sweat shot.

## Taken out

- **Boxing stance** (Angel's camera, deblurred): too blurry; re-shot Saturday.
- **Practice: Cross** sample: it used clip 7, the same footage as the Rear
  Diagonal Elbow, labeled as a cross.

## Every clip

- **Focus first.** Tap on yourself, then press and hold to lock focus and
  exposure (iPhone: "AE/AF LOCK"). Shoot one take, zoom into it on the phone,
  and only then keep going. Angel's camera clips went soft from a missed
  focus, not from the camera.
- 4K at 30 fps, or 4K 60 if the phone keeps 4K at 60 (60 makes the slow motion
  smoother). Light on your face, not a window behind you.
- Phone on a ledge or tripod at chest height, 3–4 m back, upright (vertical).
  Whole body in frame with a hand's width of floor under the feet. For kicks,
  step back so the fully extended leg stays in frame.
- One technique per clip. Name the file or say the order in the message
  (`lead-teep.mp4`, `rear-roundhouse.mp4`), so nothing has to be guessed.
- Send the phone's original. No InShot export, no text, no music, no zoom.
- A one-second pause between reps makes every cut clean.

## Saturday: the four stances (lesson 1 of each path)

Same five pieces per stance, in this order, in one clip:

1. Settle into the stance facing the camera and hold it 4 s (the NAME beat,
   the feet and the knees key points).
2. Turn 45° toward your lead side and hold it 3 s (the stagger of the feet and
   the knee bend show here; facing the camera hides both).
3. The lesson's calls, two reps each, pause between.
4. The mistake for 2 s, then fix it where you stand (the WATCH FOR beat).
5. Hands up, chin down, hold 3 s (the hands and chin key point).

| Stance | Calls (the lesson's) | Key points the clip must show | Mistake, then the fix |
|---|---|---|---|
| Boxing | STANCE · STEP FORWARD · STEP BACK · HANDS UP | feet shoulder-width, lead foot forward · knees bent, light · hands up, chin down | standing up too tall → knees soft, weight forward |
| Kickboxing | STANCE · BOUNCE · STEP FORWARD · STEP BACK | wider than boxing, weight even · lead hand a touch further out · on the balls of the feet, bouncing | flat-footed, heels down → up on the balls of the feet |
| Muay Thai | STANCE · WEIGHT BACK · WEIGHT FORWARD · HANDS HIGH | taller, feet squared · weight on the back foot · hands high, palms forward | weight on the front foot (can't check, can't teep) → weight back, lead leg light |
| MMA | STANCE · BOUNCE · SPRAWL READY | staggered, weight 50/50 · hands a little lower than boxing · chin tucked, mobile | tall and square → staggered, knees bent, ready to sprawl |

The words on screen come from the app's lesson (practiceLessons.js: `steps`
and `calls`), so the clip only has to show them; nothing is written for the
shoot.

## Clips on file (raw-footage/practice, not in git)

The raw-footage copies are hard links to the owner's uploads, so each clip
sits on disk once.

| Clip | What the owner says it is | Status |
|---|---|---|
| 1 | spinning back elbow (Sok Klap) | cut |
| 2 | lead hook elbow (Sok Tat; the owner says hook, not horizontal) | cut |
| 3 | rear hook elbow (Sok Tat) | cut |
| 4 | lead uppercut elbow (Sok Ngat); 6 is a second take | cut |
| 7 | rear diagonal elbow (Sok Chieng: high to low at 45°); 9 and 10 look like other takes | cut |
| 8 | lead diagonal elbow (Sok Chieng) | cut |
| 16 | tomahawk elbow (Sok Sap, the jumping one); 5, 11 and 17 are other takes | cut |
| 18 | rear uppercut elbow (Sok Ngat) | cut |
| 13, 15 | the spear elbows? 15 has a lead-arm thrust from a turned stance, 13 a rear-arm drive forward and up | to name |
| 12, 14 | spinning or rear-view takes | alternates |
| 19 | lead side kick (karate: yoko geri) | cut |
| 20 | marching-forward side kick (tsugi-ashi yoko geri kekomi) | cut |
| 21 | machine gun kick (Thai: te rua, เตะรัว) | cut |
| 22 | spinning back heel kick (karate: ushiro geri; Thai: te klap lang, เตะกลับหลัง); a join at 7.0 s | cut |
| 23 | switch kick (Thai: te salap, เตะสลับ); Kickboxing, Muay Thai and MMA | cut |
| 24 | rear roundhouse kick (Thai: te tat, เตะตัด); Kickboxing, Muay Thai and MMA; a soft InShot join at 5.63 s | cut |
| 25 | lead shuffle knee (Thai: khao yao, เข่ายาว, the long knee); 5.6 s, two reps | cut |
| 26 | rear knee (Thai: khao trong, เข่าตรง); soft joins at 2.93 and 5.5 s | cut |
| 27 | roundhouse knee, disguised as a low roundhouse kick (Thai: khao khong, เข่าโค้ง) | cut |

The owner's elbow list: lead and rear spear, lead and rear uppercut, lead and
rear hook, lead and rear diagonal, one spinning back, tomahawk (the jumping
one), maybe an elbow to the body.

Per technique the cut wants three reps facing the camera, one at 45°, one
slow, and one wrong rep followed by the fix; where a clip lacks the wrong
rep, the WATCH FOR beat freezes a frame of the right rep behind a red ring,
which is weaker. Send them named or with the order in the message.

## Punches (refilm)

Jab, cross, lead hook, rear hook, uppercuts. The jab and jab-cross lessons
exist in all four paths, so one clip per stance (jab × 3, cross × 3, jab-cross
× 3, wrong rep + fix) covers Boxing › Jab, Cross, Jab-Cross; Kickboxing › Jab,
Cross; Muay Thai › Jab + Cross; MMA › Jab + Cross. Shoot them in that
discipline's stance so the feet match the lesson.

## Special moves

The SHOTO drop's special-move themes, as the real movements the app teaches
(data/concepts/shoto.js), plus the owner's own specials. Each is a short
tutorial of its own: three reps facing the camera, one at 45°, one slow, one
wrong rep then the fix. The spinning and jumping moves need the most room.
On screen the cut names the real movement only, never a character or a game.

| Special | What to film |
|---|---|
| Double-hand punch (fireball theme) | both hands drive out together; push the bag back, counter as it returns |
| Fake teep to sliding elbow (demon theme) | sliding fake teep forward and back, then the rear elbow |
| Hurricane kick | the jumping spinning kick |
| Flying knee | run or step, jump, the knee drives up |
| Spinning back fist | step across, spin, the back of the fist on the turn |
| Spinning jump kick | optional |
