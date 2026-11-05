// The 3D Mars surface: terrain, sky, outpost, rocks, things to collect, and the astronaut.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadModel } from './nasamodels.js';
import { loadNasaAstronaut, poseAstronaut } from './suit.js';
import { Rover } from './rover.js';
import { makeStars, makePlanets } from './sky.js';

// ---------- terrain shape (deterministic, so every player gets the same map) ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 5) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }

export const WORLD_SIZE = 640;
// The land around the outpost is shaped like the real Gusev Crater, where NASA's Spirit rover landed:
// heights come from NASA's 3D model of the Spirit landing site (assets/gusev-height.bin, 256x256, made by
// sampling NASA's 3D-print file). The real crater is about 160 km wide - here it is shrunk so its rim is
// the hills you see around you, and heights are stretched so they are easy to see.
const GUSEV = await fetch('assets/gusev-height.bin').then(r => (r.ok ? r.arrayBuffer() : null)).then(b => b && new Uint16Array(b)).catch(() => null);
const GN = 256, G_CX = 0.52, G_CY = 0.4, G_SPAN = 980;   // crater centre in the map, and metres the map covers
function gusev(x, z) {
  const u = (G_CX + x / G_SPAN) * (GN - 1), v = (G_CY + z / G_SPAN) * (GN - 1);
  const x0 = Math.max(0, Math.min(GN - 2, Math.floor(u))), y0 = Math.max(0, Math.min(GN - 2, Math.floor(v)));
  const fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0)), at = (i, j) => GUSEV[(y0 + j) * GN + x0 + i] / 65535;
  return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
}
const FLOOR = GUSEV ? gusev(0, 0) : 0;
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h;
  if (GUSEV) {
    h = (gusev(x, z) - FLOOR) * 150;                                          // the crater floor, inner craters and rim
    h += (fbm(x * 0.05 + 7, z * 0.05 - 3, 3) - 0.5) * 4 + (fbm(x * 0.012, z * 0.012) - 0.5) * 8;   // small bumps
  } else {
    h = (fbm(x * 0.011, z * 0.011) - 0.5) * 34 + (fbm(x * 0.05 + 7, z * 0.05 - 3, 3) - 0.5) * 5;
    h += Math.max(0, fbm(x * 0.005 + 20, z * 0.005, 4) - 0.52) * 220;
  }
  const edge = Math.max(0, r - WORLD_SIZE * 0.4) * 0.6;                       // hills ring the map so it feels endless
  return (h + edge) * THREE.MathUtils.smoothstep(r, 26, 70);                  // flat landing pad around the outpost
}

function makeSky(scene) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#b8774f'); grad.addColorStop(0.55, '#d9a27a'); grad.addColorStop(1, '#efc9a4');
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  return sky;
}

// Fine sand and pebbles, tiled over the ground (made in code, so nothing to download). Light grey, so it
// only adds grain on top of the terrain's own colours.
function gravelTexture() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) { const v = 205 + rnd() * 50; img.data.set([v, v * 0.97, v * 0.94, 255], i * 4); }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 120; i++) {                       // little stones with a shadow side
    const x = rnd() * N, y = rnd() * N, r = 0.8 + rnd() * 2.6;
    g.fillStyle = `rgba(90,45,25,${0.12 + rnd() * 0.18})`; g.beginPath(); g.arc(x + r * 0.4, y + r * 0.4, r, 0, 7); g.fill();
    g.fillStyle = `rgba(255,236,215,${0.15 + rnd() * 0.2})`; g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(150, 150);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function makeTerrain() {
  const seg = 256;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = [];
  const rust = new THREE.Color('#b8643a'), dusty = new THREE.Color('#d99467'), basalt = new THREE.Color('#5e3626'), pale = new THREE.Color('#e2ab7f');
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = heightAt(x, z);
    pos.setY(i, y);
    const slope = Math.abs(heightAt(x + 1.5, z) - y) + Math.abs(heightAt(x, z + 1.5) - y);
    const n = fbm(x * 0.08, z * 0.08, 3);
    col.copy(rust).lerp(dusty, n).lerp(pale, THREE.MathUtils.clamp((y - 25) / 60, 0, 0.6)).lerp(basalt, THREE.MathUtils.clamp(slope / 4 - 0.15, 0, 0.75));
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: gravelTexture() }));
  mesh.receiveShadow = true;
  return mesh;
}

