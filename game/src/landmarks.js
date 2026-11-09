import { SITES } from './site-data.js';
// Real Gusev crater landmarks, ENLARGED so you can see and walk to them. In reality they are tiny at this map scale:
// the game squeezes 240 km into 960 m, so Columbia Hills (about 3 to 4 km from Spirit's landing site) would be under
// 15 m away and Bonneville crater (210 m wide) would be under a metre across. They keep their real direction from the
// landing site (east is +x, north is -z), but sit further out and are drawn bigger. Heights are illustrative,
// not measured. The measured MOLA ground underneath is unchanged.
export const LANDMARKS = [
  { id: 'husband', name: 'Husband Hill', kind: 'hill', x: 180, z: 168, r: 70, h: 30,
    tip: 'Husband Hill, in the Columbia Hills. Spirit climbed it in 2005. In real life it is about 3 km south-east of the landing site. Here it is enlarged.' },
  { id: 'mccool', name: 'McCool Hill', kind: 'hill', x: 120, z: 248, r: 56, h: 20,
    tip: 'McCool Hill, another of the Columbia Hills, named after astronaut William McCool. Enlarged for the game.' },
  { id: 'bonneville', name: 'Bonneville crater', kind: 'crater', x: 144, z: 21, r: 22, depth: 5.5, rim: 1.6,
    tip: 'Bonneville crater. Spirit reached it in 2004. In real life it is 210 m wide, 14 m deep and a few hundred metres from the lander. Enlarged here.' },
  { id: 'missoula', name: 'Missoula crater', kind: 'crater', x: 268, z: -30, r: 14, depth: 4.5, rim: 1.2,
    tip: 'Missoula crater. Spirit reached it on sol 105. In real life it is about 90 m wide and 18 m deep. Enlarged here.' },
  { id: 'lahontan', name: 'Lahontan crater', kind: 'crater', x: 380, z: 150, r: 9, depth: 3, rim: .8,
    tip: 'Lahontan crater. In real life it is about 55 m across and 9 m deep. Enlarged here.' },
  { id: 'tennessee', name: 'Tennessee Valley', kind: 'valley', x: 225, z: 122, r: 60, L: 62, W: 20, D: 8, ang: -.82,
    tip: 'Tennessee Valley, on the north side of Husband Hill. Spirit looked down into it from the summit in 2005 but never drove in. Here you can walk down into it.' },
  { id: 'troy', name: 'Troy', kind: 'crater', x: 215, z: 262, r: 5, depth: .9, rim: .25,
    tip: 'Troy, beside a shallow crater about 8 m wide. In 2009 Spirit broke through its crust and got stuck in soft sand.' },
  { id: 'homeplate', name: 'Home Plate', kind: 'mesa', x: 282, z: 208, r: 26, h: 4,
    tip: 'Home Plate, a flat plateau of layered rock about 80 m wide in real life. In the game it sits close to the hills.' },
];

// Extra height added to the measured ground. Zero everywhere except right around each landmark.
// world.js tells us the measured ground, so flat-topped features (Home Plate) can level the land under them.
let baseHeight = null;
export const bindBase = f => { baseHeight = f; };
export function landmarkLift(x, z) {
  let y = 0;
  for (const m of LANDMARKS) {
    const dx = x - m.x, dz = z - m.z, d2 = dx * dx + dz * dz, R = m.r * 2.2;
    if (d2 > R * R) continue;
    if (m.kind === 'hill') {
      const s = m.r / 1.6, w = Math.exp(-d2 / (2 * s * s)), hw = m.h * w;
      // Real hills are not smooth domes: long spurs and gullies down the flanks, plus ledges of harder rock where layers outcrop.
      const spur = Math.sin(x * .07 + Math.sin(z * .045) * 2.2) * Math.sin(z * .064 + Math.sin(x * .038) * 2);
      const gully = Math.sin(x * .17 + z * .11 + Math.sin(z * .09) * 1.8) * Math.sin(z * .15 - x * .08);
      y += hw + m.h * w * (.06 * (1 - 2 * Math.abs(spur)) + .015 * gully) + .12 * Math.sin(hw * 1.2) * Math.min(1, hw / 6);
    }
    else if (m.kind === 'valley') {
      // a winding trench cut into the hill's flank: deepest at the middle, tapering out at both ends, with steep walls
      const ca = Math.cos(m.ang), sa = Math.sin(m.ang), u = dx * ca + dz * sa, v0 = -dx * sa + dz * ca;
      const v = v0 - 4 * Math.sin(u * .09), a = u / m.L, b = v / m.W;
      if (Math.abs(a) < 1 && Math.abs(b) < 1.5) {
        const along = (1 - a * a) * (1 - a * a), across = b * b < 1 ? Math.pow(1 - b * b, 1.5) : 0;
        y -= m.D * along * across;
        y += .25 * Math.exp(-Math.pow((Math.abs(b) - 1.15) / .2, 2)) * along;     // low lip of spilled rock along the rim
      }
    }
    else if (m.kind === 'mesa') {
      // a flat-topped plateau: level ground at the centre's height plus h, with a wide, gentle skirt back down to the land
      const u = Math.sqrt(d2) / m.r, t = Math.min(1, Math.max(0, (u - .78) / .8)), w = 1 - t * t * (3 - 2 * t);
      const top = baseHeight ? baseHeight(m.x, m.z) + m.h : m.h;
      y += (top - (baseHeight ? baseHeight(x, z) : 0)) * w;
    }
    else { const d = Math.sqrt(d2), u = d / m.r; y += (u < 1 ? -m.depth * (1 - u * u) * (1 - u * u) : 0) + m.rim * Math.exp(-Math.pow((d - m.r * 1.04) / (m.r * .2), 2)); }
  }
  return y;
}

