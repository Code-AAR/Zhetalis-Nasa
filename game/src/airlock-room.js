import {crouchHeld,updateCrouch} from './crouch.js';
import * as THREE from 'three';
import {pressureHatch} from './pressure-hatch.js';
import {AirlockCycle} from './airlock-state.js';
import {loadModel} from './nasamodels.js';

// The pressure chamber between the habitat and Mars, laid out like the ISS Quest crewlock: a padded cylinder with
// ring frames, yellow handrails, an umbilical interface panel feeding a spare Z-2 suit on its donning stand, a depress
// pump and oxygen bottles, Crew Lock Bags and tools strapped to the wall. The player stands in the middle and looks
// around. Real NASA models (Z-2 suit, helmet, Crew Lock Bag, ORU, Pistol Grip Tool) load in when ready; until then,
// and if they fail, the room is still complete. Gauges, beacons, lights and vent mist follow the pressure cycle.
const R = 2.6, CY = 1.3, LEN = 5.2;                     // chamber radius, axis height above the floor, length (m)

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export class AirlockRoom {
 constructor(direction){
  this.cycle=new AirlockCycle(direction);this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#10171b');
  this.camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,100);this.pos=new THREE.Vector3();this.yaw=0;this.pitch=0;this.vel={x:0,z:0};this.stations=[];
  this.time=0;this.disposed=false;
  const S=this.scene;
  S.add(new THREE.HemisphereLight('#e8f1ff','#3a3430',1.1));
  this.lamps=[-1.4,1.4].map(z=>{const l=new THREE.PointLight('#f4f7ff',7,0,2);l.position.set(0,CY+R-.45,z);S.add(l);return l;});
  const M=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:o.r??.6,metalness:o.m??0,emissive:o.e??'#000',emissiveIntensity:o.ei??1,side:o.side??THREE.FrontSide,map:o.map??null});
  const add=(geo,mat,x=0,y=0,z=0,parent=S)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;};
  const box=(w,h,d,mat,x,y,z,p)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,p);
  const cyl=(r,h,mat,x,y,z,axis='y',seg=20,p)=>{const m=add(new THREE.CylinderGeometry(r,r,h,seg),mat,x,y,z,p);if(axis==='x')m.rotation.z=Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;return m;};
  const wallX=y=>Math.sqrt(R*R-(y-CY)**2);             // half-width of the cylinder at height y

  // ---- shell: padded beta-cloth panels on a cylinder, a grated floor, closed end bulkheads
  const padTex=canvasTex(512,512,(g,w,h)=>{
    g.fillStyle='#d9ddd8';g.fillRect(0,0,w,h);
    for(let i=0;i<4000;i++){g.fillStyle=`rgba(0,0,0,${Math.random()*.035})`;g.fillRect(Math.random()*w,Math.random()*h,2,2);}   // woven cloth grain
    g.strokeStyle='#9aa19c';g.lineWidth=6;g.strokeRect(3,3,w-6,h-6);                                             // panel seams
    g.strokeStyle='#b6bcb7';g.lineWidth=2;g.beginPath();g.moveTo(w/2,8);g.lineTo(w/2,h-8);g.stroke();
    g.fillStyle='#8d948f';for(const [x,y] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24],[w/2,24],[w/2,h-24]]){g.beginPath();g.arc(x,y,7,0,7);g.fill();}   // snap fasteners
  },[10,2]);
  const shell=add(new THREE.CylinderGeometry(R,R,LEN,64,1,true),M('#ffffff',{map:padTex,r:.85,side:THREE.BackSide}),0,CY,0);shell.rotation.x=Math.PI/2;
  const bulk=M('#c3c9c5',{r:.7});
  for(const z of[-LEN/2,LEN/2]){const c=add(new THREE.CircleGeometry(R,64),bulk,0,CY,z);c.rotation.y=z>0?Math.PI:0;}
  const floorTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#3d4448';g.fillRect(0,0,w,h);g.fillStyle='#1c2124';
    for(let y=8;y<h;y+=32)for(let x=8;x<w;x+=32)g.fillRect(x,y,22,22);g.strokeStyle='#59626a';g.lineWidth=3;g.strokeRect(1,1,w-2,h-2);},[6,7]);
  const floorW=2*wallX(0)+.02;
  box(floorW,.08,LEN,M('#ffffff',{map:floorTex,r:.55,m:.5}),0,-.04,0);
  const kick=M('#f0c419',{r:.5});for(const s of[-1,1])box(.06,.12,LEN-.3,kick,s*(floorW/2-.06),.06,0);         // yellow kick strips
  for(const s of[-1,1])box(.5,.01,.5,M('#1a1f22',{r:.4,m:.6}),s*1.2,.005,0);                                     // depress vents under the floor

  // ring frames and their bolt heads
  const frame=M('#9aa4a6',{r:.35,m:.7});
  for(const z of[-1.6,0,1.6]){const t=add(new THREE.TorusGeometry(R-.04,.07,8,72),frame,0,CY,z);
    for(let a=0;a<24;a++){const ang=a/24*Math.PI*2,y=CY+Math.sin(ang)*(R-.12);if(y<.05)continue;cyl(.018,.03,M('#5d6668',{r:.3,m:.8}),Math.cos(ang)*(R-.12),y,z+.07,'z',8);}}

  // ceiling LED strips (they turn amber while the chamber cycles)
  this.ledMat=M('#fff6e6',{e:'#fff1d6',ei:1.6});
  for(const s of[-.55,.55])box(.12,.03,LEN-.6,this.ledMat,s,CY+wallX(0)*0+R-.06-(s*s*.1),0).rotation.z=-s*.2;

  // yellow EVA handrails: both walls and along the ceiling, on standoffs
  const rail=M('#f2c318',{r:.45}),standoff=M('#7f888a',{r:.35,m:.7});
  const handrail=(x,y,z,len,axis)=>{cyl(.019,len,rail,x,y,z,axis,12);for(const k of[-.42,.42]){const sx=axis==='z'?x:x+k*len,sz=axis==='z'?z+k*len:z;
    const out=Math.sign(x)||1;box(.08,.03,.03,standoff,sx+out*.05,y,sz);}};
  for(const s of[-1,1]){const x=s*(wallX(1.15)-.12);handrail(x,1.15,-1.05,1.1,'z');handrail(x,1.15,1.05,1.1,'z');}
  for(const s of[-1,1])cyl(.019,1.6,rail,s*.45,CY+R-.25,0,'z',12);

  // ---- hatches (real interlocked pressure hatches), with an equalisation valve beside each
  for(const z of[-2.5,2.5]){const hatch=pressureHatch({label:z<0?'INNER HATCH':'OUTER HATCH',action:'PRESSURE INTERLOCK',detail:'Open only after pressure matches'});hatch.position.z=z;hatch.rotation.y=z>0?Math.PI:0;S.add(hatch);
    const dz=z>0?-.12:.12;cyl(.09,.08,frame,-1.25,2.35,z+dz*1.4,'z',24);cyl(.05,.2,M('#c0392b',{r:.5}),-1.25,2.35,z+dz*2.2,'x',12);}

  // ---- the LCDs (pressure readout) and analog gauges either side of each hatch
  this.canvas=document.createElement('canvas');this.canvas.width=600;this.canvas.height=800;this.tex=new THREE.CanvasTexture(this.canvas);this.tex.colorSpace=THREE.SRGBColorSpace;
  const bezelMat=M('#26383e',{r:.45,m:.35});
  const dialTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#f4f2ea';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.strokeStyle='#222';g.lineWidth=8;g.stroke();
    g.fillStyle='#c0392b';g.beginPath();g.moveTo(128,128);g.arc(128,128,108,Math.PI*.75,Math.PI*.95);g.fill();g.fillStyle='#f4f2ea';g.beginPath();g.arc(128,128,92,0,7);g.fill();
    g.strokeStyle='#222';g.lineWidth=3;g.font='bold 18px sans-serif';g.fillStyle='#222';g.textAlign='center';
    for(let i=0;i<=10;i++){const a=Math.PI*.75+i/10*Math.PI*1.5,c=Math.cos(a),s=Math.sin(a);g.beginPath();g.moveTo(128+c*104,128+s*104);g.lineTo(128+c*(i%5?96:88),128+s*(i%5?96:88));g.stroke();
      if(i%2===0)g.fillText(String(i*10),128+c*74,134+s*74);}
    g.font='bold 16px sans-serif';g.fillText('kPa',128,190);g.fillText('CHAMBER',128,82);});
  this.needles=[];
  for(const z of[-2.3,2.3]){
   const f=z>0?Math.PI:0,inward=z>0?-.071:.071;
   const bezel=box(.96,1.25,.13,bezelMat,1.78,1.75,z);bezel.name='Door-side LCD housing';
   const monitor=add(new THREE.PlaneGeometry(.84,1.12),new THREE.MeshBasicMaterial({map:this.tex}),1.78,1.75,z+inward);monitor.rotation.y=f;monitor.name='Airlock pressure LCD';
   const gauge=new THREE.Group();gauge.position.set(-1.72,1.6,z);gauge.rotation.y=f;S.add(gauge);
   cyl(.24,.08,frame,0,0,0,'z',40,gauge);
   add(new THREE.CircleGeometry(.215,40),new THREE.MeshBasicMaterial({map:dialTex}),0,0,.045,gauge);
   const pivot=new THREE.Group();pivot.position.z=.05;gauge.add(pivot);box(.012,.17,.006,M('#111',{r:.4}),0,.075,0,pivot);cyl(.02,.02,M('#111'),0,0,.004,'z',12,pivot);
   this.needles.push(pivot);
   // rotating warning beacon above the hatch
   const beacon=new THREE.Group();beacon.position.set(1.15,3.3,z+(z>0?-.15:.15));S.add(beacon);
   cyl(.08,.05,M('#30363a',{r:.5}),0,-.04,0,'y',16,beacon);
   const dome=add(new THREE.SphereGeometry(.075,16,10,0,Math.PI*2,0,Math.PI/2),M('#ffb020',{e:'#ff9a00',ei:2,r:.3}),0,0,0,beacon);
   (this.beacons??=[]).push({beacon,dome,light:(()=>{const l=new THREE.PointLight('#ffa020',0,4,2);l.position.set(1.15,3.15,z*.92);S.add(l);return l;})()});
  }

  // ---- left wall: umbilical interface panel feeding the spare suit on its donning stand
  const panelMat=M('#5e6b70',{r:.5,m:.4}),connector=M('#c9d2d4',{r:.25,m:.85});
  const uiaX=-wallX(1.4)+.1;
  const uia=box(.08,.8,.7,panelMat,uiaX,1.4,.85);uia.rotation.z=-.12;uia.renderOrder=0;
  const uiaLabel=canvasTex(256,320,(g,w,h)=>{g.fillStyle='#5e6b70';g.fillRect(0,0,w,h);g.fillStyle='#f5f5ee';g.font='bold 30px monospace';g.fillText('UIA',18,40);
    g.font='20px monospace';['EV1  O2','EV1  H2O','EV1  PWR','WASTE','EV2  O2'].forEach((t,i)=>g.fillText(t,18,92+i*46));
    g.fillStyle='#f2c318';g.fillRect(0,h-26,w,26);g.fillStyle='#222';g.font='bold 18px monospace';g.fillText('CAUTION  HIGH PRESSURE O2',8,h-7);});
  add(new THREE.PlaneGeometry(.66,.78),new THREE.MeshStandardMaterial({map:uiaLabel,roughness:.6}),.042,0,0,uia).rotation.y=Math.PI/2;   // label rides on the tilted panel
  const hoseMat=M('#e8e4d8',{r:.7});
  for(let i=0;i<3;i++){const y=1.62-i*.2;cyl(.035,.08,connector,uiaX+.08,y,.62,'x',16);
    const pts=[new THREE.Vector3(uiaX+.1,y,.62),new THREE.Vector3(uiaX+.5,y-.5,.5),new THREE.Vector3(-1.55,.9+i*.05,-.1),new THREE.Vector3(-1.45,1.25,-.38)];
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.022,8),i===1?M('#3b78b5',{r:.6}):hoseMat);}
  // donning stand: base plate, post, waist ring that holds the suit up
  const stand=M('#828c8e',{r:.4,m:.7});
  box(.8,.04,.7,stand,-1.62,.02,-.55);cyl(.04,1.15,stand,-1.95,.6,-.55);box(.4,.05,.05,stand,-1.78,1.12,-.55);
  this.suitSpot=add(new THREE.TorusGeometry(.26,.03,8,32),stand,-1.6,1.12,-.55);this.suitSpot.rotation.x=Math.PI/2;
  // helmet shelf with bungee
  box(.36,.03,.9,M('#c49a6c',{r:.7}),-wallX(1.95)+.22,1.95,1.1);box(.02,.02,.9,M('#222',{r:.9}),-wallX(2.05)+.38,2.05,1.1);

  // ---- right wall: depress pump, oxygen bottles, tool stowage
  const pumpX=wallX(.4)-.42;
  box(.55,.7,.75,M('#d7dcd8',{r:.55}),pumpX,.35,-1.25);box(.56,.08,.76,M('#2f3a3e',{r:.4,m:.4}),pumpX,.72,-1.25);
  const pumpFace=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#d7dcd8';g.fillRect(0,0,w,h);g.fillStyle='#222';g.font='bold 26px monospace';g.fillText('DEPRESS',20,40);g.fillText('PUMP',20,72);
    for(let y=110;y<230;y+=14){g.fillStyle='#4b5559';g.fillRect(20,y,150,7);}g.fillStyle='#2ecc71';g.beginPath();g.arc(210,130,16,0,7);g.fill();});
  add(new THREE.PlaneGeometry(.72,.62),new THREE.MeshStandardMaterial({map:pumpFace,roughness:.6}),pumpX-.28,.36,-1.25).rotation.y=-Math.PI/2;
  this.pumpLight=add(new THREE.SphereGeometry(.025,10,8),M('#2ecc71',{e:'#2ecc71',ei:2}),pumpX-.285,.5,-1.0);
  const o2=M('#2e8b57',{r:.35,m:.3}),valve=M('#c9ced0',{r:.25,m:.85});
  for(let i=0;i<3;i++){const z=.05+i*.3,x=wallX(.6)-.28;cyl(.12,1.0,o2,x,.55,z,'y',24);add(new THREE.SphereGeometry(.12,20,10,0,Math.PI*2,0,Math.PI/2),o2,x,1.05,z);cyl(.03,.1,valve,x,1.2,z);
    box(.27,.04,.27,M('#222',{r:.9}),x,.85,z);}
  // tool board
  const board=box(.05,.9,1.1,M('#6c787c',{r:.6,m:.2}),wallX(1.9)-.12,1.9,1.15);board.rotation.z=.25;

  // ---- vent mist (air leaving or returning through the floor vents)
  const puff=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,2,32,32,30);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);});
  this.mist=[];for(let i=0;i<28;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:puff,color:'#dfe9ee',transparent:true,opacity:0,depthWrite:false}));S.add(sp);this.mist.push({sp,life:0});}

  // ---- real NASA models, scaled to real sizes (shared, cached geometry: tagged so dispose() leaves it alone)
  const place=(file,size,x,y,z,ry=0,tilt)=>loadModel(file).then(g=>{
    if(!g||this.disposed)return;const o=g.scene.clone(true),b=new THREE.Box3().setFromObject(o),s=b.getSize(new THREE.Vector3());
    o.scale.setScalar(size/Math.max(s.x,s.y,s.z));const b2=new THREE.Box3().setFromObject(o),c=b2.getCenter(new THREE.Vector3());
    const h=new THREE.Group();o.position.set(-c.x,-b2.min.y,-c.z);h.add(o);h.position.set(x,y,z);h.rotation.y=ry;if(tilt)h.rotation.z=tilt;
    o.traverse(m=>{m.userData.sharedAsset=true;if(!m.isMesh)return;for(const mt of[].concat(m.material)){mt.userData.sharedAsset=true;
      if(mt.transmission>0){mt.transmission=0;mt.needsUpdate=true;}}});
    S.add(h);
  });
  place('models/nasa-spacesuits/z2-suit-web.glb',1.9,-1.6,.04,-.55,Math.PI/2);                 // spare Z-2 suit on the stand
  place('nasa/shelter/helmet.glb',.34,-wallX(1.95)+.22,1.965,.8,Math.PI/2);
  place('nasa/shelter/crew-lock-bag.glb',.5,wallX(1.5)-.32,1.3,-.15,-Math.PI/2);              // Crew Lock Bags strapped above the bottles
  place('nasa/shelter/crew-lock-bag.glb',.5,wallX(1.5)-.32,1.3,.55,-Math.PI/2);
  place('nasa/shelter/orbital-replacement-unit.glb',.34,1.1,.0,1.75,-Math.PI/2);
  place('pistol-grip-tool.glb',.45,wallX(1.9)-.2,1.62,.8,-Math.PI/2,.25);                    // tools clipped to the board, as on ISS EVA prep
  place('wrench.glb',.42,wallX(1.9)-.2,1.75,1.15,-Math.PI/2,.25);
  place('tools/rock-pick.glb',.55,wallX(1.9)-.2,1.6,1.5,-Math.PI/2,.25);

  this.update(0,{},false);
 }
 update(dt,keys,active){
  const crouchDrop=updateCrouch(this,dt,active&&crouchHeld(keys));this.cycle.tick(dt);this.time+=dt;this.camera.position.set(0,1.65-crouchDrop,0);this.camera.lookAt(Math.sin(this.yaw)*Math.cos(this.pitch),1.65-crouchDrop+Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
  this.animateChamber(dt);
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
 // Gauges, beacons, lighting and vent mist follow the cycle: amber and spinning while pressure moves, green when matched.
 animateChamber(dt){
  const c=this.cycle,moving=c.elapsed>=2&&!c.ready,p=c.pressure;
  const ang=Math.PI*.75+Math.min(1,p/100)*Math.PI*1.5;                // dial: 0 kPa lower left, 100 kPa lower right
  for(const n of this.needles)n.rotation.z=-ang-Math.PI*.5+(Math.random()-.5)*(moving?.01:0);
  for(const b of this.beacons){b.beacon.rotation.y+=dt*(moving?7:0);b.light.intensity=moving?2+1.5*Math.max(0,Math.sin(this.time*14)):0;
    b.dome.material.emissive.set(c.ready?'#2ecc71':'#ff9a00');b.dome.material.color.set(c.ready?'#2ecc71':'#ffb020');b.dome.material.emissiveIntensity=moving||c.ready?2:.3;}
  this.ledMat.emissive.set(moving?'#ffc27a':'#fff1d6');
  for(const l of this.lamps)l.color.set(moving?'#ffd8a8':'#f4f7ff');
  this.pumpLight.material.emissive.set(moving&&c.direction==='out'?'#ff9a00':'#2ecc71');
  const rate=moving?(c.direction==='out'?18:10):0;                     // puffs per second
  this.mistClock=(this.mistClock??0)+dt*rate;
  for(const m of this.mist){
   if(m.life<=0&&this.mistClock>=1){this.mistClock-=1;m.life=m.max=1.6+Math.random();const s=Math.random()<.5?-1:1;
     m.sp.position.set(s*1.2+(Math.random()-.5)*.4,.05,(Math.random()-.5)*.4);m.v=new THREE.Vector3((Math.random()-.5)*.3,.35+Math.random()*.35,(Math.random()-.5)*.3);}
   if(m.life>0){m.life-=dt;const t=1-m.life/m.max;m.sp.position.addScaledVector(m.v,dt);m.sp.scale.setScalar(.25+t*1.1);m.sp.material.opacity=.32*Math.sin(Math.PI*t);}
   else m.sp.material.opacity=0;
  }
 }
 nearest(){return {type:'airlock-control',label:this.cycle.ready?'open pressure-matched hatch':'pressure cycle in progress',d:1};}
 dispose(){this.disposed=true;const geometries=new Set(),materials=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.userData.sharedAsset)return;if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){if(m.userData.sharedAsset)continue;materials.add(m);if(m.map)textures.add(m.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
}
