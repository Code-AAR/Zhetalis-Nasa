// Shared hand-built models: a ground-mounted solar panel on a proper frame, and a survey dish on a real mount.
// Everything stands on the ground: feet, ballast blocks and posts reach down to where the terrain is.
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .35, ...o });
export const MAT = {
  alu: std('#c9ccd0', { metalness: .7, roughness: .38 }), steel: std('#8d949b', { metalness: .6, roughness: .5 }), dark: std('#2c3136', { roughness: .7, metalness: .3 }),
  white: std('#ece9e1', { metalness: .1, roughness: .6 }), orange: std('#d9622b', { metalness: .1, roughness: .55 }), concrete: std('#a39d94', { metalness: 0, roughness: .95 }),
  rubber: std('#1b1d20', { metalness: 0, roughness: .9 }),
};

// A cell texture: blue cells, thin silver bus lines, a little variation so it doesn't look flat.
let cellTex;
export function cellTexture() {
  if (cellTex) return cellTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d'), cols = 6, rows = 10, cw = 256 / cols, rh = 160 / rows;
  g.fillStyle = '#0d1b33'; g.fillRect(0, 0, 256, 160);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const v = 52 + ((r * 7 + q * 13) % 9) * 3; g.fillStyle = `rgb(${18 + v * .1},${44 + v * .5},${96 + v})`; g.fillRect(q * cw + 2, r * rh + 2, cw - 4, rh - 4);
    g.strokeStyle = 'rgba(205,215,230,.55)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(q * cw + k * cw / 4, r * rh + 2); g.lineTo(q * cw + k * cw / 4, r * rh + rh - 2); g.stroke(); }
  }
  cellTex = new THREE.CanvasTexture(c); cellTex.colorSpace = THREE.SRGBColorSpace; cellTex.anisotropy = 4; return cellTex;
}
export const makeCellMat = () => new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: .3, metalness: .5, color: '#ffffff', emissive: '#12305c', emissiveMap: cellTexture(), emissiveIntensity: .55 });

const cyl = (r, len, mat, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
// A tube between two points.
export function tube(a, b, r, mat, seg = 12) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}

// One ground-mounted panel (origin on the ground, centre of its footprint). Faces north (toward -z) like panels in the southern hemisphere.
export function solarPanel(cellMat, { w = 3.2, d = 2, tilt = .5, low = .6 } = {}) {
  const g = new THREE.Group(), s = Math.sin(tilt), c = Math.cos(tilt), hc = low + d / 2 * s;
  const tilted = new THREE.Group(); tilted.position.y = hc; tilted.rotation.x = -tilt; g.add(tilted);
  tilted.add(box(w, .045, d, MAT.dark, 0, -.025, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - .1, d - .1), cellMat); face.rotation.x = -Math.PI / 2; face.position.y = .005; tilted.add(face);
  for (const [bw, bd, x, z] of [[w, .06, 0, d / 2 - .03], [w, .06, 0, -d / 2 + .03], [.06, d, w / 2 - .03, 0], [.06, d, -w / 2 + .03, 0]]) tilted.add(box(bw, .07, bd, MAT.alu, x, .0, z));
  // Recessed hex fasteners on the frame, batched into one draw call per panel.
  const fasteners=new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.025,.025,6),MAT.steel,8);
  const fm=new THREE.Matrix4();let fi=0;
  for(const x of [-w/2+.035,w/2-.035]) for(const z of [-d/2+.08,-d/6,d/6,d/2-.08]) fasteners.setMatrixAt(fi++,fm.makeTranslation(x,.045,z));
  tilted.add(fasteners);
  tilted.add(box(.28, .1, .2, MAT.dark, w * .3, -.1, d * .28));   // junction box on the back
  for (const k of [-.3, .3]) { const along = k * d, rail = cyl(.035, w * .96, MAT.steel, 6); rail.rotation.z = Math.PI / 2; rail.position.set(0, -.1, along); tilted.add(rail); }
  g.userData.feet=[];
  // legs: from the rails straight down to ballast blocks on the ground
  for (const k of [-.3, .3]) for (const x of [-.36, .36]) {
    const z = k * d * c, top = hc + k * d * s - .1 * c;
    g.add(tube([x * w, top, z], [x * w, 0, z], .035, MAT.steel));
    const foot=box(.3,.16,.3,MAT.concrete,x*w,.06,z);g.add(foot);g.userData.feet.push(foot);
  }
  g.add(tube([-.36 * w, low + .2, -.3 * d * c], [-.36 * w, 0.1, .3 * d * c], .02, MAT.steel, 4), tube([.36 * w, low + .2, -.3 * d * c], [.36 * w, 0.1, .3 * d * c], .02, MAT.steel, 4));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A deep-space-style survey dish: paraboloid bowl with ribs, rim ring, hub, a yoke with trunnions, a turntable,
