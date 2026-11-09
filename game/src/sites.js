// Real stops from Spirit's trip across Gusev Crater, laid out as places to visit: walk (or drive) to each one,
// press E, and read what NASA found there. Also moving dust devils on the plain. Facts live in site-data.js.
import * as THREE from 'three';
import { heightAt, groundHeight, rockGeometry } from './world.js';
import { SITES } from './site-data.js';
import { loadModel } from './nasamodels.js';

const mat = (c, r = .92, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...extra });
const M = { pole: mat('#cfc8b8', .6), rock: mat('#6b5848'), dark: mat('#2f2b29'), pale: mat('#dccfb4'), tan: mat('#a98a6a'), white: mat('#ece6d6', 1), flagOff: mat('#d8742a', .8, { side: THREE.DoubleSide }), flagOn: mat('#3f9b62', .8, { side: THREE.DoubleSide }) };

function labelSprite(text, done) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = done ? '#1f3a29ee' : '#161b1eee'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#edf0ea'; g.font = '26px system-ui'; g.textAlign = 'center'; g.fillText(text, 256, 40);
  g.font = '17px system-ui'; g.fillStyle = done ? '#9fdcb0' : '#f0c27a'; g.fillText(done ? 'Visited' : 'Press E to look', 256, 72);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true }));
  sp.scale.set(7, 1.3, 1); return sp;
}

// ---- The five stops, each built from NASA's own measurements and photos --------------------------------------------------
// Sizes are the real ones where we have them (heat shield 2.65 m across, rover 2.3 m wide, Home Plate stack 1.5 m thick),
// then enlarged a little (see place()) so a kid can see them from a distance.
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const vmat = (r = 1) => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: r, metalness: 0, side: THREE.DoubleSide });
const rgb = (c, k = 1) => [c[0] * k, c[1] * k, c[2] * k];
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function paint(geo, fn) { const p = geo.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }

// A block of layered rock: thin laminae (the stripes), harder beds that stand out as ledges, a coarse dark lower unit under a
// fine pale upper unit, beds that dip, and an optional bomb sag (a lump that pressed the layers below it down).
function strataBlock({ w, h, d, seed = 1, dip = .08, sag = null, ledge = .08, lower = '#6b5646', upper = '#c2ad8e', split = .52 }) {
  const geo = new THREE.BoxGeometry(w, h, d, 70, 56, 12), pos = geo.attributes.position, lo = hex(lower), up = hex(upper);
  const layer = (x, y) => { let t = y * 26 + dip * x * 26; if (sag) { const dx = x - sag.x, dy = y - sag.y, r = Math.hypot(dx, dy); if (r < sag.r * 2.2) t -= sag.depth * 26 * Math.exp(-(r * r) / (sag.r * sag.r)); } return t; };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i) + h / 2, z = pos.getZ(i);
    if (z > d / 2 - 1e-4) { const bed = Math.floor(layer(x, y) / 3); pos.setZ(i, z + ledge * (hash(bed, seed) - .3) + .012 * Math.sin(x * 40 + y * 9) + .02 * (hash(Math.round(x * 30), Math.round(y * 30)) - .5)); }
  }
  // round the box into a rough natural lump: pull the corners in, wobble the sides and top, step the top edge
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = x / (w / 2), nz = z / (d / 2), r = Math.hypot(nx, nz), up = (y + h / 2) / h;
    const pull = r > 1 ? 1 / Math.pow(r, .55) : 1, wob = Math.sin(x * 1.3 + y * 1.9 + seed) * Math.sin(z * 1.7 - y * 1.1 + seed * .7), step = Math.sin(x * 2.3 + seed * 2) * .5 + Math.sin(x * 5.1) * .25;
    pos.setXYZ(i, x * pull * (1 - .1 * up) + wob * .22 * (.4 + up), y + (up > .96 ? step * .18 : 0) - .1 * up * up, z * pull * (1 - .12 * up) + wob * .18 * (.4 + up));
  }
  geo.computeVertexNormals();
  paint(geo, (x, y0, z) => {
    const y = y0 + h / 2, t = layer(x, y), band = Math.floor(t / 3), f = t - Math.floor(t), contact = split * h + .05 * Math.sin(x * 3 + seed);
    const coarse = y < contact, line = f < .16 ? .82 : 1, bedTone = .88 + .24 * hash(band, seed + 3);
    let col = coarse ? mix(lo, hex('#8a7157'), hash(Math.round(x * 24), Math.round(y * 24)) * .7) : mix(up, hex('#d8c7a8'), .5 + .5 * Math.sin(t * .5 + x * 2));
    if (coarse) { const grain = hash(Math.round(x * 55), Math.round(y * 55)); col = rgb(col, .8 + grain * .35); } else col = rgb(col, line);
    if (sag) { const r = Math.hypot(x - sag.x, y - sag.y); if (r < sag.r * .55) col = hex('#35302c'); }
    const dust = smooth(h * .5, h, y) * .1;
    return mix(rgb(col, bedTone), hex('#b08a6c'), dust);
  });
  return new THREE.Mesh(geo, vmat());
}