// Tells you what you are standing near, once per landmark.
export class LandmarkTips {
  constructor(world, onNear) {
    this.world = world; this.onNear = onNear; this.seen = new Set();
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(); };
  }
  tick() {
    const p = this.world.player?.position; if (!p) return;
    for (const m of LANDMARKS) {
      if (this.seen.has(m.id)) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) < m.r * 1.1) { this.seen.add(m.id); this.onNear(m); }
    }
  }
}

// Low wind-blown dust drifts (about a third of a metre tall, 20 m apart) lying across the plain outside the flat base
// apron. They break up the flat ground; they fade out before the base and again far from it.
export function driftLift(x, z) {
  const r = Math.hypot(x, z);
  if (r < 100 || r > 330) return 0;
  const fade = Math.min(1, (r - 100) / 50) * Math.min(1, (330 - r) / 60);
  const ax = x * .94 + z * .34, bz = -x * .34 + z * .94;                       // ridges run across the wind
  const wob = Math.sin(bz * .045 + 1.7) * 3 + Math.sin(bz * .13 + ax * .02) * 1.2;
  const crest = .5 + .5 * Math.sin((ax + wob) * Math.PI / 11);
  const patch = Math.max(0, Math.sin(x * .017 + 2.1) * Math.sin(z * .021 - .6) + .15);
  return .42 * crest * crest * Math.min(1, patch * 1.6) * fade;
}

// ---- Small craters ----------------------------------------------------------------------------------------------
// Spirit's plain is pocked with craters from a couple of metres to a few tens of metres wide: many small ones, few big.
// One crater at most per 36 m cell, at a fixed random spot, so the same ground comes out every time. They are old and
// shallow (depth about a fifth of the radius), so the rover and the astronaut can cross them.
const CRATER_CELL = 36, craterCache = new Map();
const KEEP_CLEAR = [[110, 65, 16], [-125, -75, 16], [70, -60, 26], [-65, 35, 10]];     // relay, survey drill, pad, meteorite
const hash2 = (a, b, k) => { const s = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
function craterIn(ix, iz) {
  const key = ix * 4096 + iz;
  if (craterCache.has(key)) return craterCache.get(key);
  let c = null;
  if (hash2(ix, iz, 1) > .5) {
    const x = (ix + .2 + .6 * hash2(ix, iz, 2)) * CRATER_CELL, z = (iz + .2 + .6 * hash2(ix, iz, 3)) * CRATER_CELL;
    const R = 2.5 + 9.5 * Math.pow(hash2(ix, iz, 4), 2.4), r = Math.hypot(x, z);
    let ok = r > 100 && r < 440;
    for (const [kx, kz, kr] of KEEP_CLEAR) if (Math.hypot(x - kx, z - kz) < kr + R * 1.6) ok = false;
    for (const m of LANDMARKS) if (Math.hypot(x - m.x, z - m.z) < m.r * (m.kind === 'hill' ? 1.5 : 1.7) + R) ok = false;
    for (const s of SITES) if (Math.hypot(x - s.x, z - s.z) < 14 + R * 1.6) ok = false;      // keep the stops on open ground
    if (ok) c = { x, z, R, depth: .2 * R, rim: .08 * R, fresh: hash2(ix, iz, 5) };
  }
  craterCache.set(key, c);
  return c;
}
// lift: metres added to the ground. rim: 0 to 1, how much we are on the raised rim and ejecta (rocks gather there).
// bowl: 0 to 1, how deep in the hollow we are (used to darken and dust the colour).
export const craterField = { lift: 0, rim: 0, bowl: 0 };
export function craterLift(x, z, out = craterField) {
  out.lift = 0; out.rim = 0; out.bowl = 0;
  const r = Math.hypot(x, z);
  if (r < 85 || r > 460) return 0;
  const cx = Math.floor(x / CRATER_CELL), cz = Math.floor(z / CRATER_CELL);
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
    const c = craterIn(i, j); if (!c) continue;
    const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz, reach = c.R * 2;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2), u = d / c.R;
    if (u < 1) { const q = 1 - u * u; out.lift -= c.depth * q * q; out.bowl = Math.max(out.bowl, q); }
    const ring = Math.exp(-Math.pow((d - c.R * 1.08) / (c.R * .3), 2));
    out.lift += c.rim * ring + c.rim * .35 * Math.exp(-Math.pow((d - c.R * 1.6) / (c.R * .45), 2));
    out.rim = Math.max(out.rim, Math.exp(-Math.pow((d - c.R * 1.25) / (c.R * .55), 2)));
  }
  return out.lift;
}
// How much rock lies around: more on crater rims and at the foot of the hills, in loose clumps elsewhere.
export function rockWeight(x, z, clump) {
  craterLift(x, z);
  let foot = 0;
  for (const m of LANDMARKS) if (m.kind === 'hill') { const d = Math.hypot(x - m.x, z - m.z) / m.r; foot = Math.max(foot, Math.exp(-Math.pow((d - 1.05) / .45, 2))); }
  return (.16 + .95 * craterField.rim + .7 * foot) * (.3 + 1.5 * clump);
}
