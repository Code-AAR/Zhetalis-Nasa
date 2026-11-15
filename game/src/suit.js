// The player's astronaut: NASA's own "Astronaut" 3D model (NASA 3D Resources), given a skeleton so it can walk.
// NASA's file is one solid statue standing with its arms out. When it loads we add bones (pelvis, spine,
// thighs, shins, upper arms, forearms) and "skin" the surface to them: every point of the suit follows the
// bones near it, blending smoothly around each joint, so the suit bends like fabric instead of breaking
// into pieces. We also colour it like a real spacewalk suit (grey boots and gloves,
// a little Mars dust low down, darker creases) and add our team patch.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';

const H = 1.85;   // suit height in metres (game units)
// joint positions as a share of the suit's height, measured from NASA's model
const HIP = 0.385, KNEE = 0.205, WAIST = 0.52, SHOULDER = 0.715, ARM_X = 0.19, ELBOW_X = 0.325, HAND_X = 0.37;
const smooth = (a, b, v) => THREE.MathUtils.smoothstep(v, Math.min(a, b), Math.max(a, b)) * (a < b ? 1 : -1) + (a < b ? 0 : 1);

// Split one geometry's triangles into named parts. `pick(cx, cy, cz)` returns the part name for a triangle centre.
// (Used by the rover to cut out its wheels.)
export function splitGeometry(geo, pick) {
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

// Which bones move a point of the suit, and how much (up to 4). Bones: 0 pelvis, 1 spine, 2/3 thigh L/R,
// 4/5 shin L/R, 6/7 upper arm L/R, 8/9 forearm L/R. Bands of a few cm around each joint blend smoothly.
function weights(x, y, z) {
  const ax = Math.abs(x), R = x > 0 ? 1 : 0, hipY = HIP * H, kneeY = KNEE * H, sh = SHOULDER * H;
  const armIn = ARM_X * H, el = ELBOW_X * H;
  const isArm = smooth(0.47 * H, 0.53 * H, y) * smooth(armIn - 0.05, armIn + 0.07, ax);
  if (isArm > 0) {
    const fore = smooth(el - 0.06, el + 0.06, ax);
    const spine = 1 - isArm;
    return [[1, spine], [6 + R, isArm * (1 - fore)], [8 + R, isArm * fore]];
  }
  if (y < hipY + 0.09 && z > -0.16) {                                 // (the backpack hangs low behind: it stays with the body)
    const leg = 1 - smooth(hipY - 0.07, hipY + 0.09, y);             // pelvis -> thigh
    const shin = 1 - smooth(kneeY - 0.06, kneeY + 0.06, y);           // thigh -> shin
    const left = 1 - smooth(-0.035, 0.035, x);                        // the middle of the crotch follows both legs
    const out = [[0, 1 - leg]];
    for (const [side, w] of [[0, left], [1, 1 - left]]) if (w > 0) { out.push([2 + side, leg * w * (1 - shin)], [4 + side, leg * w * shin]); }
    return out.filter(([, w]) => w > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }
  const spine = smooth(WAIST * H - 0.08, WAIST * H + 0.08, y);         // the waist bends between pelvis and chest
  return [[0, 1 - spine], [1, spine]];
}

// A colour for each point of the suit (multiplied with NASA's texture): realistic details, not cartoon ones.
function tint(x, y, z) {
  const c = new THREE.Color(1, 1, 1), ax = Math.abs(x), hipY = HIP * H, sh = SHOULDER * H;
  if (y < 0.075 * H) c.setRGB(0.6, 0.61, 0.63);                                     // boots: grey
  if (y < 0.012 * H) c.setRGB(0.28, 0.28, 0.3);                                     // soles
  if (ax > HAND_X * H && y > 0.6 * H) c.setRGB(0.74, 0.76, 0.8);                    // gloves: light grey-blue
  // soft shading in creases: between the legs, under the arms, behind the knees, at the waist
  let ao = 1;
  if (ax < 0.09 && y > hipY - 0.12 && y < hipY + 0.03) ao *= 0.8;
  if (ax > ARM_X * H - 0.05 && ax < ARM_X * H + 0.06 && y > sh - 0.2 && y < sh - 0.02) ao *= 0.82;
  if (Math.abs(y - KNEE * H) < 0.05 && z < 0) ao *= 0.86;
  if (Math.abs(y - WAIST * H) < 0.03) ao *= 0.9;
  c.multiplyScalar(ao);
  // Mars dust: the lower legs pick up a light orange-brown coat
  const dust = Math.max(0, 1 - y / (0.3 * H)) * 0.32;
  c.lerp(new THREE.Color(0.78, 0.55, 0.42).multiply(c), dust);
  return c;
}

// The astronaut everyone wears: NASA's Z-2 suit when it loads (assets/models/nasa-spacesuits/z2-suit-web.glb, a web copy
// of NASA 3D Resources' "Z2 Spacesuit", NASA/LaRC/Advanced Concepts Lab), otherwise NASA's "Astronaut" model below.
// Both resolve to the same { root, torso, hips, knees, arms, elbows, pelvis }, so poseAstronaut() drives either.
export async function loadNasaAstronaut() {
  try { const z = await loadZ2Astronaut(); if (z) return z; } catch (e) { console.warn('Z-2 suit unavailable, using the classic suit:', e); }
  return loadEmuAstronaut();
}

// Z-2 joints (metres, feet at 0, facing +z), measured from front and side views of NASA's model (1.94 m tall).
const Z2 = { h: 1.936, hip: 0.86, knee: 0.494, waist: 1.05, legX: 0.106, shoulder: [0.27, 1.45, 0.04], elbow: [0.30, 1.24, 0.26], wrist: [0.27, 1.13, 0.47] };
// thickness of each bone's capsule (m, before scaling): skin follows the nearest capsule, blending softly at joints
const Z2_RADII = [0.20, 0.23, 0.10, 0.10, 0.08, 0.08, 0.075, 0.075, 0.065, 0.065];

async function loadZ2Astronaut() {
  const gltf = await loadModel('models/nasa-spacesuits/z2-suit-web.glb'); if (!gltf) return null;
  const src = gltf.scene; src.updateMatrixWorld(true);
  const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
  if (!meshes.length) return null;
  const box = new THREE.Box3().setFromObject(src), s = H / (box.max.y - box.min.y), mid = box.getCenter(new THREE.Vector3());
  const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z));
  const k = H / Z2.h, V = a => new THREE.Vector3(a[0] * k, a[1] * k, a[2] * k);
  const hipY = Z2.hip * k, kneeY = Z2.knee * k, waistY = Z2.waist * k, legX = Z2.legX * k;
  const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent?.add(b); return b; };
  const pelvis = bone(null, 0, hipY, 0), spine = bone(pelvis, 0, waistY - hipY, 0);
  const thighs = [-1, 1].map(sx => bone(pelvis, sx * legX, 0, 0));
  const shins = thighs.map(t => bone(t, 0, kneeY - hipY, 0.02));
  // Arms: like the classic suit, an arm bone's child sits along its local x, so rotation 0 means "arm held out".
  // The Z-2's arms hang forward at rest, so each arm bone is bound already turned from "out" to that direction -
  // the walk, run, jump and pickaxe poses written for the classic suit then drive the Z-2 the same way.
  const uppers = [], fores = [], segs = [];
  [-1, 1].forEach((sx, i) => {
    const sh = V(Z2.shoulder), el = V(Z2.elbow), wr = V(Z2.wrist); sh.x *= sx; el.x *= sx; wr.x *= sx;
    const up = bone(spine, sh.x, sh.y - waistY, sh.z);
    const dUp = el.clone().sub(sh), lenUp = dUp.length();
    up.quaternion.setFromUnitVectors(new THREE.Vector3(sx, 0, 0), dUp.clone().normalize());
    const fo = bone(up, sx * lenUp, 0, 0);
    up.updateMatrixWorld(true);
    const dFo = wr.clone().sub(el), inUp = dFo.clone().applyQuaternion(up.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    fo.quaternion.setFromUnitVectors(new THREE.Vector3(sx, 0, 0), inUp);
    uppers.push(up); fores.push(fo); segs.push([sh, el], [el, wr]);
  });
  const bones = [pelvis, spine, ...thighs, ...shins, ...uppers, ...fores];
  const root = new THREE.Group(); root.add(pelvis); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  // capsules in the bind pose, in the same order as `bones`
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const caps = [[P(0, hipY, 0), P(0, waistY, 0)], [P(0, waistY, 0), P(0, V(Z2.shoulder).y + 0.45 * k, 0)],
    [P(-legX, hipY, 0), P(-legX, kneeY, 0.02)], [P(legX, hipY, 0), P(legX, kneeY, 0.02)],
    [P(-legX, kneeY, 0.02), P(-legX, 0.07, 0.04)], [P(legX, kneeY, 0.02), P(legX, 0.07, 0.04)],
    segs[0], segs[2], segs[1], segs[3]];
  const closest = new THREE.Vector3(), seg = new THREE.Line3(), d = new Float32Array(10);
  for (const m of meshes) {
    const geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld));
    const pos = geo.attributes.position, n = pos.count, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i); let dmin = 1e9;
      for (let b = 0; b < 10; b++) { seg.set(caps[b][0], caps[b][1]); seg.closestPointToPoint(v, true, closest); d[b] = v.distanceTo(closest) - Z2_RADII[b] * k; dmin = Math.min(dmin, d[b]); }
      const w = []; for (let b = 0; b < 10; b++) if (d[b] - dmin < 0.07) w.push([b, Math.exp(-(d[b] - dmin) / 0.03)]);
      w.sort((a, c) => c[1] - a[1]); const top = w.slice(0, 4), sum = top.reduce((a, [, x]) => a + x, 0);
      top.forEach(([b, x], j) => { idx[i * 4 + j] = b; wt[i * 4 + j] = x / sum; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    const mats = [].concat(m.material).map(mt => { const c = mt.clone(); c.roughness = Math.max(0.6, c.roughness ?? 0.8); c.metalness = 0; return c; });
    const sm = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]);
    sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.bind(skeleton);
  }
  return { root, pelvis, torso: spine, hips: thighs, knees: shins, arms: uppers, elbows: fores, model: 'z2' };
}

