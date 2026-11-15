import assert from 'node:assert/strict';
import {roverSupport,suspensionPose,DEFAULT_CONTACTS} from '../game/src/rover-support.js';
function check(sample,yaw=0,previousY=0,dt=1/60){
 const support=roverSupport({x:0,z:0},yaw,sample);
 const pose=suspensionPose(support.contacts,support.pitch,support.roll,previousY,dt);
 const a=Math.cos(support.pitch)*Math.sin(support.roll),b=Math.cos(support.pitch)*Math.cos(support.roll),c=-Math.sin(support.pitch),drop=.4*Math.sqrt(b*b+c*c);
 support.contacts.forEach((w,i)=>{const bottom=pose.y+a*w.track+b*(.4+pose.travel[i])+c*w.axle-drop;assert.ok(Math.abs(bottom-w.ground)<1e-8,'Wheel contact must follow sampled terrain');});
 return {support,pose};
}
check(()=>0);check(()=>10,0,0,0);check(()=>0,0,10); // spawn and sharp descent cannot leave entire vehicle floating
for(const yaw of [0,.4,1.7,Math.PI]){
 check((x,z)=>.2*x+.3*z,yaw);
 check((x,z)=>-.3*z,yaw);
}
check((x,z)=>x<0&&z>1?.45:0); // one tyre climbs a small rock
const s=roverSupport({x:0,z:0},0,()=>2,[]);assert.equal(s.contacts.length,DEFAULT_CONTACTS.length);
let y=0;const support=roverSupport({x:0,z:0},0,()=>.1);
for(let i=0;i<120;i++)y=suspensionPose(support.contacts,0,0,y,1/60).y;
assert.ok(Math.abs(y-.1)<1e-8);
assert.ok(Math.abs(suspensionPose(support.contacts,0,0,y,1/60).y-y)<1e-8,'Parked height must converge without visible jitter');
console.log('Rover support: flat ground, sloped/rotated terrain, descent, single-wheel bump and parked stability passed.');

