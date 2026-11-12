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

import { buildStarshipModel, STARSHIP_HLS } from '../../src/starship-model.js';

// Gameplay dimensions and local elevator/footpad coordinates remain unchanged.
export const LANDER = STARSHIP_HLS;
export function buildLander() { return buildStarshipModel({ variant: 'hls' }); }

// Landing-dust particles: launched outward at a low angle, then pure free fall (no drag).
export class BallisticDust {
  constructor(scene, max = 2400) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setDrawRange(0, 0);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#b9b7b0', size: 0.008, transparent: true, opacity: 0.65, depthWrite: false }));
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
