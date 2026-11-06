// Inside the base greenhouse: a glass dome 14 m across, joined to the outpost by its tunnel.
// Four hydroponic grow beds (plants grow in water with nutrients, no soil - Mars soil has toxic perchlorate)
// under pink-purple LED bars, like NASA's Veggie garden on the ISS. Each bed is a farm plot from colony.js:
// plant seeds, water it from the pipe, harvest food for the crew. Same shape of class as interior.js.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';
import { CROPS } from './colony.js';

const R = 7, SEG = 64;                         // dome radius (metres)
export const BEDS = [-3.6, -1.2, 1.2, 3.6];     // x position of each grow bed; they run along z from -2.5 to 2.5
const BED_LEN = 5, BED_W = 1.0;

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

function label(lines, color = '#7dffb2') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = '#0b1a14'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = color; g.font = 'bold 24px Poppins, sans-serif';
  lines.forEach((l, i) => g.fillText(l, 12, 34 + i * 34));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Greenhouse {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
    this.scene.add(new THREE.HemisphereLight('#fff1e0', '#5a3a28', 1.2));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.2); sun.position.set(6, 10, 4); this.scene.add(sun);

    // the dome: clear panels on a white frame (long ribs and rings)
    const glass = new THREE.MeshStandardMaterial({ color: '#e8f4f6', transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, SEG, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass));
    const frame = std('#eceae4', { metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < 12; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 48, Math.PI), frame); rib.rotation.y = i / 12 * Math.PI; this.scene.add(rib); }
    for (const a of [0.35, 0.7, 1.05]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(R * Math.cos(a), 0.05, 8, SEG), frame); ring.rotation.x = Math.PI / 2; ring.position.y = R * Math.sin(a); this.scene.add(ring); }
    // Cut the dome skin and its ribs where they meet the passage.
    for(const member of this.scene.children.filter(o=>o.isMesh)){
      member.updateMatrix();
      const geom=member.geometry, indices=geom.index, pos=geom.attributes.position;
      const keep=[],point=new THREE.Vector3(),center=new THREE.Vector3();
      for(let i=0;i<indices.count;i+=3){
        center.set(0,0,0);
        for(let j=0;j<3;j++)center.add(point.fromBufferAttribute(pos,indices.getX(i+j)).applyMatrix4(member.matrix));
        center.multiplyScalar(1/3);
        if(center.z>5 && Math.abs(center.x)<1.59 && center.y<2.96)continue;
        keep.push(indices.getX(i),indices.getX(i+1),indices.getX(i+2));
      }
      geom.setIndex(keep);
    }
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, SEG, 1, true,.23,Math.PI*2-.46), std('#d9d4cb', { side: THREE.DoubleSide })), 0, 0.3, 0));   // low base wall
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, SEG), std('#6b7079')); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; this.scene.add(floor);
    for (const x of [-2.4, 0, 2.4]) { const path = box(1.0, 0.02, 11, std('#8a9099')); this.scene.add(at(path, x, 0.02, 0)); }   // walkways between the beds

    this.stations = [];
    // ---- the four grow beds ----
    this.beds = BEDS.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, 0); this.scene.add(g);
      const metal = std('#c9ced6', { metalness: 0.5, roughness: 0.35 });
      for (const z of [-2.3, 0, 2.3]) for (const sx of [-0.45, 0.45]) g.add(at(box(0.06, 0.7, 0.06, metal), sx, 0.35, z));   // legs
      g.add(at(box(BED_W, 0.22, BED_LEN, std('#f2f2f0')), 0, 0.8, 0));                          // white trough
      g.add(at(box(BED_W - 0.1, 0.02, BED_LEN - 0.1, std('#2d6f8f', { roughness: 0.2 })), 0, 0.92, 0));   // nutrient water
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, BED_LEN, 16), std('#3b7bd8')); pipe.rotation.x = Math.PI / 2; g.add(at(pipe, 0.55, 0.85, 0));
      for (const z of [-2.3, 2.3]) g.add(at(box(0.05, 1.6, 0.05, metal), 0, 1.6, z));             // LED posts
      const led = box(0.5, 0.06, BED_LEN, new THREE.MeshBasicMaterial({ color: '#5a4a60' })); g.add(at(led, 0, 2.4, 0));
      const light = new THREE.PointLight('#e070ff', 0, 5, 1.6); light.position.set(0, 2.2, 0); g.add(light);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 16), new THREE.MeshStandardMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.8 }));   // water level
      g.add(at(tube, -0.35, 0.3, BED_LEN / 2 + 0.15));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial()); g.add(at(sign, 0, 1.15, BED_LEN / 2 + 0.02));
      const plants = new THREE.Group(); g.add(plants);
      this.stations.push({ type: 'gh-bed', bed: i, label: `tend grow bed ${i + 1}`, x, z: BED_LEN / 2 + 0.8 });
      return { group: g, led, light, tube, sign, plants, key: '' };
    });

    // ---- water tap: pipes from the outpost's water tank ----
    const tap = new THREE.Group(); tap.position.set(-4.4, 0, -4.4); tap.lookAt(0, 0, 0); this.scene.add(tap);
    tap.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 32), new THREE.MeshStandardMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.75, roughness: 0.2 })), 0, 0.8, 0));
    tap.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 32), std('#c9ced6')), 0, 1.62, 0));
    tap.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1, 0.38), new THREE.MeshBasicMaterial({ map: label(['WATER', 'from the base'], '#9fe7ff') })), 0, 2.0, 0.3));
    this.stations.push({ type: 'gh-tap', label: 'fill your water jug at the tap', x: -3.6, z: -3.6 });

    // The pressure tunnel runs toward the habitat (+z). The exterior airlock faces west.

    this.walkwayReady = loadModel('greenhouse-walkway.glb').then(asset=>{
      if(!asset)throw new Error('Greenhouse walkway unavailable');
      const walkway=asset.scene.clone(true);
      walkway.position.z=5;
      this.scene.add(walkway);
    });
    const lock = new THREE.Group(); lock.position.set(-(R - 0.3), 0, 0); lock.rotation.y = Math.PI / 2; this.scene.add(lock);
    lock.add(at(box(1.8, 2.5, 0.15, std('#2a2e34')), 0, 1.25, 0));
    lock.add(at(box(2.0, 0.12, 0.2, new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 2.6, 0));
    this.stations.push({ type: 'gh-out', label: 'go outside through the airlock', x: -(R - 1.4), z: 0 });

    // a few potted herbs and a bench by the door, so it feels lived in
    const pot = std('#b5653d');
    for (const [x, z] of [[-2.4, 4.7], [2.4, 4.7], [5.0, 3.2]]) {
      this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 24), pot), x, 0.2, z));
      this.scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), std('#4f8f3a')), x, 0.6, z));
    }
    this.enter('hab');
  }

  enter(from) {
    this.vel = { x: 0, z: 0 }; this.step = 0; this.pitch = 0;
    if (from === 'out') { this.pos = new THREE.Vector3(-5.2, 0, 0); this.yaw = Math.PI / 2; }   // just inside the airlock, facing the beds
    else { this.pos = new THREE.Vector3(0, 0, 5.2); this.yaw = Math.PI; }                // just out of the tunnel hatch
  }

  // Show what is growing in each bed. beds: the colony's base-greenhouse plots ({ crop, grown, tank, ready }).
  draw(beds, tankMax, powered=true) {
    beds.forEach((gh, i) => {
      const b = this.beds[i], key = `${powered}|${gh.crop}|${gh.grown.toFixed(2)}|${gh.ready}|${gh.tank.toFixed(1)}`;
      if (key === b.key) return; b.key = key;
      const c = gh.crop && CROPS[gh.crop];
      b.led.material.color.set(c && powered ? '#e05cff' : '#5a4a60'); b.light.intensity = c && powered ? 3 : 0;
      b.tube.scale.y = Math.max(0.05, gh.tank / tankMax); b.tube.position.y = 0.3 * b.tube.scale.y;
      b.sign.material.map?.dispose();
      b.sign.material.map = label([`BED ${i + 1}`, !c ? 'empty - plant seeds' : gh.ready ? `${c.name.split(' ').pop()} READY` : `${c.name.split(' ').pop()} ${Math.round(gh.grown * 100)}%`], gh.ready ? '#ffd27a' : '#7dffb2');
      b.sign.material.needsUpdate = true;
      growPlants(b.plants, gh.crop, gh.grown, gh.ready);
    });
  }

  update(dt, keys, active) {
    let wx = 0, wz = 0;
    if (active) {
      const speed = keys.ShiftLeft || keys.ShiftRight ? 4 : 2.6;
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const dx = Math.sin(this.yaw) * f - Math.cos(this.yaw) * s, dz = Math.cos(this.yaw) * f + Math.sin(this.yaw) * s;
      const len = Math.hypot(dx, dz); if (len) { wx = dx / len * speed; wz = dz / len * speed; }
    }
    const k = 1 - Math.exp(-dt * 9);
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const sp = Math.hypot(this.vel.x, this.vel.z), before = this.step;
    this.step += sp * dt / 1.9 * Math.PI * 2;
    if (Math.floor(before / Math.PI) !== Math.floor(this.step / Math.PI) && sp > 1) this.onStep?.();
    const r = Math.hypot(this.pos.x, this.pos.z), max = R - 1.0;
    if(this.pos.z>5.6 && Math.abs(this.pos.x)<1.6){
      this.pos.x=THREE.MathUtils.clamp(this.pos.x,-1.12,1.12);
    } else if (r > max) { this.pos.x *= max / r; this.pos.z *= max / r; }
    for (const x of BEDS) {                         // walk around the beds, not through them
      const hx = BED_W / 2 + 0.3, hz = BED_LEN / 2 + 0.3, dx = this.pos.x - x, dz = this.pos.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz)) this.pos.x = x + Math.sign(dx || 1) * hx; else this.pos.z = Math.sign(dz || 1) * hz;
      }
    }
    const bob = (Math.cos(this.step * 2) - 1) * 0.012 * Math.min(1, sp / 2.6);
    const eye = new THREE.Vector3(this.pos.x, 1.65 + bob, this.pos.z);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.x + Math.sin(this.yaw) * Math.cos(this.pitch), eye.y + Math.sin(this.pitch), eye.z + Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  nearest() {
    let best = null;
    for (const s of this.stations) {
      const d = Math.hypot(this.pos.x - s.x, this.pos.z - s.z);
      if (d < 1.6 && (!best || d < best.d)) best = { ...s, d };
    }
    return best;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}

