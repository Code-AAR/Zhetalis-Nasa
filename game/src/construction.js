import * as THREE from 'three';
import {heightAt} from './world.js';
import {ASSEMBLIES,buildState,fitPart,assemblyDone,circuitFor,circuitReady,circuitConnected,CIRCUITS} from './construction-state.js';

// In-world interactions: E / touch Use and clicks share the same ray and reach limit.
export class Construction {
 constructor(world,interior,{state,colony,save,sync,advance,guide}){
  Object.assign(this,{world,interior,state,colony,save,sync,advance,guide});
  this.ray=new THREE.Raycaster();this.ray.far=12;this.sockets=[];this.rubble=[];this.slots=[];this.held=null;this.wire=null;
  this.group=new THREE.Group();world.scene.add(this.group);
  this.bench=new THREE.Group();interior.scene.add(this.bench);this.bench.visible=false;
  const station=interior.stations.find(s=>s.type==='workbench');this.bench.position.set(station.x,1.2,station.z+.55);
  const m=world.settlement,ground=(x,z,y)=>new THREE.Vector3(x,heightAt(x,z)+y,z);
  const point=(id,label,v)=>{const mat=new THREE.MeshStandardMaterial({color:'#8be5d1',emissive:'#163a33',roughness:.4});const port=new THREE.Mesh(new THREE.TorusGeometry(.13,.045,12,32),mat);port.position.copy(v);port.userData={kind:'socket',id,label};this.group.add(port);this.sockets.push(port);
   const hole=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.09,24),new THREE.MeshStandardMaterial({color:'#101719'}));hole.rotation.x=Math.PI/2;port.add(hole);return port;};
  point('solar-out','Solar array OUT',ground(51.6,-19.5,.75));
  point('battery-in','Battery controller IN',m.pack.position.clone().add(new THREE.Vector3(-.45,.12,.52)));
  point('battery-out','Battery protected OUT',m.pack.position.clone().add(new THREE.Vector3(.45,.12,.52)));
  const e=m.entrances[0];point('base-in','Base IN',new THREE.Vector3(e.x+2.7,.77,e.doorZ+1.14));point('base-out','Base charger OUT',new THREE.Vector3(e.x+3.2,.77,e.doorZ+1.14));
  point('charger-in','Rover charger IN',ground(-30.8,26.24,.85));
  // A marked work zone away from camp. Training rubble uses the same rock surface.
  for(let i=0;i<4;i++){
   const x=43+i*2.4,z=-19.4+(i%2)*1.3;
   const mesh=new THREE.Mesh(world.rocks.geometry,world.rocks.material.clone());mesh.scale.set(.65,.45,.55);mesh.position.set(x,heightAt(x,z)+.22,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={kind:'rubble',id:i,label:'Site rock'};
   this.group.add(mesh);this.rubble.push(mesh);const c={x,z,r:.55,object:mesh};world.colliders.push(c);mesh.userData.collider=c;
  }
  for(const [x,z] of [[40,-22],[55,-22],[40,-14],[55,-14]]){const marker=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.65,8),new THREE.MeshStandardMaterial({color:'#e8bb65'}));marker.position.copy(ground(x,z,.325));this.group.add(marker);}
  this.ghosts=[];
  for(let i=0;i<3;i++){const source=world.solar.panels[i],pos=source.getWorldPosition(new THREE.Vector3());const ghost=new THREE.Mesh(new THREE.BoxGeometry(3.2,.15,2),new THREE.MeshBasicMaterial({color:'#8be5d1',transparent:true,opacity:.25,depthWrite:false}));ghost.position.copy(pos).add(new THREE.Vector3(0,.7,0));ghost.userData={kind:'deploy',id:i,label:'Place solar panel '+(i+1)};this.group.add(ghost);this.ghosts.push(ghost);}
  this.packGhost=new THREE.Mesh(new THREE.BoxGeometry(1.5,.9,1),new THREE.MeshBasicMaterial({color:'#8be5d1',transparent:true,opacity:.25,depthWrite:false}));this.packGhost.position.copy(m.pack.position);this.packGhost.userData={kind:'battery-place',label:'Place assembled battery'};this.group.add(this.packGhost);
  this.chargerGhost=new THREE.Mesh(new THREE.BoxGeometry(.55,1.35,.5),this.packGhost.material.clone());this.chargerGhost.position.copy(ground(-30.8,26,.675));this.chargerGhost.userData={kind:'charger-place',label:'Place assembled charging post'};this.group.add(this.chargerGhost);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(19*3),3));this.preview=new THREE.Line(lineGeo,new THREE.LineDashedMaterial({color:'#ffd577',dashSize:.3,gapSize:.15}));world.scene.add(this.preview);this.preview.visible=false;
  this.cables=new Map();this.removedApplied=new Set();this.notice='';this.noticeUntil=0;
  const pickMat=new THREE.MeshBasicMaterial({visible:false});for(const socket of this.sockets){const pick=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),pickMat);socket.add(pick);}
  this.rockSamples=[];const rm=new THREE.Matrix4(),rp=new THREE.Vector3(),rs=new THREE.Vector3();for(let i=0;i<world.rocks.count;i++){world.rocks.getMatrixAt(i,rm);rp.setFromMatrixPosition(rm);rs.setFromMatrixScale(rm);if(rp.y>-1000)this.rockSamples.push({id:i,matrix:rm.clone(),position:rp.clone(),radius:Math.max(rs.x,rs.y,rs.z)*2});}
  this.rockProxy=new THREE.Mesh(world.rocks.geometry,world.rocks.material);this.rockProxy.matrixAutoUpdate=false;
  this.drop=document.createElement('button');this.drop.id='construction-drop';this.drop.textContent='Drop held item (R)';this.drop.hidden=true;document.getElementById('hud').append(this.drop);this.drop.onclick=()=>this.cancel();
  this.placeBatteryButton=document.createElement('button');this.placeBatteryButton.id='construction-place-battery';this.placeBatteryButton.hidden=true;document.getElementById('hud').append(this.placeBatteryButton);this.placeBatteryButton.onclick=()=>this.placeBattery();
  this.heldDisplay=new THREE.Group();world.scene.add(this.heldDisplay);this.heldDisplay.visible=false;
 }
 begin(kind){this.heldDisplay.clear();this.heldDisplay.userData.name=null;document.getElementById('mission-objective').open=false;this.kind=kind;this.held=null;this.bench.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});this.bench.clear();this.slots=[];this.bench.visible=true;
  ASSEMBLIES[kind].forEach((name,i)=>{
   for(const isSlot of [false,true]){const mat=new THREE.MeshStandardMaterial({color:isSlot?'#6cddbf':i===1?'#234f85':'#c4beb0',transparent:isSlot,opacity:isSlot?.35:1,roughness:.6});let geometry;
   if(/frame/i.test(name)){const shape=new THREE.Shape();shape.moveTo(-.22,-.18);shape.lineTo(.22,-.18);shape.lineTo(.22,.18);shape.lineTo(-.22,.18);shape.closePath();const hole=new THREE.Path();hole.moveTo(-.16,-.12);hole.lineTo(-.16,.12);hole.lineTo(.16,.12);hole.lineTo(.16,-.12);hole.closePath();shape.holes.push(hole);geometry=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geometry.rotateX(-Math.PI/2);}
   else if(/connector|output/i.test(name)){geometry=new THREE.CylinderGeometry(.10,.10,.3,20);geometry.rotateX(Math.PI/2);}
   else geometry=new THREE.BoxGeometry(.38,/Battery/.test(name)?.27:.10,.32);
   const mesh=new THREE.Mesh(geometry,mat);
   if(!isSlot&&/Solar module|controller/.test(name)){for(let j=0;j<4;j++){const rib=new THREE.Mesh(new THREE.BoxGeometry(.012,.025,.28),new THREE.MeshStandardMaterial({color:/Solar/.test(name)?'#a5c9db':'#616f72'}));rib.position.set(-.14+j*.09,.065,0);mesh.add(rib);}}mesh.position.set((i-1)*.52,isSlot?.3:.08,isSlot?-.3:.35);mesh.userData={kind:isSlot?'slot':'part',name,label:(isSlot?'Fit into slot: ':'Pick up: ')+name};this.bench.add(mesh);this.slots.push(mesh);}
  });this.guide('Pick up a part from the front row, then select its matching highlighted slot. E / Use places it.');
 }
 placeBattery(){
  if(this.state().powerStep!==4||this.inside||this.blocked||this.world.driving)return false;
  const p=this.world.player.position,b=this.packGhost.position;
  if(Math.hypot(p.x-b.x,p.z-b.z)>4||Math.abs(p.y-b.y)>3){this.notify('Walk to the highlighted battery slot beside the panels.');return false;}
  this.advance(4);this.save();this.sync();this.placeBatteryButton.hidden=true;
  this.guide('Battery placed. Next, connect Solar OUT to Battery controller IN.',true);return true;
 }
 cancel(){dispatchEvent(new Event('zhetela-dismiss'));this.wire=null;this.held=null;this.preview.visible=false;this.heldDisplay.visible=false;}
 notify(text){this.notice=text;this.noticeUntil=performance.now()+2400;}
 removeRock(id){const w=this.world,m=new THREE.Matrix4(),p=new THREE.Vector3();w.rocks.getMatrixAt(id,m);p.setFromMatrixPosition(m);if(p.y<-1000)return;w.rocks.setMatrixAt(id,new THREE.Matrix4().makeTranslation(p.x,-10000,p.z));w.rocks.instanceMatrix.needsUpdate=true;w.rocks.computeBoundingSphere();w.lowRocks=w.lowRocks.filter(c=>Math.hypot(c.x-p.x,c.z-p.z)>.01);for(let i=w.colliders.length-1;i>=0;i--){const c=w.colliders[i];if(c.rock&&Math.hypot(c.x-p.x,c.z-p.z)<.01)w.colliders.splice(i,1);}}
 update(inside,room,blocked){
  const o=this.state(),s=buildState(o);this.drop.hidden=!(this.held||this.wire)||blocked;document.body.classList.toggle('construction-active',!!this.kind&&inside);this.inside=inside;this.room=room;this.blocked=blocked||this.world.driving;
  const batteryDistance=Math.hypot(this.world.player.position.x-this.packGhost.position.x,this.world.player.position.z-this.packGhost.position.z);
  this.placeBatteryButton.hidden=o.powerStep!==4||inside||this.blocked;this.placeBatteryButton.disabled=batteryDistance>4||Math.abs(this.world.player.position.y-this.packGhost.position.y)>3;this.placeBatteryButton.textContent=this.placeBatteryButton.disabled?`Battery slot · ${Math.ceil(batteryDistance)} m away`:'Place battery (X)';
  for(const id of s.removed||[])if(!this.removedApplied.has(id)){this.removeRock(id);this.removedApplied.add(id);}
  this.rubble.forEach((m,i)=>m.visible=o.powerStep<=2&&!s.cleared.includes(i));
  this.ghosts.forEach((g,i)=>{g.material.opacity=s.cleared.length>=4?.3:.08;g.visible=o.powerStep===2&&!s.placed.field?.includes(i);if(o.powerStep===2)this.world.solar.panels[i].visible=!!s.placed.field?.includes(i);});
  this.packGhost.visible=o.powerStep===4;this.chargerGhost.visible=o.chargerStep===1;
  this.bench.visible=!!this.kind&&inside&&room===this.interior;
  if(this.kind){const placed=s.placed[this.kind]||[];for(const mesh of this.slots){const done=placed.includes(mesh.userData.name);mesh.visible=mesh.userData.kind==='slot'||(!done&&this.held!==mesh.userData.name);if(mesh.userData.kind==='slot'){mesh.material.opacity=done?1:.35;mesh.material.color.set(done?'#bfc4b5':this.held===mesh.userData.name?'#ffd577':'#6cddbf');}}}
  const partner=this.wire?{'solar-out':'battery-in','battery-in':'solar-out','battery-out':'base-in','base-in':'battery-out','base-out':'charger-in','charger-in':'base-out'}[this.wire]:null;
  this.sockets.forEach(mesh=>{const id=mesh.userData.id;mesh.visible=id==='solar-out'?o.powerStep>=5:id.startsWith('battery')?o.powerStep>=5:id==='charger-in'?o.chargerStep>=2:o.powerStep>=6;mesh.material.color.set(circuitConnected(o,CIRCUITS.findIndex(pair=>pair.includes(id)))?'#69d897':this.wire===id?'#ffd577':partner===id?'#b78cff':'#8be5d1');});
  for(let i=0;i<3;i++){const connected=i===0?o.powerStep>=6:i===1?o.baseConnected:o.chargerStep>=3;if(connected&&!this.cables.has(i)){const ids=[['solar-out','battery-in'],['battery-out','base-in'],['base-out','charger-in']][i];const a=this.sockets.find(p=>p.userData.id===ids[0]).position,b=this.sockets.find(p=>p.userData.id===ids[1]).position;const pts=[a.clone()];for(let j=0;j<=24;j++){const t=j/24,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t)+Math.sin(t*Math.PI)*.6;pts.push(new THREE.Vector3(x,heightAt(x,z)+.07,z));}pts.push(b.clone());const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),100,.04,8,false),new THREE.MeshStandardMaterial({color:'#252e30',roughness:.8}));this.world.scene.add(cable);this.cables.set(i,cable);}}
  // Legacy cables ended at the wrong model faces; visible leads now terminate at sockets.
  this.world.settlement.cable.visible=false;this.world.settlement.chargerCable.visible=false;
  this.hit=null;this.hint='';if(this.blocked){this.preview.visible=false;this.heldDisplay.visible=false;return;}
  let camera=inside?room.camera:this.world.camera;
  if(inside){camera=camera.clone();camera.position.add(room.scene.position);camera.updateMatrixWorld();}
  this.group.updateMatrixWorld(true);this.interior.scene.updateMatrixWorld(true);
  this.ray.setFromCamera(this.world.aimPoint||new THREE.Vector2(0,0),camera);
  const objects=inside?(this.bench.visible?this.slots.filter(p=>p.visible):[]):[...this.sockets,...this.rubble,...this.ghosts,this.packGhost,this.chargerGhost].filter(p=>p.visible);
  let hit=this.ray.intersectObjects(objects,true)[0];
  if(!inside&&this.colony().tool==='pickaxe'){const player=this.world.player.position;for(const sample of this.rockSamples){if(this.removedApplied.has(sample.id)||Math.hypot(sample.position.x-player.x,sample.position.z-player.z)>sample.radius+3.3)continue;this.rockProxy.matrixWorld.copy(sample.matrix);const rock=this.ray.intersectObject(this.rockProxy,false)[0];if(rock&&(!hit||rock.distance<hit.distance)){rock.object=this.world.rocks;rock.instanceId=sample.id;hit=rock;}}}
  if(hit&&hit.object!==this.world.rocks){while(!hit.object.userData.kind&&hit.object.parent)hit.object=hit.object.parent;}
  const player=inside?room.pos.clone().add(room.scene.position):this.world.player.position;
  if(hit&&hit.point.distanceTo(player.clone().add(new THREE.Vector3(0,1,0)))<3.3){this.hit=hit;this.hint=hit.object===this.world.rocks?'E / Use · break surface rock with pickaxe':`E / Use · ${hit.object.userData.label}`;}
  if(this.hit?.object.userData.kind==='socket'&&circuitConnected(o,CIRCUITS.findIndex(pair=>pair.includes(this.hit.object.userData.id))))this.hint=this.hit.object.userData.label+' · already connected';
  if(this.held)this.hint=`Holding ${this.held} · `+this.hint+' · R to cancel';
  if(this.wire){const target=this.sockets.find(p=>p.userData.id===partner);this.hint=`Cable → ${target.userData.label} · ${Math.round(target.position.distanceTo(player))} m · E / Use · R to drop. `+this.hint;}
  if(this.noticeUntil>performance.now())this.hint=this.notice+' · '+this.hint;
  this.heldDisplay.visible=!!this.held&&inside&&!blocked;
  if(this.heldDisplay.visible){if(this.heldDisplay.userData.name!==this.held){this.heldDisplay.clear();const source=this.slots.find(m=>m.userData.kind==='part'&&m.userData.name===this.held);const copy=source.clone();copy.position.set(0,0,0);copy.visible=true;this.heldDisplay.add(copy);this.heldDisplay.userData.name=this.held;}this.heldDisplay.position.set(.35,-.3,-.8).applyMatrix4(camera.matrixWorld);this.heldDisplay.quaternion.copy(camera.quaternion);}
  this.preview.visible=!!this.wire&&!inside;
  if(this.preview.visible){const a=this.sockets.find(p=>p.userData.id===this.wire).position,b=this.hit?.point||player.clone().add(new THREE.Vector3(0,1,0));const pts=[a.clone()];for(let j=0;j<=16;j++){const t=j/16,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t);pts.push(new THREE.Vector3(x,heightAt(x,z)+.1,z));}pts.push(b.clone());const attr=this.preview.geometry.attributes.position;pts.forEach((p,i)=>attr.setXYZ(i,p.x,p.y,p.z));attr.needsUpdate=true;this.preview.geometry.computeBoundingSphere();this.preview.computeLineDistances();}
 }
 use(){
  if(this.blocked||!this.hit)return false;
  const o=this.state(),s=buildState(o),mesh=this.hit.object,d=mesh.userData;
  if(mesh===this.world.rocks||d.kind==='rubble'){
   if(this.colony().tool!=='pickaxe'){this.guide('Equip the pickaxe from your tool belt before breaking this rock.');return true;}
   if(mesh===this.world.rocks){const near=this.world.nearest();if(near&&['ore','ice','pod','panels','door'].includes(near.type)&&near.d<1.8)return false;}
   let strikes=3;if(mesh===this.world.rocks){const matrix=new THREE.Matrix4(),size=new THREE.Vector3();mesh.getMatrixAt(this.hit.instanceId,matrix);size.setFromMatrixScale(matrix);if(Math.max(size.x,size.z)>6){this.notify('Boulder too large for a hand pickaxe · go around it');return true;}strikes=Math.min(12,3+Math.ceil(Math.max(size.x,size.y,size.z)));}
   const id=mesh===this.world.rocks?'rock-'+this.hit.instanceId:'site-'+d.id,instance=this.hit.instanceId;
   if(this.striking)return true;this.striking=true;
   const accepted=this.world.swingTool(()=>{this.striking=false;s.rockHits[id]=(s.rockHits[id]||0)+1;if(s.rockHits[id]>=strikes){if(d.kind==='rubble'){if(!s.cleared.includes(d.id))s.cleared.push(d.id);mesh.visible=false;}else if(!s.removed.includes(instance)){s.removed.push(instance);this.removeRock(instance);this.removedApplied.add(instance);}this.notify(d.kind==='rubble'?`Site cleared: ${s.cleared.length}/4 rocks.`:'Rock cleared. Identified mineral deposits give samples; ordinary rubble does not.',true);}else this.notify(`Rock: ${strikes-s.rockHits[id]} more strikes.`);this.save();});if(!accepted)this.striking=false;return true;
  }
  if(d.kind==='part'){this.held=d.name;return true;}
  if(d.kind==='slot'){
   if(!fitPart(o,this.kind,this.held,d.name)){this.guide('Fit the parts in order: frame or battery first, then module or controller, then connector. Pick the matching part from the front row.');return true;}
   this.held=null;this.notify(`${d.name} fitted.`);
   if(assemblyDone(o,this.kind)){const kind=this.kind;this.kind=null;this.bench.visible=false;if(kind==='array')this.advance(1);else if(kind==='battery')this.advance(3);else{o.chargerStep=1;this.sync();}this.guide(kind==='array'?'Kit assembled. Clear the four small marked rocks at the remote power site, then place the panels.':kind==='charger'?'Kit assembled. Carry it to the parking bay.':'Battery kit assembled. Place it at the remote power site.',true);}this.save();return true;
  }
  if(d.kind==='deploy'){if(o.powerStep!==2||s.cleared.length<4)return true;(s.placed.field??=[]);if(!s.placed.field.includes(d.id))s.placed.field.push(d.id);if(s.placed.field.length===3)this.advance(2);this.notify(`Solar panels placed: ${s.placed.field.length}/3.`);this.save();return true;}
  if(d.kind==='battery-place'){this.placeBattery();return true;}
  if(d.kind==='charger-place'){if(o.chargerStep===1){o.chargerStep=2;this.sync();this.save();this.guide('Charger placed. Connect Base charger OUT to Rover charger IN.');}return true;}
  if(d.kind==='socket'){
   const socketCircuit=CIRCUITS.findIndex(pair=>pair.includes(d.id));
   if(circuitConnected(o,socketCircuit)){
    if(this.wire&&CIRCUITS[socketCircuit]?.includes(this.wire))this.cancel();
    this.guide(socketCircuit===2?'Charger cable already connected. Park the rover in the cyan bay. A full battery will not charge further.':'This cable is already connected. No need to connect it again.');return true;
   }
   if(this.wire===d.id){this.cancel();this.notify('Cable released.');return true;}
   if(!this.wire&&!circuitReady(o,socketCircuit)){this.guide(socketCircuit===2?'First place the charging post and connect the base to its battery.':'First assemble and place the battery, then connect the solar array.');return true;}
   if(!this.wire){this.wire=d.id;this.guide('Cable selected. Walk to the matching socket and press E / Use. R cancels.');return true;}
   const index=circuitFor(this.wire,d.id);
   if(index<0){const pair=CIRCUITS.find(pair=>pair.includes(this.wire));const partner=this.sockets.find(p=>p.userData.id===pair?.find(id=>id!==this.wire));this.guide(`Wrong socket. Connect this cable to ${partner?.userData.label||'its matching socket'}. R / Drop cancels.`);return true;}
   if(!circuitReady(o,index)){this.cancel();this.guide('The equipment changed. Finish placing and connecting its power supply first.');return true;}
   if(index===0)this.advance(5);else if(index===1)o.baseConnected=true;else o.chargerStep=3;
   this.wire=null;o.today=o.forecast();this.sync();this.save();this.guide(['Solar connected through the charge controller. Next: battery OUT to base IN.','Base connected. The battery can supply it after sunset while charge remains.','Charger connected. Park the rover in the bay to test it.'][index],true);return true;
  }
  return false;
 }
}