// Builds the skinned NASA astronaut (the classic suit). Resolves to { root, torso, hips, knees, arms, elbows, pelvis } or null.
async function loadEmuAstronaut() {
  const gltf = await loadModel('nasa-astronaut.glb'); if (!gltf) return null;
  const src = gltf.scene; src.updateMatrixWorld(true);
  const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const s = H / size.y;
  const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z));

  // the skeleton, in the model's standing pose (bones start unturned)
  const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent?.add(b); return b; };
  const hipY = HIP * H, kneeY = KNEE * H, waistY = WAIST * H, sh = SHOULDER * H, armIn = ARM_X * H, el = ELBOW_X * H;
  const pelvis = bone(null, 0, hipY, 0), spine = bone(pelvis, 0, waistY - hipY, 0);
  const thighs = [-1, 1].map(sx => bone(pelvis, sx * 0.1, 0, 0));
  const shins = thighs.map(t => bone(t, 0, kneeY - hipY, 0.02));
  const uppers = [-1, 1].map(sx => bone(spine, sx * armIn, sh - waistY, 0));
  const fores = uppers.map((u, i) => bone(u, (i ? 1 : -1) * (el - armIn), -0.03, 0));
  const bones = [pelvis, spine, ...thighs, ...shins, ...uppers, ...fores];
  const root = new THREE.Group(); root.add(pelvis); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  for (const m of meshes) {
    const geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld));
    const p = geo.attributes.position, n = p.count;
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const w = weights(x, y, z), sum = w.reduce((a, [, v]) => a + v, 0) || 1;
      w.forEach(([b, v], k) => { idx[i * 4 + k] = b; wt[i * 4 + k] = v / sum; });
      const c = tint(x, y, z); col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mats = [].concat(m.material).map(mt => {
      const c = mt.clone(); c.vertexColors = true; c.roughness = 0.82; c.metalness = 0;
      c.color.setScalar(1);   // the file darkens the white fabric to grey - real suits are bright white
      return c;
    });
    const sm = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]);
    sm.castShadow = true; sm.receiveShadow = true;    // the suit shades itself (arms on the body, backpack on the back)
    sm.frustumCulled = false;
    root.add(sm); sm.bind(skeleton);
  }
  addPatch(root, spine);
  return { root, pelvis, torso: spine, hips: thighs, knees: shins, arms: uppers, elbows: fores };
}

