// Node tests for the Moon mission's pure modules. Run: node game/moon/tests/moon-core.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOON, WORLD, CHUNKS_PER_SIDE, GAME_DAY_SECONDS, SITES } from '../src/config.js';
import { heightAt, chunkPlan, clampToWorld, permanentShadow, CRATERS, normalAt, MAP_CHUNK_CAP, MINIMAP_SPAN, chunkOrigin } from '../src/terrain.js';
import { sunAt, horizonAt, sunlitFraction, earthAt } from '../src/sun.js';
import * as sim from '../src/sim.js';
import { packSave, writeSave, readSave, SAVE_KEY, MAX_PRINTS } from '../src/save.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const data = p => JSON.parse(readFileSync(new URL('../../data/' + p, import.meta.url), 'utf8'));

test('real lunar constants', () => {
  assert.equal(MOON.gravity, 1.62);
  assert.equal(MOON.synodicDays, 29.53);
});

test('terrain is deterministic and finite everywhere in bounds', () => {
  for (let i = 0; i < 2000; i++) {
    const x = (Math.random() * 2 - 1) * WORLD.half, z = (Math.random() * 2 - 1) * WORLD.half;
    const h = heightAt(x, z); assert.ok(Number.isFinite(h)); assert.equal(h, heightAt(x, z));
    // Bounds cover the measured patch (-138..24 m relative to origin) and synthetic crater depths.
    assert.ok(h > -230 && h < 80, `height ${h} at ${x},${z}`);
  }
  assert.ok(Number.isFinite(normalAt(10, 10).y));
});

test('landing pad is gentle and the ice crater is deep and permanently shadowed', () => {
  const n = normalAt(0, 0); assert.ok(n.y > 0.97, 'pad slope');
  const c = SITES.iceCrater; assert.ok(heightAt(c.x, c.z) < heightAt(0, 0) && heightAt(c.x, c.z) < heightAt(c.x + c.r, c.z) - 14, 'crater floor well below the base and rim');
  assert.equal(permanentShadow(c.x, c.z), 1); assert.equal(permanentShadow(0, 0), 0);
  assert.ok(CRATERS.length > 150, 'crater field');
});

test('chunk planner is bounded for any input', () => {
  for (const [x, z, r] of [[0, 0, 2], [1e9, -1e9, 2], [NaN, NaN, 9], [-WORLD.half, WORLD.half, 3], [12, 40, 0]]) {
    const plan = chunkPlan(x, z, r), rad = Math.max(1, Math.min(3, Math.floor(r) || 2));
    assert.ok(plan.length >= 1 && plan.length <= (2 * rad + 1) ** 2);
    for (const c of plan) { assert.ok(c.x >= 0 && c.x < CHUNKS_PER_SIDE && c.z >= 0 && c.z < CHUNKS_PER_SIDE); }
    assert.equal(new Set(plan.map(c => c.key)).size, plan.length);
  }
  assert.ok(chunkPlan(0, 0).length <= WORLD.maxDetailed);
});

test('map detail covers the whole 240 m minimap circle with at most 16 chunks', () => {
  assert.equal(WORLD.detailRadius, 'map');
  for (let k = 0; k < 400; k++) {
    const x = (Math.random() * 2 - 1) * WORLD.half, z = (Math.random() * 2 - 1) * WORLD.half, plan = chunkPlan(x, z, 'map');
    assert.ok(plan.length >= 1 && plan.length <= MAP_CHUNK_CAP, 'count ' + plan.length);
    const keys = new Set(plan.map(c => c.key));
    for (let a = 0; a < 24; a++) for (const f of [0.3, 0.7, 0.999]) {
      const px = x + Math.cos(a / 24 * 6.283) * MINIMAP_SPAN / 2 * f, pz = z + Math.sin(a / 24 * 6.283) * MINIMAP_SPAN / 2 * f;
      if (Math.abs(px) >= WORLD.half || Math.abs(pz) >= WORLD.half) continue;
      const ix = Math.floor((px + WORLD.half) / WORLD.chunk), iz = Math.floor((pz + WORLD.half) / WORLD.chunk);
      assert.ok(keys.has(ix + ',' + iz), 'gap at ' + px.toFixed(1) + ',' + pz.toFixed(1));
    }
  }
  assert.ok(chunkPlan(NaN, Infinity, 'map').length <= MAP_CHUNK_CAP);
  assert.ok(Number.isFinite(chunkOrigin(0, 0).x));
});

