// Life outside the walls: the tools you carry, the ores you mine with your pickaxe, trading samples with Earth,
// and the greenhouses you build and farm. The real science behind each part is in data/mars-facts.json
// (hematite, gypsum, meteorites, perchlorate soil, NASA's Veggie garden). Numbers marked "game" are balance.
import * as THREE from 'three';
import { heightAt } from './world.js';
import { loadModel } from './nasamodels.js';

// Three real Mars minerals that rovers have found.
export const ORES = {
  hematite: { name: 'Hematite', color: '#8e98a8', fact: 'hematite', hits: 3, yield: 2, desc: 'An iron mineral. Its little grey "blueberries" formed in water long ago.' },
  gypsum:   { name: 'Gypsum', color: '#f4efe2', fact: 'gypsum', hits: 2, yield: 2, desc: 'A soft white mineral with water locked inside it.' },
  iron:     { name: 'Meteorite iron', color: '#7a6f66', fact: 'meteorite', hits: 4, yield: 1, desc: 'Iron and nickel from a meteorite - almost pure metal.' },
};
export const TOOLS = {
  pickaxe: { name: 'Pickaxe', icon: '⛏', desc: 'Breaks ore out of rocks (NASA’s Hammer 3D model). Hold it and press Use next to a mineral rock.' },
  builder: { name: 'Builder', icon: '🛠', desc: 'NASA’s Pistol Grip Tool, the power drill astronauts use on spacewalks. Puts kits together into buildings, like a greenhouse.' },
  jug:     { name: 'Water jug', icon: '💧', desc: 'Carries 10 L of water from the base tank to your plants.' },
};
export const BELT = 2;          // your suit's tool belt holds 2 tools (game) - the rest wait in the base locker
export const BAG = 8;           // rock samples you can carry before you must unload at the base (game)
export const JUG_L = 10;        // litres in a full water jug
// Growing times are shortened for the game; the real times are shown next to them.
export const CROPS = {
  lettuce: { name: 'Red romaine lettuce', icon: '🥬', sols: 3, meals: 8,  water: 6,  real: '33 days in NASA’s 2015 ISS harvest', colour: '#7a2f3a' },
  wheat:   { name: 'Dwarf wheat',         icon: '🌾', sols: 5, meals: 15, water: 9,  real: '64–86 days in NASA chamber tests', colour: '#c9b25a' },
  potato:  { name: 'Potatoes',            icon: '🥔', sols: 6, meals: 22, water: 12, real: '90–105 days in NASA chamber tests', colour: '#4f8f3a' },
};
export const GREENHOUSE = { cost: { hematite: 3, iron: 1, parts: 2 }, max: 4, tank: 12, near: 75 };
// Earth's catalogue: you pay with Mars samples (scientists on Earth want them); goods come down on the next cargo pod.
export const SHOP = [
  { id: 'lettuce', label: '🥬 Lettuce seeds ×2', gives: { seeds: { lettuce: 2 } }, price: { gypsum: 2 } },
  { id: 'wheat',   label: '🌾 Dwarf wheat seeds', gives: { seeds: { wheat: 1 } },   price: { hematite: 2 } },
  { id: 'potato',  label: '🥔 Seed potatoes',     gives: { seeds: { potato: 1 } },  price: { hematite: 1, gypsum: 1 } },
  { id: 'parts',   label: '🔩 3 spare parts',     gives: { parts: 3 },              price: { iron: 1 } },
  { id: 'kit',     label: '🏕 Greenhouse kit (saves 2 parts)', gives: { parts: 2 }, price: { gypsum: 1, hematite: 1 } },
];
const ORE_KEYS = Object.keys(ORES);
const count = obj => Object.values(obj).reduce((a, b) => a + b, 0);
export const priceWords = price => Object.entries(price).map(([k, n]) => `${n} ${k === 'parts' ? 'parts' : ORES[k].name.toLowerCase()}`).join(' + ');

export function newColony() {
  return {
    belt: ['pickaxe'], held: 0, locker: ['builder', 'jug'],
    bag: { hematite: 0, gypsum: 0, iron: 0 }, store: { hematite: 0, gypsum: 0, iron: 0 },
    seeds: { lettuce: 2, wheat: 1, potato: 1 },    // Flight manifest for the base grow beds
    tank: 20, jug: 0,                              // litres in the base water tank and in your jug
    farmQuest: {}, greenhouses: [], mined: [], hits: {}, orders: [], request: null, seenOre: [],
    base: [0, 1, 2, 3].map(() => ({ crop: null, grown: 0, tank: 6, ready: false })),   // the 4 grow beds in the base greenhouse (greenhouse.js)
  };
}

