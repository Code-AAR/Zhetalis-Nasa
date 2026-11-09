// The five Gusev stops, modelled from NASA photos of each place. Every stop is built in world metres around its real
// ground, so nothing floats or hangs off a slope. To keep the frame rate up, each stop is merged into a few meshes:
// one for rock (vertex colours), one for metal scraps, one for soft ground marks (tracks, scuffs, bright soil), plus
// the NASA rover. Open stop-viewer.html to look at any stop on its own.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from './nasamodels.js';
import { LANDMARKS, plateRadius } from './landmarks.js';

// ---- small helpers -------------------------------------------------------------------------------------------------
const fract = v => v - Math.floor(v);
const hash = (a, b = 0, c = 0) => fract(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), t = fz * fz * (3 - 2 * fz), L = (a, b, k) => a + (b - a) * k;
  return L(L(L(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), L(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
           L(L(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), L(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v), t);
}
const fbm = (x, y, z, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); a *= .5; f *= 2.03; } return s; };
const col = h => new THREE.Color(h);                       // sRGB hex to the renderer's linear colour
const arr = c => [c.r, c.g, c.b];
const tone = (c, k) => Array.isArray(c) ? [c[0] * k, c[1] * k, c[2] * k] : [c.r * k, c.g * k, c.b * k];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Every piece is cleaned to the same attributes (position, normal, colour, 32-bit index) so it can be merged into one mesh.
function prep(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) { const n = g.attributes.position.count, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  else if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
  return g;
}
function paint(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getY(i) : 1, i), i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const place = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s)));

const SOLID = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0 });
const CLIFF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
const METAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .25, side: THREE.DoubleSide });
const MARKS = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });

// ---- rocks ---------------------------------------------------------------------------------------------------------
// A lumpy stone: smooth broad shape, sharper small facets, flat underside. Colour darkens in hollows and gets a dust cap.
function stone(seed, { rough = .32, squash = 1, detail = 3, base = '#5b4c42', dust = '#b48a66', dustAmt = .45, knobs = 0 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, v = new THREE.Vector3(), shade = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 1.4 + seed, v.y * 1.4 + seed * .7, v.z * 1.4 - seed, 3) - .5;
    const facet = Math.abs(noise3(v.x * 4.2 + seed, v.y * 4.2, v.z * 4.2 - seed) - .5);
    const knob = knobs ? Math.pow(Math.max(0, noise3(v.x * 7 + seed, v.y * 7, v.z * 7) - .45), 2) * knobs : 0;
    const r = 1 + n * rough * 2 - facet * rough * .5 + knob;
    v.multiplyScalar(r); v.y = Math.max(v.y * squash, -.3 * squash); p.setXYZ(i, v.x, v.y, v.z);
    shade[i] = .78 + n * .7 - facet * .3 + knob * .6;
  }
  g.computeVertexNormals();
  const b = col(base), d = col(dust);
  return paint(g, (x, y, z, ny, i) => lerp3(tone(b, shade[i]), arr(d), smooth(.35, .9, ny) * dustAmt * (.6 + .4 * hash(i, seed))));
}

// A block of layered rock. The beds are planes tilted by `dip`; harder beds stand out as ledges, thin partings are cut in,
// the wind flutes the faces, and the top gets a coat of dust. Lower beds coarse and dark, upper beds fine and pale.
function layered({ w, h, d, seed = 1, dip = [0, 1, 0], bed = .14, ledge = .09, lower = '#5c4b3e', upper = '#a88f73', split = .45, dust = '#b98f6b', dustAmt = .5, res = .045, corner = .28, terrace = .8, band = .5 }) {
  // start from an evenly divided box with rounded corners, fine enough to carry beds a few centimetres thick
  let g = new THREE.BoxGeometry(w, h, d, Math.ceil(w / res), Math.ceil(h / res), Math.ceil(d / res)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-5);
  const p = g.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3(), dn = new THREE.Vector3(...dip).normalize();
  const rr = Math.min(w, h, d) * corner, hx = w / 2 - rr, hy = h / 2 - rr, hz = d / 2 - rr;
  const bedAt = new Float32Array(p.count), hardAt = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(q); if (v.lengthSq() > 1e-12) v.setLength(rr); v.add(q);
    // big erosion: the block narrows upward and its outline wanders
    const up = (v.y / h) + .5, lump = fbm(v.x * .7 + seed, v.y * .7, v.z * .7 - seed, 3) - .5;
    v.x *= 1 - .14 * up + lump * .3; v.z *= 1 - .16 * up + lump * .3; v.y += lump * .1 * h;
    // the top breaks along the beds: snap upper points down onto bed planes, so it steps like a stack of tilted slabs
    if (v.y > -h * .1) { const t0 = (v.dot(dn) + h) / bed, k = Math.floor(t0), tt = k + smooth(.5, .92, t0 - k) * .92 + (noise3(v.x * 2, v.z * 2, k) - .5) * .25, k0 = smooth(-.1, .35, v.y / h) * terrace; v.addScaledVector(dn, (tt - t0) * bed * k0); }
    // beds: ledges and partings, measured across the tilted bedding
    const t = (v.dot(dn) + h) / bed, k = Math.floor(t), f = t - k, hard = hash(k, seed);
    const out = (hard - .45) * ledge * 2 - (f < .14 ? ledge * .9 : 0) + (f > .86 ? -ledge * .3 : 0);
    const flute = Math.sin(v.y * 9 + Math.sin(v.x * 3 + seed) * 1.5) * .012 + (noise3(v.x * 6, v.y * 18, v.z * 6) - .5) * .03;
    const r = Math.hypot(v.x, v.z) || 1, side = Math.abs(v.y) < h * .47 ? 1 : .3;
    v.x += v.x / r * (out + flute) * side; v.z += v.z / r * (out + flute) * side;
    v.y = Math.max(v.y, -h * .42);
    p.setXYZ(i, v.x, v.y, v.z); bedAt[i] = t; hardAt[i] = hard;
  }
  g.computeVertexNormals();
  const lo = col(lower), hi = col(upper), du = col(dust), cut = (split - .5) * h;
  return paint(g, (x, y, z, ny, i) => {
    const t = bedAt[i], f = t - Math.floor(t), lam = .9 + .1 * Math.sin(t * Math.PI * 7 + x * 2);
    const coarse = y < cut + .06 * Math.sin(x * 3.1 + seed), grain = hash(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40));
    const bedTone = 1 + (hardAt[i] - .5) * band * 1.4;                                   // harder beds paler, softer beds darker
    let c = coarse ? tone(lo, (.82 + grain * .3) * bedTone) : tone(hi, lam * bedTone);
    if (f < .14) c = tone(c, .58);                                                      // shadowed parting lines
    c = lerp3(c, tone(lo, .5), smooth(-.1, -.6, ny) * .55);                             // undersides of ledges in shade
    return lerp3(c, arr(du), smooth(.55, .95, ny) * dustAmt);                           // dust on flat tops
  });
}

