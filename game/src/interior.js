// Inside the outpost: a round room you walk around in first person.
// Each station does one job, so kids can see where each part of the trade-off "lives".
import * as THREE from 'three';
import { loadModel, replaceLogos } from './nasamodels.js';

const R = 6;   // room radius in metres

const SEG = 64;   // segments around the round walls and dome (smooth, still cheap: one room)
function lam(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); }
function smooth(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...extra }); }
function rounded(w, h, d, r, mat) {   // a box with rounded edges (extruded rounded rectangle, depth along z)
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat);
}
function cyl(r, h, mat, seg = 24) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); }
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
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 4.2, SEG, 1, true), lam('#e9e5dd', { side: THREE.BackSide }));
    this.scene.add(at(wall, 0, 2.1, 0));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, SEG, 16, 0, Math.PI * 2, 0, Math.PI / 2), lam('#f2efe9', { side: THREE.BackSide }));
    this.scene.add(at(dome, 0, 4.2, 0));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, SEG), lam('#4a4d52')); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, SEG), glow('#d9683a')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.25, SEG, 1, true), lam('#d9683a', { side: THREE.BackSide }));
    this.scene.add(at(stripe, 0, 3.1, 0));

    this.stations = [];
    const add = (type, label, x, z, group) => { group.position.set(x, 0, z); group.lookAt(0, 0, 0); this.scene.add(group); this.stations.push({ type, label, x, z }); return group; };

    // airlock (exit) - same side as the outside door
    const lock = new THREE.Group();
    lock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.2), lam('#2a2e34')), 0, 1.5, 0));
    lock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.25), glow('#7dffb2')), 0, 3.1, 0.02));
    add('exit', 'go outside (airlock)', 0, R - 0.25, lock);

    // control console - the power split. A curved mission-control style desk: sloped keyboard shelf,
    // three tilted screens on top, a status light bar and a chair.
    const desk = new THREE.Group();
    const grey = smooth('#59606a'), darkGrey = smooth('#2c3036', { roughness: 0.45 }), trim = smooth('#d9683a'), steel = smooth('#aab1ba', { metalness: 0.5, roughness: 0.35 });
    desk.add(at(rounded(3.2, 0.82, 0.9, 0.12, grey), 0, 0.41, -0.05));                         // body
    const shelf = rounded(3.3, 0.5, 0.06, 0.08, darkGrey); shelf.rotation.x = -Math.PI / 2 + 0.22; desk.add(at(shelf, 0, 0.86, 0.12));   // sloped work shelf
    desk.add(at(new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.05, 0.05), trim), 0, 0.84, 0.38));   // orange edge
    for (const x of [-0.95, 0, 0.95]) {                                                         // keyboards and trackballs
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.2), smooth('#1b1e22')); kb.rotation.x = 0.22; desk.add(at(kb, x, 0.9, 0.2));
      desk.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 12), smooth('#3b7bd8')), x + 0.42, 0.91, 0.2));
    }
    const hood = rounded(3.3, 1.2, 0.18, 0.1, darkGrey); hood.rotation.x = -0.16; desk.add(at(hood, 0, 1.55, -0.38));   // screen frame
    this.consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), new THREE.MeshBasicMaterial({ map: screenTexture(['POWER CONTROL', 'Life  Comms', 'Science  Shield']) }));
    desk.add(at(this.consoleScreen, 0, 1.56, -0.27)); this.consoleScreen.rotation.x = -0.16;
    const side = [['SOLAR', 'Panels  OK', 'Dust  low'], ['BATTERY', 'Charge', 'Night heat']];
    [-1.0, 1.0].forEach((x, i) => {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.7), new THREE.MeshBasicMaterial({ map: screenTexture(side[i], i ? '#ffd27a' : '#9fe7ff') }));
      scr.rotation.set(-0.16, -Math.sign(x) * 0.12, 0, 'YXZ'); desk.add(at(scr, x * 1.02, 1.5, -0.16));
    });
    desk.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 2.18, -0.42));   // status light bar
    for (let i = 0; i < 12; i++) {                                                             // two rows of switches
      const sw = cyl(0.022, 0.05, smooth(i % 4 === 0 ? '#ffd27a' : '#c9ced6'), 12); sw.rotation.x = Math.PI / 2 - 0.22;
      desk.add(at(sw, -1.5 + i * 0.07 + (i > 5 ? 2.58 : 0), 0.95, 0.03));
    }
    // a chair on a five-star base
    const chair = new THREE.Group(), cushion = smooth('#3b7bd8', { roughness: 0.9 }); chair.position.set(0.4, 0, 1.05); chair.rotation.y = 0.25;
    chair.add(at(cyl(0.05, 0.42, steel, 16), 0, 0.3, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.32), steel); leg.rotation.y = a; leg.position.set(Math.sin(a) * 0.16, 0.06, Math.cos(a) * 0.16); chair.add(leg); }
    const seatPad = rounded(0.5, 0.5, 0.09, 0.12, cushion); seatPad.rotation.x = -Math.PI / 2; chair.add(at(seatPad, 0, 0.53, 0));
    const backPad = rounded(0.46, 0.55, 0.08, 0.14, cushion); backPad.rotation.x = -0.12; chair.add(at(backPad, 0, 0.88, 0.24));
    desk.add(chair);
    add('console', 'use the power console', 0, -(R - 0.9), desk);

    // workbench - build upgrades from parts. A steel bench with drawers, a pegboard of tools, a vice,
    // parts bins and a lamp - plus two real NASA tools from NASA 3D Resources (loadTools, below).
    const bench = new THREE.Group();
    bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.0), smooth('#a0714f', { roughness: 0.8 })), 0, 0.92, 0));   // wooden top
    for (const x of [-1.3, 1.3]) for (const z of [-0.42, 0.42]) bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.88, 0.07), steel), x, 0.44, z));
    bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.85), steel), 0, 0.18, 0));   // lower shelf
    const drawers = new THREE.Group(); drawers.position.set(0.85, 0, 0); bench.add(drawers);
    drawers.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.9), smooth('#d9683a')), 0, 0.57, 0));
    for (let i = 0; i < 3; i++) {
      drawers.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.02), smooth('#e57a4c')), 0, 0.37 + i * 0.2, 0.46));
      drawers.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), steel), 0, 0.4 + i * 0.2, 0.48));
    }
    bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.3, 0.05), smooth('#cfc8bb', { roughness: 0.95 })), 0, 1.75, -0.5));   // pegboard
    const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.012, 6), smooth('#6b6459'), 22 * 10), mtx = new THREE.Matrix4();
    for (let i = 0; i < 220; i++) holes.setMatrixAt(i, mtx.makeTranslation(-1.3 + (i % 22) * 0.124, 1.17 + Math.floor(i / 22) * 0.13, -0.474));
    bench.add(holes);
    const hang = (mesh, x, y, rz = 0) => { mesh.rotation.z = rz; bench.add(at(mesh, x, y, -0.45)); };
    hang(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), steel), -1.1, 1.85, 0.2);                 // screwdriver
    hang(cyl(0.03, 0.14, smooth('#ffd27a'), 12), -1.12, 1.62, 0.2);
    hang(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 10, 32), smooth('#3b7bd8')), -0.7, 1.85);   // coil of cable
    hang(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.03), steel), 0.6, 2.05);                       // ruler
    for (let i = 0; i < 5; i++) hang(cyl(0.012 + i * 0.004, 0.18 + i * 0.03, steel, 10), 0.95 + i * 0.09, 1.65);   // drill bits
    ['#c9ced6', '#ffd27a', '#9fe7ff', '#7dffb2'].forEach((c, i) => {                            // parts bins
      const bin = new THREE.Group(); bin.position.set(-1.2 + i * 0.32, 0.96, -0.3);
      bin.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.24), smooth('#3a3f46')), 0, 0.07, 0));
      for (let k = 0; k < 4; k++) bin.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), smooth(c, { metalness: 0.6, roughness: 0.3 })), -0.07 + k * 0.05, 0.15, (k % 2) * 0.05 - 0.02));
      bench.add(bin);
    });
    const vice = new THREE.Group(); vice.position.set(1.15, 0.96, 0.35);                         // a bench vice
    vice.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.18), smooth('#3b7bd8')), 0, 0.06, 0));
    for (const z of [-0.06, 0.06]) vice.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), steel), 0, 0.17, z));
    const screw = cyl(0.015, 0.3, steel, 12); screw.rotation.x = Math.PI / 2; vice.add(at(screw, 0, 0.1, 0.2));
    bench.add(vice);
    const lamp = new THREE.Group(); lamp.position.set(-1.25, 0.96, 0.3);                         // an arm lamp
    lamp.add(cyl(0.1, 0.03, darkGrey, 24));
    const arm = cyl(0.015, 0.7, steel, 10); arm.rotation.z = -0.5; lamp.add(at(arm, 0.17, 0.32, 0));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.15, 24, 1, true), smooth('#ffd27a', { side: THREE.DoubleSide })); shade.rotation.z = 0.9; lamp.add(at(shade, 0.36, 0.62, 0));
    const bulb = new THREE.PointLight('#fff1d6', 2.2, 2.5, 1.6); bulb.position.set(0.42, 0.55, 0); lamp.add(bulb);
    bench.add(lamp);
    bench.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), new THREE.MeshBasicMaterial({ map: screenTexture(['WORKBENCH', 'Build upgrades'], '#ffd27a') })), -0.85, 2.27, -0.47));
    this.toolSpot = bench;
    add('workbench', 'build upgrades at the workbench', R - 0.9, 0, bench);
    this.loadTools();

    // the round tunnel hatch to the base greenhouse (greenhouse.js), with a peek of pink grow lights through its window
    const green = new THREE.Group();
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.14, 16, SEG), smooth('#d9d4cb')); ringMesh.position.y = 1.45; green.add(ringMesh);
    const opening = new THREE.Mesh(new THREE.CircleGeometry(1.15, SEG), new THREE.MeshBasicMaterial({ color: '#2a1f30' })); opening.position.set(0, 1.45, -0.05); green.add(opening);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.75, SEG), new THREE.MeshBasicMaterial({ color: '#c75cff', transparent: true, opacity: 0.55 })); glowDisc.position.set(0, 1.45, -0.04); green.add(glowDisc);
    for (let i = 0; i < 5; i++) green.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), smooth('#4f8f3a')), -0.5 + i * 0.25, 0.95 + (i % 2) * 0.08, -0.03));
    green.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: '#ffd27a' })), 0, 2.85, 0));
    green.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshBasicMaterial({ map: screenTexture(['GREENHOUSE', 'through the', 'tunnel'], '#c9ff9a') })), 0, 3.45, 0.02));
    const growLight = new THREE.PointLight('#d66bff', 4, 4, 1.5); growLight.position.set(0, 1.6, 0.6); green.add(growLight);
    add('greenhouse', 'walk through the tunnel to the greenhouse', -(R - 0.15), 0, green);

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

    // hazard monitor - space weather and dust-storm forecasts; it blinks red when it has spotted something new
    const mon = new THREE.Group();
    mon.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.25), lam('#2a2e34')), 0, 2.0, 0));
    this.monitorOk = screenTexture(['HAZARD MONITOR', 'Radiation  Dust', 'All clear']);
    this.monitorAlert = screenTexture(['HAZARD MONITOR', '!! NEW READING !!', 'Check now'], '#ff6b5b');
    this.monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.35), new THREE.MeshBasicMaterial({ map: this.monitorOk }));
    mon.add(at(this.monitorScreen, 0, 2.0, 0.14));
    this.monitorLight = new THREE.PointLight('#ff4b3a', 0, 4, 1.5); this.monitorLight.position.set(0, 2.2, 0.8); mon.add(this.monitorLight);
    add('monitor', 'check the hazard monitor', -(R - 0.4) * 0.72, (R - 0.4) * 0.72, mon);

    // storage locker - tools you aren't carrying, rock samples, seeds and the water tank
    const locker = new THREE.Group();
    locker.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.7), lam('#9aa0a8')), 0, 1.3, 0));
    for (const x of [-0.55, 0.55]) locker.add(at(new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 0.04), lam('#b9bec5')), x, 1.3, 0.37));
    locker.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.75), glow('#ffd27a')), 0, 2.66, 0));
    locker.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 32), new THREE.MeshLambertMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.8 })), 1.55, 0.7, 0));   // water tank
    add('locker', 'open the storage locker', (R - 0.5) * 0.72, (R - 0.5) * 0.72, locker);

    // crew table, off to the side so the walk from the airlock to the console stays clear
    this.table = { x: 2.6, z: 2.4 };
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 48), lam('#bfbab2')); this.scene.add(at(table, this.table.x, 0.8, this.table.z));
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 16), lam('#6b7079')), this.table.x, 0.4, this.table.z));

    this.pos = new THREE.Vector3(0, 0, R - 1.6);
    this.yaw = Math.PI; this.pitch = 0;      // start just inside the airlock, facing the console
  }

  // Two real tools from NASA 3D Resources lie on the workbench, at about their real size:
  // the Pistol Grip Tool astronauts use on spacewalks at the ISS, and a wrench.
  loadTools() {
    const place = (m, len, x, z, rot) => {
      const sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      m.scale.setScalar(len / Math.max(sz.x, sz.y, sz.z)); m.rotation.set(...rot); m.position.set(x, 0, z);
      this.toolSpot.add(m); this.toolSpot.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(m), base = this.toolSpot.localToWorld(new THREE.Vector3(0, 0.96, 0)).y;
      m.position.y += base - b.min.y;   // rest it on the bench top
    };
    loadModel('pistol-grip-tool.glb').then(async g => {
      if (!g) return;
      const m = g.scene.clone(true);
      for (const c of m.children.flatMap(ch => [ch, ...ch.children])) if (c.isMesh && c.material?.map) {   // no NASA logo in the game: cover the tiny one on its label
        c.material = c.material.clone(); c.material.map = await replaceLogos(c.material.map, [{ x: 0.715, y: 0.697, r: 0.02, plain: true }]);
      }
      place(m, 0.38, -0.15, 0.18, [0, 0.6, Math.PI / 2]);
    });
    loadModel('wrench.glb').then(g => {
      if (!g) return;
      const m = g.scene.clone(true);
      m.traverse(c => { if (c.isMesh) for (const mt of [].concat(c.material)) { mt.metalness = Math.min(mt.metalness ?? 0, 0.5); mt.roughness = Math.max(mt.roughness ?? 0.4, 0.35); } });
      place(m, 0.3, 0.35, 0.2, [0, 0.4, 0]);
    });
  }

  enter() { this.pos.set(0, 0, R - 1.6); this.yaw = Math.PI; this.pitch = 0; this.vel = { x: 0, z: 0 }; }

  setStorm(on, t) { this.alarm.intensity = on ? 10 + Math.sin(t * 6) * 8 : 0; }
  // The hazard monitor flashes while it has a reading you haven't looked at yet.
  setMonitor(alert, t) {
    const blink = alert && Math.sin(t * 5) > 0;
    this.monitorScreen.material.map = blink ? this.monitorAlert : this.monitorOk;
    this.monitorLight.intensity = alert ? 3 + Math.sin(t * 5) * 3 : 0;
  }

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
