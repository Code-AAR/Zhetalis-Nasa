import {crouchHeld,updateCrouch,footSpeed} from './crouch.js';
// Inside the base greenhouse: a glass dome 14 m across, joined to the outpost by a pressurised tunnel.
// Four NFT hydroponic racks (a thin film of nutrient water runs down white channels; roots hang in it; no soil,
// because Mars soil has toxic perchlorate) under red-blue LED bars, like NASA's Veggie and the Prototype Lunar/Mars
// Greenhouse at the University of Arizona. Each rack is a farm plot from colony.js: plant, water, harvest.
// Round the edge: a germination shelf, a potting bench, the nutrient mixing tank, tomato and strawberry towers,
// circulation fans and a climate panel, plus the crew's own touches. Same shape of class as interior.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { regolithFinish } from './regolith-finish.js';
import { CROPS } from './colony.js';

const R = 7, SEG = 64;                         // dome radius (metres)
export const BEDS = [-3.6, -1.2, 1.2, 3.6];     // x position of each grow rack; they run along z from -2.5 to 2.5
const BED_LEN = 5, BED_W = 1.0;
const TUBE_START = 5, TUBE_END = 20;            // the tunnel to the hab (greenhouse coordinates)

const matCache = {};
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
const M = (key, color, extra = {}) => (matCache[key] ??= std(color, extra));
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
let seed = 7;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const pic = (w, h, t, glow = false) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshStandardMaterial({ map: t, roughness: .8 }));
function sign(text, { w = 512, h = 96, bg = '#26343d', fg = '#ecf2e7', font = 'bold 42px system-ui' } = {}) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
}
function label(lines, color = '#7dffb2') {     // the little e-ink tag on each rack
  return canvasTex(256, 112, (g) => {
    g.fillStyle = '#0b1a14'; g.fillRect(0, 0, 256, 112); g.strokeStyle = '#2c4a3d'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 108);
    g.fillStyle = color; g.font = 'bold 26px Poppins, sans-serif'; lines.forEach((l, i) => g.fillText(l, 14, 40 + i * 38));
  });
}
// A rounded-rectangle frame (outer minus inner), extruded. Used for hatch frames and tunnel ribs.
function roundRing(ow, oh, iw, ih, d, m, r = .3) {
  const rr = (x, y, w, h, rad, p) => { p.moveTo(x + rad, y); p.lineTo(x + w - rad, y); p.quadraticCurveTo(x + w, y, x + w, y + rad); p.lineTo(x + w, y + h - rad); p.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); p.lineTo(x + rad, y + h); p.quadraticCurveTo(x, y + h, x, y + h - rad); p.lineTo(x, y + rad); p.quadraticCurveTo(x, y, x + rad, y); };
  const s = new THREE.Shape(); rr(-ow / 2, -oh / 2, ow, oh, r, s); const hole = new THREE.Path(); rr(-iw / 2, -ih / 2, iw, ih, r * .8, hole); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, m);
}
function roundPanel(w, h, d, r, m) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: .01, bevelThickness: .01, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, m);
}
function tube(points, r, m, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), r, seg, false), m);
}
// Merge every mesh under a group into one mesh per material (fewer draw calls for the busy bits).
function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), byMat = new Map(), keep = [];
  group.traverse(o => {
    if (!o.isMesh || o.userData.live) { if (o.isMesh) keep.push(o); return; }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g);
  });
  const out = new THREE.Group(); out.position.copy(group.position); out.rotation.copy(group.rotation); out.scale.copy(group.scale);
  for (const [m, gs] of byMat) { const merged = mergeGeometries(gs, false); gs.forEach(g => g.dispose()); if (merged) out.add(new THREE.Mesh(merged, m)); }
  for (const o of keep) { const w = o.matrixWorld.clone(); o.removeFromParent(); o.matrix.multiplyMatrices(inv, w); o.matrix.decompose(o.position, o.quaternion, o.scale); out.add(o); }
  group.removeFromParent();   // the loose parts are now in the merged meshes
  return out;
}

// ---------- plant parts ----------
let leafGeo = null;
function leafGeometry() {   // a pointed oval leaf, cupped along the midrib and curling back at the tip
  if (leafGeo) return leafGeo;
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(.34, .16, .38, .72, 0, 1); sh.bezierCurveTo(-.38, .72, -.34, .16, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(x) * .5 - y * y * .3 + Math.sin(y * 9 + x * 6) * .025); }
  g.computeVertexNormals(); return (leafGeo = g);
}
let bladeGeo = null;
function bladeGeometry() {   // a grass blade: long and narrow, arching over
  if (bladeGeo) return bladeGeo;
  const g = new THREE.PlaneGeometry(.06, 1, 1, 6); g.translate(0, .5, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * .85)); p.setZ(i, y * y * .35); }
  g.computeVertexNormals(); return (bladeGeo = g);
}
const DS = THREE.DoubleSide;
const leafMat = c => M('leaf' + c, c, { roughness: .75, side: DS });
function place(geo, mat, pos, rot, scl, list) {   // push a transformed copy into a material bucket
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scl));
  const g = geo.clone().applyMatrix4(m); (list[mat.uuid] ??= { mat, geos: [] }).geos.push(g);
}

// What is growing on one rack. Two channels, nine net pots each. All plant parts are merged per material.
function growPlants(group, crop, grown, ready) {
  group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  group.clear();
  if (!crop) return;
  seed = crop.length * 97 + Math.round(grown * 20);
  const L = {}, s = .25 + grown * .75, sphere = new THREE.SphereGeometry(1, 10, 8), cylG = new THREE.CylinderGeometry(1, 1, 1, 6);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const x = row ? .22 : -.22, z = -2.2 + i * .55, y = .985, jitter = (rnd() - .5) * .1;
    if (crop === 'lettuce') {   // red romaine: an upright rosette, outer leaves red-bronze, the heart green
      const n = 9 + Math.floor(grown * 6);
      for (let k = 0; k < n; k++) {
        const a = k * 2.4 + jitter, inner = k / n, len = (.12 + (1 - inner) * .1) * s;
        const col = inner > .7 ? '#7fa64a' : k % 3 ? '#7a2f3a' : '#9a4a4f';
        place(leafGeometry(), leafMat(col), [x, y, z], [-(.25 + (1 - inner) * .75), a, (rnd() - .5) * .3], [len * .8, len * 1.6, len], L);
      }
    } else if (crop === 'wheat') {   // dwarf wheat: tufts of blades, then stalks with ears that go gold
      for (let k = 0; k < 7; k++) place(bladeGeometry(), leafMat(ready ? '#9a9a4a' : '#5f9e3f'), [x, y, z], [-.15 - rnd() * .35, k * .9 + jitter, 0], [1, (.25 + rnd() * .2) * s * 1.4, 1], L);
      if (grown > .35) for (let k = 0; k < 4; k++) {
        const ox = (k % 2 - .5) * .05, oz = (k > 1 ? .5 : -.5) * .05, h = .55 * s;
        place(cylG, leafMat(ready ? '#c9b25a' : '#79b04f'), [x + ox, y + h / 2, z + oz], [0, 0, (rnd() - .5) * .12], [.006, h, .006], L);
        if (grown > .6) place(sphere, leafMat(ready ? '#d9c26a' : '#a7c46a'), [x + ox, y + h + .04, z + oz], [0, 0, 0], [.018, .055, .018], L);
      }
    } else {   // potato: a bushy plant of compound leaves, white flowers when mature, tubers showing when ready
      for (let k = 0; k < 12; k++) {
        const a = k * 2.1 + jitter, tilt = .4 + (k % 3) * .3, len = (.08 + rnd() * .05) * s, h = (.05 + (k % 4) * .06) * s;
        place(leafGeometry(), leafMat(k % 2 ? '#4f8f3a' : '#3f7a30'), [x + Math.cos(a) * .03, y + h, z + Math.sin(a) * .03], [-tilt - .5, a, 0], [len, len * 1.3, len], L);
      }
      if (grown > .7) for (let k = 0; k < 3; k++) place(sphere, leafMat('#f4f1e6'), [x + (rnd() - .5) * .12, y + .26 * s, z + (rnd() - .5) * .12], [0, 0, 0], [.018, .012, .018], L);
      if (ready) for (let k = 0; k < 3; k++) place(sphere, leafMat('#b08850'), [x + (k - 1) * .05, y + .015, z + .09], [0, k, 0], [.04, .03, .032], L);
    }
  }
  for (const { mat, geos } of Object.values(L)) { const g = mergeGeometries(geos, false); geos.forEach(q => q.dispose()); group.add(new THREE.Mesh(g, mat)); }
  sphere.dispose(); cylG.dispose();
}

