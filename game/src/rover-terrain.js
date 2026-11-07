// Game traversal limits, not a specification for NASA's real rover.
export const ROVER_MOTION = { max: 18, reverse: 5, accel: 9, brake: 14 };
const slopeLimit = Math.cos(45 * Math.PI / 180);
const contacts = [-2.2, 0, 2.2].flatMap(f => [-1.6, 0, 1.6].map(r => [f, r]));

// Short swept steps stop fast vehicles tunnelling through a rock face. Compare
// the actual support at each tyre and under the belly, rather than rock radius.
export function moveOverSurface(pos, dx, dz, yaw, sample) {
  const distance = Math.hypot(dx, dz);
  if (!distance) return 1;
  const count = Math.ceil(distance / .2), sx = dx / count, sz = dz / count;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  for (let i = 0; i < count; i++) {
    for (const [f, r] of contacts) {
      const x = pos.x + sin * f + cos * r, z = pos.z + cos * f - sin * r;
      const before = sample(x, z), after = sample(x + sx, z + sz);
      const rise = after.height - before.height;
      // Tyres can step over a small lip; a tall vertical side still blocks.
      if (rise > .22 + distance / count || (rise > .04 && after.normalY < slopeLimit)) return i / count;
    }
    pos.x += sx; pos.z += sz;
  }
  return 1;
}
