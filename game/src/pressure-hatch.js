import * as THREE from 'three';

// Closed pressure hatch: solid geometry seals the bulkhead. Interaction cycles the
// airlock before the existing scene transition; it is not an open door to vacuum.
export function pressureHatch({ entry = false } = {}) {
  const g = new THREE.Group(); g.name = 'Pressure airlock hatch';
  const shell = new THREE.MeshStandardMaterial({color:'#c9cec9',roughness:.65,metalness:.2});
  const door = new THREE.MeshStandardMaterial({color:'#82969b',roughness:.5,metalness:.45});
  const steel = new THREE.MeshStandardMaterial({color:'#bac7c9',roughness:.3,metalness:.7});
  const seal = new THREE.MeshStandardMaterial({color:'#26353a',roughness:.9});
  const green = new THREE.MeshBasicMaterial({color:'#8fe6bf'});
  const add=(geometry,mat,x,y,z)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);g.add(m);return m;};
  // Full backing closes the old side gaps; inset bevels make the hatch readable at close range.
  if (!entry) add(new THREE.BoxGeometry(3.5,3.25,.16),shell,0,1.625,-.1);
  function panel(w,h,d,r,mat,z) {
    const s=new THREE.Shape(),x=-w/2,y=1.5-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:3,curveSegments:12});
    add(geo,mat,0,0,z);
  }
  if (entry) panel(2.85,3.25,.16,.38,shell,-.1);
  panel(2.4,2.92,.06,.22,seal,.01); panel(2.25,2.76,.08,.2,door,.09);
  // Inspection port is sealed glass, not an uncut hole or a flat image of outside.
  add(new THREE.CylinderGeometry(.31,.31,.07,48),steel,0,2.12,.24).rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.26,48),new THREE.MeshStandardMaterial({color:'#123f4d',roughness:.16,metalness:.65}),0,2.12,.285);
  add(new THREE.TorusGeometry(.27,.018,8,48),seal,0,2.12,.295);
  for(const x of[-.92,.92])for(const y of[.45,1.5,2.55]) {
    add(new THREE.BoxGeometry(.18,.25,.13),steel,x,y,.25);
    add(new THREE.CylinderGeometry(.035,.035,.035,12),seal,x,y,.33).rotation.x=Math.PI/2;
  }
  g.userData.handle=add(new THREE.BoxGeometry(.09,.4,.1),entry?green:steel,.7,1.28,.35);
  add(new THREE.BoxGeometry(.3,.07,.09),steel,.6,1.46,.39);
  add(new THREE.BoxGeometry(2.3,.075,.12),green,0,3.02,.15);
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle='#162c34';ctx.fillRect(0,0,c.width,c.height);ctx.textAlign='center';
  ctx.fillStyle='#e9f4ef';ctx.font='bold 66px system-ui';ctx.fillText(entry?'AIRLOCK · ENTER':'AIRLOCK · EXIT',512,86);
  ctx.fillStyle='#8fe6bf';ctx.font='48px system-ui';ctx.fillText(entry?'E / USE · GO INSIDE':'E / USE · GO OUTSIDE',512,170);
  ctx.fillStyle='#b9cdd2';ctx.font='30px system-ui';ctx.fillText('Pressure cycle handled automatically',512,222);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(1.7,.425),new THREE.MeshBasicMaterial({map:texture}),0,.68,.3);
  g.userData.sealed=true;return g;
}
