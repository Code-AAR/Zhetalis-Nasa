// Walkable lunar terrain: measured 5 m NASA LOLA regional relief, plus explicitly synthetic
// training craters, pad and fine regolith. Static data is ready before spawn/collisions.
// Pure maths/data: no browser globals, fetch, Three.js or runtime height switching.
import { WORLD, SITES, CHUNKS_PER_SIDE } from './config.js';
import { measuredHeightAt } from './measured-region.js';
export { measuredHeightAt, TERRAIN_SOURCE } from './measured-region.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); }
function hash(x, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, z) {   // smooth value noise
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.27 + noise(x * 4.3, z * 4.3) * 0.13 + noise(x * 9.1, z * 9.1) * 0.05;

// Crater list: power-law sizes. Kept clear of the landing pad so the base sits on flat-ish ground.
const BIG = { ...SITES.iceCrater, rim: 3.2, flat: 0.55, fresh: 1 };
export const CRATERS = (() => {
  const r = rng(20261108), list = [BIG], edge = WORLD.half + 120;
  for (let i = 0; i < 520; i++) {
    const radius = 1.2 * Math.pow(1 - r() * 0.985, -0.9);   // most 1-6 m, a few 30-60 m
    const x = (r() * 2 - 1) * edge, z = (r() * 2 - 1) * edge;
    if (Math.hypot(x, z) < 34 + radius * 1.6) continue;
    if (Math.hypot(x - BIG.x, z - BIG.z) < BIG.r * 0.9 + radius && radius > 6) continue;
    const fresh = r();
    list.push({ x, z, r: Math.min(radius, 60), depth: Math.min(radius, 60) * (0.14 + 0.08 * fresh), rim: Math.min(radius, 60) * 0.04 * (0.4 + fresh), flat: radius > 25 ? 0.35 : 0, fresh });
  }
  return list;
})();
// Spatial index: 40 m cells, each lists craters whose influence (3 radii) touches it.
const CELL = 40, index = new Map();
for (const c of CRATERS) {
  const reach = c.r * 3;
  for (let gx = Math.floor((c.x - reach) / CELL); gx <= Math.floor((c.x + reach) / CELL); gx++)
    for (let gz = Math.floor((c.z - reach) / CELL); gz <= Math.floor((c.z + reach) / CELL); gz++) {
      const k = gx + ',' + gz; if (!index.has(k)) index.set(k, []); index.get(k).push(c);
    }
}

function craterShape(c, d) {
  const q = d / c.r;
  if (q >= 3) return 0;
  if (q < 1) {
    const bowl = (c.depth + c.rim) * q * q - c.depth;
    return c.flat ? Math.max(bowl, -c.depth * (1 - c.flat * 0.5)) : bowl;
  }
  const t = (q - 1) / 2;   // ejecta blanket falls off and fades out by 3 radii
  return c.rim * Math.pow(q, -3) * (1 - t * t * (3 - 2 * t));
}

// Ground height (metres) at x, z. Deterministic: same input, same output, on every device.
export function heightAt(x, z) {
  const d0 = Math.hypot(x, z);
  // The entire playable square is within the measured patch. Outside it, only the
  // decorative horizon uses the old procedural continuation (blend beyond 600 m).
  const measured = measuredHeightAt(x, z), edge = Math.max(Math.abs(x), Math.abs(z));
  const blend = Math.max(0, Math.min(1, (edge - 600) / 200));
  const fade = blend * blend * (3 - 2 * blend);
  const outer = measured === null || fade > 0 ? 14 * Math.exp(-((d0 / 520) ** 2)) - 6 + (fbm(x / 140, z / 140) - 0.5) * 10 : 0;
  let h = measured === null ? outer : measured * (1 - fade) + outer * fade;
  // Synthetic landing pad blends to measured relief over 24–70 m; no height scaling.
  const pad = Math.max(0, Math.min(1, (d0 - 24) / 46));
  h *= pad * pad * (3 - 2 * pad);
  h += (fbm(x / 22, z / 22) - 0.5) * 1.1 + (noise(x / 2.3, z / 2.3) - 0.5) * 0.12;
  const list = index.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
  if (list) for (const c of list) {
    const dx=x-c.x, dz=z-c.z, d2=dx*dx+dz*dz;
    if(d2 < 9*c.r*c.r) h += craterShape(c, Math.sqrt(d2));
  }
  return h;
}

export function normalAt(x, z, e = 0.4) {
  const nx = heightAt(x - e, z) - heightAt(x + e, z), nz = heightAt(x, z - e) - heightAt(x, z + e), ny = 2 * e;
  const l = Math.hypot(nx, ny, nz); return { x: nx / l, y: ny / l, z: nz / l };
}

// 1 on the floor of the ice crater (never sunlit), fading to 0 up its walls.
export function permanentShadow(x, z) {
  const q = Math.hypot(x - BIG.x, z - BIG.z) / BIG.r;
  return q >= 0.95 ? 0 : q <= 0.6 ? 1 : 1 - (q - 0.6) / 0.35;
}

export const inWorld = (x, z, margin = 0) => Math.abs(x) <= WORLD.half - margin && Math.abs(z) <= WORLD.half - margin;
export function clampToWorld(p, margin = 4) {
  const m = WORLD.half - margin; let hit = false;
  if (p.x > m) { p.x = m; hit = true; } if (p.x < -m) { p.x = -m; hit = true; }
  if (p.z > m) { p.z = m; hit = true; } if (p.z < -m) { p.z = -m; hit = true; }
  return hit;
}

// Bounded residency planner: which detailed chunks should exist around (x, z). Never more than
// (2r+1)^2 chunks and never outside the world, whatever the input (NaN, huge numbers...).
export const MINIMAP_SPAN = 240;
export function chunkPlan(x, z, radius = WORLD.detailRadius) {
  const n0 = CHUNKS_PER_SIDE, S = WORLD.chunk;
  if (radius === 'map') {
    // Every chunk whose square touches the minimap's 120 m circle (AABB vs circle), like the shared Mars planner.
    const px = Number.isFinite(x) ? Math.max(-WORLD.half, Math.min(WORLD.half, x)) : 0, pz = Number.isFinite(z) ? Math.max(-WORLD.half, Math.min(WORLD.half, z)) : 0, r = MINIMAP_SPAN / 2, out = [];
    const lo = v => Math.max(0, Math.floor((v - r + WORLD.half) / S) - 1);
    const hi = v => Math.min(n0 - 1, Math.floor((v + r + WORLD.half) / S));
    for (let iz = lo(pz); iz <= hi(pz); iz++) for (let ix = lo(px); ix <= hi(px); ix++) {
      const left = -WORLD.half + ix * S, top = -WORLD.half + iz * S;
      const dx = Math.max(left - px, 0, px - left - S), dz = Math.max(top - pz, 0, pz - top - S);
      if (dx * dx + dz * dz <= r * r) out.push({ x: ix, z: iz, key: ix + ',' + iz, d: (left + S / 2 - px) ** 2 + (top + S / 2 - pz) ** 2 });
    }
    return out.sort((a, b) => a.d - b.d || a.z - b.z || a.x - b.x).slice(0, MAP_CHUNK_CAP);
  }
  radius = Math.max(1, Math.min(3, Math.floor(Number(radius)) || 1));
  const n = CHUNKS_PER_SIDE, cell = v => Math.max(0, Math.min(n - 1, Math.floor(((Number.isFinite(v) ? v : 0) + WORLD.half) / WORLD.chunk)));
  const cx = cell(x), cz = cell(z), out = [];
  for (let iz = Math.max(0, cz - radius); iz <= Math.min(n - 1, cz + radius); iz++)
    for (let ix = Math.max(0, cx - radius); ix <= Math.min(n - 1, cx + radius); ix++)
      out.push({ x: ix, z: iz, key: ix + ',' + iz, d: (ix - cx) ** 2 + (iz - cz) ** 2 });
  return out.sort((a, b) => a.d - b.d || a.z - b.z || a.x - b.x);
}
// A 240 m circle can touch at most a 4x4 block of 80 m chunks.
export const MAP_CHUNK_CAP = 16;
export const chunkOrigin = (ix, iz) => ({ x: -WORLD.half + ix * WORLD.chunk, z: -WORLD.half + iz * WORLD.chunk });
