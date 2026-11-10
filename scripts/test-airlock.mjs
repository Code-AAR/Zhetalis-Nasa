import assert from 'node:assert/strict';
import {AirlockCycle,canExitHabitat} from '../game/src/airlock-state.js';
assert.equal(canExitHabitat({equipped:false,checked:true}),false);
assert.equal(canExitHabitat({equipped:true,checked:false}),false);
assert.equal(canExitHabitat({equipped:true,checked:true}),true);
for(const dir of ['in','out']){
 const c=new AirlockCycle(dir),samples=[];
 for(let i=0;i<100;i++){assert.equal(c.canOpen('inner'),false);assert.equal(c.canOpen('outer'),false);samples.push(c.pressure);c.tick(.1);}
 c.tick(.01);assert.ok(c.ready);assert.equal(c.canOpen(dir==='out'?'outer':'inner'),true);assert.equal(c.canOpen(dir==='out'?'inner':'outer'),false);
 for(let i=1;i<samples.length;i++)assert.ok(dir==='out'?samples[i]<=samples[i-1]:samples[i]>=samples[i-1]);
 const cancel=new AirlockCycle(dir==='out'?'in':'out');cancel.startPressure=50;assert.equal(cancel.pressure,50);cancel.tick(100);assert.ok(cancel.ready);
}
console.log('Airlock interlocks, suit checks, pressure ramps and reversal passed.');
