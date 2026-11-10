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
  box(3.6,.1,5,0,-.05,0);box(3.6,.1,5,0,3,0);box(.1,3,5,-1.8,1.5,0);box(.1,3,5,1.8,1.5,0);
  for(const z of[-2.5,2.5]){const hatch=pressureHatch({label:z<0?'INNER HATCH':'OUTER HATCH',action:'PRESSURE INTERLOCK',detail:'Open only after pressure matches'});hatch.position.z=z;hatch.rotation.y=z>0?Math.PI:0;this.scene.add(hatch);}
  this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=384;this.tex=new THREE.CanvasTexture(this.canvas);this.tex.colorSpace=THREE.SRGBColorSpace;
  const monitor=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.94),new THREE.MeshBasicMaterial({map:this.tex}));monitor.position.set(0,2,1.95);monitor.rotation.y=Math.PI;this.scene.add(monitor);
  this.update(0,{},false);
 }
 update(dt,keys,active){this.cycle.tick(dt);this.camera.position.set(0,1.65,0);this.camera.lookAt(Math.sin(this.yaw)*Math.cos(this.pitch),1.65+Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
  const g=this.canvas.getContext('2d');g.fillStyle='#102129';g.fillRect(0,0,1024,384);g.fillStyle='#9ce6d0';g.font='bold 32px sans-serif';g.fillText(this.cycle.label,25,65);g.font='48px sans-serif';g.fillText(`${this.cycle.pressure.toFixed(1)} kPa`,25,140);g.font='26px sans-serif';g.fillStyle='#ffffff';g.fillText('Training model · timings shortened · cabin 101.3 kPa',25,205);g.fillText(this.cycle.ready?'E / Use: open matched hatch':'Wait for pressure match. Both hatches stay locked.',25,260);g.fillText('R: cancel and return to the entry side',25,315);this.tex.needsUpdate=true;
 }
 nearest(){return {type:'airlock-control',label:this.cycle.ready?'open pressure-matched hatch':'pressure cycle in progress',d:1};}
 dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
}