// Flat slabs and boulders like the Perseverance photo of Jezero Crater.
function makeRocks(rng) {
  const count = 520;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const rocks = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const tints = ['#8a4a2d', '#a85d39', '#6e3b28', '#c07a52'].map(c => new THREE.Color(c));
  const colliders = [];
  for (let i = 0; i < count; i++) {
    let x, z; do { x = (rng() - 0.5) * WORLD_SIZE * 0.7; z = (rng() - 0.5) * WORLD_SIZE * 0.7; } while (Math.hypot(x, z) < 24);
    const slab = rng() < 0.55, size = slab ? 1.5 + rng() * 4 : 0.4 + rng() * 2.2;
    s.set(size * (0.8 + rng()), slab ? size * 0.18 : size * (0.6 + rng() * 0.5), size * (0.8 + rng()));
    p.set(x, heightAt(x, z) + s.y * 0.35, z);
    q.setFromEuler(e.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3));
    rocks.setMatrixAt(i, m.compose(p, q, s));
    rocks.setColorAt(i, tints[Math.floor(rng() * tints.length)]);
    if (!slab && size > 1.3) colliders.push({ x, z, r: size * 0.9 });
  }
  rocks.castShadow = true; rocks.receiveShadow = true;
  return { rocks, colliders };
}

function mat(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); }
// Three.js positions can't be replaced, only changed - this places a mesh and returns it.
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

// The outpost that is "already there" when you land.
function makeOutpost() {
  const g = new THREE.Group();
  const white = mat('#ece8e1'), stripe = mat('#d9683a'), dark = mat('#23262b'), glass = new THREE.MeshLambertMaterial({ color: '#9fd7c9', transparent: true, opacity: 0.45 });
  const hab = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 4.5, 16), white); hab.position.y = 2.25; g.add(hab);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.y = 4.5; g.add(dome);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.45, 6.45, 0.5, 16), stripe); band.position.y = 3.6; g.add(band);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.6), dark); door.position.set(0, 1.5, 6.1); g.add(door);
  const doorLight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7), new THREE.MeshBasicMaterial({ color: '#7dffb2' })); doorLight.position.set(0, 3.1, 6.15); g.add(doorLight);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 10), white); tunnel.rotation.z = Math.PI / 2; tunnel.position.set(-8.5, 1.4, 1); g.add(tunnel);
  // greenhouse
  const gh = new THREE.Mesh(new THREE.SphereGeometry(4.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass); gh.position.set(-14, 0, 1); g.add(gh);
  for (let i = 0; i < 14; i++) {
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1 + (i % 3) * 0.3, 5), mat('#4caf50'));
    plant.position.set(-14 + Math.cos(i) * 2.4 * ((i % 4) / 4 + 0.3), 0.6, 1 + Math.sin(i * 1.7) * 2.2 * ((i % 3) / 3 + 0.3)); g.add(plant);
  }
  // comms dish
  const comms = new THREE.Group(); comms.position.set(9, 0, 9);
  comms.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 5, 8), white), 0, 2.5, 0));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshLambertMaterial({ color: '#ece8e1', side: THREE.DoubleSide }));
  dish.rotation.x = -Math.PI / 2.6; dish.position.y = 5.2; comms.add(dish);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: '#7dffb2' })); beacon.position.y = 6.4; comms.add(beacon);
  g.add(comms);
  // water-wall shielding ring, shown after the upgrade
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 6.9, 2.6, 18, 1, true), new THREE.MeshLambertMaterial({ color: '#3b7bd8', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  wall.position.y = 1.3; wall.visible = false; g.add(wall);
  // the lander you arrived in
  const lander = new THREE.Group(); lander.position.set(-6, 0, -17);
  lander.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 7, 12), white), 0, 4.5, 0));
  lander.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 12), white), 0, 9.5, 0));
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), dark);
    leg.position.set(Math.cos(i * Math.PI / 2) * 2.3, 1.2, Math.sin(i * Math.PI / 2) * 2.3); leg.rotation.z = Math.cos(i * Math.PI / 2) * 0.35; leg.rotation.x = -Math.sin(i * Math.PI / 2) * 0.35; lander.add(leg);
  }
  lander.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 12), stripe), 0, 6.5, 0));
  g.add(lander);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, dish, beacon, wall, colliders: [{ x: 0, z: 0, r: 7 }, { x: -14, z: 1, r: 4.4 }, { x: -8.5, z: 1, r: 1.8 }, { x: -6, z: -17, r: 2.6 }, { x: 9, z: 9, r: 0.6 }] };
}

// Sun disc + glow (the glow turns blue at sunset - real Mars sunsets are blue) and a star field for night.
function makeSkyLights(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#fff1dc', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(260); scene.add(glow);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: '#fffaf0', fog: false }));
  scene.add(disc);
  // thousands of stars and the Milky Way; the thin, dry air of Mars makes the night sky very clear
  const stars = makeStars(850, 3500, true); scene.add(stars);
  // the planets as seen from Mars tonight (NASA JPL formulas) - Earth is the blue "star"
  const planets = makePlanets(840, { from: 'mars', centre: 'earth', yaw: 0.25, pitch: 0.42, hide: ['sun'] }); scene.add(planets);
  return { glow, disc, stars, planets };
}

