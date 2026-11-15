import * as THREE from 'three';

// In this supplied asset Object_13 batches cables with solar frames. The solar
// tables start at z=18.11 m; the service leads are entirely on the habitat side.
// Keep the panel faces intact and lay the leads close to the ground for crossing.
export function layServiceCables(model, scene, groundAt) {
  const source=model.getObjectByName('Object_13');
  if(!source)return null;
  const geometry=source.geometry, position=geometry.attributes.position,index=geometry.index;
  const keep=[],wire=[],v=new THREE.Vector3();
  const worldVertices=Array.from({length:position.count},(_,i)=>v.fromBufferAttribute(position,i).applyMatrix4(source.matrixWorld).clone());
  for(let i=0;i<(index?.count??position.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    if(ids.every(j=>worldVertices[j].z<18.1)){
      for(const j of ids){const p=worldVertices[j];wire.push(p.x,groundAt(p.x,p.z)+.045+Math.min(.2,Math.max(0,p.y)*.1),p.z);}
    }else keep.push(...ids);
  }
  source.geometry=geometry.clone();source.geometry.setIndex(keep);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,source.material);mesh.name='ground-service-cables';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  return mesh;
}

// A small spatial grid bounds the work per boot/wheel query. Smooth low humps
// let feet and the rover suspension rise over cable bundles without a hard snap.
export function cableCrossings(meshes, groundAt){
  const pitch=.25,cells=new Map(),v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],p=new THREE.Vector3();
  for(const mesh of meshes.filter(Boolean)){
    mesh.updateWorldMatrix(true,false);
    const pos=mesh.geometry.attributes.position,idx=mesh.geometry.index;
    for(let i=0;i<(idx?.count??pos.count);i+=3){
      v.forEach((p,j)=>p.fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      const [a,b,c]=v,n=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))/pitch*2));
      for(let j=0;j<=n;j++)for(let k=0;k<=n-j;k++){
        p.copy(a).multiplyScalar(1-(j+k)/n).addScaledVector(b,j/n).addScaledVector(c,k/n);
        const ground=groundAt(p.x,p.z);if(p.y<ground||p.y>ground+.35)continue;
        const x=Math.round(p.x/pitch),z=Math.round(p.z/pitch),key=x+','+z,old=cells.get(key);
        if(!old||p.y>old.top)cells.set(key,{x:p.x,z:p.z,top:p.y,mesh});
      }
    }
  }
  return {
    samples:[...cells.values()],
    height(x,z,ground){
      let result=ground;const cx=Math.round(x/pitch),cz=Math.round(z/pitch),radius=.55;
      for(let ix=cx-3;ix<=cx+3;ix++)for(let iz=cz-3;iz<=cz+3;iz++){
        const s=cells.get(ix+','+iz);if(!s||!s.mesh.visible)continue;
        const d=Math.hypot(x-s.x,z-s.z);if(d>=radius)continue;
        const weight=1-THREE.MathUtils.smoothstep(d,.12,radius);
        result=Math.max(result,ground+(s.top-ground)*weight);
      }
      return result;
    }
  };
}
