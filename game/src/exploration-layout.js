// Mars surface mission layout. Real source geometry
// stays intact; this arranges human-scale modules and mission survey sites.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { heightAt } from './world.js';

export async function createOpenLayout(world, habitat) {
  const group = new THREE.Group(); world.scene.add(group);
  const sceneryColliders = world.colliders.filter(c => !world.outpost.colliders.includes(c));
  const locations = { base: [0, 12], meteorite: [-65, 35], relay: [110, 65], ice: [-125, -75] };
  const names = { base: 'Habitat camp', meteorite: 'Meteorite field', relay: 'Relay ridge', ice: 'Subsurface survey' };
  const grey = new THREE.MeshStandardMaterial({color:'#bbb9ae',roughness:.85,metalness:.15});
  const dark = new THREE.MeshStandardMaterial({color:'#555657',roughness:.95});
  const orange = new THREE.MeshStandardMaterial({color:'#ad683e',roughness:.9});
  function post(x,z) {
    const p = new THREE.Group(); p.position.set(x,heightAt(x,z),z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.7,6),grey);pole.position.y=.85;p.add(pole);
    const tab=new THREE.Mesh(new THREE.BoxGeometry(.26,.22,.04),orange);tab.position.y=1.5;p.add(tab);group.add(p);
  }
  function sign(key) {
    const [x,z]=locations[key], c=document.createElement('canvas');c.width=512;c.height=96;
    const ctx=c.getContext('2d');ctx.fillStyle='#161b1ee8';ctx.fillRect(0,0,512,96);ctx.fillStyle='#edf0ea';ctx.font='24px system-ui';ctx.textAlign='center';ctx.fillText(names[key],256,42);ctx.font='18px system-ui';ctx.fillStyle='#b3b7ad';ctx.fillText('Surface operations',256,72);
    const texture=new THREE.CanvasTexture(c), sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));sprite.position.set(x,heightAt(x,z)+3.2,z);sprite.scale.set(8,1.5,1);group.add(sprite);
  }
  for(const key of ['meteorite','relay','ice']) {
    const [x,z]=locations[key]; sign(key); post(x-1.5,z);
    const length=Math.hypot(x,z), count=Math.floor(length/25);
    for(let i=1;i<count;i++)post(x*i/count,z*i/count);
  }
  // The NASA-supplied meteorite is only high detail up close. Distant copies
  // use a cheap silhouette so exploration does not render 143k triangles each.
  const rockGeo=await new STLLoader().loadAsync('assets/block-island.stl');
  rockGeo.rotateX(-Math.PI/2);rockGeo.computeBoundingBox();
  const box=rockGeo.boundingBox,size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
  rockGeo.translate(-mid.x,-box.min.y,-mid.z);rockGeo.scale(.7/Math.max(size.x,size.y,size.z),.7/Math.max(size.x,size.y,size.z),.7/Math.max(size.x,size.y,size.z));rockGeo.computeVertexNormals();
  const rockMat=new THREE.MeshStandardMaterial({color:'#625b56',roughness:.95});
  const rock=new THREE.LOD();const high=new THREE.Mesh(rockGeo,rockMat);high.castShadow=true;high.receiveShadow=true;rock.addLevel(high,0);
  const low=new THREE.Mesh(new THREE.IcosahedronGeometry(.33,1),rockMat);low.position.y=.23;low.scale.set(1,.7,.85);rock.addLevel(low,18);
  rock.position.set(-65,heightAt(-65,35),35);group.add(rock);
  // A remote communications instrument, separated from the pressure modules.
  const relay=new THREE.Group();relay.position.set(110,heightAt(110,65),65);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.10,.16,3.8,10),grey);mast.position.y=1.9;relay.add(mast);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(1.1,24,12,0,Math.PI*2,0,.95),grey);dish.rotation.x=-Math.PI/2;dish.position.y=3.6;relay.add(dish);
  const battery=new THREE.Mesh(new THREE.BoxGeometry(1.2,.65,.8),dark);battery.position.set(1.4,.325,0);relay.add(battery);group.add(relay);
  // A drilling/sensing station, not visible blue ice or an invented discovery.
  const survey=new THREE.Group();survey.position.set(-125,heightAt(-125,-75),-75);
  const drill=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.7,10),grey);drill.position.y=.85;survey.add(drill);
  const caseMesh=new THREE.Mesh(new THREE.BoxGeometry(.9,.55,.65),orange);caseMesh.position.set(.9,.275,0);survey.add(caseMesh);group.add(survey);
  let moduleColliders=[],colliders=[],route=[],spawn=[0,12];const door=new THREE.Vector3();
  function refit() {
    habitat.updateMatrixWorld(true);moduleColliders=[];
    habitat.traverse(object=>{
      if(!object.isMesh||!/^Object_(17|19|21|23|25|27)$/.test(object.name))return;
      const b=new THREE.Box3().setFromObject(object),s=b.getSize(new THREE.Vector3()),p=b.getCenter(new THREE.Vector3());
      moduleColliders.push({x:p.x,z:p.z,r:Math.max(s.x,s.z)/2});
    });
    if(!moduleColliders.length)throw new Error('Habitat module collision fitting found no modules');
    const first=moduleColliders[0];door.set(first.x,0,first.z+first.r+1.6);
    spawn=[door.x,door.z+8];
    route=[[-24,-12],[-24,16],[door.x,16],[door.x,door.z]];
    locations.base=[door.x,door.z];
    colliders=[...sceneryColliders,...moduleColliders,{x:110,z:65,r:.6},{x:111.4,z:65,r:.65},{x:-65,z:35,r:.35,top:rock.position.y+size.y*.7/Math.max(size.x,size.y,size.z)},{x:-125,z:-75,r:.35},{x:-124.1,z:-75,r:.5}];
  }
  refit();
  const targets=p=>['meteorite','relay','ice'].map(key=>({type:'survey-'+key,d:Math.hypot(p.x-locations[key][0],p.z-locations[key][1])}));
  return {group,locations,names,door,targets,refit,get moduleColliders(){return moduleColliders;},get colliders(){return colliders;},get route(){return route;},get spawn(){return spawn;},setVisible:visible=>{group.visible=visible;}};
}
