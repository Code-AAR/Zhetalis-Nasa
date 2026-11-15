// Run: node scripts/test-light-time.mjs
import assert from 'node:assert/strict';
import { earthMarsLightTime, heliocentric, lightTimeWords } from '../game/src/light-time.js';

// 27 Aug 2003: the famous close approach, about 55.76 million km (NASA).
const close = earthMarsLightTime(new Date('2003-08-27T10:00:00Z'));
assert.ok(Math.abs(close.km - 55.76e6) < 0.4e6, 'close approach distance ' + close.km);
assert.ok(close.minutes > 3.0 && close.minutes < 3.2, 'about 3.1 light-minutes at closest');

// Earth stays about 1 AU from the Sun, Mars between 1.38 and 1.67 AU.
for (const d of ['2020-01-01', '2026-11-11', '2035-06-01']) {
  const e = heliocentric('earth', new Date(d)), m = heliocentric('mars', new Date(d));
  assert.ok(Math.abs(Math.hypot(e.x, e.y, e.z) - 1) < 0.02); const r = Math.hypot(m.x, m.y, m.z); assert.ok(r > 1.37 && r < 1.68, 'Mars radius ' + r);
}

// Every day for 16 years stays inside the 3-22 minute range the game teaches, and reaches both ends.
let min = 99, max = 0;
for (let i = 0; i < 365 * 16; i += 3) { const t = earthMarsLightTime(new Date(Date.UTC(2020, 0, 1 + i))).minutes; min = Math.min(min, t); max = Math.max(max, t); }
assert.ok(min > 3 && min < 5.5, 'minimum ' + min); assert.ok(max > 20 && max < 22.4, 'maximum ' + max);

assert.equal(lightTimeWords(760), '12 min 40 s'); assert.equal(lightTimeWords(179.7), '3 min 0 s');
console.log('Earth-Mars light time: close approach, orbit radii, 3-22 minute range and wording passed.');
