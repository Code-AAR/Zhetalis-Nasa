// Mars terrain: NASA MOLA heights + multi-scale detail + geological zones + real crater shapes.
// Scale note: the game squeezes about 237 km of Gusev into 960 m, so 1 km on Mars is about 4 m here.
//  - the "100 km" layer is the NASA MOLA data itself (it is bigger than the whole map)
//  - the "10 km" layer is ~40 m swells (Perlin noise)
//  - the "1 km" layer is ~6-8 m bumps you feel when driving (ridged Perlin noise)
// createMeasuredTerrain() stays pure NASA data so the map, charts and physics base stay true to the source.
// createTerrainDetail() adds the procedural layers; world.js adds them on top, faded out at the base and the stops.

// ---------- noise ----------
function hash(ix, iz, k = 0) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(k, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
// Value noise, 0..1 (used for broad zone masks)
function valueNoise(x, z, k = 0) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0, sx = fade(fx), sz = fade(fz);
  const a = hash(x0, z0, k), b = hash(x0 + 1, z0, k), c = hash(x0, z0 + 1, k), d = hash(x0 + 1, z0 + 1, k);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
// Perlin gradient noise, about -0.7..0.7 (used for terrain shape)
const GX = [1, -1, 1, -1, 1.41, -1.41, 0, 0], GZ = [1, 1, -1, -1, 0, 0, 1.41, -1.41];   // 8 gradient directions
function grad(ix, iz, k, dx, dz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(k + 7, 1013904223); h = Math.imul(h ^ (h >>> 15), 2246822519); const g = (h >>> 29) & 7; return GX[g] * dx + GZ[g] * dz; }
function perlin(x, z, k = 0) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0, sx = fade(fx), sz = fade(fz);
  const a = grad(x0, z0, k, fx, fz), b = grad(x0 + 1, z0, k, fx - 1, fz), c = grad(x0, z0 + 1, k, fx, fz - 1), d = grad(x0 + 1, z0 + 1, k, fx - 1, fz - 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
// createNoise2D([x, z], amplitude, octaves): fractal Perlin, roughly -amplitude..+amplitude
export function createNoise2D([x, z], baseAmplitude = 1, octaves = 1, k = 0) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += perlin(x * freq, z * freq, k + o) * amp; norm += amp; amp *= .5; freq *= 2.03; }
  return (sum / norm) * baseAmplitude * 1.4;
}
// Ridged noise: sharp crests and soft troughs, like wind-worn rock and ripple fields. 0..1
function ridged(x, z, octaves = 2, k = 0) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { const r = 1 - Math.abs(perlin(x * freq, z * freq, k + o) * 1.4); sum += r * r * amp; norm += amp; amp *= .5; freq *= 2.1; }
  return sum / norm;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- elevation colours (dark reddish-brown low, pale tan high, smooth blends) ----------
const PALETTE = [[0, [0.48, 0.29, 0.21]], [0.35, [0.62, 0.41, 0.30]], [0.7, [0.74, 0.56, 0.42]], [1, [0.80, 0.67, 0.53]]];
export function elevationColour(n) {
  n = Math.max(0, Math.min(1, n));
  for (let i = 1; i < PALETTE.length; i++) if (n <= PALETTE[i][0]) {
    const [a, ca] = PALETTE[i - 1], [b, cb] = PALETTE[i], t = smooth(0, 1, (n - a) / (b - a));
    return { r: ca[0] + (cb[0] - ca[0]) * t, g: ca[1] + (cb[1] - ca[1]) * t, b: ca[2] + (cb[2] - ca[2]) * t };
  }
  return { r: PALETTE[3][1][0], g: PALETTE[3][1][1], b: PALETTE[3][1][2] };
}
// Same palette in 0..255 (kept from the first version of this file)
export function getColorForElevation(normalized) {
  const c = elevationColour(normalized);
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
}

// ---------- real crater shape ----------
// u = distance / radius. Simple-crater profile with a raised rim and an ejecta blanket that thins as (R/d)^3 and is
// broken into rays. degradation 0 = fresh (sharp rim, bowl), 1 = old (low rim, floor filled flat with sand, rays gone).
export function craterProfile(d, R, { depth, rim, degradation = 0, angle = 0, seed = 0 }) {
  const u = d / R, deg = Math.max(0, Math.min(1, degradation)), out = { lift: 0, bowl: 0, rim: 0, ejecta: 0 };
  if (u < 1.05) { const q = Math.max(0, 1 - u * u); out.bowl = q; out.lift -= depth * Math.min(1, q * q * (1 + deg * 1.8)); }
  const rimH = rim * (1 - .45 * deg);
  out.lift += rimH * Math.exp(-Math.pow((u - 1.04) / (.16 + .1 * deg), 2));
  out.rim = Math.exp(-Math.pow((u - 1.1) / .3, 2));
  if (u > 1.04 && u < 3.2) {
    const rays = .55 + .45 * Math.pow(Math.max(0, Math.sin(angle * 9 + seed + 2 * Math.sin(angle * 3 + seed))), 2) * (1 - .6 * deg);
    const blanket = Math.pow(1.04 / u, 3) * (1 - smooth(2.4, 3.2, u));
    out.lift += rimH * .55 * blanket * rays;
    out.ejecta = blanket * rays;
  }
  return out;
}

