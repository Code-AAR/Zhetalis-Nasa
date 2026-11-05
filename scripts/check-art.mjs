// Checks game/assets/art: every listed file exists, names match a slot, sizes are small enough for school laptops.
//   node scripts/check-art.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';

const dir = new URL('../game/assets/art/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('art.json', dir), 'utf8'));
const LIMIT_KB = { title: 350, logo: 150, icon: 60, 'mars-ground': 250 };
const limitFor = name => LIMIT_KB[name] ?? (/^badge-/.test(name) ? 120 : /^(crew-|mission-control|fact-)/.test(name) ? 80 : /^(event-|story-)/.test(name) ? 200 : null);
const base = f => f.replace(/\.[a-z0-9]+$/i, '');
const facts = Object.keys(JSON.parse(readFileSync(new URL('../game/data/mars-facts.json', import.meta.url), 'utf8')).facts);

let problems = 0;
const warn = msg => { problems++; console.log('  ✗ ' + msg); };
const present = readdirSync(dir).filter(f => !/^(art\.json|README\.md)$/.test(f));
console.log(`Listed in art.json: ${manifest.files.length} · in the folder: ${present.length}`);
for (const f of manifest.files) {
  const name = base(f);
  if (!present.includes(f)) { warn(`${f} is listed but not in the folder`); continue; }
  const kb = statSync(new URL(f, dir)).size / 1024, lim = limitFor(name);
  if (lim === null) warn(`${f}: "${name}" isn't a known slot name (see README.md)`);
  else if (kb > lim) warn(`${f}: ${kb.toFixed(0)} KB - please shrink it under ${lim} KB`);
  else console.log(`  ✓ ${f} (${kb.toFixed(0)} KB)`);
  if (name.startsWith('fact-') && !facts.includes(name.slice(5))) warn(`${f}: no fact called "${name.slice(5)}" in mars-facts.json`);
  if (!/\.(webp|png|jpe?g)$/i.test(f)) warn(`${f}: use .webp (or .png for transparency)`);
}
for (const f of present) if (!manifest.files.includes(f)) warn(`${f} is in the folder but not listed in art.json (the game won't show it)`);
for (const p of manifest.story || []) if (!manifest.files.includes(p.file)) warn(`story panel ${p.file} isn't in "files"`);
if (manifest.files.length && !manifest.credit) warn('add a "credit" line to art.json (e.g. "Illustrations made by team Zhetalis with ChatGPT image generation (AI).")');
console.log(problems ? `${problems} thing(s) to fix.` : 'All good!');
process.exitCode = problems ? 1 : 0;
