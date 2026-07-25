# ROADMAP — Camera motion tracking for shadowboxing (future / optional)

STATUS: FUTURE, NICE-TO-HAVE. Not needed for launch (user's own words: "not
needed but could help"). Captured so the idea isn't lost.

## The idea

Prop the phone on a chair/tripod facing you while shadowboxing; the front
camera tracks your movement — strikes thrown, guard position, head movement —
and feeds the same counters the accelerometer path feeds today.

## What exists today (do not confuse with this)

- `components/training-mode/hooks/useStrikeCounter.js` — accelerometer /
  device-motion strike counting (phone in hand or on the body). Already powers
  live strike counts and ghost-battle verification.
- Camera-based tracking does NOT exist anywhere in the app.

## How it would work (when the time comes)

- On-device pose estimation (e.g. MediaPipe Pose / TensorFlow.js MoveNet) —
  runs in the browser/WebView, no video ever leaves the device.
- Detect punch extension events (wrist velocity + arm extension from pose
  keypoints), slips/rolls (head keypoint lateral/vertical movement), stance.
- Feed the SAME counters as useStrikeCounter so ghosts/XP/integrity don't need
  a second pipeline; camera is an alternate input, not a new system.
- Setup UX: "prop your phone facing you" framing guide + a 3-second self-check
  (wave to confirm tracking).

## Why deferred

- Heavy: pose models add real bundle size + CPU/battery cost on mid phones.
- Accuracy at shadowboxing speeds needs tuning (fast hands blur at 30fps).
- Privacy story must be airtight (on-device only, no recording, clear copy).
- The accelerometer path already covers counting well enough for v1.

## Privacy rules (non-negotiable when built)

On-device inference only; no video stored or uploaded; camera use is opt-in
per session with a visible indicator; degrades gracefully to accelerometer.