// ---------- the greenhouse ----------
export class Greenhouse {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
    this.scene.add(new THREE.HemisphereLight('#fff1e0', '#5a3a28', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.1); sun.position.set(6, 10, 4); this.scene.add(sun);
    this.blocks = [];     // axis-aligned furniture boxes you walk round: [x0, x1, z0, z1]
    this.rounds = [];     // round things: [x, z, radius]
    this.stations = [];
    this.spinners = [];   // fan blades

    // the dome: clear panels on a white space-frame (long ribs and rings)
    const glass = new THREE.MeshStandardMaterial({ color: '#73b6bd', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, side: DS, depthWrite: false });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, SEG, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass));
    const frame = std('#eceae4', { metalness: 0.3, roughness: 0.4 });
    const finishes = [regolithFinish(glass), regolithFinish(frame)]; this.setRegolith = n => finishes.forEach(f => f(n)); this.regolithMaterials = [glass, frame];
    for (let i = 0; i < 12; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 8, 48, Math.PI), frame); rib.rotation.y = i / 12 * Math.PI; this.scene.add(rib); }
    for (const a of [0.35, 0.7, 1.05, 1.3]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(R * Math.cos(a), 0.05, 8, SEG), frame); ring.rotation.x = Math.PI / 2; ring.position.y = R * Math.sin(a); this.scene.add(ring); }
    const crown = cyl(.55, .55, .12, frame, 24); crown.position.y = R - .06; this.scene.add(crown);   // the hub where the ribs meet
    // Cut the dome skin and its ribs where they meet the tunnel (+z) and the airlock (-x).
    for (const member of this.scene.children.filter(o => o.isMesh)) {
      member.updateMatrix();
      const geom = member.geometry, indices = geom.index, pos = geom.attributes.position;
      const keep = [], point = new THREE.Vector3(), center = new THREE.Vector3();
      for (let i = 0; i < indices.count; i += 3) {
        center.set(0, 0, 0);
        for (let j = 0; j < 3; j++) center.add(point.fromBufferAttribute(pos, indices.getX(i + j)).applyMatrix4(member.matrix));
        center.multiplyScalar(1 / 3);
        if (center.z > 5 && Math.abs(center.x) < 1.59 && center.y < 2.96) continue;
        keep.push(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
      }
      geom.setIndex(keep);
    }
    // low insulated base wall with a steel cap rail
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, SEG, 1, true, .23, Math.PI * 2 - .46), std('#d9d4cb', { side: DS })), 0, 0.3, 0));
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(R - .04, R - .04, .05, SEG, 1, true, .23, Math.PI * 2 - .46), std('#9aa1a7', { metalness: .5, roughness: .4, side: DS })), 0, .62, 0));

    this.furnishings = new THREE.Group(); this.scene.add(this.furnishings);
    this.buildFloor();
    this.beds = BEDS.map((x, i) => this.buildRack(x, i));
    this.buildIrrigation();
    this.buildMixingStation();
    this.buildAirlock();
    this.buildGermination();
    this.buildPottingBench();
    this.buildHarvestCorner();
    this.buildTomatoes();
    this.buildFrontOfHouse();
    this.buildTunnel();
    this.walkwayReady = Promise.resolve();
    this.enter('hab');
  }

  // floor: dark epoxy with a drain channel; steel grating walkways between the racks
  buildFloor() {
    const F = this.furnishings;
    const epoxy = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#5b6068'; g.fillRect(0, 0, w, h); seed = 3;
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${.03 + rnd() * .03})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(70,50,30,.05)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 10 + rnd() * 40, 0, 7); g.fill(); }   // water marks and soil smudges
    });
    epoxy.wrapS = epoxy.wrapT = THREE.RepeatWrapping; epoxy.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, SEG), new THREE.MeshStandardMaterial({ map: epoxy, roughness: .55, metalness: .05 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; F.add(floor);
    const grate = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#20252a'; g.fillRect(0, 0, w, h); g.fillStyle = '#9aa1a7';
      for (let k = 0; k < 8; k++) { g.fillRect(0, k * 16, w, 4); g.fillRect(k * 16, 0, 3, h); }
      g.fillStyle = 'rgba(255,255,255,.15)'; for (let k = 0; k < 8; k++) g.fillRect(0, k * 16, w, 1);
    });
    grate.wrapS = grate.wrapT = THREE.RepeatWrapping;
    const grateMat = (rx, rz) => { const t = grate.clone(); t.needsUpdate = true; t.repeat.set(rx, rz); return new THREE.MeshStandardMaterial({ map: t, roughness: .5, metalness: .6 }); };
    const edge = M('grateEdge', '#c9ced6', { metalness: .6, roughness: .35 });
    const walk = (w, d, x, z) => {
      F.add(at(box(w, .03, d, grateMat(w * 4, d * 4)), x, .025, z));
      for (const s of [-1, 1]) if (w < d) F.add(at(box(.04, .045, d, edge), x + s * w / 2, .03, z)); else F.add(at(box(w, .045, .04, edge), x, .03, z + s * d / 2));
    };
    for (const x of [-2.4, 0, 2.4]) walk(1.0, 6.2, x, 0);   // between the racks
    walk(9.4, 1.0, 0, 3.55); walk(9.4, 1.0, 0, -3.55);       // cross aisles at each end
    walk(1.2, 1.9, 0, 5.05);                                  // to the tunnel hatch
    // drain channel along the back aisle
    F.add(at(box(8.6, .012, .12, M('drain', '#16191c', { roughness: .9 })), 0, .016, -4.2));
    for (let k = 0; k < 20; k++) F.add(at(box(.02, .016, .12, edge), -4.1 + k * .43, .02, -4.2));
  }

  // One NFT rack: aluminium frame, two white channels with net pots, a reservoir and pump underneath, and an LED bar light.
  buildRack(x, i) {
    const g = new THREE.Group(); g.position.set(x, 0, 0); this.furnishings.add(g);
    const alu = M('alu', '#c9ced6', { metalness: .6, roughness: .32 }), dark = M('rackDark', '#2b2f33', { roughness: .6 }), white = M('pvc', '#f2f2f0', { roughness: .4 });
    const S = new THREE.Group(); g.add(S);   // static parts, merged later
    // frame: four legs per side with feet, two long rails, cross bars
    for (const z of [-2.3, -.77, .77, 2.3]) for (const sx of [-.45, .45]) {
      S.add(at(box(.045, .82, .045, alu), sx, .41, z)); S.add(at(box(.09, .02, .09, dark), sx, .01, z));
    }
    for (const sx of [-.45, .45]) { S.add(at(box(.045, .045, BED_LEN - .1, alu), sx, .84, 0)); S.add(at(box(.045, .045, BED_LEN - .1, alu), sx, .3, 0)); }
    for (const z of [-2.3, 0, 2.3]) S.add(at(box(.9, .045, .045, alu), 0, .84, z));
    // catch tray and the two NFT channels (sloped a little toward the return end, as real ones are)
    S.add(at(box(BED_W, .03, BED_LEN, M('tray', '#d9dcdf', { roughness: .45 })), 0, .875, 0));
    for (const cx of [-.22, .22]) {
      const ch = box(.13, .08, BED_LEN - .1, white); ch.position.set(cx, .93, 0); ch.rotation.x = .006; S.add(ch);
      S.add(at(box(.14, .09, .02, M('endCap', '#3a6fa8', { roughness: .5 })), cx, .93, -BED_LEN / 2 + .05));   // feed end caps
      for (let k = 0; k < 9; k++) {   // net pots: black cups in round holes, with rock-wool plugs
        const z = -2.2 + k * .55;
        S.add(at(cyl(.045, .035, .05, M('netPot', '#1c1f22', { roughness: .8 }), 12), cx, .955, z));
        S.add(at(box(.05, .03, .05, M('rockwool', '#d8cfb8', { roughness: 1 })), cx, .975, z));
      }
    }
    // feed line along the top of the channels and the return drain pipe
    const feed = cyl(.012, .012, BED_LEN - .2, M('feedLine', '#1c1f22', { roughness: .6 }), 8); feed.rotation.x = Math.PI / 2; S.add(at(feed, 0, .985, 0));
    for (const cx of [-.22, .22]) S.add(at(cyl(.008, .008, .08, M('feedLine', '#1c1f22'), 6), cx * .5, .96, -2.35));
    const ret = cyl(.035, .035, BED_LEN - .2, M('returnPipe', '#e8e8e4', { roughness: .4 }), 12); ret.rotation.x = Math.PI / 2; S.add(at(ret, .5, .78, 0));
    // reservoir: a dark tote with a lid, label and pump on top
    S.add(at(box(.72, .42, 1.3, M('tote', '#3c4a5c', { roughness: .55 })), 0, .23, -1.3));
    S.add(at(box(.76, .04, 1.34, M('toteLid', '#2b3644', { roughness: .5 })), 0, .46, -1.3));
    S.add(at(box(.16, .1, .12, M('pump', '#2b2f33', { roughness: .4, metalness: .3 })), .2, .53, -1.7));
    S.add(tube([[.2, .58, -1.7], [.2, .75, -1.95], [0, .97, -2.35]], .012, M('feedLine', '#1c1f22'), 6));
    const tl = pic(.36, .12, sign(`NUTRIENT · RACK ${i + 1}`, { w: 384, h: 128, bg: '#f2f0ea', fg: '#1d2a33', font: 'bold 40px system-ui' })); tl.position.set(0, .3, -.645); tl.rotation.y = Math.PI; S.add(tl);
    // LED fixture: a frame with five bars hung from two posts (bars glow magenta when the lights are on)
    for (const z of [-2.3, 2.3]) S.add(at(box(.05, 1.6, .05, alu), 0, 1.66, z));
    S.add(at(box(.62, .04, BED_LEN - .2, M('ledFrame', '#23272b', { roughness: .45, metalness: .4 })), 0, 2.44, 0));
    S.add(at(box(.18, .07, .3, M('driver', '#3a3f45', { roughness: .4, metalness: .4 })), 0, 2.5, 0));   // driver box
    g.add(bake(S));
    const ledMat = new THREE.MeshBasicMaterial({ color: '#5a4a60' });
    const leds = new THREE.Group(); for (let k = 0; k < 5; k++) leds.add(at(box(.07, .025, BED_LEN - .35, ledMat), -.24 + k * .12, 2.41, 0)); g.add(leds);
    const light = new THREE.PointLight('#e070ff', 0, 5, 1.6); light.position.set(0, 2.2, 0); g.add(light);
    // water level sight-glass on a bracket at the front
    const tubeMesh = cyl(.05, .05, .6, new THREE.MeshStandardMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.85, roughness: .2 }), 16);
    g.add(at(tubeMesh, -.36, 0.3, BED_LEN / 2 + 0.12));
    g.add(at(cyl(.065, .065, .62, new THREE.MeshStandardMaterial({ color: '#e8f2f0', transparent: true, opacity: .25, roughness: .1, depthWrite: false }), 16), -.36, .31, BED_LEN / 2 + .12));
    for (const y of [0, .62]) g.add(at(cyl(.072, .072, .03, alu, 16), -.36, y + .01, BED_LEN / 2 + .12));
    // e-ink tag on a little stand
    g.add(at(box(.03, .3, .03, alu), 0, .99, BED_LEN / 2 + .03));
    const tagBack = at(box(.94, .4, .02, dark), 0, 1.2, BED_LEN / 2 + .03); g.add(tagBack);
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshBasicMaterial()); g.add(at(signMesh, 0, 1.2, BED_LEN / 2 + 0.045));
    const plants = new THREE.Group(); g.add(plants);
    this.stations.push({ type: 'gh-bed', bed: i, label: `tend grow bed ${i + 1}`, x, z: BED_LEN / 2 + 0.8 });
    return { group: g, led: { material: ledMat }, light, tube: tubeMesh, sign: signMesh, plants, key: '' };
  }

  // the main water line from the mixing tank, up and across over the racks, with a drop to each feed end
  buildIrrigation() {
    const S = new THREE.Group(), blue = M('waterPipe', '#3b7bd8', { roughness: .4, metalness: .2 }), green = M('nutrientPipe', '#3f9a5a', { roughness: .4, metalness: .2 }), clamp = M('clamp', '#9aa1a7', { metalness: .6, roughness: .35 });
    const run = (pts, m, r = .03) => S.add(tube(pts, r, m, 10));
    run([[-4.1, 1.7, -4.1], [-4.1, 2.95, -3.2], [-3.6, 2.95, -3.1], [4.0, 2.95, -3.1]], blue);
    run([[-4.25, 1.7, -4.0], [-4.25, 2.85, -3.25], [-3.6, 2.85, -3.25], [4.0, 2.85, -3.25]], green, .022);
    for (const x of BEDS) { run([[x, 2.95, -3.1], [x, 2.7, -2.9], [x, 1.1, -2.65], [x, .99, -2.4]], blue, .018); S.add(at(cyl(.035, .035, .06, M('valveRed', '#c23b2f', { roughness: .4 }), 12), x, 2.6, -2.86)); }
    for (let k = 0; k < 9; k++) S.add(at(box(.04, .12, .12, clamp), -3.6 + k * .95, 2.97, -3.17));
    this.furnishings.add(bake(S));
  }

  // nutrient mixing station where the tap is: a clear tank with level marks, dosing pumps, pH/EC readout and a hose reel
  buildMixingStation() {
    const tap = new THREE.Group(); tap.position.set(-4.4, 0, -4.4); tap.lookAt(0, 0, 0); this.furnishings.add(tap);
    const S = new THREE.Group(); tap.add(S);
    S.add(at(cyl(.56, .56, .08, M('tankBase', '#5b6268', { roughness: .5 }), 32), 0, .04, 0));
    const water = cyl(.5, .5, 1.25, new THREE.MeshStandardMaterial({ color: '#7fc3ff', transparent: true, opacity: 0.55, roughness: 0.15 }), 32); water.userData.live = true; S.add(at(water, 0, .72, 0));
    const shell = cyl(.53, .53, 1.55, new THREE.MeshStandardMaterial({ color: '#e8f2f0', transparent: true, opacity: .22, roughness: .08, depthWrite: false }), 32); shell.userData.live = true; S.add(at(shell, 0, .85, 0));
    for (const y of [.1, 1.62]) S.add(at(cyl(.56, .56, .06, M('alu', '#c9ced6'), 32), 0, y, 0));
    for (let k = 1; k < 6; k++) S.add(at(box(.08, .008, .01, M('mark', '#1d2a33')), 0, .1 + k * .25, .535));
    // dosing pumps on a back board
    S.add(at(box(.7, .5, .04, M('board', '#e8e5de', { roughness: .6 })), 0, 1.95, -.45));
    ['A', 'B', 'pH'].forEach((n, k) => { S.add(at(box(.15, .18, .1, M('doser', '#2b2f33', { roughness: .4 })), -.22 + k * .22, 1.95, -.38)); S.add(at(cyl(.035, .035, .02, M('doseHead', ['#3f9a5a', '#d9b44a', '#c23b2f'][k], { roughness: .4 }), 12).rotateX(Math.PI / 2), -.22 + k * .22, 1.98, -.32)); });
    const read = pic(.5, .2, canvasTex(384, 154, (g, w, h) => { g.fillStyle = '#0a1c24'; g.fillRect(0, 0, w, h); g.fillStyle = '#9ce6d0'; g.font = 'bold 34px monospace'; g.fillText('pH  5.8', 18, 52); g.fillText('EC  1.6 mS', 18, 98); g.fillStyle = '#8aa8af'; g.font = '22px monospace'; g.fillText('MIX OK · 21 °C', 18, 136); }), true);
    read.position.set(0, 2.33, -.42); S.add(read);
    // hose reel on the side and a blue tap
    const reel = new THREE.Group(); reel.position.set(.7, .6, -.1); reel.rotation.y = Math.PI / 2; S.add(reel);
    for (const z of [-.12, .12]) reel.add(at(new THREE.Mesh(new THREE.TorusGeometry(.22, .02, 8, 24), M('reel', '#d9683a', { roughness: .5 })), 0, 0, z));
    reel.add(cyl(.17, .17, .22, M('hose', '#2f7a3a', { roughness: .7 }), 20).rotateX(Math.PI / 2));
    S.add(at(cyl(.03, .03, .3, M('waterPipe', '#3b7bd8'), 10).rotateX(Math.PI / 2), .25, .45, .62));
    S.add(at(cyl(.06, .06, .03, M('valveBlue', '#2d5fa8', { roughness: .4 }), 12), .25, .52, .7));
    tap.add(bake(S));
    const t = pic(1.0, .3, label(['WATER + NUTRIENTS', 'jug tap · mixed daily'], '#9fe7ff'), true); t.position.set(0, 1.35, .56); tap.add(t);
    this.stations.push({ type: 'gh-tap', label: 'fill your water jug at the tap', x: -3.6, z: -3.6 });
  }

  // the outside airlock: a deep rounded frame, a closed hatch with window and handle, a dust mat and suit hooks
  buildAirlock() {
    const lock = new THREE.Group(); lock.position.set(-(R - 0.3), 0, 0); lock.rotation.y = Math.PI / 2; this.scene.add(lock);
    const S = new THREE.Group(); lock.add(S);
    const frameM = M('hatchFrame', '#cfd3d2', { roughness: .5, metalness: .25 }), doorM = M('hatchDoor', '#9aa7ab', { roughness: .45, metalness: .35 }), seal = M('seal', '#2b2f33', { roughness: .9 });
    S.add(at(box(2.6, 3.0, .2, M('lockWall', '#d9d4cb', { roughness: .8 })), 0, 1.5, -.15));
    S.add(at(roundRing(2.2, 2.7, 1.6, 2.2, .3, frameM), 0, 1.38, 0));
    S.add(at(roundRing(1.66, 2.26, 1.5, 2.1, .32, seal), 0, 1.38, 0));
    S.add(at(roundPanel(1.5, 2.1, .08, .22, doorM), 0, 1.38, .04));
    S.add(at(cyl(.17, .17, .06, M('steel', '#bac7c9', { metalness: .7, roughness: .3 }), 32).rotateX(Math.PI / 2), 0, 1.95, .1));
    const win = new THREE.Mesh(new THREE.CircleGeometry(.14, 32), M('portGlass', '#123f4d', { roughness: .16, metalness: .65 })); win.position.set(0, 1.95, .135); S.add(win);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.16, .02, 8, 28), M('steel', '#bac7c9')); wheel.position.set(0, 1.2, .14); S.add(wheel);
    for (let k = 0; k < 3; k++) { const sp = box(.32, .02, .02, M('steel', '#bac7c9')); sp.rotation.z = k * Math.PI / 3; sp.position.set(0, 1.2, .14); S.add(sp); }
    S.add(at(box(1.9, .06, .1, new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 2.8, .1));
    const st = pic(1.1, .24, sign('AIRLOCK · TO SURFACE', { w: 640, h: 140, bg: '#162c34', fg: '#e9f4ef', font: 'bold 54px system-ui' }), true); st.position.set(0, 2.55, .18); S.add(st);
    // hazard stripes on the floor in front and a boot brush
    S.add(at(box(1.8, .01, .9, M('dustMat', '#2c2f33', { roughness: 1 })), 0, .02, .6));
    for (let k = 0; k < 9; k++) S.add(at(box(.1, .012, .9, M('hazard', k % 2 ? '#1d1d1d' : '#f2c230', { roughness: .8 })), -.8 + k * .2, .026, 1.1).rotateY(0));
    // hooks with a sun hat and a rag beside the door
    for (const x of [-1.15, 1.15]) S.add(at(cyl(.015, .015, .1, M('steel', '#bac7c9'), 8).rotateX(Math.PI / 2), x, 1.7, .02));
    S.add(at(box(.3, .45, .02, M('rag', '#d9683a', { roughness: 1 })), 1.15, 1.45, .04));
    lock.add(bake(S));
    this.blocks.push([-R, -5.9, -1.3, 1.3]);
    this.stations.push({ type: 'gh-out', label: 'go outside through the airlock', x: -(R - 1.4), z: 0 });
  }

  // germination shelf at the back: wire racks of seed trays, a humidity dome and strip lights under each shelf
  buildGermination() {
    const G = new THREE.Group(); G.position.set(0, 0, -5.55); this.furnishings.add(G);
    const S = new THREE.Group(); G.add(S);
    const chrome = M('chrome', '#d4d8d6', { metalness: .75, roughness: .25 }), trayM = M('seedTray', '#1c1f22', { roughness: .7 }), soil = M('plug', '#5a3f2e', { roughness: 1 }), sprout = leafMat('#8cc152');
    for (const x of [-.9, .9]) for (const z of [-.22, .22]) S.add(at(cyl(.012, .012, 1.8, chrome, 8), x, .9, z));
    const tiers = [.25, .8, 1.35];
    for (const y of tiers) {
      for (let k = 0; k < 6; k++) S.add(at(box(1.82, .008, .008, chrome), 0, y, -.22 + k * .088));
      S.add(at(box(1.82, .02, .02, chrome), 0, y, -.22)); S.add(at(box(1.82, .02, .02, chrome), 0, y, .22));
      S.add(at(box(1.6, .015, .06, new THREE.MeshBasicMaterial({ color: '#f4f1ff' })), 0, y + .5, 0));   // grow strip
      for (const tx of [-.45, .45]) {
        S.add(at(box(.82, .05, .4, trayM), tx, y + .03, 0));
        seed = Math.round(y * 100 + tx * 10);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
          const px = tx - .35 + c * .1, pz = -.15 + r * .1;
          S.add(at(box(.07, .01, .07, soil), px, y + .058, pz));
          const big = y < 1 ? .55 + rnd() * .45 : .25 + rnd() * .3;
          if (rnd() < .9) for (const s2 of [-1, 1]) { const L = new THREE.Mesh(leafGeometry(), sprout); L.scale.setScalar(.06 * big); L.position.set(px, y + .065 + .025 * big, pz); S.add(at(cyl(.003, .003, .025 * big + .01, sprout, 4), px, y + .065 + .012 * big, pz)); L.rotation.set(-1.1, s2 * 1.57 + rnd() * .3, 0, 'YXZ'); S.add(L); }
        }
      }
    }
    const dome = roundPanel(.84, .42, .14, .04, new THREE.MeshStandardMaterial({ color: '#e8f2f0', transparent: true, opacity: .3, roughness: .1, depthWrite: false })); dome.rotation.x = Math.PI / 2; dome.position.set(.45, 1.47, 0); dome.userData.live = true; S.add(dome);
    G.add(bake(S));
    const tag = pic(.6, .14, sign('GERMINATION · DAY 4', { w: 512, h: 120, bg: '#f2f0ea', fg: '#2d5a2a', font: 'bold 50px system-ui' })); tag.position.set(0, 1.95, .23); G.add(tag);
    this.blocks.push([-1.0, 1.0, -5.85, -5.25]);
    this.note(0, -4.6, 'check the seed trays', '🌱 Germination shelf', '<p>Every crop starts here: seeds in small plugs under a clear lid to keep them damp. After a week or two the strongest seedlings move into the grow racks.</p>', 'NASA\'s Veggie garden on the ISS grows plants from "plant pillows": seeds in a small bag of clay and fertiliser.');
  }

  // potting bench on the east side, with the crew's own bits on it
  buildPottingBench() {
    const B = new THREE.Group(); B.position.set(5.55, 0, 0); B.rotation.y = -Math.PI / 2; this.furnishings.add(B);
    const S = new THREE.Group(); B.add(S);
    const ply = M('ply', '#c49a6c', { roughness: .8 }), steel = M('benchSteel', '#7c8388', { metalness: .5, roughness: .4 });
    S.add(at(box(2.0, .05, .7, ply), 0, .88, 0)); S.add(at(box(2.0, .03, .6, ply), 0, .25, 0)); S.add(at(box(2.0, .5, .03, ply), 0, 1.15, -.34));
    for (const x of [-.95, .95]) for (const z of [-.3, .3]) S.add(at(box(.05, .88, .05, steel), x, .44, z));
    // bags of coco coir and perlite on the low shelf
    const bag = (txt, col, x) => { S.add(at(box(.5, .3, .4, M('bag' + col, col, { roughness: .9 })), x, .41, 0)); const t = pic(.36, .12, sign(txt, { w: 384, h: 128, bg: col, fg: '#fff', font: 'bold 44px system-ui' })); t.position.set(x, .43, .205); S.add(t); };
    bag('COCO COIR', '#6b4a2e', -.6); bag('PERLITE', '#c9ced6', 0);
    // stacked terracotta pots, a trowel, a watering can and gloves
    for (let k = 0; k < 4; k++) S.add(at(cyl(.1, .075, .12, M('terracotta', '#b5653d', { roughness: .8 }), 20), .7, .97 + k * .05, 0));
    const can = new THREE.Group(); can.position.set(-.55, .91, .05); S.add(can);
    can.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.11, 0], [.12, .04], [.12, .2], [.1, .23], [0, .23]].map(([x, y]) => new THREE.Vector2(x, y)), 20), M('canGreen', '#3f7a52', { roughness: .45, metalness: .2 })));
    can.add(tube([[.1, .05, 0], [.22, .18, 0], [.3, .3, 0]], .015, M('canGreen', '#3f7a52'), 8));
    can.add(at(cyl(.035, .025, .03, M('canGreen', '#3f7a52'), 10), .31, .31, 0).rotateZ(-.8));
    can.add(tube([[-.08, .22, 0], [0, .33, 0], [.08, .22, 0]], .012, M('canGreen', '#3f7a52'), 6));
    const trowel = new THREE.Group(); trowel.position.set(.25, .92, .18); trowel.rotation.y = .5; S.add(trowel);
    trowel.add(at(box(.07, .008, .12, M('steelBright', '#c9ced6', { metalness: .8, roughness: .3 })), 0, 0, -.08)); trowel.add(at(cyl(.015, .015, .12, M('handle', '#c23b2f', { roughness: .6 }), 8).rotateX(Math.PI / 2), 0, 0, .05));
    S.add(at(box(.12, .02, .2, M('glove', '#e0b04a', { roughness: 1 })), .45, .915, .2).rotateY(.4)); S.add(at(box(.12, .02, .2, M('glove', '#e0b04a')), .52, .925, .14).rotateY(-.2));
    // Mei Lin's orchid, Mateo's chillies, a mug and the harvest log on a clipboard
    const pot = (x, z, c) => { S.add(at(cyl(.08, .06, .11, M('pot' + c, c, { roughness: .6 }), 16), x, .96, z)); S.add(at(cyl(.07, .07, .01, M('soil', '#3b2a1f', { roughness: 1 }), 16), x, 1.01, z)); };
    pot(-.15, -.15, '#e8f2f0');
    for (let k = 0; k < 4; k++) { const L = new THREE.Mesh(leafGeometry(), leafMat('#3f7a30')); L.scale.set(.09, .16, .09); L.position.set(-.15, 1.02, -.15); L.rotation.set(-1.25, k * 1.6, 0, 'YXZ'); S.add(L); }
    S.add(tube([[-.15, 1.02, -.15], [-.13, 1.25, -.17], [-.05, 1.36, -.1], [.03, 1.32, -.05]], .005, leafMat('#5a6a3a'), 6));
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(.03, 5), leafMat(k % 2 ? '#f2d7e8' : '#e9b8d6')); f.position.set(-.1 + k * .04, 1.34 - Math.abs(k - 1.5) * .02, -.12 + k * .02); f.rotation.y = -.6; S.add(f); }
    pot(.2, -.2, '#b5653d');
    for (let k = 0; k < 8; k++) { const L = new THREE.Mesh(leafGeometry(), leafMat('#4f8f3a')); L.scale.setScalar(.06); L.position.set(.2, 1.03 + (k % 3) * .04, -.2); L.rotation.set(-.9, k * .8, 0, 'YXZ'); S.add(L); }
    for (let k = 0; k < 5; k++) { const c = cyl(.008, .004, .05, M('chilli', '#d4261c', { roughness: .4 }), 6); c.position.set(.2 + Math.cos(k * 1.3) * .06, 1.06 + (k % 2) * .03, -.2 + Math.sin(k * 1.3) * .06); c.rotation.z = .4; S.add(c); }
    const mug = new THREE.Group(); mug.position.set(-.85, .905, .18); S.add(mug);
    mug.add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .036, .09, 16, 1, true), M('mugMLT', '#2fa39a', { roughness: .3, side: DS })).translateY(.045));
    mug.add(at(cyl(.036, .036, .005, M('coffee', '#3b2414', { roughness: .2 }), 16), 0, .075, 0));
    mug.add(at(new THREE.Mesh(new THREE.TorusGeometry(.022, .006, 8, 16, Math.PI), M('mugMLT', '#2fa39a')), .04, .045, 0).rotateZ(-Math.PI / 2));
    B.add(bake(S));
    const tagO = pic(.16, .05, sign("Mei Lin's orchid", { w: 320, h: 100, bg: '#fff', fg: '#333', font: 'italic 34px Georgia, serif' })); tagO.position.set(-.15, .935, .09); tagO.rotation.x = -.5; B.add(tagO);
    const tagC = pic(.2, .06, sign("MATEO'S CHILLIES · HOT!", { w: 384, h: 100, bg: '#fff38a', fg: '#c23b2f', font: 'bold 32px system-ui' })); tagC.position.set(.2, .935, .03); tagC.rotation.x = -.5; B.add(tagC);
    const log = pic(.36, .48, canvasTex(288, 384, (g, w, h) => {
      g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#7c5a3a'; g.fillRect(0, 0, w, 26); g.fillStyle = '#c9ced6'; g.fillRect(w / 2 - 40, 4, 80, 18);
      g.fillStyle = '#1d2a33'; g.font = 'bold 24px system-ui'; g.fillText('HARVEST LOG', 18, 60);
      g.font = '19px "Comic Sans MS", cursive'; [['sol 9', 'lettuce 1.2 kg'], ['sol 12', 'radish 0.4 kg'], ['sol 15', 'lettuce 1.4 kg'], ['sol 19', 'basil (lots!)'], ['sol 22', 'first potatoes!']].forEach(([a, b], i) => { g.fillStyle = i === 4 ? '#c23b2f' : '#2d5fa8'; g.fillText(`${a}: ${b}`, 18, 104 + i * 40); });
      g.strokeStyle = '#c23b2f'; g.lineWidth = 3; g.beginPath(); g.ellipse(140, 262, 120, 22, 0, 0, 7); g.stroke();
      g.fillStyle = '#555'; g.font = 'italic 17px "Comic Sans MS", cursive'; g.fillText('Bed 3 drips. Tell Mateo.', 18, 340);
    })); log.position.set(.0, 1.25, -.318); B.add(log);
    const tool = pic(.5, .14, sign('POTTING BENCH', { w: 512, h: 140, bg: '#3a2414', fg: '#f7e2b8', font: 'bold 60px Georgia, serif' })); tool.position.set(-.6, 1.32, -.317); B.add(tool);
    this.blocks.push([5.2, 5.95, -1.05, 1.05]);
    this.note(4.6, 0, 'look at the potting bench', '🪴 Potting bench', '<p>Coco coir, pots, a trowel and the harvest log. Mei Lin keeps an orchid here, and Mateo grows chillies that nobody else will eat.</p>', 'Astronauts say that caring for plants is one of the best ways to feel at home far from Earth.');
  }

  // harvest corner at the back right: crates of fresh food and the scale
  buildHarvestCorner() {
    const H = new THREE.Group(); H.position.set(3.1, 0, -4.9); H.rotation.y = -.55; this.furnishings.add(H);
    const S = new THREE.Group(); H.add(S);
    const crate = (x, y, col) => {
      const m = M('crate' + col, col, { roughness: .6 });
      S.add(at(box(.6, .03, .4, m), x, y + .015, 0));
      for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) { S.add(at(box(.6, .05, .02, m), x, y + .06 + k * .08, s * .19)); S.add(at(box(.02, .05, .4, m), x + s * .29, y + .06 + k * .08, 0)); } }
    };
    crate(0, 0, '#3b7bd8'); crate(0, .26, '#3b7bd8'); crate(.68, 0, '#2d8a4a');
    seed = 11;
    for (let k = 0; k < 6; k++) { const hx = -.2 + (k % 3) * .2, hz = k < 3 ? -.08 : .1; for (let j = 0; j < 7; j++) { const L = new THREE.Mesh(leafGeometry(), leafMat(j % 2 ? '#7a2f3a' : '#8a9a4a')); L.scale.setScalar(.09); L.position.set(hx, .3, hz); L.rotation.set(-.6, j * .9, 0, 'YXZ'); S.add(L); } }
    for (let k = 0; k < 14; k++) S.add(at(new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), M('potato', '#b08850', { roughness: .9 })), .68 + (rnd() - .5) * .45, .07 + rnd() * .06, (rnd() - .5) * .28).rotateY(k));
    // digital scale on a stool
    S.add(at(cyl(.18, .18, .03, M('stool', '#3d5a80', { roughness: .8 }), 18), -.75, .55, 0)); S.add(at(cyl(.02, .02, .54, M('benchSteel', '#7c8388'), 8), -.75, .27, 0)); S.add(at(cyl(.15, .15, .02, M('benchSteel', '#7c8388'), 18), -.75, .01, 0));
    S.add(at(box(.26, .04, .22, M('scale', '#e8e5de', { roughness: .4 })), -.75, .585, 0));
    H.add(bake(S));
    const disp = pic(.1, .035, sign('1.24 kg', { w: 256, h: 90, bg: '#0a1c24', fg: '#9ce6d0', font: 'bold 60px monospace' }), true); disp.position.set(-.75, .608, .1); disp.rotation.x = -1.2; H.add(disp);
    this.rounds.push([3.1, -4.9, .9]);
    this.note(2.9, -4.1, 'look at the harvest crates', '🥬 Fresh food', '<p>Lettuce and the first potatoes, weighed and logged before they go to the galley. Fresh food tastes better and keeps the crew healthier than months of packets.</p>', 'NASA\'s Biomass Production Chamber grew wheat, potatoes, soybeans and lettuce for years to learn how a Mars base could feed itself.');
  }

  // tomatoes in grow bags up strings on the west wall, either side of the airlock
  buildTomatoes() {
    for (const z0 of [-2.6, 2.6]) {
      const T = new THREE.Group(); T.position.set(-5.55, 0, z0); T.rotation.y = Math.PI / 2; this.furnishings.add(T);
      const S = new THREE.Group(); T.add(S);
      S.add(at(box(1.5, .18, .4, M('growBag', '#e8e8e4', { roughness: .8 })), 0, .09, 0));
      S.add(at(box(1.6, .05, .05, M('alu', '#c9ced6')), 0, 2.2, 0)); for (const x of [-.78, .78]) S.add(at(box(.05, 2.2, .05, M('alu', '#c9ced6')), x, 1.1, 0));
      seed = Math.round(z0 * 10 + 50);
      for (let p = 0; p < 3; p++) {
        const x = -.5 + p * .5;
        S.add(at(cyl(.003, .003, 2.0, M('string', '#d9cbb0', { roughness: 1 }), 4), x, 1.2, 0));
        const pts = []; for (let k = 0; k <= 8; k++) pts.push([x + Math.sin(k * 1.3 + p) * .05, .18 + k * .23, Math.cos(k * 1.1) * .05]);
        S.add(tube(pts, .012, leafMat('#4f7f30'), 6));
        for (let k = 1; k < 9; k++) {
          const [px, py, pz] = pts[k];
          for (const s2 of [-1, 1]) { const L = new THREE.Mesh(leafGeometry(), leafMat(k % 2 ? '#3f7a30' : '#4f8f3a')); L.scale.set(.17, .24, .17); L.position.set(px, py, pz); L.rotation.set(-1.0 - rnd() * .4, s2 * 1.5 + rnd() * .6, 0, 'YXZ'); S.add(L); }
          if (k % 2 === 0 && k < 8) for (let f = 0; f < 3; f++) S.add(at(new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), M(f + k > 6 ? 'tomRed' : 'tomGreen', f + k > 6 ? '#d4361c' : '#7fa64a', { roughness: .3 })), px + .08 + f * .03, py - .06 - f * .03, pz + .05));
        }
      }
      T.add(bake(S));
      this.blocks.push([-6.1, -5.25, z0 - .85, z0 + .85]);
    }
    this.note(-4.8, -2.6, 'look at the tomatoes', '🍅 Tomatoes', '<p>Dwarf tomatoes climbing strings. Each flower has to be pollinated by hand with a small brush: there are no bees on Mars.</p>', 'ISS astronauts grew Red Robin dwarf tomatoes in the Veggie garden in 2023.');
  }

  // by the tunnel: strawberry towers, the climate panel, circulation fans and a note on the post
  buildFrontOfHouse() {
    const F = this.furnishings;
    for (const x of [-2.75, 2.75]) {   // strawberry towers: stacked pots with plants spilling out
      const T = new THREE.Group(); T.position.set(x, 0, 4.7); F.add(T); const S = new THREE.Group(); T.add(S); seed = Math.round(x * 10 + 99);
      S.add(at(cyl(.3, .32, .06, M('towerBase', '#5b6268', { roughness: .5 }), 20), 0, .03, 0));
      for (let k = 0; k < 5; k++) {
        const y = .1 + k * .3; S.add(at(cyl(.22, .16, .26, M('towerPot', '#e8e5de', { roughness: .5 }), 6).rotateY(k * .5), 0, y + .13, 0));
        for (let j = 0; j < 3; j++) {
          const a = j * 2.09 + k * .5, px = Math.cos(a) * .2, pz = Math.sin(a) * .2;
          for (let l = 0; l < 3; l++) { const L = new THREE.Mesh(leafGeometry(), leafMat('#4f8f3a')); L.scale.setScalar(.08); L.position.set(px, y + .22, pz); L.rotation.set(-.9, -a + Math.PI / 2 + (l - 1) * .6, 0, 'YXZ'); S.add(L); }
          if (rnd() < .7) S.add(at(new THREE.Mesh(new THREE.ConeGeometry(.025, .05, 8), M(rnd() < .7 ? 'berry' : 'berryW', rnd() < .7 ? '#d4261c' : '#f2f0ea', { roughness: .4 })), px * 1.25, y + .15, pz * 1.25).rotateX(Math.PI));
        }
      }
      T.add(bake(S)); this.rounds.push([x, 4.7, .45]);
    }
    // climate panel on a post right of the tunnel hatch
    const P = new THREE.Group(); P.position.set(1.75, 0, 5.75); P.rotation.y = Math.PI + .5; F.add(P);
    P.add(at(box(.08, 1.6, .08, M('alu', '#c9ced6')), 0, .8, 0)); P.add(at(box(.62, .44, .06, M('rackDark', '#2b2f33')), 0, 1.55, .05));
    const env = pic(.56, .38, canvasTex(448, 304, (g, w, h) => {
      g.fillStyle = '#0a1c24'; g.fillRect(0, 0, w, h); g.fillStyle = '#7dffb2'; g.font = 'bold 26px system-ui'; g.fillText('GREENHOUSE CLIMATE', 18, 38);
      [['AIR', '22.4 °C'], ['HUMIDITY', '68 %'], ['CO₂', '1 200 ppm'], ['LIGHT', '16 h on · 8 h off']].forEach(([a, b], i) => { g.fillStyle = '#8aa8af'; g.font = '22px monospace'; g.fillText(a, 18, 90 + i * 52); g.fillStyle = '#e9f4ef'; g.font = 'bold 28px monospace'; g.fillText(b, 170, 90 + i * 52); });
    }), true); env.position.set(0, 1.55, .085); P.add(env);
    const note = pic(.12, .12, canvasTex(128, 128, (g) => { g.fillStyle = '#fff38a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#333'; g.font = '20px "Comic Sans MS", cursive'; ["Don't", 'overwater', 'bed 3!', '  - F'].forEach((t, i) => g.fillText(t, 10, 30 + i * 26)); }));
    note.position.set(.36, 1.32, .09); note.rotation.z = -.12; P.add(note);
    this.rounds.push([1.75, 5.75, .3]);
    this.note(1.6, 5.0, 'read the climate panel', '🌡 Greenhouse climate', '<p>Warm, damp air with extra carbon dioxide, and lights on for 16 hours a sol. Plants breathe in CO₂ and give out oxygen, so the greenhouse helps the hab\'s air too.</p>', 'NASA growth chambers raise CO₂ to about 1 000-1 200 ppm, around three times Earth\'s air, so plants grow faster.');
    // two circulation fans on stands
    for (const [x, z, a] of [[-4.9, 4.0, 2.4], [4.9, 3.6, -2.4]]) {
      const Fn = new THREE.Group(); Fn.position.set(x, 0, z); Fn.rotation.y = a; F.add(Fn);
      Fn.add(at(cyl(.22, .24, .04, M('fanBase', '#2b2f33', { roughness: .5 }), 20), 0, .02, 0)); Fn.add(at(cyl(.02, .02, 1.3, M('chrome', '#d4d8d6'), 8), 0, .67, 0));
      Fn.add(at(cyl(.07, .09, .16, M('fanMotor', '#e8e5de', { roughness: .4 }), 16).rotateX(Math.PI / 2), 0, 1.4, -.08));
      const cage = new THREE.Mesh(new THREE.TorusGeometry(.26, .008, 6, 32), M('chrome', '#d4d8d6')); cage.position.set(0, 1.4, .02); Fn.add(cage);
      for (let k = 0; k < 6; k++) { const sp = box(.52, .006, .006, M('chrome', '#d4d8d6')); sp.position.set(0, 1.4, .04); sp.rotation.z = k * Math.PI / 6; Fn.add(sp); }
      const blades = new THREE.Group(); blades.position.set(0, 1.4, 0); Fn.add(blades);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(leafGeometry(), M('fanBlade', '#7fb8d8', { roughness: .4, side: DS })); b.scale.set(.32, .24, .2); b.rotation.z = k * 2.09; b.rotation.y = .3; blades.add(b); }
      this.spinners.push(blades); this.rounds.push([x, z, .35]);
    }
    this.note(-4.4, 3.4, 'look at the fan', '💨 Moving air', '<p>Fans keep the air moving so every leaf gets fresh CO₂ and the damp air does not grow mould. A breeze also makes stems grow stronger.</p>', 'On the ISS there is no rising warm air, so plants in the Veggie garden would sit in their own stale air without fans.');
  }

  // the pressurised tunnel to the hab: ribbed frames, insulated walls with real pressure windows, lights, pipes and handrails
  buildTunnel() {
    const T = new THREE.Group(); T.name = 'greenhouse-tunnel'; this.scene.add(T);
    const S = new THREE.Group(); T.add(S);
    const W = 3.24, H = 2.9, z0 = TUBE_START, z1 = TUBE_END, wallStart = 5.0, wallEnd = 19;
    const frameM = M('hatchFrame', '#cfd3d2', { roughness: .5, metalness: .25 }), wallM = M('tunnelWall', '#e6e1d6', { roughness: .85 }), seal = M('seal', '#2b2f33', { roughness: .9 });
    const grate = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#5d646a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 6; y < h; y += 8) for (let x = (y % 16) ? 4 : 0; x < w; x += 8) g.fillRect(x, y, 3, 2); g.fillStyle = '#d6a92a'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); });
    grate.wrapS = grate.wrapT = THREE.RepeatWrapping; grate.repeat.set(1, (z1 - z0) / 1.5);
    S.add(at(box(W - .1, .06, z1 - z0, new THREE.MeshStandardMaterial({ map: grate, roughness: .9 })), 0, .03, (z0 + z1) / 2));
    // side walls with rounded pressure windows cut right through them
    const winZ = [8.4, 11.4, 14.4, 17.3], winW = 1.1, winH = .8, winY = 1.45;
    const wallShape = () => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(wallEnd - wallStart, 0); s.lineTo(wallEnd - wallStart, H); s.lineTo(0, H); s.lineTo(0, 0);
      for (const wz of winZ) { const h = new THREE.Path(), cx = wz - wallStart, x = cx - winW / 2, y = winY - winH / 2, r = .2; h.moveTo(x + r, y); h.lineTo(x + winW - r, y); h.quadraticCurveTo(x + winW, y, x + winW, y + r); h.lineTo(x + winW, y + winH - r); h.quadraticCurveTo(x + winW, y + winH, x + winW - r, y + winH); h.lineTo(x + r, y + winH); h.quadraticCurveTo(x, y + winH, x, y + winH - r); h.lineTo(x, y + r); h.quadraticCurveTo(x, y, x + r, y); s.holes.push(h); }
      return s;
    };
    for (const side of [-1, 1]) {
      const geo = new THREE.ExtrudeGeometry(wallShape(), { depth: .08, bevelEnabled: false, curveSegments: 8 });
      const wall = new THREE.Mesh(geo, wallM); wall.rotation.y = -Math.PI / 2; wall.position.set(side * (W / 2 + .04) - .04, 0, wallStart); S.add(wall);
      for (const wz of winZ) {   // deep window frames
        const fr = roundRing(winW + .2, winH + .2, winW, winH, .22, frameM, .22); fr.rotation.y = Math.PI / 2; fr.position.set(side * (W / 2 - .02), winY, wz); S.add(fr);
        const sl = roundRing(winW + .02, winH + .02, winW - .06, winH - .06, .1, seal, .18); sl.rotation.y = Math.PI / 2; sl.position.set(side * (W / 2 + .02), winY, wz); S.add(sl);
        S.add(at(box(.2, .04, winW, M('sill', '#c49a6c', { roughness: .7 })), side * (W / 2 - .1), winY - winH / 2 - .04, wz));
      }
      // lower service chase and kick strip, handrail on stand-offs
      S.add(at(box(.14, .5, wallEnd - wallStart, M('chase', '#c9ced2', { roughness: .6 })), side * (W / 2 - .07), .25, (wallStart + wallEnd) / 2));
      S.add(at(box(.15, .08, wallEnd - wallStart, M('kick', '#3a3f45', { roughness: .9 })), side * (W / 2 - .07), .04, (wallStart + wallEnd) / 2));
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, wallEnd - wallStart - .6, 10), M('rail', '#f2c230', { roughness: .4 })); rail.rotation.x = Math.PI / 2; rail.position.set(side * (W / 2 - .18), .95, (wallStart + wallEnd) / 2); S.add(rail);
      for (let z = wallStart + .5; z < wallEnd - .3; z += 1.5) S.add(at(box(.14, .03, .03, M('rail', '#f2c230')), side * (W / 2 - .1), .95, z));
    }
    // ceiling with light panels, a cable tray and the two water pipes to the greenhouse
    S.add(at(box(W + .1, .08, wallEnd - wallStart, wallM), 0, H + .04, (wallStart + wallEnd) / 2));
    const lightM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4e6', emissiveIntensity: 1.2 });
    for (let z = wallStart + 1.2; z < wallEnd - .5; z += 2.4) S.add(at(box(.9, .03, .45, lightM), 0, H - .02, z));
    S.add(at(box(.3, .05, wallEnd - wallStart, M('tray', '#9aa1a7', { metalness: .4, roughness: .5 })), -1.15, H - .2, (wallStart + wallEnd) / 2));
    for (const [y, m] of [[H - .14, M('waterPipe', '#3b7bd8', { roughness: .4, metalness: .2 })], [H - .3, M('nutrientPipe', '#3f9a5a', { roughness: .4, metalness: .2 })]]) { const p = cyl(.035, .035, wallEnd - wallStart, m, 10); p.rotation.x = Math.PI / 2; p.position.set(1.25, y, (wallStart + wallEnd) / 2); S.add(p); }
    for (let z = wallStart + .7; z < wallEnd; z += 2) { S.add(at(box(.12, .3, .04, M('clamp', '#9aa1a7', { metalness: .6, roughness: .35 })), 1.25, H - .18, z)); const pl = pic(.36, .07, sign('H₂O · NUTRIENT →', { w: 384, h: 80, bg: '#2d5fa8', font: 'bold 34px system-ui' })); pl.rotation.y = -Math.PI / 2; pl.position.set(1.21, H - .43, z + .3); S.add(pl); }
    // structural ribs every 1.5 m
    for (let z = wallStart + .1; z < wallEnd; z += 1.5) { const rib = roundRing(W + .1, H + .1, W - .16, H - .16, .14, frameM, .25); rib.position.set(0, H / 2, z); S.add(rib); }
    // hatch frames at both ends; the greenhouse one has its door swung back against the wall
    for (const [z, flip] of [[wallStart + .06, 1], [wallEnd - .05, -1]]) {
      const hf = roundRing(3.2, 3.0, 2.5, 2.6, .3, frameM, .35); hf.position.set(0, 1.4, z); S.add(hf);
      const hs = roundRing(2.56, 2.66, 2.44, 2.54, .34, seal, .3); hs.position.set(0, 1.4, z); S.add(hs);
      const door = roundPanel(2.3, 2.45, .08, .3, M('hatchDoor', '#bfc5c9', { roughness: .45, metalness: .3 })); door.rotation.y = Math.PI / 2; door.position.set(-1.45, 1.4, z + flip * 1.25); S.add(door);
      const dw = new THREE.Mesh(new THREE.CircleGeometry(.12, 20), M('portGlass', '#123f4d', { roughness: .16, metalness: .65 })); dw.rotation.y = Math.PI / 2; dw.position.set(-1.4, 1.95, z + flip * 1.25); S.add(dw);
    }
    T.add(bake(S));
    // signs (kept separate so their textures stay sharp)
    const s1 = pic(1.5, .22, sign('← GREENHOUSE · DOME 1', { w: 768, h: 112, bg: '#26343d', font: 'bold 52px system-ui' }), true); s1.position.set(0, 3.05, wallEnd - .2); s1.rotation.y = Math.PI; T.add(s1);
    const s2 = pic(1.5, .22, sign('HAB · LIFE SUPPORT →', { w: 768, h: 112, bg: '#26343d', font: 'bold 52px system-ui' }), true); s2.position.set(0, 3.05, wallStart - .14); s2.rotation.y = Math.PI; T.add(s2);
    const s3 = pic(.4, .1, sign('NODE 2-G', { w: 256, h: 68, bg: '#f2c230', fg: '#1d1d1d', font: 'bold 36px monospace' }), true); s3.position.set(1.15, 2.6, wallStart - .14); s3.rotation.y = Math.PI; T.add(s3);
    // glass in the windows: faint, so the real Mars outside shows through
    const glassM = new THREE.MeshStandardMaterial({ color: '#9fd0e8', transparent: true, opacity: .12, roughness: .05, depthWrite: false, side: DS });
    for (const side of [-1, 1]) for (const wz of winZ) { const g = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassM); g.rotation.y = Math.PI / 2; g.position.set(side * (W / 2), winY, wz); T.add(g); }
    // a little herb shelf under one window: someone brings the hab some green on the way through
    const hs = new THREE.Group(); hs.position.set(1.42, 0, 14.4); T.add(hs);
    for (let k = 0; k < 3; k++) {
      hs.add(at(cyl(.07, .055, .11, M('terracotta', '#b5653d', { roughness: .8 }), 14), 0, 1.03, -.35 + k * .35));
      for (let j = 0; j < 6; j++) { const L = new THREE.Mesh(leafGeometry(), leafMat('#5aa04a')); L.scale.setScalar(.06); L.position.set(0, 1.08, -.35 + k * .35); L.rotation.set(-.8, j * 1.05, 0, 'YXZ'); hs.add(L); }
    }
    const lt = new THREE.PointLight('#fff1dc', 6, 9, 1.6); lt.position.set(0, 2.5, 12.5); T.add(lt);
  }

  note(x, z, label, title, text, fact) {
    this.stations.push({ type: 'hab-note', label, title, x, z, html: `${text}<p class="source">${fact}</p>` });
  }

  enter(from) {
    this.vel = { x: 0, z: 0 }; this.step = 0; this.pitch = 0;
    if (from === 'out') { this.pos = new THREE.Vector3(-5.2, 0, 0); this.yaw = Math.PI / 2; }   // just inside the airlock, facing the racks
    else { this.pos = new THREE.Vector3(0, 0, 5.2); this.yaw = Math.PI; }                // just out of the tunnel hatch
  }

  // Show what is growing on each rack. beds: the colony's base-greenhouse plots ({ crop, grown, tank, ready }).
  draw(beds, tankMax, powered = true) {
    beds.forEach((gh, i) => {
      const b = this.beds[i], key = `${powered}|${gh.crop}|${gh.grown.toFixed(2)}|${gh.ready}|${gh.tank.toFixed(1)}`;
      if (key === b.key) return; b.key = key;
      const c = gh.crop && CROPS[gh.crop];
      b.led.material.color.set(c && powered ? '#ff6ae0' : '#5a4a60'); b.light.intensity = c && powered ? 3 : 0;
      b.tube.scale.y = Math.max(0.05, gh.tank / tankMax); b.tube.position.y = 0.3 * b.tube.scale.y + .02;
      const labelKey=`${gh.crop}|${Math.round(gh.grown * 100)}|${gh.ready}`;
      if(labelKey!==b.labelKey){
      b.labelKey=labelKey;
      b.sign.material.map?.dispose();
      b.sign.material.map = label([`BED ${i + 1}`, !c ? 'empty · plant seeds' : gh.ready ? `${c.name.split(' ').pop()} READY` : `${c.name.split(' ').pop()} ${Math.round(gh.grown * 100)}%`], gh.ready ? '#ffd27a' : '#7dffb2');
      b.sign.material.needsUpdate = true;
      }
      // Water and power affect gauges/lights, not the plant geometry.
      const plantKey=`${gh.crop}|${gh.grown.toFixed(2)}|${gh.ready}`;
      if(plantKey!==b.plantKey){b.plantKey=plantKey;growPlants(b.plants, gh.crop, gh.grown, gh.ready);}
    });
  }

  update(dt, keys, active) {
    const crouchDrop=updateCrouch(this,dt,active&&crouchHeld(keys));
    dt = Math.min(dt, .05); // A stalled frame must not tunnel through furniture.
    for (const s of this.spinners) s.rotation.z += dt * 9;
    let wx = 0, wz = 0;
    if (active) {
      const speed = footSpeed(keys,2.6,4);
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const dx = Math.sin(this.yaw) * f - Math.cos(this.yaw) * s, dz = Math.cos(this.yaw) * f + Math.sin(this.yaw) * s;
      const len = Math.hypot(dx, dz); if (len) { wx = dx / len * speed; wz = dz / len * speed; }
    }
    const k = 1 - Math.exp(-dt * 9);
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const sp = Math.hypot(this.vel.x, this.vel.z), before = this.step;
    this.step += sp * dt / 1.9 * Math.PI * 2;
    if (Math.floor(before / Math.PI) !== Math.floor(this.step / Math.PI) && sp > 1) this.onStep?.();
    const r = Math.hypot(this.pos.x, this.pos.z), max = R - 1.0;
    if (this.pos.z > 5.6 && Math.abs(this.pos.x) < 1.6) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -1.12, 1.12);
    } else if (r > max) { this.pos.x *= max / r; this.pos.z *= max / r; }
    const pad = .3;
    for (const x of BEDS) {                         // walk around the racks, not through them
      const hx = BED_W / 2 + pad, hz = BED_LEN / 2 + pad, dx = this.pos.x - x, dz = this.pos.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz)) this.pos.x = x + Math.sign(dx || 1) * hx; else this.pos.z = Math.sign(dz || 1) * hz;
      }
    }
    for (const [x0, x1, z0, z1] of this.blocks) {   // benches, shelves, the airlock and the tomatoes
      const a = x0 - pad, b = x1 + pad, c = z0 - pad, d = z1 + pad;
      if (this.pos.x > a && this.pos.x < b && this.pos.z > c && this.pos.z < d) {
        const push = [[this.pos.x - a, a, 'x'], [b - this.pos.x, b, 'x'], [this.pos.z - c, c, 'z'], [d - this.pos.z, d, 'z']].sort((p, q) => p[0] - q[0])[0];
        this.pos[push[2]] = push[1];
      }
    }
    for (const [cx, cz, cr] of this.rounds) {       // fans, towers, the climate post, the crates
      const dx = this.pos.x - cx, dz = this.pos.z - cz, d = Math.hypot(dx, dz), min = cr + pad;
      if (d < min) { const n = d > 1e-6 ? 1 / d : 0; this.pos.x = cx + (d > 1e-6 ? dx * n : 1) * min; this.pos.z = cz + (d > 1e-6 ? dz * n : 0) * min; }
    }
    // Tank shell plus astronaut radius. Stop the body before the camera enters glass.
    const tx = this.pos.x + 4.4, tz = this.pos.z + 4.4, td = Math.hypot(tx, tz), clearance = .58 + .32;
    if (td < clearance) { const nx = td > 1e-6 ? tx / td : Math.SQRT1_2, nz = td > 1e-6 ? tz / td : Math.SQRT1_2; this.pos.x = -4.4 + nx * clearance; this.pos.z = -4.4 + nz * clearance; this.vel.x = 0; this.vel.z = 0; }
    const bob = (Math.cos(this.step * 2) - 1) * 0.012 * Math.min(1, sp / 2.6);
    const eye = new THREE.Vector3(this.pos.x, 1.65 - crouchDrop + bob, this.pos.z);
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.x + Math.sin(this.yaw) * Math.cos(this.pitch), eye.y + Math.sin(this.pitch), eye.z + Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  nearest() {
    let best = null;
    for (const s of this.stations) {
      const d = Math.hypot(this.pos.x - s.x, this.pos.z - s.z);
      if (d < 1.6 && (!best || d < best.d)) best = { ...s, d };
    }
    return best;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
