// Procedural material detail, inspired by rover views; not measured topography.
import * as THREE from 'three';
import { effectiveQuality } from './device-profile.js';
let saved; try { saved = localStorage.getItem('mars-graphics'); } catch {}
const requested = new URLSearchParams(location.search).get('graphics') || saved;
export const GRAPHICS_MODE = ['high','balanced','low'].includes(requested) ? requested : 'auto';
const choice = effectiveQuality(GRAPHICS_MODE);
let range;try{range=localStorage.getItem('mission-world-limit');}catch{}
const requestedRange=new URLSearchParams(location.search).get('chunks')||range||'map';
export const WORLD_LIMIT=['1','2','3'].includes(requestedRange)?Number(requestedRange):'map';
export const WORLD_RADIUS=typeof WORLD_LIMIT==='number'?WORLD_LIMIT:2;
const constrained = matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
export const SURFACE_DETAIL = choice === 'low' ? { segments: 256, texture: 256, dust: 180 } : choice === 'high' ? { segments: 640, texture: 2048, dust: 1000 } : choice === 'balanced' || constrained ? { segments: 384, texture: 512, dust: 420 } : { segments: 512, texture: 1024, dust: 720 };
let maps;
export function regolithMaps() {
  if (maps) return maps;
  const n = SURFACE_DETAIL.texture, colour = document.createElement('canvas'), relief = document.createElement('canvas');
  colour.width = colour.height = relief.width = relief.height = n;
  const c = colour.getContext('2d'), h = relief.getContext('2d'), ci = c.createImageData(n,n), hi = h.createImageData(n,n);
  let seed = 73; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // Periodic ripples avoid visible seams; patchiness keeps them from looking ploughed.
  for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
    const u=x/n*Math.PI*2,v=y/n*Math.PI*2;
    const patch=Math.pow(Math.max(0,.4+.25*Math.sin(u+Math.sin(v*2))+.3*Math.cos(v*2+Math.sin(u*3))),3);
    const crest=Math.pow(.5+.5*Math.sin(v*18+Math.sin(u*2)*1.6+Math.sin(v*3)*.45),5)*patch;
    const grain=random(), pebble=grain>.994?random()*50:0;
    const mottling=Math.sin(u*11+Math.sin(v*7))*Math.cos(v*13+Math.sin(u*5));
    const grit=Math.sin(u*127+Math.sin(v*61))*Math.cos(v*113+Math.sin(u*79));
    const shade=205+grain*25+mottling*4+grit*2-crest*24-pebble;
    const height=95+grain*35+grit*4+crest*85+pebble;
    const i=(y*n+x)*4;
    ci.data.set([shade,shade*.985,shade*.96,255],i); hi.data.set([height,height,height,255],i);
  }
  c.putImageData(ci,0,0);h.putImageData(hi,0,0);
  // Larger clustered grit survives mipmapping at normal walking-camera distance.
  // Wrap each grain across texture edges to keep the repeated ground seamless.
  const scale=n/2048;
  for(let i=0;i<18000;i++) {
    const x=random()*n,y=random()*n,r=(.7+random()*2.3)*scale;
    const dark=random()<.7;
    c.fillStyle=dark?'rgba(79,68,55,.25)':'rgba(249,236,212,.25)';
    h.fillStyle=dark?'rgba(50,50,50,.3)':'rgba(210,210,210,.35)';
    for(const dx of [-n,0,n])for(const dy of [-n,0,n]){
      if(x+dx+r<0||x+dx-r>n||y+dy+r<0||y+dy-r>n)continue;
      for(const ctx of [c,h]){ctx.beginPath();ctx.ellipse(x+dx,y+dy,r,r*.65,0,0,Math.PI*2);ctx.fill();}
    }
  }
  const map = new THREE.CanvasTexture(colour), bump = new THREE.CanvasTexture(relief);
  for(const t of [map,bump]) {t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(72,72);t.anisotropy=8;}
  map.colorSpace=THREE.SRGBColorSpace;
  return maps={map,bump};
}
export function rockMaterial() {
  const bump=regolithMaps().bump.clone(); bump.repeat.set(2,2); bump.needsUpdate=true;
  return new THREE.MeshStandardMaterial({roughness:.94,metalness:0,flatShading:true,bumpMap:bump,bumpScale:.025});
}

// Low, wind-driven dust stays attached to local ground instead of sparkling in the sky.
export function makeGroundDust(heightAt) {
  const n= SURFACE_DETAIL.dust > 420 ? 96 : 48, data=new Float32Array(n*3);
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.BufferAttribute(data,3));
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');g.translate(64,64);g.scale(1,.24);
  const a=g.createRadialGradient(0,0,0,0,0,64);a.addColorStop(0,'rgba(255,255,255,.45)');a.addColorStop(.45,'rgba(255,255,255,.18)');a.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=a;g.fillRect(-64,-64,128,128);
  const material=new THREE.PointsMaterial({map:new THREE.CanvasTexture(c),color:'#b49a7a',size:1.6,opacity:.12,transparent:true,depthWrite:false,fog:true});
  const points=new THREE.Points(geometry,material);points.name='Ground dust';points.frustumCulled=false;
  points.userData.update=(cam,t,storm,night)=>{
    material.opacity=(storm?.26:.07)*(1-night*.85);material.size=storm?2.4:1.4;
    for(let i=0;i<n;i++) {
      const x=cam.x+((i*39.713+t*(storm?4:1.1)-cam.x)%100+100)%100-50;
      const z=cam.z+((i*23.371+t*.21-cam.z)%100+100)%100-50;
      data[i*3]=x;data[i*3+1]=heightAt(x,z)+.25+(i%4)*.14;data[i*3+2]=z;
    }
    geometry.attributes.position.needsUpdate=true;
  };
  return points;
}
