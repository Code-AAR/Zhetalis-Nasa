// Outpost hardware and task markers: vertical solar masts that turn to the low polar Sun, the ice processor,
// the Earth antenna, the ice drill in the dark crater, rock samples and science instruments.
import * as THREE from 'three';
import { SITES } from './config.js';
import { heightAt } from './terrain.js';
import { LANDER } from './lander.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...o });
const WHITE = mat('#e9e9e6'), GREY = mat('#6a6e73', { metalness: 0.5 }), GOLD = mat('#cfa64c', { metalness: 0.85, roughness: 0.3 });
const cellTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#0d1b3a'; g.fillRect(0, 0, 64, 128); g.strokeStyle = '#4c71b8'; g.lineWidth = 1.5;
  for (let y = 0; y <= 128; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  for (let x = 0; x <= 64; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const CELLS = new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.3, metalness: 0.5, emissive: '#0a1c44', emissiveIntensity: 0.3, side: THREE.DoubleSide });
const at = (o, x, z, dy = 0) => { o.position.set(x, heightAt(x, z) + dy, z); return o; };
const shadow = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

function mast() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 12), WHITE); pole.position.y = 5.5; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 6), GREY); base.position.y = 0.25; g.add(base);
  const head = new THREE.Group(); head.position.y = 6.5; g.add(head);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8, 0.06), CELLS); head.add(panel);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 0.12), GREY); frame.position.y = 4; head.add(frame);
  g.userData.head = head; g.userData.panel = panel;
  return shadow(g);
}
function folded() {
  const g = new THREE.Group(); const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), WHITE); crate.position.y = 0.5; g.add(crate);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), GREY); stub.position.y = 1.6; g.add(stub); return shadow(g);
}
function processor() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2), WHITE); box.position.y = 1; g.add(box);
  for (const x of [-0.8, 0.8]) { const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 6, 16), GOLD); tank.rotation.z = Math.PI / 2; tank.position.set(x, 2.3, 0); g.add(tank); }
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 2.6), mat('#f4f4f2', { metalness: 0.6, roughness: 0.25 })); rad.position.set(1.9, 1.4, 0); g.add(rad);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: '#333' })); lamp.position.set(-1.2, 2, 1.02); g.add(lamp);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.6, 16, 1, true), GREY); funnel.position.set(0.6, 2.2, 0.6); g.add(funnel);
  g.userData.lamp = lamp; return shadow(g);
}
function antenna() {
  const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), GREY); pole.position.y = 1.2; g.add(pole);
  const head = new THREE.Group(); head.position.y = 2.5; g.add(head);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 0.6), mat('#f2f2ef', { side: THREE.DoubleSide })); dish.rotation.x = -Math.PI / 2; head.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), GREY); feed.rotation.x = Math.PI / 2; feed.position.z = 0.5; head.add(feed);
  g.userData.head = head; return shadow(g);
}
function drillRig() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), GREY); leg.position.set(Math.cos(a) * 0.8, 1.4, Math.sin(a) * 0.8); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(leg); }
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), WHITE); motor.position.y = 2.9; g.add(motor);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 2.6, 8), GOLD); bit.position.y = 1.3; g.add(bit);
  const light = new THREE.PointLight('#bfe0ff', 6, 14, 1.5); light.position.y = 3.2; g.add(light);
  g.userData.bit = bit; return shadow(g);
}
function seismometer() {
  const g = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), GOLD); g.add(dome);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 24), mat('#c8a54e', { metalness: 0.8, roughness: 0.4 })); g.add(skirt); return shadow(g);
}
function reflector() {
  const g = new THREE.Group(); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), GREY); leg.position.y = 0.25; g.add(leg);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.08), mat('#9fb1c4', { metalness: 0.9, roughness: 0.08 })); face.position.y = 0.7; face.rotation.x = -0.9; g.add(face); return shadow(g);
}
function sampleRock(seed) {
  const n = [...seed].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 7 + 1.3;
  const geo = new THREE.DodecahedronGeometry(0.28, 0); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * n) * 0.2), p.getY(i) * 0.7, p.getZ(i));
  geo.computeVertexNormals();
  const colours = { anorthosite: '#d9d7d0', breccia: '#7d7a74', glass: '#6c5134', ejecta: '#b8b5ad' };
  return shadow(new THREE.Mesh(geo, mat(colours[seed] || '#999', { flatShading: true, roughness: 0.8, metalness: seed === 'glass' ? 0.4 : 0 })));
}

// Tall thin light beam + ground ring so goals are easy to find for kids.
function beacon(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })); beam.position.y = 20; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
  g.userData.ring = ring; return g;
}

