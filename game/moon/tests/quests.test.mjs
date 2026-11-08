// Node tests for the quest layer. Run: node game/moon/tests/quests.test.mjs
import assert from 'node:assert/strict';
import { SITES } from '../src/config.js';
import * as sim from '../src/sim.js';
import { currentObjective, questLog, warnings, mapMarker, optionalQuests } from '../src/quests.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const ctx = (place = 'outside', player = { x: 0, z: 20 }, rover = { x: SITES.rover.x, z: SITES.rover.z }) => ({ place, player, rover });

test('objective follows the mission and points at real places', () => {
  const s = sim.newState();
  let o = currentObjective(s, ctx('hab'));
  assert.equal(o.id, 'stepDown'); assert.equal(o.target, null); assert.equal(o.index, 0);
  o = currentObjective(s, ctx('outside')); assert.ok(o.target); assert.notEqual(o.key, currentObjective(s, ctx('hab')).key);
  s.tasks.stepDown = true;
  o = currentObjective(s, ctx('outside', { x: 50, z: -40 }));
  assert.equal(o.id, 'mast'); assert.deepEqual([o.target.x, o.target.z], [SITES.masts[1].x, SITES.masts[1].z], 'nearest free mast');
  s.masts[1] = true; s.tasks.mast = true;
  o = currentObjective(s, ctx('outside')); assert.equal(o.id, 'drive'); assert.equal(o.target.label, 'Rover');
  o = currentObjective(s, ctx('rover')); assert.equal(o.target.x, SITES.iceCrater.x); assert.notEqual(o.key, 'drive:board');
});

test('ice chain sub-steps change the target', () => {
  const s = sim.newState(); for (const k of ['stepDown', 'mast', 'drive', 'ice']) s.tasks[k] = true;
  assert.equal(currentObjective(s, ctx()).target.x, SITES.drill.x, 'no ice: go to the drill');
  s.roverIce = 2; assert.equal(currentObjective(s, ctx()).target.x, SITES.processor.x, 'carrying: go to the processor');
  s.roverIce = 0; s.processorIce = 1; assert.match(currentObjective(s, ctx()).step, /melter/i);
});

test('samples: collect nearest, then stow at the lander', () => {
  const s = sim.newState(); for (const k of ['stepDown', 'mast', 'drive', 'ice', 'deliver', 'oxygen']) s.tasks[k] = true;
  let o = currentObjective(s, ctx('outside', { x: -120, z: 55 })); assert.equal(o.id, 'samples'); assert.equal(o.target.x, -120);
  s.carried = ['anorthosite', 'breccia', 'glass']; o = currentObjective(s, ctx()); assert.match(o.target.label, /stow/i);
});

test('all done gives free exploration; log groups quests', () => {
  const s = sim.newState(); s.tasks.stepDown = true; s.tasks.mast = true;
  const log = questLog(s, ctx());
  assert.equal(log.completed.length, 2); assert.equal(log.active.id, 'drive'); assert.equal(log.upcoming.length, sim.TASKS.length - 3);
  assert.ok(log.optional.length >= 4 && log.optional.every(q => q.title && q.progress !== undefined));
  for (const k in s.tasks) s.tasks[k] = true; assert.equal(currentObjective(s, ctx()).id, 'free');
  s.masts = [true, true, true]; assert.ok(optionalQuests(s).find(q => q.id === 'all-masts').done);
});

test('warnings: solar alert is critical and sorted first', () => {
  const s = sim.newState(); s.suitO2 = 20; s.battery = 10; s.alert = { start: s.t, until: s.t + 85 };
  const w = warnings(s, { place: 'outside', sunLit: 0 });
  assert.equal(w[0].id, 'sep'); assert.equal(w[0].level, 'critical');
  assert.ok(w.some(x => x.id === 'suitO2') && w.some(x => x.id === 'battery') && w.at(-1).level === 'info');
  assert.ok(!warnings(s, { place: 'hab' }).some(x => x.id === 'suitO2'), 'suit warnings only outside');
});

test('minimap marker: inside the circle at the right spot, clamped arrow at the rim outside it', () => {
  const inside = mapMarker({ x: 30, z: -60 }, { x: 0, z: 0 });
  assert.equal(inside.clamped, false); assert.ok(Math.abs(inside.x - (80 + 20)) < 1e-9 && Math.abs(inside.y - (80 - 40)) < 1e-9);
  const far = mapMarker({ x: 300, z: 0 }, { x: 0, z: 0 });
  assert.equal(far.clamped, true); assert.ok(Math.hypot(far.x - 80, far.y - 80) <= 80 - 10); assert.equal(Math.round(far.metres), 300);
  assert.ok(Math.abs(far.angle) < 1e-9, 'points east');
  assert.equal(mapMarker(null, { x: 0, z: 0 }), null);
});

console.log(`\n${passed} quest tests passed.`);