// ---------- NASA heights (unchanged behaviour) ----------
let activeTerrain = null;
// Game height of the main NASA terrain at (x, z), or null before it has loaded.
export function elevationAt(x, z) { return activeTerrain ? activeTerrain.height(x, z) : null; }

export function createMeasuredTerrain(samples, meta) {
  const n = meta.n, span = meta.worldSpan;
  if (samples.length !== n * n) throw new Error('Invalid MOLA terrain dimensions');
  const clamp = v => Math.max(0, Math.min(n - 1, v));
  const minElevation = meta.minElevation ?? meta.minMetres, maxElevation = meta.maxElevation ?? meta.maxMetres;

  // bilinear sample of the archived MOLA grid, in metres
  function baseElevation(x, z) {
    const u = clamp((x / span + .5) * n - .5), v = clamp((z / span + .5) * n - .5);
    const x0 = Math.floor(u), z0 = Math.floor(v), x1 = Math.min(n - 1, x0 + 1), z1 = Math.min(n - 1, z0 + 1), fx = u - x0, fz = v - z0;
    const a = samples[z0 * n + x0] * (1 - fx) + samples[z0 * n + x1] * fx;
    const b = samples[z1 * n + x0] * (1 - fx) + samples[z1 * n + x1] * fx;
    return a * (1 - fz) + b * fz;
  }
  const elevation = baseElevation, origin = baseElevation(0, 0);
  // game metres, with the landing base flattened
  function height(x, z) {
    const r = Math.hypot(x, z), t = Math.max(0, Math.min(1, (r - meta.flatBaseRadius) / (meta.flatBaseBlendEnd - meta.flatBaseRadius)));
    return (baseElevation(x, z) - origin) * meta.verticalScale * t * t * (3 - 2 * t);
  }
  const normalizedElevation = (x, z) => (baseElevation(x, z) - minElevation) / (maxElevation - minElevation);
  function sample(x, z) {
    const ne = normalizedElevation(x, z);
    return { height: height(x, z), color: getColorForElevation(ne), normalizedElevation: ne };
  }
  // Elevation percentiles of this crop, so zones follow Gusev's real range (about -2.9 to +1.5 km), not Earth-style numbers.
  const sorted = Float32Array.from(samples).sort(), pct = p => sorted[Math.floor(p * (sorted.length - 1))];
  const zones = { floor: pct(.35), rim: pct(.8), lo: pct(.05), hi: pct(.95) };
  const terrain = { elevation, origin, height, sample, baseElevation, normalizedElevation, getColorForElevation, zones, meta };
  if (!activeTerrain) activeTerrain = terrain;
  return terrain;
}

// ---------- procedural detail on top of the NASA heights ----------
// The broad layers (swells and zones) are baked once into a 4 m grid, so the game only works out the small bumps live.
export function createTerrainDetail(terrain, { half = 640, cell = 4 } = {}) {
  const { zones } = terrain, n = Math.ceil(half * 2 / cell) + 1;
  const swellGrid = new Float32Array(n * n), roughGrid = new Float32Array(n * n), highGrid = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + i * cell, z = -half + j * cell, k = j * n + i;
    // Geological zones from the real elevation: 0 = crater-floor plains (smooth, dusty), 1 = rim and hills (rocky, rough)
    const hw = smooth(zones.floor, zones.rim, terrain.baseElevation(x, z));
    const p = valueNoise(x / 160 + 11, z / 160 - 5, 3);           // broad patches of plains vs. rough ground
    highGrid[k] = hw;
    roughGrid[k] = Math.max(0, Math.min(1, .25 + .9 * hw + .45 * (p - .5)));
    swellGrid[k] = createNoise2D([x / 42, z / 42], 1, 3, 101) * (.3 + 1.1 * hw);   // "10 km" layer: ~40 m swells, gentle on the crater floor, taller on the rim and hills
  }
  function lookup(g, x, z) {
    const u = Math.max(0, Math.min(n - 1.001, (x + half) / cell)), v = Math.max(0, Math.min(n - 1.001, (z + half) / cell));
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j, k = j * n + i;
    return (g[k] * (1 - fx) + g[k + 1] * fx) * (1 - fz) + (g[k + n] * (1 - fx) + g[k + n + 1] * fx) * fz;
  }
  function geologicalFeatures(x, z) {
    const hw = lookup(highGrid, x, z);
    return { highland: hw, plains: 1 - hw, roughness: lookup(roughGrid, x, z) };
  }
  // "1 km" layer: ~7 m ridged bumps, taller on rough ground. Added to the swells.
  function noiseOverlay(x, z) {
    const rough = lookup(roughGrid, x, z);
    return lookup(swellGrid, x, z) + (ridged(x / 7.5, z / 7.5, 2, 202) - .55) * .32 * (.35 + 1.1 * rough);
  }
  function calculateBumpMap(x, z) {
    const dx = noiseOverlay(x + .5, z) - noiseOverlay(x - .5, z), dz = noiseOverlay(x, z + .5) - noiseOverlay(x, z - .5);
    return Math.hypot(dx, dz);
  }
  return { detail: noiseOverlay, geologicalFeatures, calculateBumpMap, highland: (x, z) => lookup(highGrid, x, z) };
}
