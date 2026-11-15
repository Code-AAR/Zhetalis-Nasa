// Kinematic suspension support; not a full rigid-body tyre simulation.
export const DEFAULT_CONTACTS=[-2.2,0,2.2].flatMap(axle=>[-1.6,1.6].map(track=>({axle,track})));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function roverSupport(pos,yaw,sample,wheels=DEFAULT_CONTACTS){
 if(!wheels.length)wheels=DEFAULT_CONTACTS;
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const contacts=wheels.map(w=>({...w,ground:sample(pos.x+s*w.axle+c*w.track,pos.z+c*w.axle-s*w.track)}));
 // Least-squares ground plane: y = base + forwardSlope*z + rightSlope*x.
 const mean=key=>contacts.reduce((n,w)=>n+w[key],0)/contacts.length;
 const f=mean('axle'),r=mean('track'),h=mean('ground');let ff=0,rr=0,fr=0,fh=0,rh=0;
 for(const w of contacts){const x=w.track-r,z=w.axle-f,y=w.ground-h;ff+=z*z;rr+=x*x;fr+=z*x;fh+=z*y;rh+=x*y;}
 const det=ff*rr-fr*fr,forward=det>1e-8?(fh*rr-rh*fr)/det:0,right=det>1e-8?(rh*ff-fh*fr)/det:0;
 const pitch=clamp(-Math.atan(forward),-.7,.7),roll=clamp(Math.atan(right*Math.cos(pitch)),-.7,.7);
 return {contacts,pitch,roll,height:h-forward*f-right*r};
}
export function suspensionPose(contacts,pitch,roll,previousY,dt,radius=.4){
 const a=Math.cos(pitch)*Math.sin(roll),b=Math.cos(pitch)*Math.cos(roll),c=-Math.sin(pitch);
 const tyreDrop=radius*Math.sqrt(b*b+c*c);
 const bases=contacts.map(w=>w.ground+(w.tyreDrop??tyreDrop)-a*w.track-c*w.axle-b*radius);
 const lower=Math.max(...bases)-.55*b,upper=Math.min(...bases)+.65*b;
 const target=bases.reduce((n,v)=>n+v,0)/bases.length;
 let y=previousY+(target-previousY)*(dt?1-Math.exp(-dt*10):1);
 // Do not leave wheels hanging because the visual chassis interpolation lags a descent.
 y=lower<=upper?clamp(y,lower,upper):Math.max(lower,target);
 return {y,travel:bases.map(v=>clamp((v-y)/b,-.65,.55))};
}

// Lowest point of the rendered circular tyre after XYZ body tilt, wheel steering,
// and parent yaw. Suspension moves along the tilted body's local Y, not world Y.
export function wheelContactPoint(pos,yaw,w,pitch,roll,travel,radius){
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
 const steer=w.steer?.rotation?.y??0,ss=Math.sin(steer),cs=Math.cos(steer);
 const rotate=(x,y,z)=>({x:cr*x-sr*y,y:cp*(sr*x+cr*y)-sp*z,z:sp*(sr*x+cr*y)+cp*z});
 const u=rotate(0,1,0),v=rotate(ss,0,cs),drop=radius*Math.hypot(u.y,v.y);
 const center=rotate(w.track,radius+travel,w.axle);
 const scale=drop>1e-9?radius*radius/drop:0;
 const x=center.x-scale*(u.y*u.x+v.y*v.x),z=center.z-scale*(u.y*u.z+v.y*v.z);
 return {x:pos.x+Math.cos(yaw)*x+Math.sin(yaw)*z,
   y:pos.y+center.y-drop,z:pos.z-Math.sin(yaw)*x+Math.cos(yaw)*z,tyreDrop:drop};
}
export function sampledSuspensionPose(pos,yaw,sample,contacts,pitch,roll,previousY,dt,radius=.4){
 let travel=contacts.map(()=>0),pose;
 // Fixed-point contact correction is bounded; ordinary flat ground exits in two
 // passes. Always interpolate from the original chassis height, not each iterate.
 for(let iteration=0;iteration<8;iteration++){
   const sampled=contacts.map((w,i)=>{
     const point=wheelContactPoint(pos,yaw,w,pitch,roll,travel[i],radius);
     return {...w,ground:sample(point.x,point.z),tyreDrop:point.tyreDrop};
   });
   pose=suspensionPose(sampled,pitch,roll,previousY,dt,radius);
   pose.contacts=sampled;
   const change=Math.max(...pose.travel.map((v,i)=>Math.abs(v-travel[i])));
   travel=pose.travel;
   if(change<1e-5)break;
 }
 return pose;
}
