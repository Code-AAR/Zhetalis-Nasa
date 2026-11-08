// The astronaut on foot. Reuses the shared Mars game's skinned NASA astronaut (src/suit.js, read-only) and
// recolours its boot dust from Mars red to lunar grey. Movement uses real lunar gravity (1.62 m/s^2): jumps
// float, running becomes a bouncy lope, and walking fast downhill makes you skip off the ground.
// Bootprints stay: with no wind on the Moon nothing wipes them away (bounded ring buffer, saved).
import * as THREE from 'three';
import { loadNasaAstronaut, poseAstronaut } from '../../src/suit.js';
import { MOON } from './config.js';
import { heightAt, normalAt, clampToWorld } from './terrain.js';
import { MAX_PRINTS } from './save.js';

const WALK = 1.5, LOPE = 3.1, ACCEL = 2.6, JUMP = 2.3;   // m/s; jump 2.3 m/s -> ~1.6 m high, ~2.8 s in the air

function printTexture(kind) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  if (kind === 'boot') {
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(32, 64, 22, 56, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3;
    for (let y = 18; y < 116; y += 9) { g.beginPath(); g.moveTo(14, y); g.lineTo(50, y); g.stroke(); }
  } else {
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(8, 0, 48, 128);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 0; y < 128; y += 10) g.fillRect(8, y, 48, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Bootprints and rover tracks as two instanced meshes; positions are kept so they can be saved.
export class Prints {
  constructor(scene) {
    this.list = [];
    const mk = (kind, w, l) => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: printTexture(kind), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4 }), MAX_PRINTS); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; scene.add(m); return m; };
    this.boot = mk('boot', 0.16, 0.34); this.track = mk('track', 0.32, 0.9);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3();
  }
  add(x, z, yaw, track = false) { this.list.push([x, z, yaw, track ? 1 : 0]); if (this.list.length > MAX_PRINTS) this.list.shift(); this.dirty = true; }
  load(list) { this.list = (list || []).filter(p => Array.isArray(p) && p.length >= 3).map(p => [p[0], p[1], p[2], p[3] ? 1 : 0]).slice(-MAX_PRINTS); this.dirty = true; }
  update() {
    if (!this.dirty) return; this.dirty = false;
    let b = 0, t = 0; const n = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), yq = new THREE.Quaternion();
    for (const [x, z, yaw, tr] of this.list) {
      const nn = normalAt(x, z); n.set(nn.x, nn.y, nn.z);
      this.q.setFromUnitVectors(up, n).multiply(yq.setFromAxisAngle(up, yaw));
      this.m.compose(this.v.set(x, heightAt(x, z) + 0.02, z), this.q, new THREE.Vector3(1, 1, 1));
      if (tr) this.track.setMatrixAt(t++, this.m); else this.boot.setMatrixAt(b++, this.m);
    }
    this.boot.count = b; this.track.count = t; this.boot.instanceMatrix.needsUpdate = this.track.instanceMatrix.needsUpdate = true;
  }
}

