// Surface features: bright soil under the tracks, storm dust on the dark ground, Ma'adim's channel and the viewpoint.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brightZone, HIDDEN } from '../game/src/resource-zones.js';
import { landmarkLift, channelFloor, nearStop, LANDMARKS } from '../game/src/landmarks.js';
import { VIEWPOINTS, SITES } from '../game/src/site-data.js';
import { Outpost } from '../game/src/sim.js';

// bright soil: salt zones, the silica zone and the hidden patch at Troy; nothing at camp or at the carbonate outcrop
assert.equal(brightZone(142, 128)?.ore, 'gypsum', 'Paso Robles is salty');
assert.equal(brightZone(312, 246)?.ore, 'silica', 'Silica Valley is white');
assert.equal(brightZone(215, 262)?.id, HIDDEN[0].id, 'hidden salt at Troy');
assert.equal(brightZone(0, 0), null);
assert.equal(brightZone(232, 205), null, 'carbonate rock is not bright soil');

// the channel: carved below the valley floor along its line, untouched 40 m away, never near camp
const ch = LANDMARKS.find(l => l.kind === 'channel');
for (const [x, z] of ch.path) assert.ok(landmarkLift(x, z) < landmarkLift(x + 30, z - 20) - 2.2, `channel is carved at ${x},${z}`);
assert.ok(landmarkLift(ch.path[5][0] + 45, ch.path[5][1]) > -.01, 'banks 45 m away are not carved');
assert.equal(channelFloor(ch.path[5][0], ch.path[5][1]), 1);
assert.equal(channelFloor(0, 0), 0);

// viewpoints: rocks keep clear, and none sits on a stop
for (const v of VIEWPOINTS) {
  assert.ok(nearStop(v.x, v.z), 'no boulders on the cairn');
  assert.ok(SITES.every(s => Math.hypot(s.x - v.x, s.z - v.z) > 30));
  assert.ok(Math.hypot(v.x, v.z) < 1216 * .42 - 10, 'reachable');
}

// storm dust: a storm coats the ground, then it clears over the following sols
const facts = JSON.parse(readFileSync(new URL('../game/data/mars-facts.json', import.meta.url))).facts;
const o = new Outpost('normal', facts), rng = () => .5, live = () => { o.over = null; o.o2 = o.food = 999; o.dose = 0; };
live(); o.dust = 3; o.tick(rng); assert.ok(o.dustCover > .3, 'storm drops dust');
live(); o.tick(rng); live(); o.tick(rng); assert.ok(o.dustCover > .9, 'thick after a long storm');
const after = o.dustCover; live(); o.tick(rng); assert.ok(o.dustCover < after, 'dust devils sweep it off');
for (let i = 0; i < 12; i++) { live(); o.dust = 0; o.tick(rng); }
assert.equal(o.dustCover, 0, 'clean again about 9 sols later');
console.log('Bright soil, storm dust, channel and viewpoint checks passed');
