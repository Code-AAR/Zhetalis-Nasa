// Human-scale pressure links and stair access, shared by rendering and movement.
import * as THREE from 'three';
import { pressureHatch } from './pressure-hatch.js';

export function installHabitatAccess(world, model, layout) {
  model.getObjectByName('Object_15')?.removeFromParent(); // replace decorative stairs
  const group = new THREE.Group(); group.name = 'habitat-access'; world.scene.add(group);
  const metal = new THREE.MeshStandardMaterial({color:'#6b7375',roughness:.7,metalness:.55});
  const shell = new THREE.MeshStandardMaterial({color:'#d8cfb7',roughness:.8});
  const entrances = layout.moduleColliders.map((c,index) => {
    c.habitatIndex=index;
    const doorZ=c.z+c.r+.15, landingEnd=doorZ+2, bottom=landingEnd+4.8, height=2.4;
    const entrance={index,x:c.x,y:height,z:doorZ+.8,doorZ,landingEnd,bottom,width:2.4};
    const addBox=(w,h,d,x,y,z,mat=metal)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
    };
    addBox(2.4,.18,2.3,c.x,height-.09,doorZ+.85);
    for(let i=0;i<12;i++){
      const y=(i+1)*height/12,z=bottom-(i+.5)*.4;
      addBox(2.4,.12,.43,c.x,y-.06,z);
      for(const side of [-1,1])if(i%3===0)addBox(.07,y+1.05,.07,c.x+side*1.15,(y+1.05)/2,z);
    }
    for(const side of [-1,1]){
      const a0=new THREE.Vector3(c.x+side*.98,.02,bottom),b0=new THREE.Vector3(c.x+side*.98,height-.16,landingEnd);
      const support=new THREE.Mesh(new THREE.BoxGeometry(.14,.2,a0.distanceTo(b0)),metal);
      support.position.copy(a0).add(b0).multiplyScalar(.5);support.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),b0.sub(a0).normalize());support.castShadow=true;group.add(support);
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,Math.hypot(4.8,height),8),metal);
      const a=new THREE.Vector3(c.x+side*1.15,1.05,bottom),b=new THREE.Vector3(c.x+side*1.15,height+1.05,landingEnd);
      rail.position.copy(a).add(b).multiplyScalar(.5);rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());group.add(rail);
      addBox(.07,.07,2,c.x+side*1.15,height+1.05,doorZ+1);
      addBox(.07,1.05,.07,c.x+side*1.15,height+.525,doorZ+.1);
      for(const z of[doorZ+.2,landingEnd-.2])addBox(.1,height,.1,c.x+side*1.05,height/2,z);
    }
    const hatch=pressureHatch({entry:true});hatch.scale.setScalar(.9);
    hatch.position.set(c.x,height,doorZ+.12);
    hatch.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    group.add(hatch);entrance.handle=hatch.userData.handle;
    // A sealed collar bridges the hatch to the curved habitat shell.
    const ray=new THREE.Raycaster(new THREE.Vector3(c.x,height+1.5,doorZ+1),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(model,true)[0];
    const depth=Math.max(.5,Math.min(4,doorZ-(hit?.point.z??doorZ-1)+.25));
    const collarZ=doorZ+.05-depth/2;
    for(const side of [-1,1])addBox(.2,2.94,depth,c.x+side*1.475,height+1.47,collarZ,shell);
    addBox(3.15,.18,depth,c.x,height+2.85,collarZ,shell);
    addBox(3.15,.18,depth,c.x,height-.02,collarZ,shell);
    // The ramp bypasses the habitat cylinder, but must never bypass its hatch.
    layout.colliders.push({x:c.x,z:doorZ+.26,r:1.65,halfX:1.575,halfZ:.28,
      minY:height-.1,maxY:height+2.94,airlock:true,object:hatch});
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#26353a';ctx.fillRect(0,0,512,96);ctx.fillStyle='#c9f5db';ctx.font='30px system-ui';ctx.textAlign='center';ctx.fillText(`AIRLOCK ${String(index+1).padStart(2,'0')} · E`,256,61);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2,.375),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));
    sign.position.set(c.x,height+3.3,doorZ+.16);group.add(sign);
    return entrance;
  });
  for(let i=0;i<layout.moduleColliders.length-1;i++){
    const a=layout.moduleColliders[i],b=layout.moduleColliders[i+1];
    layout.colliders.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,r:1.7});
    pressureTube(group,new THREE.Vector3(a.x+a.r-1,4,a.z),new THREE.Vector3(b.x-b.r+1,4,b.z),2.2,shell,metal);
  }
  return {
    group,entrances,
    onAccessRamp(p,index){const e=entrances[index];return Math.abs(p.x-e.x)<1.03&&p.z>=e.doorZ-.1&&p.z<=e.bottom+.25;},
    walkHeight(x,z,ground){
      for(const e of entrances)if(Math.abs(x-e.x)<=1.08&&z>=e.doorZ-.15&&z<=e.bottom+.2){
        return Math.max(ground,z<=e.landingEnd?e.y:e.y*THREE.MathUtils.clamp((e.bottom-z)/4.8,0,1));
      }
      return ground;
    }
  };
}

export function pressureTube(group,start,end,radius,shell,trim){
  const direction=end.clone().sub(start),length=direction.length();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,32,1,true),shell);
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());body.position.copy(start).add(end).multiplyScalar(.5);body.castShadow=true;body.receiveShadow=true;group.add(body);
  const ringGeometry=new THREE.TorusGeometry(radius+.03,.07,8,32);
  for(let i=0;i<=Math.ceil(length/.8);i++){
    const ring=new THREE.Mesh(ringGeometry,trim);ring.position.copy(start).lerp(end,i/Math.ceil(length/.8));ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.clone().normalize());group.add(ring);
  }
  return body;
}
