// No node_modules required: set THREE_TEST_MODULE to Three.js 0.160.0's local
// ESM build. Set THREE_UTILS_MODULE to BufferGeometryUtils.js from the same release,
// or place BufferGeometryUtils-test.mjs beside the runtime. Its Three import is
// rebound below, so both the original download and an already-rewritten copy work.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
let THREE,mergeGeometries;
if(process.env.THREE_TEST_MODULE){
 const runtime=pathToFileURL(resolve(process.env.THREE_TEST_MODULE)).href;
 THREE=await import(runtime);
 const utility=process.env.THREE_UTILS_MODULE || resolve(dirname(process.env.THREE_TEST_MODULE),'BufferGeometryUtils-test.mjs');
 let code;
 try{code=await readFile(utility,'utf8');}
 catch(error){throw new Error('Set THREE_UTILS_MODULE to the local Three.js 0.160.0 BufferGeometryUtils.js file.',{cause:error});}
 code=code.replace(/from\s+['"](?:three|\.\/three-test-runtime\.mjs)['"]/g,`from ${JSON.stringify(runtime)}`);
 ({mergeGeometries}=await import('data:text/javascript,'+encodeURIComponent(code)));
}else{
 try{THREE=await import('three');({mergeGeometries}=await import('three/addons/utils/BufferGeometryUtils.js'));}
 catch(error){throw new Error('No installed Three.js. Set THREE_TEST_MODULE to a local three.module.mjs and THREE_UTILS_MODULE to matching BufferGeometryUtils.js (version 0.160.0).',{cause:error});}
}
assert.equal(THREE.REVISION,'160','Tests must use the game runtime version');
let source=await readFile(new URL('../game/src/starship-model.js',import.meta.url),'utf8');
source=source.replace(/^import .*;\r?\n/gm,'');
globalThis.__starshipTest={THREE,mergeGeometries};
const {buildStarshipModel,STARSHIP_HLS}=await import('data:text/javascript,'+encodeURIComponent('const {THREE,mergeGeometries}=globalThis.__starshipTest;\n'+source));
delete globalThis.__starshipTest;
for(const variant of ['hls','mars']){
 const ship=buildStarshipModel({variant});ship.updateMatrixWorld(true);
 const bounds=new THREE.Box3();let draws=0,triangles=0;
 ship.traverse(o=>{if(o.isMesh&&o!==ship.userData.plume){bounds.union(new THREE.Box3().setFromObject(o));draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.count??1);}});
 const d=ship.userData.dimensions;
 assert.ok(Math.abs(bounds.min.y-d.baseY)<1e-5,`${variant} base ${bounds.min.y}`);
 assert.ok(Math.abs(bounds.max.y-d.topY)<1e-5,`${variant} top ${bounds.max.y}`);
 assert.deepEqual(ship.position.toArray(),[0,0,0]);assert.deepEqual(ship.scale.toArray(),[1,1,1]);
 assert.equal(ship.userData.plume.material.opacity,0);assert.equal(ship.userData.engineLight.intensity,0);
 assert.equal(ship.userData.concept,true);assert.ok(draws<40,`draw calls ${draws}`);
 if(variant==='hls'){
  assert.equal(ship.userData.flaps.length,0);assert.equal(ship.getObjectByName('Windward heat shield'),undefined);
  assert.deepEqual(ship.userData.lift.position.toArray(),[0,29.5,5.45]);
  ship.userData.lift.position.y=-1.5;ship.updateMatrixWorld(true);
  assert.equal(ship.userData.lift.getWorldPosition(new THREE.Vector3()).y,-1.5);
  assert.equal(STARSHIP_HLS.radius,4.2);assert.equal(STARSHIP_HLS.height,40);assert.equal(STARSHIP_HLS.legReach,7.2);
 }else{
  assert.equal(ship.userData.flaps.length,4);assert.ok(ship.getObjectByName('Windward heat shield').count>1000);
  ship.userData.setFlaps(.4);for(const f of ship.userData.flaps)assert.equal(f.rotation.y,f.userData.side*.4);
  ship.userData.setFlaps(0);for(const f of ship.userData.flaps)assert.ok(Math.abs(f.rotation.y)<1e-9);
 }
 console.log(variant,{min:bounds.min.toArray(),max:bounds.max.toArray(),draws,triangles});
}
const scaled=buildStarshipModel({variant:'hls',height:2.065,baseY:-.965});
assert.equal(scaled.userData.dimensions.topY,1.1);
assert.throws(()=>buildStarshipModel({height:0}),RangeError);
console.log('Starship variants, solid bounds, HLS gameplay coordinates, flap motion and render budgets passed.');
