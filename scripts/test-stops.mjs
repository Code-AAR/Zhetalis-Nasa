// Spirit's stops: data is complete, every stop is reachable, and Home Plate's outline stays sensible.
import assert from 'node:assert/strict';
import { SITES } from '../game/src/site-data.js';
import { LANDMARKS, plateRadius, plateProfile } from '../game/src/landmarks.js';
const WALK_R = 1216 * .42;
const ids = new Set();
for (const s of SITES) {
  assert.ok(!ids.has(s.id), 'duplicate stop id ' + s.id); ids.add(s.id);
  for (const k of ['name', 'kind', 'kid', 'source', 'url', 'verb']) assert.ok(s[k], `${s.id} has ${k}`);
  assert.match(s.url, /^https:\/\//, `${s.id} source link is https`);
  assert.ok(Math.hypot(s.x, s.z) < WALK_R - 20, `${s.id} is inside the walk limit`);
  assert.ok(Number.isFinite(s.points) && s.points > 0, `${s.id} gives science`);
}
assert.equal(SITES.length, 5);
assert.ok(ids.has('gertrude') && !ids.has('tyrone'), 'the silica stop is Gertrude Weise');
const hp = LANDMARKS.find(l => l.id === 'homeplate');
for (let a = 0; a < Math.PI * 2; a += .05) { const r = plateRadius(hp, a); assert.ok(r > hp.r * .75 && r < hp.r * 1.25, 'Home Plate outline stays round-ish'); }
assert.equal(plateProfile(.5), 1); assert.equal(plateProfile(1.7), 0);
assert.ok(Math.abs(plateProfile(1) - .42) < 1e-9, 'the cliff foot meets the apron');
const stop = SITES.find(s => s.id === 'homeplate'), d = Math.hypot(stop.x - hp.x, stop.z - hp.z) / plateRadius(hp, Math.atan2(stop.z - hp.z, stop.x - hp.x));
assert.ok(d > 1 && d < 1.2, 'the Home Plate stop stands at the foot of the rim');
console.log('stops ok');
