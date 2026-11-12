import * as THREE from 'three';
import { loadModel } from './nasamodels.js';
import { buildStarshipModel } from './starship-model.js';
import { loadNasaOrion, disposeNasaOrion } from '../moon/src/orion-model.js';

// Reusable illustrated 3D stage. Imported models are cloned, never moved out of
// the running game. Every scene has a readable procedural fallback while loading.
const earthDiameter=12756, moonRatio=3475/earthDiameter, marsRatio=6792/earthDiameter;
const diagrams=new Set(['overview','transfer','moon','mars','signal']);

export class JourneyVisual {
  constructor(canvas){
    this.canvas=canvas;this.alive=true;this.mode='overview';this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-5,5,3,-3,.1,150);this.camera.position.set(0,0,14);this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight('#dbeaff','#252336',2));const sun=new THREE.DirectionalLight('#fff0d6',3.5);sun.position.set(-4,5,6);this.scene.add(sun);
    const indicator=canvas.parentElement.querySelector('.art-progress');
    let settled=0;
    const assetSettled=()=>{
      const percent=++settled*25;
      if(!indicator)return;
      indicator.textContent=percent+'%';indicator.style.setProperty('--loaded',percent+'%');
      indicator.setAttribute('aria-valuenow',percent);
      if(percent===100)indicator.remove();
    };
    this.owned=[];this.textures=[];this.parts={};this.group=new THREE.Group();this.scene.add(this.group);
    const points=[];let seed=71;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<600;i++){const a=rand()*Math.PI*2,y=(rand()-.5)*35,r=18+rand()*15;points.push(Math.cos(a)*r,y,Math.sin(a)*r);}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const starMat=new THREE.PointsMaterial({color:'#cbd9ed',size:.035});this.scene.add(new THREE.Points(starGeo,starMat));this.owned.push(starGeo,starMat);
    for(const[key,map,color]of[['earth','earth-map.jpg','#4778a5'],['moon','moon-map.jpg','#b8b3a7'],['mars','mars-map.jpg','#bd784e']]){
      const geometry=new THREE.SphereGeometry(1,56,36),material=new THREE.MeshStandardMaterial({color,roughness:1});const globe=new THREE.Mesh(geometry,material);this.parts[key]=globe;this.group.add(globe);this.owned.push(geometry,material);
      const texture=new THREE.TextureLoader().load('assets/'+map,t=>{assetSettled();if(!this.alive){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;material.map=t;material.color.set('#ffffff');material.needsUpdate=true;},undefined,assetSettled);this.textures.push(texture);
    }
    this.parts.rocket=this.rocket();this.group.add(this.parts.rocket);
    this.parts.craft=this.craft();this.group.add(this.parts.craft);
    this.parts.orion=new THREE.Group();this.group.add(this.parts.orion);
    this.parts.lander=this.lander('mars');this.group.add(this.parts.lander);
    this.parts.lunarLander=this.lander('hls');this.group.add(this.parts.lunarLander);
    this.parts.ground=new THREE.Group();const soil=new THREE.Mesh(new THREE.CircleGeometry(6,48),this.material('#905238'));soil.rotation.x=-Math.PI/2;soil.position.y=-1.4;this.parts.ground.add(soil);
    for(let i=0;i<28;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+rand()*.25),this.material(i%2?'#683b2c':'#aa6d47'));rock.position.set((rand()-.5)*9,-1.3,(rand()-.5)*6);rock.scale.y=.5;this.parts.ground.add(rock);}this.group.add(this.parts.ground);
    this.parts.heat=new THREE.Group();for(let i=0;i<12;i++){const streak=new THREE.Mesh(new THREE.ConeGeometry(.06,.8+i%3*.15,8),this.material(i%2?'#ff8d45':'#ffd48a',{emissive:'#ed5c25',emissiveIntensity:1}));streak.position.set(Math.sin(i)*.5,-.3-Math.abs(Math.cos(i))*.3,Math.cos(i)*.3);this.parts.heat.add(streak);}this.group.add(this.parts.heat);
    this.route=new THREE.Group();this.group.add(this.route);
    for(const args of [['sls.glb','rocket',3.7]])this.installModel(...args).then(assetSettled,assetSettled);
    this.pointer=null;this.dragStart=e=>{this.pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);};this.dragMove=e=>{if(this.pointer?.id===e.pointerId){const yaw=this.group.rotation.y+(e.clientX-this.pointer.x)*.006;
      this.group.rotation.y=diagrams.has(this.mode)?THREE.MathUtils.clamp(yaw,-.62,.62):yaw;this.pointer.x=e.clientX;}};this.dragEnd=()=>{this.pointer=null;};
    canvas.addEventListener('pointerdown',this.dragStart);canvas.addEventListener('pointermove',this.dragMove);canvas.addEventListener('pointerup',this.dragEnd);canvas.addEventListener('pointercancel',this.dragEnd);canvas.style.touchAction='pan-y';
    this.setMode('overview');this.previous=performance.now();const tick=now=>{if(!this.alive)return;const dt=Math.min(.05,(now-this.previous)/1000);this.previous=now;this.resize();if(!document.hidden){if(!this.reduced.matches){this.parts.earth.rotation.y+=dt*.08;this.parts.mars.rotation.y+=dt*.06;if(this.mode==='cruise'&&!this.pointer)this.parts.craft.rotation.y+=dt*.08;}this.renderer.render(this.scene,this.camera);}this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);
  }
  material(color,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.15,...extra});this.owned.push(m);return m;}
  rocket(){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.19,.22,2.8,24),this.material('#e9e2d4'));g.add(body);const nose=new THREE.Mesh(new THREE.ConeGeometry(.2,.6,24),this.material('#d8d8d3'));nose.position.y=1.7;g.add(nose);for(const x of[-.34,.34]){const booster=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,2.3,16),this.material('#edece7'));booster.position.set(x,-.15,0);g.add(booster);}return g;}
  craft(){
    const g=new THREE.Group(),hull=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,1.7,32),this.material('#e1d9c9'));hull.rotation.z=Math.PI/2;g.add(hull);
    for(const x of[-.7,-.2,.3,.75]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.385,.025,8,32),this.material('#73818a'));ring.rotation.y=Math.PI/2;ring.position.x=x;g.add(ring);}
    for(const z of[-1.05,1.05]){
      const boom=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,1.6),this.material('#bfc8c9'));boom.position.z=z*.5;g.add(boom);
      const panel=new THREE.Mesh(new THREE.BoxGeometry(1.8,.04,.8),this.material('#173d61',{metalness:.5}));panel.position.z=z;g.add(panel);
      for(let i=0;i<6;i++){const seam=new THREE.Mesh(new THREE.BoxGeometry(.015,.047,.8),this.material('#6d95b0'));seam.position.set(-.75+i*.3,0,z);g.add(seam);}
    }
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.34,.5,24),this.material('#deded7'));cone.rotation.z=-Math.PI/2;cone.position.x=1.05;g.add(cone);
    const engine=new THREE.Mesh(new THREE.CylinderGeometry(.13,.23,.35,24,1,true),this.material('#545d62',{side:THREE.DoubleSide}));engine.rotation.z=Math.PI/2;engine.position.x=-1;g.add(engine);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.32,12),this.material('#a7afb1'));mast.position.set(.3,.47,0);g.add(mast);
    const profile=[0,.07,.14,.21,.27].map(r=>new THREE.Vector2(r,r*r*1.2));
    const dish=new THREE.Mesh(new THREE.LatheGeometry(profile,32),this.material('#c5cacc',{side:THREE.DoubleSide}));
    dish.position.set(.3,.62,0);dish.rotation.z=-.38;g.add(dish);
    return g;
  }
  lander(variant){
    const model=buildStarshipModel({variant,height:1.8,baseY:-.9});
    const materials=new Set();model.traverse(o=>{for(const m of [].concat(o.material||[]))materials.add(m);});
    this.owned.push(...materials);return model;
  }
  async installModel(file,key,height){const loaded=await loadModel(file);if(!this.alive||!loaded)return;const model=loaded.scene.clone(true),before=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());if(key==='rocket'){if(before.z>before.y&&before.z>before.x)model.rotation.x=-Math.PI/2;else if(before.x>before.y)model.rotation.z=Math.PI/2;}model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),scale=height/size.y;model.scale.multiplyScalar(scale);const center=box.getCenter(new THREE.Vector3()).multiplyScalar(scale);model.position.sub(center);this.parts[key].traverse(o=>{if(o.isMesh&&!o.userData.sharedAsset)o.geometry.dispose();});model.traverse(o=>{o.userData.sharedAsset=true;});this.parts[key].clear();this.parts[key].add(model);}
  ensureOrion(){
    if(this.orionPending)return;
    this.orionAbort=new AbortController();
    this.orionPending=loadNasaOrion(this.renderer,{signal:this.orionAbort.signal}).then(model=>{
      if(!this.alive){disposeNasaOrion(model);return;}
      model.rotation.z=-Math.PI/2;model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
      const scale=2.8/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(scale));
      model.traverse(o=>{o.userData.sharedAsset=true;});this.orionModel=model;this.parts.orion.add(model);
      this.canvas.dataset.orion='ready';if(this.mode==='moon')this.setMode('moon');
    }).catch(()=>{if(this.alive){this.canvas.dataset.orion='unavailable';this.orionPending=null;}});
  }
  setMode(mode){this.mode=mode;this.group.rotation.set(0,0,0);for(const part of Object.values(this.parts)){part.visible=false;part.scale.setScalar(1);part.rotation.set(0,0,0);}this.clearRoute();
    const show=(key,x,y,z=0,scale=1)=>{const p=this.parts[key];p.visible=true;p.position.set(x,y,z);p.scale.setScalar(scale);return p;};
    if(mode==='overview'||mode==='transfer'){
      const r=1.15;
      show('earth',-2.8,-.24,0,r);show('mars',3,.14,0,r*marsRatio);
      if(mode==='overview')show('moon',-1.28,1.04,0,r*moonRatio);
      const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.65,-.35,0),new THREE.Vector3(.35,mode==='transfer'?2.65:1.45,0),new THREE.Vector3(2.41,.34,0));
      this.drawTrajectory(curve,show,.49,.045);
    }
    if(mode==='launch')show('rocket',0,0,0,1.24);
    if(mode==='moon'||mode==='mars'){
      // Local orbital view: spacecraft share one orbital plane around a single body.
      const lunar=mode==='moon',radius=1.48;if(lunar)this.ensureOrion();
      show(lunar?'moon':'mars',0,0,0,radius);
      const orbit=new THREE.EllipseCurve(0,0,2.13,2.13,0,Math.PI*2);
      const position=t=>{const v=orbit.getPoint(t);return new THREE.Vector3(v.x,v.y*.44,v.y*.898).applyAxisAngle(new THREE.Vector3(0,0,1),.18);};
      const curve=new THREE.CatmullRomCurve3(Array.from({length:48},(_,i)=>position(i/48)),true);
      this.drawTrajectory(curve,show,.45,lunar?.30:.12,lunar&&this.orionModel?'orion':'craft');
      if(lunar){const lander=show('lunarLander',0,0,0,.28);lander.position.copy(position(.33));}
    }
    if(mode==='cruise'){const ship=show('craft',0,.05,0,1.55);ship.rotation.set(.26,-.40,-.08);}
    if(mode==='entry'){show('mars',1,-3,-2,3);const lander=show('lander',-.6,.6,0,.36);lander.rotation.z=-.45;show('heat',-.6,.42,0,.54);}
    if(mode==='descent'){show('ground',0,0,0);show('lander',0,.4,0,.8);show('heat',0,-.55,0,.65);}
    if(mode==='landing'){show('ground',0,0,0);show('lander',0,-.41,0,1.1);show('heat',0,-1.15,0,.6);}
    if(mode==='signal'){show('earth',-2.55,0,0,1.15);show('mars',2.75,0,0,1.15*marsRatio);this.line([new THREE.Vector3(-1.4,0,0),new THREE.Vector3(2.75-1.15*marsRatio,0,0)]);}
  }
  clearRoute(){for(const line of this.route.children){line.geometry.dispose();line.material.dispose();}this.route.clear();}
  drawTrajectory(curve,show,t,scale,key='craft'){
    this.line(curve.getPoints(112));
    const ship=show(key,0,0,0,scale);
    ship.position.copy(curve.getPoint(t));
    ship.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),curve.getTangent(t).normalize());
    ship.rotateX(.42);
  }
  line(points){
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=new THREE.LineBasicMaterial({color:'#c3ac82',transparent:true,opacity:.68});
    this.route.add(new THREE.Line(geometry,material));
  }
  resize(){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if(!w||!h||(this.width===w&&this.height===h))return;
    this.width=w;this.height=h;this.renderer.setSize(w,h,false);
    const aspect=w/h,halfHeight=Math.max(2.65,4.2/aspect);
    Object.assign(this.camera,{left:-halfHeight*aspect,right:halfHeight*aspect,top:halfHeight,bottom:-halfHeight});
    this.camera.updateProjectionMatrix();
  }
  dispose(){this.clearRoute();this.alive=false;this.orionAbort?.abort();disposeNasaOrion(this.orionModel);cancelAnimationFrame(this.frame);for(const[type,fn]of[['pointerdown',this.dragStart],['pointermove',this.dragMove],['pointerup',this.dragEnd],['pointercancel',this.dragEnd]])this.canvas.removeEventListener(type,fn);this.scene.traverse(o=>{if(o.isMesh&&!o.userData.sharedAsset)o.geometry.dispose();});this.textures.forEach(t=>t.dispose());this.owned.forEach(r=>r.dispose());this.renderer.dispose();this.renderer.forceContextLoss();}
}