// ---------- 3D: mineral rocks, greenhouses and the tools ----------
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function glint() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(15, 2, 2, 28); g.fillRect(2, 15, 28, 2);
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 10); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.6); return s;
}

function makeDeposit(ore, rng) {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), lam(ore === 'iron' ? '#3d3530' : ore === 'gypsum' ? '#b07a55' : '#7c4a35'));
  rock.scale.set(1.2 + rng() * 0.5, 0.55 + rng() * 0.25, 1 + rng() * 0.4); rock.position.y = 0.35; rock.rotation.y = rng() * 6; g.add(rock);
  if (ore === 'hematite') {
    // "blueberries": small grey hematite balls sitting on and around the rock (drawn bigger than the real 1-5 mm ones)
    const berry = new THREE.MeshStandardMaterial({ color: ORES.hematite.color, metalness: 0.55, roughness: 0.4 });
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + rng() * 0.05, 8, 6), berry);
      const a = rng() * Math.PI * 2, r = 0.3 + rng() * 1.3;
      b.position.set(Math.cos(a) * r, i < 12 ? 0.62 + rng() * 0.1 : 0.04, Math.sin(a) * r); g.add(b);
    }
  } else if (ore === 'gypsum') {
    // bright white veins filling cracks in the rock, like the ones Opportunity found
    const vein = new THREE.MeshStandardMaterial({ color: '#fbf8ef', emissive: '#ffffff', emissiveIntensity: 0.12, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(1.9 + rng(), 0.06, 0.08 + rng() * 0.06), vein);
      v.position.set((rng() - 0.5) * 0.6, 0.25 + rng() * 0.4, (rng() - 0.5) * 0.9); v.rotation.set(rng() * 0.6, rng() * 3, rng() * 0.5); g.add(v);
    }
  } else {
    // a dark iron-nickel meteorite with a shiny worn top, half buried in the sand
    rock.material = new THREE.MeshStandardMaterial({ color: '#4a423c', metalness: 0.7, roughness: 0.38 });
    rock.scale.set(0.9, 0.7, 0.8); rock.position.y = 0.3;
  }
  const spark = glint(); spark.position.y = 1.1; g.add(spark);
  g.userData.spark = spark;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// An inflatable greenhouse like NASA's Mars greenhouse studies: a clear tube on the ground, with hydroponic racks
// lit by pink-purple LEDs (plants use mostly red and blue light, so LEDs only make those - it saves power).
function makeGreenhouse() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e9f3f6', transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const arch = new THREE.CylinderGeometry(2.2, 2.2, 6.5, 24, 1, true, 0, Math.PI);
  arch.rotateX(Math.PI / 2); arch.rotateZ(Math.PI / 2);   // lie the half-tube along the ground, arching upwards
  g.add(new THREE.Mesh(arch, skin));
  for (const z of [-3.25, 3.25]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24, 0, Math.PI), skin); cap.position.z = z; g.add(cap);
  }
  const ribs = lam('#d9d4cb');
  for (let i = -3; i <= 3; i += 1.5) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 6, 24, Math.PI), ribs); r.position.z = i; g.add(r); }
  const rack = lam('#bfbab2');
  for (const x of [-0.9, 0.9]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 5.4), rack); t.position.set(x, 0.3, 0); g.add(t); }
  const led = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 5.2), new THREE.MeshBasicMaterial({ color: '#e05cff' })); led.position.y = 1.75; g.add(led);
  const light = new THREE.PointLight('#e070ff', 0, 9, 1.6); light.position.y = 1.4; g.add(light);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.7, roughness: 0.2 }));
  tank.position.set(0, 0.45, 3.0); g.add(tank);
  const plants = new THREE.Group(); g.add(plants);
  g.traverse(o => { if (o.isMesh && o.material !== skin) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { plants, light, led, tank, skin };
  return g;
}

function fillPlants(group, crop, grown) {
  group.clear();
  if (!crop) return;
  const c = CROPS[crop], s = 0.25 + grown * 0.75;
  const leaf = lam(c.colour), stem = lam('#5f9c45');
  for (const x of [-0.9, 0.9]) for (let z = -2.4; z <= 2.4; z += 0.6) {
    let m;
    if (crop === 'wheat') { m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 5), grown > 0.8 ? leaf : stem); m.position.y = 0.55 + 0.35 * s; }
    else if (crop === 'potato') { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), stem); m.position.y = 0.6 + 0.15 * s; }
    else { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), leaf); m.position.y = 0.6 + 0.1 * s; m.scale.y = 0.7; }
    m.position.x = x + Math.sin(z * 7) * 0.12; m.position.z = z; m.scale.multiplyScalar(s); group.add(m);
  }
}

