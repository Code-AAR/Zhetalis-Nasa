// Inside your lander: the crew cabin behind the door at the top of the ladder.
// Its cockpit, seats and windows are laid out like NASA's Orion capsule (4 seats, 3 big screens).
// Same shape of class as interior.js (scene, camera, stations, enter, update, nearest), so main.js can switch rooms.
import * as THREE from 'three';
import { capsuleWindowShell } from './exterior-view.js';

const FLOOR_R = 2.8, TOP_R = 1.5, H = 3.2;            // cabin: a cone like the lander's nose (metres)
const SLOPE = Math.atan((FLOOR_R - TOP_R) / H);
const WALK_R = 1.75;                                    // how far from the middle you can walk
const SEG = 48;                                        // smooth curves

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
const glow = color => new THREE.MeshBasicMaterial({ color });
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(w - 2 * r, h - 2 * r, r), { depth: d, bevelEnabled: false, curveSegments: 6 }), m);

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2 - r, y = -h / 2 - r, W = w + 2 * r, Hh = h + 2 * r;
  s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.quadraticCurveTo(x + W, y, x + W, y + r);
  s.lineTo(x + W, y + Hh - r); s.quadraticCurveTo(x + W, y + Hh, x + W - r, y + Hh);
  s.lineTo(x + r, y + Hh); s.quadraticCurveTo(x, y + Hh, x, y + Hh - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function screen(lines, color = '#7dffb2', bg = '#071823') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = color; g.globalAlpha = 0.25; g.lineWidth = 1;
  for (let x = 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 192); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = color; g.font = 'bold 20px Poppins, sans-serif';
  lines.forEach((l, i) => g.fillText(l, 14, 32 + i * 28));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A group stuck flat onto the sloping cone wall at angle a (0 = the hatch side) and height h; its +z points into the cabin.
function onWall(a, h, inset = 0.03) {
  const g = new THREE.Group(), r = FLOOR_R - (FLOOR_R - TOP_R) * h / H - inset;
  g.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
  g.rotation.order = 'YXZ'; g.rotation.y = a + Math.PI; g.rotation.x = SLOPE;
  return g;
}

// A recumbent crew seat: the crew lie on their backs for launch and landing, knees up.
function seat(cushion) {
  const g = new THREE.Group(), frame = std('#2b2f36', { metalness: 0.5, roughness: 0.4 });
  g.add(at(box(0.62, 0.08, 0.7, frame), 0, 0.45, 0));                               // pallet
  for (const x of [-0.27, 0.27]) for (const z of [-0.28, 0.28]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), frame), x, 0.22, z));
  const back = rbox(0.56, 0.95, 0.1, 0.08, cushion); back.rotation.x = -1.15; at(back, 0, 0.62, -0.2); g.add(back);   // back, leaning far back
  const head = rbox(0.34, 0.26, 0.1, 0.08, cushion); head.rotation.x = -1.15; at(head, 0, 0.88, -0.72); g.add(head);
  const thigh = rbox(0.52, 0.45, 0.1, 0.06, cushion); thigh.rotation.x = -2.0; at(thigh, 0, 0.62, 0.28); g.add(thigh);  // knees-up leg rest
  g.add(at(box(0.5, 0.06, 0.32, frame), 0, 0.9, 0.48));                              // foot rest
  const strap = std('#d9683a');
  for (const x of [-0.12, 0.12]) { const s = box(0.05, 0.02, 0.8, strap); s.rotation.x = -1.15; at(s, x, 0.69, -0.2); g.add(s); }
  return g;
}