// The real NASA Mars Exploration Rover model (Spirit and Opportunity are twins), loaded once and cloned into each scene.
let merPromise = null;
const loadMer = () => merPromise ??= loadModel('mer-rover.glb');
function addRover(parent, { x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, sink = 0, size = 2.3 } = {}) {
  const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.set(pitch, yaw, roll, 'YXZ'); parent.add(holder);
  loadMer().then(gltf => {
    if (!gltf) return;
    const r = gltf.scene.clone(true), box = new THREE.Box3().setFromObject(r), sz = box.getSize(new THREE.Vector3());
    // find the wheel-bottom plane: the lowest point. Scale so the body is a real 2.3 m wide (the widest horizontal side).
    const k = size / Math.max(sz.x, sz.z); r.scale.multiplyScalar(k); box.setFromObject(r);
    r.position.set(-(box.min.x + box.max.x) / 2, -box.min.y - sink, -(box.min.z + box.max.z) / 2);
    r.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    holder.add(r);
  });
  return holder;
}

function build(kind, seed) {
  const g = new THREE.Group();
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const lump = (r, x, z, m, flat = .55, s2 = seed) => { const k = new THREE.Mesh(rockGeometry(s2 + x * 3 + z, { detail: 2, rough: .4 }), m); k.scale.set(r, r * flat, r * .85); k.rotation.y = hash(x, z) * 6; return add(k, x, r * .1, z); };
  const dark = mat('#3b3531', .95), tan = mat('#9a8068'), pale = mat('#cdbd9f');
  const noise = (x, z, f = 1) => hash(Math.round(x * f * 7) + seed, Math.round(z * f * 7));
  if (kind === 'shield') {
    // Spirit's heat shield: a shallow cone shell 2.65 m across that fell to the plain, scorched black outside with gold insulation inside.
    const prof = [[1.325, 0], [1.3, .12], [1.1, .3], [.75, .52], [.38, .7], [.0, .78], [.0, .74], [.36, .66], [.72, .48], [1.07, .26], [1.27, .08], [1.30, -.02]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 40), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), cr = 1 + .1 * Math.sin(a * 3 + seed) * smooth(.3, 1.3, r) + .05 * Math.sin(a * 7); p.setXYZ(i, x * cr, y + .12 * Math.sin(a * 2 + 1) * smooth(.4, 1.3, r) - .05 * hash(i, seed), z * cr); }
    geo.computeVertexNormals();
    paint(geo, (x, y, z, i) => { const inside = (geo.index ? 0 : 0, Math.hypot(x, z) < 1.2 && y > .5); const n = hash(i, 3); return inside ? mix(hex('#b8943a'), hex('#e0cf86'), n) : mix(hex('#1b1614'), hex('#4a3a30'), n * .8); });
    const shell = add(new THREE.Mesh(geo, vmat(.7)), 0, .2, 0); shell.rotation.set(Math.PI + .3, .5, .2); shell.position.y = .72;
    // the impact scar: a dark smear on the ground, a heap of thrown sand on the downwind side, and broken pieces down the slope
    const scar = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), mat('#2a2522', 1, { polygonOffset: true, polygonOffsetFactor: -2 })); scar.rotation.x = -Math.PI / 2; scar.scale.set(1.15, 1, .8); scar.position.set(.3, .03, .2); g.add(scar);
    for (let i = 0; i < 12; i++) { const a = -.4 + i * .1, d = 2.6 + i * .55; const frag = new THREE.Mesh(new THREE.BoxGeometry(.28 + noise(i, 1) * .3, .03, .2 + noise(i, 2) * .25), i % 3 ? mat('#14110f', .9) : mat('#c0a64e', .35, { metalness: .6 })); frag.position.set(Math.cos(a) * d + noise(i, 3) - .5, .04, Math.sin(a) * d + noise(i, 4) * 1.2 - .6); frag.rotation.set((noise(i, 5) - .5) * .5, noise(i, 6) * 6, (noise(i, 7) - .5) * .5); frag.castShadow = true; frag.userData.drape = true; g.add(frag); }
    lump(.35, 3.3, 1.3, dark); lump(.25, -2.8, 1.7, tan);
  } else if (kind === 'ledge') {
    // Hillary, near the top of Husband Hill: a rock ledge Spirit climbed, with its tilt almost 30 degrees, on a windswept plateau
    const rock = strataBlock({ w: 5.2, h: 1.9, d: 2.2, seed: 5, dip: .22, lower: '#4f4036', upper: '#9c836b', split: .62, ledge: .1 });
    add(rock, 0, .95, 0).rotation.set(0, .35, -.12);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.03, .9 + noise(i, 1) * .6, .05), mat('#181412', 1)); f.position.set(-2 + i * .65, 1.05, 1.13); f.rotation.set(0, .35, (noise(i, 2) - .5) * .6); g.add(f); }   // cracks across the clean face
    for (let i = 0; i < 14; i++) lump(.15 + noise(i, 3) * .35, -4 + noise(i, 4) * 8, 2 + noise(i, 5) * 3.5, i % 3 ? dark : tan, .6, i + 4);
    addRover(g, { x: -5.2, z: 2.6, yaw: 2.4, roll: .5, pitch: .08, sink: .1 });                                   // Spirit tilted almost 30 degrees
  } else if (kind === 'plateau') {
    // Home Plate: the layered stack seen at its edge. A coarse, dark lower unit with a bomb sag, a pale finely laminated upper unit, beds dipping in.
    const face = strataBlock({ w: 8, h: 2.3, d: 3.2, seed: 9, dip: .1, sag: { x: -1.3, y: .8, r: .4, depth: .2 }, lower: '#5d4a3b', upper: '#c8b494', split: .5, ledge: .14 });
    const fp = face.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i), up = (y + 1.15) / 2.3, rough = (hash(Math.round(x * 4), Math.round(z * 4)) - .5) * .22 * up; fp.setXYZ(i, x * (1 - .12 * up) + rough, y + (hash(Math.round(x * 6), 5) - .5) * .12 * up, z * (1 - .1 * up) + rough); }
    face.geometry.computeVertexNormals();
    add(face, 0, 1.15, 0).rotation.y = .06;
    const clast = new THREE.Mesh(rockGeometry(4, { detail: 2, rough: .3 }), mat('#2c2724', .9)); clast.scale.set(.17, .13, .17); add(clast, -1.3, .8, 1.62);   // the clast that sagged the layers
    for (let i = 0; i < 12; i++) { const f = lump(.2 + noise(i, 3) * .4, -3.4 + i * .62, 2.1 + noise(i, 4) * 1.5, i % 2 ? mat('#7a6451') : mat('#c0aa8a'), .5, i); f.rotation.y = i * .55; }   // blocks that fell from the face
  } else if (kind === 'silica') {
    // Tyrone: bright soil. The rover dragged a jammed wheel as it drove backward and cut a pale trench; the soil is more than 90 percent silica.
    const curve = new THREE.CatmullRomCurve3([[3.4, 0, 2.4], [1.8, 0, 1.1], [.4, 0, .5], [-1.2, 0, -.3], [-2.8, 0, -1.4], [-4.6, 0, -1.9]].map(a => new THREE.Vector3(...a)));
    const N = 48, pts = curve.getSpacedPoints(N), pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) { const p = pts[i], tg = curve.getTangent(i / N), nx = -tg.z, nz = tg.x, wd = .5 + .12 * Math.sin(i * .5), v = i / N; for (const sd of [-1, -.35, .35, 1]) { pos.push(p.x + nx * wd * sd, .02 + (Math.abs(sd) < .5 ? -.02 : .03) + .02 * hash(i, sd * 9), p.z + nz * wd * sd); const c = Math.abs(sd) < .5 ? mix(hex('#f4efe0'), hex('#fffaf0'), hash(i, 4)) : mix(hex('#e2d6bb'), hex('#b7906f'), Math.abs(sd) > .9 ? .7 : .3); col.push(...c); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const trench = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide })); trench.receiveShadow = true; g.add(trench);
    for (let i = 0; i < 26; i++) { const p = curve.getPoint(i / 26), c = new THREE.Mesh(new THREE.SphereGeometry(.1 + noise(i, 1) * .16, 7, 5), mat(i % 2 ? '#f0e9d6' : '#e1d3b4', 1)); c.scale.y = .5; c.position.set(p.x + (noise(i, 2) - .5) * 1.7, .05, p.z + (noise(i, 3) - .5) * 1.7); g.add(c); }   // bright clods thrown out
    for (let i = 0; i < 6; i++) lump(.3 + noise(i, 5) * .35, -2 + i * .9, -2.6 - noise(i, 6), mat('#cbbb9d'), .7, i + 2);                          // light-toned knobby outcrops nearby
    addRover(g, { x: 3.6, z: 3.4, yaw: -2.2, sink: .02 });
  } else if (kind === 'stuck') {
    // Troy: a shallow crater about 8 m wide, a thin crust over soft sulfate sand, Spirit sunk to its belly, ruts leading in
    for (let k = -1; k <= 1; k += 2) for (let i = 0; i < 34; i++) { const t = i / 33, wob = (noise(i, k) - .5) * .14, rut = new THREE.Mesh(new THREE.BoxGeometry(.34, .03, .3), mat('#6b5546', 1)); rut.position.set(k * .75 + wob + Math.sin(t * 3) * .15, .03, -1.3 - t * 4.2); rut.userData.drape = true; g.add(rut); }   // two shallow wheel tracks, soft-edged and short
    for (let i = 0; i < 16; i++) { const a = i * 2.1, r = 1.5 + noise(i, 1) * 3.2, plate = new THREE.Mesh(new THREE.BoxGeometry(.5 + noise(i, 2) * .5, .035, .4 + noise(i, 3) * .4), mat(i % 3 ? '#e6dcc4' : '#cdbfa3', 1)); plate.position.set(Math.cos(a) * r, .06, Math.sin(a) * r); plate.rotation.set((noise(i, 4) - .5) * .5, noise(i, 5) * 6, (noise(i, 6) - .5) * .5); plate.castShadow = true; plate.userData.drape = true; g.add(plate); }   // pieces of the broken crust
    addRover(g, { x: 0, z: .3, yaw: Math.PI, pitch: -.1, roll: .13, sink: .12 });
    lump(.45, 3.5, 1.2, dark); lump(.3, -3.6, -.4, tan);
  } else {   // watch / unknown
    const post = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .9), tan); add(post, 0, .06, 0);
  }
  return g;
}

