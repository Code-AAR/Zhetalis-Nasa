// Things the crew rover can drive onto and over: mineral deposits and the textured Mars rocks.
// The rover already climbs the ordinary boulders by reading their real surface (rock-contact.js). Props listed here
// join that surface, and they always count as a "small obstacle", so the tyres climb them instead of stopping.
// Each entry: { x, z, r, object, alive?() } - object is a Mesh or InstancedMesh; r is how far from (x, z) it reaches.
import * as THREE from 'three';

export function createDriveProps() {
  const entries = [], ray = new THREE.Raycaster(), origin = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), hits = [];
  const m4 = new THREE.Matrix4(), world = new THREE.Matrix4(), nm = new THREE.Matrix3(), n = new THREE.Vector3(), tried = new Set();
  const normalY = (hit, object) => {
    world.copy(object.matrixWorld);
    if (object.isInstancedMesh && hit.instanceId !== undefined) { object.getMatrixAt(hit.instanceId, m4); world.multiply(m4); }
    return n.copy(hit.face.normal).applyNormalMatrix(nm.getNormalMatrix(world)).normalize().y;
  };
  return {
    entries,
    add(entry) { entries.push(entry); return entry; },
    // Highest prop surface above `ground` at (x, z), or null. obstacleHeight is capped under the rover's 0.9 m
    // "small obstacle" limit (rover-terrain.js), so a prop never stops the tyres.
    surface(x, z, ground) {
      let best = null; tried.clear();
      for (const e of entries) {
        if (Math.abs(e.x - x) > e.r || Math.abs(e.z - z) > e.r || tried.has(e.object)) continue;
        if (e.alive && !e.alive()) continue;
        tried.add(e.object);
        origin.set(x, ground + 50, z); ray.set(origin, down); ray.far = 60; hits.length = 0;
        ray.intersectObject(e.object, false, hits);
        const hit = hits[0];
        if (hit && hit.point.y > ground && (!best || hit.point.y > best.height))
          best = { height: hit.point.y, normalY: normalY(hit, e.object), obstacleHeight: Math.min(hit.point.y - ground, 0.85), prop: true };
      }
      return best;
    },
  };
}
