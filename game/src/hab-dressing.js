// Lived-in dressing for the six linked habitat pods (crew-interior.js).
// Design notes (see HAB-INTERIOR-NOTES.md):
//  - A "gradient of privacy" like NASA's CHAPEA Mars Dune Alpha: dirty work by the airlock, shared rooms in the middle,
//    private cabins at the quiet end. Pod 3 is Crew Quarters, pod 4 the Wardroom (galley + table + window).
//  - Lowered ceilings in the working pods, full height only in the Wardroom, so the rooms feel different (CHAPEA varied
//    its ceiling heights; HI-SEAS crews found an all-white open dome boring).
//  - ISS-style racks, cargo transfer bags, handrails, cable trays, vents and labels; mission-patch decals by the hatches
//    (an ISS tradition in the Unity node, where the crew eats).
//  - Circadian LED lighting like the ISS Solid State Lighting Assemblies: bright blue-white mornings, neutral days,
//    warm dim evenings, very dim amber at night.
//  - People live here: four (fictional) crew cabins with photos, drawings, books and keepsakes; named mugs and towels.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCrew } from './hab-crew.js';
import { loadModel } from './nasamodels.js';

const SPACING = 10.2, R = 4, CEIL = 3.3;
// Fictional crew. The first `crew` of them live here (2 on Cadet, 3 on Explorer, 4 on Commander); the rest of the
// cabins are spare and used for stowage. "You" is the player.
export const CREW = [
  { id: 'you', name: 'YOU', role: 'Junior astronaut', colour: '#3b7bd8', mug: '#3b7bd8' },
  { id: 'amara', name: 'F. LINDQVIST', first: 'Freya', role: 'Commander', colour: '#d9683a', mug: '#d9683a', home: 'Gothenburg, Sweden' },
  { id: 'meilin', name: 'M. L. TAN', first: 'Mei Lin', role: 'Geologist', colour: '#9b6cc9', mug: '#9b6cc9', home: 'Singapore' },
  { id: 'mateo', name: 'M. RIVERA', first: 'Mateo', role: 'Engineer', colour: '#3f9b6b', mug: '#3f9b6b', home: 'Valparaíso' },
];

// ---------- small helpers ----------
let seed = 911;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const M = {};   // shared materials by key
function mat(key, colour, o = {}) {
  return M[key] ??= new THREE.MeshStandardMaterial({ color: colour, roughness: o.r ?? .8, metalness: o.m ?? 0, emissive: o.e ?? '#000000', emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, transparent: !!o.t, opacity: o.t ?? 1 });
}
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); return o; };
function rbox(w, h, d, r, m, x = 0, y = 0, z = 0) {   // rounded box (rounded in the xy outline)
  const s = new THREE.Shape(), a = -w / 2, b = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(a + r, b); s.lineTo(a + w - r, b); s.quadraticCurveTo(a + w, b, a + w, b + r); s.lineTo(a + w, b + h - r); s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
  s.lineTo(a + r, b + h); s.quadraticCurveTo(a, b + h, a, b + h - r); s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: Math.min(.012, d / 4), bevelThickness: Math.min(.012, d / 4), bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -d / 2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o;
}
function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const picMats = [];
function pic(w, h, t, x = 0, y = 0, z = 0, glow = false) {   // a flat picture/label (paper, screen)
  const m = glow ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  picMats.push(m); const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); return o;
}
function label(text, { w = 512, h = 96, bg = '#26343d', fg = '#ecf2e7', font = 'bold 40px system-ui', align = 'center', border } = {}) {
  return tex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
    g.fillStyle = fg; g.font = font; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(text, align === 'center' ? w / 2 : 24, h / 2 + 2);
  });
}
// Place a group against the pod wall at angle a (0 = +z side, PI = -z side), facing the pod centre. Local +z faces in.
function onWall(pod, a, r, g) { g.position.set(pod * SPACING + Math.sin(a) * r, 0, Math.cos(a) * r); g.rotation.y = a + Math.PI; return g; }
const slotA = j => j / 24 * Math.PI * 2;   // the 24 wall panels of a pod
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const MENUS = ['Rehydrated curry + greenhouse lettuce', 'Pasta night!', 'Tacos (tortillas!)', 'Laksa from the care pack', 'Soup + fresh radishes', 'Pancakes (sol off)'];
const CABIN_NOTES = {
  you: '<p>Your own little room. Your personal kit box is still half packed, and somebody left a "Welcome to Mars!" note on the wall.</p>',
  amara: '<p>Photos of Elsa, Nils and Ebba, and their drawings: "MAMMA ON MARS". A chess game by email with her dad is set up on the desk. Her running shoes are by the bed.</p>',
  meilin: '<p>A night photo of Singapore\'s skyline, an orchid she grew in the greenhouse, her sketch of Home Plate\'s rock layers and four rock samples on the shelf.</p>',
  mateo: '<p>His guitar, a photo of his dog Bruno, a postcard of Valparaíso harbour and sticky notes: "Rover wheel torque check sol 16!" and "Call Mamá, Sunday".</p>',
};

// Merge every plain mesh in a group by material (one draw call per material), keeping textured/animated ones apart.
function bake(group) {
  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), drop = [];
  const visit = o => {
    if (o !== group && o.userData.noBake) return;
    if (o.isMesh && !o.userData.keep && !o.material.map) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      (buckets.get(o.material) ?? buckets.set(o.material, []).get(o.material)).push(g); drop.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(group);
  for (const o of drop) o.removeFromParent();
  for (const [m, list] of buckets) { const merged = new THREE.Mesh(mergeGeometries(list, false), m); merged.name = 'baked'; group.add(merged); for (const g of list) g.dispose(); }
  return group;
}

// ---------- pictures for the walls (all procedural, nothing real) ----------
const PHOTO = {
  family: (g, w, h) => { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#8fc2e8'); s.addColorStop(1, '#f3e1c3'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6aa05a'; g.fillRect(0, h * .72, w, h); [[.3, 1], [.48, .8], [.62, .55], [.74, .5]].forEach(([x, k], i) => { g.fillStyle = ['#2f3b55', '#a8433a', '#e0a33b', '#3d7a6a'][i]; g.beginPath(); g.ellipse(w * x, h * (.78 - .32 * k), 22 * k, 60 * k, 0, 0, 7); g.fill(); g.fillStyle = '#6b4a35'; g.beginPath(); g.arc(w * x, h * (.78 - .32 * k) - 70 * k, 16 * k, 0, 7); g.fill(); }); },
  dog: (g, w, h) => { g.fillStyle = '#d9cbb0'; g.fillRect(0, 0, w, h); g.fillStyle = '#7f5634'; g.beginPath(); g.ellipse(w * .5, h * .62, w * .26, h * .2, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(w * .74, h * .4, w * .12, h * .13, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(w * .82, h * .32, w * .04, h * .1, .5, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(w * .78, h * .38, 4, 0, 7); g.fill(); },
  skyline: (g, w, h) => { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#1b2350'); s.addColorStop(1, '#d9688a'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.fillStyle = '#10142a'; let x = 0; seed = 4; while (x < w) { const bw = 14 + rnd() * 26, bh = h * (.2 + rnd() * .45); g.fillRect(x, h * .78 - bh, bw, bh); x += bw + 3; } g.fillStyle = '#ffd98a'; for (let i = 0; i < 90; i++) g.fillRect(rnd() * w, h * (.35 + rnd() * .4), 2, 3); g.fillStyle = '#2a3f6a'; g.fillRect(0, h * .78, w, h); },
  coast: (g, w, h) => { g.fillStyle = '#9fd0e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e7d3a4'; g.beginPath(); g.moveTo(0, h * .6); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (.55 + .06 * Math.sin(x * .03))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#2f7fa8'; g.fillRect(0, h * .45, w, h * .1); for (let i = 0; i < 9; i++) { g.fillStyle = ['#e85d3f', '#f2c14e', '#4ca3c7', '#f7f2e6'][i % 4]; g.fillRect(i * w / 9, h * .25 - (i % 3) * 8, w / 9 - 3, 40); } },
  hills: (g, w, h) => { g.fillStyle = '#cfe3ef'; g.fillRect(0, 0, w, h); g.fillStyle = '#8aa35a'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 6) g.lineTo(x, h * (.55 + .1 * Math.sin(x * .02) + .05 * Math.sin(x * .07))); g.lineTo(w, h); g.fill(); g.fillStyle = '#5a7a3a'; g.fillRect(0, h * .85, w, h); },
  rocket: (g, w, h) => { g.fillStyle = '#20232a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2f2'; g.fillRect(w * .46, h * .15, w * .08, h * .55); g.fillStyle = '#e07a2e'; g.fillRect(w * .42, h * .3, w * .04, h * .4); g.fillRect(w * .54, h * .3, w * .04, h * .4);
    const f = g.createRadialGradient(w * .5, h * .78, 2, w * .5, h * .78, h * .25); f.addColorStop(0, '#fff7c0'); f.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = f; g.fillRect(0, h * .6, w, h * .4); },
};
function photo(kind, w = 256, h = 192, caption) {
  return tex(w, h + (caption ? 40 : 0), (g, W, H) => {
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H); g.save(); g.translate(10, 10); g.beginPath(); g.rect(0, 0, w - 20, h - 20); g.clip(); PHOTO[kind](g, w - 20, h - 20); g.restore();
    if (caption) { g.fillStyle = '#333'; g.font = 'italic 22px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillText(caption, W / 2, h + 18); }
  });
}
function kidDrawing(text, colour = '#e0412f') {
  return tex(256, 192, (g, w, h) => {
    g.fillStyle = '#fffdf7'; g.fillRect(0, 0, w, h); g.lineWidth = 6; g.lineCap = 'round';
    g.strokeStyle = '#e8743b'; g.fillStyle = '#e8743b'; g.beginPath(); g.arc(w * .72, h * .36, 34, 0, 7); g.fill();   // Mars
    g.strokeStyle = '#555'; g.beginPath(); g.moveTo(w * .2, h * .8); g.lineTo(w * .28, h * .28); g.lineTo(w * .36, h * .8); g.stroke();   // rocket
    g.strokeStyle = colour; g.beginPath(); g.moveTo(w * .22, h * .8); g.lineTo(w * .28, h * .95); g.lineTo(w * .34, h * .8); g.stroke();
    g.fillStyle = '#f7c948'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(30 + i * 40, 18 + (i % 2) * 14, 4, 0, 7); g.fill(); }
    g.fillStyle = colour; g.font = 'bold 26px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillText(text, w / 2, h - 10);
  });
}
function postcard(place, kind) {
  return tex(320, 208, (g, w, h) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h); g.save(); g.translate(8, 8); PHOTO[kind](g, w - 16, h - 56); g.restore(); g.fillStyle = '#26343d'; g.font = 'bold 30px Georgia, serif'; g.fillText(`Greetings from ${place}`, 14, h - 16); });
}
function missionPatch(top, bottom, ring = '#2b3a67', i = 0) {
  return tex(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2); g.fillStyle = ring; g.beginPath(); g.arc(0, 0, 124, 0, 7); g.fill(); g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(0, 0, 92, 0, 7); g.fill();
    const s = g.createRadialGradient(-20, -20, 5, 0, 0, 92); s.addColorStop(0, '#1b2a55'); s.addColorStop(1, '#0b1026'); g.fillStyle = s; g.beginPath(); g.arc(0, 0, 88, 0, 7); g.fill();
    g.fillStyle = '#d9683a'; g.beginPath(); g.arc(10, 30, 46 - i * 4, 0, 7); g.fill(); g.fillStyle = '#fff'; for (let k = 0; k < 14; k++) g.fillRect(Math.cos(k * 2.4) * 70, Math.sin(k * 1.7) * 60 - 20, 2, 2);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(10, 30, 62 - i * 4, Math.PI * 1.1, Math.PI * 1.8); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.textAlign = 'center';
    const arc = (text, r, up) => { const n = text.length, span = Math.min(Math.PI * .9, n * .13); [...text].forEach((ch, k) => { const a = (up ? -Math.PI / 2 : Math.PI / 2) + (k - (n - 1) / 2) * span / Math.max(1, n - 1) * (up ? 1 : -1); g.save(); g.rotate(a + (up ? Math.PI / 2 : -Math.PI / 2)); g.fillText(ch, 0, up ? -r : r + 6); g.restore(); }); };
    arc(top, 104, true); arc(bottom, 104, false);
  });
}
function patchDisc(d, t, edge = '#2b3a67', x = 0, y = 0, z = 0) {   // an embroidered patch: round, with a raised stitched (merrowed) border
  const g = new THREE.Group(); g.position.set(x, y, z);
  const face = new THREE.Mesh(new THREE.CircleGeometry(d / 2 * .97, 48), new THREE.MeshStandardMaterial({ map: t, roughness: .95 })); face.position.z = .003; g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(d / 2 * .98, d * .025, 6, 48), mat('patchEdge' + edge, edge, { r: 1 })); rim.position.z = .003; g.add(rim);
  return g;
}
function sticky(text, colour = '#fff38a') {
  return tex(160, 160, (g, w, h) => { g.fillStyle = colour; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, w, 22); g.fillStyle = '#2a2a2a'; g.font = '22px "Comic Sans MS", cursive';
    text.split('\n').forEach((l, i) => g.fillText(l, 10, 52 + i * 28)); });
}