export class Astronaut {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'Astronaut'; scene.add(this.group);
    this.pos = new THREE.Vector3(0, 0, 9); this.vel = new THREE.Vector3(); this.yaw = Math.PI; this.vy = 0;
    this.grounded = true; this.phase = 0; this.air = 0; this.lastStep = 0; this.t = 0; this.swing = -1;
    this.fallback = makeFallback(); this.group.add(this.fallback);
    this.lamp = new THREE.SpotLight('#eaf2ff', 0, 40, 0.55, 0.5, 1.2); this.lamp.position.set(0, 1.75, 0.15); this.lamp.target.position.set(0, 0.6, 8);
    this.group.add(this.lamp, this.lamp.target);
    loadNasaAstronaut().then(a => {
      if (!a) return;
      a.root.traverse(o => {   // grey Moon dust instead of the Mars game's red dust
        const col = o.geometry?.attributes?.color; if (!col) return;
        for (let i = 0; i < col.count; i++) { const l = col.getX(i) * 0.3 + col.getY(i) * 0.59 + col.getZ(i) * 0.11; col.setXYZ(i, l, l, l * 0.99); }
        col.needsUpdate = true;
      });
      this.rig = a; this.group.remove(this.fallback); this.group.add(a.root);
    });
  }

  // input: { x, z } in camera space (-1..1), run, jump. camYaw = camera heading.
  update(dt, input, camYaw, colliders, dust, prints, onStep) {
    this.t += dt;
    const want = new THREE.Vector3(input.x, 0, input.z); const mag = Math.min(1, want.length());
    if (mag > 0.05) want.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw).multiplyScalar(mag * (input.run ? LOPE : WALK));
    else want.set(0, 0, 0);
    // low gravity = less grip: speed changes slowly, and hardly at all in the air
    const grip = this.grounded ? ACCEL : 0.25;
    const dv = want.clone().sub(this.vel.clone().setY(0)); const lim = grip * dt;
    if (dv.length() > lim) dv.setLength(lim);
    this.vel.x += dv.x; this.vel.z += dv.z;
    // don't walk up walls steeper than ~35 degrees
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const rise = heightAt(nx, nz) - heightAt(this.pos.x, this.pos.z), run = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    if (this.grounded && run > 1e-4 && rise / run > 0.7) { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    else { this.pos.x = nx; this.pos.z = nz; }
    for (const c of colliders) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.35;
      if (d < r && d > 1e-4 && (c.top === undefined || this.pos.y < c.top)) { this.pos.x = c.x + dx / d * r; this.pos.z = c.z + dz / d * r; const n = (this.vel.x * dx + this.vel.z * dz) / d; if (n < 0) { this.vel.x -= n * dx / d; this.vel.z -= n * dz / d; } }
    }
    this.hitEdge = clampToWorld(this.pos, 3);
    const ground = heightAt(this.pos.x, this.pos.z);
    if (this.grounded && input.jump) { this.vy = JUMP; this.grounded = false; this.jumped = true; }
    if (this.grounded) {
      if (this.pos.y - ground > 0.25) { this.grounded = false; this.vy = 0; }   // ground fell away: skip into the air
      else { this.pos.y = ground; this.vy = 0; }
    }
    if (!this.grounded) {
      this.vy -= MOON.gravity * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        const impact = -this.vy; this.pos.y = ground; this.grounded = true; this.vy = 0;
        if (impact > 1) { dust?.kick(this.pos.x, ground, this.pos.z, this.vel.x, this.vel.z, Math.min(30, impact * 8), 1 + impact * 0.4); onStep?.(Math.min(1, impact / 3)); prints?.add(this.pos.x - 0.12, this.pos.z, this.yaw); prints?.add(this.pos.x + 0.12, this.pos.z, this.yaw); }
      }
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.2) this.yaw = lerpAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), Math.min(1, dt * 7));
    this.air = THREE.MathUtils.damp(this.air, this.grounded ? 0 : 1, 9, dt);
    if (this.grounded) {
      const stride = input.run ? 2.2 : 1.3;
      this.phase += speed / stride * Math.PI * dt * 2 * 0.5;
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep && speed > 0.3) {
        this.lastStep = step; const side = step % 2 ? 1 : -1, sx = Math.cos(this.yaw) * 0.13 * side, sz = -Math.sin(this.yaw) * 0.13 * side;
        prints?.add(this.pos.x + sx, this.pos.z + sz, this.yaw);
        dust?.kick(this.pos.x + sx, ground, this.pos.z + sz, this.vel.x, this.vel.z, input.run ? 7 : 3, input.run ? 1.6 : 0.8);
        onStep?.(input.run ? 0.6 : 0.35);
      }
    }
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    const pace = Math.min(1, speed / WALK), lope = Math.max(0, Math.min(1, (speed - WALK) / (LOPE - WALK)));
    if (this.rig) {
      const o = poseAstronaut(this.rig, { phase: this.phase, pace, run: lope, air: this.air, t: this.t, vy: this.vy, swing: this.swing });
      this.rig.root.position.y = o.bob * (1 + lope * 1.5); this.rig.root.position.x = o.sway;
    }
    this.speed = speed;
  }
  head() { return this.pos.clone().add(new THREE.Vector3(0, 1.6, 0)); }
}

function makeFallback() {
  const g = new THREE.Group(), w = new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 12), w); body.position.y = 1.0; g.add(body);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.2 })); helm.position.y = 1.7; g.add(helm);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export const lerpAngle = (a, b, t) => a + ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * t;
