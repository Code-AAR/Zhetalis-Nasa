// Loose pebbles scattered over the ground around the player, so the plain looks like real Mars ground
// (NASA rover photos show stones everywhere). They are decoration only: no collision, no shadows,
// one draw call. Positions come from a fixed grid, so nothing pops or moves when the ring re-centres.
import * as THREE from 'three';
import { heightAt, rockGeometry } from './world.js';
import { rockWeight } from './landmarks.js';
import { SURFACE_DETAIL } from './surface-detail.js';

const CELL = 3, RING = 18, MAX = 2000;           // 3 m grid, 18 cells each way (about 54 m view)
const hash = (a, b, k) => { const s = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

export class Pebbles {
  constructor(world) {
    this.world = world; this.cx = NaN; this.cz = NaN;
    const geo = rockGeometry(11, { detail: 1, rough: .5 });
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.name = 'pebbles';
    this.tints = ['#74594a', '#86694f', '#4a4641', '#97785f', '#33302d'].map(c => new THREE.Color(c));
    world.scene.add(this.mesh);
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(); };
  }
  tick() {
    const pos = this.world.player?.position; if (!pos) return;
    const cx = Math.round(pos.x / CELL), cz = Math.round(pos.z / CELL);
    if (Math.abs(cx - this.cx) < 2 && Math.abs(cz - this.cz) < 2) return;     // re-centre only after about 6 m of walking
    this.cx = cx; this.cz = cz; this.rebuild();
  }
  rebuild() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let i = -RING; i <= RING && n < MAX; i++) for (let j = -RING; j <= RING && n < MAX; j++) {
      const gx = this.cx + i, gz = this.cz + j;
      if (i * i + j * j > RING * RING) continue;
      const near = rockWeight(gx * CELL, gz * CELL, .45);                         // more stones around crater rims and hill feet
      const count = Math.floor(hash(gx, gz, 1) * (1.5 + 3.2 * Math.min(1, near * 1.2)));   // 0 to 4 pebbles per cell
      for (let k = 0; k < count && n < MAX; k++) {
        const x = (gx + hash(gx, gz, 2 + k) - .5) * CELL, z = (gz + hash(gx, gz, 5 + k) - .5) * CELL;
        if (Math.hypot(x, z) < 20) continue;                                     // keep the base area clear
        const size = .05 + Math.pow(hash(gx, gz, 8 + k), 3) * .3;                // mostly small, a few bigger
        s.set(size * (.8 + hash(gx, gz, 11 + k) * .6), size * .6, size * (.8 + hash(gx, gz, 14 + k) * .6));
        p.set(x, heightAt(x, z) - size * .12, z);
        q.setFromEuler(e.set(0, hash(gx, gz, 17 + k) * 6.283, 0));
        this.mesh.setMatrixAt(n, m.compose(p, q, s));
        this.mesh.setColorAt(n, this.tints[Math.floor(hash(gx, gz, 20 + k) * this.tints.length)]);
        n++;
      }
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.world.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
export const pebblesEnabled = () => SURFACE_DETAIL.texture >= 512;      // skipped in Lite mode
