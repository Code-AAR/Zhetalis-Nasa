import * as THREE from 'three';
// Interior-specific geometry; NASA's exterior mesh has opaque windows and no usable cabin.
export function roverCockpit(){
 const g=new THREE.Group();g.visible=false;
 const shell=new THREE.MeshStandardMaterial({color:'#ccd1cd',emissive:'#182125',roughness:.7,side:THREE.DoubleSide});
 const trim=new THREE.MeshStandardMaterial({color:'#26333a',emissive:'#101619',roughness:.6});
 const box=(w,h,d,x,y,z,mat=shell)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
 box(3.1,.16,3.8,0,.95,.7);box(3.1,.12,3.8,0,3.35,.7);
 // Solid rear bulkhead and sealed suitport covers close the pressurized cabin.
 const rear=box(3.1,2.4,.18,0,2.15,-1.2);rear.name='Sealed rear bulkhead';
 for(const x of[-.75,.75]){box(.98,1.85,.06,x,2.1,-1.08,trim);box(.85,1.7,.07,x,2.1,-1.03);box(.06,.32,.08,x+.27,2,-.96,trim);}
 for(const x of[-1.48,1.48]){box(.12,2.35,3.8,x,2.12,.7);box(.11,1.4,.12,x*.9,2.6,2.6,trim);}
 box(2.8,.14,.18,0,3.25,2.6,trim);box(2.8,.35,.65,0,1.55,2.35,trim);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.68,1.48),new THREE.MeshBasicMaterial({color:'#84b6b6',transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));glass.name='Tinted windshield';glass.position.set(0,2.43,2.62);g.add(glass);
 const screen=box(.65,.23,.025,0,1.79,2.13,new THREE.MeshBasicMaterial({color:'#123c43'}));screen.rotation.x=-.25;
 for(const x of[-.8,.8]){box(.65,.18,.7,x,1.25,.7,trim);box(.65,.9,.16,x,1.75,.3,trim);}
 const wheel=new THREE.Mesh(new THREE.TorusGeometry(.24,.026,12,40),trim);wheel.position.set(0,1.7,1.95);g.add(wheel);
 return g;
}
