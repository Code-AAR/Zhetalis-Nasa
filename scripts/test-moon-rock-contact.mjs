// Run: THREE_TEST_MODULE=/absolute/path/to/three.module.mjs node scripts/test-moon-rock-contact.mjs
// Runtime must match the game's Three.js 0.160.0 import map; no repo dependency changes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const THREE=await import(process.env.THREE_TEST_MODULE ? pathToFileURL(process.env.THREE_TEST_MODULE).href : 'three');
assert.equal(THREE.REVISION,'160');
let source=await readFile(new URL('../game/moon/src/moon-rover.js',import.meta.url),'utf8');
source=source.replace(/^import .*;\r?\n/gm,'');
globalThis.__moonRockThree=THREE;
const {createLunarRockSupport,MoonRover}=await import('data:text/javascript,'+encodeURIComponent('const THREE=globalThis.__moonRockThree;\n'+source));
delete globalThis.__moonRockThree;
// Use the current world generator's actual full-detail vertex deformation.
const world=await readFile(new URL('../game/moon/src/world.js',import.meta.url),'utf8');
const start=world.indexOf('    let geo = new THREE.IcosahedronGeometry');
const end=world.indexOf("    geo.deleteAttribute('normal')",start);
assert.ok(start>=0&&end>start);
const geometry=Function('THREE','QUALITY',world.slice(start,end)+'\nreturn geo;')(THREE,{name:'high'});
const material=new THREE.MeshBasicMaterial();
const scene=new THREE.Scene(),rocks=new THREE.Group();rocks.name='Boulders';scene.add(rocks);
rocks.position.set(10,.1,-7);rocks.rotation.y=.25;
const near=new THREE.InstancedMesh(geometry,material,2);
near.position.set(.2,0,.3);near.rotation.y=-.1;rocks.add(near);
const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.65,.8,-.35));
for(let i=0;i<2;i++)near.setMatrixAt(i,matrix.compose(new THREE.Vector3(i*2,-.12,0),rotation,new THREE.Vector3(.95,.95,.95)));
const far=new THREE.InstancedMesh(geometry,material,2000);rocks.add(far);
for(let i=0;i<far.count;i++)far.setMatrixAt(i,new THREE.Matrix4().makeTranslation(100+i*3,0,100));
rocks.updateWorldMatrix(true,true);
const reference=new THREE.Raycaster(),points=[];
for(let x=9;x<=13;x+=.23)for(let z=-8.5;z<=-5.5;z+=.23){
 reference.set(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0));
 const hits=reference.intersectObject(rocks,true);
 points.push({x,z,height:Math.max(0,hits[0]?.point.y??0)});
}
assert.ok(points.some(p=>p.height>.2));
let lookups=0,updates=0,casts=0;
const lookup=scene.getObjectByName.bind(scene);scene.getObjectByName=(...args)=>{lookups++;return lookup(...args);};
const update=rocks.updateWorldMatrix.bind(rocks);rocks.updateWorldMatrix=(...args)=>{updates++;return update(...args);};
near.raycast=far.raycast=()=>assert.fail('Must never raycast a whole instance batch');
const original=THREE.Mesh.prototype.raycast;
THREE.Mesh.prototype.raycast=function(...args){casts++;return original.apply(this,args);};
try{
 const rover=Object.create(MoonRover.prototype);rover.rockSupport=createLunarRockSupport(scene,()=>0);
 for(const p of points){
  const before=casts;
  assert.ok(Math.abs(rover.support(p.x,p.z)-p.height)<1e-7,'optimized hit must equal actual rendered rock');
  assert.ok(casts-before<=2,'only nearby instances can be triangle-tested');
 }
 assert.equal(lookups,1);assert.equal(updates,1);
 const p=points.find(p=>p.height>.2);const cached=rover.support(p.x,p.z);const before=casts;
 for(let i=0;i<100;i++)assert.equal(rover.support(p.x,p.z),cached);
 assert.equal(casts,before,'repeat contacts must use bounded memo cache');
 assert.equal(lookups,1);assert.equal(updates,1);
 assert.equal(rover.support(-100,-100),0);
 console.log(`Moon full-detail transformed mesh contact: ${points.length} reference comparisons; 2,000 distant instances excluded; <=2 local casts/query; one lookup/matrix traversal; repeated contacts cached.`);
}finally{THREE.Mesh.prototype.raycast=original;geometry.dispose();material.dispose();}
