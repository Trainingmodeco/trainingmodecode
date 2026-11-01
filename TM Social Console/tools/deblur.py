#!/usr/bin/env python3
"""Deblur soft-focus footage: Richardson-Lucy deconvolution on the luma.

For a clip that is evenly soft (a missed focus, not motion blur): the blur is
modelled as a Gaussian of --sigma pixels and undone iteratively, on the
brightness channel only (colour stays as shot, so no fringing). Then a light
denoise, an upscale to 1080×1920 and a touch of adaptive sharpening. Audio is
kept. Writes <clip>.deblur.mp4.

  python tools/deblur.py raw-footage/clip.mp4 [--sigma 2.0] [--iters 12]
                         [--from 0] [--to 10] [--workers 4] [--no-upscale]

Pick sigma on one frame first: too low does little, too high rings (halos
around edges). 1.6–2.4 suited a 720p phone clip that missed focus.
"""
import argparse
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import cv2
import numpy as np

_F = {}


def _init(h, w, sigma, iters):
    k = cv2.getGaussianKernel(int(sigma * 6) | 1, sigma)
    psf = (k @ k.T).astype(np.float32)
    ph, pw = psf.shape
    P = np.zeros((h, w), np.float32)
    P[:ph, :pw] = psf
    P = np.roll(P, (-(ph // 2), -(pw // 2)), axis=(0, 1))
    F = np.fft.rfft2(P)
    _F.update(F=F, Fc=np.conj(F), iters=iters, shape=(h, w))


def _deblur(frame_bytes):
    h, w = _F['shape']
    img = np.frombuffer(frame_bytes, np.uint8).reshape(h, w, 3)
    ycc = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    d = ycc[:, :, 0].astype(np.float32) / 255 + 1e-3
    est = d.copy()
    F, Fc = _F['F'], _F['Fc']
    for _ in range(_F['iters']):
        conv = np.fft.irfft2(np.fft.rfft2(est) * F, s=(h, w))
        est *= np.fft.irfft2(np.fft.rfft2(d / np.maximum(conv, 1e-4)) * Fc, s=(h, w))
    ycc[:, :, 0] = np.clip(est * 255, 0, 255).astype(np.uint8)
    return cv2.cvtColor(ycc, cv2.COLOR_YCrCb2BGR).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--sigma', type=float, default=2.0)
    ap.add_argument('--iters', type=int, default=12)
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--no-upscale', action='store_true')
    a = ap.parse_args()
    src = Path(a.clip)
    out = src.with_name(src.stem + '.deblur.mp4')

    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', str(src)], capture_output=True, text=True).stdout.strip().split(',')
    w, h, fps = int(probe[0]), int(probe[1]), probe[2]
    cut = ['-ss', str(a.t0)] + (['-to', str(a.t1)] if a.t1 is not None else [])
    dec = subprocess.Popen(['ffmpeg', '-v', 'error'] + cut + ['-i', str(src), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    post = 'hqdn3d=1.2:1:2:2' + ('' if a.no_upscale else ',scale=1080:1920:flags=lanczos,cas=0.45')
    enc = subprocess.Popen(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', fps, '-i', '-'] + cut + ['-i', str(src),
         '-map', '0:v', '-map', '1:a?', '-vf', post, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
         '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', str(out)],
        stdin=subprocess.PIPE,
    )
    size = w * h * 3

    def frames():
        while True:
            b = dec.stdout.read(size)
            if len(b) < size:
                return
            yield b

    n = 0
    with Pool(a.workers, initializer=_init, initargs=(h, w, a.sigma, a.iters)) as pool:
        for fb in pool.imap(_deblur, frames(), chunksize=4):
            enc.stdin.write(fb)
            n += 1
            if n % 120 == 0:
                print(f'  {n} frames', flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit('ffmpeg failed')
    print(f'{src.name}: {n} frames deblurred (sigma {a.sigma}, {a.iters} iterations) -> {out}')


if __name__ == '__main__':
    sys.exit(main())
