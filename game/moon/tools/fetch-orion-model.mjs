// Package NASA/JPL Eyes' complete Orion glTF as GLB without changing mesh/texture bytes.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://eyes.nasa.gov/assets/static/models/sc_artemis/';
const out = new URL('../assets/nasa/orion/', import.meta.url);
await mkdir(out, {recursive:true});
const manifest = { source:'https://eyes.nasa.gov/apps/solar-system/#/sc_artemis_2', retrieved:new Date().toISOString(), files:[] };
async function download(url) {
  const response = await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw new Error(`${response.status}: ${url}`);
  const b=Buffer.from(await response.arrayBuffer());
  manifest.files.push({url,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});return b;
}
const source = await download(base+'artemis_ii.gltf'), doc=JSON.parse(source);
const chunks=[];let offset=0;
const append=b=>{const start=offset;chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return start;};
const offsets=[];
for(const b of doc.buffers) offsets.push(append(await download(new URL(b.uri,base).href)));
for(const v of doc.bufferViews){v.byteOffset=(v.byteOffset||0)+offsets[v.buffer];v.buffer=0;}
const images=new Map();
for(const im of doc.images||[]){
  if(!im.uri)continue;
  if(!images.has(im.uri)){
    const bytes=await download(new URL(im.uri,base).href),byteOffset=append(bytes);
    images.set(im.uri,doc.bufferViews.length);doc.bufferViews.push({buffer:0,byteOffset,byteLength:bytes.length});
  }
  im.bufferView=images.get(im.uri);delete im.uri;
}
doc.buffers=[{byteLength:offset}];
const json=Buffer.from(JSON.stringify(doc)),padding=Buffer.alloc((4-json.length%4)%4,32),jsonBody=Buffer.concat([json,padding]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonBody.length+offset,8);header.writeUInt32LE(jsonBody.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(offset,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,jsonBody,bh,...chunks]);
await writeFile(new URL('orion-eyes.glb',out),glb);
manifest.output={file:'orion-eyes.glb',bytes:glb.length,sha256:createHash('sha256').update(glb).digest('hex'),note:'Lossless container repack. Original compressed mesh and KTX2 texture bytes retained.'};
await writeFile(new URL('source-manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('source.gltf.json',out),source);
await mkdir(new URL('basis/',out),{recursive:true});
for(const file of ['basis_transcoder.js','basis_transcoder.wasm']){
  await writeFile(new URL('basis/'+file,out),await download('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/'+file));
}
await writeFile(new URL('basis/README.upstream.md',out),await download('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/README.md'));
await writeFile(new URL('source-manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.output);console.log('scene',doc.scenes,'extensions',doc.extensionsRequired);
console.log(doc.nodes.map(n=>({name:n.name,scale:n.scale,children:n.children})).filter(n=>n.scale||n.children));