// ---------- reusable pieces ----------
// A standard equipment rack (ISS-style): frame, a stack of front panels with fasteners, a couple of status LEDs and a label.
function rack(name, { w = 1.0, h = 2.2, style = 0, accent = '#d9683a' } = {}) {
  const g = new THREE.Group(), frame = mat('rackFrame', '#8e979b', { r: .55, m: .35 }), face = mat('rackFace', '#d4d8d6', { r: .7 }), dark = mat('rackDark', '#3a4046', { r: .6 }), fast = mat('fast', '#b9bec2', { m: .6, r: .35 });
  g.add(box(w, h, .06, frame, 0, h / 2 + .1, .03));
  let y = .16; seed = name.length * 97 + style;
  while (y < h - .1) {
    const ph = Math.min(h - y, [.36, .48, .24, .6][Math.floor(rnd() * 4)]);
    const p = rbox(w - .06, ph - .02, .04, .02, rnd() < .25 ? dark : face, 0, y + ph / 2 + .1, .085); g.add(p);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(cyl(.009, .009, .012, fast, sx * (w / 2 - .06), y + ph / 2 + .1 + sy * (ph / 2 - .05), .11, 6)).children.at(-1).rotation.x = Math.PI / 2;
    if (rnd() < .5) g.add(box(.18, .03, .03, fast, 0, y + ph / 2 + .1, .12));   // handle
    y += ph;
  }
  for (let i = 0; i < 3; i++) g.add(box(.025, .025, .01, mat('led' + i, ['#5dff9a', '#ffd27a', '#5dff9a'][i], { e: ['#5dff9a', '#ffd27a', '#5dff9a'][i], ei: 1.5 }), -w / 2 + .1 + i * .05, h - .05, .11));
  const l = pic(w * .7, w * .13, label(name, { bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 34px system-ui' }), 0, h - .02, .113); g.add(l);
  g.add(box(w * .9, .05, .05, mat('accent' + accent, accent, { r: .6 }), 0, .14, .1));
  return g;
}
// A cargo transfer bag (the off-white Nomex bags that hold almost everything on the ISS), with a barcode label.
function ctb(w, h, d, tag) {
  const g = new THREE.Group(), cloth = mat('ctb', '#e6e0cf', { r: 1 }), strap = mat('strap', '#3c4a5c', { r: .9 });
  g.add(rbox(w, h, d, .05, cloth, 0, h / 2, 0)); g.add(box(w + .01, .03, d + .01, strap, 0, h * .7, 0)); g.add(box(.03, h + .01, d + .01, strap, w * .3, h / 2, 0));
  if (tag) g.add(pic(.16, .07, label(tag, { w: 256, h: 112, bg: '#ffffff', fg: '#111', font: '28px monospace' }), -w * .15, h * .45, d / 2 + .016));
  return g;
}
function handrail(len, vertical = false) {
  const g = new THREE.Group(), m = mat('rail', '#c9a227', { r: .45, m: .2 }), r = cyl(.016, .016, len, m, 0, 0, .08, 10);
  if (!vertical) r.rotation.z = Math.PI / 2; g.add(r);
  for (const s of [-1, 1]) { const f = box(.04, .04, .08, m, vertical ? 0 : s * len * .42, vertical ? s * len * .42 : 0, .04); g.add(f); }
  return g;
}
// ---- plants: a real pot (lathe profile with a lip), soil, stems and curved leaves that grow from the soil ----
let leafGeo = null;
function leafGeometry() {   // a pointed oval leaf, cupped along the midrib and curling down at the tip
  if (leafGeo) return leafGeo;
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(.32, .18, .36, .7, 0, 1); sh.bezierCurveTo(-.36, .7, -.32, .18, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(x) * .45 - y * y * .35); }
  g.computeVertexNormals(); return (leafGeo = g);
}
function potGeometry(rTop, rBot, h) {
  const pts = [[0, 0], [rBot, 0], [rTop * .97, h * .86], [rTop * 1.08, h * .88], [rTop * 1.08, h], [rTop * .92, h], [rTop * .86, h * .9], [rBot * .9, h * .12], [0, h * .12]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}
function plant(scale = 1, leaf = '#4f8f3a', pot = '#b5653a', kind = 'herb') {
  const g = new THREE.Group(), lm = mat('leafD' + leaf, leaf, { r: .65, side: THREE.DoubleSide }), stemM = mat('stem' + leaf, new THREE.Color(leaf).multiplyScalar(.75).getStyle(), { r: .7 });
  const H = .13 * scale, rT = .09 * scale, rB = .065 * scale;
  g.add(new THREE.Mesh(potGeometry(rT, rB, H), mat('pot' + pot, pot, { r: .55, side: THREE.DoubleSide })));
  g.add(cyl(rT * .88, rT * .88, .008, mat('soil', '#3b2a1f', { r: 1 }), 0, H * .86, 0, 20));
  seed = Math.floor(scale * 1000 + leaf.charCodeAt(2) * 7);
  if (kind === 'chives') {
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r0 = rnd() * rT * .6, h = (.12 + rnd() * .12) * scale, b = cyl(.0035 * scale, .006 * scale, h, stemM, Math.cos(a) * r0, H * .86 + h / 2, Math.sin(a) * r0, 5); b.rotation.set((rnd() - .5) * .35, 0, (rnd() - .5) * .35); g.add(b); }
    return g;
  }
  const n = kind === 'seedling' ? 4 : 9, base = H * .86;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rnd() * .5, tilt = .35 + rnd() * .5, len = (kind === 'seedling' ? .05 : .07 + rnd() * .07) * scale;
    const sx = Math.cos(a) * Math.sin(tilt) * len, sy = Math.cos(tilt) * len, sz = Math.sin(a) * Math.sin(tilt) * len;
    g.add(tube3([[Math.cos(a) * .006, base, Math.sin(a) * .006], [sx * .5, base + sy * .6, sz * .5], [sx, base + sy, sz]], .0028 * scale + .001, stemM, 6));
    const L = new THREE.Mesh(leafGeometry(), lm), ls = (kind === 'seedling' ? .045 : .085 + rnd() * .045) * scale;
    L.scale.set(ls, ls, ls); L.position.set(sx, base + sy, sz); L.rotation.order = 'YXZ'; L.rotation.set(-1.05 - rnd() * .45, -a - Math.PI / 2, (rnd() - .5) * .4); g.add(L);
  }
  if (kind === 'herb') for (let i = 0; i < 6; i++) {   // the young leaves in the middle stand up
    const a = i / 6 * 6.28 + .3, len = (.1 + rnd() * .05) * scale, sx = Math.cos(a) * .015 * scale, sz = Math.sin(a) * .015 * scale;
    g.add(tube3([[0, base, 0], [sx * .5, base + len * .6, sz * .5], [sx, base + len, sz]], .0025 * scale + .001, stemM, 6));
    const L = new THREE.Mesh(leafGeometry(), lm), ls = (.06 + rnd() * .03) * scale; L.scale.set(ls, ls, ls); L.position.set(sx, base + len, sz); L.rotation.order = 'YXZ'; L.rotation.set(-.45 - rnd() * .3, -a - Math.PI / 2, 0); g.add(L);
  }
  return g;
}
function orchid() {   // a moth orchid in a clear pot of bark chips: broad leaves, an arching spike, five-petal flowers
  const g = new THREE.Group(), glassPot = new THREE.MeshStandardMaterial({ color: '#e8f2f0', roughness: .15, transparent: true, opacity: .55, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(potGeometry(.07, .055, .1), glassPot)); seed = 41;
  for (let i = 0; i < 14; i++) { const c = box(.018, .01, .014, mat('bark', ['#6b4a2e', '#8a6038'][i % 2], { r: 1 }), (rnd() - .5) * .09, .02 + rnd() * .07, (rnd() - .5) * .09); c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(c); }
  const lm = mat('orchidLeaf', '#2f6b2a', { r: .45, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) { const L = new THREE.Mesh(leafGeometry(), lm); L.scale.set(.11, .17, .12); L.position.set(0, .095, 0); L.rotation.order = 'YXZ'; L.rotation.set(-1.25, i * 1.6 + .3, 0); g.add(L); }
  for (let i = 0; i < 2; i++) g.add(tube3([[0, .09, 0], [.04 * (i ? 1 : -1), .07, .05], [.07 * (i ? 1 : -1), .02, .06]], .003, mat('root', '#b9c7a3', { r: .8 }), 8));
  const stemM = mat('orchidStem', '#4a6b2c', { r: .6 }), pts = [[0, .1, 0], [.005, .25, -.01], [.03, .36, 0], [.09, .41, .01], [.15, .4, .02]];
  g.add(tube3(pts, .003, stemM, 20)); g.add(cyl(.002, .002, .3, mat('stake', '#6b8a3a'), -.01, .25, -.01, 4));
  const petalM = mat('petal', '#c77ad8', { r: .5, side: THREE.DoubleSide }), lipM = mat('lip', '#f2d24a', { r: .5 }), curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const petal = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(.6, .3, .6, .9, 0, 1); sh.bezierCurveTo(-.6, .9, -.6, .3, 0, 0); return new THREE.ShapeGeometry(sh, 8); })();
  [.62, .75, .88, 1].forEach((u, k) => {
    const f = new THREE.Group(), q = curve.getPoint(u); f.position.set(q.x, q.y - .015, q.z + .01); g.add(f); const sz = k === 3 ? .014 : .024;
    if (k === 3) { f.add(new THREE.Mesh(new THREE.SphereGeometry(sz, 10, 8), petalM)); return; }   // a bud at the tip
    for (let j = 0; j < 5; j++) { const m = new THREE.Mesh(petal, petalM); m.scale.setScalar(sz * (j < 3 ? 1.1 : .9)); m.rotation.z = j * 1.257; f.add(m); }
    f.add(new THREE.Mesh(new THREE.SphereGeometry(sz * .3, 8, 6), lipM)); f.rotation.y = .2;
  });
  return g;
}
function books(n, x, y, z, rotY = 0) {   // hardbacks: cover boards, a cream page block, gold bands on the spine
  const g = new THREE.Group(); seed = n * 31 + Math.round(x * 100);
  const pages = mat('pages', '#efe8d6', { r: .95 }), gold = mat('gilt', '#c9a227', { r: .4, m: .5 });
  let off = 0;
  for (let i = 0; i < n; i++) {
    const t = .025 + rnd() * .03, hh = .16 + rnd() * .08, d = .14 + rnd() * .04, cover = mat('book' + i % 6, ['#8a2d2d', '#2d4f8a', '#d9b44a', '#3f7a52', '#e0e0d6', '#5a3a6e'][i % 6], { r: .7 });
    const b = new THREE.Group(); b.position.set(off + t / 2, 0, 0);
    b.add(box(.004, hh, d, cover, -t / 2 + .002, hh / 2, 0)); b.add(box(.004, hh, d, cover, t / 2 - .002, hh / 2, 0));   // the two boards
    b.add(box(t, hh, .006, cover, 0, hh / 2, -d / 2 + .003));                                                        // the spine
    b.add(box(t - .008, hh - .01, d - .012, pages, 0, hh / 2, .002));
    for (const yy of [.15, .85]) b.add(box(t + .001, .006, .002, gold, 0, hh * yy, -d / 2 - .001));
    if (i === n - 1) b.rotation.z = .25; g.add(b); off += t + .003;
  }
  g.position.set(x, y, z); g.rotation.y = rotY; return g;
}
function mug(colour, x, y, z) {   // a glazed ceramic mug: hollow, thick rim, coffee inside, a proper loop handle
  const g = new THREE.Group(), m = mat('mugG' + colour, colour, { r: .25 });
  const prof = [[0, 0], [.036, 0], [.04, .004], [.041, .1], [.036, .1], [.034, .012], [0, .012]].map(([a, b]) => new THREE.Vector2(a, b));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ color: colour, roughness: .25, side: THREE.DoubleSide })));
  g.add(cyl(.0345, .0345, .002, mat('coffee', '#3b2012', { r: .2 }), 0, .08, 0, 24));
  const h = new THREE.Mesh(new THREE.TorusGeometry(.026, .0065, 10, 20, Math.PI * 1.2), m); h.rotation.z = -Math.PI * .6; h.position.set(.042, .052, 0); g.add(h);
  g.position.set(x, y, z); return g;
}
function plush(colour = '#c08a5a') {   // a small teddy: it rode along to Mars in someone's kit
  const g = new THREE.Group(), m = mat('plush' + colour, colour, { r: 1 }), lite = mat('plushLite', '#e2c49b', { r: 1 }), dk = mat('eye', '#111', { r: .3 });
  const sph = (r, mm, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mm); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  sph(.07, m, 0, .075, 0, 1, 1.1, .9); sph(.04, lite, 0, .07, .045, 1, 1.1, .5);                 // body and tummy
  sph(.058, m, 0, .19, .005); sph(.026, lite, 0, .18, .052, 1.1, .8, .8); sph(.009, dk, 0, .188, .074);   // head, snout, nose
  for (const s of [-1, 1]) { sph(.022, m, s * .042, .238, -.005, 1, 1, .6); sph(.012, lite, s * .042, .238, .006, 1, 1, .4); sph(.007, dk, s * .022, .205, .05);
    sph(.025, m, s * .07, .09, .02, .8, 1.3, .8).rotation.z = s * .5; sph(.028, m, s * .04, .02, .045, .9, .7, 1.3); }
  return g;
}
function guitar() {   // a steel-string acoustic: figure-eight body, sound hole rosette, bridge, neck with frets, six strings
  const g = new THREE.Group(), wood = mat('guitarWood', '#c58a4a', { r: .35 }), side = mat('guitarSide', '#6b3d1f', { r: .4 }), dark = mat('guitarDark', '#2a1a10', { r: .5 }), metal = mat('pSteel', '#b8bec4', { m: .7, r: .32 });
  const sh = new THREE.Shape(), P = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, y = Math.sin(a), lower = y < 0; const r = lower ? .19 : .145, cy = lower ? .2 : .43; P.push(new THREE.Vector2(Math.cos(a) * r, cy + y * (lower ? .17 : .13))); }
  const hull = P.filter(p => !(p.y > .3 && p.y < .33 && Math.abs(p.x) > .1)); sh.setFromPoints(hull);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .09, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 24 }), side); body.position.z = -.045; g.add(body);
  const top = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), wood); top.position.z = .054; g.add(top);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(.045, 24), dark); hole.position.set(0, .36, .056); g.add(hole);
  const ros = new THREE.Mesh(new THREE.RingGeometry(.05, .058, 32), mat('rosette', '#e8dcc0', { r: .5 })); ros.position.set(0, .36, .056); g.add(ros);
  g.add(box(.12, .025, .012, dark, 0, .14, .06));
  g.add(box(.05, .5, .025, dark, 0, .8, .03)); g.add(box(.085, .14, .022, dark, 0, 1.12, .02));
  for (let k = 0; k < 12; k++) g.add(box(.05, .003, .028, metal, 0, .58 + k * .036, .032));
  for (let k = 0; k < 6; k++) { const x = -.02 + k * .008; g.add(box(.0012, .98, .0012, metal, x, .63, .065)); g.add(cyl(.006, .006, .03, metal, (k < 3 ? -.05 : .05), 1.07 + (k % 3) * .035, .02, 6).rotateZ(Math.PI / 2)); }
  return g;
}
function blanket(w, d, colourA, colourB) {   // a crocheted granny-square blanket
  const t = tex(256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? colourA : colourB; g.fillRect(x * 32, y * 32, 32, 32); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * 32 + 10, y * 32 + 10, 12, 12); } });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); const o = new THREE.Mesh(new THREE.BoxGeometry(w, .03, d), m); o.userData.keep = true; return o;
}