// Smooth low heap of loose sand (rover wheels dug these up at Troy; the heat shield pushed one up when it hit).
function heap(seed, { rx = 1, rz = 1, h = .3, base = '#b8916c', bright = null, brightAmt = 0 }) {
  const g = new THREE.CircleGeometry(1, 36); g.rotateX(-Math.PI / 2);
  const ring = new THREE.RingGeometry(.0001, 1.12, 36, 9); ring.rotateX(-Math.PI / 2); g.dispose();
  const p = ring.attributes.position, b = col(base), br = bright && col(bright);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), edge = 1 + .25 * (noise3(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed) - .5);
    const k = Math.max(0, 1 - Math.pow(r / edge, 2)), y = h * k * k * (1 + .25 * (noise3(x * 3 + seed, z * 3, 1) - .5)) - .04 - smooth(.8, 1.12, r / edge) * .25;
    p.setXYZ(i, x * rx, y, z * rz);
  }
  const g2 = ring;
  g2.computeVertexNormals();
  return paint(g2, (x, y, z, ny, i) => { const n = hash(i, seed); let c = tone(b, .85 + n * .3); if (br) c = lerp3(c, arr(br), brightAmt * smooth(.2, .7, noise3(x * 4 + seed, z * 4, 2))); return c; });
}

// A thin flat plate with a ragged outline: broken soil crust, or a scrap of the heat shield.
function plate(seed, { r = .3, t = .03, top = '#8b6c55', under = '#e5d9c0', sides = 9 }) {
  const ring = [];
  for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + hash(i, seed) * .4; ring.push([Math.cos(a) * r * (.55 + .6 * hash(i, seed, 2)), Math.sin(a) * r * (.55 + .6 * hash(i, seed, 3))]); }
  const pos = [], idx = [], c = [], T = col(top), U = col(under), n = ring.length;
  pos.push(0, t, 0); c.push(...arr(T));
  for (const [x, z] of ring) { pos.push(x, t, z); c.push(...tone(T, .9 + .2 * hash(x, z))); }
  for (const [x, z] of ring) { pos.push(x, 0, z); c.push(...arr(U)); }
  for (let i = 0; i < n; i++) { const a = 1 + i, b = 1 + (i + 1) % n; idx.push(0, b, a); const a2 = a + n, b2 = b + n; idx.push(a, b, b2, a, b2, a2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

// ---- soft ground marks ---------------------------------------------------------------------------------------------
// Marks are thin sheets draped on the exact ground, with colour and see-through edges (RGBA per vertex).
function ribbon(points, surface, { width = .2, lift = .03, colour, alpha = .6, tread = 0, fadeStart = .1, fadeEnd = .06, edgeSoft = .35 }) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z))), L = curve.getLength(), N = Math.max(8, Math.ceil(L / .07));
  const across = 5, pos = [], c = [], idx = [], fixed = typeof colour === 'function' ? null : arr(col(colour));
  for (let i = 0; i <= N; i++) {
    const u = i / N, pt = curve.getPointAt(u), tg = curve.getTangentAt(u), nx = -tg.z, nz = tg.x, along = u * L;
    const fade = smooth(0, fadeStart, u) * (1 - smooth(1 - fadeEnd, 1, u));
    for (let j = 0; j < across; j++) {
      const s = j / (across - 1) * 2 - 1, x = pt.x + nx * s * width / 2, z = pt.z + nz * s * width / 2;
      pos.push(x, surface(x, z) + lift, z);
      const cleat = tread ? (Math.sin(along / tread * Math.PI * 2) > .2 ? .74 : 1) : 1, rgb = fixed || colour(s, along, x, z);
      c.push(...tone(rgb, cleat), alpha * fade * (1 - smooth(1 - edgeSoft, 1, Math.abs(s))));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < across - 1; j++) { const a = i * across + j; idx.push(a, a + 1, a + across, a + 1, a + across + 1, a + across); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4)); g.setIndex(idx); g.computeVertexNormals();
  return prep(g);
}
// A soft round or streaky patch on the ground. colourAt(r, angle, x, z) returns [r, g, b, a].
function patch(cx, cz, surface, { rx = 1, rz = rx, rot = 0, rings = 9, segs = 40, lift = .025, colourAt }) {
  const pos = [cx, surface(cx, cz) + lift, cz], c = [...colourAt(0, 0, cx, cz)], idx = [], ca = Math.cos(rot), sa = Math.sin(rot);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const r = i / rings, a = j / segs * Math.PI * 2, lx = Math.cos(a) * r * rx, lz = Math.sin(a) * r * rz, x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
    pos.push(x, surface(x, z) + lift, z); c.push(...colourAt(r, a, x, z));
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) { const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs; idx.push(a, b, a + segs, b, b + segs, a + segs); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4)); g.setIndex(idx); g.computeVertexNormals();
  return prep(g);
}

