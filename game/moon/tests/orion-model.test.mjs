import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ORION_SOURCE,waitForOrion,disposeNasaOrion,applyOrionDecalPolicy} from '../src/orion-model.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('branding policy hides isolated NASA decals, preserving hull and ESA materials',()=>{
 const nodes=['Logo_and_Flag','Worm.002','serviceMod','orion_capsule','esa','array1_front'].map(name=>({isMesh:true,visible:true,material:{name,visible:true}}));
 applyOrionDecalPolicy({traverse(fn){nodes.forEach(fn);}});
 assert.deepEqual(nodes.map(n=>n.visible),[false,false,true,true,true,true]);
 assert.deepEqual(nodes.map(n=>n.material.visible),[false,false,true,true,true,true]);
});
test('NASA geometry and texture bytes survive GLB packaging unchanged',async()=>{
 const base=new URL('../assets/nasa/orion/',import.meta.url);
 const [bytes,sourceBytes,manifestBytes]=await Promise.all(['orion-eyes.glb','source.gltf.json','source-manifest.json'].map(f=>readFile(new URL(f,base))));
 const source=JSON.parse(sourceBytes),manifest=JSON.parse(manifestBytes);
 assert.equal(bytes.length,ORION_SOURCE.bytes);assert.equal(hash(bytes),manifest.output.sha256);
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12),packed=JSON.parse(bytes.subarray(20,20+jsonLength)),bin=bytes.subarray(28+jsonLength);
 for(const key of ['meshes','nodes','scenes','accessors','materials','textures','extensionsRequired'])assert.deepEqual(packed[key],source[key],key);
 assert.equal(hash(sourceBytes),manifest.files.find(f=>f.url.endsWith('artemis_ii.gltf')).sha256);
 assert.equal(hash(bin.subarray(0,source.buffers[0].byteLength)),manifest.files.find(f=>f.url.endsWith('artemis_ii.bin')).sha256);
 for(let i=0;i<source.images.length;i++){
  const view=packed.bufferViews[packed.images[i].bufferView],original=manifest.files.find(f=>f.url.endsWith('/'+source.images[i].uri));
  assert.equal(hash(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength)),original.sha256,source.images[i].uri);
  assert.equal(packed.images[i].uri,undefined);
 }
 assert.equal(packed.buffers.length,1);assert.equal(packed.buffers[0].uri,undefined);
});
test('stalled decoder wait ends on deadline cancellation',async()=>{
 const c=new AbortController(),p=waitForOrion(new Promise(()=>{}),c.signal);
 c.abort(new DOMException('deadline','TimeoutError'));await assert.rejects(p,{name:'TimeoutError'});
});
test('late model is freed after mission switch; shared resources are freed once',async()=>{
 let finish;const c=new AbortController(),calls={g:0,m:0,t:0,i:0};
 const texture={isTexture:true,source:{data:{close(){calls.i++;}}},dispose(){calls.t++;}};
 const material={map:texture,normalMap:texture,dispose(){calls.m++;}},geometry={dispose(){calls.g++;}};
 const root={traverse(fn){fn({geometry,material});fn({geometry,material:[material]});}};
 const p=waitForOrion(new Promise(resolve=>finish=resolve),c.signal);c.abort();await assert.rejects(p);
 finish(root);await new Promise(resolve=>setTimeout(resolve,0));disposeNasaOrion(root);
 assert.deepEqual(calls,{g:1,m:1,t:1,i:1});
});
