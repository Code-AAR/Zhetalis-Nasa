// Snapshot real NASA lunar data for the Moon mission. Run from the repo root:
//   node game/moon/tools/fetch-moon-data.mjs
// Writes (all labelled "archived snapshot" in the game, with provenance):
//   game/data/moon-site.json           horizon profile + sunlight at a south-polar training site, computed from
//                                      NASA SVS CGI Moon Kit LOLA elevation (ldem_16_uint.tif, no key needed)
//   game/data/moon-images.json         NASA Image and Video Library picks (images-api.nasa.gov, no key needed)
//   game/moon/assets/nasa/*.jpg        small copies of those pictures so the game works offline
//   game/data/moon-space-weather.json  DONKI solar energetic particle events (api.nasa.gov with the user's key,
//                                      falling back to NASA CCMC's keyless DONKI service)
// NASA_API_KEY is read from ../.env (repo root) and used only in request URLs here. It is never printed,
// never written to any output file and never sent to the browser. Error messages print only the host name.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../../../', import.meta.url);
const out = p => new URL(p, ROOT);
let KEY = '';
try {
  const env = readFileSync(out('.env'), 'utf8');
  KEY = (env.match(/^\s*NASA_API_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1]?.trim() || '';
} catch { /* no .env: keyless services still work */ }
const today = new Date().toISOString().slice(0, 10);
const host = u => { try { return new URL(u).host; } catch { return '?'; } };

async function get(url, kind = 'json', tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'zhetalis-moon-snapshot/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return kind === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      console.log(`  ${host(url)} attempt ${i} failed (${String(e.message).replace(KEY || '\u0000', '***')})`);
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
  return null;
}

// ---------- 1. LOLA elevation → horizon + sunlight at the training site ----------
const SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/';
const DEM = 'ldem_16_uint.tif';   // 16 px/degree, uint16 half-metres above 1,727,400 m (SVS CGI Moon Kit)

function readTiff(buf) {
  const le = buf.toString('latin1', 0, 2) === 'II';
  const u16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o), u32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  const ifd = u32(4), n = u16(ifd), tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12, tag = u16(e), type = u16(e + 2), count = u32(e + 4), size = type === 3 ? 2 : 4;
    if (type !== 3 && type !== 4) continue;   // only SHORT/LONG tags are needed (sizes, offsets, format)
    const at = count * size <= 4 ? e + 8 : u32(e + 8);
    tags[tag] = Array.from({ length: count }, (_, k) => size === 2 ? u16(at + k * 2) : u32(at + k * 4));
  }
  const W = tags[256][0], H = tags[257][0], bits = tags[258]?.[0], comp = tags[259]?.[0] ?? 1;
  if (bits !== 16 || comp !== 1) throw new Error(`unsupported TIFF (bits ${bits}, compression ${comp})`);
  const px = new Uint16Array(W * H);
  if (tags[324]) {   // tiled
    const tw = tags[322][0], th = tags[323][0], across = Math.ceil(W / tw);
    tags[324].forEach((off, t) => {
      const tx = (t % across) * tw, ty = Math.floor(t / across) * th;
      for (let y = 0; y < th && ty + y < H; y++) for (let x = 0; x < tw && tx + x < W; x++) px[(ty + y) * W + tx + x] = u16(off + (y * tw + x) * 2);
    });
  } else {           // strips
    const rows = tags[278]?.[0] ?? H;
    tags[273].forEach((off, s) => { for (let k = 0; k < rows * W && s * rows * W + k < W * H; k++) px[s * rows * W + k] = u16(off + k * 2); });
  }
  return { W, H, px };
}

