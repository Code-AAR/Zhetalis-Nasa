// A white lander INSPIRED BY human landing system concepts, for a made-up future surface-training scenario.
// It is not a real NASA or company design: a tall white crew lander with a crew elevator, a solar band,
// landing thrusters high on the body (so the plume hits the ground less hard) and six legs.
// No reentry fins or flaps: there is no air on the Moon to steer with.
//
// Landing dust is BALLISTIC: with no air, each grain flies in a clean arc under 1.62 m/s^2 and lands.
// Nothing billows or hangs in the sky afterwards.
import * as THREE from 'three';
import { MOON } from './config.js';
import { heightAt } from './terrain.js';

const white = new THREE.MeshStandardMaterial({ color: '#f1f2f0', roughness: 0.55, metalness: 0.08 });
const grey = new THREE.MeshStandardMaterial({ color: '#5d6166', roughness: 0.6, metalness: 0.4 });
const dark = new THREE.MeshStandardMaterial({ color: '#1d2126', roughness: 0.45, metalness: 0.5 });
const gold = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.8 });
const glass = new THREE.MeshStandardMaterial({ color: '#0f1c2a', roughness: 0.1, metalness: 0.6, emissive: '#2d4d6e', emissiveIntensity: 0.6 });
const cell = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#0d1a33'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#3a5f9a'; g.lineWidth = 2;
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const solar = new THREE.MeshStandardMaterial({ map: cell, roughness: 0.3, metalness: 0.5, emissive: '#0a1e44', emissiveIntensity: 0.35 });

export const LANDER = { radius: 4.2, height: 40, hatchY: 29.5, legReach: 7.2 };

export function buildLander() {
  const g = new THREE.Group(); g.name = 'Training lander (HLS-inspired)';
  const R = LANDER.radius, add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(R, R, 32, 48, 1), white, 0, 4 + 16);                     // main body
  // ogive nose
  const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(R * Math.cos(t * Math.PI / 2) ** 0.8, t * 8)); }
  add(new THREE.LatheGeometry(prof, 48), white, 0, 36);
  add(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 3.2, 48, 1, true), solar, 0, 21);      // solar band
  add(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.25, 48), grey, 0, 19.3);
  add(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.25, 48), grey, 0, 22.7);
  add(new THREE.CylinderGeometry(R * 0.98, R * 0.9, 4, 48), dark, 0, 2);                    // aft skirt
  // crew deck windows
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2, w = add(new THREE.BoxGeometry(0.9, 0.6, 0.12), glass, Math.sin(a) * (R + 0.02), 31.2, Math.cos(a) * (R + 0.02));
    w.rotation.y = a;
  }
  // airlock hatch + crew elevator rail on the +z side
  add(new THREE.BoxGeometry(1.6, 2.2, 0.2), grey, 0, LANDER.hatchY + 1.1, R + 0.05);
  add(new THREE.BoxGeometry(0.18, 30, 0.18), grey, -1.1, 15.5, R + 0.4); add(new THREE.BoxGeometry(0.18, 30, 0.18), grey, 1.1, 15.5, R + 0.4);
  const lift = new THREE.Group(); lift.name = 'Crew elevator';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 1.8), grey); deck.castShadow = true; lift.add(deck);
  for (const x of [-1.15, 1.15]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.8), gold); rail.position.set(x, 0.55, 0); lift.add(rail); }
  lift.position.set(0, LANDER.hatchY, R + 1.25); g.add(lift); g.userData.lift = lift;
  // landing thrusters high on the body
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, pod = add(new THREE.BoxGeometry(1.1, 2.4, 0.7), white, Math.sin(a) * (R + 0.3), 25.5, Math.cos(a) * (R + 0.3)); pod.rotation.y = a;
    const bell = add(new THREE.CylinderGeometry(0.22, 0.38, 0.6, 16), dark, Math.sin(a) * (R + 0.45), 24, Math.cos(a) * (R + 0.45)); bell.rotation.x = 0;
  }
  // main engine bells
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(new THREE.CylinderGeometry(0.5, 1.1, 1.6, 24, 1, true), dark, Math.sin(a) * 1.6, -0.2, Math.cos(a) * 1.6); }
  // six legs with footpads
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, top = new THREE.Vector3(Math.sin(a) * R * 0.95, 6, Math.cos(a) * R * 0.95), foot = new THREE.Vector3(Math.sin(a) * LANDER.legReach, -1.6, Math.cos(a) * LANDER.legReach);
    const len = top.distanceTo(foot), leg = add(new THREE.CylinderGeometry(0.16, 0.2, len, 10), grey);
    leg.position.copy(top).add(foot).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foot.clone().sub(top).normalize());
    const pad = add(new THREE.CylinderGeometry(0.7, 0.8, 0.18, 20), grey, foot.x, foot.y, foot.z);
    const strut = add(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), gold); strut.position.set(Math.sin(a) * (R + 1.3), 1.5, Math.cos(a) * (R + 1.3)); strut.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
  }
  // engine glow (in vacuum the plume spreads wide and is almost invisible - just a soft glow)
  const glowMat = new THREE.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 24, 1, true), glowMat); plume.position.y = -5; plume.rotation.x = Math.PI; g.add(plume);
  const engineLight = new THREE.PointLight('#d9e8ff', 0, 60, 1.6); engineLight.position.y = -3; g.add(engineLight);
  g.userData.plume = plume; g.userData.engineLight = engineLight;
  return g;
}

