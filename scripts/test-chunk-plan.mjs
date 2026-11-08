import assert from 'node:assert/strict';
import {chunkPlan} from '../game/src/chunk-plan.js';
for(const radius of [1,2,3])for(const x of [-900,-320,-1,0,319,900])for(const z of [-900,-320,0,319,900]){
 const p=chunkPlan(x,z,radius);assert.ok(p.length>0&&p.length<=(2*radius+1)**2);
 assert.equal(new Set(p.map(c=>c.key)).size,p.length);
 assert.ok(p.every(c=>c.x>=0&&c.x<10&&c.z>=0&&c.z<10));
 assert.equal(p[0].distance,0);
}
for(const radius of [1,2,3])assert.equal(chunkPlan(0,0,radius).length,(radius*2+1)**2);
assert.ok(chunkPlan(0,0,100).length<=49);
assert.notDeepEqual(chunkPlan(0,0,1),chunkPlan(200,200,1));
console.log('Chunk residency budgets, bounds, ordering and movement checks passed');