// The tools, built to be held. In the hand they hang from the glove along the forearm; in first person they
// sit at the bottom right of your view.
// Real NASA tools (NASA 3D Resources): the Hammer is the pickaxe, the Pistol Grip Tool - the battery
// power drill astronauts use on spacewalks - is the builder. Drawn about 1.5x real size so you can see them.
const NASA_TOOL = {
  pickaxe: { file: 'hammer.glb', length: 0.55, upright: true, grip: 0.12 },
  builder: { file: 'pistol-grip-tool.glb', length: 0.42, upright: false, grip: 0 },
};
async function nasaTool(kind) {
  const spec = NASA_TOOL[kind], gltf = await loadModel(spec.file);
  if (!gltf) return null;
  const m = gltf.scene.clone(true);
  m.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    // NASA's files are plain white, which disappears against a white spacesuit - so colour them like real tools
    const mats = [].concat(o.material).map(mt => {
      const c = mt.clone(), name = (mt.name || '').toLowerCase();
      c.metalness = Math.min(c.metalness ?? 0, 0.35); c.roughness = Math.max(c.roughness ?? 1, 0.45);
      if (name.includes('grip')) c.color.set('#e2622f');                                   // rubber grip
      else if (name.includes('head')) { c.color.set('#b9bec6'); c.metalness = 0.6; c.roughness = 0.35; }   // steel head
      else if (c.color.getHSL({}).l > 0.85) c.color.set(kind === 'builder' ? '#4c5058' : '#3a3d42');      // dark handle / body
      return c;
    });
    o.material = mats.length > 1 ? mats : mats[0];
  });
  // stand the handle (the longest side) upright, with the heavy head at the top
  const s0 = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  if (spec.upright) { if (s0.z >= s0.x && s0.z >= s0.y) m.rotation.x = -Math.PI / 2; else if (s0.x > s0.y) m.rotation.z = Math.PI / 2; }
  const flip = new THREE.Group(); flip.add(m); flip.updateMatrixWorld(true);
  if (spec.upright) {
    const box = new THREE.Box3().setFromObject(flip), h = box.max.y - box.min.y, c = box.getCenter(new THREE.Vector3()), v = new THREE.Vector3();
    let top = 0, bottom = 0;
    flip.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 2) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        const r = Math.hypot(v.x - c.x, v.z - c.z);
        if (v.y > box.max.y - h * 0.2) top = Math.max(top, r); else if (v.y < box.min.y + h * 0.2) bottom = Math.max(bottom, r);
      }
    });
    if (bottom > top) flip.rotation.x = Math.PI;
  }
  const out = new THREE.Group(); out.add(flip); out.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(out), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  flip.position.set(-c.x, -box.min.y - size.y * spec.grip, -c.z);   // your glove holds it near the bottom of the handle
  out.scale.setScalar(spec.length / Math.max(size.x, size.y, size.z));
  return out;
}

