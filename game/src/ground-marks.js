// Marks left on the ground: rover tyre tracks and boot prints.
// Real science: Mars dust is only a thin layer. When Spirit's broken front wheel dragged through the soil in
// 2005-2007, it churned up bright ground hidden just below: salty sulfate soil at Paso Robles, Arad and Tyrone,
// and almost pure silica at Gertrude Weise. Here, driving through those zones leaves bright tracks.
// A dust storm buries every mark, so the ground looks fresh again after one.
import * as THREE from 'three';
import { brightZone } from './resource-zones.js';

const TRACK_N = 2400, PRINT_N = 700;
const BRIGHT = { gypsum: new THREE.Color('#ead9a6'), silica: new THREE.Color('#f5f3ea') };   // yellowish salt, white silica
const DARK = new THREE.Color('#ffffff');


function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// tyre tread: soft-edged strip with chevron bars, as a rover tyre presses into fine dust
const treadTex = () => canvasTexture(64, 128, (g, w, h) => {
  const edge = g.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'rgba(255,255,255,0)'); edge.addColorStop(.18, 'rgba(255,255,255,.55)'); edge.addColorStop(.82, 'rgba(255,255,255,.55)'); edge.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 7; g.lineCap = 'round';
  for (let y = -16; y < h + 16; y += 21) { g.beginPath(); g.moveTo(10, y + 9); g.lineTo(w / 2, y); g.lineTo(w - 10, y + 9); g.stroke(); }
});
// a boot sole: heel, arch and toe with tread bars
const bootTex = () => canvasTexture(64, 128, (g, w, h) => {
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.beginPath(); g.ellipse(w / 2, 34, 22, 30, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(w / 2, 100, 18, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(w / 2 - 13, 40, 26, 50);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.55)';
  for (let y = 12; y < 124; y += 11) g.fillRect(0, y, w, 4);
});

function marks(n, tex, color, opacity, order) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - order, polygonOffsetUnits: -2 - order });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1 + order;
  mesh.name = 'Ground marks'; mesh.userData = { next: 0, full: false, base: opacity };
  return mesh;
}

export class GroundMarks {
  // height(x, z): the drawn ground height. onBright(zone): the first time a wheel churns up bright soil in a zone.
  constructor(scene, height, { onBright } = {}) {
    this.height = height; this.onBright = onBright;
    this.tracks = marks(TRACK_N, treadTex(), '#5a3f2e', .42, 0);
    this.bright = marks(TRACK_N / 2, treadTex(), '#ffffff', .8, 1);
    this.prints = marks(PRINT_N, bootTex(), '#3e2a1e', .75, 0);
    this.group = new THREE.Group(); this.group.name = 'Tracks and boot prints';
    this.group.add(this.tracks, this.bright, this.prints); scene.add(this.group);
    this.last = new Map(); this.foot = 0; this.stamped = 0;
    this._c = new THREE.Color(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._qy = new THREE.Quaternion(); this._n = new THREE.Vector3(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  stamp(mesh, x, z, yaw, w, len, color) {
    const h = this.height, y = h(x, z);
    this._n.set(h(x - .3, z) - h(x + .3, z), .6, h(x, z - .3) - h(x, z + .3)).normalize();
    this._q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this._n).multiply(this._qy.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
    this._m.compose(this._p.set(x, y + .03, z), this._q, this._s.set(w, 1, len));
    const u = mesh.userData, i = u.next;
    mesh.setMatrixAt(i, this._m); mesh.setColorAt(i, color || DARK);
    u.next = (i + 1) % mesh.instanceMatrix.count; if (u.next === 0) u.full = true;
    mesh.count = u.full ? mesh.instanceMatrix.count : u.next;
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.stamped++;
  }

  // the drivable rover: one strip under each side, laid every 0.45 m of travel
  rover(r) {
    if (!r?.pos || Math.abs(r.speed || 0) < .3) return;
    const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
    const side = Math.max(1.1, ...(r.wheels || []).map(w => Math.abs(w.track))), back = Math.min(-1.6, ...(r.wheels || []).map(w => w.axle));
    for (const sgn of [-1, 1]) {
      const x = r.pos.x + s * back + c * side * sgn, z = r.pos.z + c * back - s * side * sgn;
      const key = 'r' + sgn, prev = this.last.get(key);
      if (prev && Math.hypot(x - prev.x, z - prev.z) < .45) continue;
      if (prev && Math.hypot(x - prev.x, z - prev.z) > 4) { this.last.set(key, { x, z }); continue; }   // teleported: start a new strip
      const zone = brightZone(x, z), edge = zone ? Math.hypot(x - zone.x, z - zone.z) / zone.r : 1;
      // patchy near the zone's edge, like real salty soil showing through in streaks
      const n = Math.sin(x * 1.7 + z * .9) * Math.sin(z * 1.3 - x * .6) * .5 + .5, bright = zone && (edge < .65 || n > (edge - .65) / .35) && BRIGHT[zone.ore];
      const len = prev ? Math.hypot(x - prev.x, z - prev.z) + .12 : .6;
      const mx = prev ? (x + prev.x) / 2 : x, mz = prev ? (z + prev.z) / 2 : z, yaw = prev ? Math.atan2(x - prev.x, z - prev.z) : r.yaw;
      if (bright) {
        this.stamp(this.bright, mx, mz, yaw, .62, len, this._c.copy(bright).multiplyScalar(.86 + .14 * n));
        if (!this.found?.has(zone.id)) { (this.found ||= new Set()).add(zone.id); this.onBright?.(zone); }
      } else this.stamp(this.tracks, mx, mz, yaw, .55, len);
      this.last.set(key, { x, z });
    }
  }

  // one boot print per step, left and right in turn, a little to each side of the walking line
  step(p, yaw) {
    this.foot = 1 - this.foot;
    const side = (this.foot ? .14 : -.14), c = Math.cos(yaw), s = Math.sin(yaw);
    this.stamp(this.prints, p.x + c * side, p.z - s * side, yaw, .2, .4);
  }

  // A dust storm buries the marks: they fade while it blows and are gone when it ends.
  setBuried(f) {
    for (const m of [this.tracks, this.bright, this.prints]) m.material.opacity = m.userData.base * (1 - f);
  }
  clear() {
    for (const m of [this.tracks, this.bright, this.prints]) { m.count = 0; m.userData.next = 0; m.userData.full = false; }
    this.last.clear(); this.setBuried(0);
  }
}