// Landing-dust particles: launched outward at a low angle, then pure free fall (no drag).
export class BallisticDust {
  constructor(scene, max = 2400) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setDrawRange(0, 0);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#b9b7b0', size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  // Emit grains around (x,z) where the plume hits. strength 0..1.
  emit(x, z, strength, dt) {
    const count = Math.min(this.max - this.n, Math.floor(strength * 1800 * dt));
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6, speed = 12 + Math.random() * 40 * strength, up = (1 + Math.random() * 7) * Math.PI / 180;
      const i = this.n++ * 3, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      this.pos.set([px, heightAt(px, pz) + 0.05, pz], i);
      this.vel.set([Math.cos(a) * speed * Math.cos(up), speed * Math.sin(up), Math.sin(a) * speed * Math.cos(up)], i);
    }
  }
  // Also used for boot and wheel kicks: a few grains from one spot.
  kick(x, y, z, vx, vz, count = 6, speed = 1.6) {
    for (let k = 0; k < count && this.n < this.max; k++) {
      const i = this.n++ * 3, a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      this.pos.set([x, y + 0.03, z], i); this.vel.set([vx * 0.4 + Math.cos(a) * s * 0.5, s * (0.6 + Math.random() * 0.8), vz * 0.4 + Math.sin(a) * s * 0.5], i);
    }
  }
  update(dt) {
    const g = MOON.gravity; let w = 0;
    for (let r = 0; r < this.n; r++) {
      const i = r * 3, x = this.pos[i] + this.vel[i] * dt, z = this.pos[i + 2] + this.vel[i + 2] * dt, vy = this.vel[i + 1] - g * dt, y = this.pos[i + 1] + (this.vel[i + 1] + vy) * 0.5 * dt;
      if (y < heightAt(x, z) || Math.abs(x) > 2000 || Math.abs(z) > 2000) continue;   // landed: gone, no cloud left
      const o = w * 3; this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = this.vel[i]; this.vel[o + 1] = vy; this.vel[o + 2] = this.vel[i + 2]; w++;
    }
    this.n = w; this.points.geometry.setDrawRange(0, w); this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Descent profile: height above the pad (m) for time t (s), touchdown at T. Smooth, ends at zero speed.
export const DESCENT_T = 22;
export function descentHeight(t) {
  const k = Math.max(0, Math.min(1, t / DESCENT_T));
  return 320 * Math.pow(1 - k, 2.4);
}
