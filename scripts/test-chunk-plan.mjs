import assert from 'node:assert/strict';
import {chunkPlan,MINIMAP_SPAN,CHUNK_SIZE} from '../game/src/chunk-plan.js';
for(const radius of [1,2,3])for(const x of [-900,-608,-1,0,607,900])for(const z of [-900,-608,0,607,900]){
 const p=chunkPlan(x,z,radius);assert.ok(p.length>0&&p.length<=(2*radius+1)**2);
 assert.equal(new Set(p.map(c=>c.key)).size,p.length);
 assert.ok(p.every(c=>c.x>=0&&c.x<19&&c.z>=0&&c.z<19));
 assert.equal(p[0].distance,0);
}
for(const radius of [1,2,3])assert.equal(chunkPlan(0,0,radius).length,(radius*2+1)**2);
assert.ok(chunkPlan(0,0,100).length<=49);
assert.notDeepEqual(chunkPlan(0,0,1),chunkPlan(200,200,1));
console.log('Chunk residency budgets, bounds, ordering and movement checks passed');

// The map option includes every tile touched by the minimap circle, including tile boundaries.
for(let x=-608;x<=608;x+=13)for(let z=-608;z<=448;z+=17){
 const p=chunkPlan(x,z,'map'),keys=new Set(p.map(c=>c.key));assert.ok(p.length<=36);assert.equal(keys.size,p.length);
 for(let dx=-120;dx<=120;dx+=12)for(let dz=-120;dz<=120;dz+=12){
  if(dx*dx+dz*dz>(MINIMAP_SPAN/2)**2)continue;
  const px=x+dx,pz=z+dz;if(px< -608||pz< -608||px>=608||pz>=448)continue;
  assert.ok(keys.has(`${Math.floor((px+608)/CHUNK_SIZE)},${Math.floor((pz+608)/CHUNK_SIZE)}`),'Visible minimap point must have resident tile');
 }
}
console.log('Minimap coverage and bounded map-sized residency passed');