// ---- the NASA Mars Exploration Rover -------------------------------------------------------------------------------
// The model faces +z with its arm out in front. Its solar wings are scaled to the real 2.3 m. The rover is set on the
// ground under its six wheels: it pitches and rolls with the slope, then sinks by `sink` metres.
const MER = { span: 8.69, wheelX: 3.44, front: 2.6, back: -2.95, minY: -2.41 };
const ROVER_SCALE = 2.3 / MER.span;
export function roverWheels(x, z, yaw) {
  const out = [], c = Math.cos(yaw), s = Math.sin(yaw);
  for (const wx of [-1, 1]) for (const wz of [MER.back, -.6, MER.front]) {
    const lx = wx * MER.wheelX * ROVER_SCALE, lz = wz * ROVER_SCALE; out.push([x + lx * c + lz * s, z - lx * s + lz * c, wx, wz]);
  }
  return out;
}
let merPromise = null;
function addRover(parent, surface, { x, z, yaw = 0, sink = .02, pitch = 0, roll = 0 }) {
  const holder = new THREE.Group(); holder.name = 'Spirit rover'; parent.add(holder);
  const h = roverWheels(x, z, yaw).map(([wx, wz]) => surface(wx, wz));
  const L = (MER.front - MER.back) * ROVER_SCALE, W = MER.wheelX * 2 * ROVER_SCALE;
  const left = (h[0] + h[1] + h[2]) / 3, right = (h[3] + h[4] + h[5]) / 3, back = (h[0] + h[3]) / 2, front = (h[2] + h[5]) / 2;
  holder.position.set(x, Math.max((left + right) / 2, Math.max(...h) - .06) - sink, z);
  holder.rotation.set(-Math.atan2(front - back, L) + pitch, yaw, Math.atan2(right - left, W) + roll, 'YXZ');
  (merPromise ??= loadModel('mer-rover.glb')).then(gltf => {
    if (!gltf) return;
    const r = gltf.scene.clone(true); r.scale.setScalar(ROVER_SCALE); r.position.y = -MER.minY * ROVER_SCALE;
    r.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    holder.add(r);
  });
  return holder;
}

// two wheel tracks behind a rover (cleat marks), given the path of the rover centre. With drag, one wheel did not turn
// and ploughed a furrow instead, with churned soil pushed up beside it.
function tracks(path, surface, { gauge = MER.wheelX * 2 * ROVER_SCALE, width = .17, colour = '#6d523f', alpha = .5, drag = false, fade = .4, furrow = '#a98a6c', furrowCore = null, coreWidth = .2 }) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z))), out = [];
  for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, p = curve.getPointAt(u), t = curve.getTangentAt(u); pts.push([p.x - t.z * side * gauge / 2, p.z + t.x * side * gauge / 2]); }
    if (drag && side > 0) {
      out.push(ribbon(pts, surface, { width: .6, lift: .02, colour: s => arr(col(Math.abs(s) > .5 ? '#6f5340' : furrow)), alpha: .6, fadeStart: fade, edgeSoft: .55 }));
      if (furrowCore) out.push(ribbon(pts, surface, { width: coreWidth, lift: .035, colour: s => arr(col(Math.abs(s) < .45 ? furrowCore : '#d6c8ad')), alpha: .95, fadeStart: fade, edgeSoft: .3 }));
    } else out.push(ribbon(pts, surface, { width, colour, alpha, tread: .11, fadeStart: fade, edgeSoft: .45 }));
  }
  return out;
}

