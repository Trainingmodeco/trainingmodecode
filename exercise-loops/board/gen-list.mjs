import fs from 'fs';
const B = JSON.parse(fs.readFileSync(new URL('./board.json', import.meta.url)));
const need = B.entries.filter((e) => e.kind !== 'new' && e.match !== 'direct' && !e.nonExercise && !e.dupOf);
const byUse = (a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name);
const tag = (e) => (e.match === 'close' ? ' [stand-in loop exists]' : '') + (e.kind !== 'mission' && e.kind !== 'program' && !e.score ? ' [not dealt by the app yet]' : '');
const line = (e) => `- ${e.name}${e.equipment ? ' (' + e.equipment + ')' : ''}${tag(e)}`;
const lib = need.filter((e) => e.kind === 'library' || e.kind === 'quick');
const prog = need.filter((e) => e.kind === 'program').sort(byUse);
const mis = need.filter((e) => e.kind === 'mission');
const out = [];
out.push('# Exercises that still need a video', '', `Made ${new Date().toISOString().slice(0, 10)} from the Exercise Loop Board data (exercises that an approved loop made from your footage shows exactly are already taken off). Strike, kick and cardio-machine moves are left out (Practice Mode covers them), and moves listed under two names appear once. ${need.length} in total: ${lib.length} library and Quick Mission exercises, ${prog.length} moves the Programs show that are not in the library, ${mis.length} Loadout mission moves.`, '');
out.push('How to read it: "most used first" is how often the app puts the move in front of a person (programs count most, then Quick Mission, then the Workout Builder). A move marked [stand-in loop exists] already has a close variation animated, so it can wait. A move marked [not dealt by the app yet] is in the library but no generator picks it today, so film it last.', '');
const top = lib.filter((e) => e.score).sort(byUse).slice(0, 40);
out.push('## Film these first (40 most used library and Quick Mission moves)', '', ...top.map((e, i) => `${i + 1}. ${e.name} (${e.group}, ${e.equipment || '—'})${e.match === 'close' ? ' [stand-in loop exists]' : ''}`), '');
out.push(`## Programs show these but the library does not have them (top ${prog.length})`, '', ...prog.map((e) => `- ${e.name}`), '');
out.push('## Library and Quick Mission, by muscle group', '');
const groups = [...new Set(lib.map((e) => e.group))].sort();
for (const g of groups) { const items = lib.filter((e) => e.group === g).sort(byUse); out.push(`### ${g} (${items.length})`, '', ...items.map(line), ''); }
out.push('## Loadout mission moves', '', 'Mostly fight and conditioning moves (strikes, kicks, bag work, runs). Practice Mode already covers strikes, so check this list before filming anything from it.', '');
const mg = [...new Set(mis.map((e) => e.group))].sort();
for (const g of mg) { const items = mis.filter((e) => e.group === g).sort((a, b) => a.name.localeCompare(b.name)); out.push(`### ${g} (${items.length})`, '', ...items.map(line), ''); }
fs.writeFileSync(new URL('../exercises-to-submit.md', import.meta.url), out.join('\n'));
console.log(need.length, lib.length, prog.length, mis.length, top.length);