export function makeTool(kind, forView = false) {
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: '#c7ccd3', metalness: 0.7, roughness: 0.35 });
  if (kind === 'pickaxe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.75, 8), lam('#2f3237')); handle.position.y = 0.3; g.add(handle);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), lam('#e2622f')); grip.position.y = 0.05; g.add(grip);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.55, 6), metal); head.rotation.z = Math.PI / 2; head.position.set(0.12, 0.66, 0); g.add(head);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.07), metal); back.position.set(-0.08, 0.66, 0); g.add(back);
  } else if (kind === 'builder') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.34), lam('#ece8e1')); body.position.y = 0.06; g.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.2), lam('#e2622f')); band.position.y = 0.13; g.add(band);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshBasicMaterial({ color: '#7dffb2' })); screen.position.set(0, 0.125, -0.06); screen.rotation.x = -Math.PI / 2; g.add(screen);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.12, 8), metal); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, 0.06, 0.22); g.add(nozzle);
  } else if (kind === 'jug') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.75, roughness: 0.2 })); body.position.y = -0.12; g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), lam('#e2622f')); cap.position.y = 0.06; g.add(cap);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Swap in NASA's own 3D model of the tool once it has loaded (the simple shape shows until then)
  if (NASA_TOOL[kind]) nasaTool(kind).then(t => {
    if (!t) return;
    g.clear(); g.add(t);
    if (forView) t.traverse(o => { if (o.material) { o.material = [].concat(o.material).map(m => Object.assign(m.clone(), { depthTest: false, fog: false })); if (o.material.length === 1) o.material = o.material[0]; } o.renderOrder = 10; });
  });
  if (forView) {
    // first person: small and low in the bottom-right corner, like a real hand holding it below your chin
    const holder = new THREE.Group(); holder.add(g);
    holder.scale.setScalar(kind === 'pickaxe' ? 0.42 : 0.6);
    g.rotation.set(-0.25, 0.5, kind === 'pickaxe' ? 0.55 : 0.15);
    if (kind === 'pickaxe') g.position.set(0.05, -0.32, 0);
    return holder;
  }
  // held in the right glove, hanging down and tilted out away from the leg, so you can see it from behind
  g.rotation.set(0, -0.35, -Math.PI / 2 + 0.65);
  if (kind === 'pickaxe') g.position.x = -0.02;
  return g;
}

