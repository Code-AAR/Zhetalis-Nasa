// Pure bounded residency planner; game state never lives in render chunks.
export const MINIMAP_SPAN = 240;
export const CHUNK_SIZE = 64, CHUNK_COUNT = 19;
export const WORLD_EXTENT = CHUNK_SIZE * CHUNK_COUNT, WORLD_HALF = WORLD_EXTENT / 2;   // 1216 m square, centred on the base
export function chunkPlan(x,z,radius=2) {
  if(radius==='map') {
    const result=[],r=MINIMAP_SPAN/2;
    for(let iz=0;iz<CHUNK_COUNT;iz++)for(let ix=0;ix<CHUNK_COUNT;ix++){
      const left=-WORLD_HALF+ix*CHUNK_SIZE,top=-WORLD_HALF+iz*CHUNK_SIZE;
      const dx=Math.max(left-x,0,x-left-64),dz=Math.max(top-z,0,z-top-64);
      if(dx*dx+dz*dz<=r*r)result.push({x:ix,z:iz,key:`${ix},${iz}`,distance:(left+32-x)**2+(top+32-z)**2});
    }
    return result.sort((a,b)=>a.distance-b.distance||a.z-b.z||a.x-b.x);
  }
  radius=Math.max(1,Math.min(3,Math.floor(Number(radius)||2)));
  const cell=v=>Math.max(0,Math.min(CHUNK_COUNT-1,Math.floor((v+WORLD_HALF)/CHUNK_SIZE)));
  const cx=cell(x),cz=cell(z),result=[];
  for(let iz=Math.max(0,cz-radius);iz<=Math.min(CHUNK_COUNT-1,cz+radius);iz++)
    for(let ix=Math.max(0,cx-radius);ix<=Math.min(CHUNK_COUNT-1,cx+radius);ix++) result.push({x:ix,z:iz,key:`${ix},${iz}`,distance:(ix-cx)**2+(iz-cz)**2});
  return result.sort((a,b)=>a.distance-b.distance||a.z-b.z||a.x-b.x);
}
