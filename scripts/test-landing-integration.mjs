import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Outpost,SITES,TUNED} from '../game/src/sim.js';
const facts=JSON.parse(readFileSync(new URL('../game/data/mars-facts.json',import.meta.url))).facts;
for(const site of Object.keys(SITES)){
 const o=new Outpost('normal',facts,site);
 assert.equal(o.site,site);
 assert.equal(o.forecast().heater,TUNED.heaterKWh*SITES[site].heater);
 assert.equal(o.food,o.crew*3);
 assert.ok(o.rations>0);
 o.parts=100;
 assert.equal(o.buy('battery'),false,'Keep power commissioning gate');
 const protections=[];
 for(let i=0;i<3;i++){assert.ok(o.buy('regolith'));protections.push(o.today.protection);}
 assert.ok(protections[0]<protections[1]&&protections[1]<protections[2]);
 assert.equal(o.buy('regolith'),false);
 o.powerStep=6;assert.ok(o.buy('battery'));
 const restored=new Outpost('normal',facts);
 Object.assign(restored,JSON.parse(JSON.stringify(o)));restored.today=restored.forecast();
 assert.equal(restored.site,site);assert.equal(restored.upgrades.regolith,3);
 assert.ok(Object.values(restored.today).every(x=>typeof x!=='number'||Number.isFinite(x)));
}
console.log('All four sites: resource modifiers, commissioning, shielding cap and save round-trip passed.');