export class Colony {
  constructor(world, state = newColony()) {
    this.world = world; this.s = state;
    // mineral rocks: the same places for every player (Gusev Crater's floor is basalt, so they are scattered)
    let seed = 777; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.deposits = [];
    const kinds = [...Array(12).fill('hematite'), ...Array(9).fill('gypsum'), ...Array(5).fill('iron')];
    kinds.forEach((ore, id) => {
      let x, z, tries = 0;
      do { const a = rng() * Math.PI * 2, d = 32 + rng() * (ore === 'iron' ? 190 : 150); x = Math.cos(a) * d; z = Math.sin(a) * d; tries++; }
      while (tries < 40 && (heightAt(x, z) > 38 || world.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 3)));
      const group = makeDeposit(ore, rng); group.position.set(x, heightAt(x, z) - 0.15, z);
      group.updateMatrixWorld(true);
      this.deposits.push({ id, ore, x, z, group, collider:{x,z,r:.85, top:new THREE.Box3().setFromObject(group.children[0],true).max.y} });
    });
    this.restore();
    world.extraTargets = p => this.targets(p);
  }

  // Rebuild the 3D scene from the saved state (also used after loading a save).
  restore() {
    for (const d of this.deposits) {
      const gone = this.s.mined.includes(d.id);
      const index=this.world.colliders.indexOf(d.collider);
      if(gone && index>=0)this.world.colliders.splice(index,1);
      if(!gone && index<0)this.world.colliders.push(d.collider);
      if (gone) this.world.scene.remove(d.group); else if (!d.group.parent) this.world.scene.add(d.group);
    }
    this.houses?.forEach(h => { this.world.scene.remove(h.group); this.world.colliders.splice(this.world.colliders.indexOf(h.collider), 1); });
    this.houses = this.s.greenhouses.map(gh => this.placeHouse(gh));
    this.s.base??=newColony().base; this.s.farmQuest??={};
    this.baseBeds = this.s.base.map((gh, i) => ({ gh, base: true, bed: i }));   // plots in the base greenhouse: no 3D here, greenhouse.js draws them
    this.equip();
  }

  placeHouse(gh) {
    const group = makeGreenhouse();
    group.position.set(gh.x, heightAt(gh.x, gh.z), gh.z); group.rotation.y = gh.yaw || 0;
    this.world.scene.add(group);
    const collider = { x: gh.x, z: gh.z, r: 2.6 }; this.world.colliders.push(collider);
    const h = { gh, group, collider }; this.drawHouse(h); return h;
  }
  drawHouse(h) {
    if (h.base) return;   // greenhouse.js redraws the base beds every frame it is shown
    const { plants, light, tank } = h.group.userData;
    fillPlants(plants, h.gh.crop, h.gh.grown);
    light.intensity = h.gh.crop ? 3 : 0;
    tank.scale.y = Math.max(0.05, h.gh.tank / GREENHOUSE.tank); tank.position.y = 0.45 * tank.scale.y;
  }

  // ---------- what's nearby, for the Use button ----------
  targets(p) {
    const list = [];
    for (const d of this.deposits) {
      const distance=Math.hypot(p.x-d.x,p.z-d.z);
      if(distance<4 && d.group.parent && this.world.aimsAt(d.group))
        list.push({type:'ore',deposit:d,d:distance-.9});
    }
    for (const h of this.houses) list.push({ type: 'greenhouse', house: h, d: Math.hypot(p.x - h.gh.x, p.z - h.gh.z) - 2.4 });
    return list;
  }

  // ---------- tools ----------
  get tool() { return this.s.belt[this.s.held] || null; }
  select(i) { if (i < this.s.belt.length) { this.s.held = i; this.equip(); return true; } return false; }
  equip() {
    if (this.s.held >= this.s.belt.length) this.s.held = Math.max(0, this.s.belt.length - 1);
    const t = this.tool;
    this.world.holdTool(t ? makeTool(t) : null, t ? makeTool(t, true) : null);
  }
  take(tool) {   // locker -> belt
    if (this.s.belt.length >= BELT || !this.s.locker.includes(tool)) return false;
    this.s.locker.splice(this.s.locker.indexOf(tool), 1); this.s.belt.push(tool); this.s.held = this.s.belt.length - 1; this.equip(); return true;
  }
  store(tool) {  // belt -> locker
    const i = this.s.belt.indexOf(tool); if (i < 0) return false;
    this.s.belt.splice(i, 1); this.s.locker.push(tool); this.equip(); return true;
  }
  has(tool) { return this.s.belt.includes(tool); }

  // ---------- mining ----------
  bagCount() { return count(this.s.bag); }
  // One pickaxe strike. Returns { broke, ore, got, full }.
  strike(dep) {
    const o = ORES[dep.ore];
    const hits = (this.s.hits[dep.id] || 0) + 1; this.s.hits[dep.id] = hits;
    dep.collider.top -= 0.05; dep.group.position.y -= 0.05; dep.group.rotation.y += 0.04;            // chips fly, the rock settles
    if (hits < o.hits) return { broke: false, left: o.hits - hits };
    const room = BAG - this.bagCount(), got = Math.min(room, o.yield);
    if (got <= 0) { this.s.hits[dep.id] = o.hits - 1; return { broke: false, full: true }; }
    this.s.bag[dep.ore] += got; this.s.mined.push(dep.id); this.world.scene.remove(dep.group);
    const index=this.world.colliders.indexOf(dep.collider);if(index>=0)this.world.colliders.splice(index,1);
    return { broke: true, ore: dep.ore, got, firstTime: !this.s.seenOre.includes(dep.ore) && this.s.seenOre.push(dep.ore) };
  }
  unload() {   // sample bag -> base storage
    let n = 0; for (const k of ORE_KEYS) { this.s.store[k] += this.s.bag[k]; n += this.s.bag[k]; this.s.bag[k] = 0; } return n;
  }

  // ---------- paying with ores (and parts from the outpost) ----------
  canPay(price, outpost) { return Object.entries(price).every(([k, n]) => (k === 'parts' ? outpost.parts : this.s.store[k]) >= n); }
  pay(price, outpost) {
    if (!this.canPay(price, outpost)) return false;
    for (const [k, n] of Object.entries(price)) { if (k === 'parts') outpost.parts -= n; else this.s.store[k] -= n; }
    return true;
  }
  receive(gives, outpost) {
    for (const [k, n] of Object.entries(gives.seeds || {})) this.s.seeds[k] += n;
    if (gives.parts) outpost.parts += gives.parts;
    if (gives.science) outpost.scienceSent += gives.science;
  }
  // A scientist on Earth asks for particular samples, for a bonus. A new request comes every few sols.
  newRequest(sol, rng = Math.random) {
    const ore = ORE_KEYS[Math.floor(rng() * ORE_KEYS.length)], n = ore === 'iron' ? 1 : 2 + Math.floor(rng() * 2);
    const who = { hematite: 'A geologist studying ancient water', gypsum: 'A team looking for signs of past life', iron: 'A meteorite expert' }[ore];
    this.s.request = { ore, n, who, until: sol + 8, reward: { science: 15 * n, seeds: { [['lettuce', 'wheat', 'potato'][Math.floor(rng() * 3)]]: 1 } } };
  }

  // ---------- greenhouses ----------
  // Where a new greenhouse would go: a few metres in front of you. Returns { ok, x, z, why }.
  buildSpot(p, yaw) {
    const x = p.x + Math.sin(yaw) * 6, z = p.z + Math.cos(yaw) * 6;
    if (this.s.greenhouses.length >= GREENHOUSE.max) return { ok: false, why: `You already have ${GREENHOUSE.max} greenhouses - that's the most the base can power.` };
    if (Math.hypot(x, z) > GREENHOUSE.near) return { ok: false, why: 'Too far from the outpost: greenhouses need its power and water pipes. Build within 75 m.' };
    if (Math.hypot(x, z) < 12) return { ok: false, why: 'Too close to the outpost - move a little further out.' };
    const h = [[3, 3], [-3, 3], [3, -3], [-3, -3]].map(([a, b]) => heightAt(x + a, z + b));
    if (Math.max(...h) - Math.min(...h) > 1.6) return { ok: false, why: 'The ground here is too bumpy. Find a flat spot.' };
    if (this.world.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 3.5)) return { ok: false, why: 'Something is in the way. Find a clear spot.' };
    if (this.deposits.some(d => !this.s.mined.includes(d.id) && Math.hypot(d.x - x, d.z - z) < 4)) return { ok: false, why: 'A mineral rock is in the way - mine it first, or move.' };
    return { ok: true, x, z };
  }
  build(spot, yaw) {
    const gh = { x: spot.x, z: spot.z, yaw, crop: null, grown: 0, tank: 0, ready: false };
    this.s.greenhouses.push(gh); this.houses.push(this.placeHouse(gh)); return gh;
  }
  plant(h, crop) {
    if (!this.s.seeds[crop] || h.gh.crop) return false;
    this.s.seeds[crop] -= 1; Object.assign(h.gh, { crop, grown: 0, ready: false }); this.drawHouse(h); return true;
  }
  water(h) {   // pour the jug into the greenhouse tank
    const pour = Math.min(this.s.jug, GREENHOUSE.tank - h.gh.tank); if (pour <= 0) return 0;
    this.s.jug -= pour; h.gh.tank += pour; this.drawHouse(h); return pour;
  }
  // The base greenhouse is plumbed into the outpost's water tank, so its beds fill straight from the pipe.
  waterFromPipe(h) {
    const pour = Math.min(this.s.tank, GREENHOUSE.tank - h.gh.tank); if (pour <= 0) return 0;
    this.s.tank -= pour; h.gh.tank += pour; return pour;
  }
  fillJug() { const want = Math.min(JUG_L - this.s.jug, this.s.tank); this.s.jug += want; this.s.tank -= want; return want; }
  harvest(h, outpost) {
    if (!h.gh.ready) return 0;
    const meals = Math.round(CROPS[h.gh.crop].meals * (1 + 0.4 * outpost.upgrades.greenhouse));
    this.s.produce = (this.s.produce || 0) + meals;
    if(h.gh.crop==='potato')this.s.seeds.potato++; // reserve a seed tuber for replanting
    outpost.harvestMeals += meals;
    Object.assign(h.gh, { crop: null, grown: 0, ready: false }); this.drawHouse(h); return meals;
  }
  // Once per sol: plants drink from their tank and grow. With a dry tank, or no power for the lights, they wait.
  tickSol(outpost) {
    const notes = [];
    for (const h of [...this.houses, ...this.baseBeds]) {
      const gh = h.gh; if (!gh.crop || gh.ready) continue;
      const c = CROPS[gh.crop], drink = c.water / c.sols;
      if(outpost.today.total*outpost.split.life<1){notes.push({type:'unpowered',gh});continue;}
      if (gh.tank < drink - 1e-6) { notes.push({ type: 'thirsty', gh }); continue; }
      gh.tank -= drink;
      gh.grown = Math.min(1, gh.grown + (outpost.today.cold ? 0.5 : 1) / c.sols);   // freezing nights slow them down
      if (gh.grown >= 1 - 1e-6) { gh.ready = true; notes.push({ type: 'ripe', gh }); }
      this.drawHouse(h);
    }
    if (this.s.request && outpost.sol > this.s.request.until) this.s.request = null;
    if (!this.s.request && outpost.sol % 5 === 2) this.newRequest(outpost.sol);
    return notes;
  }

  // Sparkles twinkle on mineral rocks you haven't mined yet, so they catch your eye from a distance.
  update(t, night) {
    for (const d of this.deposits) {
      const sp = d.group.userData.spark; if (!d.group.parent) continue;
      sp.material.opacity = (0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 + d.id * 1.7)) ** 6) * (night ? 0.5 : 1);
    }
    for (const h of this.houses) h.group.userData.led.material.color.set(h.gh.crop ? '#e05cff' : '#5a4a60');
  }
}
