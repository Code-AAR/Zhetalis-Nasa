import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Outpost} from '../game/src/sim.js';
import {renewDeposits,builderQuest} from '../game/src/builder-recipes.js';
const facts=JSON.parse(readFileSync(new URL('../game/data/mars-facts.json',import.meta.url))).facts;
let attempts=0;
for(let run=0;run<100;run++){
 const o=new Outpost('normal',facts);o.powerStep=6;o.baseConnected=true;o.scienceSent=300;o.parts=run;
 for(let i=0;i<100;i++){const before=o.parts;const ok=o.buy('panel');assert.ok(o.parts>=0);assert.ok(o.panels<=12);assert.equal(before-o.parts,ok?4:0);attempts++;}
}
const s={mined:[],hits:{},oreRenewedSol:0};let cycles=0;
for(let sol=1;sol<=1000;sol++){
 s.mined=[0,1,2,3];s.hits={0:3,1:3,2:3,3:3};
 assert.deepEqual(renewDeposits(s,sol,id=>id%2===0),[0,2]);assert.deepEqual(s.mined,[1,3]);
 const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(renewDeposits(saved,sol,()=>true),[]);assert.deepEqual(saved.mined,[1,3]);cycles++;
}
assert.match(builderQuest({powerStep:6,baseConnected:true,panels:12},{buildPlan:'panel'}).step,/full/);
console.log(`${attempts} purchase attempts and ${cycles} daily-renewal/save cycles passed; no negative parts or invisible extra panels.`);
