export function blockPanel(pos, c, radius) {
  const dx = pos.x - c.x, dz = pos.z - c.z;
  const x = Math.max(-c.halfX, Math.min(c.halfX, dx));
  const z = Math.max(-c.halfZ, Math.min(c.halfZ, dz));
  const ex = dx - x, ez = dz - z, distance = Math.hypot(ex, ez);
  if (distance >= radius) return false;
  if (distance > 0.000001) {
    pos.x = c.x + x + ex / distance * radius;
    pos.z = c.z + z + ez / distance * radius;
  } else if (c.halfX - Math.abs(dx) < c.halfZ - Math.abs(dz)) {
    pos.x = c.x + (dx < 0 ? -1 : 1) * (c.halfX + radius);
  } else {
    pos.z = c.z + (dz < 0 ? -1 : 1) * (c.halfZ + radius);
  }
  return true;
}
