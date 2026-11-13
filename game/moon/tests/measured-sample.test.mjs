import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GRID,DECIMETRES} from '../data/regional-heights.js';
import {heightAt,measuredHeightAt,chunkPlan} from '../src/terrain.js';
import {WORLD,CHUNKS_PER_SIDE} from '../src/config.js';
const read=p=>readFileSync(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(read('../data/regional-terrain.json'));
assert.equal(DECIMETRES.length,GRID.width**2);
const bytes=Buffer.alloc(DECIMETRES.length*2);DECIMETRES.forEach((v,i)=>bytes.writeInt16LE(v,i*2));
assert.equal(hash(bytes),meta.heightsInt16LEsha256);
assert.equal(measuredHeightAt(0,0),0);
assert.equal(GRID.lat,-89.4624);assert.equal(GRID.lon,-137.7808);
for(let row=0;row<GRID.width;row+=7)for(let col=0;col<GRID.width;col+=7){
  const x=col*5-800,z=row*5-800;
  assert.equal(measuredHeightAt(x,z),DECIMETRES[row*GRID.width+col]*.1);
}
for(const [x,z] of [[800,800],[-800,-800],[800,-800],[-800,800]])assert.ok(Number.isFinite(measuredHeightAt(x,z)));
for(const [x,z] of [[801,0],[0,-801],[NaN,0],[0,Infinity]])assert.equal(measuredHeightAt(x,z),null);
assert.ok(Math.abs(measuredHeightAt(2.5,2.5)-(measuredHeightAt(0,0)+measuredHeightAt(5,0)+measuredHeightAt(0,5)+measuredHeightAt(5,5))/4)<1e-9);
// Exhaustive playable coverage and seam continuity; all collision/visual consumers share this sampler.
let min=Infinity,max=-Infinity;
for(let z=-480;z<=480;z+=5)for(let x=-480;x<=480;x+=5){
  assert.notEqual(measuredHeightAt(x,z),null);const h=heightAt(x,z);assert.ok(Number.isFinite(h));min=Math.min(min,h);max=Math.max(max,h);
}
for(let x=-400;x<=400;x+=80)for(let z=-480;z<=480;z+=13)assert.ok(Math.abs(heightAt(x-1e-5,z)-heightAt(x+1e-5,z))<.01);
// Optimized planner must exactly match the original all-world planner, including tangencies/order.
function reference(x,z){const out=[],r=120,S=WORLD.chunk;for(let iz=0;iz<CHUNKS_PER_SIDE;iz++)for(let ix=0;ix<CHUNKS_PER_SIDE;ix++){
  const left=-480+ix*S,top=-480+iz*S,dx=Math.max(left-x,0,x-left-S),dz=Math.max(top-z,0,z-top-S);
  if(dx*dx+dz*dz<=r*r)out.push({x:ix,z:iz,key:ix+','+iz,d:(left+40-x)**2+(top+40-z)**2});
}return out.sort((a,b)=>a.d-b.d||a.z-b.z||a.x-b.x).slice(0,16);}
for(let z=-480;z<=480;z+=20)for(let x=-480;x<=480;x+=20)assert.deepEqual(chunkPlan(x,z,'map'),reference(x,z));
const sample=JSON.parse(read('../data/apollo-10017-15.json')),glb=read('../../assets/nasa/apollo-10017-15.glb');
assert.equal(hash(glb),sample.glbSha256);assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(8),glb.length);
const n=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+n)),prim=gltf.meshes[0].primitives[0];
assert.equal(gltf.accessors[prim.indices].count,600000);assert.equal(sample.triangles,200000);
assert.equal(gltf.accessors[prim.attributes.POSITION].count,103662);
assert.ok(!gltf.extensionsRequired?.length);assert.ok(!gltf.images[0].uri);
const image=gltf.bufferViews[gltf.images[0].bufferView],bin=28+n;
assert.equal(hash(glb.subarray(bin+image.byteOffset,bin+image.byteOffset+image.byteLength)),sample.textureSha256);
assert.ok(sample.boundsMetres.max[2]-sample.boundsMetres.min[2]>.051);
assert.ok(!read('../src/terrain.js').toString().includes('fetch('));
console.log('PASS measured provenance, sampling, 37k terrain points, seams, 2401 planner comparisons, full Apollo geometry/texture hashes', {min,max,modelBytes:glb.length});
