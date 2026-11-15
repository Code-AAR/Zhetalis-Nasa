// Solar power over a sol uses the panels' average cleanliness (sim.js tick), so cleaning mid-sol counts.
import assert from 'node:assert/strict';
import { Outpost, DIFFICULTY } from '../game/src/sim.js';
const diff = Object.keys(DIFFICULTY)[1], facts = new Proxy({}, { get: () => ({ value: 1 }) });
const make = () => { const o = new Outpost(diff, facts, 'plains'); Object.assign(o, { powerStep: 6, baseConnected: true, panels: 4, dust: 0 }); return o; };
const a = make(); a.clean = .5; a.cleanSum = 1 * .5 + .5 * .5; a.cleanT = 1;   // clean for half the sol, dusty for the other half
const used = []; const orig = a.forecast.bind(a); a.forecast = () => { used.push(a.clean); return orig(); };
a.tick();
assert.equal(used[0], .75, 'the sol is scored at the average cleanliness');
assert.equal(a.cleanT, 0); assert.equal(a.cleanSum, 0);
const b = make(); b.clean = .8; const usedB = []; const origB = b.forecast.bind(b); b.forecast = () => { usedB.push(b.clean); return origB(); };
b.tick(); assert.equal(usedB[0], .8, 'no samples: current cleanliness');
console.log('panel average: all checks passed');
