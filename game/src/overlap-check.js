// Team tool: find props in the habitat that sit inside one another (a cabinet through a rack, a pot through a shelf).
// Open the game with ?overlaps in the address; after the hab is built the console shows a table and window.habOverlaps
// holds the list. It runs before the pods are baked into merged meshes, while every prop is still its own object.
// Every part (mesh) becomes an oriented box; parts of two different props "clip" when the boxes overlap by more
// than `tolerance` metres on every separating axis. Flat pictures and labels are ignored (they are meant to touch).
import * as THREE from 'three';

const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
function partsOf(top, idx) {
  const out = [];
  top.updateWorldMatrix(true, true);
  top.traverse(m => {
    if (!m.isMesh || !m.visible || m.isSprite) return;
    const g = m.geometry; if (!g || ['PlaneGeometry', 'RingGeometry', 'CircleGeometry', 'TorusGeometry', 'TubeGeometry'].includes(g.type)) return;   // flat or curved: a box would lie
    const gp = g.parameters || {}; if (g.type === 'CylinderGeometry' && (gp.openEnded || (gp.thetaLength ?? 7) < 6.2)) return;   // wall bands and part-rings
    g.boundingBox ?? g.computeBoundingBox();
    const b = g.boundingBox, half = b.getSize(new THREE.Vector3()).multiplyScalar(.5), c = b.getCenter(new THREE.Vector3());
    m.matrixWorld.decompose(v, q, s);
    half.multiply(s).set(Math.abs(half.x), Math.abs(half.y), Math.abs(half.z));
    if (Math.min(half.x, half.y, half.z) < .007) return;   // paper-thin decals and hanging wires
    if ([half.x, half.y, half.z].filter(h => h > 1.25).length >= 2) return;   // rings and shells (hatch frames): hollow, so their box is meaningless
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map(a => a.applyQuaternion(q));
    const centre = c.clone().applyMatrix4(m.matrixWorld);
    const r = half.length();
    out.push({ top: idx, centre, axes, half: [half.x, half.y, half.z], r, mat: [].concat(m.material)[0]?.name || '', geo: g.type });
  });
  return out;
}
// separating-axis test for two oriented boxes: returns the smallest overlap (<= 0 when they are apart)
function obbOverlap(A, B) {
  const T = B.centre.clone().sub(A.centre); let best = Infinity;
  const test = axis => {
    const len = axis.length(); if (len < 1e-6) return true; const n = axis.clone().multiplyScalar(1 / len);
    const ra = A.half.reduce((t, h, i) => t + h * Math.abs(A.axes[i].dot(n)), 0), rb = B.half.reduce((t, h, i) => t + h * Math.abs(B.axes[i].dot(n)), 0);
    const o = ra + rb - Math.abs(T.dot(n)); best = Math.min(best, o); return o > 0;
  };
  for (const a of A.axes) if (!test(a)) return best;
  for (const b of B.axes) if (!test(b)) return best;
  for (const a of A.axes) for (const b of B.axes) if (!test(new THREE.Vector3().crossVectors(a, b))) return best;
  return best;
}
export function findOverlaps(objects, { tolerance = .02, skip = () => false } = {}) {
  const tops = objects.filter(o => !skip(o));
  const parts = tops.flatMap((o, i) => partsOf(o, i)).sort((a, b) => (a.centre.x - a.r) - (b.centre.x - b.r));
  const pairs = new Map();
  for (let i = 0; i < parts.length; i++) {
    const A = parts[i];
    for (let j = i + 1; j < parts.length; j++) {
      const B = parts[j];
      if (B.centre.x - B.r > A.centre.x + A.r) break;   // sweep: nothing further right can touch A
      if (A.top === B.top || A.centre.distanceTo(B.centre) > A.r + B.r) continue;
      const d = obbOverlap(A, B);
      if (d <= tolerance) continue;
      const key = Math.min(A.top, B.top) + ':' + Math.max(A.top, B.top), prev = pairs.get(key);
      if (!prev || d > prev.depth) pairs.set(key, { depth: +d.toFixed(3), a: describe(A), b: describe(B), objects: [tops[A.top], tops[B.top]] });
    }
  }
  return [...pairs.values()].sort((p, q2) => q2.depth - p.depth);
}
const describe = p => ({ at: p.centre.toArray().map(n => +n.toFixed(2)), size: p.half.map(n => +(n * 2).toFixed(2)), mat: p.mat, geo: p.geo });