// ---- the stops -----------------------------------------------------------------------------------------------------
function heatShield(s, surface, solid, metal, marks) {
  const { x: X, z: Z } = s, yaw = .7;
  // The aeroshell's heat shield: a 70-degree cone with a rounded nose, 2.65 m across. It hit the ground hard, so it is
  // bent and torn. Outside: charred ablator. Inside: the tan structure, with radial ribs.
  const outer = [[0, .5], [.25, .47], [.55, .37], [.95, .22], [1.25, .09], [1.325, .02], [1.31, -.02]];
  const prof = [...outer, ...outer.slice(0, -1).reverse().map(([r, y]) => [Math.max(0, r - .04), y - .055])].map(([r, y]) => new THREE.Vector2(r, y));
  const torn = 1.05, shell = new THREE.LatheGeometry(prof, 72, torn / 2, Math.PI * 2 - torn), sp = shell.attributes.position;
  const ribs = new Float32Array(sp.count), inside = new Float32Array(sp.count);
  for (let i = 0; i < sp.count; i++) {
    let x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i); const a = Math.atan2(z, x), r = Math.hypot(x, z);
    const fold = Math.exp(-Math.pow((a - 2.3) / .45, 2)) * smooth(.4, 1.3, r);                      // one side crumpled up
    const jag = smooth(1.0, 1.32, r) * ((noise3(Math.cos(a) * 4, Math.sin(a) * 4, 7) - .5) * .2 + (hash(Math.round(a * 22), 7) - .5) * .035);                     // ragged torn rim
    const dent = (noise3(x * 2.2, y * 2, z * 2.2) - .5) * .08 * smooth(.2, 1.2, r);
    x *= 1 + jag; z *= 1 + jag; y += fold * .45 + dent - fold * r * .1;
    sp.setXYZ(i, x, y, z); ribs[i] = Math.abs(Math.sin(a * 12)) < .1 ? 1 : 0; inside[i] = i % prof.length >= outer.length ? 1 : 0;
  }
  shell.computeVertexNormals();
  const char = col('#2b221d'), ash = col('#5a4637'), struct = col('#8a6c45'), gold = col('#c4a35c');
  paint(shell, (x, y, z, ny, i) => inside[i] ? lerp3(tone(struct, .9 + .2 * hash(i, 3)), arr(gold), ribs[i] * .6) : lerp3(tone(char, .8 + .5 * noise3(x * 6, y * 6, z * 6)), arr(ash), smooth(.55, .9, noise3(x * 3, z * 3, 4)) * .6));
  // it lies upside down, tipped, one edge dug into the soil
  place(shell, X, surface(X, Z) + .75, Z, Math.PI + .78, yaw - .9, .06, 1.15); metal.push(prep(shell));
  // two large torn pieces and a fan of small scraps thrown downrange
  for (let k = 0; k < 2; k++) {
    const seg = new THREE.LatheGeometry(prof.slice(2, 6), 10, 0, .5 + hash(k, 1) * .3), q = seg.attributes.position;
    for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) + (hash(i, k) - .5) * .03);
    seg.computeVertexNormals(); paint(seg, (x, y, z, ny, i) => i % 2 ? tone(ash, 1.1) : tone(struct, 1));
    const a = yaw + .4 + k * .5, d = 3 + k * 1.7, px = X + Math.sin(a) * d, pz = Z + Math.cos(a) * d;
    place(seg, px, surface(px, pz) - .1, pz, .2 + k * .3, a * 3, .3); metal.push(prep(seg));
  }
  for (let k = 0; k < 26; k++) {
    const a = yaw + (hash(k, 2) - .5) * 1.4, d = 2 + Math.pow(hash(k, 3), .7) * 7, px = X + Math.sin(a) * d, pz = Z + Math.cos(a) * d;
    const f = plate(k + 40, { r: .07 + hash(k, 4) * .16, t: .012, top: k % 3 ? '#4a3b31' : '#a8894e', under: '#6b5640', sides: 7 });
    place(f, px, surface(px, pz) + .005, pz, (hash(k, 5) - .5) * .4, hash(k, 6) * 6, (hash(k, 7) - .5) * .4); metal.push(prep(f));
  }
  // the sand it pushed up, and a few rocks
  const h = heap(3, { rx: 1.4, rz: .8, h: .32, base: "#b08a68" }); place(h, X + Math.sin(yaw - .9) * 1.3, surface(X, Z) - .02, Z + Math.cos(yaw - .9) * 1.1, 0, yaw - .9, 0); solid.push(prep(h));
  for (let k = 0; k < 7; k++) { const a = hash(k, 8) * 6.28, d = 2.4 + hash(k, 9) * 3, px = X + Math.cos(a) * d, pz = Z + Math.sin(a) * d, r = .12 + hash(k, 10) * .3; solid.push(prep(place(stone(k + 3, { base: k % 2 ? '#4a403a' : '#6a5646' }), px, surface(px, pz), pz, 0, a, 0, r))); }
  // the scar: soil darkened and churned where it hit, with streaks thrown downrange (soft edges, no hard shadow)
  const dark = arr(col('#6e523f')), light = arr(col('#c8a07a'));
  marks.push(patch(X, Z, surface, { rx: 3.2, rz: 2.2, rot: -yaw + Math.PI / 2, rings: 10, segs: 56, colourAt: (r, a, x, z) => {
    const ray = Math.pow(Math.abs(Math.sin(a * 5 + 1.3)), 6), n = noise3(x * 1.7, z * 1.7, 3);
    return [...(n > .62 ? light : dark), (1 - smooth(.35, 1, r)) * (.45 + .3 * ray) * (.6 + .4 * n)];
  } }));
}

