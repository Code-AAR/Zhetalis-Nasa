import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural educational concepts, NOT NASA/SpaceX engineering models or a claim
// about the latest flight design. Reference: NASA's 2024 HLS concept illustrations
// https://www.nasa.gov/humans-in-space/nasa-spacex-illustrate-key-moments-of-artemis-lunar-lander-mission/
// Preserve the lunar game's legacy coordinates; dimensions are gameplay choices.
export const STARSHIP_HLS = Object.freeze({radius:4.2,height:40,hatchY:29.5,legReach:7.2});
const FOOT_Y=-1.69, TIP_Y=44, SPAN=TIP_Y-FOOT_Y;

/** Identity root; +Y nose, +Z crew access. Solid bounds exclude plume/light.
 * Mars defaults: [-.965,1.065] Y, HLS defaults: [-1.69,44] Y.
 * userData.flaps = hinged Groups with side (+/-1), station ('forward'/'aft').
 * userData.setFlaps(angle) sets symmetric local-Y hinge rotation in radians.
 * Lift coordinates are canonical meters (unscaled HLS remains drop-in compatible).
 * All resources belong to this instance; callers may dispose by traversing it.
 */
export function buildStarshipModel({variant='mars',height=variant==='hls'?SPAN:2.03,baseY=variant==='hls'?FOOT_Y:-.965}={}){
 if(!['mars','hls'].includes(variant)||!Number.isFinite(height)||height<=0||!Number.isFinite(baseY))throw new RangeError('Invalid Starship model dimensions');
 const lunar=variant==='hls',R=STARSHIP_HLS.radius,scale=height/SPAN;
 const root=new THREE.Group(),hull=new THREE.Group();root.add(hull);
 root.name=lunar?'HLS-inspired lunar training concept':'Starship-inspired Mars landing concept';
 hull.scale.setScalar(scale);hull.position.y=baseY-FOOT_Y*scale;
 const material=(color,roughness,metalness,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
 const shell=material(lunar?'#eeefeb':'#bec6cb',lunar?.54:.34,lunar?.16:.72);
 const seam=material(lunar?'#9ba7ab':'#74858f',.48,.6),steel=material('#8d9aa3',.32,.78);
 const dark=material('#242b32',.68,.4),insulation=material('#c5a474',.55,.48);
 const glass=material('#142d42',.16,.65,{emissive:'#17334d',emissiveIntensity:.18});
 const tiles=material('#20252b',.91,.08),solar=material('#152f49',.35,.55);
 const tileBacking=material('#141b22',.95,.05),engineSteel=material('#71818d',.4,.7,{side:THREE.DoubleSide});
 const groups=new Map();
 // Batch all static details by material. Animated parts stay separate; no per-panel
 // draw calls or per-frame geometry rebuilds, and no asset downloads/DOM textures.
 function add(geo,mat,x=0,y=0,z=0,parent=null){
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;
  if(parent)parent.add(m);else{if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(m);}return m;
 }
 const box=(w,h,d,mat,x,y,z,parent)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
 const ring=(r,t,y,mat=seam)=>{const m=add(new THREE.TorusGeometry(r,t,6,72),mat,0,y);m.rotation.x=Math.PI/2;return m;};
 const rod=(a,b,r,mat=steel,parent)=>{const m=add(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),mat,0,0,0,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;};
 const radial=(geo,mat,a,y,r=R)=>{const m=add(geo,mat,Math.sin(a)*r,y,Math.cos(a)*r);m.rotation.y=a;return m;};
 add(new THREE.CylinderGeometry(R,R,32,96),shell,0,20);
 const profile=Array.from({length:33},(_,i)=>new THREE.Vector2(R*Math.cos(i/32*Math.PI/2)**.8,i/32*8));
 add(new THREE.LatheGeometry(profile,96),shell,0,36);
 add(new THREE.CylinderGeometry(R*.98,R*.9,4,72,1,true),dark,0,2);
 ring(R*.96,.1,.1,steel);ring(R,.07,4);ring(R,.045,36);
 // Weld courses, expansion joints and access panels follow the curved tank shell.
 for(let y=5;y<36;y+=1.45)ring(R+.012,.016,y);
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8;
  radial(new THREE.BoxGeometry(.018,30,.018),seam,a,20,R+.006);
  if(!lunar&&Math.cos(a)<0)continue;
  radial(new THREE.BoxGeometry(.6,.9,.06),seam,a,7.3,R+.02);
  radial(new THREE.BoxGeometry(.49,.78,.07),shell,a,7.3,R+.055);
  for(const dy of [-.33,.33])radial(new THREE.BoxGeometry(.09,.04,.09),dark,a,7.3+dy,R+.10);
 }
 // Engine bay: six distinct curved bells with throat collars and feed lines.
 const bells=new THREE.Group();bells.name='Engine bay';hull.add(bells);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,large=i%2===0,r=large?2.35:1.35,x=Math.sin(a)*r,z=Math.cos(a)*r;
  const bellProfile=[new THREE.Vector2(.27,.9),new THREE.Vector2(.30,.65),new THREE.Vector2(.42,.22),new THREE.Vector2(large?.78:.58,-.32),new THREE.Vector2(large?.91:.67,-.9)];
  add(new THREE.LatheGeometry(bellProfile.reverse(),32),engineSteel,x,0,z);
  const lip=add(new THREE.TorusGeometry(large?.91:.67,.045,6,32),dark,x,-.9,z);lip.rotation.x=Math.PI/2;
  add(new THREE.CylinderGeometry(.29,.29,.3,16),dark,x,.85,z);
  rod(new THREE.Vector3(x,.9,z),new THREE.Vector3(x*.6,2.8,z*.6),.075,insulation);
 }
 // Six triangulated landing legs, pivots, piston sleeves and padded circular shoes.
 const feet=[];
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3+Math.PI/6;
  const radialPoint=(r,y,da=0)=>new THREE.Vector3(Math.sin(a+da)*r,y,Math.cos(a+da)*r);
  const top=radialPoint(R*.95,6),foot=radialPoint(7.2,-1.6),knee=top.clone().lerp(foot,.58);
  rod(top,foot,.17,steel);rod(top,knee,.25,shell);
  rod(radialPoint(R,2,-.15),foot,.095,steel);rod(radialPoint(R,2,.15),foot,.095,steel);
  add(new THREE.SphereGeometry(.29,12,8),dark,top.x,top.y,top.z);
  add(new THREE.CylinderGeometry(.7,.8,.18,32),steel,foot.x,foot.y,foot.z);
  const shoe=add(new THREE.CylinderGeometry(.62,.67,.04,32),dark,foot.x,-1.67,foot.z);feet.push(foot.clone());
  for(const d of [-.3,.3])rod(new THREE.Vector3(foot.x+d,-1.5,foot.z-.42),new THREE.Vector3(foot.x+d,-1.5,foot.z+.42),.035,steel);
 }
 const flaps=[];
 let lift=null;
 if(lunar){
  // Solar blanket with individually delineated cell rows, batched into two meshes.
  add(new THREE.CylinderGeometry(R+.035,R+.035,3.2,96,1,true),dark,0,21);
  for(let row=0;row<7;row++)for(let col=0;col<72;col++){
   const a=(col+.5)*Math.PI/36;
   radial(new THREE.PlaneGeometry(.32,.39),solar,a,19.65+row*.45,R+.06);
  }
  ring(R+.05,.075,19.3,steel);ring(R+.05,.075,22.7,steel);
  // Raised crew-deck insulation panels and recessed, framed observation windows.
  for(let i=0;i<18;i++){
   const a=i*Math.PI/9;
   if(i!==0)radial(new THREE.BoxGeometry(.85,3.5,.035),shell,a,27.7,R+.025);
  }
  for(const a of [-.9,-.45,.45,.9,Math.PI]){
   radial(new THREE.BoxGeometry(1.07,.79,.13),steel,a,32,R+.015);
   radial(new THREE.BoxGeometry(.83,.54,.15),glass,a,32,R+.045);
   radial(new THREE.BoxGeometry(1.14,.10,.35),shell,a,32.46,R+.09);
  }
  // Hatch floor, access direction and elevator deck match the gameplay contract.
  box(1.85,2.5,.20,steel,0,30.6,R+.04);
  box(1.6,2.2,.23,shell,0,30.6,R+.07);
  box(.52,.32,.25,glass,0,31.12,R+.09);
  box(.12,.52,.32,dark,.58,30.35,R+.13);
  box(.32,.45,.18,dark,1.1,30.5,R+.1);
  for(const x of [-1.1,1.1]){
   box(.18,32,.18,steel,x,14.5,R+.4);
   box(.055,31.6,.07,dark,x,14.5,R+.52);
   for(let y=1;y<30;y+=3)box(.34,.12,.45,steel,x,y,R+.2);
  }
  lift=new THREE.Group();lift.name='Crew elevator';lift.position.set(0,29.5,R+1.25);hull.add(lift);
  box(2.4,.15,1.8,steel,0,0,0,lift);
  box(2.15,.025,1.55,dark,0,.09,0,lift);
  for(const x of [-1.15,1.15]){
   for(const z of [-.8,.8])rod(new THREE.Vector3(x,.1,z),new THREE.Vector3(x,1.12,z),.035,insulation,lift);
   for(const y of [.58,1.12])rod(new THREE.Vector3(x,y,-.8),new THREE.Vector3(x,y,.8),.035,insulation,lift);
  }
  // High-mounted landing engines are illustrative HLS reference features, not
  // a claim about the provider's current propulsion architecture.
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+Math.PI/4;
   radial(new THREE.BoxGeometry(1.1,2.4,.7),shell,a,25.5,R+.3);
   for(const da of [-.07,.07]){
    const x=Math.sin(a+da)*(R+.45),z=Math.cos(a+da)*(R+.45);
    add(new THREE.CylinderGeometry(.16,.29,.65,20,1,true),dark,x,24,z);
   }
   radial(new THREE.BoxGeometry(.8,.12,.8),steel,a,26.75,R+.3);
  }
  // Docking/service hardware stays below the legacy 44 m nose tip.
  ring(.64,.085,43.3,steel);add(new THREE.CylinderGeometry(.48,.48,.16,24),dark,0,43.34);
 }else{
  // Continuous dark substrate prevents bright steel showing through tile seams.
  add(new THREE.CylinderGeometry(R+.033,R+.033,32,96,1,true,Math.PI/2,Math.PI),tileBacking,0,20);
  const shieldProfile=profile.map((v,i)=>new THREE.Vector2(v.x+(i<32?.033:0),v.y));
  add(new THREE.LatheGeometry(shieldProfile,96,Math.PI/2,Math.PI),tileBacking,0,36);
  // Windward hex tile field, including the tapered nose. Instanced: one draw call.
  const transforms=[],dummy=new THREE.Object3D();
  for(let y=4.3,row=0;y<43.6;y+=.48,row++){
   const radius=y<=36?R:R*Math.cos((y-36)/8*Math.PI/2)**.8;
   const count=Math.max(3,Math.floor(Math.PI*radius/.45));
   for(let i=0;i<count;i++){
    const a=Math.PI/2+(i+.5+(row%2)*.15)*Math.PI/count;
    dummy.position.set(Math.sin(a)*(radius+.035),y,Math.cos(a)*(radius+.035));dummy.rotation.set(0,a,Math.PI/6);dummy.scale.setScalar(Math.min(1,radius));dummy.updateMatrix();transforms.push(dummy.matrix.clone());
   }
  }
  const shield=new THREE.InstancedMesh(new THREE.CircleGeometry(.265,6),tiles,transforms.length);
  transforms.forEach((m,i)=>shield.setMatrixAt(i,m));shield.name='Windward heat shield';shield.castShadow=shield.receiveShadow=true;shield.computeBoundingSphere();hull.add(shield);
  // Four swept aero surfaces with real hinge groups and tile-covered windward faces.
  for(const side of [-1,1])for(const station of ['aft','forward']){
   const forward=station==='forward',w=forward?2.45:3.6,h=forward?4.2:7.4;
   const pivot=new THREE.Group();pivot.name=station+' flap '+(side<0?'port':'starboard');pivot.position.set(side*(forward?3.65:R),forward?33:7,0);pivot.userData={side,station};hull.add(pivot);flaps.push(pivot);
   const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*w,h*.18);shape.lineTo(side*w*.8,h*.65);shape.lineTo(0,h);shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.05,bevelThickness:.035});
   add(geo,shell,0,0,-.08,pivot);
   add(new THREE.ShapeGeometry(shape),tiles,0,0,-.13,pivot).rotation.y=0;
   // Back face must be visible from windward side.
   pivot.children[1].material=tiles;tiles.side=THREE.DoubleSide;
   rod(new THREE.Vector3(0,.25,0),new THREE.Vector3(0,h-.25,0),.12,steel,pivot);
  }
  for(const a of [-.35,.35])radial(new THREE.BoxGeometry(.6,.8,.10),glass,a,32.3,R+.03);
 }
 for(const [mat,meshes] of groups){
  const geometries=meshes.map(m=>{m.updateMatrix();const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);m.geometry.dispose();return geo;});
  const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  if(!merged)throw new Error('Starship static geometry merge failed');
  const mesh=new THREE.Mesh(merged,mat);mesh.name='Static '+mat.color.getHexString();mesh.castShadow=mesh.receiveShadow=true;hull.add(mesh);
 }
 const glow=new THREE.MeshBasicMaterial({color:'#cfe4ff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 const plume=new THREE.Mesh(new THREE.ConeGeometry(4,9,32,1,true),glow);plume.position.y=-5;plume.rotation.x=Math.PI;plume.name='Engine plume';hull.add(plume);
 const engineLight=new THREE.PointLight('#d9e8ff',0,60*scale,1.6);engineLight.position.y=-3;hull.add(engineLight);
 const convert=y=>baseY+(y-FOOT_Y)*scale;
 Object.assign(root.userData,{variant,concept:true,label:root.name,lift,flaps,plume,engineLight,
  dimensions:{height,baseY,topY:baseY+height,centerY:baseY+height/2,radius:R*scale,legReach:7.2*scale,hatchY:convert(29.5),engineExitY:convert(-.9),canonicalScale:scale},
  feet:feet.map(p=>new THREE.Vector3(p.x*scale,convert(FOOT_Y),p.z*scale)),
  setFlaps(angle=0){const value=THREE.MathUtils.clamp(Number.isFinite(angle)?angle:0,-1.2,1.2);for(const flap of flaps)flap.rotation.y=flap.userData.side*value;}
 });
 return root;
}
