// Textured Mars boulders (assets/mars-rocks.glb: 15 rock meshes with colour and surface-detail maps) scattered
// across the map, mixed in with the procedural rocks. Every rock is scaled to 0.3-0.8 m tall, under the rover's
// 0.9 m step limit, and registered as a drive-over prop, so the crew rover can drive onto and across all of them.
// The astronaut walks around them (a small circle each). Kept clear of the base, Spirit's stops, the survey
// sites, the mineral zones and the landing pad. Placement is fixed (seeded), so it is the same on every visit.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';
import { nearStop, KEEP_CLEAR } from './landmarks.js';
import { zoneAt, STARTER } from './resource-zones.js';
import { WORLD_HALF } from './chunk-plan.js';

export async function addMarsRockField(world, heightAt, { count = 110 } = {}) {
  const gltf = await loadModel('mars-rocks.glb'); if (!gltf) return null;
  gltf.scene.updateMatrixWorld(true);
  // one centred, ground-based geometry per rock shape (the file lays the 15 rocks out on a grid)
  const shapes = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.computeBoundingBox();
    const b = g.boundingBox, c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
    shapes.push({ geometry: g, material: o.material, size: g.boundingBox.getSize(new THREE.Vector3()) });
  });
  if (!shapes.length) return null;
  let seed = 4242; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const placed = shapes.map(() => []), lim = WORLD_HALF - 24;
  const clear = (x, z) => Math.hypot(x, z) > 60 && !nearStop(x, z, 16) && !zoneAt(x, z)
    && !KEEP_CLEAR.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 6)
    && !STARTER.some(([, sx, sz]) => Math.hypot(x - sx, z - sz) < 10)
    && !world.colliders.some(c => !c.rock && Math.hypot(c.x - x, c.z - z) < (c.r || 2) + 4);
  let tries = 0, made = 0;
  while (made < count && tries++ < count * 30) {
    // clumps: rocks gather in small groups, like the boulder fields around Gusev's craters
    const cx = (rng() * 2 - 1) * lim, cz = (rng() * 2 - 1) * lim, n = 1 + Math.floor(rng() * 4);
    for (let k = 0; k < n && made < count; k++) {
      const x = cx + (rng() - .5) * 9, z = cz + (rng() - .5) * 9;
      if (!clear(x, z)) continue;
      const i = Math.floor(rng() * shapes.length), s = shapes[i], h = 0.3 + rng() * rng() * 0.5;   // mostly small, a few up to 0.8 m
      placed[i].push({ x, z, scale: h / s.size.y, yaw: rng() * Math.PI * 2 }); made++;
    }
  }
  const group = new THREE.Group(); group.name = 'Mars rock field'; world.scene.add(group);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  shapes.forEach((s, i) => {
    if (!placed[i].length) return;
    const mesh = new THREE.InstancedMesh(s.geometry, s.material, placed[i].length);
    mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'Mars rocks ' + i;
    placed[i].forEach((r, k) => {
      const slope = new THREE.Vector3(heightAt(r.x - .5, r.z) - heightAt(r.x + .5, r.z), 1, heightAt(r.x, r.z - .5) - heightAt(r.x, r.z + .5)).normalize();
      q.setFromUnitVectors(up, slope).multiply(new THREE.Quaternion().setFromAxisAngle(up, r.yaw));
      const h = s.size.y * r.scale;
      m.compose(p.set(r.x, heightAt(r.x, r.z) - h * 0.12, r.z), q, sc.setScalar(r.scale)); mesh.setMatrixAt(k, m);   // sunk a little into the soil
      const reach = Math.max(s.size.x, s.size.z) * r.scale / 2;
      world.driveProps?.add({ x: r.x, z: r.z, r: reach + 0.3, object: mesh });
      world.colliders.push({ x: r.x, z: r.z, r: reach * 0.75, driveOver: true, top: heightAt(r.x, r.z) + h });   // astronaut walks round; rover drives over
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.updateMatrixWorld(true);
    group.add(mesh);
  });
  return { group, count: made };
}
