// One authentic NASA sample exhibit, loaded only when the surface scene updates.
// No loading placeholder masquerades as a real rock; failure leaves a labelled plinth.
import * as THREE from 'three';
import { heightAt, TERRAIN_SOURCE } from './terrain.js';
import { loadAssetWithRetry } from '../../src/asset-loading.js';
import { modal } from '../../src/ui.js';
export const APOLLO_SAMPLE = Object.freeze({ id:'10017,15', x:-22, z:18, scale:20,
  source:'https://ares.jsc.nasa.gov/astromaterials3d/sample-details.htm?sample=10017-15',
  title:'Apollo 11 · sample 10017,15',
  collection:'LM Site, Mare Tranquillitatis',
  label:'NASA ARES basalt scan · 20× linear scale · imported exhibit, not a south-pole find',
});

export function createApolloSample(scene) {
  const group=new THREE.Group(); group.name='Apollo 10017,15 educational replica';
  group.position.set(APOLLO_SAMPLE.x,heightAt(APOLLO_SAMPLE.x,APOLLO_SAMPLE.z),APOLLO_SAMPLE.z);
  group.userData={...APOLLO_SAMPLE, terrain:TERRAIN_SOURCE, status:'idle'};
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.85,1,.7,32),new THREE.MeshStandardMaterial({color:'#4b5056',roughness:.8}));
  base.position.y=.35; base.castShadow=base.receiveShadow=true; group.add(base);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  function label(status) {
    ctx.fillStyle='#101820';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#eff6ff';
    ctx.font='bold 40px sans-serif';ctx.fillText(APOLLO_SAMPLE.title,28,57);
    ctx.font='30px sans-serif';
    ['Imported replica · 20× larger','E / Use: discover this Moon rock',status].forEach((s,i)=>ctx.fillText(s,28,112+i*54));
  }
  label('NASA / ARES / Astromaterials 3D');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));
  sign.position.set(0,2.35,0);sign.scale.set(3.5,.875,1);group.add(sign);scene.add(group);
  let pending=null,disposed=false;
  function disposeObject(root) {
    const textures=new Set(),materials=new Set(),geometries=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
    textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
  }
  function load() {
    if(pending||disposed)return pending;
    group.userData.status='loading';
    label('Loading NASA scan…');texture.needsUpdate=true;
    pending=import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
      const loader=new GLTFLoader();
      // Dispose late results after timeout/unmount: loadAsync itself is not cancellable.
      const bounded={loadAsync:async url=>{const gltf=await loader.loadAsync(url);if(disposed||group.userData.status==='failed'){disposeObject(gltf.scene);throw new Error('Apollo request expired');}return gltf;}};
      return loadAssetWithRetry(bounded,new URL('../../assets/nasa/apollo-10017-15.glb',import.meta.url).href,{critical:false,attempts:2,timeout:30000});
    }).then(gltf=>{
      if(disposed){disposeObject(gltf.scene);return false;}
      const rock=gltf.scene;rock.scale.setScalar(APOLLO_SAMPLE.scale);
      rock.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(rock),center=bounds.getCenter(new THREE.Vector3());
      rock.position.set(-center.x,.7-bounds.min.y,-center.z);
      rock.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});
      group.add(rock);group.userData.status='ready';label('NASA / ARES / Astromaterials 3D');texture.needsUpdate=true;return true;
    }).catch(error=>{
      if(disposed)return false;
      group.userData.status='failed';label('Sample download failed — reload to retry');texture.needsUpdate=true;
      console.warn('Apollo sample unavailable',error);return false;
    });
    return pending;
  }
  const spot={id:'apollo-exhibit',x:APOLLO_SAMPLE.x,z:APOLLO_SAMPLE.z,r:4,label:'Explore Apollo 11 Moon rock',hold:0};
  return {group,load,spot,collider:{x:APOLLO_SAMPLE.x,z:APOLLO_SAMPLE.z,r:1,height:1.8},
    interact(){document.exitPointerLock?.();modal({title:APOLLO_SAMPLE.title,html:`<p>This basalt was collected at the Apollo 11 lunar module site in Mare Tranquillitatis. NASA scanned subsample <b>10017,15</b> so you can explore its surface.</p><p>This educational replica is <b>20 times larger in every direction</b> than the original (about 5.1 cm across its longest axis). It was brought to this training base as an exhibit; it was not found near the south pole.</p><p>NASA's full 200,000-triangle web model and original photographic texture are preserved. ${group.userData.status==='ready'?'The scan is ready.':group.userData.status==='failed'?'The scan could not load. Reload the game to retry.':'The scan is loading; you can keep exploring.'}</p><p><a href="${APOLLO_SAMPLE.source}" target="_blank" rel="noopener">NASA ARES sample record</a></p><p><b>Ground beneath your feet:</b> <a href="${TERRAIN_SOURCE.url}" target="_blank" rel="noopener">NASA LOLA 5 m DEM</a> at 89.4624°S, 137.7808°W, with synthetic training craters, a landing pad and fine grain. The ice and permanent-shadow rules are game scenarios, not measured deposits or local illumination.</p>`,choices:[{label:'Back to exploring',primary:true}]});},
    update(focus){group.visible=Math.hypot(focus.x-APOLLO_SAMPLE.x,focus.z-APOLLO_SAMPLE.z)<100;if(group.visible)load();},
    dispose(){if(disposed)return;disposed=true;scene.remove(group);disposeObject(group);}};
}