export class Outpost {
  constructor(scene, lander) {
    this.scene = scene; this.lander = lander;
    this.masts = SITES.masts.map(p => { const up = at(mast(), p.x, p.z), down = at(folded(), p.x, p.z); scene.add(up, down); return { up, down, p }; });
    this.proc = at(processor(), SITES.processor.x, SITES.processor.z); this.proc.rotation.y = -0.6; scene.add(this.proc);
    this.ant = at(antenna(), SITES.antenna.x, SITES.antenna.z); scene.add(this.ant);
    this.drill = at(drillRig(), SITES.drill.x + 2, SITES.drill.z); this.drill.visible = false; scene.add(this.drill);
    this.seis = at(seismometer(), SITES.seismometer.x, SITES.seismometer.z); this.refl = at(reflector(), SITES.reflector.x, SITES.reflector.z);
    scene.add(this.seis, this.refl);
    this.rocks = SITES.samples.map(s => { const r = at(sampleRock(s.id), s.x, s.z, 0.12); scene.add(r); return { r, s }; });
    this.beacons = new Map();
    const add = (id, color, x, z) => { const b = at(beacon(color), x, z); scene.add(b); this.beacons.set(id, b); };
    SITES.masts.forEach((p, i) => add('mast' + i, '#ffd34d', p.x, p.z));
    add('drill', '#5ab8ff', SITES.drill.x, SITES.drill.z);
    add('processor', '#7dffb2', SITES.processor.x + 2.5, SITES.processor.z + 2.5);
    SITES.samples.forEach(s => add('sample-' + s.id, '#ffb347', s.x, s.z));
    add('seismometer', '#ffffff', SITES.seismometer.x, SITES.seismometer.z); add('reflector', '#ffffff', SITES.reflector.x, SITES.reflector.z);
    add('elevator', '#7dffb2', 0, LANDER.radius + 2.6);
    this.t = 0;
  }

  colliders() {
    const list = [{ x: 0, z: 0, r: LANDER.radius + 0.3 }, { x: SITES.processor.x, z: SITES.processor.z, r: 1.7 }, { x: SITES.antenna.x, z: SITES.antenna.z, r: 0.5 }];
    this.masts.forEach(m => list.push({ x: m.p.x, z: m.p.z, r: 0.9 }));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; list.push({ x: Math.sin(a) * LANDER.legReach, z: Math.cos(a) * LANDER.legReach, r: 0.8 }); }
    return list;
  }

  // Interactable spots for the current state, each { id, x, z, r, label, hold (s), kind }.
  spots(s, place) {
    const L = [];
    if (place === 'outside') {
      L.push({ id: 'elevator', x: 0, z: LANDER.radius + 2.6, r: 2.2, label: 'Ride the elevator up to the cabin', hold: 0 });
      s.masts.forEach((up, i) => { if (!up) L.push({ id: 'mast', i, x: SITES.masts[i].x, z: SITES.masts[i].z, r: 2.6, label: 'Raise solar mast', hold: 2 }); });
      L.push({ id: 'drill', x: SITES.drill.x, z: SITES.drill.z, r: 4, label: 'Drill for ice', hold: 3 });
      const nP = s.handIce || s.roverIce ? 'Put ice in the melter' : s.electrolysis ? 'Switch oxygen maker OFF' : 'Switch oxygen maker ON (uses power + water)';
      L.push({ id: 'processor', x: SITES.processor.x, z: SITES.processor.z, r: 3.6, label: nP, hold: 0 });
      SITES.samples.forEach(x => { if (!s.samples[x.id] && !s.carried.includes(x.id)) L.push({ id: 'sample', sid: x.id, x: x.x, z: x.z, r: 2.4, label: 'Scan & bag: ' + x.name, hold: 1.5 }); });
      for (const k of ['seismometer', 'reflector']) if (!s.instruments[k]) L.push({ id: 'instrument', key: k, x: SITES[k].x, z: SITES[k].z, r: 2.6, label: k === 'seismometer' ? 'Set up the seismometer' : 'Set up the laser reflector', hold: 2 });
    }
    return L;
  }

  update(dt, s, sunAz, sunLit, earthAz, earthEl) {
    this.t += dt;
    this.masts.forEach((m, i) => { m.up.visible = !!s.masts[i]; m.down.visible = !s.masts[i]; m.up.userData.head.rotation.y = THREE.MathUtils.degToRad(-sunAz) + Math.PI; });
    this.proc.userData.lamp.material.color.set(s.electrolysis ? '#5dff9a' : s.processorIce > 0 ? '#ffb347' : '#333333');
    this.ant.userData.head.rotation.set(-THREE.MathUtils.degToRad(earthEl), THREE.MathUtils.degToRad(-earthAz) + Math.PI, 0, 'YXZ');
    this.drill.visible = s.stats.iceLoads > 0;
    this.seis.visible = s.instruments.seismometer; this.refl.visible = s.instruments.reflector;
    for (const { r, s: x } of this.rocks) r.visible = !s.samples[x.id] && !s.carried.includes(x.id);
    const show = (id, v) => { const b = this.beacons.get(id); if (b) { b.visible = v; b.userData.ring.rotation.z = this.t * 0.6; } };
    s.masts.forEach((up, i) => show('mast' + i, !up));
    show('drill', !s.tasks.ice || s.handIce === 0 && s.roverIce < 3 && !s.tasks.deliver);
    show('processor', !!(s.handIce || s.roverIce) || (s.tasks.deliver && !s.tasks.oxygen));
    SITES.samples.forEach(x => show('sample-' + x.id, !s.samples[x.id] && !s.carried.includes(x.id)));
    show('seismometer', !s.instruments.seismometer); show('reflector', !s.instruments.reflector);
    show('elevator', s.carried.length > 0 || !!s.alert);
  }
}
