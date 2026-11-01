#!/usr/bin/env python3
"""Body landmarks for a clip, for the Practice tutorial's markers.

MediaPipe pose on every frame; writes <clip>.pose.json:
  { "fps": 30, "width", "height", "frames": [ { "t": 0.0, "nose": [x, y], "lsho": …, … }, … ] }
x and y are fractions of the frame (0–1). Keys: nose, lsho, rsho, lelb, relb,
lwri, rwri, lhip, rhip, lkne, rkne, lank, rank, lheel, rheel. A missing
landmark is null. Also prints, per second, how far each wrist and ankle
reaches from the hips, which is how a strike's extension frame is found.

  python tools/pose.py raw-footage/practice/p7.mp4 [--from 0] [--to 7.5]
"""
import argparse
import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / 'models' / 'pose_landmarker_full.task'
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
KEYS = {
    'nose': 0, 'lsho': 11, 'rsho': 12, 'lelb': 13, 'relb': 14, 'lwri': 15, 'rwri': 16,
    'lhip': 23, 'rhip': 24, 'lkne': 25, 'rkne': 26, 'lank': 27, 'rank': 28, 'lheel': 29, 'rheel': 30,
}
FPS = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    a = ap.parse_args()
    if not MODEL.exists():
        import urllib.request
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL)

    src = Path(a.clip)
    cap = cv2.VideoCapture(str(src))
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    opts = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )
    frames, i, next_t = [], 0, a.t0
    with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as pose:
        while True:
            ok, img = cap.read()
            if not ok:
                break
            t = i / fps
            i += 1
            if t + 0.5 / fps < next_t:
                continue
            if a.t1 is not None and next_t > a.t1:
                break
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = pose.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(len(frames) * 1000 / FPS))
            row = {'t': round(next_t, 3)}
            lm = res.pose_landmarks[0] if res.pose_landmarks else None
            for k, j in KEYS.items():
                p = lm[j] if lm else None
                row[k] = [round(p.x, 4), round(p.y, 4)] if p and (p.visibility or 0) > 0.4 else None
            frames.append(row)
            next_t += 1 / FPS
    cap.release()
    out = src.with_name(src.stem + '.pose.json')
    out.write_text(json.dumps({'fps': FPS, 'width': w, 'height': h, 'frames': frames}))
    seen = sum(f['nose'] is not None for f in frames)
    print(f'{src.name}: {len(frames)} frames, body found in {seen} -> {out.name}')

    # Reach of each hand and foot from the hip centre, every 0.1 s: a strike's
    # extension frame is a peak in its line.
    def reach(f, k):
        if not f[k] or not f['lhip'] or not f['rhip']:
            return None
        hx, hy = (f['lhip'][0] + f['rhip'][0]) / 2, (f['lhip'][1] + f['rhip'][1]) / 2
        return ((f[k][0] - hx) ** 2 + ((f[k][1] - hy) * h / w) ** 2) ** 0.5
    print('   t   Lhand Rhand Lfoot Rfoot')
    for f in frames[::3]:
        vals = [reach(f, k) for k in ('lwri', 'rwri', 'lank', 'rank')]
        print(f'{f["t"]:5.2f} ' + ' '.join(f'{v:5.2f}' if v is not None else '    -' for v in vals))


if __name__ == '__main__':
    sys.exit(main())
