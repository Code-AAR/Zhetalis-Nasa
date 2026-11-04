// Snapshot real NASA space-weather events into game/data/donki.json.
// Run:  node scripts/fetch-nasa-data.mjs
// Uses NASA_API_KEY from .env (never committed). The game then works offline and
// labels this data as "archived", as the challenge brief asks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => l.split(/=(.*)/s).slice(0, 2)));
const KEY = env.NASA_API_KEY || 'DEMO_KEY';

const end = new Date();
const start = new Date(end); start.setFullYear(end.getFullYear() - 2);
const iso = d => d.toISOString().slice(0, 10);

async function get(kind) {
  const urls = [
    `https://api.nasa.gov/DONKI/${kind}?startDate=${iso(start)}&endDate=${iso(end)}&api_key=${KEY}`,
    `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${kind}?startDate=${iso(start)}&endDate=${iso(end)}`,
  ];
  for (const url of urls) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        console.log(`${kind}: ${data.length} events from ${new URL(url).host}`);
        return data;
      } catch (e) {
        console.log(`${kind}: attempt ${attempt} via ${new URL(url).host} failed (${e.message})`);
        await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    }
  }
  throw new Error(`could not download ${kind}`);
}

const flares = (await get('FLR')).map(f => ({
  id: f.flrID, time: f.peakTime || f.beginTime, class: f.classType, region: f.activeRegionNum ?? null,
  link: f.link,
}));
const radiation = (await get('SEP')).map(s => ({
  id: s.sepID, time: s.eventTime, instruments: (s.instruments || []).map(i => i.displayName), link: s.link,
}));
const storms = (await get('GST')).map(g => ({
  id: g.gstID, time: g.startTime, maxKp: Math.max(0, ...(g.allKpIndex || []).map(k => k.kpIndex)), link: g.link,
}));

mkdirSync(new URL('../game/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../game/data/donki.json', import.meta.url), JSON.stringify({
  source: 'NASA DONKI - Space Weather Database Of Notifications, Knowledge, Information (CCMC, NASA GSFC)',
  sourceUrl: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  fetched: new Date().toISOString(), range: [iso(start), iso(end)],
  flares, radiation, storms,
}, null, 1));
console.log('saved game/data/donki.json');