test('player is kept inside the world', () => {
  const p = { x: 9999, z: -9999 }; assert.equal(clampToWorld(p), true);
  assert.ok(Math.abs(p.x) < WORLD.half && Math.abs(p.z) < WORLD.half);
});

test('sun circles the polar sky low, once per lunar day, and LOLA horizon blocks it sometimes', () => {
  const site = data('moon-site.json');
  assert.equal(site.horizon.length, 360);
  assert.match(site.source.url, /svs\.gsfc\.nasa\.gov/);
  const els = [], azs = [];
  for (let i = 0; i < 100; i++) { const s = sunAt(i / 100 * GAME_DAY_SECONDS, { horizon: site.horizon }); els.push(s.el); azs.push(s.az); }
  assert.ok(Math.max(...els) < 2.2 && Math.min(...els) > -2.2, 'sun stays near the horizon at the pole');
  assert.ok(Math.max(...azs) - Math.min(...azs) > 340, 'sun goes all the way round');
  const winter = sunlitFraction(site.horizon, 1), summer = sunlitFraction(site.horizon, -1);
  assert.ok(winter < summer, 'more light in southern summer');
  assert.ok(Math.abs(winter - site.sunlitFraction.southernWinter) < 0.08, 'matches fetch script');
  assert.equal(horizonAt([{ el: 1 }, { el: 3 }], 90), 2);
  assert.ok(typeof earthAt(0, { horizon: site.horizon }).visible === 'boolean');
});

test('every choice costs: oxygen maker uses power and water', () => {
  const a = sim.newState(), b = sim.newState();
  sim.toggleElectrolysis(b);
  for (let i = 0; i < 100; i++) { sim.tick(a, 0.2, { lit: 1, place: 'hab' }); sim.tick(b, 0.2, { lit: 1, place: 'hab' }); }
  assert.ok(b.battery < a.battery - 4, 'power cost');
  assert.ok(b.water < a.water - 1, 'water cost');
  assert.ok(b.oxygen > a.oxygen + 2, 'oxygen gain');
});

test('dark periods drain the battery; solar masts refill it', () => {
  const s = sim.newState(); const start = s.battery;
  for (let i = 0; i < 50; i++) sim.tick(s, 0.2, { lit: 0, place: 'hab' });
  assert.ok(s.battery < start);
  sim.deployMast(s, 1); sim.deployMast(s, 2); const mid = s.battery;
  for (let i = 0; i < 50; i++) sim.tick(s, 0.2, { lit: 1, place: 'hab' });
  assert.ok(s.battery > mid); assert.equal(s.tasks.mast, true);
});

test('suit heater in permanent shadow drains suit power faster', () => {
  const a = sim.newState(), b = sim.newState();
  for (let i = 0; i < 50; i++) { sim.tick(a, 0.2, { place: 'outside', shadow: 0 }); sim.tick(b, 0.2, { place: 'outside', shadow: 1 }); }
  assert.ok(b.suitPower < a.suitPower - 3);
});

test('ice → water → oxygen chain completes tasks', () => {
  const s = sim.newState();
  sim.drillIce(s, true); sim.drillIce(s, true); assert.equal(s.tasks.ice, true);
  sim.deliverIce(s, true); assert.equal(s.processorIce, 2);
  for (let i = 0; i < 200; i++) sim.tick(s, 0.25, { lit: 1, place: 'hab' });
  assert.equal(s.tasks.deliver, true);
  sim.toggleElectrolysis(s); for (let i = 0; i < 400; i++) sim.tick(s, 0.25, { lit: 1, place: 'hab' });
  assert.equal(s.tasks.oxygen, true);
});

