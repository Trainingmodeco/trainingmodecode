// Builds the stand-in files the smoke test serves at /_blob/<id>: contact strips (8 frames in a row), small previews and one finished loop.
// They are cut from the loops already in test/loops, padded to look like phone footage (one upright, one sideways). Run: node make-blobs.cjs
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'blobs');
const bid = (s) => (s + '0'.repeat(32)).slice(0, 32);
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y'].concat(args));
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
fs.mkdirSync(OUT, { recursive: true });
const src = (n) => path.join(__dirname, 'loops', n + '.mp4');
// name, source loop, frame size of the pretend footage
const clips = [['P', 'alligator-push-ups', 360, 640], ['L', 'squats', 640, 360]];
for (const [tag, loop, w, h] of clips) {
  const f = src(loop), d = dur(f), side = Math.min(w, h);
  const pad = `scale=${side}:${side},pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x24202E`;
  ff(['-i', f, '-vf', `${pad},scale=${w / 2}:${h / 2}`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-movflags', '+faststart', path.join(OUT, bid('preview' + tag) + '.mp4')]);
  ff(['-i', f, '-vf', `${pad},fps=8/${d.toFixed(3)},scale=${Math.round(w / 2.25)}:${Math.round(h / 2.25)},tile=8x1`, '-frames:v', '1', '-q:v', '4', path.join(OUT, bid('strip' + tag) + '.jpg')]);
}
fs.copyFileSync(src('pistol-squats'), path.join(OUT, bid('loopA') + '.mp4'));
fs.copyFileSync(src('narrow-squats'), path.join(OUT, bid('loopB') + '.mp4'));
console.log(fs.readdirSync(OUT).map((n) => n + ' ' + fs.statSync(path.join(OUT, n)).size).join('\n'));