// ---------- the crew cabins ----------
// Each cabin is a small private room (about the size of the ISS crew quarters' bigger Mars cousin: 1.9 x 2.2 m)
// built outward from a doorway in the pod wall. Bunk, fold-down desk, shelf, reading light, wall of keepsakes.
// The tall Wardroom ceiling: radial roof ribs round a hub, a ring air duct with diffusers, three felt acoustic clouds
// on wires (sound bounces round a hard round room), a proper ring pendant over the table, and fairy lights the crew
// strung along the galley wall.
function wardroomCeiling(P, cx, panelMat) {
  const rib = mat('roofRib', '#c9c4b8', { r: .6, m: .2 }), steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), wire = mat('cableHang', '#333'), dark = mat('pendantBody', '#3a3f45', { r: .45, m: .4 });
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, b = box(3.55, .14, .1, rib, cx + Math.cos(a) * 2.1, 6.52, Math.sin(a) * 2.1); b.rotation.y = -a; P.add(b); }
  P.add(cyl(.42, .42, .16, rib, cx, 6.5, 0, 24)); P.add(cyl(.3, .3, .04, mat('hubCap', '#8c9396', { m: .4, r: .4 }), cx, 6.41, 0, 24));
  const duct = new THREE.Mesh(new THREE.TorusGeometry(2.7, .11, 10, 64), mat('duct', '#d4d1c8', { r: .55, m: .2 })); duct.rotation.x = Math.PI / 2; duct.position.set(cx, 6.2, 0); P.add(duct);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2, d = box(.24, .03, .14, mat('diffSlot', '#7c8388', { r: .6 }), cx + Math.cos(a) * 2.7, 6.08, Math.sin(a) * 2.7); d.rotation.y = -a; P.add(d); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P.add(cyl(.01, .01, .3, steel, cx + Math.cos(a) * 2.7, 6.4, Math.sin(a) * 2.7, 6)); }
  // acoustic clouds
  [['#c7d6cf', -1.25], ['#e3c9b8', 0], ['#d9cbb0', 1.25]].forEach(([c, z], k) => {
    const cl = rbox(2.4 - Math.abs(z) * .5, 1.0, .06, .12, mat('cloud' + k, c, { r: 1, e: c, ei: .45 }), cx, 5.35 + (k % 2) * .15, z); cl.rotation.x = Math.PI / 2; P.add(cl);
    for (const dx of [-.9, .9]) for (const dz of [-.4, .4]) P.add(cyl(.004, .004, 1.2 - (k % 2) * .15, wire, cx + dx * (1 - Math.abs(z) * .2), 6.0 - (k % 2) * .07, z + dz, 4));
  });
  // ring pendant: dark housing band, glowing inner band and a bottom diffuser ring
  const RR = 1.45, Y = 3.95;
  P.add(at(new THREE.Mesh(new THREE.CylinderGeometry(RR + .04, RR + .04, .14, 64, 1, true), Object.assign(dark.clone(), { side: THREE.DoubleSide })), cx, Y, 0));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(RR - .02, RR - .02, .1, 64, 1, true), panelMat.clone()); inner.material.side = THREE.BackSide; inner.position.set(cx, Y, 0); inner.userData.keep = true; P.add(inner);
  const lip = new THREE.Mesh(new THREE.RingGeometry(RR - .08, RR + .04, 64), panelMat); lip.rotation.x = Math.PI / 2; lip.position.set(cx, Y - .071, 0); lip.userData.keep = true; P.add(lip);
  const top = new THREE.Mesh(new THREE.RingGeometry(RR - .08, RR + .04, 64), dark); top.rotation.x = -Math.PI / 2; top.position.set(cx, Y + .071, 0); P.add(top);
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + .5, x = cx + Math.cos(a) * RR, z = Math.sin(a) * RR; P.add(cyl(.004, .004, 6.3 - Y, wire, x, (6.3 + Y) / 2, z, 4)); P.add(cyl(.05, .05, .04, steel, x, 6.28, z, 12)); }
  P.add(cyl(.004, .004, 6.2 - Y - .08, mat('cableBlack', '#1d1d1d'), cx + RR, (6.2 + Y) / 2, 0, 4));   // power lead
  // fairy lights along the galley wall, sagging between little hooks
  const bulbs = [], warm = mat('fairy', '#ffd9a0', { e: '#ffcf80', ei: 2.2 }), pts = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40, a = .28 + t * 1.15, seg = (t * 4) % 1, sag = Math.sin(seg * Math.PI) * .18; pts.push(new THREE.Vector3(cx + Math.sin(a) * (R - .12), 2.95 - sag, Math.cos(a) * (R - .12))); }
  P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .004, 4, false), mat('cableBlack', '#1d1d1d')));
  for (let k = 1; k < 40; k += 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), warm); b.position.copy(pts[k]).y -= .02; b.userData.keep = true; P.add(b); bulbs.push(b); }
  const glow = new THREE.PointLight('#ffcf80', 1.2, 3.5, 2); glow.position.set(cx + Math.sin(.85) * 3.4, 2.7, Math.cos(.85) * 3.4); P.add(glow);
}
// A crew-quarters sliding door: pale composite leaf with two raised panels, the owner's colour band, a frosted
// vision strip, a recessed pull, a louvred vent at the bottom (air must flow even with the door shut) and a status light.
function doorLeaf(colour, id) {
  const g = new THREE.Group(), leaf = mat('doorLeaf', '#d9dcd8', { r: .5 }), panel = mat('doorPanel', '#cfd3d0', { r: .55 }), band = mat('door' + id, colour, { r: .6 }), dark = mat('pDark', '#2f353b');
  g.add(rbox(1.02, 2.2, .05, .03, leaf, 0, 1.12, .03));
  for (const [y, h] of [[.62, .7], [1.62, .62]]) g.add(rbox(.82, h, .012, .02, panel, 0, y, .062));
  g.add(box(1.0, .12, .03, band, 0, 1.04, .065)); for (const x of [-.5, .5]) g.add(box(.03, 2.18, .03, band, x, 1.12, .062));
  g.add(rbox(.6, .1, .012, .03, mat('frost', '#cfe3ea', { r: .15, m: .1 }), 0, 2.03, .063));
  g.add(pic(.7, .14, tex(256, 52, (c, w, h) => { c.fillStyle = '#9aa1a7'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a4046'; for (let y = 6; y < h - 4; y += 8) c.fillRect(8, y, w - 16, 4); }), 0, .17, .057));
  g.add(box(.03, .32, .02, dark, .42, 1.12, .065)); g.add(box(.06, .36, .006, mat('pullRecess', '#3a4046'), .42, 1.12, .058));
  g.add(cyl(.012, .012, .01, mat('doorLed', '#7dffb2', { e: '#7dffb2', ei: 1.5 }), .42, 1.36, .062, 10).rotateX(Math.PI / 2));
  return g;
}
function cabin(person) {
  const W = 1.9, D = 2.2, H = 2.4, g = new THREE.Group(), lived = new THREE.Group(), stow = new THREE.Group();
  const wall = mat('cabinWall', '#e8e2d6', { r: .9, side: THREE.DoubleSide }), floor = mat('cabinFloor', '#6a6f72', { r: .95 }), foam = mat('foam', '#cfd6dc', { r: 1 });
  const wood = mat('ply', '#c49a6c', { r: .75 });
  g.add(box(W, .02, D, floor, 0, .01, -D / 2)); g.add(box(W, .02, D, wall, 0, H, -D / 2));
  g.add(box(.04, H, D, wall, -W / 2, H / 2, -D / 2)); g.add(box(.04, H, D, wall, W / 2, H / 2, -D / 2)); g.add(box(W, H, .04, wall, 0, H / 2, -D));
  // acoustic lining (the ISS crew quarters are padded for quiet) on the bunk side
  for (let k = 0; k < 4; k++) { const tile = rbox((D - .14) / 4 - .02, 1.1, .045, .05, foam, 0, 1.25, 0); tile.rotation.y = Math.PI / 2; tile.position.set(-W / 2 + .045, 1.25, -.07 - (k + .5) * (D - .14) / 4); g.add(tile); }   // padded panels
  for (let k = 0; k < 3; k++) g.add(box(.012, .012, .06, mat('pSteel', '#b8bec4', { m: .7, r: .32 }), -W / 2 + .07, .72 + k * .5, -D / 2));   // panel buttons
  // door frame and sliding door (slid open into the wall), name plate
  const frameM = mat('doorFrame', '#8e979b', { r: .5, m: .3 });
  g.add(box(.08, H, .1, frameM, -.55, H / 2, 0)); g.add(box(.08, H, .1, frameM, .55, H / 2, 0)); g.add(box(1.18, .1, .1, frameM, 0, H - .05, 0));
  // lived-in: the door is slid open into the wall with the owner's name plate; spare: shut, labelled for stowage
  const openDoor = new THREE.Group(), sleepDoor = new THREE.Group(); openDoor.userData.noBake = sleepDoor.userData.noBake = true; g.add(openDoor); g.add(sleepDoor); sleepDoor.visible = false;
  // pocket door: slid into the wall, only its coloured edge and pull show; the name plate sits on the header above
  openDoor.add(box(.06, 2.2, .05, mat('doorLeaf', '#d9dcd8', { r: .5 }), -.52, 1.12, .03)); openDoor.add(box(.065, .12, .055, mat('door' + person.id, person.colour, { r: .6 }), -.52, 1.0, .03));
  openDoor.add(box(.02, .3, .03, mat('pDark', '#2f353b'), -.48, 1.1, .05));   // the pull, the only bit you see of a door slid into the wall
  openDoor.add(pic(.5, .1, label(person.name, { w: 512, h: 100, bg: '#f7f5ef', fg: '#1d2a33', font: 'bold 44px system-ui' }), 0, 2.62, .08));
  sleepDoor.add(doorLeaf(person.colour, person.id));
  sleepDoor.add(pic(.5, .1, label(person.name, { w: 512, h: 100, bg: '#f7f5ef', fg: '#1d2a33', font: 'bold 44px system-ui' }), 0, 1.76, .07));
  sleepDoor.add(pic(.36, .16, label('Zzz · sleeping', { w: 384, h: 170, bg: '#2b3a67', fg: '#ffe9a8', font: 'bold 48px "Comic Sans MS", cursive' }), -.15, 1.3, .07));
  if (person.id === 'amara' || person.id === 'freya') sleepDoor.add(pic(.22, .17, kidDrawing('MAMMA!', '#2d5fa8'), .24, 1.32, .07));   // her kids' drawing taped to the door
  else if (person.id === 'mateo') sleepDoor.add(pic(.12, .12, sticky('Knock!\nloud\nguitar', '#9fe0b0'), .26, 1.3, .07));
  else if (person.id === 'meilin') sleepDoor.add(pic(.16, .12, postcard('Singapore', 'skyline'), .26, 1.3, .07));
  // spare cabins stand open too (any crewmate can sleep in the spare bunk): pocket door slid away, plate on the header
  stow.add(box(.06, 2.2, .05, mat('doorLeaf', '#d9dcd8', { r: .5 }), -.52, 1.12, .03)); stow.add(box(.065, .12, .055, mat('doorspare', '#8e979b', { r: .6 }), -.52, 1.0, .03));
  stow.add(box(.02, .3, .03, mat('pDark', '#2f353b'), -.48, 1.1, .05));
  stow.add(pic(.5, .1, label('SPARE · STOWAGE', { w: 512, h: 100, bg: '#5a6168', fg: '#fff', font: 'bold 44px system-ui' }), 0, 2.62, .08));
  g.add(lived); g.add(stow); lived.userData.noBake = stow.userData.noBake = true;
  // bunk (bed on a storage plinth) along the left wall
  const bed = new THREE.Group(); bed.position.set(-W / 2 + .45, 0, -D / 2 - .05); g.add(bed);
  bed.add(box(.86, .42, 2.0, wood, 0, .21, 0)); for (let i = 0; i < 2; i++) bed.add(box(.36, .3, .02, mat('drawer', '#b88d61', { r: .7 }), -.0, .22, .7 - i * .55 + 1.01 - 1.0).translateX(0));
  bed.add(rbox(.82, .16, 1.94, .05, mat('mattress', '#d8dde4', { r: 1 }), 0, .5, 0).rotateX(0));
  // fold-down desk and shelves on the right wall, reading light
  const bracket = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), edge = mat('plyEdge', '#a87d50', { r: .7 });
  const shelf = (y, th) => { const sh = rbox(.5, .7, th, .02, wood); sh.position.set(W / 2 - .27, y, -D + .55); sh.rotation.x = -Math.PI / 2; g.add(sh);
    g.add(box(.012, .03, .7, edge, W / 2 - .52, y + .02, -D + .55));   // a little lip so things don't slide off
    for (const dz of [-.25, .25]) { const b = box(.012, .12, .12, bracket, W / 2 - .07, y - .065, -D + .55 + dz); g.add(b); const d2 = box(.012, .16, .012, bracket, W / 2 - .12, y - .06, -D + .55 + dz); d2.rotation.x = 0; d2.rotation.z = .75; g.add(d2); } };
  shelf(.76, .04); shelf(1.62, .025); shelf(1.95, .025);
  // reading lamp: wall plate, gooseneck, shade with a warm LED
  g.add(rbox(.08, .1, .015, .02, bracket, W / 2 - .03, 1.42, -D + .82).rotateY(-Math.PI / 2));
  g.add(tube3([[W / 2 - .03, 1.42, -D + .82], [W / 2 - .12, 1.5, -D + .8], [W / 2 - .2, 1.48, -D + .72], [W / 2 - .24, 1.42, -D + .66]], .008, mat('lampArm', '#555b61', { m: .4, r: .4 }), 16));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.025, .055, .07, 20, 1, true), mat('lampShade2', '#2f353b', { r: .5, m: .3, side: THREE.DoubleSide })); shade.position.set(W / 2 - .25, 1.4, -D + .65); shade.rotation.set(.3, 0, -.3); g.add(shade);
  g.add(cyl(.045, .045, .004, mat('lampGlow', '#fff2d6', { e: '#ffe2b0', ei: 2 }), W / 2 - .25, 1.37, -D + .645, 20));
  // ceiling light panel and the air vent (fans keep CO2 from pooling round a sleeper)
  g.add(rbox(.6, .3, .02, .04, mat('cabinLED', '#fffaf0', { e: '#fff1dc', ei: .9 }), 0, H - .015, -D / 2).rotateX(Math.PI / 2));
  g.add(rbox(.32, .22, .03, .02, mat('vent', '#9aa1a7', { r: .5, m: .3 }), 0, H - .25, -D + .03));
  g.add(pic(.28, .18, tex(128, 96, (gg, w, h) => { gg.fillStyle = '#c3c8cc'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#3a4046'; for (let y = 10; y < h - 6; y += 9) gg.fillRect(8, y, w - 16, 5); }), 0, H - .25, -D + .05));
  // a spare cabin is used for stowage: bags strapped on the desk and shelf, the water reserve under the desk (the bunk stays free)
  stow.add(ctb(.42, .3, .6, 'SPARE-1').translateX(W / 2 - .27).translateY(.78).translateZ(-D + .55));
  stow.add(ctb(.42, .28, .6, 'SPARE-2').translateX(W / 2 - .27).translateY(1.645).translateZ(-D + .55));
  stow.add(ctb(.45, .45, .45, 'H2O-RSV').translateX(W / 2 - .3).translateZ(-D + .45));
  stow.add(rbox(.5, .1, .3, .05, mat('pillow', '#f2f2ee', { r: 1 }), -W / 2 + .45, .64, -D + .3));
  stow.add(rbox(.78, .06, 1.3, .03, mat('duvetSpare', '#a9b4bf', { r: 1 }), -W / 2 + .45, .615, -D / 2 + .3));
  // bedding: pillow, sleeping bag/duvet, and (for some) a hand-made blanket
  lived.add(rbox(.5, .1, .3, .05, mat('pillow', '#f2f2ee', { r: 1 }), -W / 2 + .45, .64, -D + .3));
  const bag = rbox(.78, .07, 1.3, .03, mat('duvet' + person.id, person.id === 'amara' ? '#3d5a80' : person.id === 'meilin' ? '#8fb3a6' : person.id === 'mateo' ? '#5a5f69' : '#c7d0db', { r: 1 }), -W / 2 + .45, .62, -D / 2 + .3); lived.add(bag);
  // the keepsake wall above the bed: photos, a child's drawing, a postcard, a patch
  const wallItems = new THREE.Group(); wallItems.position.set(-W / 2 + .06, 0, -D / 2); wallItems.rotation.y = Math.PI / 2; lived.add(wallItems);
  const put = (t, w, h, x, y, rz = 0) => { const p = pic(w, h, t, x, y, 0); p.rotation.z = rz; wallItems.add(p); return p; };
  const shelfTop = (o, x, z) => { o.position.set(W / 2 - .27 + x, 1.64, -D + .55 + z); lived.add(o); };
  const deskTop = (o, x, z) => { o.position.set(W / 2 - .27 + x, .78, -D + .55 + z); lived.add(o); };
  const laptop = new THREE.Group(), shell = mat('laptop', '#3a3f45', { r: .35, m: .5 });
  laptop.add(rbox(.3, .21, .014, .012, shell, 0, .007, 0).rotateX(-Math.PI / 2));
  laptop.add(pic(.26, .1, tex(256, 96, (gg, w, h) => { gg.fillStyle = '#23272b'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#3c4249'; for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) gg.fillRect(4 + c * 18 + (r % 2) * 4, 4 + r * 18, 15, 15); }), 0, .0145, -.03).rotateX(-Math.PI / 2));
  laptop.add(pic(.09, .05, label('', { w: 32, h: 16, bg: '#4a5057' }), 0, .0145, .065).rotateX(-Math.PI / 2));
  const lidG = new THREE.Group(); lidG.position.set(0, .012, -.103); lidG.rotation.x = -.28; laptop.add(lidG);
  lidG.add(rbox(.3, .2, .01, .012, shell, 0, .1, 0));
  lidG.add(pic(.27, .17, tex(256, 160, (gg, w, h) => { const sg = gg.createLinearGradient(0, 0, w, h); sg.addColorStop(0, '#1b3550'); sg.addColorStop(1, '#3a6b8a'); gg.fillStyle = sg; gg.fillRect(0, 0, w, h);
    gg.fillStyle = 'rgba(255,255,255,.9)'; gg.fillRect(14, 16, 150, 110); gg.fillStyle = '#333'; for (let i = 0; i < 8; i++) gg.fillRect(22, 28 + i * 12, 60 + (i * 37 % 70), 4); gg.fillStyle = '#d9683a'; gg.fillRect(180, 20, 60, 60); gg.fillStyle = '#0d1c26'; gg.fillRect(0, h - 14, w, 14); }), 0, .1, .0062, true));
  deskTop(laptop, 0, .05);
  if (person.id === 'you') {
    put(label('Welcome to Mars!', { w: 512, h: 160, bg: '#fff38a', fg: '#333', font: '48px "Comic Sans MS", cursive' }), .5, .16, .1, 1.55, -.03);
    put(photo('hills', 256, 192, 'home'), .28, .24, -.35, 1.45, .05);
    put(sticky('Unpack\nPPK box :)'), .14, .14, .45, 1.2, .08);
    lived.add(ctb(.45, .3, .35, 'PPK-YOU').translateX(.35).translateZ(-.9));   // your personal preference kit, still half packed
    shelfTop(books(3, -.05, 0, 0, Math.PI / 2), 0, 0);
  } else if (person.id === 'amara') {   // the commander: three kids at home in Gothenburg, a runner, plays chess by email with her dad
    put(photo('family', 256, 192, 'Elsa, Nils & Ebba'), .32, .3, -.3, 1.5, -.04);
    put(kidDrawing('MAMMA ON MARS'), .3, .22, .12, 1.55, .06);
    put(kidDrawing('COME HOME SOON', '#2d6bd8'), .26, .2, .5, 1.42, -.05);
    wallItems.add(patchDisc(.16, missionPatch('GUSEV OUTPOST', 'EXP 1 · CDR', '#8a2d2d'), '#8a2d2d', .62, 1.75, 0));
    shelfTop(books(5, -.12, 0, 0, Math.PI / 2), 0, -.1);
    const board = box(.24, .02, .24, mat('chess', '#e9dcc0', { r: .6 })); deskTop(board, -.02, .15);
    for (let i = 0; i < 9; i++) { const p = cyl(.008, .012, .035, mat(i % 2 ? 'pieceB' : 'pieceW', i % 2 ? '#222' : '#f4f1e8', { r: .4 }), 0, 0, 0, 8); p.position.set(W / 2 - .27 - .1 + (i % 5) * .05, .815, -D + .55 + .1 + (i % 3) * .05); lived.add(p); }
    const shoes = new THREE.Group(); for (const s of [-1, 1]) shoes.add(rbox(.26, .08, .09, .03, mat('shoe', '#e2e6ea', { r: .7 }), s * .07, .04, 0).rotateY(Math.PI / 2)); shoes.position.set(.2, 0, -.5); lived.add(shoes);
  } else if (person.id === 'meilin') {   // geologist: an orchid from the greenhouse, a sketchbook, a hometown skyline
    put(photo('skyline', 256, 192, 'Home'), .34, .3, -.3, 1.52, .03);
    put(postcard('Singapore', 'skyline'), .3, .2, .15, 1.38, -.06);
    put(tex(256, 256, (g, w, h) => { g.fillStyle = '#f6f0e1'; g.fillRect(0, 0, w, h); g.strokeStyle = '#555'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(10, 40 + i * 26); for (let x = 10; x < w; x += 10) g.lineTo(x, 40 + i * 26 + Math.sin(x * .05 + i) * 6); g.stroke(); } g.fillStyle = '#333'; g.font = '20px "Comic Sans MS", cursive'; g.fillText('Home Plate strata — sol 41', 14, 24); }), .3, .3, .55, 1.6, .04);
    deskTop(orchid(), -.12, .2);
    shelfTop(books(6, -.14, 0, 0, Math.PI / 2), 0, -.15);
    const rocks = new THREE.Group(); seed = 77; for (let i = 0; i < 4; i++) { const rg = new THREE.IcosahedronGeometry(.03 + rnd() * .015, 2), pp = rg.attributes.position; for (let k = 0; k < pp.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(pp, k), n = 1 + .18 * Math.sin(v.x * 90 + i) * Math.cos(v.z * 70 - i) + .1 * Math.sin(v.y * 140); pp.setXYZ(k, v.x * n * 1.2, v.y * n * .75, v.z * n); } rg.computeVertexNormals(); const r = new THREE.Mesh(rg, mat('sample' + i, ['#7a5440', '#55504a', '#a0724f', '#3d3833'][i], { r: .9 })); r.position.set(i * .07, .03, 0); rocks.add(r); } shelfTop(rocks, -.1, .15);
  } else if (person.id === 'mateo') {   // engineer: guitar, a photo of his dog, harbour postcard, sticky-note reminders
    put(photo('dog', 256, 192, 'Bruno'), .3, .26, -.3, 1.5, -.05);
    put(postcard('Valparaíso', 'coast'), .32, .21, .17, 1.48, .04);
    put(sticky('Rover R-wheel\ntorque check\nsol 16!', '#a8e6ff'), .14, .14, .5, 1.62, -.07);
    put(sticky('Call Mamá\nSun 20:00 UTC', '#ffc2d1'), .14, .14, .5, 1.42, .05);
    const gtr = guitar(); gtr.position.set(W / 2 - .085, .62, -.82); gtr.rotation.y = -Math.PI / 2; lived.add(gtr);   // hung on a wall hook by the desk
    lived.add(box(.06, .03, .03, mat('pSteel', '#b8bec4', { m: .7, r: .32 }), W / 2 - .05, 1.72, -.82)); lived.add(box(.02, .05, .1, mat('pDark', '#2f353b'), W / 2 - .025, 1.72, -.82));
    const spk = rbox(.14, .09, .07, .03, mat('speaker', '#e05a3a', { r: .6 })); deskTop(spk, -.15, .2);
    shelfTop(books(3, -.05, 0, 0, Math.PI / 2), 0, -.1);
  }
  bake(openDoor); bake(sleepDoor); bake(lived); bake(stow); bake(g);
  return { group: g, lived, stow, openDoor, sleepDoor };
}

// ---------- the dressing itself ----------
export function dressHab(I) {
  const scene = I.scene, root = new THREE.Group(); root.name = 'hab-dressing'; scene.add(root);
  I.obstacles ??= [];
  const block = (o, pad = 0) => { o.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(o); b.min.x -= pad; b.min.z -= pad; b.max.x += pad; b.max.z += pad; b.min.y = 0; b.max.y = 2; I.obstacles.push(b); return b; };
  const spots = I.habSpots = {};   // where crewmates stand/sit/sleep (hab-crew.js)
  const note = (pod, a, r, label, title, html) => { I.stations.push({ type: 'hab-note', label, x: pod * SPACING + Math.sin(a) * r, z: Math.cos(a) * r, title, html }); };
  const pods = [0, 1, 2, 3, 4, 5].map(i => { const g = new THREE.Group(); g.name = 'pod-' + i; root.add(g); return g; });
  const accent = ['#d9683a', '#3b7bd8', '#2fa39a', '#9b6cc9', '#c49a6c', '#5aa654'];
  // new pod names follow the privacy gradient: work by the airlock, shared middle, quiet cabins
  I.podNames = ['Airlock & power', 'Stowage & workshop', 'Life support', 'Crew quarters', 'Wardroom & galley', 'Science & fitness'];

  // 1) restyle the shell: warmer walls, darker floors, per-pod colours, lower ceilings, lamps brought down
  // wall panels: a texture with panel seams, fasteners, a vent and a few stencilled labels (three variants so the
  // 24 panels round a pod don't all match). The panels are 1.1 m x 6.6 m; texture is drawn at that aspect.
  const wallMats = [0, 1, 2].map(v => new THREE.MeshStandardMaterial({ roughness: .85, map: tex(192, 1152, (g, w, h) => {
    const m = h / 6.6; g.fillStyle = '#e6e1d6'; g.fillRect(0, 0, w, h); seed = 50 + v * 17;
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},.025)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }   // slight mottling
    const seams = [0, .15, 1.05, 2.0, 2.6, 3.3, 6.6];
    for (let k = 0; k < seams.length - 1; k++) {
      const y0 = h - seams[k + 1] * m, y1 = h - seams[k] * m;
      g.strokeStyle = 'rgba(60,55,45,.2)'; g.lineWidth = 2; g.strokeRect(6, y0 + 2, w - 12, y1 - y0 - 4);
      g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(6, y1 - 10, w - 12, 8);   // a little shadow under each panel edge
      g.fillStyle = '#9ba1a6'; for (const fx of [16, w - 16]) for (const fy of [y0 + 14, y1 - 14]) { g.beginPath(); g.arc(fx, fy, 4, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(40,40,40,.12)'; g.fillRect(0, h - .15 * m, w, .15 * m);   // scuffs at the bottom
    if (v === 1) { g.fillStyle = '#9aa1a7'; g.fillRect(w * .25, h - 2.35 * m, w * .5, .18 * m); g.fillStyle = '#5b6268'; for (let k = 0; k < 6; k++) g.fillRect(w * .27, h - 2.33 * m + k * 5, w * .46, 2); }
    if (v === 2) { g.fillStyle = 'rgba(38,52,61,.35)'; g.font = 'bold 13px monospace'; g.fillText('P-' + (40 + v * 7), 14, h - .3 * m); }
    if (v === 0) { g.fillStyle = '#f2c230'; g.fillRect(w - 40, h - 1.0 * m, 18, 18); g.fillStyle = '#1d1d1d'; g.font = 'bold 14px monospace'; g.fillText('⚡', w - 38, h - 1.0 * m + 15); }
  }) }));
  let wallIdx = 0;
  const floorTex = tex(512, 512, (g, w, h) => { seed = 5; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 96 + Math.floor(rnd() * 14); g.fillStyle = `rgb(${v},${v + 5},${v + 9})`; g.fillRect(x * 64, y * 64, 64, 64); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x * 64, y * 64, 64, 2); g.fillRect(x * 64, y * 64, 2, 64);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let k = 0; k < 10; k++) g.beginPath(), g.arc(x * 64 + 10 + (k % 4) * 15, y * 64 + 12 + Math.floor(k / 4) * 18, 3, 0, 7), g.fill(); } });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
  scene.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.parameters || {};
    if (o.geometry.type === 'BoxGeometry' && Math.abs(p.width - 1.1) < .01 && Math.abs(p.depth - .08) < .01 && Math.abs(p.height - 6.6) < .01) o.material = wallMats[(wallIdx++ * 7) % 3];
    else if (o.geometry.type === 'BoxGeometry' && Math.abs(p.width - 1.1) < .01 && Math.abs(p.depth - .12) < .01) o.material = wallMats[0];
    if (o.geometry.type === 'CircleGeometry' && Math.abs(o.position.y) < .01 && o.rotation.x < 0) { o.material = o.material.clone(); o.material.map = floorTex; o.material.color.set('#ffffff'); o.material.roughness = .95; o.material.needsUpdate = true; }
  });
  // remove the wall panels where the cabin doors go (pod 3: two each side of the south wall)
  const cabinSlots = [2, 4, 22, 20], doorSlots = [...cabinSlots, 12];   // 12: the storm shelter hatch (south wall)
  const doomed = [];
  scene.traverse(o => {
    if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return; const p = o.geometry.parameters;
    if (Math.abs(p.width - 1.1) > .01 || Math.abs(p.height - 6.6) > .01) return;
    for (const j of doorSlots) { const a = slotA(j); if (Math.hypot(o.position.x - (3 * SPACING + Math.sin(a) * R), o.position.z - Math.cos(a) * R) < .05) doomed.push(o); }
  });
  doomed.forEach(o => o.removeFromParent());
  for (const j of doorSlots) { const hdr = new THREE.Group(); onWall(3, slotA(j), R, hdr); hdr.add(box(1.15, CEIL - 2.4 + .05, .08, wallMats[0], 0, 2.4 + (CEIL - 2.4) / 2, 0)); root.add(hdr); }
  // lamps and labels come down under the new ceilings (not in the tall Wardroom)
  scene.traverse(o => {
    if (o.isPointLight && Math.abs(o.position.y - 5.8) < .01) { const pod = Math.round(o.position.x / SPACING); if (pod !== 4) o.position.y = CEIL - .35; o.color.set('#fff3e2'); o.userData.habLamp = true; }
    if (o.isMesh && o.material?.map && Math.abs(o.position.y - 3.35) < .01 && Math.abs(o.position.z + 3.9) < .01) { o.position.y = 2.98; o.position.z = -3.86; o.userData.podLabel = Math.round(o.position.x / SPACING); }
    if (o.isMesh && o.geometry.type === 'PlaneGeometry' && Math.abs(o.position.y - 3.45) < .01 && o.parent?.isGroup) o.visible = false;
    if (o.isMesh && o.material?.isMeshBasicMaterial && o.geometry.type === 'BoxGeometry' && Math.abs(o.position.y - 6.53) < .01) { const pod = Math.round(o.position.x / SPACING); if (pod !== 4) o.visible = false; }
  });
  // redraw the pod name signs with the new names
  scene.traverse(o => { if (o.userData.podLabel !== undefined) { const i = o.userData.podLabel; o.material.map = label(I.podNames[i].toUpperCase(), { w: 768, h: 120, bg: '#26343d', fg: '#ecf2e7', font: 'bold 52px system-ui' }); o.material.needsUpdate = true; o.geometry.dispose(); o.geometry = new THREE.PlaneGeometry(1.9, .3); } });

  // anti-slip walkway mat: diamond tread, worn centre, yellow edge lines
  const walkTex = tex(512, 128, (g, w, h) => { seed = 9; g.fillStyle = '#5d646a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 10; y < h - 8; y += 8) for (let x = (y % 16) ? 4 : 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 2, y); g.lineTo(x, y + 2); g.lineTo(x - 2, y); g.fill(); }
    const wear = g.createLinearGradient(0, 0, 0, h); wear.addColorStop(0, 'rgba(0,0,0,0)'); wear.addColorStop(.5, 'rgba(160,140,110,.12)'); wear.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = wear; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '200,170,130'},.08)`; g.fillRect(rnd() * w, h * (.3 + rnd() * .4), 3, 2); }
    g.fillStyle = '#d6a92a'; g.fillRect(0, 4, w, 5); g.fillRect(0, h - 9, w, 5); });
  walkTex.wrapS = THREE.RepeatWrapping; walkTex.repeat.set(3, 1);
  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: .95 });
  // soft darkening where the walls meet the floor (cheap ambient occlusion)
  const aoTex = tex(8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.35, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: -2 });
  // doorways in each pod (angle, half-width in radians): bands, kick strips and the floor shading stop at them
  const gaps = i => [...(i > 0 ? [[-Math.PI / 2, .42]] : []), ...(i < 5 ? [[Math.PI / 2, .42]] : []), ...(i === 0 ? [[0, .3]] : []), ...((i === 2 || i === 4) ? [[Math.PI, .5]] : [])];
  const ringSeg = (r, h, i, m) => { const g = new THREE.Group(), gs = gaps(i).map(([a, w]) => [((a - w) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), 2 * w]).sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < gs.length; k++) { const st = gs[k][0] + gs[k][1], en = k + 1 < gs.length ? gs[k + 1][0] : gs[0][0] + 2 * Math.PI, len = en - st;
      if (len > .01) g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, Math.max(4, Math.ceil(len * 8)), 1, true, st, len), m)); }
    return g; };
  for (let i = 0; i < 6; i++) { const ao = ringSeg(R - .085, .7, i, aoMat); ao.position.set(i * SPACING, .35, 0); ao.traverse(o => o.renderOrder = 1); ao.userData.walk = true; root.add(ao); }
  const lightPanels = [];   // emissive ceiling panels driven by the circadian schedule
  const panelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4e6', emissiveIntensity: 1.2, roughness: .4 }); lightPanels.push(panelMat);
  for (let i = 0; i < 6; i++) {
    const cx = i * SPACING, P = pods[i], ac = mat('band' + i, accent[i], { r: .7 });
    // a colour band round the room at shoulder height, and a darker kick strip at the floor (wayfinding, like Tiangong's two-tone interiors)
    ac.side = THREE.DoubleSide; const band = ringSeg(R - .07, .1, i, ac); band.position.set(cx, 2.55, 0); band.userData.walk = true; P.add(band);
    const kick = ringSeg(R - .06, .14, i, mat('kick', '#3a3f45', { r: .9, side: THREE.DoubleSide })); kick.position.set(cx, .07, 0); kick.userData.walk = true; P.add(kick);
    // floor: rubber tiles with a lighter walkway along the connectors
    const walk = box(2 * R - .4, .006, 1.3, walkMat, cx, .009, 0); P.add(walk);
    if (i !== 4) {   // dropped ceiling with LED light panels, an air diffuser and a cable tray
      const c = new THREE.Mesh(new THREE.CircleGeometry(R, 48), mat('ceil', '#ece8df', { r: .9, e: '#3a3732', ei: 1 })); c.rotation.x = Math.PI / 2; c.position.set(cx, CEIL, 0); P.add(c);
      for (const [x, z] of [[-1.2, -1.1], [1.2, -1.1], [-1.2, 1.1], [1.2, 1.1]]) { const p = box(1.0, .03, .5, panelMat, cx + x, CEIL - .02, z); p.userData.keep = true; P.add(p); }
      const diff = cyl(.25, .25, .04, mat('diffuser', '#c9ced2', { r: .5 }), cx, CEIL - .02, 0, 24); P.add(diff);
      for (let k = 0; k < 6; k++) P.add(box(.42 - k * .06, .005, .42 - k * .06, mat('diffSlot', '#7c8388', { r: .6 }), cx, CEIL - .043, 0));
      const tray = box(6.0, .06, .22, mat('tray', '#9aa1a7', { m: .4, r: .5 }), cx, CEIL - .12, -2.3); P.add(tray);
      for (let k = 0; k < 3; k++) P.add(cyl(.018, .018, 5.9, mat('cable' + k, ['#2b2b2b', '#c23b2f', '#2d5fa8'][k], { r: .6 }), cx, CEIL - .08, -2.36 + k * .05, 8).rotateZ(Math.PI / 2));
    } else {   // the Wardroom keeps its full height: a hanging light ring and fabric baffles soften the tall space
      wardroomCeiling(P, cx, panelMat);
    }
  }

  // 2) handrails by every hatch and by the stations
  for (let i = 0; i < 6; i++) {
    for (const side of [1, -1]) { if ((side > 0 && i === 5) || (side < 0 && i === 0)) continue; const a = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const off of [-1.4, 1.4]) { const h = handrail(1.0, true); onWall(i, a + off / R, R - .03, h); h.position.y = 1.2; pods[i].add(h); } }
  }
  // mission patch decals round the hatches into the Wardroom (the ISS crews do this in the Unity node)
  const patchNames = [['GUSEV OUTPOST', 'EXP 1'], ['SPIRIT', 'MER-A 2004'], ['FIRST HARVEST', 'GREENHOUSE'], ['ROVER TEAM', 'R-1'], ['STORM SURVIVORS', 'SOL 22'], ['ZHETALIS', 'MARS CREW']];
  patchNames.forEach(([a, b], k) => { const side = k < 3 ? -1 : 1, g = new THREE.Group(); onWall(4, side * Math.PI / 2 + [.56, .72, .88][k % 3], R - .06, g); g.add(patchDisc(.24, missionPatch(a, b, ['#2b3a67', '#8a2d2d', '#3f7a52'][k % 3], k % 3), ['#2b3a67', '#8a2d2d', '#3f7a52'][k % 3], 0, 2.12 + (k % 2) * .2, 0)); pods[4].add(g); });

  // ---------- pod 0: airlock & power ----------
  {
    const P = pods[0];
    // dust zone by the outer hatch: rubber mat with hazard edge, boot brush and a dust vacuum
    P.add(box(1.8, .012, 1.0, mat('dustMat', '#2c2f33', { r: 1 }), 0, .007, 3.1));
    const edge = tex(256, 32, g => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f2c230' : '#1d1d1d'; g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 16, 0); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 - 8, 32); g.fill(); } });
    const e = pic(1.8, .08, edge, 0, .015, 2.58); e.rotation.x = -Math.PI / 2; P.add(e);
    const vac = new THREE.Group(); onWall(0, .75, R - .05, vac); vac.add(rbox(.4, .6, .25, .05, mat('vac', '#d9683a', { r: .6 }), 0, .4, .13)); vac.add(cyl(.03, .03, .9, mat('hose', '#2b2b2b', { r: .9 }), .25, .7, .2, 8)); vac.add(pic(.3, .08, label('DUST VAC', { w: 256, h: 64, bg: '#1d2a33', font: 'bold 30px system-ui' }), 0, .78, .26)); P.add(vac); block(vac);
    const brush = new THREE.Group(); onWall(0, -.75, R - .05, brush); brush.add(box(.6, .12, .3, mat('brushBase', '#3a4046'), 0, .06, .15)); for (let k = 0; k < 10; k++) brush.add(box(.5, .06, .015, mat('bristle', '#a0703f', { r: 1 }), 0, .15, .03 + k * .026)); P.add(brush); block(brush);
    // EVA checklist and suit-check board next to the suit rack, and spare gloves
    const cl = new THREE.Group(); onWall(0, -1.1, R - .05, cl);
    cl.add(pic(.75, 1.0, tex(384, 512, (g, w, h) => { g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h); g.fillStyle = '#c23b2f'; g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.fillText('EVA PREP CHECKLIST', 20, 40); g.fillStyle = '#222'; g.font = '24px system-ui';
      ['Suit pressure check', 'O₂ tank > 90%', 'Battery > 80%', 'Comms check with HAB', 'Gloves & visor', 'Buddy check', 'Log out on whiteboard'].forEach((t, i) => { g.strokeRect(20, 92 + i * 56, 26, 26); g.fillText(t, 62, 114 + i * 56); if (i < 4) { g.strokeStyle = '#2d8a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(22, 104 + i * 56); g.lineTo(32, 116 + i * 56); g.lineTo(46, 92 + i * 56); g.stroke(); g.strokeStyle = '#222'; g.lineWidth = 1; } }); }), 0, 1.6, .02)); P.add(cl);
    const eva = new THREE.Group(); onWall(0, -2.05, R - .05, eva);
    eva.add(pic(.9, .55, tex(512, 320, (g, w, h) => { g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a33'; g.font = 'bold 32px system-ui'; g.fillText('WHO IS OUTSIDE?', 20, 44); g.font = '28px "Comic Sans MS", cursive'; g.fillStyle = '#2d5fa8'; g.fillText('Out:  —', 24, 110); g.fillText('Back by:  —', 24, 160); g.fillStyle = '#c23b2f'; g.fillText('Max 2 at a time!', 24, 230); g.fillStyle = '#555'; g.font = '22px system-ui'; g.fillText('Always tell the HAB before you go', 24, 290); }), 0, 1.65, .02)); P.add(eva);
    const gloves = new THREE.Group(); onWall(0, -2.05, R - .05, gloves); for (const s of [-1, 1]) gloves.add(rbox(.12, .2, .06, .04, mat('glove', '#efefea', { r: .9 }), s * .1, 1.05, .08)); gloves.add(box(.4, .02, .12, mat('shelfS', '#8e979b', { m: .3 }), 0, .94, .06)); P.add(gloves);
    // power: battery and DC distribution racks either side of the console
    const pr = rack('POWER DIST', { w: .9, h: 2.1, accent: accent[0] }); onWall(0, 2.1, R - .08, pr); P.add(pr); block(pr);
    spots.power = { group: pr, local: new THREE.Vector3(0, 0, .62), yaw: Math.PI, pose: 'work' };
    pr.add(pic(.12, .12, sticky('Batt temp\nlow at night\n- M.R.', '#fff38a'), .25, 1.35, .125));   // a sticky note on the rack
  }
  // ---------- pod 1: stowage & workshop ----------
  {
    const P = pods[1];
    // cargo racks full of transfer bags on the four diagonal walls, each bag labelled
    const tags = [['FOOD-A12', 'FOOD-A13', 'FOOD-B02', 'HYG-04'], ['SPARES-FAN', 'FILTER-HEPA', 'CABLES', 'TOOLS-EVA'], ['MED-KIT 2', 'SEEDS', 'CLOTHES-OK', 'CLOTHES-MR'], ['SAMPLE BAGS', 'TAPE+VELCRO', 'WIPES', 'BATT-AA']];
    [.85, -.85, Math.PI - .85, Math.PI + .85].forEach((a, k) => {
      const g = new THREE.Group(); onWall(1, a, R - .38, g);
      const fr = mat('cargoFrame', '#7d868b', { m: .35, r: .5 }); for (const x of [-.6, .6]) g.add(box(.05, 2.4, .6, fr, x, 1.2, 0)); for (const y of [.05, .8, 1.55, 2.3]) g.add(box(1.25, .04, .6, fr, 0, y, 0));
      seed = 13 + k * 7; let t = 0;
      for (const y of [.07, .82, 1.57]) { let x = -.55; while (x < .45) { const bw = .28 + rnd() * .22; g.add(ctb(Math.min(bw, .55 - x), .5 + rnd() * .15, .5, tags[k][t++ % 4]).translateX(x + Math.min(bw, .55 - x) / 2).translateY(y)); x += bw + .02; } }
      g.add(box(1.25, .02, .01, mat('cargoNet', '#2b2b2b'), 0, 1.3, .31));
      P.add(g); block(g);
    });
    // a 3D printer (spare parts are printed on site) with a half-finished bracket on the bed
    const pr = new THREE.Group(); onWall(1, -1.13, R - .5, pr);
    { const alu = mat('alu', '#2b2f33', { m: .6, r: .35 }), steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), glassM = new THREE.MeshStandardMaterial({ color: '#cfe8f2', roughness: .05, transparent: true, opacity: .22, depthWrite: false });
      // a steel stand with a drawer of spares
      pr.add(rbox(.7, .6, .05, .02, mat('pDark', '#2f353b'), 0, .735, 0).rotateX(-Math.PI / 2)); for (const x of [-.31, .31]) for (const z of [-.25, .25]) pr.add(box(.04, .7, .04, steel, x, .35, z));
      pr.add(box(.64, .02, .54, steel, 0, .15, 0)); pr.add(rbox(.6, .16, .03, .02, mat('pWhite', '#e9e7e1'), 0, .6, .28)); pr.add(box(.2, .025, .02, alu, 0, .63, .3));
      // the printer: aluminium frame, smoked side panels, a heated bed, gantry and print head
      const b = .78; for (const x of [-.25, .25]) for (const z of [-.22, .22]) pr.add(box(.03, .58, .03, alu, x, b + .29, z));
      for (const y of [b + .015, b + .575]) { pr.add(box(.53, .03, .03, alu, 0, y, -.22)); pr.add(box(.53, .03, .03, alu, 0, y, .22)); pr.add(box(.03, .03, .47, alu, -.25, y, 0)); pr.add(box(.03, .03, .47, alu, .25, y, 0)); }
      for (const x of [-.25, .25]) pr.add(box(.005, .55, .44, glassM, x, b + .29, 0)); pr.add(box(.5, .55, .005, glassM, 0, b + .29, .225)); pr.add(box(.5, .55, .005, mat('pDark', '#2f353b'), 0, b + .29, -.225));
      pr.add(box(.36, .012, .3, mat('bed', '#1d1d1d', { r: .3, m: .4 }), 0, b + .12, 0));
      const part = new THREE.Group(); part.position.set(0, b + .127, 0); pr.add(part); const pm = mat('print', '#d9683a', { r: .45 });
      part.add(box(.14, .012, .05, pm, 0, .006, 0)); part.add(box(.02, .045, .05, pm, -.06, .028, 0)); for (let k = 0; k < 3; k++) part.add(box(.1, .002, .046, mat('printLine', '#b9552a'), .01, .0125 + k * .004, 0));
      for (const z of [-.18, .18]) pr.add(box(.46, .015, .015, steel, 0, b + .42, z)); const head = new THREE.Group(); head.position.set(.04, b + .37, 0); pr.add(head);
      head.add(box(.03, .03, .4, steel, 0, .05, 0)); head.add(rbox(.07, .08, .06, .01, mat('headBody', '#d9683a', { r: .5 }), 0, .02, 0)); head.add(cyl(.004, .012, .03, mat('brass', '#c9a227', { m: .7, r: .3 }), 0, -.035, 0, 8));
      // filament spool on the side, feeding the head
      const spool = new THREE.Group(); spool.position.set(.32, b + .42, -.05); spool.rotation.z = Math.PI / 2; pr.add(spool);
      spool.add(cyl(.09, .09, .055, mat('filament', '#d9683a', { r: .5 }), 0, 0, 0, 24)); for (const y of [-.03, .03]) spool.add(cyl(.11, .11, .006, mat('spoolSide', '#2b2f33', { r: .5 }), 0, y, 0, 24));
      pr.add(tube3([[.32, b + .5, -.05], [.2, b + .62, 0], [.04, b + .45, 0]], .002, mat('filament', '#d9683a'), 16));
      pr.add(pic(.14, .08, label('PRINT 63%', { w: 256, h: 140, bg: '#0a1c24', fg: '#9ce6d0', font: 'bold 44px monospace' }), .16, b + .06, .232, true));
      pr.add(pic(.3, .06, label('BRACKET-R2 · 4 h 10 m', { w: 512, h: 96, bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 36px monospace' }), -.08, b + .06, .232)); }
    pr.position.y = 0; P.add(pr); block(pr);
    const pl = plant(1.1); pl.position.set(SPACING - 1.0, .96, -2.55); P.add(pl);   // somebody put a plant on the workbench
  }
  // ---------- pod 2: life support ----------
  {
    const P = pods[2];
    const names = ['CO₂ REMOVAL', 'O₂ GENERATION', 'WATER RECOVERY', 'TRACE CONTAM'];
    [1.0, 2.15, -1.0, -2.15].forEach((a, k) => { const r = rack(names[k], { w: 1.0, h: 2.3, style: k, accent: accent[2] }); onWall(2, a, R - .08, r); P.add(r); block(r); if (k === 0) spots.lifesupport = { group: r, local: new THREE.Vector3(0, 0, .62), yaw: Math.PI, pose: 'work' }; });
    // pipes overhead between the racks and the water plant
    for (let k = 0; k < 3; k++) { const p = cyl(.035, .035, 2 * R - 1.2, mat('pipe' + k, ['#d0d4d8', '#3b7bd8', '#2fa39a'][k], { m: .4, r: .4 }), 2 * SPACING, CEIL - .3 - k * .09, 2.5, 12); p.rotation.z = Math.PI / 2; P.add(p); }
    for (let k = 0; k < 4; k++) { const gauge = new THREE.Group(); onWall(2, (k < 2 ? 1 : -1) * (.5 + (k % 2) * .09), R - .1, gauge); gauge.add(cyl(.07, .07, .03, mat('gaugeRim', '#b9bec2', { m: .5 }), 0, 1.75, .02, 20).rotateX(Math.PI / 2)); gauge.add(pic(.11, .11, tex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill(); g.strokeStyle = '#c23b2f'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 32); g.lineTo(48, 18); g.stroke(); }), 0, 1.75, .037)); P.add(gauge); }
    const tray = new THREE.Group(); onWall(2, Math.PI + .62, R - .4, tray); tray.add(box(.8, .7, .4, mat('stand', '#8e979b', { m: .3 }), 0, .35, 0)); tray.add(box(.75, .06, .35, mat('soil', '#4a3628', { r: 1 }), 0, .73, 0));
    seed = 8; for (let k = 0; k < 12; k++) { const s = plant(.35, '#7fbf4a', '#4a3628', 'seedling'); s.position.set(-.3 + (k % 6) * .12, .72, -.08 + Math.floor(k / 6) * .16); tray.add(s); }
    tray.add(pic(.4, .08, label('SEEDLINGS → GREENHOUSE', { w: 512, h: 96, bg: '#f2f0ea', fg: '#2d5a2a', font: 'bold 34px system-ui' }), 0, .9, .21)); P.add(tray); block(tray);
  }
  // ---------- pod 3: crew quarters ----------
  const cabins = [];
  {
    const P = pods[3];
    cabinSlots.forEach((j, k) => {
      const a = slotA(j), person = CREW[k];
      const c = cabin(person); c.group.userData.noBake = true; c.group.userData.walk = true; onWall(3, a, R - .02, c.group); P.add(c.group);   // walk-in room: its floor is mapped in bunks.js, not one solid box
      c.group.updateMatrix();   // remember where the cabin stands: baking the pod later flattens this transform (bunks.js needs it)
      cabins.push({ person, lived: c.lived, spare: c.stow, openDoor: c.openDoor, sleepDoor: c.sleepDoor, group: c.group, frame: c.group.matrix.clone() });
      if (person.id !== 'you') spots['bed-' + person.id] = { group: c.group, local: new THREE.Vector3(-.5, .71, -.21), realLocal: new THREE.Vector3(-.5, 0, -1.2), pose: 'sleep' };
    });
    // hygiene stall (CHAPEA puts one near the quarters and one near the airlock work area) with towels in crew colours
    const hy = new THREE.Group(); onWall(3, slotA(8.4), R - .05, hy);
    hy.add(rbox(1.0, 2.2, .06, .04, mat('hygDoor', '#c7d6cf', { r: .6 }), 0, 1.1, .05)); hy.add(pic(.5, .12, label('HYGIENE', { w: 512, h: 120, bg: '#2fa39a', font: 'bold 54px system-ui' }), 0, 1.85, .085));
    const occ = pic(.2, .06, label('VACANT', { w: 256, h: 76, bg: '#1d3b2a', fg: '#7dffb2', font: 'bold 40px monospace' }), 0, 1.65, .085, true); hy.add(occ);
    P.add(hy);
    const towels = new THREE.Group(); onWall(3, slotA(9.6), R - .05, towels); towels.add(box(1.0, .03, .03, mat('rail2', '#b9bec2', { m: .6, r: .3 }), 0, 1.6, .06));
    CREW.forEach((c, k) => { const t = rbox(.18, .5, .02, .02, mat('towel' + c.id, c.colour, { r: 1 }), -.36 + k * .24, 1.36, .07); t.name = 'towel-' + c.id; towels.add(t); });
    P.add(towels);
    // (the storm shelter is a walk-in room off this pod's south wall: built further down)
    // a quiet-hours sign and the crew calendar on the wall between the cabins
    const cal = new THREE.Group(); onWall(3, slotA(0), R - .05, cal); P.add(cal);
    I.calendar = { canvas: null, mesh: null, sol: -1 };
    const calTex = tex(512, 512, () => {}); I.calendar.texture = calTex; I.calendar.canvas = calTex.image;
    cal.add(pic(.8, .8, calTex, 0, 1.55, .02));
    cal.add(pic(.7, .12, label('QUIET HOURS 22:00 – 06:30', { w: 768, h: 120, bg: '#2b3a67', font: 'bold 44px system-ui' }), 0, 2.15, .02));
  }
  // ---------- pod 4: wardroom & galley ----------
  {
    const P = pods[4], cx = 4 * SPACING, wood = mat('ply', '#c49a6c', { r: .75 });
    // the table sits off the walkway (ISS lesson: people passing the dining area disturbed crew meals)
    const T = new THREE.Group(); T.position.set(cx + .4, 0, 2.15); P.add(T);
    T.add(rbox(1.7, .9, .05, .3, wood, 0, .76, 0).rotateX(-Math.PI / 2)); T.add(cyl(.06, .06, .74, mat('leg', '#5b6268', { m: .4 }), 0, .37, 0, 12)); T.add(cyl(.35, .35, .03, mat('leg', '#5b6268'), 0, .015, 0, 24));
    T.add(box(1.3, .005, .32, mat('runner', '#8a2d2d', { r: 1 }), 0, .785, 0));
    I.mugs = CREW.map((c, k) => { const m = mug(c.mug, -.6 + k * .4, .78, (k % 2 ? .25 : -.25)); m.userData.noBake = true; T.add(m); return m; });
    T.add(cyl(.02, .02, .14, mat('salt', '#f2f2f2', { r: .3 }), .1, .85, 0, 10)); T.add(cyl(.02, .02, .14, mat('pepper', '#333', { r: .3 }), .16, .85, 0, 10));   // liquid salt & pepper bottles, as on the ISS
    const game = box(.3, .005, .3, mat('gameBoard', '#e9dcc0'), -.15, .785, .05); T.add(game);
    for (const [x, z] of [[-.75, .55], [.75, .55], [-.75, -.55], [.75, -.55]]) { const s = new THREE.Group(); s.add(cyl(.18, .16, .06, mat('stoolTop', '#3d5a80', { r: .9 }), 0, .48, 0, 18)); s.add(cyl(.03, .03, .45, mat('leg', '#5b6268'), 0, .23, 0, 8)); s.add(cyl(.15, .15, .02, mat('leg', '#5b6268'), 0, .01, 0, 18)); s.position.set(x * 1.2, 0, z * 1.2); T.add(s); }
    block(T, .05);
    [[-.9, .66], [.9, .66], [.9, -.66]].forEach(([x, z], k) => { spots['table' + k] = { group: T, local: new THREE.Vector3(x * 1.2 / 1.2, 0, z), yaw: Math.atan2(-x, -z), pose: 'eat' }; });
    // galley wall: food warmer, rehydration station, pantry with pouches, trash compactor; "Gusev Café" sign
    const G = new THREE.Group(); onWall(4, .82, R - .35, G); P.add(G);
    { const body = mat('galleyBody', '#dfe2e0', { r: .55 }), steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), dark = mat('pDark', '#2f353b'), handleM = mat('drawerHandle', '#2b2f33', { r: .4, m: .4 });
      G.add(box(2.0, .82, .58, body, 0, .49, -.01)); G.add(box(1.96, .08, .5, dark, 0, .04, -.04));                                    // cabinets with a toe-kick
      for (let k = 0; k < 4; k++) { G.add(rbox(.47, .7, .02, .02, mat('galleyDoor', '#eceeec', { r: .45 }), -.74 + k * .493, .5, .285)); G.add(box(.15, .02, .025, handleM, -.74 + k * .493, .78, .305)); }
      G.add(rbox(2.06, .64, .045, .02, mat('counter', '#5b6268', { r: .35, m: .3 }), 0, .925, 0).rotateX(-Math.PI / 2));             // worktop
      G.add(box(2.0, .5, .02, mat('splash', '#c9d6dc', { r: .3 }), 0, 1.2, -.29));                                                       // splashback
      // food warmer: steel box with a window door, handle, display and vents
      const W2 = new THREE.Group(); W2.position.set(-.6, .95, -.04); G.add(W2);
      W2.add(rbox(.5, .32, .4, .03, steel, 0, .16, 0)); W2.add(rbox(.34, .2, .01, .02, mat('ovenGlass', '#1b2228', { r: .08, m: .4 }), -.05, .17, .205)); W2.add(box(.025, .2, .03, handleM, .16, .17, .215));
      W2.add(pic(.08, .035, label('62 °C', { w: 192, h: 84, bg: '#0a1c24', fg: '#ffd27a', font: 'bold 52px monospace' }), .16, .28, .203, true));
      for (let k = 0; k < 5; k++) W2.add(box(.06, .006, .01, dark, -.15 + k * .07, .31, .2));
      // hot / ambient water dispenser: housing, two buttons, nozzle, drip grate
      const D2 = new THREE.Group(); D2.position.set(.1, .95, -.14); G.add(D2);
      D2.add(rbox(.3, .55, .26, .05, mat('rehyd', '#e8e5de', { r: .4 }), 0, .275, 0)); D2.add(box(.26, .08, .2, mat('rehyd', '#e8e5de'), 0, .3, .13));
      D2.add(cyl(.012, .016, .05, steel, 0, .24, .2, 10)); D2.add(box(.2, .012, .14, dark, 0, .02, .16)); for (let k = 0; k < 6; k++) D2.add(box(.18, .004, .006, steel, 0, .028, .1 + k * .022));
      for (const [x, c] of [[-.06, '#c23b2f'], [.06, '#2d5fa8']]) { const bt = cyl(.022, .022, .015, mat('btn' + c, c, { r: .4 }), x, .44, .135, 16); bt.rotation.x = Math.PI / 2; D2.add(bt); }
      D2.add(pic(.24, .05, label('HOT · AMBIENT', { w: 384, h: 80, bg: '#2d5fa8', font: 'bold 34px system-ui' }), 0, .51, .132));
      const pouchUnder = rbox(.08, .12, .02, .02, mat('pouch#e6e0cf', '#e6e0cf', { r: .5 }), 0, .1, .17); D2.add(pouchUnder);
      // pantry: a wall rack with elastic straps holding labelled food pouches
      const pantry = new THREE.Group(); pantry.position.set(.72, 1.0, -.2); G.add(pantry); seed = 3;
      pantry.add(box(.56, .58, .02, mat('pantryBack', '#3c4a5c', { r: .8 }), 0, .27, -.02));
      const foods = [['CURRY', '#d9683a'], ['RICE', '#e6e0cf'], ['PASTA', '#d9b44a'], ['SALMON', '#e8866a'], ['BEANS', '#8a2d2d'], ['OATS', '#c49a6c'], ['TORTILLA', '#e9dcc0'], ['TEA', '#3f7a52'], ['COFFEE', '#5a3a28'], ['LAKSA', '#c25a2a'], ['SOUP', '#d9b44a'], ['NUTS', '#a0724f']];
      foods.forEach(([n, c], k) => { const t = tex(128, 176, (g, w, h) => { g.fillStyle = '#eef0f2'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, 34, w, 70); g.fillStyle = '#fff'; g.font = 'bold 24px system-ui'; g.textAlign = 'center'; g.fillText(n, w / 2, 78); g.fillStyle = '#555'; g.font = '14px monospace'; g.fillText('NASA FOOD LAB', w / 2, 128); g.fillRect(20, 140, 88, 3); g.fillRect(20, 150, 60, 3); });
        const pouch = new THREE.Group(); pouch.position.set(-.2 + (k % 4) * .135, .08 + Math.floor(k / 4) * .19, 0); pouch.rotation.z = (rnd() - .5) * .15; pantry.add(pouch);
        pouch.add(rbox(.1, .14, .018, .02, mat('pouchFoil', '#d8dcdf', { r: .35, m: .5 }))); pouch.add(pic(.09, .125, t, 0, 0, .016)); });
      for (let r = 0; r < 3; r++) pantry.add(box(.56, .012, .01, mat('velcro', '#2b2f33', { r: .9 }), 0, .1 + r * .19, .02));
      // utensil caddy and a paper towel roll
      const cad = new THREE.Group(); cad.position.set(-.18, .95, .05); G.add(cad); cad.add(cyl(.045, .04, .1, steel, 0, .05, 0, 16)); for (let k = 0; k < 4; k++) { const sp2 = cyl(.004, .004, .16, steel, (k - 1.5) * .012, .12, (k % 2) * .01, 6); sp2.rotation.z = (k - 1.5) * .08; cad.add(sp2); }
      const roll = cyl(.05, .05, .22, mat('towel', '#f6f6f2', { r: 1 }), -.95, 1.22, -.22, 16); roll.rotation.z = Math.PI / 2; G.add(roll); G.add(cyl(.008, .008, .26, steel, -.95, 1.22, -.22, 6).rotateZ(Math.PI / 2));
    }
    G.add(pic(1.2, .26, label('☕ GUSEV CAFÉ', { w: 768, h: 160, bg: '#3a2414', fg: '#f7e2b8', font: 'bold 80px Georgia, serif' }), 0, 2.05, .02));
    { const tr = new THREE.Group(); tr.position.set(1.25, 0, -.05); G.add(tr);   // trash compactor: lid, pedal and a label
      tr.add(rbox(.4, .58, .5, .04, mat('trash', '#5b6268', { r: .5 }), 0, .29, 0)); tr.add(rbox(.42, .52, .03, .02, mat('pDark', '#2f353b'), 0, .6, 0).rotateX(-Math.PI / 2));
      tr.add(box(.16, .02, .06, mat('pSteel', '#b8bec4', { m: .7, r: .32 }), 0, .03, .28)); tr.add(pic(.3, .08, label('TRASH · COMPACT', { w: 384, h: 96, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 36px system-ui' }), 0, .45, .262)); }
    block(G); spots.galley = { group: G, local: new THREE.Vector3(.1, 0, .75), yaw: Math.PI, pose: 'drink' };
    // whiteboard with the chore rota, tonight's menu and a countdown
    const WB = new THREE.Group(); onWall(4, -.95, R - .2, WB); P.add(WB);
    const wbTex = tex(768, 512, () => {}); I.whiteboard = { texture: wbTex, canvas: wbTex.image, key: '' };
    WB.add(box(1.5, 1.0, .03, mat('wbFrame', '#b9bec2', { m: .5 }), 0, 1.55, .015)); WB.add(pic(1.44, .94, wbTex, 0, 1.55, .035));
    for (const x of [-.6, .6]) WB.add(box(.06, .9, .16, mat('wbFrame', '#b9bec2'), x, 1.55, -.08));   // stand-offs to the wall
    WB.add(box(1.4, .04, .08, mat('wbFrame', '#b9bec2'), 0, 1.03, .04));   // marker tray
    for (let k = 0; k < 3; k++) WB.add(cyl(.012, .012, .12, mat('marker' + k, ['#c23b2f', '#2d5fa8', '#2d8a4a'][k], { r: .4 }), -.3 + k * .15, 1.03, .06, 8).rotateZ(Math.PI / 2));
    // window nook under the real window: a bench with cushions, a blanket, a plush toy and hanging herbs
    const NK = new THREE.Group(); onWall(4, Math.PI, R - .55, NK); P.add(NK);
    NK.add(box(2.4, .42, .6, wood, 0, .21, 0)); NK.add(rbox(2.3, .1, .55, .05, mat('cushion', '#3d5a80', { r: 1 }), 0, .47, 0));
    for (const x of [-.85, .85]) NK.add(rbox(.4, .34, .14, .08, mat('pillowNook' + x, x < 0 ? '#d9683a' : '#8fb3a6', { r: 1 }), x, .66, -.18));
    const bl = blanket(.7, .5, '#c23b2f', '#f2c14e'); bl.position.set(.3, .54, .05); bl.rotation.y = .3; NK.add(bl);
    const toy = plush('#8a6a4a'); toy.position.set(-.4, .52, -.05); toy.rotation.y = .4; NK.add(toy);
    for (const x of [-1.5, 1.5]) { const hp = plant(.8, '#5aa04a', '#e9e4da'); hp.position.set(x, 2.6, .25); NK.add(hp); NK.add(cyl(.004, .004, .6, mat('cableHang', '#333'), x, 3.0, .25, 4)); }
    block(NK);
    // bookshelf / game shelf on the west side
    const BS = new THREE.Group(); onWall(4, -2.3, R - .2, BS); P.add(BS);
    for (const y of [.4, .85, 1.3, 1.75]) BS.add(box(1.1, .03, .3, wood, 0, y, 0)); for (const x of [-.55, .55]) BS.add(box(.03, 1.8, .3, wood, x, .9, 0));
    BS.add(books(8, -.5, .415, 0)); BS.add(books(6, -.1, .865, 0)); BS.add(books(7, -.48, 1.315, 0));
    BS.add(rbox(.3, .2, .25, .03, mat('gameBox', '#2d5fa8', { r: .6 }), .3, .53, 0)); BS.add(rbox(.3, .08, .25, .03, mat('gameBox2', '#d9b44a', { r: .6 }), .3, .67, 0));
    BS.add(pic(.24, .18, photo('rocket', 256, 192, 'launch day'), .3, 1.5, .16)); BS.add(plant(.9).translateX(.32).translateY(.87));
    block(BS);
  }
  // ---------- pod 5: science & fitness ----------
  {
    const P = pods[5];
    // lab bench: microscope, glovebox for Mars samples, sample bags labelled with real Spirit sites
    const LB = new THREE.Group(); onWall(5, Math.PI + 1.0, R - .45, LB); P.add(LB);
    LB.add(box(1.8, .06, .7, mat('labTop', '#e8e5de', { r: .4 }), 0, .9, 0)); LB.add(box(1.75, .86, .6, mat('labBody', '#aab1ba', { r: .6, m: .2 }), 0, .43, -.03));
    LB.add(rbox(.7, .5, .45, .05, mat('gloveBox', '#bfe0ee', { t: .45, r: .1 }), -.45, 1.18, -.05)); for (const x of [-.6, -.3]) LB.add(cyl(.06, .06, .05, mat('port', '#2b2b2b'), x, 1.1, .19, 16).rotateX(Math.PI / 2));
    const mic = new THREE.Group(); mic.position.set(.35, .93, 0); mic.add(box(.18, .03, .22, mat('micBase', '#2b2f33', { r: .4 }))); mic.add(box(.04, .3, .04, mat('micBase', '#2b2f33'), 0, .15, -.08)); const tube = cyl(.025, .025, .18, mat('micTube', '#d4d8d6', { m: .3 }), 0, .3, -.02, 12); tube.rotation.x = .5; mic.add(tube); LB.add(mic);
    ['HUMPHREY', 'MAZATZAL', 'HOME PLATE', 'PASO ROBLES'].forEach((n, k) => { const b = new THREE.Group(); b.add(rbox(.12, .16, .03, .02, mat('sampleBag', '#f2f0ea', { t: .85, r: .4 }), 0, .08, 0)); b.add(pic(.1, .04, label(n, { w: 256, h: 96, bg: '#fff', fg: '#111', font: 'bold 30px monospace' }), 0, .12, .017)); b.position.set(.6 + (k % 2) * .14 - .07, .93, -.15 + Math.floor(k / 2) * .14); b.rotation.x = -.6; LB.add(b); });
    block(LB); spots.lab = { group: LB, local: new THREE.Vector3(0, 0, .62), yaw: Math.PI, pose: 'work' };
    // exercise corner: a treadmill with a bungee harness (like the ISS T2) and a bike; on Mars you still need 2 h a day
    const TM = new THREE.Group(); onWall(5, 1.0, R - 1.1, TM); P.add(TM); buildTreadmill(TM);
    block(TM); spots.treadmill = { group: TM, local: new THREE.Vector3(0, .27, .15), yaw: Math.PI, pose: 'run' };
    const BK = new THREE.Group(); onWall(5, 1.85, R - .7, BK); P.add(BK); buildBike(BK);
    block(BK);
    const towel = rbox(.3, .5, .02, .02, mat('towelamara', CREW[1].colour), 0, 1.0, .02); const tw = new THREE.Group(); onWall(5, .95, R - .05, tw); tw.add(towel); tw.add(pic(.4, .5, tex(256, 320, (g, w, h) => { g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a33'; g.font = 'bold 26px system-ui'; g.fillText('EXERCISE LOG', 14, 34); g.font = '22px "Comic Sans MS", cursive';
      [['FL', 'run 5k ✓'], ['MLT', 'bike 40m ✓'], ['MR', 'skipped :('], ['YOU', '?']].forEach(([n, t], i) => { g.fillStyle = i === 2 ? '#c23b2f' : '#2d5fa8'; g.fillText(`${n}: ${t}`, 16, 84 + i * 50); }); }), 0, 1.7, .02)); P.add(tw);
    // medical cabinet
    const MD = rack('MEDICAL', { w: .8, h: 1.8, style: 3, accent: '#2d8a4a' }); onWall(5, -.7, R - .08, MD); MD.add(pic(.3, .3, tex(128, 128, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#2d8a4a'; g.fillRect(48, 16, 32, 96); g.fillRect(16, 48, 96, 32); }), 0, 1.25, .12)); P.add(MD); block(MD);
    // the end wall: a map of Spirit's drive through Gusev crater and the crew's photo of the rover's tracks
    const MP = new THREE.Group(); onWall(5, Math.PI / 2, R - .05, MP); P.add(MP);
    MP.add(pic(1.6, 1.0, tex(768, 480, (g, w, h) => { g.fillStyle = '#c99a72'; g.fillRect(0, 0, w, h); seed = 21; for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(80,50,30,.35)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 6 + rnd() * 30, 0, 7); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.setLineDash([12, 8]); g.beginPath(); [[90, 330], [180, 300], [300, 280], [380, 250], [450, 230], [520, 220], [560, 260], [590, 300]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff'; g.font = 'bold 22px system-ui'; [['Landing', 80, 360], ['Bonneville', 170, 330], ['Columbia Hills', 380, 220], ['Home Plate', 540, 330]].forEach(([t, x, y]) => g.fillText(t, x, y));
      g.fillStyle = '#1d2a33'; g.fillRect(0, 0, w, 52); g.fillStyle = '#ffd27a'; g.font = 'bold 30px system-ui'; g.fillText("SPIRIT'S DRIVE · GUSEV CRATER 2004–2010", 18, 36); }), 0, 1.7, .02));
  }
  // ---------- hatches between pods (ISS-style rounded frames, hatch swung open into the tunnel) and tunnel fit-out ----------
  const ring = (ow, oh, iw, ih, d, m) => { const sh = new THREE.Shape(), rr = (x, y, w, h, r, path) => { path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r); path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h); path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r); path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y); };
    rr(-ow / 2, -oh / 2, ow, oh, .35, sh); const hole = new THREE.Path(); rr(-iw / 2, -ih / 2, iw, ih, .28, hole); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -d / 2); return new THREE.Mesh(g, m); };
  const hatchM = mat('hatchFrame', '#cfd3d2', { r: .5, m: .25 }), hatchDoorM = mat('hatchDoor', '#bfc5c9', { r: .45, m: .3 }), seal = mat('hatchSeal', '#2b2f33', { r: .9 });
  for (let i = 0; i < 6; i++) for (const side of [1, -1]) {
    if ((side > 0 && i === 5) || (side < 0 && i === 0)) continue;
    const H = new THREE.Group(); H.userData.walk = true; onWall(i, side * Math.PI / 2, R - .02, H); pods[i].add(H);
    H.add(at(ring(3.0, 3.0, 2.6, 2.7, .3, hatchM), 0, 1.47, 0)); H.add(at(ring(2.7, 2.8, 2.54, 2.64, .34, seal), 0, 1.47, 0));
    const next = I.podNames[i + side];
    H.add(pic(1.4, .2, label(`${side > 0 ? '' : '← '}${next.toUpperCase()}${side > 0 ? ' →' : ''}`, { w: 768, h: 110, bg: '#26343d', fg: '#ecf2e7', font: 'bold 50px system-ui' }), 0, 3.08, .16));
    H.add(pic(.34, .09, label(`NODE ${i}-${i + side}`, { w: 256, h: 68, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 36px monospace' }), 1.15, 2.55, .16));
    // the hatch, swung back flat against the tunnel wall, with its little pressure window and handle
    const door = new THREE.Group(); door.position.set(-1.38 * side, 0, -.2); door.rotation.y = side * Math.PI / 2; H.add(door);
    door.add(at(rbox(2.4, 2.5, .08, .3, hatchDoorM), 0, 1.47, 0).translateX(side * 1.2));
    door.add(at(new THREE.Mesh(new THREE.CircleGeometry(.12, 20), mat("hatchWin", "#9fd0e8", { r: .1, m: .2 })), side * 1.2, 2.0, .045));
    door.add(box(.5, .06, .06, mat("hatchHandle", "#2b2f33", { r: .4 }), side * 1.2, 1.4, .07));
  }
  { // the hatch at the back of Life support into the greenhouse tunnel
    const H = new THREE.Group(); H.userData.walk = true; onWall(2, Math.PI, R - .02, H); pods[2].add(H);
    H.add(at(ring(3.0, 3.0, 2.6, 2.7, .3, hatchM), 0, 1.47, 0)); H.add(at(ring(2.7, 2.8, 2.54, 2.64, .34, seal), 0, 1.47, 0));
    H.add(pic(1.4, .2, label('GREENHOUSE · DOME 1 →', { w: 768, h: 110, bg: '#2d5a2a', fg: '#e9f7e4', font: 'bold 50px system-ui' }), 0, 3.08, .16));
    H.add(pic(.34, .09, label('NODE 2-G', { w: 256, h: 68, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 36px monospace' }), 1.15, 2.55, .16));
    for (const off of [-1.4, 1.4]) { const h = handrail(1.0, true); h.position.set(off, 1.2, .05); H.add(h); }
  }
  for (let i = 0; i < 5; i++) {   // the short tunnels: ribs, a handrail each side, a cable bundle
    const cx = i * SPACING + SPACING / 2, T = new THREE.Group(); T.userData.walk = true; pods[i].add(T);
    for (const dx of [-1.0, 1.0]) { const rib = ring(2.8, 2.9, 2.64, 2.78, .12, hatchM); rib.rotation.y = Math.PI / 2; rib.position.set(cx + dx, 1.5, 0); rib.position.y = 1.5 - .04; T.add(rib); }
    for (const z of [-1.38, 1.38]) { const hr = handrail(2.6); hr.rotation.y = z > 0 ? Math.PI : 0; hr.position.set(cx, 1.05, z > 0 ? 1.42 : -1.42); T.add(hr); }
    T.add(box(1.9, .03, .16, mat('tray', '#9aa1a7', { m: .4, r: .5 }), cx, 2.38, -1.24)); T.add(box(1.9, .07, .01, mat('tray', '#9aa1a7'), cx, 2.41, -1.32));
    for (let k = 0; k < 3; k++) { const c = cyl(.018, .018, 1.9, mat('cable' + k, ['#2b2b2b', '#c23b2f', '#2d5fa8'][k], { r: .6 }), cx, 2.415, -1.29 + k * .042, 8); c.rotation.z = Math.PI / 2; T.add(c); }
    for (const dx of [-.6, .6]) T.add(box(.03, .12, .2, mat('pSteel', '#b8bec4', { m: .7, r: .32 }), cx + dx, 2.44, -1.24));
    T.add(box(3.2, .01, 1.2, mat('tunnelMat', '#3a3f45', { r: 1 }), cx, .045, 0));
  }

  { // the Wardroom window: fit the view into the wall opening and give it a proper deep frame (its edges used to poke through the angled panels)
    let view; scene.traverse(o => { if (o.isMesh && o.geometry.type === 'PlaneGeometry' && Math.abs(o.geometry.parameters.width - 3.6) < .01 && Math.abs(o.geometry.parameters.height - 1.85) < .01) view = o; });
    if (view) { view.scale.x = 3.1 / 3.6; }
    const cx = 4 * SPACING, F = new THREE.Group(); F.userData.walk = true; F.position.set(cx, 2.0, -3.74); pods[4].add(F);
    F.add(ring(3.5, 2.05, 3.0, 1.62, .18, hatchM)); F.add(at(ring(3.06, 1.68, 2.94, 1.56, .26, seal), 0, 0, -.02));
    F.add(box(3.3, .06, .34, mat('ply', '#c49a6c'), 0, -.86, .12));   // a deep sill to lean on
    scene.traverse(o => { if (o.userData.podLabel === 4) o.position.y = 3.25; });
  }
  // ---------- filling the sparse spots ----------
  { // Wardroom: crew photo board and a herb shelf
    const P = pods[4], PB = new THREE.Group(); onWall(4, -.4, R - .2, PB); P.add(PB);
    PB.add(box(1.36, .96, .04, mat('wbFrame', '#b9bec2', { m: .5 }), 0, 1.6, .0)); PB.add(box(1.3, .9, .03, mat('cork', '#b78a5a', { r: 1 }), 0, 1.6, .015));
    for (const x of [-.55, .55]) PB.add(box(.06, .8, .16, mat('wbFrame', '#b9bec2'), x, 1.6, -.09));
    PB.add(pic(.5, .34, tex(384, 260, (g, w, h) => { const s2 = g.createLinearGradient(0, 0, 0, h); s2.addColorStop(0, '#9fc3e0'); s2.addColorStop(1, '#e8dcc6'); g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = s2; g.fillRect(10, 10, w - 20, h - 60);
      CREW.forEach((c, k) => { g.fillStyle = '#f0f0ea'; g.beginPath(); g.ellipse(70 + k * 82, 150, 30, 58, 0, 0, 7); g.fill(); g.fillStyle = c.colour; g.fillRect(48 + k * 82, 120, 44, 10); g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(70 + k * 82, 82, 20, 0, 7); g.fill(); });
      g.fillStyle = '#333'; g.font = 'italic 24px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillText('Crew 1 · launch day!', w / 2, h - 20); }), -.3, 1.79, .035));
    // a tidy grid so nothing overlaps: crew photo top left, four snapshots on the right, a postcard and a note below
    const snaps = [['hills', .2, 1.86, .04], ['coast', .47, 1.84, -.05], ['dog', .2, 1.42, -.03], ['skyline', .47, 1.44, .05], ['family', -.45, 1.36, .05]];
    snaps.forEach(([k, x, y, rz], i) => { const ph = pic(.24, .18, photo(k, 256, 192), x, y, .034 + i * .0015); ph.rotation.z = rz; PB.add(ph); PB.add(cyl(.012, .012, .012, mat('pin' + (i % 3), ['#c23b2f', '#2d5fa8', '#f2c230'][i % 3], { r: .4 }), x, y + .08, .045, 8).rotateX(Math.PI / 2)); });
    PB.add(pic(.13, .13, sticky('Movie\nnight Fri\n7pm!', '#ffc2d1'), -.13, 1.36, .036)); PB.add(cyl(.012, .012, .012, mat('pin1', '#2d5fa8', { r: .4 }), -.13, 1.42, .045, 8).rotateX(Math.PI / 2));
    PB.add(cyl(.012, .012, .012, mat('pin0', '#c23b2f', { r: .4 }), -.3, 1.95, .045, 8).rotateX(Math.PI / 2));
    const HS = new THREE.Group(); onWall(4, 2.4, R - .25, HS); P.add(HS);
    HS.add(box(1.0, .04, .35, mat('ply', '#c49a6c'), 0, .9, 0)); for (const x of [-.45, .45]) HS.add(box(.04, .9, .3, mat('ply', '#c49a6c'), x, .45, 0));
    [['#5aa04a', -.3], ['#4f8f3a', 0], ['#7fbf4a', .3]].forEach(([c, x]) => { const pl = plant(1.0, c, '#e9e4da', x > .2 ? 'chives' : 'herb'); pl.position.set(x, .92, 0); HS.add(pl); });
    HS.add(pic(.36, .08, label('BASIL · MINT · CHIVES', { w: 512, h: 96, bg: '#f2f0ea', fg: '#2d5a2a', font: 'bold 34px system-ui' }), 0, .8, .18));
    block(HS); block(PB);
  }
  { // Airlock: suit repair bench with a spare helmet, a glove being patched and a tool roll
    const P = pods[0], SR = new THREE.Group(); onWall(0, 2.43, R - .35, SR); P.add(SR);
    SR.add(box(1.1, .05, .55, mat('labTop', '#e8e5de', { r: .4 }), 0, .85, 0)); for (const x of [-.5, .5]) SR.add(box(.05, .85, .5, mat('tmRail', '#b9bec2', { m: .5, r: .3 }), x, .42, 0));
    const helm = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 14), mat('helmet', '#f4f4f0', { r: .35 })); helm.position.set(-.25, 1.04, 0); SR.add(helm);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(.172, 20, 14, -1.1, 2.2, .7, 1.2), mat('visor', '#d4a645', { r: .15, m: .8 })); visor.position.copy(helm.position); SR.add(visor);
    SR.add(rbox(.12, .2, .06, .04, mat('glove', '#efefea', { r: .9 }), .15, .9, .05).rotateX(-Math.PI / 2));
    SR.add(box(.35, .02, .2, mat('toolRoll', '#3c4a5c', { r: 1 }), .35, .885, -.05));
    for (let k = 0; k < 4; k++) SR.add(box(.02, .015, .16, mat('fast', '#b9bec2', { m: .6, r: .35 }), .25 + k * .06, .9, -.05));
    SR.add(pic(.5, .1, label('SUIT REPAIR', { w: 512, h: 100, bg: '#1d2a33', font: 'bold 48px system-ui' }), 0, 1.5, -.26));
    block(SR);
  }

  // ---------- things you can look at with E ----------
  const fact = (t) => `<p class="source">${t}</p>`;
  note(0, .45, 2.9, 'check the dust zone', '🧹 Dust zone', '<p>Mars dust clings to everything. Brush your suit and boots here before you go further in.</p>' + fact('Apollo astronauts found Moon dust got everywhere inside the lander and smelled like spent gunpowder.'));
  note(0, -1.1, 3.1, 'read the EVA checklist', '✅ EVA prep checklist', '<p>Suit pressure, oxygen, battery, comms, gloves and visor, then a buddy check — and write your name on the "Who is outside?" board.</p>' + fact('Real spacewalks follow long written checklists, read out step by step with a crewmate.'));
  note(0, 2.43, 3.0, 'look at the suit repair bench', '🧤 Suit repair', '<p>Someone is patching a glove. Gloves wear out fastest: every grip on a tool rubs the fingertips.</p>' + fact('ISS spacewalkers photograph their gloves after each spacewalk to check for cuts and wear.'));
  note(1, .85, 3.0, 'read the cargo labels', '📦 Cargo transfer bags', '<p>Food, filters, seeds, clothes, tape and spares — every bag has a barcode so the crew can find things.</p>' + fact('On the ISS, finding stowed items is a big part of the day; the station tracks thousands of items in an inventory system.'));
  note(1, -1.13, 2.9, 'check the 3D printer', '🖨 3D printer', '<p>It is printing a replacement bracket. Printing spares here is faster than waiting months for a supply ship.</p>' + fact('The ISS has tested 3D printers since 2014, including printing a wrench from a file sent up from Earth.'));
  note(2, Math.PI + .62, 3.1, 'check the seedlings', '🌱 Seedlings', '<p>Lettuce and radish seedlings, started here and moved into the greenhouse when they are strong enough.</p>' + fact('ISS astronauts first ate lettuce grown in space (red romaine) in 2015.'));
  note(2, -1.0, 3.2, 'read the life-support racks', '🫁 Life support', '<p>One rack scrubs CO₂ out of the air, one makes oxygen from water, one recycles water, one filters smells and traces of gases.</p>' + fact('The ISS recycles about 98% of its water, including sweat and urine.'));
  cabinSlots.forEach((j, k) => { const person = CREW[k]; I.stations.push({ type: 'hab-note', x: 3 * SPACING + Math.sin(slotA(j)) * 3.3, z: Math.cos(slotA(j)) * 3.3,
    get label() { return k < (I.habCrew ?? 3) ? (person.id === 'you' ? 'look into your cabin' : `look into ${person.first}'s cabin`) : 'check the spare cabin'; },
    get title() { return k < (I.habCrew ?? 3) ? (person.id === 'you' ? '🛏 Your cabin' : `🛏 ${person.first}'s cabin`) : '📦 Spare cabin'; },
    html: () => k >= (I.habCrew ?? 3) ? '<p>Nobody sleeps here on this mission, so it is full of spare supplies and a water reserve.</p>' : CABIN_NOTES[person.id] + fact('Every crew member gets a private room: NASA studies found shared sleeping spaces hurt sleep on long missions.') }); });
  note(3, 0, 3.3, 'read the crew calendar', '📅 Crew calendar', () => `<p>Sol ${Math.max(1, I.calendar.sol)}. Past sols are crossed off. Mei Lin's birthday and a call home are marked.</p>` + fact('A sol (a Mars day) is 24 hours 39 minutes long.'));
  note(3, slotA(8.4), 3.3, 'knock on the hygiene stall', '🚿 Hygiene stall', '<p>Toilet, wash basin and a water-saving shower. Each crewmate has a towel in their own colour.</p>' + fact('NASA put bathrooms both near the crew quarters and near the work area in its CHAPEA Mars habitat.'));
  note(4, -.95, 3.2, 'read the whiteboard', '📝 Wardroom whiteboard', () => { const ppl = CREW.slice(0, I.habCrew ?? 3), sol = Math.max(1, I.calendar.sol); return `<p><b>Chores today:</b><br>${['Galley & dishes', 'Filters & vacuum', 'Greenhouse check', 'Trash compactor'].map((j, i) => `${j}: ${ppl[(i + sol) % ppl.length].first ?? 'You'}`).join('<br>')}</p><p><b>Dinner:</b> ${MENUS[sol % MENUS.length]}</p>` + fact('Sharing chores and meals helps crews get along on long missions.'); });
  note(4, .82, 2.9, 'use the galley', '☕ Gusev Café', '<p>Hot water for drinks and dried food, a warmer for pouches, and a pantry of labelled food.</p>' + fact('On the ISS, salt and pepper are liquids — salt dissolved in water, pepper in oil — so the grains do not float into the air.'));
  note(4, Math.PI + .45, 2.9, 'pick up the plush toy', '🧸 The plush toy', '<p>It rode along to Mars in someone\'s kit. Now it guards the window seat.</p>' + fact('Crews often bring a small plush toy on launch day: when it starts floating, everyone knows they have reached space.'));
  note(4, 2.15, 3.2, 'look at the mission patches', '🎖 Patch wall', '<p>Each team and big moment gets a patch: the first harvest, the rover team, surviving the first dust storm.</p>' + fact('ISS crews stick their mission patches on the walls of the Unity node, where they eat together.'));
  note(4, -2.45, 3.1, 'browse the bookshelf', '📚 Bookshelf', '<p>Paper books, board games and a launch-day photo. Screens are everywhere, so the crew likes having something to hold.</p>' + fact('Crews on long missions have asked for more free-time choices: books, games, music and films.'));
  note(4, -.4, 3.2, 'look at the photo board', '📸 Photo board', '<p>Crew 1 on launch day, postcards from home, and a reminder: movie night on Friday.</p>' + fact('Photos of home and family are some of the most important things astronauts take into space.'));
  note(5, .95, 3.1, 'read the exercise log', '🏃 Exercise log', '<p>Someone skipped their session and got a sad face. The treadmill has a harness that holds you down onto the belt.</p>' + fact('ISS astronauts exercise about two hours a day to protect their bones and muscles.'));
  note(5, Math.PI / 2, 2.9, "look at Spirit's map", "🗺 Spirit's drive", '<p>The route NASA\'s Spirit rover drove through Gusev crater from 2004 to 2010: the landing site, Bonneville crater, the Columbia Hills and Home Plate.</p>' + fact('Spirit was planned to work for 90 sols and kept going for more than six years.'));
  note(5, -.7, 3.2, 'open the medical cabinet', '🩺 Medical', '<p>First aid, medicines and an ultrasound. One crewmate trains as the medical officer.</p>' + fact('The ISS has an ultrasound machine; doctors on Earth can guide the crew through a scan.'));

  for (const x of [-.95, .95]) I.obstacles.push(new THREE.Box3(new THREE.Vector3(x - .15, 0, 3.2), new THREE.Vector3(x + .15, 2, 3.8)));   // outer airlock door frame
  { // storm shelter (pod 3): a walk-in room behind a hatch in the south wall, walled in water bags (water is good
    // radiation shielding; NASA studies line a small, well-shielded room with water and stores). Two stacked bunks,
    // a strapped bench, and real NASA 3D Resources models: ISS Crew Lock Bags, EVA helmets, the orange Advanced
    // Crew Escape Suit and an Orbital Replacement Unit (game/assets/nasa/shelter, see MODELS.md).
    const st = I.stations.find(t => t.type === 'shelter');
    const G = st && scene.children.find(o => o.isGroup && Math.abs(o.position.x - st.x) < .01 && Math.abs(o.position.z - st.z) < .01);
    if (G) { G.traverse(o => { if (o.isMesh) o.visible = false; }); I.obstacles = (I.obstacles || []).filter(b => !(st.x > b.min.x && st.x < b.max.x && st.z > b.min.z && st.z < b.max.z)); }
    const W = 3.0, D = 2.7, Hc = 2.3, P = pods[3], Rm = new THREE.Group();
    Rm.userData.noBake = Rm.userData.walk = true; onWall(3, Math.PI, R - .02, Rm); P.add(Rm);
    const wallM = mat('shelterWall', '#d8dcd6', { r: .9, side: THREE.DoubleSide }), floorM = mat('shelterFloor', '#3c4650', { r: .95 }), frame = mat('shelterFrame', '#3d4a55', { r: .7, m: .2 });
    const bagM = mat('waterBag', '#d6e6ef', { r: .45 }), strap = mat('bagStrap', '#2d5fa8', { r: .8 }), pad = mat('shelterPad', '#3b7bd8', { r: .95 }), padDark = mat('shelterBack', '#2f5f9e', { r: .95 });
    // shell
    Rm.add(box(W, .02, D, floorM, 0, .01, -D / 2)); Rm.add(box(W, .02, D, wallM, 0, Hc, -D / 2));
    for (const sx of [-1, 1]) Rm.add(box(.04, Hc, D, wallM, sx * W / 2, Hc / 2, -D / 2));
    Rm.add(box(W, Hc, .04, wallM, 0, Hc / 2, -D));
    // front wall with the hatch opening: the round pod wall curves away from this flat room, so without it you would
    // see straight out of the hab past both sides of the hatch
    for (const sx of [-1, 1]) Rm.add(box(W / 2 - .56, Hc, .06, wallM, sx * (.56 + (W / 2 - .56) / 2), Hc / 2, -.03));
    Rm.add(box(1.12, Hc - 2.1, .06, wallM, 0, 2.1 + (Hc - 2.1) / 2, -.03));
    // water walls: bags strapped in rows on both side walls and across the ceiling
    for (const sx of [-1, 1]) for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
      const z = -.4 - col * .6, y = .2 + row * .34; Rm.add(rbox(.26, .3, .56, .07, bagM, sx * (W / 2 - .15), y, z));
      if (col === 0) Rm.add(box(.03, .04, D - .2, strap, sx * (W / 2 - .29), y + .08, -D / 2 - .05));
    }
    for (let k = 0; k < 5; k++) Rm.add(rbox(.56, .14, D - .3, .05, bagM, -1.2 + k * .6, Hc - .09, -D / 2 - .05));
    // hatch: a thick frame in the pod wall, the round-cornered hatch swung open against the pod wall
    for (const sx of [-1, 1]) Rm.add(box(.12, 2.1, .3, frame, sx * .56, 1.05, 0));
    Rm.add(box(1.24, .16, .3, frame, 0, 2.14, 0)); Rm.add(box(1.24, .06, .3, frame, 0, .03, 0));
    const hatch = rbox(1.0, 1.95, .1, .12, mat('shelterHatch', '#9aa5ad', { r: .5, m: .4 }), 0, 0, 0); hatch.position.set(-1.2, 1.05, .22); hatch.rotation.y = Math.PI / 2 - .2; Rm.add(hatch);
    Rm.add(pic(.9, .18, label('STORM SHELTER', { w: 512, h: 100, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 52px system-ui' }), 0, 2.45, .16));
    // two stacked bunks along the back wall
    const bunkZ = -D + .55;
    for (const sx of [-1.12, 1.12]) Rm.add(box(.06, 2.0, .06, frame, sx, 1.0, bunkZ + .38)), Rm.add(box(.06, 2.0, .06, frame, sx, 1.0, bunkZ - .38));
    for (const top of [.55, 1.55]) {
      Rm.add(box(2.2, .08, .8, frame, 0, top - .14, bunkZ)); Rm.add(rbox(2.1, .12, .74, .05, pad, 0, top - .05, bunkZ));
      Rm.add(rbox(.42, .09, .3, .04, mat('pillow', '#f2f2ee', { r: 1 }), -.8, top + .05, bunkZ));
      Rm.add(box(2.1, .04, .04, strap, 0, top + .12, bunkZ + .38));   // restraint strap along the open side
    }
    Rm.add(box(.4, .04, .04, frame, 1.12, 1.2, bunkZ + .4)); Rm.add(box(.04, 1.6, .04, frame, 1.25, .8, bunkZ + .4));   // ladder rail
    // strapped bench on the left wall
    Rm.add(rbox(.45, .42, 1.25, .05, frame, -1.05, .21, -1.05)); Rm.add(rbox(.47, .1, 1.27, .05, pad, -1.05, .47, -1.05));
    for (const z of [-.6, -1.05, -1.5]) Rm.add(box(.5, .03, .05, strap, -1.05, .53, z));
    Rm.add(rbox(.08, .5, 1.25, .04, padDark, -1.27, .8, -1.05));
    // helmet shelf above the bench, ready display by the hatch, a warm light strip
    Rm.add(box(.32, .03, 1.2, mat('ply', '#c49a6c', { r: .75 }), -1.12, 1.62, -1.05));
    const disp = tex(512, 288, (g, w, h) => {
      g.fillStyle = '#071318'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd27a'; g.font = 'bold 34px monospace'; g.fillText('SHELTER STATUS', 22, 48);
      g.fillStyle = '#7dffb2'; g.font = '28px monospace';
      ['Water wall   20 cm', 'Seats + bunks   4', 'Air + water   72 h', 'Dose rate   watch'].forEach((t, i) => g.fillText(t, 22, 100 + i * 44));
    });
    const dp = pic(.62, .35, disp, .95, 1.5, -.06, true); dp.rotation.y = Math.PI; Rm.add(dp);   // faces into the room
    Rm.add(rbox(1.6, .05, .12, .03, mat('shelterLED', '#ffe9c0', { e: '#ffd9a0', ei: 1.4 }), 0, Hc - .19, -1.1));
    bake(Rm);
    // the room's frame in the hab, for its floor, bunks and station (bunks.js); the pod is baked flat later
    Rm.updateMatrix(); const frameM = Rm.matrix.clone();
    const toScene = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(frameM);
    I.shelterRoom = { frame: frameM, walk: { x0: -.78, x1: .66, z0: -1.55, z1: 0 }, door: { x0: -.32, x1: .32, z0: -.4, z1: .75 }, bunkZ, tops: [.55, 1.55] };
    if (st) { const p = toScene(0, -.75); st.x = p.x; st.z = p.z; st.label = 'check the storm shelter supplies'; }
    // NASA models, scaled to real sizes (metres) and placed when they finish loading
    const place = (file, size, axis, x, y, z, ry = 0, after) => loadModel(file).then(g => {
      if (!g) return; const o = g.scene.clone(true), b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
      const k = size / (axis === 'y' ? s.y : Math.max(s.x, s.z)); o.scale.setScalar(k);
      const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3());
      const holder = new THREE.Group(); o.position.set(-c.x, -b2.min.y, -c.z); holder.add(o); holder.position.set(x, y, z); holder.rotation.y = ry;
      o.traverse(m => { if (!m.isMesh) return; m.castShadow = false; m.receiveShadow = true;
        // some NASA files make suit fabric 75-85% opaque: draw it solid so the wall doesn't show through it
        for (const mt of [].concat(m.material)) { if (mt.transmission > 0) { mt.transmission = 0; mt.needsUpdate = true; } }   // the NASA ACES file exports its fabric as glass (transmission 1)
        for (const mt of [].concat(m.material)) if (mt.transparent && (mt.opacity ?? 1) >= .5) { mt.transparent = false; mt.opacity = 1; mt.alphaTest = mt.map ? .5 : 0; mt.depthWrite = true; mt.needsUpdate = true; } });   // visors (under 50%) stay see-through
      Rm.add(holder);
      if (after != null) {   // a number: hang it flat against the right-hand water wall at that x (its real depth varies)
        holder.updateMatrixWorld(true); const bw = new THREE.Box3().setFromObject(holder);
        holder.position.x -= Rm.worldToLocal(bw.max.clone()).x - after;
      }
    });
    place('nasa/shelter/aces-suit.glb', 1.75, 'y', 1.0, .02, -1.25, -Math.PI / 2, 1.18);   // orange launch-and-entry suit hung on the right wall
    place('nasa/shelter/crew-lock-bag.glb', .5, 'y', 1.0, .9, -.42, -Math.PI / 2, 1.2);   // ISS Crew Lock Bags strapped by the hatch
    place('nasa/shelter/crew-lock-bag.glb', .5, 'y', 1.0, .02, -.42, -Math.PI / 2, 1.2);
    place('nasa/shelter/helmet.glb', .34, 'y', -1.12, 1.635, -.7, Math.PI / 2);
    place('nasa/shelter/helmet.glb', .34, 'y', -1.12, 1.635, -1.4, Math.PI / 2);
    place('nasa/shelter/orbital-replacement-unit.glb', .55, 'xz', .55, .02, bunkZ + .02, 0);   // spare equipment unit stowed under the lower bunk
  }
  upgradeProps(I, scene, pods);   // real equipment in place of the old placeholder blocks
  // ---------- solids: one oriented box per furniture item (racks sit at angles round the curved wall, so a plain
  // world-aligned box was either far too big or missed the item). Hatches, tunnels, floor mats and ceilings are skipped.
  I.solids = [];
  { const tb = new THREE.Box3(), wb = new THREE.Box3(), inv = new THREE.Matrix4(), mm = new THREE.Matrix4();
    const solidOf = (o) => {
      if (o.userData.walk) return;
      o.updateWorldMatrix(true, true); wb.setFromObject(o); if (wb.isEmpty() || wb.min.y > 1.55 || wb.max.y < .2) return;
      inv.copy(o.matrixWorld).invert(); const b = new THREE.Box3();
      o.traverse(m => { if (!m.isMesh || !m.visible) return; m.geometry.boundingBox ?? m.geometry.computeBoundingBox(); tb.copy(m.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, m.matrixWorld));
        const wy0 = tb.min.y + o.matrixWorld.elements[13], wy1 = tb.max.y + o.matrixWorld.elements[13]; if (wy0 > 1.55 || wy1 < .2) return; b.union(tb); });
      if (b.isEmpty()) return; const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
      if (sx > 3.2 && sz > 3.2) return;            // rings and whole-room things
      I.solids.push({ inv: inv.clone(), min: b.min.clone(), max: b.max.clone() });
      if (wb.min.y < .35) {   // a soft contact shadow on the floor under anything that stands on it
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(sx + .3, sz + .3), shadowMat); sh.rotation.x = -Math.PI / 2;
        const c = new THREE.Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2).applyMatrix4(o.matrixWorld);
        sh.position.set(c.x, .013, c.z); sh.rotation.z = new THREE.Euler().setFromRotationMatrix(o.matrixWorld, 'YXZ').y; sh.renderOrder = 1; shadows.add(sh);
      }
    };
    const shadows = new THREE.Group(); shadows.name = 'contact-shadows'; root.add(shadows);
    const shadowMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, map: tex(128, 128, (g, w, h) => {
      for (let k = 0; k < 14; k++) { const inset = k * 4; g.fillStyle = 'rgba(0,0,0,.06)'; g.beginPath(); g.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, 30); g.fill(); } }) });
    for (const P of pods) for (const c of [...P.children]) solidOf(c);
    for (const c of root.children) if (!pods.includes(c)) solidOf(c);
    for (const t of I.stations) { const G = scene.children.find(o => o.isGroup && Math.abs(o.position.x - t.x) < .01 && Math.abs(o.position.z - t.z) < .01); if (G && !G.userData.solid) { G.userData.solid = true; solidOf(G); } }
  }
  for (const P of pods) bake(P);

  I.habCabins = cabins;
  createCrew(I, CREW);
  // ---------- live state: circadian light, calendar, crew-dependent cabins ----------
  const lamps = []; scene.traverse(o => { if (o.userData.habLamp) lamps.push(o); });
  const K = { night: new THREE.Color('#ffb36b'), evening: new THREE.Color('#ffd2a1'), day: new THREE.Color('#fff4e6'), morning: new THREE.Color('#e3eeff') };
  const tmp = new THREE.Color();
  I.setHabClock = (frac, sol = 1, crew = 3) => {
    frac = ((frac % 1) + 1) % 1;
    // ISS SSLA-like schedule: blue-enriched bright after waking, neutral by day, warm & dim before sleep, dim amber at night
    let c, k;
    if (frac < .2 || frac > .88) { c = K.night; k = .25; } else if (frac < .3) { c = tmp.copy(K.night).lerp(K.morning, (frac - .2) / .1); k = .25 + (frac - .2) / .1 * .95; }
    else if (frac < .42) { c = tmp.copy(K.morning).lerp(K.day, (frac - .3) / .12); k = 1.2 - (frac - .3) / .12 * .2; } else if (frac < .72) { c = K.day; k = 1; }
    else { c = tmp.copy(K.day).lerp(K.night, (frac - .72) / .16); k = 1 - (frac - .72) / .16 * .7; }
    panelMat.emissive.copy(c); panelMat.emissiveIntensity = 1.3 * k;
    for (const l of lamps) { l.color.copy(c); l.intensity = (l.userData.base ??= l.intensity) * (.35 + .65 * k); }
    if (I.ambient) I.ambient.intensity = (I.ambient.userData.base ??= I.ambient.intensity) * (.45 + .55 * k);
    if (crew !== I.habCrew) { I.habCrew = crew; cabins.forEach((c, i) => { const here = i < crew; c.lived.visible = here; c.spare.visible = !here; }); I.mugs?.forEach((m, i) => m.visible = i < crew); }
    if (sol !== I.calendar.sol) { I.calendar.sol = sol; drawCalendar(I.calendar, sol); drawWhiteboard(I.whiteboard, sol, crew); }
    I.updateCrew?.(frac, crew);
  };
  I.setHabClock(.4, 1, 3);
  return root;
}

