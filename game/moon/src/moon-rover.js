// The pressurised rover: NASA's Space Exploration Vehicle 3D model (assets/sev.glb, NASA 3D Resources). The SEV
// began life as NASA's Lunar Electric Rover concept, so it fits the Moon. Wheels are cut out of the solid model
// (same approach as the Mars rover, using the shared splitGeometry helper, read-only) so they spin and steer.
// Handling uses lunar gravity: it floats off crater rims and lands softly, but it is just as heavy to stop.
import * as THREE from 'three';
import { loadModel } from '../../src/nasamodels.js';
import { splitGeometry } from '../../src/suit.js';
import { MOON } from './config.js';
import { heightAt, clampToWorld } from './terrain.js';

const MAX = 5.2, REVERSE = 2, ACCEL = 1.6, BRAKE = 3.2, STEER = 0.55;   // m/s, m/s^2 (game handling)

export class MoonRover {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'Rover'; scene.add(this.group);
    this.body = new THREE.Group(); this.group.add(this.body);
    this.pos = new THREE.Vector3(-12, 0, -14); this.yaw = 0.6; this.speed = 0; this.vy = 0; this.steer = 0; this.air = false;
    this.wheels = []; this.r = 0.42; this.length = 4.6; this.width = 3; this.trackT = 0;
    const lamp = (x) => { const l = new THREE.SpotLight('#f4f7ff', 0, 70, 0.5, 0.55, 1.1); l.position.set(x, 1.7, 2.3); l.target.position.set(x * 2, 0, 18); this.body.add(l, l.target); return l; };
    this.lights = [lamp(-0.8), lamp(0.8)];
    this.placeholder = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 4.4), new THREE.MeshStandardMaterial({ color: '#d8d8d4' })); this.placeholder.position.y = 1.4; this.body.add(this.placeholder);
    this.load();
    this.settle();
  }

  async load() {
    const g = await loadModel('sev.glb'); if (!g) return;
    const src = g.scene; src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), mid = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z);
    const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
    const geos = meshes.map(m => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld)));
    const low = [];
    for (const geo of geos) { const p = geo.attributes.position; for (let i = 0; i < p.count; i += 2) if (p.getY(i) < 0.85) low.push([p.getX(i), p.getZ(i)]); }
    const zs = low.filter(([x]) => Math.abs(x) > 1.3).map(([, z]) => z).sort((a, b) => a - b);
    const rows = []; let start = zs[0], prev = zs[0];
    for (const z of [...zs, Infinity]) { if (z - prev > 0.4) { rows.push([start, prev]); start = z; } prev = z; }
    const wide = rows.filter(([a, b]) => b - a > 0.4).slice(0, 3);
    const r = this.r = THREE.MathUtils.clamp(wide.reduce((s, [a, b]) => s + (b - a) / 2, 0) / (wide.length || 1), 0.3, 0.5);
    const axles = wide.map(([a, b]) => (a + b) / 2), xs = low.map(([x]) => Math.abs(x)).filter(x => x > 1.2);
    const xIn = Math.min(...xs) - 0.05, xOut = Math.max(...xs) + 0.05;
    const pick = (x, y, z) => {
      if (Math.abs(x) < xIn || Math.abs(x) > xOut || y > 2 * r + 0.05) return 'body';
      for (let i = 0; i < axles.length; i++) if (Math.hypot(y - r, z - axles[i]) < r * 1.08) return `w${i}${x < 0 ? 'L' : 'R'}`;
      return 'body';
    };
    const mats = meshes.map(m => [].concat(m.material).map(mt => { const c = mt.clone(); c.metalness = Math.min(c.metalness ?? 0, 0.35); c.roughness = Math.max(c.roughness ?? 0.6, 0.45); return c; }));
    geos.forEach((geo, mi) => {
      for (const [part, pg] of Object.entries(splitGeometry(geo, pick))) {
        const mesh = new THREE.Mesh(pg, mats[mi][0]); mesh.castShadow = true; mesh.receiveShadow = true;
        if (part === 'body') { this.body.add(mesh); continue; }
        const row = +part[1], side = part[2];
        let w = this.wheels.find(w => w.row === row && w.side === side);
        if (!w) { w = { row, side, steer: new THREE.Group(), spin: new THREE.Group() }; w.steer.position.set(0, r, axles[row]); w.steer.add(w.spin); this.body.add(w.steer); this.wheels.push(w); }
        pg.translate(0, -r, -axles[row]); w.spin.add(mesh);
      }
    });
    const front = Math.max(...axles), back = Math.min(...axles);
    this.wheels.forEach(w => (w.steers = axles[w.row] === front ? 1 : axles[w.row] === back ? -1 : 0));
    this.length = box.max.z - box.min.z; this.width = box.max.x - box.min.x;
    this.body.remove(this.placeholder); this.ready = true;
  }

  exitPoint() { const back = -this.length / 2 - 1.2; return new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * back, 0, this.pos.z + Math.cos(this.yaw) * back); }

  settle() { this.pos.y = heightAt(this.pos.x, this.pos.z); this.place(0); }

  // input: throttle -1..1, steer -1..1. Returns { driving 0..1, bump 0..1 }
  update(dt, input, colliders, prints, dust) {
    const want = input.throttle > 0 ? MAX * input.throttle : input.throttle < 0 ? -REVERSE * -input.throttle : 0;
    const grip = this.air ? 0.1 : 1;
    if (input.throttle === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), BRAKE * 0.5 * dt * grip);
    else if (Math.sign(want) !== Math.sign(this.speed) && Math.abs(this.speed) > 0.1) this.speed += Math.sign(want) * BRAKE * dt * grip;
    else this.speed += THREE.MathUtils.clamp(want - this.speed, -ACCEL * dt, ACCEL * dt) * grip;
    if (input.noPower) this.speed *= 1 - Math.min(1, dt * 1.5);
    this.steer = THREE.MathUtils.damp(this.steer, input.steer * STEER, 4, dt);
    if (!this.air) this.yaw += this.speed * Math.tan(this.steer) / 3.2 * dt;
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    this.pos.x = nx; this.pos.z = nz;
    let bump = 0;
    for (const c of colliders) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 1.8;
      if (d < r && d > 1e-4) { this.pos.x = c.x + dx / d * r; this.pos.z = c.z + dz / d * r; bump = Math.min(1, Math.abs(this.speed) / 4); this.speed *= -0.25; }
    }
    if (clampToWorld(this.pos, 6)) { this.speed *= 0.5; this.hitEdge = true; } else this.hitEdge = false;
    const ground = heightAt(this.pos.x, this.pos.z);
    if (!this.air && this.pos.y - ground > 0.35 && Math.abs(this.speed) > 2) { this.air = true; this.vy = 0; }
    if (this.air) {
      this.vy -= MOON.gravity * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) { bump = Math.max(bump, Math.min(1, -this.vy / 3)); this.pos.y = ground; this.air = false; this.vy = 0; dust?.kick(this.pos.x, ground, this.pos.z, 0, 0, 30, 2.5); }
    } else {
      const climb = ground - this.pos.y; this.pos.y = ground; this.vy = climb / Math.max(dt, 1e-3);
    }
    this.place(dt);
    // wheels
    for (const w of this.wheels) { w.spin.rotation.x += this.speed * dt / this.r; w.steer.rotation.y = this.steer * w.steers; }
    // tracks every ~0.9 m
    this.trackT += Math.abs(this.speed) * dt;
    if (!this.air && this.trackT > 0.9) {
      this.trackT = 0; const sx = Math.cos(this.yaw) * this.width * 0.36, sz = -Math.sin(this.yaw) * this.width * 0.36;
      prints?.add(this.pos.x + sx, this.pos.z + sz, this.yaw, true); prints?.add(this.pos.x - sx, this.pos.z - sz, this.yaw, true);
      if (Math.abs(this.speed) > 1.5) { const back = -this.length / 2; dust?.kick(this.pos.x + Math.sin(this.yaw) * back + sx, ground, this.pos.z + Math.cos(this.yaw) * back + sz, -Math.sin(this.yaw) * this.speed, -Math.cos(this.yaw) * this.speed, 4, 2); }
    }
    return { driving: Math.min(1, Math.abs(this.speed) / MAX), bump };
  }

  place(dt) {
    const L = 1.9, W = 1.3, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const h = (f, r) => heightAt(this.pos.x + s * f + c * r, this.pos.z + c * f - s * r);
    const pitch = this.air ? this.body.rotation.x : Math.atan2(h(-L, 0) - h(L, 0), 2 * L), roll = this.air ? this.body.rotation.z : Math.atan2(h(0, W) - h(0, -W), 2 * W);
    const k = dt ? Math.min(1, dt * 8) : 1;
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    this.body.rotation.x += (pitch - this.body.rotation.x) * k; this.body.rotation.z += (roll - this.body.rotation.z) * k;
  }
  setLights(on) { for (const l of this.lights) l.intensity = on ? 60 : 0; }
}
