// Real space weather for the game.
// 1. Try NOAA SWPC live feeds (GOES satellites) - no key needed, works from the browser.
// 2. Fall back to the snapshot saved by scripts/snapshot-noaa.mjs (clearly labelled "archived").
// 3. If scripts/fetch-nasa-data.mjs managed to save NASA DONKI events, use those for history.

const LIVE = {
  flares: 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json',
  protons: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json',
  scales: 'https://services.swpc.noaa.gov/products/noaa-scales.json',
};

async function getJSON(url, ms = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  return res.json();
}

// Flare class -> storm strength. C = small, M = medium (10x C), X = big (10x M).
export function flareStrength(cls) {
  if (!cls) return 0.5;
  const letter = cls[0].toUpperCase();
  const n = parseFloat(cls.slice(1)) || 1;
  if (letter === 'X') return Math.min(3, 2 + n / 10);
  if (letter === 'M') return 1 + n / 10;
  if (letter === 'C') return 0.4 + n / 20;
  return 0.3;
}

export function flareWords(cls) {
  const l = (cls || '?')[0].toUpperCase();
  return { X: 'a huge X-class flare (the biggest kind)', M: 'a medium M-class flare', C: 'a small C-class flare' }[l] || 'a tiny flare';
}

export async function loadSpaceWeather() {
  const out = { mode: 'archived', fetched: null, flares: [], protonFlux: null, scales: null, donki: null, sources: [] };
  try {
    const [flares, protons, scales] = await Promise.all([getJSON(LIVE.flares), getJSON(LIVE.protons), getJSON(LIVE.scales)]);
    Object.assign(out, { mode: 'live', fetched: new Date().toISOString(), flares, scales });
    const tenMeV = protons.filter(p => p.energy === '>=10 MeV');
    out.protonFlux = tenMeV.length ? tenMeV[tenMeV.length - 1].flux : null;
  } catch (e) {
    console.warn('NOAA live data unavailable, using the saved snapshot', e);
    try {
      const snap = await getJSON('data/space-weather-snapshot.json');
      Object.assign(out, { mode: 'archived', fetched: snap.fetched, flares: snap.flares, scales: snap.scales });
      out.protonFlux = snap.protons.length ? snap.protons[snap.protons.length - 1].flux : null;
    } catch { /* no data at all - the game still runs, it just says so */ }
  }
  out.sources.push({ name: 'NOAA Space Weather Prediction Center (GOES satellites)', url: 'https://www.swpc.noaa.gov/',
    note: out.mode === 'live' ? 'Live - loaded when you started the game' : 'Archived snapshot from ' + (out.fetched || 'unknown date').slice(0, 10) });
  try {
    const archive = await getJSON('data/donki.json', 4000);
    if (archive.mode === 'unavailable') {
      out.sources.push({ name: 'NASA DONKI space weather database', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/', note: 'NASA archive unavailable; Mars uses the separately labelled NOAA feed or snapshot.' });
    } else if (Array.isArray(archive.range)) {
      out.donki = archive;
      out.sources.push({ name: 'NASA DONKI space weather database', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/', note: `Archived real events, ${archive.range[0]} to ${archive.range[1]}` });
    }
  } catch { /* DONKI snapshot not available yet */ }
  return out;
}

// The biggest flare in the data, for the "what is the Sun doing right now" panel.
export function sunToday(sw) {
  const ranked = [...sw.flares].filter(f => f.max_class).sort((a, b) => flareStrength(b.max_class) - flareStrength(a.max_class));
  const top = ranked[0];
  const radiationStorm = sw.scales ? sw.scales['0']?.S?.Scale : null;
  return {
    biggest: top ? { cls: top.max_class, time: top.max_time } : null,
    count: sw.flares.length,
    protonFlux: sw.protonFlux,
    radiationStorm,
    mode: sw.mode,
  };
}

// Pick a real flare to base an in-game solar storm on. Bigger flares are picked more often.
export function pickStormEvent(sw, rng = Math.random) {
  let pool = [];
  if (sw.donki?.flares?.length) pool = sw.donki.flares.map(f => ({ cls: f.class, time: f.time, source: 'NASA DONKI', link: f.link }));
  if (!pool.length) pool = sw.flares.filter(f => f.max_class).map(f => ({ cls: f.max_class, time: f.max_time, source: 'NOAA GOES' }));
  if (!pool.length) return { cls: 'M2.0', time: null, source: null, real: false };
  const weights = pool.map(p => flareStrength(p.cls) ** 2);
  let pick = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { pick -= weights[i]; if (pick <= 0) return { ...pool[i], real: true }; }
  return { ...pool[pool.length - 1], real: true };
}
