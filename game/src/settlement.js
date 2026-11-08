import * as THREE from 'three';
import { layServiceCables, cableCrossings } from './cable-crossings.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createOpenLayout } from './exploration-layout.js';
import { installHabitatAccess } from './access.js';
import { loadModel } from './nasamodels.js';
import { GREENHOUSE } from './colony.js';
import { GH, heightAt } from './world.js';

export async function installSettlement(world){
  const gltf=await new GLTFLoader().loadAsync('assets/mars-base/scene.gltf'),model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  model.scale.setScalar(102/Math.max(size.x,size.z));
  const box=new THREE.Box3().setFromObject(model),centre=box.getCenter(new THREE.Vector3());model.position.set(-centre.x,-box.min.y,-centre.z);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name==='Object_16')o.visible=false;}});world.scene.add(model);
  // The imported base also contains solar tables. Make their visible footprints
  // serviceable and reserve them just like the deployable array.
  model.updateMatrixWorld(true);world.fixedSolar=[];
  const cells=model.getObjectByName('Object_14');
  if(cells?.isMesh){
    const geo=cells.geometry,pos=geo.attributes.position,idx=geo.index,count=(idx?.count??pos.count)/3;
    const parent=Array.from({length:count},(_,i)=>i),owners=new Map(),v=new THREE.Vector3();
    const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    for(let t=0;t<count;t++)for(let j=0;j<3;j++){
      v.fromBufferAttribute(pos,idx?idx.getX(t*3+j):t*3+j);
      const key=[v.x,v.y,v.z].map(n=>n.toFixed(4)).join(',');
      if(owners.has(key))parent[root(t)]=root(owners.get(key));else owners.set(key,t);
    }
    const boxes=new Map();for(let t=0;t<count;t++){
      const id=root(t);if(!boxes.has(id))boxes.set(id,new THREE.Box3());
      for(let j=0;j<3;j++)boxes.get(id).expandByPoint(v.fromBufferAttribute(pos,idx?idx.getX(t*3+j):t*3+j).applyMatrix4(cells.matrixWorld));
    }
    const footMat=new THREE.MeshStandardMaterial({color:'#77766e',roughness:.95});
    for(const box of boxes.values()){
      const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      if(size.x*size.z<.2)continue;
      world.fixedSolar.push({x:center.x,z:center.z,halfX:size.x/2,halfZ:size.z/2,y:heightAt(center.x,center.z)});
      world.clearRocksAround(center.x,center.z,Math.hypot(size.x,size.z)/2+.6);
      for(const x of [box.min.x+.15,box.max.x-.15])for(const z of [box.min.z+.15,box.max.z-.15]){
        const ground=heightAt(x,z),top=Math.max(ground+.18,box.min.y);
        const foot=new THREE.Mesh(new THREE.BoxGeometry(.4,top-ground+.04,.4),footMat);
        foot.position.set(x,(top+ground)/2-.02,z);foot.castShadow=foot.receiveShadow=true;world.scene.add(foot);
      }
    }
  }
  const staticCrew=model.getObjectByName('Object_16');staticCrew?.removeFromParent();
  model.updateMatrixWorld(true);model.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  const layout=await createOpenLayout(world,model);
  const access=installHabitatAccess(world,model,layout);
  const anchor=layout.moduleColliders[2];GH.x=anchor.x;GH.z=anchor.z-23;
  const greenhouse=makeBaseGreenhouse(world);

  const start=new THREE.Vector3(anchor.x,4,anchor.z-anchor.r+.6),end=new THREE.Vector3(GH.x,2.1,GH.z+GH.r-.5);
  const asset=await loadModel('greenhouse-walkway.glb');
  if(!asset)throw new Error('Greenhouse walkway unavailable');
  const glassTunnel=asset.scene.clone(true);
  const lower=new THREE.Vector3(GH.x,.1,GH.z+5);
  const upper=new THREE.Vector3(anchor.x,2.4,anchor.z-2.7);
  const axis=upper.clone().sub(lower);
  glassTunnel.position.copy(lower);
  glassTunnel.rotation.x=-Math.atan2(axis.y,axis.z);
  glassTunnel.scale.z=axis.length()/15;
  world.scene.add(glassTunnel);
  // Cut only the two facing shells, leaving the side and far walls intact.

  function doorway(root,zMin,zMax,yMin,yMax){
    const planes=[[1,0,0,-(anchor.x+1.5)],[-1,0,0,anchor.x-1.5],[0,0,1,-zMax],[0,0,-1,zMin],[0,1,0,-yMax],[0,-1,0,yMin]]
      .map(([x,y,z,d])=>new THREE.Plane(new THREE.Vector3(x,y,z),d));
    root.updateWorldMatrix(true,true);
    const opening=new THREE.Box3(new THREE.Vector3(anchor.x-1.5,yMin,zMin),new THREE.Vector3(anchor.x+1.5,yMax,zMax));
    root.traverse(o=>{
      if(!o.isMesh||!opening.intersectsBox(new THREE.Box3().setFromObject(o)))return;
      const cut=material=>{const m=material.clone();m.clippingPlanes=planes;m.clipIntersection=true;m.clipShadows=true;return m;};
      o.material=Array.isArray(o.material)?o.material.map(cut):cut(o.material);
    });
  }
  doorway(model,anchor.z-anchor.r-1,anchor.z-1,2.35,5.35);
  doorway(greenhouse,GH.z+4,GH.z+8,.09,3.14);
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
  for(const panel of world.solar.panels){
    const x=42+panel.position.x,z=-20+panel.position.z;
    panel.position.y=heightAt(x,z)-world.solar.group.position.y;
    world.clearRocksAround(x,z,2.8);
    for(const foot of panel.userData.feet||[]){
      const ground=heightAt(x+foot.position.x,z+foot.position.z)-heightAt(x,z);
      // Ballast extends down to local soil instead of hovering over a slope.
      const bottom=Math.min(-.02,ground-.04),top=Math.max(.14,ground+.12);
      foot.scale.y=(top-bottom)/.16;foot.position.y=(top+bottom)/2;
    }
  }
  world.colliders.splice(0,world.colliders.length,...layout.colliders,...(keepLander?[keepLander]:[]));
  world.clearRocksAround(GH.x,GH.z,GH.r+3);
  world.player.position.set(28,heightAt(28,-35),-35);world.yaw=Math.atan2(layout.door.x-28,layout.door.z+35);world.move.set(0,0,0);world.vel.set(0,0,0);
  layout.door.set(access.entrances[0].x,access.entrances[0].y,access.entrances[0].z);
  world.door.copy(layout.door);layout.locations.base=[world.door.x,world.door.z];world.outpost.beacon.position.set(layout.door.x,.15,layout.door.z);world.outpost.beacon.visible=true;
  const shielding=new THREE.Group(),berms=new THREE.Group();world.scene.add(shielding,berms);
  const waterMat=new THREE.MeshStandardMaterial({color:'#c5c8bb',roughness:.85}),soilMat=new THREE.MeshStandardMaterial({color:'#80614c',roughness:1});
  for(const c of layout.moduleColliders){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(4.9,3.8,.5),waterMat);wall.position.set(c.x,1.9,c.z-3.2);shielding.add(wall);
    const berm=new THREE.Mesh(new THREE.BoxGeometry(5,3,2),soilMat);berm.position.set(c.x,1.5,c.z-4.1);berm.rotation.x=-.12;berms.add(berm);
  }
  shielding.visible=false;berms.visible=false;
  const pack=new THREE.Mesh(new THREE.BoxGeometry(1.5,.9,1),waterMat);
  pack.position.set(53.4,heightAt(53.4,-17)+.45,-17);world.scene.add(pack);
  world.colliders.push({x:pack.position.x,z:pack.position.z,r:.8,object:pack});
  for(const panel of world.solar.panels){
    const position=panel.getWorldPosition(new THREE.Vector3());
    world.colliders.push({x:position.x,z:position.z,r:1.9,solar:true,halfX:1.7,halfZ:1.05,object:panel});
  }
  const endpoint=layout.moduleColliders[0];
  const cablePoints=[new THREE.Vector3(53.4,.6,-20),new THREE.Vector3(53.4,.1,-18.8),pack.position.clone(),new THREE.Vector3(51,.1,-17), new THREE.Vector3(endpoint.x,.1,endpoint.z-5),new THREE.Vector3(endpoint.x,.8,endpoint.z-4)];
  const powerSite={x:pack.position.x,z:pack.position.z+1.6};
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),48,.07,8,false),new THREE.MeshStandardMaterial({color:'#42494b',roughness:.8}));world.scene.add(cable);
  const serviceCables=layServiceCables(model,world.scene,heightAt);
  const crossings=cableCrossings([serviceCables,cable],heightAt);
  const previousSurface=world.sev.surfaceAt;
  world.sev.surfaceAt=(x,z)=>crossings.height(x,z,previousSurface(x,z));
  const panelRay=new THREE.Raycaster(),panelOrigin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
  world.panelHeight=(x,z,ceiling=1000)=>{
    panelOrigin.set(x,ceiling,z);panelRay.set(panelOrigin,down);panelRay.far=Infinity;
    const surfaces=[model.getObjectByName('Object_14'),...world.solar.panels.filter(p=>p.visible).map(p=>p.children[0])].filter(Boolean);
    return panelRay.intersectObjects(surfaces,true)[0]?.point.y??-Infinity;
  };
  const equipmentBlock=equipmentContact(model);
  const mission={crossings,serviceCables,glassTunnel,blockEquipment:pos=>{const top=world.panelHeight(pos.x,pos.z);if(Number.isFinite(top)&&pos.y>=top-.18)return;equipmentBlock(pos);},pack,cable,powerSite,...access,model,layout,greenhouse,bindGreenhouse:room=>{mission.greenhouseRoom=room;},updateGreenhouse:(beds,powered=true)=>{
    const room=mission.greenhouseRoom;if(!room)return;
    room.draw(beds,GREENHOUSE.tank,powered);
    const key=room.beds.map(b=>b.key).join(';');if(key===mission.greenhouseKey)return;mission.greenhouseKey=key;
    if(mission.visibleFurnishings)greenhouse.remove(mission.visibleFurnishings);
    // Share the actual interior geometry and materials; draw() owns their lifecycle.
    mission.visibleFurnishings=room.furnishings.clone(true);greenhouse.add(mission.visibleFurnishings);
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
  ghG.add(new THREE.Mesh(new THREE.SphereGeometry(GH.r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#73b6bd', transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })));
  const frame = mat('#eceae4', { flatShading: false });
  for (let i = 0; i < 12; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(GH.r, 0.06, 8, 48, Math.PI), frame); rib.rotation.y = i / 12 * Math.PI; ghG.add(rib); }
  for (const a of [0.35, 0.7, 1.05]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(GH.r * Math.cos(a), 0.06, 8, 64), frame); ring.rotation.x = Math.PI / 2; ring.position.y = GH.r * Math.sin(a); ghG.add(ring); }
  ghG.add(at(new THREE.Mesh(new THREE.CylinderGeometry(GH.r + 0.05, GH.r + 0.1, 0.6, 64, 1, true), white), 0, 0.3, 0));   // base wall
  // its airlock, on the west side where nothing is parked
  const ghLock = new THREE.Group(); ghLock.position.set(-(GH.r - 0.2), 0, 0); ghLock.rotation.y = -Math.PI / 2; ghG.add(ghLock);
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 1.8), white), 0, 1.45, 0.6));
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 0.1), dark), 0, 1.25, 1.52));
  ghLock.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.15), new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 2.6, 1.55));

 ghG.name="base-greenhouse";return ghG;
}

