// Refresh menu imagery/data locally. NASA_API_KEY is read here only, never
// written into the static game. Run: node scripts/snapshot-menu-space.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { epicPhoto } from '../game/src/nasaimages.js';

let key = process.env.NASA_API_KEY;
try {
  key ||= readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .match(/^\s*NASA_API_KEY\s*=\s*["']?([^\s"'#]+)/m)?.[1];
} catch { /* Environment variable or public DEMO_KEY also works. */ }
key ||= 'DEMO_KEY';
const output = new URL('../game/data/menu-space-data.json', import.meta.url);
let earth = null;
for (const file of [output, new URL('../game/data/nasa-images-snapshot.json', import.meta.url)]) {
  try { earth ||= JSON.parse(readFileSync(file, 'utf8')).earth; } catch { /* First refresh. */ }
}
let refreshed = false;
try {
  const response = await fetch(`https://api.nasa.gov/EPIC/api/natural?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('NASA unavailable');
  const list = await response.json(), entry = list[Math.floor(list.length / 2)];
  if (!entry?.date || !/^[a-zA-Z0-9_]+$/.test(entry.image)) throw new Error('No EPIC image');
  earth = epicPhoto(entry); refreshed = true;
  console.log('NASA EPIC snapshot refreshed (key omitted).');
} catch {
  // Do not print fetch errors: they can contain the credential-bearing URL.
  console.log('NASA EPIC unavailable; keeping the last archived Earth record.');
}
const moonURL = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg';
const moonFile = new URL('../game/assets/moon-map.jpg', import.meta.url);
if (!existsSync(moonFile)) {
  try {
    const response = await fetch(moonURL, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Moon map unavailable');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Expected JPEG');
    writeFileSync(moonFile, bytes);
    console.log('Saved NASA SVS Moon surface map.');
  } catch { console.log('Moon map download unavailable; rerun the script to retry.'); process.exitCode = 1; }
}
// Whitelist fields so neither a local file nor an upstream response can leak a key.
const safeEarth = earth?.src?.startsWith('https://epic.gsfc.nasa.gov/archive/') ? {
  src: earth.src.split('?')[0], when: earth.when,
  centre: earth.centre ? { lat: earth.centre.lat, lon: earth.centre.lon } : null,
} : null;
const result = {
  note: 'Archived NASA imagery metadata. Globes are rendered surface maps, not live photographs. Body diameters are to scale; distances are compressed.',
  earth: safeEarth,
  sources: {
    diameters: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
    earth: 'https://epic.gsfc.nasa.gov/about/api',
    moon: 'https://svs.gsfc.nasa.gov/4720/',
    mars: 'https://github.com/nasa/NASA-3D-Resources',
  },
};
if (refreshed) result.epicFetched = new Date().toISOString();
const json = JSON.stringify(result, null, 2) + '\n';
if (key !== 'DEMO_KEY' && json.includes(key)) throw new Error('Refusing to save credentials');
writeFileSync(output, json);
console.log('Saved key-free menu data.');