// and a feed horn held on three struts that really meet the rim. Returns { group, az, el } (az turns, el tilts).
export function dishAssembly(R = 1.8) {
  const group = new THREE.Group(), az = new THREE.Group(), el = new THREE.Group(); group.add(az);
  const f = R * .42, prof = []; for (let i = 0; i <= 28; i++) { const r = i / 28 * R; prof.push(new THREE.Vector2(r, r * r / (4 * f))); }
  prof.push(new THREE.Vector2(R, R * R / (4 * f) - .06), new THREE.Vector2(0, -.06));       // a little thickness at the rim
  const dishMat = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: .4, metalness: .35, emissive: '#5a554c', side: THREE.DoubleSide });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), dishMat); el.add(bowl);
  const rimY = R * R / (4 * f), ring = new THREE.Mesh(new THREE.TorusGeometry(R, .045, 12, 96), MAT.alu); ring.rotation.x = Math.PI / 2; ring.position.y = rimY; el.add(ring);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; el.add(tube([Math.cos(a) * .25, -.18, Math.sin(a) * .25], [Math.cos(a) * R * .96, rimY - .06, Math.sin(a) * R * .96], .025, MAT.steel, 4)); }   // ribs behind the bowl
  const hub = cyl(.32, .5, MAT.white, 14); hub.position.y = -.14; el.add(hub);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.5, .35, 14), MAT.steel); cone.position.y = -.42; cone.rotation.x = Math.PI; el.add(cone);
  const axle = cyl(.07, R * .9, MAT.steel, 10); axle.rotation.z = Math.PI / 2; axle.position.y = -.14; el.add(axle);
  // feed horn on three struts: each strut runs from the rim ring to the horn mount at the focus
  const focus = new THREE.Vector3(0, f * 1.02, 0);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; el.add(tube([Math.cos(a) * R * .98, rimY, Math.sin(a) * R * .98], [focus.x, focus.y, focus.z], .03, MAT.steel, 5)); }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(.14, .06, .34, 12), MAT.orange); horn.position.copy(focus).add(new THREE.Vector3(0, .0, 0)); horn.rotation.x = Math.PI; el.add(horn);
  const lna = box(.18, .16, .18, MAT.dark, 0, focus.y - .22, 0); el.add(lna);
  // yoke: turntable, two arms and trunnion bearings at the axle ends
  const pivotY = 1.5;
  const turntable = cyl(.55, .22, MAT.white, 18); turntable.position.y = .11; az.add(turntable);
  const gear = cyl(.62, .06, MAT.dark, 18); gear.position.y = .03; az.add(gear);
  for (const s of [-1, 1]) { const arm = box(.2, pivotY + .1, .55, MAT.white, s * R * .45, pivotY / 2 + .15, 0); az.add(arm);
    const brace = tube([s * .35, .2, 0], [s * R * .45, pivotY * .6, 0], .045, MAT.steel, 5); az.add(brace);
    const cap = cyl(.13, .22, MAT.dark, 10); cap.rotation.z = Math.PI / 2; cap.position.set(s * (R * .45 + .06), pivotY + .15, 0); az.add(cap); }
  el.position.y = pivotY + .15 + .14; az.add(el);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, az, el, pivotHeight: pivotY + .3 };
}
