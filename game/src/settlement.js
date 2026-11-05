import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createOpenLayout } from './exploration-layout.js';
import { installHabitatAccess, pressureTube } from './access.js';
import { GH, heightAt } from './world.js';

export async function installSettlement(world){
  const gltf=await new GLTFLoader().loadAsync('assets/mars-base/scene.gltf'),model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  model.scale.setScalar(102/Math.max(size.x,size.z));
  const box=new THREE.Box3().setFromObject(model),centre=box.getCenter(new THREE.Vector3());model.position.set(-centre.x,-box.min.y,-centre.z);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name==='Object_16')o.visible=false;}});world.scene.add(model);
  const staticCrew=model.getObjectByName('Object_16');staticCrew?.removeFromParent();
  model.updateMatrixWorld(true);model.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  const layout=await createOpenLayout(world,model);
  const access=installHabitatAccess(world,model,layout);
  const anchor=layout.moduleColliders[2];GH.x=anchor.x;GH.z=anchor.z-23;
  const greenhouse=makeBaseGreenhouse(world);
  const start=new THREE.Vector3(anchor.x,4,anchor.z-anchor.r+.6),end=new THREE.Vector3(GH.x,2.1,GH.z+GH.r-.5);
  const tubeShell=new THREE.MeshStandardMaterial({color:'#dbd6c7',roughness:.7,side:THREE.DoubleSide}),tubeTrim=new THREE.MeshStandardMaterial({color:'#737b79',roughness:.65,metalness:.3});
  pressureTube(world.scene,start,end,2.2,tubeShell,tubeTrim);
  layout.colliders.push({x:GH.x,z:GH.z,r:GH.r+.3});
  for(let z=end.z+2;z<start.z;z+=2)layout.colliders.push({x:GH.x,z,r:2.3});
  const colonyTargets=world.extraTargets;
  world.extraTargets=p=>[...(colonyTargets?.(p)||[]),...layout.targets(p)];
  // Keep the existing lander and its ladder. Replace the central dome and
  // outdoor decorative plants with the supplied connected pressure modules.
  const lander=world.outpost.group.getObjectByName('lander');
  const ladderPieces=world.outpost.group.children.filter(o=>o!==lander&&o.position.distanceTo(lander.position)<.01);
  for(const object of world.outpost.group.children){const ladder=lander&&object.position.distanceTo(lander.position)<.01;if(object!==lander&&!ladder&&object!==world.outpost.beacon)object.visible=false;}
  world.regolith.visible=false;
  const keepLander=world.outpost.colliders.find(c=>c.x===-6&&c.z===-17);
  // Clear the enlarged base's service apron and keep its support vehicles usable.
  for(const object of [lander,...ladderPieces]){object.position.x+=46;object.position.z-=33;object.position.y=heightAt(40,-50);}
  lander.updateWorldMatrix(true,false);
  world.shipDoor=lander.localToWorld(new THREE.Vector3(0,0,2.2+.9/lander.scale.x));world.shipDoor.y=heightAt(world.shipDoor.x,world.shipDoor.z);
  if(keepLander){keepLander.x=40;keepLander.z=-50;}
  world.sev.pos.set(-42,heightAt(-42,32),32);world.sev.place(0);world.sevCollider.x=-42;world.sevCollider.z=32;
  world.solar.group.position.set(42,heightAt(42,-20),-20);
  world.colliders.splice(0,world.colliders.length,...layout.colliders,...(keepLander?[keepLander]:[]));
  world.player.position.set(28,heightAt(28,-35),-35);world.yaw=Math.atan2(layout.door.x-28,layout.door.z+35);world.move.set(0,0,0);world.vel.set(0,0,0);
  layout.door.set(access.entrances[0].x,access.entrances[0].y,access.entrances[0].z);
  world.door.copy(layout.door);layout.locations.base=[world.door.x,world.door.z];world.outpost.beacon.position.set(layout.door.x,.15,layout.door.z);world.outpost.beacon.visible=true;
  const colours=world.terrain.geometry.getAttribute('color'),shade=new THREE.Color();
  for(let i=0;i<colours.count;i++){shade.fromBufferAttribute(colours,i).offsetHSL(0,-.2,-.015);colours.setXYZ(i,shade.r,shade.g,shade.b);}colours.needsUpdate=true;
  const shielding=new THREE.Group(),berms=new THREE.Group();world.scene.add(shielding,berms);
  const waterMat=new THREE.MeshStandardMaterial({color:'#c5c8bb',roughness:.85}),soilMat=new THREE.MeshStandardMaterial({color:'#80614c',roughness:1});
  for(const c of layout.moduleColliders){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(4.9,3.8,.5),waterMat);wall.position.set(c.x,1.9,c.z-3.2);shielding.add(wall);
    const berm=new THREE.Mesh(new THREE.BoxGeometry(5,3,2),soilMat);berm.position.set(c.x,1.5,c.z-4.1);berm.rotation.x=-.12;berms.add(berm);
  }
  shielding.visible=false;berms.visible=false;
  const mission={...access,model,layout,greenhouse,updateGreenhouse:(beds,powered=true)=>{
    beds.forEach((bed,i)=>{const row=greenhouse.userData.rows[i];row.plants.visible=!!bed.crop;row.plants.scale.y=.2+bed.grown*.8;row.plants.material.color.set(bed.ready?'#a5ae61':bed.crop==='lettuce'?'#833b48':'#4f8f3a');row.led.material.color.set(bed.crop&&powered?'#e05cff':'#504852');});
    greenhouse.userData.growLight.intensity=powered&&beds.some(b=>b.crop)?3:0;
  },surveys:new Set(),setWall:level=>shielding.visible=level>0,setRegolith:on=>berms.visible=on};
  world.settlement=mission;return mission;
}

