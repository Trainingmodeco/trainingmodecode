#!/usr/bin/env python3
"""Head tracking for the owner's footage.

Finds the owner's head in every frame (MediaPipe pose: nose, eyes, ears),
smooths it into a steady camera path and renders a zoomed 9:16 clip that
follows them. The templates use the tracked clip like any other footage, so
their looks (violet tone, text, HUD) stay as they are.

  python tools/track-head.py raw-footage/clip.mp4 [--zoom 1.8] [--head 0.3]
                             [--from 0] [--to 12.5] [--smooth 0.35] [--fps 30]

Writes raw-footage/clip.tracked.mp4 (1080x1920, --fps, no audio; times match
the source from --from) and clip.track.json (the head and crop per frame).
For slow motion, track a 59/60 fps clip with --fps 60: played at half speed
every frame is still a real one.
Needs: pip install mediapipe (opencv comes with it) and ffmpeg on the PATH.
The pose model downloads to models/ on first use.
"""
import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / 'models' / 'pose_landmarker_full.task'
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task'
HEAD = [0, 2, 5, 7, 8]  # nose, eyes, ears
OUT_W, OUT_H = 1080, 1920
OUT_FPS = 30


def model():
    if not MODEL.exists():
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        print(f'downloading the pose model -> {MODEL.relative_to(ROOT)}')
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    return str(MODEL)


def read_frames(path, t0, t1):
    """Frames at 30 fps between t0 and t1 (nearest source frame)."""
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames, times, i = [], [], 0
    next_t = t0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        t = i / fps
        i += 1
        if t + 0.5 / fps < next_t:
            continue
        if t1 is not None and next_t > t1:
            break
        frames.append(img)
        times.append(next_t)
        next_t += 1 / OUT_FPS
    cap.release()
    return frames, times


def find_heads(frames):
    """Head centre (x, y in 0-1) per frame, or None where no head is seen."""
    opts = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model()),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )
    heads = []
    with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as pose:
        for k, img in enumerate(frames):
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = pose.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(k * 1000 / OUT_FPS))
            pts = []
            if res.pose_landmarks:
                lm = res.pose_landmarks[0]
                pts = [(lm[j].x, lm[j].y) for j in HEAD if (lm[j].visibility or 0) > 0.5]
            heads.append(tuple(np.mean(pts, axis=0)) if pts else None)
    return heads


def smooth(values, sigma_frames):
    """Fill gaps, then a zero-lag Gaussian blur: a steady camera, no jitter."""
    v = np.array([np.nan if x is None else x for x in values], dtype=float)
    idx = np.arange(len(v))
    good = ~np.isnan(v)
    if not good.any():
        raise SystemExit('no head found in this clip')
    v = np.interp(idx, idx[good], v[good])
    r = max(1, int(sigma_frames * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_frames) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(v, r, mode='edge'), k, mode='valid')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--zoom', type=float, default=1.8, help='1 = the full frame')
    ap.add_argument('--head', type=float, default=0.3, help='where the head sits, from the top of the frame (0-1)')
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--smooth', type=float, default=0.35, help='camera smoothing, seconds')
    ap.add_argument('--fps', type=int, default=30, help='output frame rate (60 for smooth slow motion)')
    a = ap.parse_args()
    global OUT_FPS
    OUT_FPS = a.fps

    src = Path(a.clip)
    frames, times = read_frames(src, a.t0, a.t1)
    if not frames:
        raise SystemExit(f'no frames read from {src}')
    h, w = frames[0].shape[:2]
    heads = find_heads(frames)
    seen = sum(x is not None for x in heads)
    print(f'{src.name}: {len(frames)} frames, head found in {seen} ({100 * seen // len(frames)}%)')

    s = a.smooth * OUT_FPS
    hx = smooth([p and p[0] for p in heads], s)
    hy = smooth([p and p[1] for p in heads], s * 1.4)  # steadier up and down

    # A 9:16 window `zoom` times smaller than the frame (cropped to 9:16 first
    # if the clip isn't vertical), placed so the head sits at `head` from the
    # top and centred across, kept inside the frame.
    base_w, base_h = (w, w * 16 / 9) if w * 16 / 9 <= h else (h * 9 / 16, h)
    cw, ch = base_w / a.zoom, base_h / a.zoom
    out = src.with_name(src.stem + '.tracked.mp4')
    enc = subprocess.Popen(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUT_W}x{OUT_H}',
         '-r', str(OUT_FPS), '-i', '-', '-vf', 'unsharp=5:5:0.5', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium',
         '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', str(out)],
        stdin=subprocess.PIPE,
    )
    track = []
    for img, t, x, y in zip(frames, times, hx, hy):
        x0 = float(np.clip(x * w - cw / 2, 0, w - cw))
        y0 = float(np.clip(y * h - ch * a.head, 0, h - ch))
        M = np.array([[OUT_W / cw, 0, -x0 * OUT_W / cw], [0, OUT_H / ch, -y0 * OUT_H / ch]])
        enc.stdin.write(cv2.warpAffine(img, M, (OUT_W, OUT_H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).tobytes())
        track.append({'t': round(t, 3), 'head': [round(x, 4), round(y, 4)], 'crop': [round(x0), round(y0), round(cw), round(ch)]})
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit('ffmpeg failed')
    meta = {'source': src.name, 'from': a.t0, 'fps': OUT_FPS, 'zoom': a.zoom, 'head': a.head, 'smooth': a.smooth, 'frames': track}
    src.with_name(src.stem + '.track.json').write_text(json.dumps(meta))
    print(f'-> {out}  (times match the source from {a.t0}s)')


if __name__ == '__main__':
    sys.exit(main())
