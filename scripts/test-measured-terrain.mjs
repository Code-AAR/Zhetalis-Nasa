import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createMeasuredTerrain} from '../game/src/measured-terrain.js';
const root=new URL('../game/assets/terrain/',import.meta.url);
const meta=JSON.parse(readFileSync(new URL('gusev-mola-128.json',root)));
const raw=readFileSync(new URL('gusev-mola-128.bin',root));
assert.equal(createHash('sha256').update(raw).digest('hex'),meta.sha256);
assert.equal(raw.length,meta.n**2*2);
const samples=Int16Array.from({length:meta.n**2},(_,i)=>raw.readInt16LE(i*2));
let min=Infinity,max=-Infinity;for(const h of samples){min=Math.min(min,h);max=Math.max(max,h);}
assert.equal(min,meta.minMetres);assert.equal(max,meta.maxMetres);
const terrain=createMeasuredTerrain(samples,meta);
for(const [row,col] of [[0,0],[17,321],[256,256],[511,511]]){
 const x=((col+.5)/meta.n-.5)*meta.worldSpan,z=((row+.5)/meta.n-.5)*meta.worldSpan;
 assert.equal(terrain.elevation(x,z),samples[row*meta.n+col]);
 if(Math.hypot(x,z)>=115)assert.ok(Math.abs(terrain.height(x,z)-(samples[row*meta.n+col]-terrain.origin)*meta.verticalScale)<1e-10);
}
for(let x=-60;x<=60;x+=10)assert.equal(terrain.height(x,0),0);
for(let x=-320;x<=320;x+=5)for(let z=-320;z<=320;z+=5)assert.ok(Number.isFinite(terrain.height(x,z)));
console.log('MOLA checksum, signed metres, exact sample centres, bounds, flattening and finite heights passed.');
