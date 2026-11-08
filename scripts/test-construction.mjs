import assert from 'node:assert/strict';
import {fitPart,assemblyDone,buildState,circuitFor,circuitReady,circuitConnected,firstMissionReport,ASSEMBLIES} from '../game/src/construction-state.js';
const o={powerStep:1,baseConnected:false,chargerStep:0};
assert.equal(fitPart(o,'array','Solar module','Support frame'),false);
for(const p of ASSEMBLIES.array)assert.equal(fitPart(o,'array',p,p),true);
assert.ok(assemblyDone(o,'array'));assert.equal(fitPart(o,'array','Solar module','Solar module'),false);
assert.equal(circuitFor('solar-out','base-in'),-1);assert.equal(circuitFor('solar-out','solar-out'),-1);
assert.equal(circuitFor('battery-in','solar-out'),0);assert.equal(circuitReady(o,0),false);
o.powerStep=5;assert.ok(circuitReady(o,0));assert.equal(circuitReady(o,1),false);
o.powerStep=6;assert.ok(circuitReady(o,1));o.baseConnected=true;assert.equal(circuitReady(o,1),false);
o.chargerStep=2;assert.ok(circuitReady(o,2));
buildState(o).removed.push(5);buildState(o).cleared.push(1);
const restored=JSON.parse(JSON.stringify(o));assert.ok(assemblyDone(restored,'array'));assert.deepEqual(buildState(restored).removed,[5]);
assert.equal(firstMissionReport(o,{farmQuest:{waterMade:true,rewarded:true}}).filter(x=>x.done).length,4);
console.log('Wrong parts/cables rejected, assembly and circuit gates, repeat placement, save persistence and first-base debrief passed.');

assert.equal(circuitConnected(o,2),false);o.chargerStep=3;assert.equal(circuitConnected(o,2),true);assert.equal(circuitReady(o,2),false);assert.equal(circuitConnected(o,1),true);assert.equal(circuitConnected(o,0),true);assert.equal(circuitConnected(o,-1),false);