test('solar particle alert rewards sheltering', () => {
  const inside = sim.newState(), out = sim.newState();
  inside.nextAlert = out.nextAlert = 1;
  for (let i = 0; i < 500; i++) { sim.tick(inside, 0.2, { place: 'hab' }); sim.tick(out, 0.2, { place: 'outside' }); }
  assert.equal(inside.dose, 0); assert.ok(out.dose > 10);
});

test('kids are rescued, not killed; base oxygen at zero ends the mission', () => {
  const s = sim.newState(); s.suitO2 = 0.01;
  const ev = sim.tick(s, 0.2, { place: 'outside' }); assert.ok(ev.some(e => e.type === 'rescue'));
  sim.rescue(s); assert.equal(s.suitO2, 100);
  s.oxygen = 0.001; sim.tick(s, 0.2, { place: 'hab', lit: 0 }); assert.equal(s.status, 'lost');
});

test('all tasks → won', () => {
  const s = sim.newState(); for (const k in s.tasks) s.tasks[k] = true;
  const ev = sim.tick(s, 0.1, {}); assert.equal(s.status, 'won'); assert.ok(ev.some(e => e.type === 'end'));
});

test('save round-trips, is bounded, and rejects junk', () => {
  const mem = new Map(), store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const s = sim.newState(); s.science = 42;
  const prints = Array.from({ length: 1000 }, (_, i) => [i, 0, i, i % 2]);
  writeSave(packSave({ state: s, player: { x: 1, y: 2, z: 3, yaw: 0.5, place: 'outside' }, rover: { x: 4, y: 0, z: 5, yaw: 1 }, prints }), store);
  const back = readSave(store);
  assert.equal(back.state.science, 42); assert.equal(back.player.x, 1); assert.equal(back.prints.length, MAX_PRINTS);
  assert.ok(mem.get(SAVE_KEY).length < 60000, 'small save');
  mem.set(SAVE_KEY, '{"v":1,"state":{"v":1,"t":"x"},"player":{"x":null}}');
  const junk = readSave(store); assert.equal(junk.state, null); assert.equal(junk.player, null);
  mem.set(SAVE_KEY, 'not json'); assert.equal(readSave(store), null);
});

test('facts are sourced from NASA and Artemis I/II are flybys', () => {
  const { facts } = data('moon-facts.json');
  for (const [id, f] of Object.entries(facts)) {
    assert.match(f.source.url, /^https:\/\/([a-z.]+\.)?nasa\.gov\//, id);
    assert.ok(f.title && f.short && f.text, id);
  }
  assert.match(facts['moon-artemis-1'].text, /did not land/i);
  assert.match(facts['moon-artemis-2'].text, /did not land/i);
  assert.match(facts['moon-gravity'].short, /1\.62/);
  assert.match(facts['moon-day'].short, /29\.53/);
});

test('no secrets in shipped data or code', () => {
  let key = '';
  try { key = (readFileSync(new URL('../../../.env', import.meta.url), 'utf8').match(/NASA_API_KEY\s*=\s*"?([^"\r\n]+)/) || [])[1] || ''; } catch { }
  const files = ['data/moon-site.json', 'data/moon-images.json', 'data/moon-facts.json', 'moon/index.html', 'moon/src/main.js', 'moon/src/sim.js'];
  for (const f of files) {
    let text = ''; try { text = readFileSync(new URL('../../' + f, import.meta.url), 'utf8'); } catch { continue; }
    if (key.length > 8) assert.ok(!text.includes(key), 'key leaked into ' + f);
    assert.ok(!/api_key=[A-Za-z0-9]{20,}/.test(text), 'key-like string in ' + f);
  }
  const imgs = data('moon-images.json'); assert.equal(imgs.keyRequired, false);
  for (const i of imgs.items) assert.match(i.page, /^https:\/\/images\.nasa\.gov\/details\//);
});

console.log(`\n${passed} Moon tests passed.`);
