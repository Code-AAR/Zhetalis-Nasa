// The player's astronaut: NASA's own "Astronaut" 3D model (NASA 3D Resources), cut into body parts
// so it can really walk. The file is one solid mesh standing with its arms out, so when it loads we sort
// every triangle into torso, thighs, shins and arms by where it sits, and hang each part from a joint
// (hips, knees, shoulders). Then the walk below moves the joints like a person in a stiff suit.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';

const H = 1.85;   // suit height in metres (game units)
// joint heights as a share of the suit's height, measured from NASA's model
const HIP = 0.385, KNEE = 0.205, SHOULDER = 0.715, ARM_X = 0.19;

// Space Apps rules: no NASA logo in the game. Paint plain suit fabric over the logo and mission patch
// on the backpack texture (positions measured on NASA's 1024 px texture).
function coverLogos(tex) {
  const img = tex?.image; if (!img?.width) return tex;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const k = img.width / 1024, px = g.getImageData(Math.round(865 * k), Math.round(300 * k), 1, 1).data;
  g.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
  g.beginPath(); g.arc(920 * k, 211 * k, 34 * k, 0, Math.PI * 2); g.fill();        // logo on the backpack
  g.fillRect(790 * k, 380 * k, 78 * k, 66 * k);                                       // mission patch
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  return t;
}

// Split one geometry's triangles into named parts. `pick(cx, cy, cz)` returns the part name for a triangle centre.
function splitGeometry(geo, pick) {
  const g = geo.index ? geo.toNonIndexed() : geo, names = Object.keys(g.attributes), out = {};
  const pos = g.attributes.position, tri = pos.count / 3;
  const lists = {};
  for (let t = 0; t < tri; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < 3; v++) { cx += pos.getX(t * 3 + v); cy += pos.getY(t * 3 + v); cz += pos.getZ(t * 3 + v); }
    (lists[pick(cx / 3, cy / 3, cz / 3)] ??= []).push(t);
  }
  for (const [part, ts] of Object.entries(lists)) {
    const ng = new THREE.BufferGeometry();
    for (const n of names) {
      const a = g.attributes[n], size = a.itemSize, arr = new a.array.constructor(ts.length * 3 * size);
      ts.forEach((t, i) => arr.set(a.array.subarray(t * 3 * size, t * 3 * size + 3 * size), i * 3 * size));
      ng.setAttribute(n, new THREE.BufferAttribute(arr, size, a.normalized));
    }
    out[part] = ng;
  }
  return out;
}

// Builds the jointed NASA astronaut. Resolves to { root, torso, hips:[L,R], knees:[L,R], arms:[L,R] } or null.
export async function loadNasaAstronaut() {
  const gltf = await loadModel('nasa-astronaut.glb'); if (!gltf) return null;
  const src = gltf.scene; src.updateMatrixWorld(true);
  const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const s = H / size.y;
  // put the feet on the ground at (0,0,0) and scale to real size
  const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z));
  const joints = {
    torso: new THREE.Vector3(0, 0, 0),
    hipL: new THREE.Vector3(-0.1, HIP * H, 0), hipR: new THREE.Vector3(0.1, HIP * H, 0),
    shinL: new THREE.Vector3(-0.1, KNEE * H, 0.02), shinR: new THREE.Vector3(0.1, KNEE * H, 0.02),
    armL: new THREE.Vector3(-ARM_X * H, SHOULDER * H, 0), armR: new THREE.Vector3(ARM_X * H, SHOULDER * H, 0),
  };
  const pick = (x, y) => {
    if (y < KNEE * H) return x < 0 ? 'shinL' : 'shinR';
    if (y < HIP * H) return x < 0 ? 'hipL' : 'hipR';
    if (Math.abs(x) > ARM_X * H && y > 0.5 * H) return x < 0 ? 'armL' : 'armR';
    return 'torso';
  };
  const parts = {};
  for (const m of meshes) {
    const geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld));
    const mats = [].concat(m.material).map(mt => {
      const c = mt.clone(); c.map = coverLogos(mt.map); c.roughness = 0.85; c.metalness = 0;
      c.color.setScalar(1);   // the file darkens the white fabric to grey - real suits are bright white
      return c;
    });
    for (const [part, g] of Object.entries(splitGeometry(geo, pick))) {
      g.translate(-joints[part].x, -joints[part].y, -joints[part].z);   // so the part turns around its joint
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]);
      if (mats.length > 1) g.groups = m.geometry.groups;   // (NASA's file uses one material per mesh)
      mesh.castShadow = true;
      (parts[part] ??= []).push(mesh);
    }
  }
  // soft white "joint" balls hide the seams where the model was cut (real suits have bulky joints there too)
  const fabric = new THREE.MeshStandardMaterial({ color: '#ecebe7', roughness: 0.9 });
  const cap = { hipL: 0.12, hipR: 0.12, shinL: 0.095, shinR: 0.095, armL: 0.115, armR: 0.115 };
  const node = name => {
    const n = new THREE.Group(); n.position.copy(joints[name]); (parts[name] || []).forEach(m => n.add(m));
    if (cap[name]) { const b = new THREE.Mesh(new THREE.SphereGeometry(cap[name], 14, 10), fabric); b.castShadow = true; n.add(b); }
    return n;
  };
  const root = new THREE.Group(), torso = node('torso'); root.add(torso);
  const hips = ['hipL', 'hipR'].map(node), shins = ['shinL', 'shinR'].map(node), arms = ['armL', 'armR'].map(node);
  hips.forEach((h, i) => { root.add(h); h.add(shins[i]); shins[i].position.sub(joints[i ? 'hipR' : 'hipL']); });
  arms.forEach(a => root.add(a));
  return { root, torso, hips, knees: shins, arms };
}

// One step of the walk. phase grows with distance walked (one full cycle = left step + right step).
// pace 0..1 = walking, run 0..1 = running on top, air = in the air after a jump.
export function poseAstronaut(a, { phase, pace, run, air, t }) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const hipAmp = 0.42 * pace + 0.2 * run, kneeAmp = 0.65 * pace + 0.35 * run, armAmp = 0.3 * pace + 0.25 * run;
  const tuck = air * (1 - pace * 0.3);
  // legs: forward swing is a negative x turn. The knee bends most in the middle of each leg's swing.
  a.hips[0].rotation.x = -hipAmp * s - tuck * 0.45;
  a.hips[1].rotation.x = hipAmp * s - tuck * 0.25;
  a.knees[0].rotation.x = kneeAmp * Math.max(0, c) ** 1.5 + 0.06 * pace + tuck * 0.8;
  a.knees[1].rotation.x = kneeAmp * Math.max(0, -c) ** 1.5 + 0.06 * pace + tuck * 0.6;
  // arms hang at the sides (NASA's model holds them out) and swing with the opposite leg
  const breathe = Math.sin(t * 1.6) * 0.02 * (1 - pace);
  const hang = 1.22 - 0.1 * run;
  a.arms[0].rotation.set(armAmp * s + 0.08 * run, 0, hang + breathe);
  a.arms[1].rotation.set(-armAmp * s + 0.08 * run, 0, -hang - breathe);
  // the body rises over each foot (twice per cycle) - a smooth wave, never a hop - and sways a little
  return {
    bob: ((Math.cos(phase * 2) + 1) / 2) * (0.035 * pace + 0.06 * run) - (0.02 * pace),
    sway: s * 0.025 * pace,
    twist: -s * 0.08 * pace,
  };
}
