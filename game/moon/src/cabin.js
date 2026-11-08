import * as THREE from 'three';
import { pressureHatch } from '../../src/pressure-hatch.js';

// A fictional HLS-inspired training cabin, not a claim about SpaceX's internal layout.
export class LunarCabin {
  constructor(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101820');
    this.camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,40);
    this.pos=new THREE.Vector3(0,0,1.7);this.yaw=0;this.pitch=0;
    const mat=(color,metalness=.1)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.55});
    const white=mat('#d5dce0'),dark=mat('#28343d'),silver=mat('#8497a1',.65);
    const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);this.scene.add(o);return o;};
    add(new THREE.CylinderGeometry(3.55,3.55,.16,96),dark,0,-.08,0);
    add(new THREE.CylinderGeometry(3.6,3.6,3.6,96,1,true),new THREE.MeshStandardMaterial({color:'#c6cdd2',side:THREE.BackSide,roughness:.7}),0,1.8,0);
    add(new THREE.CylinderGeometry(3.55,3.55,.12,96),white,0,3.6,0);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,x=Math.sin(a)*3.48,z=Math.cos(a)*3.48;
      add(new THREE.BoxGeometry(.045,3.4,.045),silver,x,1.7,z);
    }
    for(const y of [.15,3.25]){const ring=add(new THREE.TorusGeometry(3.45,.035,8,96),silver,0,y,0);ring.rotation.x=Math.PI/2;}
    const lightMat=new THREE.MeshBasicMaterial({color:'#d6f4ff'});
    for(const x of[-1.5,1.5])add(new THREE.BoxGeometry(.13,.06,4.5),lightMat,x,3.43,0);
    this.scene.add(new THREE.HemisphereLight('#eff8ff','#3b4652',2));
    const lamp=new THREE.PointLight('#f0f7ff',35,12);lamp.position.set(0,2.8,0);this.scene.add(lamp);
    const hatch=pressureHatch();hatch.scale.setScalar(.85);hatch.rotation.y=Math.PI;hatch.position.set(0,0,3.45);this.scene.add(hatch);
    this.stations=[{id:'exit',x:0,z:2.65,label:'Crew elevator · go outside'},
      {id:'console',x:0,z:-2.5,label:'Flight and mission console'},
      {id:'oxygen',x:-2.5,z:0,label:'Life support · oxygen maker'},
      {id:'samples',x:2.5,z:0,label:'Sample locker · stow samples'}];
    for(const st of this.stations.filter(s=>s.id!=='exit')){
      const g=new THREE.Group();g.position.set(st.x,0,st.z);g.rotation.y=Math.atan2(-st.x,-st.z);this.scene.add(g);
      const cabinet=new THREE.Mesh(new THREE.BoxGeometry(1.45,1.05,.55),white);cabinet.position.y=.525;g.add(cabinet);
      const display=new THREE.Mesh(new THREE.BoxGeometry(1.3,.85,.1),dark);display.position.set(0,1.7,.03);g.add(display);
      const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
      ctx.fillStyle='#0c222b';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#91e9dd';ctx.font='bold 50px system-ui';
      const lines=st.id==='console'?['LUNAR OPERATIONS','Power · crew · mission','E / Use to open controls']:st.id==='oxygen'?['LIFE SUPPORT','Water → oxygen','E / Use to switch processor']:['SAMPLE LOCKER','Store your lunar samples','E / Use to unload'];
      lines.forEach((s,i)=>ctx.fillText(s,35,100+i*130));
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.7),new THREE.MeshBasicMaterial({map:tex}));screen.position.set(0,1.7,.09);g.add(screen);
      for(const x of[-.55,.55]){const latch=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.07),silver);latch.position.set(x,.65,.31);g.add(latch);}
    }
    // Bolted deck panels; a clear walking route between every station.
    for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)if(Math.hypot(x,z)<2.8){
      const panel=add(new THREE.BoxGeometry(.96,.015,.96),mat((x+z)%2?'#384650':'#40505b'),x,.01,z);
      for(const a of[-.4,.4])for(const b of[-.4,.4])add(new THREE.CylinderGeometry(.018,.018,.015,8),silver,x+a,.025,z+b);
    }
    this.update(0,{});
  }
  enter(){this.pos.set(0,0,1.7);this.yaw=0;this.pitch=0;this.update(0,{});}
  nearest(){return this.stations.find(s=>Math.hypot(s.x-this.pos.x,s.z-this.pos.z)<1.5);}
  update(dt,input){
    this.yaw-=(input.lookX||0)*.004;this.pitch=THREE.MathUtils.clamp(this.pitch-(input.lookY||0)*.003,-1.1,1.1);
    const dx=input.x||0,dz=input.z||0,n=Math.max(1,Math.hypot(dx,dz)),speed=input.run?3:2;
    this.pos.x+=(dx*Math.cos(this.yaw)+dz*Math.sin(this.yaw))*dt*speed/n;
    this.pos.z+=(-dx*Math.sin(this.yaw)+dz*Math.cos(this.yaw))*dt*speed/n;
    for(const s of this.stations.filter(s=>s.id!=='exit')){
      const dx=this.pos.x-s.x,dz=this.pos.z-s.z,d=Math.hypot(dx,dz);
      if(d<.7&&d>.001){this.pos.x=s.x+dx/d*.7;this.pos.z=s.z+dz/d*.7;}
    }
    const r=Math.hypot(this.pos.x,this.pos.z);if(r>2.8)this.pos.multiplyScalar(2.8/r);
    this.camera.position.set(this.pos.x,1.65,this.pos.z);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
  }
}
