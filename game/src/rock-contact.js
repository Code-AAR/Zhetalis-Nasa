import * as THREE from 'three';

// The same rendered triangles determine both the wall and the walkable top.
export function createRockContact(rocks) {
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const hits = [];
  rocks.updateMatrixWorld(true);

  function cast() {
    hits.length = 0;
    ray.intersectObject(rocks, false, hits);
    return hits[0];
  }

  return {
    height(x, z, ceiling) {
      origin.set(x, ceiling, z);
      ray.set(origin, down);
      ray.far = Infinity;
      return cast()?.point.y ?? -Infinity;
    },
    block(position, previous) {
      direction.set(position.x - previous.x, 0, position.z - previous.z);
      const distance = direction.length();
      if (distance < 0.000001) return;
      direction.divideScalar(distance);
      const radius = 0.28;
      let allowed = distance;
      for (const height of [0.45, 1.1, 1.65]) {
        origin.set(previous.x, Math.max(previous.y, position.y) + height, previous.z);
        ray.set(origin, direction);
        ray.far = distance + radius;
        const hit = cast();
        if (hit) allowed = Math.min(allowed, Math.max(0, hit.distance - radius));
      }
      position.x = previous.x + direction.x * allowed;
      position.z = previous.z + direction.z * allowed;
    },
  };
}
