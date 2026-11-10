import * as THREE from 'three';
import {pressureHatch} from './pressure-hatch.js';
import {AirlockCycle} from './airlock-state.js';
export class AirlockRoom {
 constructor(direction){
  this.cycle=new AirlockCycle(direction);this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#172127');
  this.camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,100);this.pos=new THREE.Vector3();this.yaw=0;this.pitch=0;this.vel={x:0,z:0};this.stations=[];
  this.scene.add(new THREE.HemisphereLight('#ecf4ff','#34302c',2));
  const mat=new THREE.MeshStandardMaterial({color:'#a7b0ad',roughness:.7,side:THREE.DoubleSide});
  const box=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);this.scene.add(m);};
  box(4.8,.1,5,0,-.05,0);box(4.8,.1,5,0,3,0);box(.1,3,5,-2.4,1.5,0);box(.1,3,5,2.4,1.5,0);
  for(const z of[-2.55,2.55])box(4.8,3.1,.1,0,1.5,z);
  for(const z of[-2.5,2.5]){const hatch=pressureHatch({label:z<0?'INNER HATCH':'OUTER HATCH',action:'PRESSURE INTERLOCK',detail:'Open only after pressure matches'});hatch.position.z=z;hatch.rotation.y=z>0?Math.PI:0;this.scene.add(hatch);}
  this.canvas=document.createElement('canvas');this.canvas.width=600;this.canvas.height=800;this.tex=new THREE.CanvasTexture(this.canvas);this.tex.colorSpace=THREE.SRGBColorSpace;
  const bezelMat=new THREE.MeshStandardMaterial({color:'#26383e',roughness:.45,metalness:.35});
  for(const z of[-2.3,2.3]){
   const bezel=new THREE.Mesh(new THREE.BoxGeometry(.96,1.25,.13),bezelMat);bezel.position.set(1.78,1.75,z);bezel.name='Door-side LCD housing';this.scene.add(bezel);
   const monitor=new THREE.Mesh(new THREE.PlaneGeometry(.84,1.12),new THREE.MeshBasicMaterial({map:this.tex}));monitor.position.set(1.78,1.75,z>0?z-.071:z+.071);monitor.rotation.y=z>0?Math.PI:0;monitor.name='Airlock pressure LCD';this.scene.add(monitor);
  }
  this.update(0,{},false);
 }
 update(dt,keys,active){this.cycle.tick(dt);this.camera.position.set(0,1.65,0);this.camera.lookAt(Math.sin(this.yaw)*Math.cos(this.pitch),1.65+Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
  const status=this.cycle.elapsed<2?'SEAL CHECK':this.cycle.ready?'PRESSURE MATCHED':this.cycle.direction==='out'?'DEPRESSURIZING':'REPRESSURIZING';
  const stamp=`${status}:${this.cycle.pressure.toFixed(1)}:${Math.floor(this.cycle.elapsed*10)}`;
  if(stamp===this.lastDisplay)return;this.lastDisplay=stamp;
  const g=this.canvas.getContext('2d');g.fillStyle='#0a1c24';g.fillRect(0,0,600,800);
  const text=(value,y,size=30,color='#daeeee')=>{g.fillStyle=color;g.font=`${size>=40?'bold ':''}${size}px monospace`;g.fillText(value,32,y);};
  text('AIRLOCK CONTROL',62,40,'#9ce6d0');text('CHAMBER PRESSURE',130,28);text(this.cycle.pressure.toFixed(1),223,84,'#9ce6d0');text('kPa',267,32);
  text(status,335,29,this.cycle.ready?'#9ce6d0':'#ffd392');
  text(`INNER: ${this.cycle.canOpen('inner')?'READY':'LOCKED'}`,402);text(`OUTER: ${this.cycle.canOpen('outer')?'READY':'LOCKED'}`,448);
  g.fillStyle='#28454f';g.fillRect(32,482,536,14);g.fillStyle='#9ce6d0';g.fillRect(32,482,536*this.cycle.elapsed/this.cycle.duration,14);
  text(this.cycle.ready?'E / USE: OPEN HATCH':'WAIT FOR PRESSURE',553,28);text('R: SAFE RETURN',603,28);
  text('TRAINING SIMULATION',692,23,'#8aa8af');text('Cycle time shortened',730,23,'#8aa8af');text('Cabin: 101.3 kPa',768,23,'#8aa8af');this.tex.needsUpdate=true;

 }
 nearest(){return {type:'airlock-control',label:this.cycle.ready?'open pressure-matched hatch':'pressure cycle in progress',d:1};}
 dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
}
