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

import {socketPartner,socketFeedback,nextWiringSocket,circuitRequirement} from '../game/src/construction-state.js';
for(const [a,b] of [['solar-out','battery-in'],['battery-out','base-in'],['base-out','charger-in']]){assert.equal(socketPartner(a),b);assert.equal(socketPartner(b),a);}
const fresh={powerStep:5,baseConnected:false,chargerStep:0};
assert.equal(nextWiringSocket(fresh,'power'),'solar-out');
assert.equal(nextWiringSocket(fresh,'power','solar-out'),'battery-in');
assert.match(socketFeedback(fresh,'charger-in','solar-out'),/Wrong socket.*Battery controller IN/);
assert.match(socketFeedback(fresh,'battery-out'),/Solar array OUT.*first/);
fresh.powerStep=6;assert.equal(nextWiringSocket(fresh,'base'),'battery-out');
assert.equal(nextWiringSocket(fresh,'base','battery-out'),'base-in');
fresh.baseConnected=true;assert.match(circuitRequirement(fresh,2),/Assemble/);
fresh.chargerStep=1;assert.match(circuitRequirement(fresh,2),/Place/);
fresh.chargerStep=2;assert.equal(nextWiringSocket(fresh,'charger'),'base-out');
assert.equal(nextWiringSocket(fresh,'locker','base-out'),'charger-in');
fresh.chargerStep=3;assert.equal(nextWiringSocket(fresh,'charger'),null);
assert.match(socketFeedback(fresh,'charger-in'),/already connected/);
console.log('Socket destinations, prerequisite messages, wrong cable and restored connection checks passed.');