function hillary(s, surface, solid, marks, parent) {
  const { x: X, z: Z } = s, gy = surface(X, Z);
  // Hillary: an outcrop of layered rock poking out of the windswept top of Husband Hill. Its beds dip to the north-east.
  // Tenzing, a lower outcrop, sits just to its left. Both are enlarged a little so you can see them.
  const dip = [.38, 1, -.28];
  const main = layered({ w: 3.6, h: 1.2, d: 2, seed: 11, dip, bed: .16, ledge: .08, res: .06, terrace: .6, lower: '#463a32', upper: '#8c7764', split: .3, band: .9, dustAmt: .4, corner: .22 });
  place(main, X, gy + .3, Z, .06, .5, -.08); solid.push(prep(main));
  const ten = layered({ w: 2.2, h: .75, d: 1.4, seed: 23, dip, bed: .14, ledge: .07, res: .06, terrace: .6, lower: '#43372f', upper: '#84705e', split: .35, band: .9, dustAmt: .4, corner: .22 });
  const tx = X - 2.9, tz = Z + .8; place(ten, tx, surface(tx, tz) + .18, tz, .04, .2, .05); solid.push(prep(ten));
  // loose slabs that broke off, and dark cobbles of basalt lying on the summit
  for (let k = 0; k < 5; k++) {
    const a = .5 + (k - 2) * .55, d = 2.1 + hash(k, 1) * .8, px = X + Math.cos(a) * d, pz = Z + Math.sin(a) * d;
    const sl = layered({ w: .5 + hash(k, 2) * .5, h: .2 + hash(k, 3) * .14, d: .4 + hash(k, 4) * .3, seed: k + 50, dip, bed: .07, ledge: .02, res: .05, lower: '#55473d', upper: '#8c7763' });
    place(sl, px, surface(px, pz) + .04, pz, (hash(k, 5) - .5) * .5, hash(k, 6) * 6, (hash(k, 7) - .5) * .5); solid.push(prep(sl));
  }
  for (let k = 0; k < 18; k++) {
    const a = hash(k, 11) * 6.28, d = 2.2 + Math.pow(hash(k, 12), .8) * 6, px = X + Math.cos(a) * d, pz = Z + Math.sin(a) * d, r = .06 + Math.pow(hash(k, 13), 2) * .26;
    solid.push(prep(place(stone(k + 7, { base: k % 3 ? '#3e3733' : '#5b4b40', detail: 2, dustAmt: .35 }), px, surface(px, pz) - r * .1, pz, 0, a, 0, r)));
  }
  // small sand tails in the lee of the outcrops (pale, soft-edged)
  for (const [px, pz, rx] of [[X + 1.7, Z + 1.3, 1.6], [tx + 1, tz + .9, 1]]) marks.push(patch(px, pz, surface, { rx, rz: rx * .38, rot: -.65, colourAt: r => [...arr(col('#c39a74')), (1 - smooth(.3, 1, r)) * .55] }));
  // Spirit: parked on the slope a few metres south, facing the outcrop with its arm out, its tracks behind it
  const rx = X + .6, rz = Z + 3.7, yaw = Math.PI + .12;
  addRover(parent, surface, { x: rx, z: rz, yaw, sink: .03 });
  marks.push(...tracks([[rx + .4, rz + 10], [rx + .9, rz + 5.5], [rx + .1, rz + .4]], surface, { fade: .5 }));
}