const R = 1737400, D2R = Math.PI / 180;
function siteData(dem) {
  const { W, H, px } = dem, ppd = W / 360;
  const metres = v => 1727400 + v / 2 - R;   // height above the 1737.4 km reference sphere
  const sample = (lat, lon) => {          // bilinear; columns start at -180 deg (SVS kit), rows at +90
    let x = ((lon + 180) % 360 + 360) % 360 * ppd - 0.5, y = (90 - lat) * ppd - 0.5;
    y = Math.max(0, Math.min(H - 1.001, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, X = i => ((i % W) + W) % W;
    const v = (i, j) => px[j * W + X(i)];
    return metres(v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy) + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy);
  };
  const dest = (lat, lon, az, d) => {    // great-circle step
    const a = d / R, p = lat * D2R, l = lon * D2R, b = az * D2R;
    const p2 = Math.asin(Math.sin(p) * Math.cos(a) + Math.cos(p) * Math.sin(a) * Math.cos(b));
    const l2 = l + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p), Math.cos(a) - Math.sin(p) * Math.sin(p2));
    return [p2 / D2R, l2 / D2R];
  };
  // Start near the Shackleton / de Gerlache connecting ridge and move to the highest point within 8 km:
  // high ground near the pole sees the low Sun for longest, which is why Artemis studies these ridges.
  const guess = [-89.45, -137.3];
  let best = { h: -1e9 };
  for (let d = 0; d <= 8000; d += 400) for (let az = 0; az < 360; az += d ? 10 : 360) {
    const [la, lo] = dest(guess[0], guess[1], az, d), h = sample(la, lo);
    if (h > best.h) best = { lat: la, lon: lo, h };
  }
  const eye = best.h + 2;   // a standing astronaut's eye
  const horizon = [];
  for (let az = 0; az < 360; az++) {
    let top = -90, at = 0;
    for (let d = 300; d < 250000; d *= 1.025) {
      const [la, lo] = dest(best.lat, best.lon, az, d), drop = d * d / (2 * R);
      const ang = Math.atan2(sample(la, lo) - drop - eye, d) / D2R;
      if (ang > top) { top = ang; at = d; }
    }
    horizon.push({ el: +top.toFixed(3), km: +(at / 1000).toFixed(1) });
  }
  // Fraction of a lunar day the Sun's centre is above the local horizon, for three Sun "seasons"
  // (the Sun's declination seen from the Moon swings about +/-1.54 deg over ~346.6 days).
  const lit = dec => {
    let up = 0; const steps = 720;
    for (let i = 0; i < steps; i++) {
      const hAng = i / steps * 360, p = best.lat * D2R, d = dec * D2R;
      const el = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(hAng * D2R)) / D2R;
      // azimuth (degrees from north, clockwise) of the Sun for this hour angle
      const az = (Math.atan2(Math.sin(hAng * D2R), Math.cos(hAng * D2R) * Math.sin(p) - Math.tan(d) * Math.cos(p)) / D2R + 180) % 360;
      if (el > horizon[Math.round(az) % 360].el) up++;
    }
    return +(up / steps).toFixed(3);
  };
  return {
    site: { lat: +best.lat.toFixed(4), lon: +best.lon.toFixed(4), heightMetres: Math.round(best.h), note: 'Highest LOLA sample within 8 km of 89.45 S, 137.3 W (Shackleton / de Gerlache connecting ridge area). A training site, not an Artemis landing site.' },
    horizon, sunlitFraction: { southernSummer: lit(-1.54), equinox: lit(0), southernWinter: lit(1.54) },
  };
}

async function site() {
  const cache = join(tmpdir(), 'zhetalis-' + DEM);
  let buf = existsSync(cache) ? readFileSync(cache) : null;
  if (!buf) { console.log('Downloading', DEM, 'from', host(SVS), '(~32 MB, keyless)'); buf = await get(SVS + DEM, 'bin'); if (buf) writeFileSync(cache, buf); }
  if (!buf) { console.log('  LOLA download failed - moon-site.json left unchanged'); return; }
  const dem = readTiff(buf);
  console.log(`  LOLA map ${dem.W}x${dem.H}`);
  const s = siteData(dem);
  writeFileSync(out('game/data/moon-site.json'), JSON.stringify({
    mode: 'archived', retrieved: today,
    source: { name: "NASA's Scientific Visualization Studio - CGI Moon Kit (LRO LOLA elevation)", url: 'https://svs.gsfc.nasa.gov/4720/', file: SVS + DEM, credit: "NASA's Scientific Visualization Studio", resolution: '16 pixels per degree (~1.9 km along a meridian). Good for the distant horizon only; the walkable 1 km area is a procedural crater field.' },
    method: 'Horizon = highest terrain angle in each compass direction out to 250 km, allowing for the Moon\'s curvature. Sunlit fraction = share of one lunar day the Sun centre clears that horizon.',
    ...s,
  }));
  console.log('  site', s.site.lat, s.site.lon, 'sunlit', JSON.stringify(s.sunlitFraction));
}

