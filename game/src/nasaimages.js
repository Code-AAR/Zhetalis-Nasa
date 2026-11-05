// Real NASA pictures, loaded live in the browser (no API key needed, so nothing secret is in the website):
//  - Perseverance raw images feed: the newest colour photos the rover took on Mars
//  - EPIC (DSCOVR satellite): today's photo of the whole Earth
//  - Mars Trek: NASA's global Mars map (Viking orbiter colour mosaic) for the globe
// If a live request fails, we fall back to data/nasa-images-snapshot.json (saved by
// scripts/snapshot-nasa-images.mjs) and label it ARCHIVED.

let snapshot;
async function getSnapshot() {
  if (!snapshot) snapshot = fetch('data/nasa-images-snapshot.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return snapshot;
}
const timeout = ms => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

// Newest colour (Mastcam-Z) photos from Perseverance.
let roverPhotos;
export function loadRoverPhotos() {
  roverPhotos ??= (async () => {
    const url = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=60&extended=sample_type::full,';
    for (let attempt = 0; attempt < 2; attempt++) {   // NASA's server sometimes hiccups - try twice
      try {
        const d = await (await fetch(url, { signal: timeout(12000) })).json();
        const photos = pickRoverPhotos(d.images || []);
        if (photos.length) return { mode: 'live', photos };
      } catch { await new Promise(r => setTimeout(r, 1500)); }
    }
    const s = await getSnapshot();
    return { mode: 'archived', photos: s.rover || [] };
  })();
  return roverPhotos;
}

// Keep colour frames from the left Mastcam-Z only (the right one takes a near-copy for 3D), and skip
// frames shot within a minute of the last one, so the slideshow isn't 20 copies of one rock.
export function pickRoverPhotos(images) {
  const out = [];
  let last = Infinity;
  for (const i of images) {
    if (!/RGB/.test(i.camera?.filter_name || '') || i.camera?.instrument !== 'MCZ_LEFT' || !i.image_files?.large) continue;
    const t = Date.parse(i.date_taken_utc + 'Z');
    if (Math.abs(last - t) < 60000) continue;
    last = t;
    out.push({ src: i.image_files.large, sol: i.sol, when: i.date_taken_utc, camera: 'Mastcam-Z camera', link: i.link });
    if (out.length >= 12) break;
  }
  return out;
}

// Today's whole-Earth photo from NASA's EPIC camera, 1.5 million km away on the DSCOVR satellite.
let earth;
export function loadEarthToday() {
  earth ??= (async () => {
    try {
      const list = await (await fetch('https://epic.gsfc.nasa.gov/api/natural', { signal: timeout(12000) })).json();
      const e = list[Math.floor(list.length / 2)] || list[0];
      if (e) return { mode: 'live', ...epicPhoto(e) };
    } catch { /* fall back */ }
    const s = await getSnapshot();
    return s.earth ? { mode: 'archived', ...s.earth } : null;
  })();
  return earth;
}
export function epicPhoto(e) {
  const [y, m, d] = e.date.slice(0, 10).split('-');
  return { src: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${e.image}.jpg`, when: e.date };
}

// NASA Mars Trek map tiles (Viking colour mosaic). Zoom level 2 is 8 x 4 tiles of 256 px = one 2048 x 1024 world map.
let globe;
export function loadMarsMap() {
  globe ??= new Promise(resolve => {
    const cols = 8, rows = 4, size = 256;
    const canvas = document.createElement('canvas'); canvas.width = cols * size; canvas.height = rows * size;
    const g = canvas.getContext('2d'); g.fillStyle = '#b5643c'; g.fillRect(0, 0, canvas.width, canvas.height);
    let left = cols * rows, ok = 0;
    const done = () => { if (--left === 0) resolve({ canvas, ok: ok > cols * rows / 2 }); };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { g.drawImage(img, x * size, y * size); ok++; done(); };
      img.onerror = done;
      img.src = `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/${y}/${x}.jpg`;
    }
    setTimeout(() => left > 0 && resolve({ canvas, ok: ok > cols * rows / 2 }), 15000);
  });
  return globe;
}

export const dateWords = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