function homePlate(s, surface, solid, cliff, marks) {
  const m = LANDMARKS.find(l => l.id === 'homeplate'), { x: CX, z: CZ } = m;
  // The layered rim of Home Plate. One sheet runs all the way round the plateau's edge, following the ground. Beds lie nearly
  // flat: a coarse, darker lower unit and a pale, finely laminated upper unit. Harder beds stick out as small ledges.
  // At the stop (the side facing camp), a dark lump of rock fell into the soft layers and bent them down: a bomb sag.
  // rows: a few on the lip, many up the face (evenly spaced in height, so each bed gets its own rows), a few at the foot
  const unease = q => .5 - Math.sin(Math.asin(1 - 2 * q) / 3);          // inverse of the smooth step used in plateProfile
  const ROWS = [.85, .86, .87, .875];
  for (let k = 1; k < 40; k++) ROWS.push(.88 + .12 * unease(k / 40));
  ROWS.push(1, 1.008, 1.02, 1.035);
  const N = 440, J = ROWS.length - 1, pos = [], c = [], idx = [];
  const lo = col('#5d4c40'), lo2 = col('#7a6250'), hi = col('#bfa88a'), hi2 = col('#d9c6a6'), dust = col('#b99572'), clast = arr(col('#2e2925'));
  const sa = Math.atan2(s.z - CZ, s.x - CX), sagH = 1.05;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, R = plateRadius(m, a), ca = Math.cos(a), sn = Math.sin(a);
    const foot = surface(CX + ca * R * 1.04, CZ + sn * R * 1.04), lip = surface(CX + ca * R * .85, CZ + sn * R * .85);
    const da = Math.atan2(Math.sin(a - sa), Math.cos(a - sa)) * R;
    for (let j = 0; j <= J; j++) {
      const u = ROWS[j], x0 = CX + ca * R * u, z0 = CZ + sn * R * u, y0 = surface(x0, z0);
      const face = smooth(.87, .888, u) * (1 - smooth(.997, 1.025, u));       // 1 on the steep face, 0 on top and at the foot
      const hgt = y0 - foot, sr = Math.hypot(da, (hgt - sagH) * 1.6);
      const sag = sr < 1.4 ? .2 * Math.exp(-sr * sr * 1.8) * (hgt < sagH ? 1 : .15) : 0;
      const bedY = hgt + .04 * Math.sin(a * 9) + sag, k = Math.floor(bedY / .15), f = bedY / .15 - k, hard = hash(k, 3, Math.floor(a * 7));
      const jp = a * R / 2.6 + Math.sin(a * 11) * .4, jf = jp - Math.floor(jp), joint = jf < .05 ? 1 : 0;      // vertical cracks every few metres
      const alcove = (noise3(a * 9, 3, 1) - .5) * .5;                                                              // the face wanders in and out
      const ledge = ((hard - .45) * .22 - (f < .16 ? .1 : 0)) * face, push = (.36 + alcove * .5 - joint * .14) * face + ledge + (noise3(a * 40, hgt * 3, 1) - .5) * .1 * face;
      pos.push(x0 + ca * push, y0 - .1 * (1 - face) + .02, z0 + sn * push);
      const lower = hgt < .9 + .15 * Math.sin(a * 5), lam = .8 + .2 * Math.sin(bedY * 52);
      let rgb = lower ? lerp3(arr(lo), arr(lo2), hash(Math.round(x0 * 20), Math.round(y0 * 20), Math.round(z0 * 20)) * .8) : lerp3(arr(hi), arr(hi2), .5 + .5 * Math.sin(a * 13 + bedY * 3));
      rgb = tone(rgb, (lower ? 1 : lam) * (.72 + .5 * hard) * (f < .16 ? .6 : 1) * (joint ? .55 : 1));
      if (Math.hypot(da, (hgt - sagH - .12) * 1.2) < .3) rgb = clast;
      rgb = lerp3(rgb, arr(dust), (1 - face) * .85 + face * smooth(.6, 1, hgt / Math.max(.5, lip - foot)) * .25);
      c.push(...rgb);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < J; j++) { const a = i * (J + 1) + j, b = a + J + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const band = new THREE.BufferGeometry(); band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); band.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); band.setIndex(idx); band.computeVertexNormals();
  cliff.push(prep(band));
  // the bomb sag's dark clast, sitting in the face
  { const R = plateRadius(m, sa), px = CX + Math.cos(sa) * (R * .955 + .5), pz = CZ + Math.sin(sa) * (R * .955 + .5);
    solid.push(prep(place(stone(9, { base: '#2c2724', dust: '#7a6455', dustAmt: .2, rough: .25 }), px, surface(px, pz) + .05, pz, .3, sa, 0, .24))); }
  // blocks that fell from the rim lie at its foot (more of them near the stop), and dark cobbles on top near the edge
  for (let k = 0; k < 72; k++) {
    const near = k < 22, a = near ? sa + (hash(k, 1) - .5) * .5 : hash(k, 1) * Math.PI * 2, R = plateRadius(m, a);
    const u = 1.02 + Math.pow(hash(k, 2), 1.6) * .16, px = CX + Math.cos(a) * R * u, pz = CZ + Math.sin(a) * R * u;
    const big = .25 + Math.pow(hash(k, 3), 2) * (near ? .65 : .5);
    const b = layered({ w: big * 2.2, h: big * .8, d: big * 1.5, seed: k + 100, dip: [hash(k, 4) - .5, 1, hash(k, 5) - .5], bed: big * .2, ledge: big * .06, res: big * .15, lower: '#5f4e42', upper: '#b9a284', split: .5, corner: .2, band: .8, dustAmt: .35 });
    place(b, px, surface(px, pz) + big * .18, pz, (hash(k, 6) - .5) * .7, hash(k, 7) * 6, (hash(k, 8) - .5) * .7); solid.push(prep(b));
  }
  for (let k = 0; k < 40; k++) {
    const a = hash(k, 21) * Math.PI * 2, R = plateRadius(m, a), u = .55 + hash(k, 22) * .3, px = CX + Math.cos(a) * R * u, pz = CZ + Math.sin(a) * R * u, r = .1 + Math.pow(hash(k, 23), 2) * .35;
    solid.push(prep(place(stone(k + 60, { base: k % 3 ? '#4a3f38' : '#8a755f', detail: 2, squash: .55 }), px, surface(px, pz), pz, 0, a, 0, r)));
  }
  // darker sand drifted against the foot of the rim
  marks.push(patch(s.x, s.z, surface, { rx: 6, rz: 2.4, rot: -sa + Math.PI / 2, colourAt: (r, a, x, z) => [...arr(col('#6f5644')), (1 - smooth(.3, 1, r)) * .35 * noise3(x * .8, z * .8, 5)] }));
}

