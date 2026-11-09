// Mineral zones: every rock lands where it should, never inside a stop scene, and the same for every player.
import assert from 'node:assert/strict';
import { ZONES, STARTER, ID_BASE, placeDeposits, softSoil, zoneAt } from '../game/src/resource-zones.js';
import { SITES } from '../game/src/site-data.js';
const WALK_R = 1216 * .42, flat = () => 0;
const a = placeDeposits(flat), b = placeDeposits(flat);
assert.deepEqual(a, b, 'same rocks for every player');
assert.equal(new Set(a.map(d => d.id)).size, a.length, 'unique ids');
assert.ok(a.every(d => d.id >= ID_BASE), 'new ids start at ID_BASE');
for (const d of a) {
  assert.ok(Math.hypot(d.x, d.z) < WALK_R - 10, `${d.ore} at ${d.x|0},${d.z|0} is reachable`);
  assert.ok(SITES.every(s => Math.hypot(d.x - s.x, d.z - s.z) >= 9), 'no rock inside a stop scene');
  if (d.zone !== 'starter') { const z = ZONES.find(zn => zn.id === d.zone); assert.ok(Math.hypot(d.x - z.x, d.z - z.z) <= z.r + 1e-6, 'rock inside its zone'); assert.equal(d.ore, z.ore); }
}
assert.equal(a.filter(d => d.zone === 'starter').length, STARTER.length);
for (const ore of ['hematite', 'gypsum', 'iron', 'silica', 'carbonate']) assert.ok(a.some(d => d.ore === ore && d.zone !== 'starter'), ore + ' has a zone');
assert.ok(softSoil(142, 128) > .9 && softSoil(0, 0) === 0, 'salty soil is soft, camp is firm');
assert.equal(zoneAt(-235, 40)?.id, 'meteorites');
const steep = (x, z) => x * 2;                      // a slope everywhere: zones skip rocks they cannot place
assert.equal(placeDeposits(steep).filter(d => d.zone !== 'starter').length, 0);
console.log(`resource zones ok (${a.length} rocks)`);
