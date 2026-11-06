// Reuse the existing working stations inside six linked pressure modules.
import * as THREE from 'three';
import { Interior } from './interior.js';

const SPACING=10.2,RADIUS=4;
export class CrewInterior extends Interior {
  constructor(){
    super();
    const stations=this.stations.map(station=>({station,object:this.scene.children.find(o=>o.isGroup&&Math.abs(o.position.x-station.x)<.001&&Math.abs(o.position.z-station.z)<.001)}));
    this.scene.clear();this.scene.add(this.ambient,this.alarm,this.monitorLight);
    this.alarm.position.set(SPACING*3,2,0);this.scene.background=new THREE.Color('#13191b');
    const wallMat=new THREE.MeshStandardMaterial({color:'#d8d9d1',roughness:.8,metalness:.1});
    const floorMat=new THREE.MeshStandardMaterial({color:'#4b5359',roughness:.95});
    const trimMat=new THREE.MeshStandardMaterial({color:'#8c9b9e',roughness:.7});
    this.podNames=['Airlock & power','Storage & workshop','Life support · Greenhouse','Crew shelter','Observation','Science & hazards'];
    for(let i=0;i<6;i++){
      const cx=i*SPACING;
      const floor=new THREE.Mesh(new THREE.CircleGeometry(RADIUS,32),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(cx,0,0);this.scene.add(floor);
      const roof=floor.clone();roof.material=wallMat;roof.rotation.x=Math.PI/2;roof.position.y=6.6;this.scene.add(roof);
      for(let j=0;j<24;j++){
        const angle=j/24*Math.PI*2;
        const atConnector=Math.abs(Math.sin(angle))>.9&&((Math.sin(angle)>0&&i<5)||(Math.sin(angle)<0&&i>0));
        const atAirlock=i===0&&Math.cos(angle)>.94;
        if(i===4 && Math.cos(angle)<-.94){
          for(const [y,h] of [[.57,1.14],[4.73,3.74]]){
            const panel=new THREE.Mesh(new THREE.BoxGeometry(1.1,h,.12),wallMat);
            panel.position.set(cx+Math.sin(angle)*RADIUS,y,Math.cos(angle)*RADIUS);panel.rotation.y=angle;this.scene.add(panel);
          }
          continue;
        }
        if(atConnector||atAirlock||(i===2 && Math.cos(angle)<-.94)){
          const bulkhead=new THREE.Mesh(new THREE.BoxGeometry(1.1,3.6,.12),wallMat);bulkhead.name='upper-pressure-bulkhead';bulkhead.position.set(cx+Math.sin(angle)*RADIUS,4.8,Math.cos(angle)*RADIUS);bulkhead.rotation.y=angle;this.scene.add(bulkhead);continue;
        }
        const panel=new THREE.Mesh(new THREE.BoxGeometry(1.1,6.6,.08),wallMat);panel.position.set(cx+Math.sin(angle)*RADIUS,3.3,Math.cos(angle)*RADIUS);panel.rotation.y=angle;this.scene.add(panel);
      }
      const lamp=new THREE.PointLight('#eaf5ed',20,12,1.5);lamp.position.set(cx,5.8,0);this.scene.add(lamp);
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.9,.035,.12),new THREE.MeshBasicMaterial({color:'#efffe9'}));strip.position.set(cx,6.53,0);this.scene.add(strip);
      const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#26343d';ctx.fillRect(0,0,512,96);ctx.font='32px system-ui';ctx.fillStyle='#ecf2e7';ctx.textAlign='center';ctx.fillText(this.podNames[i],256,60);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(i===2?2.45:1.1,i===2?.42:.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));label.position.set(cx,3.35,-3.9);this.scene.add(label);
      if(i<5){
        const mid=cx+SPACING/2,len=SPACING-2*3.5;
        const bottom=new THREE.Mesh(new THREE.BoxGeometry(len,.04,2.8),floorMat);bottom.position.set(mid,.005,0);this.scene.add(bottom);
        const top=bottom.clone();top.material=wallMat;top.position.y=3;this.scene.add(top);
        const linkLight=new THREE.PointLight('#f3f1dd',4,6,1.5);linkLight.position.set(mid,2.7,0);this.scene.add(linkLight);
        const linkStrip=new THREE.Mesh(new THREE.BoxGeometry(len-.2,.035,.12),new THREE.MeshBasicMaterial({color:'#ebf6e5'}));linkStrip.position.set(mid,2.95,0);this.scene.add(linkStrip);
        for(const z of[-1.45,1.45]){const side=new THREE.Mesh(new THREE.BoxGeometry(len,3,.05),trimMat);side.position.set(mid,1.5,z);this.scene.add(side);}
      }
    }
    const layout={exit:[0,0,3.7,1],console:[0,0,-2.9,1],workbench:[1,0,-2.8,1],locker:[1,0,2.9,1],greenhouse:[2,0,-3.2,1],shelter:[3,0,-2.8,1],window:[4,0,-3.9,1],monitor:[5,0,-2.9,1]};
    for(const {station,object}of stations){if(!object)continue;const[pod,dx,z,scale]=layout[station.type];station.x=pod*SPACING+dx;station.z=z;object.position.set(station.x,0,z);object.scale.set(scale,1,scale);object.lookAt(pod*SPACING,0,0);if(station.type!=="greenhouse")this.scene.add(object);
      if(['locker','workbench','console','monitor','shelter'].includes(station.type)){
        object.updateWorldMatrix(true,true);
        this.obstacles??=[];
        this.obstacles.push(new THREE.Box3().setFromObject(object));
      }
    }
    this.enter();
  }
  enter(){this.pos.set(0,0,1.25);this.yaw=Math.PI;this.pitch=0;this.vel={x:0,z:0};}
  walkable(x,z){
    if(this.obstacles?.some(b=>x>b.min.x-.18 && x<b.max.x+.18 && z>b.min.z-.18 && z<b.max.z+.18))return false;
    return (Math.abs(x-SPACING*2)<1.12 && z>=-5 && z<0)|| (x>=0&&x<=SPACING*5&&Math.abs(z)<1.25)||Array.from({length:6},(_,i)=>Math.hypot(x-i*SPACING,z)<3.65).some(Boolean);}
  update(dt,keys,active){
    this.vel??={x:0,z:0};let x=0,z=0;
    if(active){const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);x=Math.sin(this.yaw)*f-Math.cos(this.yaw)*s;z=Math.cos(this.yaw)*f+Math.sin(this.yaw)*s;const len=Math.hypot(x,z);if(len){const speed=keys.ShiftLeft||keys.ShiftRight?3.5:2.6;x=x/len*speed;z=z/len*speed;}}
    const k=1-Math.exp(-dt*10);this.vel.x+=(x-this.vel.x)*k;this.vel.z+=(z-this.vel.z)*k;
    const nx=this.pos.x+this.vel.x*dt,nz=this.pos.z+this.vel.z*dt;
    if(this.walkable(nx,nz)){this.pos.x=nx;this.pos.z=nz;}else{if(this.walkable(nx,this.pos.z))this.pos.x=nx;if(this.walkable(this.pos.x,nz))this.pos.z=nz;}
    this.step=(this.step||0)+Math.hypot(this.vel.x,this.vel.z)*dt;if(this.step>.8){this.step=0;this.onStep?.();}
    this.camera.position.set(this.pos.x,1.65,this.pos.z);this.camera.lookAt(this.pos.x+Math.sin(this.yaw)*Math.cos(this.pitch),1.65+Math.sin(this.pitch),this.pos.z+Math.cos(this.yaw)*Math.cos(this.pitch));
  }
  nearest(){let best;for(const s of this.stations){const dx=s.x-this.pos.x,dz=s.z-this.pos.z,d=Math.hypot(dx,dz);const facing=d>.01?(dx*Math.sin(this.yaw)+dz*Math.cos(this.yaw))/d:1;if(d<1.75&&facing>-.1&&(!best||d<best.d))best={...s,d};}return best||null;}
}