// ---------- 2. NASA Image and Video Library (keyless) ----------
const PICKS = [
  { id: 'earthset', q: 'Artemis II Earthset', why: 'Artemis II crew view of Earth setting behind the Moon' },
  { id: 'farside', q: 'Artemis II far side Moon', why: 'Artemis II crewed lunar flyby' },
  { id: 'artemis1', q: 'Artemis I Orion Moon', why: 'Artemis I uncrewed Orion at the Moon' },
  { id: 'bootprint', q: 'Apollo 11 bootprint', why: 'Regolith holds sharp prints - no wind to erase them' },
  { id: 'polar-ice', q: 'lunar south pole illumination', nasaId: 'GSFC_20171208_Archive_e000796', why: 'LRO maps hydrogen (a sign of water ice) on cold, pole-facing slopes' },
];
async function images() {
  mkdirSync(out('game/moon/assets/nasa/'), { recursive: true });
  const items = [];
  for (const p of PICKS) {
    const s = await get(`https://images-api.nasa.gov/search?q=${encodeURIComponent(p.q)}&media_type=image&page_size=12`);
    const hit = (s?.collection?.items || []).find(it => it.data?.[0] && (!p.nasaId || it.data[0].nasa_id === p.nasaId) && it.links?.some(l => l.rel === 'preview'));
    if (!hit) { console.log('  no image for', p.q); continue; }
    const d = hit.data[0], nasaId = d.nasa_id;
    const manifest = await get(`https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`);
    const hrefs = (manifest?.collection?.items || []).map(i => i.href);
    const pick = hrefs.find(h => /~medium\.jpg$/i.test(h)) || hrefs.find(h => /~small\.jpg$/i.test(h)) || hit.links.find(l => l.rel === 'preview').href;
    const bin = await get(pick.replace(/^http:/, 'https:'), 'bin');
    const file = `moon/assets/nasa/${p.id}.jpg`;
    if (bin) writeFileSync(out('game/' + file), bin);
    items.push({
      id: p.id, query: p.q, why: p.why, nasaId, title: d.title, date: d.date_created?.slice(0, 10), center: d.center,
      photographer: d.photographer || d.secondary_creator || null,
      description: String(d.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 320),
      file: bin ? file : null, remote: pick, page: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
    });
    console.log(`  image ${p.id}: ${nasaId} (${bin ? Math.round(bin.length / 1024) + ' KB' : 'not saved'})`);
  }
  writeFileSync(out('game/data/moon-images.json'), JSON.stringify({
    mode: 'archived', retrieved: today, keyRequired: false,
    source: { name: 'NASA Image and Video Library', api: 'https://images-api.nasa.gov', guidelines: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
    items,
  }, null, 1));
}

// ---------- 3. DONKI solar energetic particles (key used server-side only) ----------
async function weather() {
  const end = new Date(), start = new Date(end); start.setFullYear(end.getFullYear() - 2);
  const iso = d => d.toISOString().slice(0, 10);
  const urls = [
    ...(KEY ? [[`https://api.nasa.gov/DONKI/SEP?startDate=${iso(start)}&endDate=${iso(end)}&api_key=${KEY}`, 'api.nasa.gov (project key, server-side)']] : []),
    [`https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP?startDate=${iso(start)}&endDate=${iso(end)}`, 'kauai.ccmc.gsfc.nasa.gov (keyless)'],
  ];
  for (const [url, via] of urls) {
    const data = await get(url);
    if (!Array.isArray(data)) continue;
    const events = data.map(s => ({ id: s.sepID, time: s.eventTime, instruments: (s.instruments || []).map(i => i.displayName), link: s.link }));
    writeFileSync(out('game/data/moon-space-weather.json'), JSON.stringify({
      mode: 'archived', retrieved: today, via,
      source: { name: 'NASA DONKI - Solar Energetic Particle (SEP) events (CCMC, NASA GSFC)', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
      why: 'The Moon has no global magnetic field and almost no atmosphere, so solar particle storms reach the surface. Crews would shelter.',
      range: [iso(start), iso(end)], events,
    }, null, 1));
    console.log(`  DONKI SEP: ${events.length} events via ${via}`);
    return;
  }
  if (!existsSync(out('game/data/moon-space-weather.json')) || JSON.parse(readFileSync(out('game/data/moon-space-weather.json'), 'utf8')).mode !== 'archived') {
    writeFileSync(out('game/data/moon-space-weather.json'), JSON.stringify({ mode: 'unavailable', retrieved: null, attempted: today, source: { name: 'NASA DONKI - Solar Energetic Particle (SEP) events (CCMC, NASA GSFC)', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' }, note: 'DONKI could not be reached when this snapshot was attempted. The game runs practice drills and does not claim real events. Re-run tools/fetch-moon-data.mjs weather to fill this in.', events: [] }, null, 1));
    console.log('  DONKI unavailable - wrote an explicit unavailable placeholder (no events)');
  } else console.log('  DONKI unavailable - kept the existing archived snapshot');
}

const only = process.argv[2];
if (!only || only === 'site') { console.log('Site horizon'); await site(); }
if (!only || only === 'images') { console.log('NASA images'); await images(); }
if (!only || only === 'weather') { console.log('Space weather'); await weather(); }
console.log('Done.');