// Our team's patch, sewn on the left side of the chest (like a mission patch).
function addPatch(root, spine) {
  new THREE.TextureLoader().load('assets/zhetalis-badge.png', tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0.15, 1.42, 2), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(root.children.filter(o => o.isSkinnedMesh), false)[0];
    if (!hit) return;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    const at = hit.point.clone().add(new THREE.Vector3(0, 0, 0.004));
    patch.position.copy(spine.worldToLocal(at));
    spine.add(patch);
  });
}

// One frame of the walk. phase grows with distance walked (one full cycle = left step + right step).
// pace 0..1 = walking, run 0..1 = running on top, air 0..1 = in the air after a jump.
// Built from how people walk: the swinging leg bends at the knee, the standing leg stays nearly straight,
// each arm swings with the opposite leg with a soft elbow, the chest turns a little against the hips,
// the hips tilt over the standing leg, and the body is highest when passing over the standing foot.
// Mars has 38% of Earth's gravity, so running is a long, floaty lope.
// Jumping: `air` blends from the walk into a jump pose (0..1) and `vy` is the upward speed in m/s.
// Going up, the legs push off then tuck; at the top they hang loose; coming down they stretch out to land,
// one foot ahead. The arms lift out for balance. Mars gravity is 38% of Earth's, so each jump lasts long
// enough to see all of this.
// Mining: `swing` runs 0..1 through one pickaxe swing. swingCurve() is shared by the body (third person) and the
// first-person view: a small wind-up crouch, the pick lifted over the helmet with the body leaning back, a fast strike
// that drives the knees down, a short recoil bounce off the rock, then recovery. The strike lands at 0.55.
const sm = k => (k = Math.max(0, Math.min(1, k))) * k * (3 - 2 * k);
export function swingCurve(k) {
  if (k < 0) return { lift: 0, crouch: 0, lean: 0, twist: 0 };
  let lift, crouch = 0, lean = 0, twist = 0;
  if (k < 0.12) { lift = -0.12 * sm(k / 0.12); crouch = 0.12 * sm(k / 0.12); }                       // wind-up
  else if (k < 0.45) { const u = sm((k - 0.12) / 0.33); lift = -0.12 + 1.12 * u; crouch = 0.12 * (1 - u); lean = -0.18 * u; twist = 0.22 * u; }
  else if (k < 0.55) { const u = ((k - 0.45) / 0.1) ** 1.6; lift = 1 - 1.4 * u; crouch = 0.28 * u; lean = -0.18 + 0.55 * u; twist = 0.22 * (1 - u); }   // strike
  else if (k < 0.66) { const u = (k - 0.55) / 0.11; lift = -0.4 + 0.12 * Math.sin(u * Math.PI); crouch = 0.28; lean = 0.37; }          // recoil off the rock
  else { const u = sm((k - 0.66) / 0.34); lift = -0.4 * (1 - u); crouch = 0.28 * (1 - u); lean = 0.37 * (1 - u); }                   // recover
  return { lift, crouch, lean, twist };
}
export function poseAstronaut(a, { phase, pace, run, air, t, vy = 0, swing = -1, crouch = 0 }) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const ground = 1 - air;
  const hipAmp = (0.48 * pace + 0.15 * run) * ground, kneeAmp = (0.75 * pace + 0.3 * run) * ground, armAmp = (0.3 * pace + 0.18 * run) * ground;
  // jump shape from the vertical speed: rise = 1 just after take-off, 0 at the top, -1 falling fast
  const rise = Math.max(-1, Math.min(1, vy / 3.2));
  const tuck = air * Math.max(0, 1 - Math.abs(rise) * 0.6);              // most tucked near the top
  const reach = air * Math.max(0, -rise);                                // legs reach down to land
  const push = air * Math.max(0, rise);                                  // legs straighten as they push off
  const lead = pace > 0.3 ? 0.3 : 0.12;                                  // one leg forward, more when running
  a.hips[0].rotation.x = -hipAmp * s - 0.04 * run - tuck * 0.75 - reach * (0.25 + lead) + push * 0.15;
  a.hips[1].rotation.x = hipAmp * s - 0.04 * run - tuck * 0.45 - reach * 0.12 + push * 0.3;
  a.knees[0].rotation.x = kneeAmp * Math.max(0, c) ** 1.4 + 0.06 * pace + tuck * 1.15 + reach * 0.25 + push * 0.1;
  a.knees[1].rotation.x = kneeAmp * Math.max(0, -c) ** 1.4 + 0.06 * pace + tuck * 0.95 + reach * 0.45 + push * 0.35;
  // arms come down to the sides (NASA's model holds them out) and swing with the opposite leg;
  // in a jump they lift out to the sides and drift a little, like balancing
  const breathe = Math.sin(t * 1.5) * 0.02 * (1 - pace);
  const idle = Math.sin(t * 0.7) * (1 - pace);                        // standing still: shift weight a little
  const float = Math.sin(t * 3) * 0.08 * air;
  const hang = 1.36 - 0.1 * run - 0.55 * air - float;
  a.arms[0].rotation.set(armAmp * s + 0.12 * run - 0.25 * push + 0.2 * reach, 0, hang + breathe);
  a.arms[1].rotation.set(-armAmp * s + 0.12 * run - 0.25 * push + 0.2 * reach, 0, -hang - breathe);
  // elbows: always a little bent (a pressurised suit's arms don't hang straight), more on the forward swing
  a.elbows[0].rotation.y = 0.28 + 0.35 * run + 0.3 * Math.max(0, s) * pace + 0.3 * air;
  a.elbows[1].rotation.y = -(0.28 + 0.35 * run + 0.3 * Math.max(0, -s) * pace + 0.3 * air);
  // chest turns against the hips; hips tilt over the standing leg; a slight forward lean when running
  a.torso.rotation.set(0.04 * run + breathe * 0.5 + 0.12 * tuck - 0.06 * push, -s * 0.07 * pace + idle * 0.02, 0);
  a.pelvis.rotation.set(0, s * 0.05 * pace, -s * 0.03 * pace + idle * 0.015);
  if (swing >= 0) {
    // both hands on the pickaxe: lift it up over the helmet, bring it down hard in front, then recover
    const { lift, crouch: dip, lean, twist } = swingCurve(swing);
    const x = -0.55 - 2.05 * Math.max(0, lift) + 0.45 * Math.max(0, -lift);   // -2.6 over the head, -0.37 low at the rock
    a.arms[0].rotation.set(x, 0, 1.2); a.arms[1].rotation.set(x, 0, -1.2);
    a.elbows[0].rotation.y = 0.35 + 0.4 * Math.max(0, lift); a.elbows[1].rotation.y = -(0.35 + 0.4 * Math.max(0, lift));
    a.torso.rotation.x = 0.05 + lean; a.torso.rotation.y += twist;                       // lean back, then bend into the strike
    for (const hip of a.hips) hip.rotation.x -= dip * 0.8;                                // knees give on the strike
    for (const knee of a.knees) knee.rotation.x += dip * 1.45;
    a._swingDip = dip;
  }
  for(const hip of a.hips)hip.rotation.x-=crouch*.8;
  for(const knee of a.knees)knee.rotation.x+=crouch*1.45;
  a.torso.rotation.x+=crouch*.2;
  return {
    bob: -crouch*.25 + ((Math.cos(phase * 2) + 1) / 2) * (0.03 * pace + 0.07 * run) * ground - 0.025 * pace * ground,
    sway: s * 0.02 * pace * ground + idle * 0.012,
  };
}