function drawCalendar(c, sol) {
  sol = Math.max(1, Math.floor(sol) || 1);   // a new game starts on sol 0: show it as the first sol
  const g = c.canvas.getContext('2d'), w = c.canvas.width, h = c.canvas.height, month = Math.floor((sol - 1) / 28);
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#c23b2f'; g.fillRect(0, 0, w, 74); g.fillStyle = '#fff'; g.font = 'bold 38px system-ui'; g.fillText(`SOLS ${month * 28 + 1}–${month * 28 + 28}`, 22, 50);
  g.strokeStyle = '#ccc'; g.font = '22px system-ui';
  for (let i = 0; i < 28; i++) {
    const x = 16 + (i % 7) * 69, y = 90 + Math.floor(i / 7) * 100, d = month * 28 + i + 1;
    g.strokeRect(x, y, 66, 96); g.fillStyle = '#333'; g.fillText(d, x + 6, y + 26);
    if (d < sol) { g.strokeStyle = '#c23b2f'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 8, y + 10); g.lineTo(x + 58, y + 86); g.moveTo(x + 58, y + 10); g.lineTo(x + 8, y + 86); g.stroke(); g.strokeStyle = '#ccc'; g.lineWidth = 1; }
    if (d === sol) { g.strokeStyle = '#2d5fa8'; g.lineWidth = 5; g.strokeRect(x + 2, y + 2, 62, 92); g.strokeStyle = '#ccc'; g.lineWidth = 1; }
    if (d % 28 === 12) { g.fillStyle = '#9b6cc9'; g.font = '16px system-ui'; g.fillText('🎂 M.L.', x + 6, y + 70); g.font = '22px system-ui'; }
    if (d % 28 === 20) { g.fillStyle = '#2d8a4a'; g.font = '16px system-ui'; g.fillText('call home', x + 4, y + 70); g.font = '22px system-ui'; }
  }
  c.texture.needsUpdate = true;
}
function drawWhiteboard(wb, sol, crew) {
  const g = wb.canvas.getContext('2d'), w = wb.canvas.width, h = wb.canvas.height, people = CREW.slice(0, crew);
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
  g.font = 'bold 34px system-ui'; g.fillStyle = '#1d2a33'; g.fillText(`SOL ${sol}`, 24, 48);
  g.font = '30px "Comic Sans MS", cursive';
  const jobs = ['Galley & dishes', 'Filters & vacuum', 'Greenhouse check', 'Trash compactor'];
  g.fillStyle = '#2d5fa8'; g.fillText('Chores:', 24, 104);
  jobs.forEach((j, i) => { const p = people[(i + sol) % people.length]; g.fillStyle = '#333'; g.fillText(`${j}: ${p.first ?? 'You'}`, 40, 148 + i * 42); });
  const menus = MENUS;
  g.fillStyle = '#c23b2f'; g.fillText('Dinner:', 24, 340); g.fillStyle = '#333'; g.fillText(menus[sol % menus.length], 40, 384);
  g.fillStyle = '#2d8a4a'; g.font = '26px "Comic Sans MS", cursive'; g.fillText('Movie night: Fri ✓   Quiet hrs 22:00', 24, 460);
  g.strokeStyle = '#c23b2f'; g.lineWidth = 4; g.beginPath(); g.ellipse(620, 60, 110, 36, 0, 0, 7); g.stroke(); g.fillStyle = '#c23b2f'; g.font = 'bold 26px system-ui'; g.fillText('PIZZA? lol', 540, 70);
  wb.texture.needsUpdate = true;
}

