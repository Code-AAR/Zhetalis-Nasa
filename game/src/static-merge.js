// Fewer draw calls for things that never move: every mesh under `root` that shares a material is baked into one
// mesh. A survey tower made of 120 struts and bolts becomes about 10 meshes and looks identical.
// Left alone: anything under an `exclude` object (moving dishes, recoloured lights...), hidden meshes, instanced or
// skinned meshes, multi-material meshes, and materials used by only one mesh (nothing to gain, and code may hold it).
// The merged meshes keep the originals' shadow and render-order settings. Returns how many draw calls were saved.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root, { exclude = [] } = {}) {
  root.updateMatrixWorld(true);
  const keep = new Set(); for (const e of exclude) e?.traverse(o => keep.add(o));
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), local = new THREE.Matrix4(), buckets = new Map();
  root.traverse(o => {
    if (keep.has(o) || !o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.morphTargetInfluences) return;
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return;
    const g = o.geometry, attrs = Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join(',');
    const key = [o.material.uuid, attrs, g.index ? 'i' : 'n', o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  let saved = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geos = meshes.map(m => {
      local.multiplyMatrices(inv, m.matrixWorld);
      const g = m.geometry.clone(); g.morphAttributes = {}; g.clearGroups(); g.applyMatrix4(local);
      if (local.determinant() < 0) flipWinding(g);   // mirrored parts: keep their faces pointing outwards
      return g;
    });
    const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = meshes[0], mesh = new THREE.Mesh(merged, first.material);
    mesh.name = 'merged ' + (first.material.name || first.name || 'part'); mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
    mesh.userData.merged = meshes.length;
    root.add(mesh);
    for (const m of meshes) m.parent?.remove(m);
    saved += meshes.length - 1;
  }
  return saved;
}

function flipWinding(g) {
  if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; return; }
  for (const attr of Object.values(g.attributes)) {
    const n = attr.itemSize, a = attr.array;
    for (let i = 0; i < attr.count; i += 3) for (let k = 0; k < n; k++) { const t = a[(i + 1) * n + k]; a[(i + 1) * n + k] = a[(i + 2) * n + k]; a[(i + 2) * n + k] = t; }
    attr.needsUpdate = true;
  }
}