function makeSolarField() {
  const g = new THREE.Group(); g.position.set(16, 0, -8);
  const panelMat = new THREE.MeshLambertMaterial({ color: '#1d3a6e', flatShading: true });
  g.userData.panelMat = panelMat;
  const frame = mat('#bfbab2');
  const panels = [];
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2), panelMat); board.rotation.x = -0.45; board.position.y = 1.3; p.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), frame); post.position.y = 0.65; p.add(post);
    p.position.set((i % 4) * 3.8, 0, Math.floor(i / 4) * 3.2);
    p.traverse(o => { if (o.isMesh) o.castShadow = true; });
    p.visible = false; g.add(p); panels.push(p);
  }
  return { group: g, panels };
}

// Glowing pickups with a tall beam, like the beacon in No Man's Sky, so kids can find them.
function makePickup(kind) {
  const g = new THREE.Group();
  const looks = {
    ice:   { geo: new THREE.IcosahedronGeometry(0.7, 0), color: '#9fe7ff', beam: '#9fe7ff' },
    metal: { geo: new THREE.OctahedronGeometry(0.6, 0),  color: '#c9ced6', beam: '#ffd27a' },
    pod:   { geo: new THREE.CylinderGeometry(0.9, 1.1, 1.8, 10), color: '#f2f2f2', beam: '#ff7a3d' },
  }[kind];
  const body = new THREE.Mesh(looks.geo, new THREE.MeshLambertMaterial({ color: looks.color, emissive: looks.color, emissiveIntensity: 0.35, flatShading: true }));
  body.castShadow = true; body.position.y = 0.9; g.add(body);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: looks.beam, transparent: true, opacity: 0.35, depthWrite: false }));
  beam.position.y = 20; g.add(beam);
  g.userData.body = body;
  return g;
}

// The astronaut: `g` is where the physics puts you; `rig` holds everything you see, so the body can bob,
// lean and squash without moving the physics. Arms and legs hang from pivots at the shoulders and hips.
function makeAstronaut() {
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
  const suit = mat('#f3f1ec'), orange = mat('#e2622f'), visor = new THREE.MeshPhongMaterial({ color: '#1b2a3a', shininess: 90, specular: '#ffcf9a' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 10), suit); body.position.y = 0.95; rig.add(body);
  const head = new THREE.Group(); head.position.y = 1.62; rig.add(head);                     // the helmet nods a little as you walk
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), suit); helmet.position.y = 0.16; head.add(helmet);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 4, Math.PI / 2.4), visor); face.position.set(0, 0.18, 0.1); head.add(face);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), suit); pack.position.set(0, 1.05, -0.42); rig.add(pack);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.86), orange); band.position.y = 1.3; rig.add(band);
  const limb = (x, y, len, r) => {                       // a pivot with the limb hanging below it
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), suit); m.position.y = -len / 2 - r; pivot.add(m);
    rig.add(pivot); return pivot;
  };
  const legs = [limb(-0.18, 0.62, 0.36, 0.15), limb(0.18, 0.62, 0.36, 0.15)];
  const arms = [limb(-0.5, 1.38, 0.42, 0.11), limb(0.5, 1.38, 0.42, 0.11)];
  arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  Object.assign(g.userData, { rig, legs, arms, head });
  return g;
}

