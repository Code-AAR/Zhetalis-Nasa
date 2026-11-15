import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {roverSupport,suspensionPose,sampledSuspensionPose,DEFAULT_CONTACTS} from '../game/src/rover-support.js';
// Independent rendered transform: steering, then Euler XYZ body, then parent yaw.
function rotate([x,y,z],pitch,roll,yaw){
 [x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];
 [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
 return [x*Math.cos(yaw)+z*Math.sin(yaw),y,-x*Math.sin(yaw)+z*Math.cos(yaw)];
}
function bottom(pos,yaw,w,pitch,roll,travel,radius){
 const steer=w.steer?.rotation.y??0;
 const u=rotate([0,1,0],pitch,roll,yaw),v=rotate([Math.sin(steer),0,Math.cos(steer)],pitch,roll,yaw);
 const center=rotate([w.track,radius+travel,w.axle],pitch,roll,yaw);
 const n=Math.hypot(u[1],v[1]);
 return center.map((c,i)=>[pos.x,pos.y,pos.z][i]+c-radius*(u[1]*u[i]+v[1]*v[i])/n);
}
function gaps(pos,yaw,wheels,pitch,roll,pose,sample,radius=.4){return wheels.map((w,i)=>{const [x,y,z]=bottom({...pos,y:pose.y},yaw,w,pitch,roll,pose.travel[i],radius);return y-sample(x,z);});}
const pos={x:0,y:0,z:0};
// Reproduce the old false positive: old tests compared to unrotated ground samples.
const slope=(x,z)=>.3*x+.4*z;
const support=roverSupport(pos,.7,slope);
const old=suspensionPose(support.contacts,support.pitch,support.roll,0,0);
const oldGap=Math.max(...gaps(pos,.7,support.contacts,support.pitch,support.roll,old,slope).map(Math.abs));
assert.ok(oldGap>.02,`old transformed contact error: ${oldGap}`);
for(const yaw of [0,.4,1.7,Math.PI])for(const sample of [()=>0,()=>10,(x,z)=>.3*x+.4*z,(x,z)=>-.45*z])for(const steering of [0,.32,-.32]){
 const wheels=DEFAULT_CONTACTS.map(w=>({...w,steer:{rotation:{y:steering}}}));
 const s=roverSupport(pos,yaw,sample,wheels);
 for(const dt of [0,1/60]){
  const p=sampledSuspensionPose(pos,yaw,sample,s.contacts,s.pitch,s.roll,10,dt);
  const error=Math.max(...gaps(pos,yaw,wheels,s.pitch,s.roll,p,sample).map(Math.abs));
  assert.ok(error<.0001,`transformed tyre gap ${error} yaw ${yaw}`);
 }
}
// Smooth small rock under one wheel, then a descent; contact is checked at the
// rendered tyre point, not at a value returned by the solver itself.
const rock=(x,z)=>.42*Math.exp(-((x-1.6)**2+(z-2.2)**2)/.8);
for(const yaw of [0,.12]){
 const s=roverSupport(pos,yaw,rock);
 const p=sampledSuspensionPose(pos,yaw,rock,s.contacts,s.pitch,s.roll,2,1/60);
 assert.ok(Math.max(...gaps(pos,yaw,s.contacts,s.pitch,s.roll,p,rock).map(Math.abs))<.001);
}
// A rock beyond suspension travel may lift other wheels: keep bounded travel and
// avoid inventing enough suspension to make every wheel touch impossible terrain.
const extreme=(x,z)=>x>0&&z>1?2:0;
const s=roverSupport(pos,0,extreme),p=sampledSuspensionPose(pos,0,extreme,s.contacts,s.pitch,s.roll,0,0);
assert.ok(Number.isFinite(p.y)); assert.ok(p.travel.every(t=>t>=-.65&&t<=.55));
// Load the actual Moon support method with stubs: collider dome must not float a
// tyre above a lower rendered triangle, and absent geometry must not invent rock.
let source=await readFile(new URL('../game/moon/src/moon-rover.js',import.meta.url),'utf8');
source=source.replace(/^import .*;\r?\n/gm,'');
globalThis.__roverContactTests={roverSupport,sampledSuspensionPose};
const {MoonRover}=await import('data:text/javascript,'+encodeURIComponent('const {roverSupport,sampledSuspensionPose}=globalThis.__roverContactTests;const heightAt=()=>0;const THREE={Vector3:class {constructor(x,y,z){Object.assign(this,{x,y,z});}}};\n'+source));
console.log(`Reproduced ${(oldGap*100).toFixed(1)}cm old contact error; transformed slopes, steering, rocks, descent, travel bounds passed.`);

// Exercise both production placement methods (no WebGL needed).
let marsSource=await readFile(new URL('../game/src/rover.js',import.meta.url),'utf8');
marsSource=marsSource.replace(/^import .*;\r?\n/gm,'');
const {Rover}=await import('data:text/javascript,'+encodeURIComponent('const {roverSupport,sampledSuspensionPose}=globalThis.__roverContactTests;const ROVER_MOTION={};\n'+marsSource));
delete globalThis.__roverContactTests;
function rotation(){return {x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};}
for(const Class of [Rover,MoonRover]){
 const rover=Object.create(Class.prototype);
 rover.pos={x:0,y:4,z:0};rover.yaw=.7;rover.r=.4;rover.steer=.2;
 rover.wheels=DEFAULT_CONTACTS.map(w=>({...w,steers:1,steer:{rotation:rotation(),position:{y:.4}},spin:{rotation:rotation()}}));
 rover.body={rotation:rotation(),position:{y:0}};
 rover.group={position:{copy(v){Object.assign(this,v);}},rotation:rotation()};
 rover.tilt={pitch:0,roll:0,y:4};rover.surfaceAt=slope;rover.support=slope;
 rover.dust={update(){}};rover.air=false;
 rover.place(0);
 const pose={y:rover.pos.y,travel:rover.wheels.map(w=>w.steer.position.y-.4)};
 assert.ok(Math.max(...gaps(rover.pos,rover.yaw,rover.wheels,rover.body.rotation.x,rover.body.rotation.z,pose,slope).map(Math.abs))<.0001,Class.name+' placement');
 if(Class===MoonRover){
  rover.air=true;rover.pos.y=7;rover.place(1/60);
  assert.equal(rover.pos.y,7,'airborne lunar rover must not snap to terrain');
 }
}
console.log('Production Mars and Moon placement paths and lunar airborne preservation passed.');
