import assert from 'node:assert/strict';
import {blockAccessRails} from '../game/src/access-rails.js';
const entrances=Array.from({length:6},(_,index)=>({x:index*12,doorZ:5,landingEnd:7,bottom:11.8,y:2.4}));
for(const e of entrances){
 for(const z of [6,8,10,11.7])for(const side of [-1,1]){
  const y=z<=7?2.4:2.4*(11.8-z)/4.8;
  const prev={x:e.x,y,z},p={x:e.x+side*2,y,z};blockAccessRails(p,prev,entrances);
  assert.ok(Math.abs(p.x-(e.x+side*.755))<1e-9,'stops at inner rail');
  const high={x:e.x+side*2,y:y+1.2,z};blockAccessRails(high,{...prev,y:y+1.2},entrances);assert.equal(high.x,e.x+side*2,'jump clears rail');
  const outside={x:e.x,y,z};blockAccessRails(outside,{x:e.x+side*2,y,z},entrances);assert.ok(Math.abs(outside.x-(e.x+side*1.545))<1e-9,'blocks from outside');
 }
 const entry={x:e.x,y:0,z:11.6};blockAccessRails(entry,{x:e.x,y:0,z:12.4},entrances);assert.equal(entry.x,e.x,'entrance clear');
 const walk={x:e.x+.3,y:1,z:9};blockAccessRails(walk,{x:e.x,y:0,z:11},entrances);assert.equal(walk.x,e.x+.3,'walkway clear');
 const under={x:e.x+2,y:0,z:6};blockAccessRails(under,{x:e.x,y:0,z:6},entrances);assert.equal(under.x,e.x+2,'under landing clear');
}
console.log('PASS: six airlocks, both rail sides, slopes, landing, jump clearance and open entrances');
