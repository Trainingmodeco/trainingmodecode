// Decode an audio file to mono 24 kHz float samples (needs ffmpeg on the PATH).
import { execFileSync } from 'node:child_process';

export function pcm(file) {
  const buf = execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '24000', '-f', 'f32le', '-'], { maxBuffer: 1e9 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