// =====================================================================================================
// Real-looking equipment in place of the old block placeholders: the water plant, the stowage wall, the hazard
// monitor console, the treadmill and the exercise bike. Modelled on ISS hardware (the Water Recovery System and
// Oxygen Generation System racks, stowage drawers, the T2 treadmill and the CEVIS bike).
// =====================================================================================================
const tube3 = (pts, r, m, seg = 24) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 8, false), m);
function dial(text, colour = '#2d8a4a') {   // a round pressure gauge face
  return tex(128, 128, (g, w) => { g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = colour; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 48, Math.PI * .8, Math.PI * 1.6); g.stroke(); g.strokeStyle = '#c23b2f'; g.beginPath(); g.arc(64, 64, 48, Math.PI * 1.9, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 0; i <= 10; i++) { const a = Math.PI * .75 + i * Math.PI * 1.5 / 10; g.beginPath(); g.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); g.stroke(); }
    g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(Math.PI * 1.35) * 44, 64 + Math.sin(Math.PI * 1.35) * 44); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill();
    g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText(text, 64, 98); });
}
function quilt(colour) {   // multi-layer insulation blanket: stitched diamonds
  const t = tex(256, 256, (g, w, h) => { g.fillStyle = colour; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
    for (let k = -8; k < 16; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + h, h); g.stroke(); g.beginPath(); g.moveTo(k * 32, h); g.lineTo(k * 32 + h, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return new THREE.MeshStandardMaterial({ map: t, roughness: .85 });
}
function hazardStripe() {
  const t = tex(256, 32, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1d1d'; for (let x = -32; x < w + 32; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); } });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: .7 });
}
function screenUI(lines, { w = 512, h = 320, accent = '#7fd4e8' } = {}) {
  return tex(w, h, (g) => { g.fillStyle = '#071319'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(127,212,232,.12)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = accent; g.fillRect(0, 0, w, 42); g.fillStyle = '#071319'; g.font = 'bold 26px monospace'; g.fillText(lines[0], 14, 30);
    g.font = '24px monospace'; lines.slice(1).forEach((l, i) => { g.fillStyle = l.startsWith('!') ? '#ffb347' : '#cfeee6'; g.fillText(l.replace(/^!/, ''), 18, 82 + i * 36); });
    g.fillStyle = '#5dff9a'; g.beginPath(); g.arc(w - 24, 21, 8, 0, 7); g.fill(); });
}
function upgradeProps(I, scene, pods) {
  const groupOf = type => { const st = I.stations.find(t => t.type === type); return st && scene.children.find(o => o.isGroup && Math.abs(o.position.x - st.x) < .01 && Math.abs(o.position.z - st.z) < .01); };
  const hideOld = (G, keep = []) => G.traverse(o => { if (o.isMesh && !keep.includes(o)) o.visible = false; });
  const steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), dark = mat('pDark', '#2f353b', { r: .55, m: .3 }), white = mat('pWhite', '#e9e7e1', { r: .55 }), frame = mat('rackFrame', '#8e979b', { r: .55, m: .35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d8eef6', roughness: .05, metalness: 0, transmission: 0, transparent: true, opacity: .28, depthWrite: false });
  const water = new THREE.MeshStandardMaterial({ color: '#3f9bd6', roughness: .1, emissive: '#0c3550', emissiveIntensity: .6, transparent: true, opacity: .85 });
  const o2 = mat('pipeO2', '#2d8a4a', { r: .4, m: .3 }), h2 = mat('pipeH2', '#c23b2f', { r: .4, m: .3 }), hose = mat('hose', '#2b2b2b', { r: .9 });

  // ---------- water plant: ice melter, filters, clean-water tank and the electrolysis stack that makes oxygen ----------
  const WP = groupOf('water');
  if (WP) {
    hideOld(WP); const S = new THREE.Group(); WP.add(S);
    S.add(rbox(1.78, .12, .82, .03, dark, 0, .06, 0)); const hz = box(1.8, .05, .02, hazardStripe(), 0, .1, .42); S.add(hz);
    // back rack: frame, panels, labels
    S.add(box(1.76, 2.15, .06, frame, 0, 1.2, -.38));
    S.add(rbox(1.66, .9, .04, .02, white, 0, 1.75, -.33));
    S.add(pic(.8, .1, label('OXYGEN GENERATOR', { bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 40px system-ui' }), -.38, 2.12, -.305));
    // electrolysis stack: many thin cells clamped between end plates
    const stack = new THREE.Group(); stack.position.set(-.35, 1.72, -.22); S.add(stack);
    for (let k = 0; k < 14; k++) stack.add(box(.04, .42, .3, k % 2 ? mat('cell', '#5b6670', { m: .5, r: .35 }) : mat('cellB', '#c9ced3', { m: .6, r: .3 }), -.29 + k * .045, 0, 0));
    for (const x of [-.34, .34]) stack.add(box(.05, .5, .36, steel, x, 0, 0));
    for (const y of [-.2, .2]) for (const z of [-.14, .14]) { const rod = cyl(.012, .012, .74, steel, 0, y, z, 8); rod.rotation.z = Math.PI / 2; stack.add(rod); }
    // O2 (green) and H2 (red) lines up into the ceiling, with valves and gauges
    S.add(tube3([[-.1, 1.92, -.2], [.1, 2.0, -.25], [.2, 2.3, -.3], [.2, 3.0, -.3]], .03, o2)); S.add(tube3([[-.6, 1.92, -.2], [-.7, 2.05, -.25], [-.75, 2.4, -.3], [-.75, 3.0, -.3]], .025, h2));
    for (const [x, m, t] of [[.2, o2, 'O₂ kPa'], [-.75, h2, 'H₂ kPa']]) { const gg = cyl(.08, .08, .04, steel, x + .12, 2.45, -.24, 20); gg.rotation.x = Math.PI / 2; S.add(gg); S.add(pic(.13, .13, dial(t, x > 0 ? '#2d8a4a' : '#c23b2f'), x + .12, 2.45, -.215)); S.add(box(.1, .03, .03, mat('valveRed', '#c23b2f', { r: .5 }), x, 2.25, -.25)); }
    S.add(pic(.34, .1, label('OXYGEN · TO AIR', { w: 384, h: 96, bg: '#2d8a4a', fg: '#fff', font: 'bold 34px system-ui' }), .45, 2.6, -.34));
    // ice melter: steel drum in an orange insulation blanket, a loading hopper and a frosty sight glass
    const melter = new THREE.Group(); melter.position.set(-.46, .12, .05); S.add(melter);
    melter.add(cyl(.33, .33, .92, quilt('#d9683a'), 0, .5, 0, 32)); for (const y of [.06, .96]) melter.add(cyl(.345, .345, .06, steel, 0, y, 0, 32));
    melter.add(cyl(.36, .2, .22, steel, 0, 1.1, 0, 32)); melter.add(cyl(.22, .22, .05, dark, 0, 1.23, 0, 24));
    const sg = cyl(.08, .08, .03, mat('iceGlass', '#cfefff', { e: '#6fc0e8', ei: .8, r: .1 }), 0, .62, .33, 20); sg.rotation.x = Math.PI / 2; melter.add(sg);
    melter.add(pic(.36, .08, label('ICE MELTER', { w: 384, h: 84, bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 36px system-ui' }), 0, .9, .345));
    // filter cartridges (multifiltration beds)
    for (let k = 0; k < 3; k++) { const f = new THREE.Group(); f.position.set(.08 + k * .16, .55, -.22); f.add(cyl(.06, .06, .5, white, 0, 0, 0, 16)); f.add(cyl(.065, .065, .06, mat('capBlue', '#2d5fa8', { r: .5 }), 0, .28, 0, 16)); f.add(cyl(.065, .065, .06, mat('capBlue', '#2d5fa8'), 0, -.28, 0, 16)); S.add(f); }
    S.add(pic(.46, .07, label('MULTIFILTRATION BEDS', { w: 512, h: 80, bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 30px system-ui' }), .24, .86, -.3));
    // clean water tank: clear acrylic with water inside, steel end caps and a level scale
    const tank = new THREE.Group(); tank.position.set(.5, .12, .08); S.add(tank);
    tank.add(cyl(.27, .27, .95, water, 0, .42, 0, 32)); tank.add(cyl(.3, .3, 1.06, glass, 0, .53, 0, 32));
    for (const y of [0, 1.06]) { tank.add(cyl(.32, .32, .05, steel, 0, y, 0, 32)); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; tank.add(cyl(.012, .012, .06, steel, Math.cos(a) * .3, y, Math.sin(a) * .3, 6)); } }
    for (let k = 0; k < 4; k++) tank.add(cyl(.012, .012, 1.06, steel, Math.cos(k * 1.571 + .785) * .31, .53, Math.sin(k * 1.571 + .785) * .31, 6));
    tank.add(pic(.04, .8, tex(32, 512, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let i = 0; i <= 10; i++) g.fillRect(0, i * h / 10.2 + 2, i % 5 ? 14 : 28, 3); }), 0, .53, .315));
    tank.add(pic(.3, .08, label('POTABLE H₂O', { w: 384, h: 96, bg: '#2d5fa8', fg: '#fff', font: 'bold 40px system-ui' }), 0, 1.16, .2).rotateX(-.4));
    // pipes: melter -> filters -> tank, a hose to the floor drain
    S.add(tube3([[-.46, 1.2, .05], [-.2, 1.32, -.1], [.08, 1.0, -.22], [.08, .82, -.22]], .025, steel)); S.add(tube3([[.4, .3, -.22], [.5, .2, -.1], [.5, .14, .08]], .025, steel));
    S.add(tube3([[-.2, .12, .3], [0, .2, .38], [.2, .13, .36]], .02, hose));
    // control tablet
    const tab = new THREE.Group(); tab.position.set(.1, 1.3, .1); tab.rotation.x = -.35; S.add(tab);
    tab.add(rbox(.42, .28, .03, .02, dark)); tab.add(pic(.38, .24, screenUI(['WATER PLANT', 'Melter    4 °C  ▮▮▮▮▯', 'Filters   OK', 'Tank      78 %', 'O₂ out    0.84 kg/sol'], { accent: '#7fd4e8' }), 0, 0, .017, true));
    S.add(cyl(.02, .02, .7, steel, .1, .95, .04, 8));
    WP.updateWorldMatrix(true, true);
  }

  // ---------- stowage wall: labelled drawers (like the ISS stowage racks) and a proper potable-water tank ----------
  const LK = groupOf('locker');
  if (LK) {
    hideOld(LK); const S = new THREE.Group(); LK.add(S);
    S.add(box(2.3, 2.62, .66, frame, 0, 1.31, -.02));
    const tags = ['TOOLS', 'SPARES', 'SEEDS', 'SAMPLES', 'FILTERS', 'MED KIT', 'BATTERIES', 'TAPE', 'CLOTHES', 'SNACKS', 'CABLES', 'SENSORS', 'GLOVES', 'SOAP', 'BAGS', 'LIGHTS', 'FASTENERS', 'SPARE BOOTS'];
    const tagCols = ['#d9683a', '#2d5fa8', '#2d8a4a', '#9b6cc9', '#f2c230', '#c23b2f'];
    const handle = mat('drawerHandle', '#2b2f33', { r: .4, m: .4 });
    for (let c = 0; c < 3; c++) for (let r = 0; r < 6; r++) {
      const k = r * 3 + c, x = -.74 + c * .74, y = .22 + r * .4, d = new THREE.Group(); d.position.set(x, y, .32); S.add(d);
      d.add(rbox(.7, .36, .04, .02, k % 7 === 3 ? mat('drawerBlue', '#c9d6e3', { r: .6 }) : white));
      d.add(box(.32, .035, .04, handle, 0, .1, .045));
      d.add(pic(.3, .085, label(tags[k], { w: 384, h: 108, bg: '#ffffff', fg: '#111', font: 'bold 38px monospace' }), -.13, -.06, .036));
      d.add(pic(.14, .07, tex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; let s2 = k * 13 + 7; for (let x2 = 6; x2 < w - 6; x2 += 3) { s2 = s2 * 1103515245 + 12345 & 0x7fffffff; if (s2 % 3) g.fillRect(x2, 6, s2 % 2 + 1, h - 18); } }), .2, -.06, .036));
      d.add(box(.04, .3, .01, mat('tag' + (k % 6), tagCols[k % 6], { r: .6 }), -.33, 0, .04));
    }
    S.add(box(2.34, .08, .7, mat('lkLight', '#fff4e0', { e: '#ffd9a0', ei: 1.2 }), 0, 2.68, -.02));
    // potable-water tank on saddles, with a sight tube, straps and a tap
    const T2 = new THREE.Group(); T2.position.set(1.55, 0, 0); S.add(T2);
    T2.add(cyl(.38, .38, 1.3, steel, 0, .78, 0, 32)); T2.add(new THREE.Mesh(new THREE.SphereGeometry(.38, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel).translateY(1.43));
    for (const y of [.35, 1.2]) T2.add(cyl(.39, .39, .05, mat('strap', '#3c4a5c', { r: .9 }), 0, y, 0, 32));
    for (const s of [-1, 1]) T2.add(box(.08, .14, .6, dark, s * .25, .07, 0));
    T2.add(cyl(.03, .03, 1.05, glass, .2, .8, .33, 10)); T2.add(cyl(.024, .024, .75, water, .2, .65, .33, 10));
    T2.add(pic(.42, .12, label('POTABLE H₂O · 120 L', { w: 512, h: 128, bg: '#2d5fa8', fg: '#fff', font: 'bold 44px system-ui' }), -.06, 1.0, .385));
    const tap = cyl(.025, .025, .14, steel, 0, .25, .44, 10); tap.rotation.x = Math.PI / 2; T2.add(tap); T2.add(box(.1, .025, .025, mat('valveBlue', '#2d5fa8', { r: .5 }), 0, .3, .5));
    LK.updateWorldMatrix(true, true);
  }

  // ---------- hazard monitor: a proper console with a bezel, side read-outs and a dosimeter shelf ----------
  const MN = groupOf('monitor');
  if (MN) {
    const screen = I.monitorScreen; hideOld(MN, screen ? [screen] : []); const S = new THREE.Group(); MN.add(S);
    S.add(rbox(2.3, 1.62, .14, .08, mat('bezel', '#1f2428', { r: .4, m: .3 }), 0, 2.0, .04));
    S.add(box(2.1, .06, .2, steel, 0, 1.1, .1));
    S.add(pic(.62, .4, screenUI(['RADIATION', 'Dose today  0.21 mSv', 'Mission     18 mSv', '!Storm watch  low'], { w: 384, h: 256, accent: '#ffb347' }), -1.55, 2.2, .085, true));
    S.add(pic(.62, .4, screenUI(['DUST · τ', 'Opacity  0.6', 'Panels   92 %', 'Wind     14 km/h'], { w: 384, h: 256, accent: '#e8b56a' }), 1.55, 2.2, .085, true));
    for (const x of [-1.55, 1.55]) S.add(rbox(.7, .48, .06, .04, mat('bezel', '#1f2428'), x, 2.2, .02));
    for (let i = 0; i < 6; i++) S.add(box(.05, .05, .02, mat('led' + (i % 3), ['#5dff9a', '#ffd27a', '#5dff9a'][i % 3], { e: ['#5dff9a', '#ffd27a', '#5dff9a'][i % 3], ei: 1.5 }), -.15 + i * .06, 1.24, .12));
    const kb = rbox(.6, .04, .2, .02, dark, -.3, 1.15, .14); S.add(kb); S.add(pic(.56, .17, tex(256, 80, (g, w, h) => { g.fillStyle = '#2b2f33'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a5157'; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) g.fillRect(4 + c * 18, 4 + r * 19, 15, 16); }), -.3, 1.175, .14).rotateX(-Math.PI / 2));
    for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.position.set(.35 + k * .14, 1.2, .12); b.add(rbox(.1, .14, .02, .02, mat('badge', ['#d9683a', '#2d5fa8', '#2d8a4a', '#9b6cc9'][k], { r: .6 }))); b.add(pic(.08, .05, label('DOSE', { w: 128, h: 80, bg: '#fff', fg: '#111', font: 'bold 34px monospace' }), 0, .02, .012)); S.add(b); }
    S.add(pic(.7, .08, label('DOSIMETERS · WEAR ON EVA', { w: 512, h: 64, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 28px system-ui' }), .55, 1.34, .02));
    if (screen) screen.position.z = .13;
    MN.updateWorldMatrix(true, true);
  }
}
// The treadmill (T2-style: a vibration-isolated deck, a harness with bungees that pulls you onto the belt) and the
// exercise bike, built properly in place of the old frame-of-sticks versions.
function buildTreadmill(TM) {
  const deck = mat('tmDeck', '#3a4046', { r: .5, m: .3 }), steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 }), belt = new THREE.MeshStandardMaterial({ roughness: .95, map: (() => { const t = tex(64, 256, (g, w, h) => { g.fillStyle = '#181a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#26292c'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3); }); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t; })() });
  TM.add(box(.9, .22, 1.9, deck, 0, .14, 0)); TM.add(box(.6, .02, 1.7, belt, 0, .26, 0));
  for (const x of [-.38, .38]) { TM.add(box(.12, .05, 1.8, mat('tmSide', '#c9ced3', { r: .5 }), x, .27, 0)); }
  for (const x of [-.4, .4]) for (const z of [-.85, .85]) TM.add(cyl(.06, .08, .06, mat('isoFoot', '#d9683a', { r: .7 }), x, .03, z, 12));
  // front uprights, console and hand loop
  for (const x of [-.36, .36]) TM.add(tube3([[x, .25, -.85], [x, .9, -.9], [x * .9, 1.25, -.82]], .025, steel));
  TM.add(tube3([[-.36, 1.25, -.8], [-.3, 1.3, -.6], [.3, 1.3, -.6], [.36, 1.25, -.8]], .02, steel));
  const con = new THREE.Group(); con.position.set(0, 1.32, -.86); con.rotation.x = -.5; TM.add(con);
  con.add(rbox(.5, .3, .05, .03, mat('pDark', '#2f353b'))); con.add(pic(.42, .22, screenUI(['T2 TREADMILL', '5.2 km/h   23:10', 'Load  70 % body', 'HR    132 bpm'], { w: 384, h: 220, accent: '#5dff9a' }), 0, 0, .028, true));
  // harness: two side columns with bungee cords down to the deck clips, and the waist-belt bar
  for (const x of [-.48, .48]) { TM.add(box(.06, 2.0, .06, steel, x, 1.2, .1)); TM.add(cyl(.05, .05, .08, mat('isoFoot', '#d9683a'), x, 2.22, .1, 12)); }
  TM.add(box(1.02, .06, .06, steel, 0, 2.2, .1));
  for (const x of [-.25, .25]) TM.add(tube3([[x * 1.8, 2.15, .1], [x * 1.2, 1.6, .1], [x, 1.05, .1]], .012, mat('bungee', '#2d5fa8', { r: .8 })));
  TM.add(rbox(.5, .12, .08, .04, mat('harnessPad', '#3c4a5c', { r: .9 }), 0, 1.02, .1));
  for (const x of [-.25, .25]) TM.add(tube3([[x, .98, .1], [x * 1.2, .6, .1], [x * 1.4, .28, .1]], .01, mat('bungee', '#2d5fa8')));
}
function buildBike(BK) {
  const frameM = mat('bikeFrame', '#d4d8d6', { r: .4, m: .5 }), dark = mat('pDark', '#2f353b'), steel = mat('pSteel', '#b8bec4', { m: .7, r: .32 });
  BK.add(rbox(.5, .06, 1.0, .03, dark, 0, .03, 0));
  BK.add(tube3([[0, .06, .35], [0, .45, .3], [0, .78, .28]], .03, frameM));          // seat post
  BK.add(tube3([[0, .06, -.35], [0, .5, -.32], [0, .95, -.36]], .03, frameM));       // bar post
  BK.add(tube3([[0, .35, .3], [0, .4, 0], [0, .42, -.3]], .028, frameM));            // top tube
  const fly = new THREE.Group(); fly.position.set(0, .34, -.12); BK.add(fly);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .12, 32), mat('shroud', '#d9683a', { r: .5 })); shroud.rotation.z = Math.PI / 2; fly.add(shroud);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .2, 16), steel); hub.rotation.z = Math.PI / 2; fly.add(hub);
  for (const s of [-1, 1]) { const crank = box(.025, .2, .03, steel, s * .11, -.08, 0); crank.rotation.x = s * .9; fly.add(crank); const pedal = box(.1, .025, .06, dark, s * .17, -.16 * Math.cos(.9) * s + 0, .14 * s); fly.add(pedal); }
  BK.add(rbox(.26, .07, .32, .04, mat('seat', '#1a1a1a', { r: .9 }), 0, .82, .3));
  BK.add(tube3([[-.25, .98, -.3], [-.2, 1.0, -.42], [0, .97, -.38], [.2, 1.0, -.42], [.25, .98, -.3]], .018, dark));
  const con = new THREE.Group(); con.position.set(0, 1.05, -.4); con.rotation.x = -.6; BK.add(con);
  con.add(rbox(.22, .14, .03, .02, dark)); con.add(pic(.19, .11, screenUI(['BIKE', '160 W', '72 rpm'], { w: 256, h: 150, accent: '#ffb347' }), 0, 0, .018, true));
}
