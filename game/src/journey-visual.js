import * as THREE from 'three';
import { loadModel } from './nasamodels.js';

// Reusable illustrated 3D stage. Imported models are cloned, never moved out of
// the running game. Every scene has a readable procedural fallback while loading.
export class JourneyVisual {
  constructor(canvas){
    this.canvas=canvas;this.alive=true;this.mode='overview';this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.1,150);this.camera.position.set(0,1,11);this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight('#dbeaff','#252336',2));const sun=new THREE.DirectionalLight('#fff0d6',3.5);sun.position.set(-4,5,6);this.scene.add(sun);
    this.owned=[];this.textures=[];this.parts={};this.group=new THREE.Group();this.scene.add(this.group);
    const points=[];let seed=71;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    for(let i=0;i<600;i++){const a=rand()*Math.PI*2,y=(rand()-.5)*35,r=18+rand()*15;points.push(Math.cos(a)*r,y,Math.sin(a)*r);}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const starMat=new THREE.PointsMaterial({color:'#cbd9ed',size:.035});this.scene.add(new THREE.Points(starGeo,starMat));this.owned.push(starGeo,starMat);
    for(const[key,map,color]of[['earth','earth-map.jpg','#4778a5'],['moon','moon-map.jpg','#b8b3a7'],['mars','mars-map.jpg','#bd784e']]){
      const geometry=new THREE.SphereGeometry(1,56,36),material=new THREE.MeshStandardMaterial({color,roughness:1});const globe=new THREE.Mesh(geometry,material);this.parts[key]=globe;this.group.add(globe);this.owned.push(geometry,material);
      const texture=new THREE.TextureLoader().load('assets/'+map,t=>{if(!this.alive){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;material.map=t;material.color.set('#ffffff');material.needsUpdate=true;});this.textures.push(texture);
    }
    this.parts.rocket=this.rocket();this.group.add(this.parts.rocket);
    this.parts.craft=this.craft();this.group.add(this.parts.craft);
    this.parts.lander=this.lander();this.group.add(this.parts.lander);
    this.parts.ground=new THREE.Group();const soil=new THREE.Mesh(new THREE.CircleGeometry(6,48),this.material('#905238'));soil.rotation.x=-Math.PI/2;soil.position.y=-1.4;this.parts.ground.add(soil);
    for(let i=0;i<28;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+rand()*.25),this.material(i%2?'#683b2c':'#aa6d47'));rock.position.set((rand()-.5)*9,-1.3,(rand()-.5)*6);rock.scale.y=.5;this.parts.ground.add(rock);}this.group.add(this.parts.ground);
    this.parts.chute=new THREE.Group();const canopy=new THREE.Mesh(new THREE.SphereGeometry(1.5,32,16,0,Math.PI*2,0,Math.PI/2),this.material('#e5dbca',{side:THREE.DoubleSide}));this.parts.chute.add(canopy);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a)*1.5,0,Math.sin(a)*1.5),new THREE.Vector3(0,-2,0)]),m=new THREE.LineBasicMaterial({color:'#b3b6b4'});this.parts.chute.add(new THREE.Line(g,m));this.owned.push(g,m);}this.group.add(this.parts.chute);
    this.parts.heat=new THREE.Group();for(let i=0;i<12;i++){const streak=new THREE.Mesh(new THREE.ConeGeometry(.06,.8+i%3*.15,8),this.material(i%2?'#ff8d45':'#ffd48a',{emissive:'#ed5c25',emissiveIntensity:1}));streak.position.set(Math.sin(i)*.5,-.3-Math.abs(Math.cos(i))*.3,Math.cos(i)*.3);this.parts.heat.add(streak);}this.group.add(this.parts.heat);
    this.route=new THREE.Group();this.group.add(this.route);
    this.installModel('sls.glb','rocket',3.7);this.installModel('lander.glb','lander',1.8);
    this.pointer=null;this.dragStart=e=>{this.pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);};this.dragMove=e=>{if(this.pointer?.id===e.pointerId){this.group.rotation.y+=(e.clientX-this.pointer.x)*.006;this.pointer.x=e.clientX;}};this.dragEnd=()=>{this.pointer=null;};
    canvas.addEventListener('pointerdown',this.dragStart);canvas.addEventListener('pointermove',this.dragMove);canvas.addEventListener('pointerup',this.dragEnd);canvas.addEventListener('pointercancel',this.dragEnd);canvas.style.touchAction='pan-y';
    this.setMode('overview');this.previous=performance.now();const tick=now=>{if(!this.alive)return;const dt=Math.min(.05,(now-this.previous)/1000);this.previous=now;this.resize();if(!document.hidden){if(!this.reduced.matches){this.parts.earth.rotation.y+=dt*.08;this.parts.mars.rotation.y+=dt*.06;if(!this.pointer)this.parts.craft.rotation.y+=dt*.08;}this.renderer.render(this.scene,this.camera);}this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);
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
    const dish=new THREE.Mesh(new THREE.SphereGeometry(.24,20,12,0,Math.PI*2,0,.9),this.material('#b9c4cc'));dish.rotation.x=-Math.PI/2;dish.position.set(.3,.65,0);g.add(dish);
    return g;
  }
  lander(){const g=new THREE.Group(),cabin=new THREE.Mesh(new THREE.ConeGeometry(.5,.8,12),this.material('#ded8cb'));g.add(cabin);for(const x of[-.55,.55]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.65,.08),this.material('#737c81'));leg.position.set(x,-.45,0);leg.rotation.z=-Math.sign(x)*.35;g.add(leg);}return g;}
  async installModel(file,key,height){const loaded=await loadModel(file);if(!this.alive||!loaded)return;const model=loaded.scene.clone(true),before=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());if(key==='rocket'){if(before.z>before.y&&before.z>before.x)model.rotation.x=-Math.PI/2;else if(before.x>before.y)model.rotation.z=Math.PI/2;}model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),scale=height/size.y;model.scale.multiplyScalar(scale);const center=box.getCenter(new THREE.Vector3()).multiplyScalar(scale);model.position.sub(center);this.parts[key].traverse(o=>{if(o.isMesh&&!o.userData.sharedAsset)o.geometry.dispose();});model.traverse(o=>{o.userData.sharedAsset=true;});this.parts[key].clear();this.parts[key].add(model);}
  setMode(mode){this.mode=mode;this.group.rotation.set(0,0,0);for(const part of Object.values(this.parts)){part.visible=false;part.scale.setScalar(1);part.rotation.set(0,0,0);}this.route.clear();
    const show=(key,x,y,z=0,scale=1)=>{const p=this.parts[key];p.visible=true;p.position.set(x,y,z);p.scale.setScalar(scale);return p;};
    if(mode==='overview'){show('earth',-2.7,-.25,0,1.1);show('moon',-.3,.6,0,.3);show('mars',2.8,0,0,.65);show('craft',.7,-.8,0,.7);this.arc([[-2,.1,0],[-.4,1.7,0],[2.4,.35,0]]);}
    if(mode==='launch'){show('earth',-2,-2.7,-1,2.2);show('rocket',0,.05,0,1.1);show('moon',2.8,1.4,-1,.38);}
    if(mode==='moon'){show('moon',1,-.35,-1,1.65);show('earth',-3,1,-3,.65);show('craft',-1.15,.5,0,.7);show('lander',1.6,1.7,0,.6);this.arc([[-1.6,.1,0],[-.7,2.2,-.5],[2.7,1,0]]);}
    if(mode==='transfer'){show('earth',-2.7,-.6,0,.65);show('mars',2.7,.7,0,.5);show('craft',0,.65,0,.6);this.arc([[-2.6,-.5,0],[-.5,2,0],[2.6,.6,0]]);}
    if(mode==='cruise'){show('craft',0,0,0,1.6);show('earth',-3,1.2,-4,.4);show('mars',3,-.6,-3,.8);}
    if(mode==='mars'){show('mars',0,0,0,1.8);show('craft',2.4,.8,0,.5);this.arc([[-2.4,-.7,-1],[0,2.6,0],[2.4,.8,0]]);}
    if(mode==='entry'){show('mars',1,-3,-2,3);const lander=show('lander',-.6,.6,0,1);lander.rotation.z=-.45;show('heat',-.6,.1,0,1.5);}
    if(mode==='descent'){show('ground',0,0,0);show('lander',0,-.5,0,.8);show('chute',0,2.1,0,.9);}
    if(mode==='landing'){show('ground',0,0,0);show('lander',0,-.55,0,1.1);show('heat',0,-1.15,0,.6);}
    if(mode==='signal'){show('earth',-2.5,0,0,.9);show('mars',2.5,0,0,.65);this.arc([[-1.5,0,0],[0,.4,0],[1.7,0,0]]);}
  }
  arc(points){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),material=new THREE.LineBasicMaterial({color:'#eabf83'});this.route.add(new THREE.Line(geometry,material));this.owned.push(geometry,material);}
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.position.z=this.camera.aspect<1.25?15:11;this.camera.updateProjectionMatrix();}}
  dispose(){this.alive=false;cancelAnimationFrame(this.frame);for(const[type,fn]of[['pointerdown',this.dragStart],['pointermove',this.dragMove],['pointerup',this.dragEnd],['pointercancel',this.dragEnd]])this.canvas.removeEventListener(type,fn);this.scene.traverse(o=>{if(o.isMesh&&!o.userData.sharedAsset)o.geometry.dispose();});this.textures.forEach(t=>t.dispose());this.owned.forEach(r=>r.dispose());this.renderer.dispose();this.renderer.forceContextLoss();}
}