export class Sites {
  constructor(world, { toast, modal, onVisit, onDevil }) {
    Object.assign(this, { world, toast, modal, onVisit, onDevil });
    this.list = SITES; this.visited = new Set(); this.meshes = new Map();
    this.group = new THREE.Group(); this.group.name = 'Gusev stops'; world.scene.add(this.group);
    for (const s of SITES) this.place(s);
    const prev = world.extraTargets;
    world.extraTargets = p => [...(prev?.(p) || []), ...SITES.map(s => ({ type: 'site', id: s.id, label: s.verb, range: s.kind === 'silica' ? 5 : 4.5, d: Math.hypot(p.x - s.x, p.z - s.z) }))];
    this.devils = new DustDevils(world, this);
    const upd = world.update.bind(world); world.update = (dt, a) => { upd(dt, a); this.devils.tick(dt); };
    world.sites = this;
  }
  place(s) {
    const y = groundHeight(s.x, s.z) - (['ridge', 'overlook', 'ledge', 'knobby'].includes(s.kind) ? .35 : .06), root = new THREE.Group(); root.position.set(s.x, y, s.z);
    const scene = build(s.kind, s.x + s.z); if (s.kind !== 'watch') scene.scale.setScalar(s.kind === 'plateau' || s.kind === 'valley' ? 1.8 : 1.6); root.add(scene);
    // flat pieces (ruts, crust plates, broken parts) lie on the real ground, even inside a crater
    root.updateMatrixWorld(true); const wp = new THREE.Vector3();
    scene.traverse(o => { if (o.userData.drape) { o.getWorldPosition(wp); o.position.y += (groundHeight(wp.x, wp.z) + .05 - wp.y) / scene.scale.x; } });
    // lean the little scene with the slope (most of the way), so it sits on a hillside instead of hanging off it
    const nx = heightAt(s.x - 1.5, s.z) - heightAt(s.x + 1.5, s.z), nz = heightAt(s.x, s.z - 1.5) - heightAt(s.x, s.z + 1.5);
    scene.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx * .95, 3, nz * .95).normalize());
    // a tall pole with a pennant, so the stop can be seen from far away; it turns green once you have been there
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 6, 6), M.pole); pole.position.set(-1.6, 3, -1.2); root.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .8), M.flagOff); flag.position.set(-.85, 5.5, -1.2); root.add(flag);
    const label = labelSprite(s.name, false); label.position.set(0, 7.2, 0); root.add(label);
    this.group.add(root); this.meshes.set(s.id, { flag, label, root });
  }
  paint(id) {
    const m = this.meshes.get(id), s = SITES.find(x => x.id === id); if (!m || !s) return;
    const done = this.visited.has(id); m.flag.material = done ? M.flagOn : M.flagOff;
    const old = m.label; m.label = labelSprite(s.name, done); m.label.position.copy(old.position); m.root.remove(old); old.material.map.dispose(); old.material.dispose(); m.root.add(m.label);
  }
  use(id) {
    const s = SITES.find(x => x.id === id); if (!s) return;
    const first = !this.visited.has(id); this.visited.add(id); if (first) this.paint(id);
    const n = this.visited.size, total = SITES.length;
    this.modal({ title: s.name, html: `<p>${s.kid}</p><div class="fact"><div class="source">Source: <a href="${s.url}" target="_blank" rel="noopener">${s.source}</a></div></div><p class="pos">${first ? `+${s.points} science. ` : ''}Stops visited: ${n} of ${total}. In the game this stop is much closer than in real life.</p>`, pause: false });
    if (first) this.onVisit?.(s, n, total);
  }
  save() { return [...this.visited]; }
  load(d) { this.visited = new Set((d || []).filter(id => SITES.some(s => s.id === id))); for (const s of SITES) this.paint(s.id); }
}