// Turn by the shortest way round (so you never spin 350° to face 10° to the left).
const WALK = 3.2, RUN = 6.2;   // m/s - a brisk walk and a low-gravity lope (take the rover for long trips)
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class World {
  constructor(renderer, facts, onLoaded) {
    this.facts = facts;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1800);
    this.scene.fog = new THREE.Fog('#d9a27a', 70, 460);
    this.sky = makeSky(this.scene);
    this.skyLights = makeSkyLights(this.scene);
    this.hemi = new THREE.HemisphereLight('#ffe2c4', '#6b3a22', 1.15); this.scene.add(this.hemi);
    this.headlamp = new THREE.SpotLight('#fff4e0', 0, 40, 0.5, 0.8, 1.4);   // switches on at night
    this.scene.add(this.headlamp, this.headlamp.target);
    this.phase = 0.3; this.dustOn = false;
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.9);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    // a tighter, sharper shadow area around you, so the suit and rover shade themselves
    Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.terrain = makeTerrain(); this.scene.add(this.terrain);

    let seed = 2126; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const { rocks, colliders } = makeRocks(rng); this.scene.add(rocks);
    this.outpost = makeOutpost(); this.scene.add(this.outpost.group);
    this.solar = makeSolarField(); this.scene.add(this.solar.group);
    this.colliders = [...colliders, ...this.outpost.colliders];
    this.door = new THREE.Vector3(0, 0, 8.2);

    this.pickups = [];
    for (let i = 0; i < 34; i++) {
      const kind = rng() < 0.55 ? 'ice' : 'metal';
      let x, z; do { const a = rng() * Math.PI * 2, d = 35 + rng() * 170; x = Math.cos(a) * d; z = Math.sin(a) * d; } while (heightAt(x, z) > 40);
      this.addPickup(kind, x, z);
    }

    // NASA's real Perseverance model (NASA/JPL-Caltech) as the old rover to salvage.
    this.rover = { x: 95, z: -110, salvaged: false, group: new THREE.Group() };
    this.rover.group.position.set(this.rover.x, heightAt(this.rover.x, this.rover.z), this.rover.z);
    this.scene.add(this.rover.group);
    const roverBeam = makePickup('metal').children[1]; roverBeam.material = roverBeam.material.clone(); roverBeam.material.color.set('#ffd27a');
    this.rover.group.add(roverBeam);
    this.colliders.push({ x: this.rover.x, z: this.rover.z, r: 2.2 });
    new GLTFLoader().load('assets/perseverance.glb', gltf => {
      const model = gltf.scene, box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      const scale = 3 / Math.max(size.x, size.z);  // the real rover is about 3 m long
      model.scale.setScalar(scale);
      const b2 = new THREE.Box3().setFromObject(model); model.position.y -= b2.min.y;
      model.rotation.y = 0.7;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material?.color) o.material.color.lerp(new THREE.Color('#c58a62'), 0.35); } }); // 105 years of Mars dust
      this.rover.group.add(model);
      onLoaded?.();
    }, undefined, err => { console.warn('Perseverance model failed to load', err); onLoaded?.(); });

    // NASA's Ingenuity helicopter (official NASA 3D model), resting near the old rover - real size, 49 cm tall
    this.heli = { x: this.rover.x + 5, z: this.rover.z + 4, seen: false };
    loadModel('ingenuity.glb').then(g => {
      if (!g) return;
      const m = g.scene, size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      m.scale.setScalar(0.49 / size.y);
      const b = new THREE.Box3().setFromObject(m);
      m.position.set(this.heli.x, heightAt(this.heli.x, this.heli.z) - b.min.y, this.heli.z);
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; for (const mt of [].concat(o.material)) { mt.metalness = Math.min(mt.metalness, 0.3); mt.color?.lerp(new THREE.Color('#c58a62'), 0.25); } } });
      this.scene.add(m); this.heli.model = m;
    });

    // NASA's Space Exploration Vehicle: a pressurised crew rover you can drive (rover.js)
    this.sev = new Rover(this.scene, heightAt, this.colliders);
    this.sevCollider = { x: this.sev.pos.x, z: this.sev.pos.z, r: 2.4, self: true };
    this.colliders.push(this.sevCollider);
    this.driving = false;

    this.player = makeAstronaut();
    this.player.position.set(-1.5, 0, -11);                 // you climb out of your capsule (the lander)...
    this.yaw = Math.atan2(1.5, 11);                          // ...and see the outpost waiting for you
    this.scene.add(this.player);

    // regolith (Mars soil) mound, shown once you bury the outpost - with a gap left for the door
    const soil = new THREE.MeshLambertMaterial({ color: '#9a5a36', flatShading: true });
    this.regolith = new THREE.Group();
    this.regolith.add(at(new THREE.Mesh(new THREE.CylinderGeometry(7.6, 8.4, 4.8, 20, 1, false, Math.PI * 0.12, Math.PI * 1.76), soil), 0, 2.4, 0));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(7.6, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil); cap.position.y = 4.6; cap.scale.y = 0.75;
    this.regolith.add(cap);
    this.regolith.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.regolith.visible = false; this.scene.add(this.regolith);

    // Team models: drop a .glb with one of these names into game/assets/ and it replaces the
    // placeholder shape automatically (scaled to the same height). No code changes needed.
    // NASA's own Astronaut 3D model, cut into jointed parts so it can really walk (suit.js).
    // If it can't load, the team model (assets/astronaut.glb) or the simple shapes are used instead.
    loadNasaAstronaut().then(a => {
      if (!a) return this.swapModel('astronaut.glb', this.player.userData.rig, 1.85);
      const rig = this.player.userData.rig;
      rig.children.forEach(c => (c.visible = false));
      rig.add(a.root); this.suit = a;
    }).catch(err => { console.warn('NASA astronaut failed', err); this.swapModel('astronaut.glb', this.player.userData.rig, 1.85); });
    this.swapModel('hab.glb', this.outpost.group.children[0].parent, null, [0, 1, 2, 3, 4]); // main hab parts
    this.swapModel('lander.glb', this.outpost.group.children.find(c => c.isGroup && c.position.z === -17), 11);
    this.vel = new THREE.Vector3(); this.onGround = true; this.pitch = 0.25;
    this.move = new THREE.Vector3(); this.gait = 0; this.swing = 0; this.squash = 0; this.lean = { x: 0, z: 0 };   // animation state
    this.firstPerson = false; this.lookPitch = 0;   // V switches view; lookPitch is up/down in first person
    this.keys = {}; this.time = 0; this.panelsDirty = false;
    this.setTime(this.phase);
  }

  swapModel(file, target, height, onlyChildren) {
    if (!target) return;
    new GLTFLoader().load('assets/' + file, gltf => {
      const model = gltf.scene;
      const old = onlyChildren ? onlyChildren.map(i => target.children[i]).filter(Boolean) : [...target.children];
      const ref = new THREE.Box3(); old.forEach(o => ref.expandByObject(o));
      const want = height ?? ref.getSize(new THREE.Vector3()).y;
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      if (size.y > 0) model.scale.setScalar(want / size.y);
      const box = new THREE.Box3().setFromObject(model); model.position.y -= box.min.y;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      old.forEach(o => (o.visible = false));
      target.add(model);
      console.info('Using team model', file);
      // If the model comes with animations named like "Idle", "Walk" and "Run" (e.g. from Mixamo), play them.
      if (file === 'astronaut.glb' && gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(model), find = re => gltf.animations.find(a => re.test(a.name));
        const clips = { idle: find(/idle|stand|breath/i), walk: find(/walk/i), run: find(/run|jog/i) };
        const actions = {};
        for (const [k, c] of Object.entries(clips)) if (c) { actions[k] = mixer.clipAction(c); actions[k].play(); actions[k].setEffectiveWeight(0); }
        this.astroAnim = { mixer, actions };
        console.info('Astronaut animations:', Object.keys(actions).join(', ') || 'none matched', gltf.animations.map(a => a.name));
      }
    }, undefined, () => { /* no team model yet - keep the placeholder */ });
  }

  // Optional team illustration: a seamless ground-detail texture (assets/art/mars-ground.*), tiled across Mars.
  // It multiplies the terrain's own colours, so a light, neutral texture works best.
  useGroundArt(url) {
    new THREE.TextureLoader().load(url, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 70); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      this.terrain.material.map = tex; this.terrain.material.needsUpdate = true;
    });
  }

  addPickup(kind, x, z) {
    const g = makePickup(kind); g.position.set(x, heightAt(x, z), z);
    this.scene.add(g); this.pickups.push({ kind, group: g, x, z });
    return g;
  }
  removePickup(p) { this.scene.remove(p.group); this.pickups.splice(this.pickups.indexOf(p), 1); }

  dropSupplyPod() {
    const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 25;
    return this.addPickup('pod', Math.cos(a) * d, Math.sin(a) * d);
  }

  setPanels(n) { this.solar.panels.forEach((p, i) => (p.visible = i < n)); }
  setPanelDust(clean) { this.solar.group.userData.panelMat.color.set('#1d3a6e').lerp(new THREE.Color('#b06a43'), (1 - clean) * 1.2); }
  setWall(level) { this.outpost.wall.visible = level > 0; }
  setRegolith(on) {
    this.regolith.visible = on;
    const hab = this.colliders.find(c => c.x === 0 && c.z === 0); if (hab) hab.r = on ? 8.2 : 7;
  }
  setLink(up) { this.outpost.beacon.material.color.set(up ? '#7dffb2' : '#ff4b3a'); this.linkUp = up; }
  setDust(on) { this.dustOn = on; this.setTime(this.phase); }

  // phase: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset (one sol = 24.66 Mars hours)
  setTime(phase) {
    this.phase = phase;
    const ang = (phase - 0.25) * Math.PI * 2, elev = Math.sin(ang);          // sun height, -1..1
    const day = THREE.MathUtils.smoothstep(elev, -0.3, 0.22);                  // 0 at night, 1 in full day (long dusty twilight)
    const dusk = Math.max(0, 1 - Math.abs(elev + 0.05) / 0.38);                // around sunrise and sunset
    const dir = new THREE.Vector3(Math.cos(ang) * 0.9, elev, 0.35).normalize();
    this.sunDir = dir;
    this.sun.intensity = (this.dustOn ? 0.6 : 1.9) * day;
    this.sun.color.set('#fff1dc').lerp(new THREE.Color('#ffc08a'), dusk);
    this.hemi.intensity = 0.22 + 0.93 * day * (this.dustOn ? 0.7 : 1);
    this.sky.material.color.set('#ffffff').lerp(new THREE.Color('#141a2e'), 1 - day);
    const fogDay = new THREE.Color(this.dustOn ? '#b06a43' : '#d9a27a');
    this.scene.fog.color.copy(fogDay).lerp(new THREE.Color('#121019'), 1 - day);
    this.scene.fog.near = this.dustOn ? 18 : 70; this.scene.fog.far = this.dustOn ? 140 : 460 - 180 * (1 - day);
    this.skyLights.stars.setOpacity((1 - day) * (this.dustOn ? 0.2 : 1));
    this.skyLights.planets.userData.setOpacity((1 - day) * (this.dustOn ? 0.15 : 0.9));
    this.skyLights.glow.material.color.set('#fff1dc').lerp(new THREE.Color('#3f86ff'), Math.min(1, dusk * 1.4));  // the blue sunset
    this.skyLights.glow.material.opacity = THREE.MathUtils.clamp((elev + 0.3) / 0.2, 0, 0.95);
    this.skyLights.glow.scale.setScalar(260 + dusk * 520);
    this.glowDir = new THREE.Vector3(dir.x, Math.max(dir.y, 0.07), dir.z).normalize();   // keep the glow just above the hills
    this.skyLights.disc.visible = elev > -0.06;
    this.headlamp.intensity = (1 - day) * 25;
    this.night = day < 0.35;
  }

  // Astronaut animation. With NASA's jointed suit (suit.js) the hips, knees and arms really move, and the body
  // rises and falls in a smooth wave over each foot. Steps follow the distance walked, so feet don't slide.
  // Mars has 38% of Earth's gravity, so running becomes long, floaty strides.
  animateAstronaut(dt, running) {
    const u = this.player.userData, rig = u.rig, speed = Math.hypot(this.move.x, this.move.z);
    const pace = Math.min(1, speed / WALK), run = THREE.MathUtils.clamp((speed - WALK) / (RUN - WALK), 0, 1);
    const ease = k => 1 - Math.exp(-dt * k);
    // face where you are going, turning smoothly (no snapping)
    if (speed > 0.4) {
      const turn = angleTo(this.player.rotation.y, Math.atan2(this.move.x, this.move.z));
      this.player.rotation.y += turn * ease(7);
      this.lean.z += (THREE.MathUtils.clamp(-turn * 0.35, -0.12, 0.12) * pace - this.lean.z) * ease(5);
    } else this.lean.z *= Math.exp(-dt * 5);
    // one full cycle (left + right step) per 2.2 m walking, 3.8 m running
    const cycle = THREE.MathUtils.lerp(2.2, 3.8, run), before = this.gait;
    if (this.onGround) this.gait += speed * dt / cycle * Math.PI * 2;
    else this.gait += (Math.round(this.gait / Math.PI) * Math.PI - this.gait) * ease(3);   // in the air: legs drift to neutral
    if (Math.floor(before / Math.PI) !== Math.floor(this.gait / Math.PI) && pace > 0.3 && this.onGround) this.onStep?.(run);
    this.swing += (pace - this.swing) * ease(6);                 // the stride grows and shrinks smoothly
    this.runMix = (this.runMix ?? 0) + (run - (this.runMix ?? 0)) * ease(4);
    this.airMix = (this.airMix ?? 0) + ((this.onGround ? 0 : 1) - (this.airMix ?? 0)) * ease(8);
    const breathe = Math.sin(this.time * 1.6) * 0.008 * (1 - this.swing);
    this.squash *= Math.exp(-dt * 8);
    let bob = 0, sway = 0;
    if (this.suit) {
      ({ bob, sway } = poseAstronaut(this.suit, { phase: this.gait, pace: this.swing, run: this.runMix, air: this.airMix, t: this.time }));
    } else {   // simple shapes: legs and arms swing, no knees
      const s = Math.sin(this.gait);
      u.legs[0].rotation.x = s * this.swing * 0.5; u.legs[1].rotation.x = -s * this.swing * 0.5;
      if (u.arms) { u.arms[0].rotation.x = -s * this.swing * 0.4; u.arms[1].rotation.x = s * this.swing * 0.4; }
      bob = ((Math.cos(this.gait * 2) + 1) / 2) * 0.04 * this.swing;
    }
    rig.position.set(sway, bob + breathe - this.squash * 0.08, 0);
    rig.scale.set(1, 1 - this.squash * 0.04, 1);
    this.lean.x += ((0.05 * this.swing + 0.1 * this.runMix) - this.lean.x) * ease(4);   // lean a little into the walk
    rig.rotation.set(this.lean.x, 0, this.lean.z);
    // first person: a gentle head bob through the helmet
    this.headBob = { y: (bob - 0.02) * 0.6 - this.squash * 0.1, x: sway * 0.6 };
    // a rigged team model with its own animations: blend idle -> walk -> run by speed
    const anim = this.astroAnim;
    if (anim && !this.suit) {
      const a = anim.actions, w = { idle: 1 - pace, walk: pace * (1 - (a.run ? run : 0)), run: a.run ? pace * run : 0 };
      if (!a.walk) w.idle = 1;
      for (const [k, act] of Object.entries(a)) act.setEffectiveWeight(w[k] ?? 0);
      if (a.walk) a.walk.timeScale = Math.max(0.4, speed / WALK) * 0.85;
      if (a.run) a.run.timeScale = Math.max(0.5, speed / RUN) * 0.85;
      anim.mixer.update(dt);
    }
  }

  // Simple circle collisions so you can't walk through the base or big boulders.
  collide(pos) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.45;
      if (d < min && d > 0.0001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    }
    const lim = WORLD_SIZE * 0.42, r = Math.hypot(pos.x, pos.z);
    if (r > lim) { pos.x *= lim / r; pos.z *= lim / r; }
  }

  enterRover() { this.driving = true; this.firstPerson = false; this.move.set(0, 0, 0); this.yaw = this.sev.yaw; this.pitch = 0.35; }
  exitRover() {
    const e = this.sev.exitPoint();
    this.driving = false; this.sev.speed = 0;
    this.player.position.set(e.x, heightAt(e.x, e.z), e.z); this.player.rotation.y = this.sev.yaw + Math.PI;
    this.yaw = this.sev.yaw + Math.PI; this.pitch = 0.25;
  }

  update(dt, controlsActive) {
    this.time += dt;
    const nearHome = Math.hypot(this.sev.pos.x, this.sev.pos.z) < 32;
    this.sev.update(dt, controlsActive ? this.keys : {}, this.driving, nearHome, this.night);
    this.sevCollider.x = this.sev.pos.x; this.sevCollider.z = this.sev.pos.z;
    if (this.driving) return this.updateDriving(dt);
    const p = this.player.position, g = this.facts.gravity.value;
    const k = this.keys, running = k.ShiftLeft || k.ShiftRight;
    const want = new THREE.Vector3();
    if (controlsActive) {
      const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      want.set(Math.sin(this.yaw) * f + Math.cos(this.yaw) * -s, 0, Math.cos(this.yaw) * f - Math.sin(this.yaw) * -s);
      if (want.lengthSq() > 0) want.normalize().multiplyScalar(running ? RUN : WALK);
      if (k.Space && this.onGround) { this.vel.y = 4.2; this.onGround = false; }   // same push as on Earth...
    }
    // Speed up and slow down smoothly (less grip in the air, and a bulky suit, so a little slide)
    const grip = this.onGround ? (want.lengthSq() ? 7 : 9) : 1.5;
    this.move.lerp(want, 1 - Math.exp(-grip * dt));
    p.x += this.move.x * dt; p.z += this.move.z * dt;
    this.vel.y -= g * dt;                                                           // ...but real Mars gravity pulls back slower
    p.y += this.vel.y * dt;
    this.collide(p);
    const ground = heightAt(p.x, p.z), wasInAir = !this.onGround;
    if (p.y <= ground) {
      if (wasInAir && this.vel.y < -1.5) this.squash = Math.min(0.6, -this.vel.y / 8);   // land with a little squash
      p.y = ground; this.vel.y = 0; this.onGround = true;
    }
    this.animateAstronaut(dt, running);

    if (this.firstPerson) {
      // first person: eyes inside the helmet, body hidden so it doesn't block the view
      this.player.visible = false;
      const hb = this.headBob || { x: 0, y: 0 };
      const eyeFP = new THREE.Vector3(p.x + Math.cos(this.yaw) * hb.x, p.y + 1.7 + hb.y, p.z - Math.sin(this.yaw) * hb.x);
      this.camera.position.copy(eyeFP);
      this.camera.lookAt(eyeFP.x + Math.sin(this.yaw) * Math.cos(this.lookPitch), eyeFP.y + Math.sin(this.lookPitch), eyeFP.z + Math.cos(this.yaw) * Math.cos(this.lookPitch));
      this.placeSky(p);
            for (const pk of this.pickups) { pk.group.userData.body.rotation.y += dt; pk.group.userData.body.position.y = 0.9 + Math.sin(this.time * 2 + pk.x) * 0.15; }
      if (this.linkUp) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
      return;
    }
    this.player.visible = true;
    // third-person camera
    const dist = 7.5, eye = new THREE.Vector3(p.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch), p.y + 2 + Math.sin(this.pitch) * dist, p.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch));
    for (const c of this.colliders) {                      // keep the camera out of buildings and boulders
      if (c.r < 2) continue;
      const dx = eye.x - c.x, dz = eye.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.8;
      if (d < min) { const k = d > 0.001 ? min / d : 1; eye.x = c.x + dx * k; eye.z = c.z + (d > 0.001 ? dz * k : min); }
    }
    eye.y = Math.max(eye.y, heightAt(eye.x, eye.z) + 0.6);
    this.camera.position.lerp(eye, 1 - Math.exp(-dt * 10));
    this.camera.lookAt(p.x, p.y + 1.6, p.z);
    this.placeSky(p);
    
    for (const pk of this.pickups) { pk.group.userData.body.rotation.y += dt; pk.group.userData.body.position.y = 0.9 + Math.sin(this.time * 2 + pk.x) * 0.15; }
    if (this.linkUp) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
  }

  // In the rover: you ride inside; the camera follows behind (or sits in the cockpit in first person).
  updateDriving(dt) {
    const r = this.sev, p = this.player.position;
    this.player.visible = false;
    p.copy(r.pos);
    this.move.set(0, 0, 0); this.swing = 0;
    if (this.firstPerson) {
      const f = 1.4, eye = new THREE.Vector3(r.pos.x + Math.sin(r.yaw) * f, r.pos.y + 2.3, r.pos.z + Math.cos(r.yaw) * f);
      this.camera.position.copy(eye);
      const yaw = r.yaw;   // look ahead through the windows
      this.camera.lookAt(eye.x + Math.sin(yaw), eye.y - 0.12 + Math.sin(this.lookPitch), eye.z + Math.cos(yaw));
    } else {
      if (Math.abs(r.speed) > 0.5) this.yaw += angleTo(this.yaw, r.yaw) * (1 - Math.exp(-dt * 2.5));   // swing round behind as you drive
      const dist = 12, eye = new THREE.Vector3(r.pos.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch), r.pos.y + 3 + Math.sin(this.pitch) * dist, r.pos.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch));
      eye.y = Math.max(eye.y, heightAt(eye.x, eye.z) + 1);
      this.camera.position.lerp(eye, 1 - Math.exp(-dt * 6));
      this.camera.lookAt(r.pos.x, r.pos.y + 2, r.pos.z);
    }
    this.placeSky(r.pos);
    for (const pk of this.pickups) { pk.group.userData.body.rotation.y += dt; pk.group.userData.body.position.y = 0.9 + Math.sin(this.time * 2 + pk.x) * 0.15; }
    if (this.linkUp) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
  }

  // Sun, glow, stars, sky and headlamp follow the camera; the sun's direction follows the time of day.
  placeSky(p) {
    const cam = this.camera.position, dir = this.sunDir || new THREE.Vector3(0.5, 0.8, 0.3);
    this.sun.position.set(p.x + dir.x * 120, p.y + Math.max(dir.y, 0.05) * 120, p.z + dir.z * 120); this.sun.target.position.copy(p);
    this.sky.position.copy(cam);
    this.skyLights.glow.position.copy(cam).addScaledVector(this.glowDir || dir, 800);
    this.skyLights.disc.position.copy(cam).addScaledVector(dir, 820);
    this.skyLights.stars.position.copy(cam); this.skyLights.planets.position.copy(cam);
    const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
    this.headlamp.position.copy(cam); this.headlamp.target.position.copy(cam).addScaledVector(look, 10);
  }

  // What the player is close enough to use with E.
  nearest() {
    if (this.driving) return { type: 'sev-exit', d: 0 };
    const p = this.player.position, list = [];
    if (this.sev.ready) list.push({ type: 'sev', d: Math.hypot(p.x - this.sev.pos.x, p.z - this.sev.pos.z) - 2.6 });
    list.push({ type: 'door', d: Math.hypot(p.x - this.door.x, p.z - this.door.z) });
    if (this.panelsDirty) list.push({ type: 'panels', d: Math.hypot(p.x - 21.7, p.z + 4.8) - 4 });
    if (!this.rover.salvaged) list.push({ type: 'rover', d: Math.hypot(p.x - this.rover.x, p.z - this.rover.z) - 1.5 });
    if (this.heli.model && !this.heli.seen) list.push({ type: 'heli', d: Math.hypot(p.x - this.heli.x, p.z - this.heli.z) });
    for (const pk of this.pickups) list.push({ type: pk.kind, pickup: pk, d: Math.hypot(p.x - pk.x, p.z - pk.z) });
    list.sort((a, b) => a.d - b.d);
    return list[0] && list[0].d < 3.2 ? list[0] : null;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