// Plants in two rows along a bed. Lettuce: red leafy heads; wheat: tall stalks that turn gold; potatoes: bushy leaves.
const leafCache = {};
const leafMat = c => (leafCache[c] ??= std(c, { roughness: 0.8 }));
function growPlants(group, crop, grown, ready) {
  group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  group.clear();
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const x = row ? 0.22 : -0.22, z = -2.2 + i * 0.55;
    group.add(at(box(0.12, 0.08, 0.12, leafMat('#d8cfb8')), x, 0.96, z));        // rock-wool plug the roots grow in
    if (!crop) continue;
    const s = 0.2 + grown * 0.8, p = new THREE.Group(); p.position.set(x, 0.98, z); p.scale.setScalar(s); group.add(p);
    if (crop === 'lettuce') {
      for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), leafMat(k % 2 ? '#7a2f3a' : '#9a3f4a')); l.scale.set(1, 0.45, 0.7); l.rotation.y = k * 1.26; l.position.set(Math.sin(k * 1.26) * 0.07, 0.08 + k * 0.01, Math.cos(k * 1.26) * 0.07); p.add(l); }
    } else if (crop === 'wheat') {
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.7, 6), leafMat(ready ? '#c9b25a' : '#6fae4a')); st.position.set((k % 2 - 0.5) * 0.08, 0.35, (k > 1 ? 0.5 : -0.5) * 0.08); p.add(st);
        if (grown > 0.6) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.09, 4, 8), leafMat('#d9c26a')); ear.position.set(st.position.x, 0.74, st.position.z); p.add(ear); } }
    } else {
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), leafMat('#4f8f3a')); l.position.set(Math.sin(k) * 0.1, 0.12 + (k % 3) * 0.07, Math.cos(k) * 0.1); p.add(l); }
      if (ready) for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), leafMat('#b08850')); t.position.set(k * 0.1 - 0.05, -0.02, 0.12); p.add(t); }
    }
  }
}
