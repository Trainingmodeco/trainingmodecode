// Put Practice tutorials into the app: the post's in-app cut (PracticeLessonApp)
// becomes a compact web video + poster in the app's public/static/practice/,
// and its URL goes into every slot the post covers (Technique Library entries
// in practiceData.js, Fundamentals Path lessons in data/practiceLessons.js).
//
//   npm run app-video -- <id> [<id> …]
//
// Slots come from the post's `app.slots`: "Muay Thai › Rear Knee" for a
// library entry, "lesson:mt_knee" for a path lesson. Without it the post's
// technique in each of its disciplines ("Kickboxing · Muay Thai · MMA").
// Netlify builds the site from public/, so the files deploy with the app and
// the browser only fetches a video when someone presses play.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.resolve(ROOT, '..');
const OUT = path.join(APP, 'public', 'static', 'practice');
const DATA = path.join(APP, 'components', 'training-mode', 'practiceData.js');
const LESSONS = path.join(APP, 'components', 'training-mode', 'data', 'practiceLessons.js');

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('usage: npm run app-video -- <post-id> [<post-id> …]');
  process.exit(1);
}

const slotsOf = (post) => post.app?.slots
  ?? post.props.discipline.split(/\s*·\s*/).map((d) => `${d} › ${post.props.technique}`);
const slugOf = (id) => id.replace(/^\d{4}-\d{2}-\d{2}-(practice-)?/, '');

let data = fs.readFileSync(DATA, 'utf8');
let lessons = fs.readFileSync(LESSONS, 'utf8');
fs.mkdirSync(OUT, { recursive: true });

for (const id of ids) {
  const file = path.join(ROOT, 'queue', `${id}.json`);
  const post = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cut = post.exports?.PracticeLessonApp;
  if (!cut?.video) throw new Error(`${id}: no in-app cut yet (npm run render -- ${id} PracticeLessonApp)`);
  const slug = slugOf(id);
  const video = path.join(OUT, `${slug}.mp4`);
  const poster = path.join(OUT, `${slug}.webp`);

  // 720p is sharp on the lesson card (~390 px wide on a phone, 440 max) at
  // ~1.6 MB for 23 s. No audio: the cut has none worth keeping, and a muted
  // video can play inline on phones.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(ROOT, cut.video), '-vf', 'scale=1280:720:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', video]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(ROOT, cut.cover), '-vf', 'scale=960:540:flags=lanczos',
    '-c:v', 'libwebp', '-quality', '72', poster]);

  const url = `/static/practice/${slug}.mp4`;
  const slots = slotsOf(post);
  for (const slot of slots) {
    if (slot.startsWith('lesson:')) {
      const lid = slot.slice('lesson:'.length);
      const re = new RegExp(`(\\{ id: '${lid}', )(videoUrl: '[^']*', )?`);
      if (!re.test(lessons)) throw new Error(`${id}: no lesson '${lid}' in practiceLessons.js`);
      lessons = lessons.replace(re, `$1videoUrl: '${url}', `);
    } else {
      const [disc, name] = slot.split(/\s*›\s*/);
      const re = new RegExp(`(discipline: '${disc}', category: '[^']*', name: '${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',\\n(?:.*\\n){0,3}?.*?videoUrl: )'[^']*'`);
      if (!re.test(data)) throw new Error(`${id}: no library entry '${slot}' in practiceData.js`);
      data = data.replace(re, `$1'${url}'`);
    }
  }
  post.app = { ...(post.app ?? {}), slots, video: url, poster: url.replace(/\.mp4$/, '.webp'), publishedAt: new Date().toISOString() };
  fs.writeFileSync(file, `${JSON.stringify(post, null, 2)}\n`);
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  console.log(`${id}: ${url} (${kb(video)} KB, poster ${kb(poster)} KB) → ${slots.join(' · ')}`);
}

fs.writeFileSync(DATA, data);
fs.writeFileSync(LESSONS, lessons);
console.log('next: npx eslint components/training-mode/practiceData.js, then commit public/static/practice and the two data files');
