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
 const bases=contacts.map(w=>w.ground+tyreDrop-a*w.track-c*w.axle-b*radius);
 const lower=Math.max(...bases)-.55*b,upper=Math.min(...bases)+.65*b;
 const target=bases.reduce((n,v)=>n+v,0)/bases.length;
 let y=previousY+(target-previousY)*(dt?1-Math.exp(-dt*10):1);
 // Do not leave wheels hanging because the visual chassis interpolation lags a descent.
 y=lower<=upper?clamp(y,lower,upper):Math.max(lower,target);
 return {y,travel:bases.map(v=>clamp((v-y)/b,-.65,.55))};
}