export class Capsule {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 50);
    this.scene.add(new THREE.HemisphereLight('#f4f7ff', '#3a3f48', 1.1));
    const lamp = new THREE.PointLight('#f2f6ff', 9, 7, 1.5); lamp.position.set(0, H - 0.4, 0); this.scene.add(lamp);
    const fill = new THREE.PointLight('#ffe9cf', 3, 5, 1.5); fill.position.set(0, 1.2, 1.2); this.scene.add(fill);

    // ---- the pressure shell: cone walls, floor (the aft bulkhead), and the docking tunnel at the top ----
    const shellMat = std('#dfe2e6', { side: THREE.BackSide });
    this.scene.add(capsuleWindowShell(shellMat));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, SEG), std('#5d636b')); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const deck = new THREE.Mesh(new THREE.RingGeometry(0.4, WALK_R + 0.1, SEG), std('#70777f')); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.005; this.scene.add(deck);
    const ceiling = new THREE.Mesh(new THREE.RingGeometry(0.55, TOP_R, SEG), std('#cfd3d8', { side: THREE.DoubleSide })); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = H; this.scene.add(ceiling);
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, SEG, 1, true), std('#8a9099', { side: THREE.BackSide })), 0, H + 0.35, 0));
    const topHatch = new THREE.Mesh(new THREE.CircleGeometry(0.55, SEG), std('#4a5058')); topHatch.rotation.x = Math.PI / 2; topHatch.position.y = H + 0.7; this.scene.add(topHatch);
    // soft white light panels and blue trim rings around the walls
    for (const h of [0.9, 2.35]) {
      const r = FLOOR_R - (FLOOR_R - TOP_R) * h / H - 0.01;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.01, r + 0.01, 0.05, SEG, 1, true), std('#3b7bd8', { side: THREE.BackSide }));
      this.scene.add(at(ring, 0, h, 0));
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, p = onWall(a, 2.65); p.add(rbox(0.5, 0.16, 0.02, 0.05, glow('#f4f8ff'))); this.scene.add(p); }
    // wall ribs, like the panels that line a spacecraft cabin
    for (let i = 0; i < 16; i++) { const p = onWall(i / 16 * Math.PI * 2 + Math.PI / 16, 1.6, 0.01); p.add(box(0.04, 2.4, 0.03, std('#c3c8ce'))); this.scene.add(p); }

    this.stations = [];
    const add = (type, label, a, group) => {
      this.scene.add(group);
      const r = WALK_R - 0.15;
      this.stations.push({ type, label, x: Math.sin(a) * r, z: Math.cos(a) * r });
    };

    // ---- side hatch (the way out), with its own small round window ----
    const hatch = onWall(0, 1.05);
    const hatchShape=roundRect(.64,.89,.18),hatchHole=new THREE.Path();hatchHole.absarc(0,.25,.17,0,Math.PI*2,true);hatchShape.holes.push(hatchHole);
    hatch.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hatchShape,{depth:.08,bevelEnabled:false,curveSegments:12}),std('#9aa1aa',{metalness:.4,roughness:.45})));
    hatch.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 12, SEG), std('#2b2f36')), 0, 0.25, 0.09));
    hatch.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.17, SEG), new THREE.MeshBasicMaterial({color:'#b9e4ee',transparent:true,opacity:.035,depthWrite:false})), 0, 0.25, 0.085));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 24, Math.PI), std('#d9683a')); handle.rotation.z = Math.PI; hatch.add(at(handle, 0, -0.25, 0.12));
    hatch.add(at(rbox(1.12, 0.06, 0.04, 0.03, glow('#7dffb2')), 0, 0.68, 0.06));
    add('ship-exit', 'climb out of the capsule', 0, hatch);

    // ---- the crew seats: two in front, two behind, all facing the displays ----
    const blue = std('#2f5fae', { roughness: 0.9 });
    this.seatBox = { x0: -1.8, x1: 1.8, z0: -2.8, z1: -0.75 };
    [[-0.45, -1.05], [0.45, -1.05], [-1.2, -0.85], [1.2, -0.85]].forEach(([x, z], i) => {
      const s = seat(blue); s.position.set(x, i > 1 ? 0.0 : 0.05, z); s.rotation.y = Math.PI + (i > 1 ? Math.sign(x) * 0.35 : 0); this.scene.add(s);
    });
    this.stations.push({ type: 'ship-seat', label: 'look at the crew seats', x: -1.05, z: -0.5 });

    // ---- the cockpit: three big displays and a row of switches (Orion has a "glass cockpit") ----
    const dash = onWall(Math.PI, 1.75);
    dash.add(rbox(2.3, 0.95, 0.12, 0.1, std('#1f2328', { metalness: 0.3, roughness: 0.5 })));
    const texts = [['FLIGHT', 'Alt  0 m', 'Landed', 'Gusev Crater'], ['SYSTEMS', 'Power  OK', 'Air  OK', 'Heat shield OK'], ['MARS 2126', 'Sol 1', 'Crew 4', 'Outpost ->']];
    texts.forEach((l, i) => dash.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshBasicMaterial({ map: screen(l, i === 1 ? '#ffd27a' : '#7dffb2') })), -0.72 + i * 0.72, 0.1, 0.13)));
    for (let i = 0; i < 18; i++) {                     // switch panel under the screens
      const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), std(i % 5 === 0 ? '#d9683a' : '#c9ced6'));
      sw.rotation.x = Math.PI / 2; dash.add(at(sw, -0.85 + i * 0.1, -0.32, 0.14));
    }
    // hand controllers on the seat arms
    for (const x of [-0.82, 0.82]) {
      const stick = new THREE.Group(); stick.position.set(x, 1.05, -1.0);
      stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16), std('#2b2f36')));
      stick.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 6, 16), std('#3a3f46')), 0, 0.1, 0));
      this.scene.add(stick);
    }
    add('ship-panel', 'look at the cockpit displays', Math.PI, dash);

    // ---- windows on both sides, plus the one in the hatch ----
    for (const a of [1.15, -1.15]) {
      const w = onWall(a, 1.75);
      const windowShape=roundRect(.26,.18,.12),inner=roundRect(.24,.16,.08);windowShape.holes.push(new THREE.Path(inner.getPoints(16).reverse()));
      w.add(new THREE.Mesh(new THREE.ExtrudeGeometry(windowShape,{depth:.05,bevelEnabled:false,curveSegments:12}),std('#2b2f36')));
      w.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshBasicMaterial({color:'#b9e4ee',transparent:true,opacity:.035,depthWrite:false})), 0, 0, 0.06));
      this.scene.add(w);
    }
    this.stations.push({ type: 'window', label: 'look out of the window', x: Math.sin(1.15) * (WALK_R - 0.1), z: Math.cos(1.15) * (WALK_R - 0.1) });

    // ---- stowage: soft cargo bags strapped to the walls ----
    for (const a of [Math.PI / 2 + 0.25, -Math.PI / 2 - 0.25]) {
      const st = onWall(a, 0.75);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) st.add(at(rbox(0.36, 0.3, 0.16, 0.06, std(['#e8e1d0', '#d8d0bc'][(r + c) % 2], { roughness: 0.95 })), -0.2 + c * 0.4, -0.16 + r * 0.34, 0));
      this.scene.add(st);
    }

    this.enter();
  }

  enter() { this.pos = new THREE.Vector3(0, 0, 0.25); this.yaw = Math.PI; this.pitch = 0.05; this.vel = { x: 0, z: 0 }; this.step = 0; }

  update(dt, keys, active) {
    let wx = 0, wz = 0;
    if (active) {
      const speed = keys.ShiftLeft || keys.ShiftRight ? 2.4 : 1.6;   // slow: it's a small cabin
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const dx = Math.sin(this.yaw) * f - Math.cos(this.yaw) * s, dz = Math.cos(this.yaw) * f + Math.sin(this.yaw) * s;
      const len = Math.hypot(dx, dz);
      if (len) { wx = dx / len * speed; wz = dz / len * speed; }
    }
    const k = 1 - Math.exp(-dt * 9);
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const sp = Math.hypot(this.vel.x, this.vel.z), before = this.step;
    this.step += sp * dt / 1.4 * Math.PI * 2;
    if (Math.floor(before / Math.PI) !== Math.floor(this.step / Math.PI) && sp > 0.8) this.onStep?.();
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WALK_R) { this.pos.x *= WALK_R / r; this.pos.z *= WALK_R / r; }
    const b = this.seatBox;                            // don't walk through the seats
    if (this.pos.z < b.z1 && this.pos.x > b.x0 && this.pos.x < b.x1) this.pos.z = b.z1;
    const bob = (Math.cos(this.step * 2) - 1) * 0.01 * Math.min(1, sp / 1.6);
    const eye = new THREE.Vector3(this.pos.x, 1.6 + bob, this.pos.z);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.x + Math.sin(this.yaw) * Math.cos(this.pitch), eye.y + Math.sin(this.pitch), eye.z + Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  nearest() {
    let best = null;
    for (const s of this.stations) {
      const d = Math.hypot(this.pos.x - s.x, this.pos.z - s.z);
      if (d < 0.9 && (!best || d < best.d)) best = { ...s, d };
    }
    return best;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
