// Inside the outpost: a round room you walk around in first person.
// Each station does one job, so kids can see where each part of the trade-off "lives".
import * as THREE from 'three';

const R = 6;   // room radius in metres

function lam(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); }
function glow(color) { return new THREE.MeshBasicMaterial({ color }); }
function at(m, x, y, z) { m.position.set(x, y, z); return m; }

function screenTexture(lines, color = '#7dffb2') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#06141a'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = color; g.font = 'bold 22px Poppins, sans-serif';
  lines.forEach((l, i) => g.fillText(l, 14, 34 + i * 30));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function marsWindowTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 110); sky.addColorStop(0, '#b8774f'); sky.addColorStop(1, '#efc9a4');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#a85d39'; g.beginPath(); g.moveTo(0, 110);
  for (let x = 0; x <= 256; x += 16) g.lineTo(x, 95 + Math.sin(x * 0.05) * 12 + Math.sin(x * 0.13) * 6);
  g.lineTo(256, 160); g.lineTo(0, 160); g.fill();
  g.fillStyle = '#7a3f26'; g.fillRect(0, 130, 256, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Interior {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1410');
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
    this.ambient = new THREE.HemisphereLight('#fff4e6', '#3a2a20', 0.9); this.scene.add(this.ambient);
    this.lamp = new THREE.PointLight('#ffe7c7', 22, 16, 1.6); this.lamp.position.set(0, 3.6, 0); this.scene.add(this.lamp);
    this.alarm = new THREE.PointLight('#ff3b2f', 0, 14, 1.4); this.alarm.position.set(0, 3.2, 0); this.scene.add(this.alarm);

    // shell
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 4.2, 28, 1, true), lam('#e9e5dd', { side: THREE.BackSide }));
    this.scene.add(at(wall, 0, 2.1, 0));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam('#f2efe9', { side: THREE.BackSide }));
    this.scene.add(at(dome, 0, 4.2, 0));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 28), lam('#4a4d52')); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 28), glow('#d9683a')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.25, 28, 1, true), lam('#d9683a', { side: THREE.BackSide }));
    this.scene.add(at(stripe, 0, 3.1, 0));

    this.stations = [];
    const add = (type, label, x, z, group) => { group.position.set(x, 0, z); group.lookAt(0, 0, 0); this.scene.add(group); this.stations.push({ type, label, x, z }); return group; };

    // airlock (exit) - same side as the outside door
    const lock = new THREE.Group();
    lock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.2), lam('#2a2e34')), 0, 1.5, 0));
    lock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.25), glow('#7dffb2')), 0, 3.1, 0.02));
    add('exit', 'go outside (airlock)', 0, R - 0.25, lock);

    // control console - the power split
    const desk = new THREE.Group();
    desk.add(at(new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1), lam('#6b7079')), 0, 0.45, 0));
    this.consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ map: screenTexture(['POWER CONTROL', 'Life  Comms', 'Science  Shield']) }));
    desk.add(at(this.consoleScreen, 0, 1.75, 0.35)); this.consoleScreen.rotation.x = -0.2;
    add('console', 'use the power console', 0, -(R - 0.9), desk);

    // workbench - build upgrades from parts
    const bench = new THREE.Group();
    bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), lam('#8a5a3c')), 0, 0.45, 0));
    for (let i = 0; i < 4; i++) bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.25), lam(['#c9ced6', '#ffd27a', '#9fe7ff', '#d9683a'][i])), -0.9 + i * 0.6, 1.0, 0));
    bench.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1), new THREE.MeshBasicMaterial({ map: screenTexture(['WORKBENCH', 'Build upgrades'], '#ffd27a') })), 0, 2, -0.5));
    add('workbench', 'build upgrades at the workbench', R - 0.9, 0, bench);

    // greenhouse shelves
    const green = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      green.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.8), lam('#bfbab2')), 0, 0.6 + s * 0.8, 0));
      for (let p = 0; p < 6; p++) green.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 5), lam('#4caf50')), -1 + p * 0.4, 0.86 + s * 0.8, 0));
    }
    const growLight = new THREE.PointLight('#d66bff', 6, 4, 1.5); growLight.position.set(0, 2.8, 0.3); green.add(growLight);
    add('greenhouse', 'look at the greenhouse', -(R - 0.7), 0, green);

    // storm shelter bunks
    const bunk = new THREE.Group();
    for (let b = 0; b < 2; b++) bunk.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.9), lam('#3b7bd8')), 0, 0.5 + b * 1.2, 0));
    bunk.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.12), lam('#6b7079')), 0, 1.3, -0.5));
    add('shelter', 'check the storm shelter', -(R - 1.3) * 0.72, -(R - 1.3) * 0.72, bunk);

    // window onto Mars
    const win = new THREE.Group();
    win.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: marsWindowTexture() })), 0, 2.1, 0));
    win.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.2), lam('#2a2e34')), 0, 1.25, 0));
    add('window', 'look out of the window', (R - 0.05) * 0.72, -(R - 0.05) * 0.72, win);

    // crew table, off to the side so the walk from the airlock to the console stays clear
    this.table = { x: 2.6, z: 2.4 };
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 16), lam('#bfbab2')); this.scene.add(at(table, this.table.x, 0.8, this.table.z));
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), lam('#6b7079')), this.table.x, 0.4, this.table.z));

    this.pos = new THREE.Vector3(0, 0, R - 1.6);
    this.yaw = Math.PI; this.pitch = 0;      // start just inside the airlock, facing the console
  }

  enter() { this.pos.set(0, 0, R - 1.6); this.yaw = Math.PI; this.pitch = 0; this.vel = { x: 0, z: 0 }; }

  setStorm(on, t) { this.alarm.intensity = on ? 10 + Math.sin(t * 6) * 8 : 0; }

  update(dt, keys, active) {
    this.vel ??= { x: 0, z: 0 }; this.step ??= 0;
    let wx = 0, wz = 0;
    if (active) {
      const speed = keys.ShiftLeft || keys.ShiftRight ? 4 : 2.6;
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const dx = Math.sin(this.yaw) * f - Math.cos(this.yaw) * s, dz = Math.cos(this.yaw) * f + Math.sin(this.yaw) * s;
      const len = Math.hypot(dx, dz);
      if (len) { wx = dx / len * speed; wz = dz / len * speed; }
    }
    {
      const k = 1 - Math.exp(-dt * 9);                       // ease into and out of walking
      this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const sp = Math.hypot(this.vel.x, this.vel.z), before = this.step;
      this.step += sp * dt / 1.9 * Math.PI * 2;
      if (Math.floor(before / Math.PI) !== Math.floor(this.step / Math.PI) && sp > 1) this.onStep?.();
      this.bob = (Math.cos(this.step * 2) - 1) * 0.012 * Math.min(1, sp / 2.6);   // a smooth wave, not a hop
      const r = Math.hypot(this.pos.x, this.pos.z), max = R - 1.2;
      if (r > max) { this.pos.x *= max / r; this.pos.z *= max / r; }
      const tx = this.pos.x - this.table.x, tz = this.pos.z - this.table.z, tr = Math.hypot(tx, tz);   // walk around the table
      if (tr < 1.3 && tr > 0.001) { this.pos.x = this.table.x + tx / tr * 1.3; this.pos.z = this.table.z + tz / tr * 1.3; }
    }
    const eye = new THREE.Vector3(this.pos.x, 1.65 + (this.bob || 0), this.pos.z);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.x + Math.sin(this.yaw) * Math.cos(this.pitch), eye.y + Math.sin(this.pitch), eye.z + Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  nearest() {
    let best = null;
    for (const s of this.stations) {
      const d = Math.hypot(this.pos.x - s.x, this.pos.z - s.z);
      if (d < 2.4 && (!best || d < best.d)) best = { ...s, d };
    }
    return best;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