function gertrude(s, surface, solid, marks, parent) {
  const { x: X, z: Z } = s;
  // Spirit's right front wheel had jammed, so it drove backwards dragging it. Near Home Plate the dead wheel ploughed a
  // furrow that turned up bright white soil: about 90 percent silica. The rover stopped a few metres on, facing back
  // the way it came. Beside the track: pale, knobbly nodules of silica-rich rock.
  const path = [[X - 6, Z - 11], [X - 4.5, Z - 6], [X - 1.4, Z - 2.2], [X + 1.6, Z + .8]];
  marks.push(...tracks(path, surface, { drag: true, fade: .25, furrow: '#c2ad92', furrowCore: '#f6f3ec', coreWidth: .28 }));
  const end = path[path.length - 1], prev = path[path.length - 2], heading = Math.atan2(end[0] - prev[0], end[1] - prev[1]);
  addRover(parent, surface, { x: end[0] + Math.sin(heading) * 1.1, z: end[1] + Math.cos(heading) * 1.1, yaw: heading + Math.PI, sink: .04 });
  // bright clods thrown up by the wheel
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  for (let k = 0; k < 30; k++) {
    const u = .15 + hash(k, 1) * .8, p = curve.getPointAt(u), t = curve.getTangentAt(u), side = MER.wheelX * ROVER_SCALE + (hash(k, 2) - .3) * .6;
    const px = p.x - t.z * side, pz = p.z + t.x * side, r = .03 + hash(k, 3) * .07;
    solid.push(prep(place(stone(k + 200, { base: '#efe9dc', dust: '#d9cbb0', dustAmt: .2, detail: 1, rough: .4 }), px, surface(px, pz), pz, 0, hash(k, 4) * 6, 0, r)));
  }
  // nodular outcrop: pale knobbly rocks in a low cluster
  for (let k = 0; k < 11; k++) {
    const a = 2.4 + hash(k, 5) * 2, d = 2.2 + hash(k, 6) * 3.4, px = X + Math.cos(a) * d - 1, pz = Z + Math.sin(a) * d - 1.5, r = .12 + Math.pow(hash(k, 7), 2) * .38;
    const gy = surface(px, pz) - r * .2;
    for (let j = 0; j < 7; j++) {                       // each nodule rock is a clump of rounded knobs, like popcorn
      const ja = j * 2.4 + k, jr = j ? r * (.35 + .25 * hash(k, j)) : r * .7, jd = j ? r * .55 : 0;
      solid.push(prep(place(stone(k * 7 + j + 300, { base: j % 3 ? '#c2b195' : '#a99677', dust: '#cdb08d', dustAmt: .25, rough: .12, detail: 2, squash: .75 }), px + Math.cos(ja) * jd, gy + (j ? jr * .5 : jr * .3), pz + Math.sin(ja) * jd, 0, ja, 0, jr)));
    }
  }
  marks.push(patch(X - 3.2, Z - 2.6, surface, { rx: 3.2, rz: 2, rot: .5, colourAt: r => [...arr(col('#cdb79a')), (1 - smooth(.4, 1, r)) * .4] }));
  for (let k = 0; k < 10; k++) { const a = hash(k, 31) * 6.28, d = 4 + hash(k, 32) * 4, px = X + Math.cos(a) * d, pz = Z + Math.sin(a) * d, r = .08 + hash(k, 33) * .2; solid.push(prep(place(stone(k + 330, { base: '#463d37', detail: 2 }), px, surface(px, pz), pz, 0, a, 0, r))); }
}