// The source model batches the solar tables, dish, and mast into a few meshes.
// Sample their triangles once in a local grid so gaps between them stay walkable.
function equipmentContact(model){
  const pitch=.65, cells=new Map(), vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const sample=new THREE.Vector3();
  const key=(x,z)=>x+','+z;
  for(const name of ['Object_13','Object_14','Object_29','Object_31']){
    const mesh=model.getObjectByName(name);
    if(!mesh?.isMesh)continue;
    const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;
    for(let i=0;i<(index?.count??position.count);i+=3){
      vertices.forEach((v,j)=>v.fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      const [a,b,c]=vertices;
      if(Math.max(a.y,b.y,c.y)<.35 || Math.min(a.y,b.y,c.y)>5)continue;
      const steps=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))/pitch*2));
      for(let j=0;j<=steps;j++)for(let k=0;k<=steps-j;k++){
        sample.copy(a).multiplyScalar(1-(j+k)/steps).addScaledVector(b,j/steps).addScaledVector(c,k/steps);
        if(sample.y<.15)continue;
        const cell=key(Math.round(sample.x/pitch),Math.round(sample.z/pitch));
        const span=cells.get(cell);
        if(span){span.low=Math.min(span.low,sample.y);span.high=Math.max(span.high,sample.y);}
        else cells.set(cell,{low:sample.y,high:sample.y});
      }
    }
  }
  return pos=>{
    const cx=Math.round(pos.x/pitch),cz=Math.round(pos.z/pitch);
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++){
      const span=cells.get(key(x,z));
      if(!span || pos.y>span.high+.04 || pos.y+1.85<span.low)continue;
      const dx=pos.x-x*pitch,dz=pos.z-z*pitch,d=Math.hypot(dx,dz),r=pitch*.5+.35;
      if(d>0 && d<r){pos.x+=dx*(r/d-1);pos.z+=dz*(r/d-1);}
    }
  };
}
