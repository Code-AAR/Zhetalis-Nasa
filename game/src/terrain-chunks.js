import * as THREE from 'three';
import { chunkPlan, CHUNK_SIZE, CHUNK_COUNT, MINIMAP_SPAN, WORLD_EXTENT, WORLD_HALF } from './chunk-plan.js';
import { SURFACE_DETAIL, WORLD_RADIUS, WORLD_LIMIT, regolithMaps } from './surface-detail.js';

export function makeTerrainChunks(heightAt,colourAt) {
  const group=new THREE.Group();group.name='Streamed Mars terrain';
  const maps=regolithMaps();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,map:maps.map,bumpMap:maps.bump,bumpScale:.065});
  // Close-up grit: sample the same ground maps a second time at about 7 times finer scale, for colour and for the bumps, so
  // the ground looks rough under your boots and not only from afar. (Three.js draws the bump from one sample; we add a second.)
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment
        .replace(/texture2D\( bumpMap, ([^)]*?) \)\.x/g,(all,uv)=>`(texture2D( bumpMap, ${uv} ).x + .45 * texture2D( bumpMap, ( ${uv} ) * 7.3 + vec2( .27, .61 ) ).x)`))
      .replace('#include <map_fragment>',`#include <map_fragment>
      { float grit = texture2D( map, vMapUv * 7.3 + vec2( .27, .61 ) ).r; diffuseColor.rgb *= 1.0 + ( grit - .66 ) * 1.8; }`);
  };
  material.customProgramCacheKey=()=>'terrain-grit-1';
  group.material=material; // shared material also supports team ground artwork
  const coarse=new Map(), loaded=new Map();let queue=[],last='';
  const segments=Math.ceil(SURFACE_DETAIL.segments/10);
  function tile(ix,iz,n) {
    const geo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,n,n);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,norm=geo.attributes.normal,colour=new Float32Array(pos.count*3),c=new THREE.Color(),normal=new THREE.Vector3();
    const cx=-WORLD_HALF+(ix+.5)*CHUNK_SIZE,cz=-WORLD_HALF+(iz+.5)*CHUNK_SIZE;
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i)+cx,z=pos.getZ(i)+cz,y=heightAt(x,z);pos.setXYZ(i,x,y,z);
      uv.setXY(i,(x+WORLD_HALF)/WORLD_EXTENT,(WORLD_HALF-z)/WORLD_EXTENT);
      normal.set(heightAt(x-.25,z)-heightAt(x+.25,z),.5,heightAt(x,z-.25)-heightAt(x,z+.25)).normalize();norm.setXYZ(i,normal.x,normal.y,normal.z);
      colourAt(x,z,y,c);colour.set([c.r,c.g,c.b],i*3);
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colour,3));
    // Vertical edge skirts conceal gaps where coarse and detailed samples meet.
    const edge=[];
    for(let i=0;i<=n;i++)edge.push(i);
    for(let i=1;i<=n;i++)edge.push(i*(n+1)+n);
    for(let i=n-1;i>=0;i--)edge.push(n*(n+1)+i);
    for(let i=n-1;i>0;i--)edge.push(i*(n+1));
    const p=Array.from(pos.array),u=Array.from(uv.array),no=Array.from(norm.array),co=Array.from(colour),indices=Array.from(geo.index.array);
    const start=pos.count;
    for(const id of edge){p.push(pos.getX(id),pos.getY(id)-12,pos.getZ(id));u.push(uv.getX(id),uv.getY(id));no.push(norm.getX(id),norm.getY(id),norm.getZ(id));co.push(colour[id*3],colour[id*3+1],colour[id*3+2]);}
    for(let i=0;i<edge.length;i++){const j=(i+1)%edge.length;indices.push(edge[i],start+i,edge[j],edge[j],start+i,start+j);}
    geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.setAttribute('normal',new THREE.Float32BufferAttribute(no,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(co,3));geo.setIndex(indices);geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;mesh.name=`Terrain ${ix},${iz} (${n})`;return mesh;
  }
  // Preserve the hill silhouette on Full; only phone Lite uses the coarse horizon.
  const horizonSegments=SURFACE_DETAIL.texture>=1024?24:4;
  for(let z=0;z<CHUNK_COUNT;z++)for(let x=0;x<CHUNK_COUNT;x++){const mesh=tile(x,z,horizonSegments);coarse.set(`${x},${z}`,mesh);group.add(mesh);}
  group.userData.hasDetail=(x,z)=>loaded.has(`${Math.floor((x+WORLD_HALF)/CHUNK_SIZE)},${Math.floor((z+WORLD_HALF)/CHUNK_SIZE)}`);
  group.userData.revision=0;
  group.userData.stats={loaded:0,queued:0,limit:WORLD_LIMIT==='map'?36:(WORLD_RADIUS*2+1)**2,segments};
  group.userData.update=(focus)=>{
    const plan=chunkPlan(focus.x,focus.z,WORLD_LIMIT),signature=plan.map(c=>c.key).join(';');
    if(signature!==last){
      last=signature;const wanted=new Set(plan.map(c=>c.key));
      for(const [key,mesh] of loaded)if(!wanted.has(key)){group.remove(mesh);mesh.geometry.dispose();loaded.delete(key);coarse.get(key).visible=true;group.userData.revision++;}
      queue=plan.filter(c=>!loaded.has(c.key));
    }
    // At most one allocation per frame: never generate an entire ring in one hitch.
    const next=queue.shift();if(next){const mesh=tile(next.x,next.z,segments);loaded.set(next.key,mesh);group.add(mesh);coarse.get(next.key).visible=false;group.userData.revision++;}
    Object.assign(group.userData.stats,{loaded:loaded.size,queued:queue.length});
  };
  group.userData.dispose=()=>{for(const m of [...coarse.values(),...loaded.values()])m.geometry.dispose();material.dispose();group.clear();};
  return group;
}

// Keep the original collision mesh untouched, and submit only nearby rock instances.
export function nearbyRocks(source,terrain) {
  const render=new THREE.InstancedMesh(source.geometry,source.material,source.count);
  render.count=0;render.castShadow=render.receiveShadow=true;render.name='Nearby rocks';render.frustumCulled=false;
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),colour=new THREE.Color();let last='';
  render.userData.update=focus=>{
    const key=`${Math.floor(focus.x/16)},${Math.floor(focus.z/16)},${source.instanceMatrix.version},${terrain.userData.revision}`;if(key===last)return;last=key;
    let count=0;const radius=WORLD_LIMIT==='map'?MINIMAP_SPAN/2:(WORLD_RADIUS+1)*CHUNK_SIZE+24;
    for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if(!terrain.userData.hasDetail(point.x,point.z) || point.y < -1000 || Math.hypot(point.x-focus.x,point.z-focus.z)>radius)continue;render.setMatrixAt(count,matrix);source.getColorAt(i,colour);render.setColorAt(count,colour);count++;}
    render.count=count;render.instanceMatrix.needsUpdate=true;if(render.instanceColor)render.instanceColor.needsUpdate=true;
  };
  return render;
}