function troy(s, surface, solid, marks, parent) {
  const m = LANDMARKS.find(l => l.id === 'troy'), CX = m.x, CZ = m.z;
  // Troy: Spirit drove along the edge of a small crater, broke through a thin crust and sank into soft, bright sand.
  // It sits tilted, wheels buried past the hubs, with dug-up sand heaped round them and broken crust lying about.
  const rx = CX - 1.9, rz = CZ + .9, yaw = 1.75;
  addRover(parent, surface, { x: rx, z: rz, yaw, sink: .2, roll: .1, pitch: -.04 });
  for (const [wx, wz, side] of roverWheels(rx, rz, yaw)) {
    const k = Math.round(wx * 7 + wz * 3);
    const h = heap(k, { rx: .42 + hash(k, 1) * .15, rz: .32 + hash(k, 2) * .1, h: .17 + (side > 0 ? .06 : 0), base: '#b08d6b', bright: '#e8dcc0', brightAmt: .75 });
    place(h, wx, surface(wx, wz) - .02, wz, 0, yaw + (hash(k, 3) - .5) * .5, 0); solid.push(prep(h));
    marks.push(patch(wx, wz, surface, { rx: .85, rz: .6, rot: -yaw, rings: 7, segs: 30, colourAt: (r, a, x, z) => {
      const n = noise3(x * 5, z * 5, k), rgb = n > .55 ? arr(col('#efe6cf')) : n > .35 ? arr(col('#d2b892')) : arr(col('#7a5d48'));
      return [...rgb, (1 - smooth(.45, 1, r)) * .85];
    } }));
  }
  // broken crust: thin dark plates with bright undersides, tipped up around the wheels
  for (let k = 0; k < 60; k++) {
    const a = hash(k, 5) * 6.28, d = .9 + Math.pow(hash(k, 6), 1.4) * 1.9, px = rx + Math.cos(a) * d, pz = rz + Math.sin(a) * d * .8;
    const p = plate(k + 500, { r: .04 + Math.pow(hash(k, 7), 2) * .12, t: .018, top: k % 3 ? '#a17f63' : '#8d6c55', under: '#eadfc6' });
    place(p, px, surface(px, pz) - .004, pz, (hash(k, 8) - .5) * .7, a, (hash(k, 9) - .5) * .7); solid.push(prep(p));
  }
  // its tracks, coming in from the west along the crater edge; the jammed right front wheel drags
  marks.push(...tracks([[rx - 11, rz + 3.5], [rx - 6.5, rz + 2.4], [rx - 3, rz + 1.1], [rx - .9, rz + .2]], surface, { drag: true, fade: .35 }));
  // bright sand churned up on the crater floor, plus rocks on the rim
  marks.push(patch(CX + .6, CZ, surface, { rx: 3.6, rz: 3.2, colourAt: (r, a, x, z) => [...arr(col('#d9c3a0')), (1 - smooth(.5, 1, r)) * .35 * noise3(x * 1.3, z * 1.3, 9)] }));
  for (let k = 0; k < 14; k++) { const a = hash(k, 41) * 6.28, d = m.r * 1.1 + hash(k, 42) * 3, px = CX + Math.cos(a) * d, pz = CZ + Math.sin(a) * d, r = .08 + Math.pow(hash(k, 43), 2) * .32; solid.push(prep(place(stone(k + 600, { base: k % 2 ? '#3f3833' : '#5e4d41', detail: 2 }), px, surface(px, pz) - r * .1, pz, 0, a, 0, r))); }
}

// Builds one stop. surface(x, z) is the exact ground height. Returns a group positioned in world metres.
export function buildStop(s, surface) {
  const g = new THREE.Group(); g.name = 'stop ' + s.id;
  const solid = [], metal = [], cliff = [], marks = [];
  if (s.kind === 'shield') heatShield(s, surface, solid, metal, marks);
  else if (s.kind === 'ledge') hillary(s, surface, solid, marks, g);
  else if (s.kind === 'plateau') homePlate(s, surface, solid, cliff, marks);
  else if (s.kind === 'silica') gertrude(s, surface, solid, marks, g);
  else if (s.kind === 'stuck') troy(s, surface, solid, marks, g);
  const add = (list, material, name) => {
    if (!list.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), material); mesh.name = name;
    mesh.castShadow = material !== MARKS; mesh.receiveShadow = true; if (material === MARKS) mesh.renderOrder = 1; g.add(mesh); return mesh;
  };
  add(solid, SOLID, 'rock'); add(metal, METAL, 'metal'); add(cliff, CLIFF, 'cliff'); add(marks, MARKS, 'ground marks');
  return g;
}

// Dust devil tracks: long dark scribbles on the plain where dust devils swept the bright dust off darker ground.
// Like the streaks seen from orbit, most run north-west to south-east. One mesh for the whole plain.
export function buildDustDevilTracks(surface, cx, cz, { n = 14, spread = 70 } = {}) {
  const list = [], dark = arr(col('#5a4234'));
  for (let k = 0; k < n; k++) {
    const sx = cx + (hash(k, 1) - .5) * spread * 1.6, sz = cz + (hash(k, 2) - .5) * spread * 1.2, L = 50 + hash(k, 3) * 90, dir = Math.PI / 4 + (hash(k, 4) - .5) * .5;
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 - .5, w = Math.sin(t * 5 + k) * 6 * hash(k, 5); pts.push([sx + Math.cos(dir) * L * t - Math.sin(dir) * w, sz + Math.sin(dir) * L * t + Math.cos(dir) * w]); }
    list.push(ribbon(pts, surface, { width: 1.6 + hash(k, 6) * 3.2, lift: .05, colour: () => dark, alpha: .28 + hash(k, 7) * .14, fadeStart: .15, fadeEnd: .15, edgeSoft: .7 }));
  }
  const mesh = new THREE.Mesh(mergeGeometries(list, false), MARKS.clone()); mesh.name = 'dust devil tracks';   // own material, so storms can fade it mesh.receiveShadow = true; mesh.renderOrder = 1;
  return mesh;
}