// Dust devils: slow, swirling columns of dust that wander over the plain. Look only; they cannot hurt you.
class DustDevils {
  constructor(world, sites) {
    this.world = world; this.sites = sites; this.t = 0; this.told = false;
    this.anchors = [[-120, 150, 0.2], [60, -190, 2.1], [250, 40, 4.0]];
    this.N = 110; this.devils = this.anchors.map(() => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#c9a27c', size: 1.5, transparent: true, opacity: .3, depthWrite: false, fog: true }));
      p.frustumCulled = false; world.scene.add(p); return p;
    });
  }
  centre(i, t) { const [ax, az, ph] = this.anchors[i]; return [ax + Math.sin(t * .02 + ph) * 80, az + Math.cos(t * .017 + ph * 1.3) * 70]; }
  tick(dt) {
    this.t += dt; const pl = this.world.player?.position;
    this.devils.forEach((pts, i) => {
      const [cx, cz] = this.centre(i, this.t), base = heightAt(cx, cz), a = pts.geometry.attributes.position.array, H = 26 + i * 4;
      for (let k = 0; k < this.N; k++) {
        const f = k / this.N, r = .35 + f * f * 3.4, ang = this.t * (2.2 - f * 1.2) + k * 2.399;
        a[k * 3] = cx + Math.cos(ang) * r; a[k * 3 + 1] = base + .2 + f * H; a[k * 3 + 2] = cz + Math.sin(ang) * r;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      if (pl && !this.told && Math.hypot(pl.x - cx, pl.z - cz) < 45) { this.told = true; this.sites.onDevil?.(); }
    });
  }
}