function makeBaseGreenhouse(world){
 const white=new THREE.MeshStandardMaterial({color:'#ddd4bd',roughness:.75}),dark=new THREE.MeshStandardMaterial({color:'#2c3336'});
 const mat=(color,extra={})=>new THREE.MeshLambertMaterial({color,...extra});
 const at=(m,x,y,z)=>{m.position.set(x,y,z);return m;};
  // the base greenhouse: a glass dome 14 m across on the end of the tunnel, with 4 hydroponic grow beds inside
  // under pink LED bars. Walk in through its airlock (or through the tunnel from inside the outpost) - greenhouse.js
  const ghG = new THREE.Group(); ghG.position.set(GH.x, heightAt(GH.x,GH.z), GH.z); world.scene.add(ghG);
  ghG.add(new THREE.Mesh(new THREE.SphereGeometry(GH.r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8f4f6', transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })));
  const frame = mat('#eceae4', { flatShading: false });
  for (let i = 0; i < 12; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(GH.r, 0.06, 8, 48, Math.PI), frame); rib.rotation.y = i / 12 * Math.PI; ghG.add(rib); }
  for (const a of [0.35, 0.7, 1.05]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(GH.r * Math.cos(a), 0.06, 8, 64), frame); ring.rotation.x = Math.PI / 2; ring.position.y = GH.r * Math.sin(a); ghG.add(ring); }
  ghG.add(at(new THREE.Mesh(new THREE.CylinderGeometry(GH.r + 0.05, GH.r + 0.1, 0.6, 64), white), 0, 0.3, 0));   // base wall
  ghG.userData.rows=[];
  const ledMat = new THREE.MeshBasicMaterial({ color: '#e05cff' }), bedMat = mat('#f2f2f0', { flatShading: false }), leafMat = mat('#4f8f3a');
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    ghG.add(at(new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 5), bedMat), x, 0.45, 0));
    const plants=at(new THREE.Mesh(new THREE.BoxGeometry(.8,.35,4.6),leafMat.clone()),x,1,0);plants.visible=false;ghG.add(plants);
    const led=at(new THREE.Mesh(new THREE.BoxGeometry(.5,.06,5),ledMat.clone()),x,2.4,0);ghG.add(led);ghG.userData.rows.push({plants,led});
  }
  const ghGlow = new THREE.PointLight('#e070ff', 0, 14, 1.5);ghG.userData.growLight=ghGlow; ghGlow.position.y = 2.6; ghG.add(ghGlow);
  // its airlock, on the west side where nothing is parked
  const ghLock = new THREE.Group(); ghLock.position.set(-(GH.r - 0.2), 0, 0); ghLock.rotation.y = -Math.PI / 2; ghG.add(ghLock);
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 1.8), white), 0, 1.45, 0.6));
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 0.1), dark), 0, 1.25, 1.52));
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.15), new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 2.6, 1.55));

 ghG.name="base-greenhouse";return ghG;
}
