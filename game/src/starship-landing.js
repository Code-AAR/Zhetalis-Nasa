import * as THREE from 'three';

// Geometry-only illustrative Starship landing. No image backdrop or sprites.
export class StarshipLandingVisual {
  constructor(canvas){
    this.canvas=canvas;this.alive=true;this.mode='entry';this.yaw=.45;this.elapsed=0;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a66c50');this.scene.fog=new THREE.Fog('#a66c50',30,100);
    this.camera=new THREE.PerspectiveCamera(42,1,.1,150);
    this.scene.add(new THREE.HemisphereLight('#ffe2ba','#553225',2));const sun=new THREE.DirectionalLight('#fff1cc',3);sun.position.set(-12,22,8);this.scene.add(sun);
    const terrain=new THREE.PlaneGeometry(160,160,110,110);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z),blend=THREE.MathUtils.smoothstep(r,4,18);pos.setY(i,blend*(1.4+1.3*Math.sin(x*.17)*Math.cos(z*.13)+.4*Math.sin(x*.7+z*.3)));}terrain.computeVertexNormals();
    this.scene.add(new THREE.Mesh(terrain,this.material('#a95f3c',{roughness:1})));
    let seed=12;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
    const rockGeo=new THREE.DodecahedronGeometry(1,1),rockMat=this.material('#6c3b2b',{roughness:1});const rocks=new THREE.InstancedMesh(rockGeo,rockMat,150),dummy=new THREE.Object3D();
    for(let i=0;i<150;i++){const angle=rand()*Math.PI*2,r=5+rand()*28,x=Math.cos(angle)*r,z=Math.sin(angle)*r,blend=THREE.MathUtils.smoothstep(r,4,18);dummy.position.set(x,blend*(1.4+1.3*Math.sin(x*.17)*Math.cos(z*.13)+.4*Math.sin(x*.7+z*.3)),z);dummy.scale.setScalar(.15+rand()*.65);dummy.scale.y*=.55;dummy.rotation.set(rand(),rand(),rand());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}this.scene.add(rocks);
    const ship=this.lander();ship.name='starship-concept';this.scene.add(ship);this.parts={lander:ship};
    this.flames=new THREE.Group();ship.add(this.flames);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,jet=new THREE.Mesh(new THREE.ConeGeometry(.055,1,20),new THREE.MeshBasicMaterial({color:i?'#8bcfff':'#ffe6a5',transparent:true,opacity:.8,depthWrite:false}));jet.rotation.z=Math.PI;jet.position.set(Math.cos(a)*.1,-1.35,Math.sin(a)*.1);this.flames.add(jet);}
    this.dust=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#bb8054',transparent:true,opacity:.18,depthWrite:false}),48);this.scene.add(this.dust);this.dummy=dummy;
    let drag;this.down=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId);};this.move=e=>{if(drag!==undefined){this.yaw+=(e.clientX-drag)*.008;drag=e.clientX;}};this.up=()=>drag=undefined;canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);canvas.style.touchAction='pan-y';
    const draw=()=>{if(!this.alive)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h&&(w!==this.width||h!==this.height)){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(draw);};this.updateFlight(0);draw();
  }
  material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.15,...extra});}
  setMode(mode){this.mode=mode;}
  updateFlight(t){
    this.elapsed=t;const ship=this.parts.lander,p=THREE.MathUtils.clamp((t-7)/17,0,1),entry=Math.min(1,t/7);
    if(t<7){ship.position.set(-8*(1-entry),14-9*entry,-4*(1-entry));ship.rotation.set(0,0,-1.15*(1-entry));}
    else{ship.position.set(.8*(1-p)**2,.965+4.035*(1-p)**2,0);ship.rotation.set(0,0,.08*(1-p));}
    this.flames.visible=t>=7&&p<1;this.dust.visible=t>=7&&p>.55&&p<1;
    this.flames.children.forEach((jet,i)=>{const length=(.35+.8*(1-p))*(1+.07*Math.sin(t*32+i));jet.scale.y=length;jet.position.y=-.86-length/2;});
    for(let i=0;i<48;i++){const phase=(t*.7+i/48)%1,a=i*2.399,r=.3+phase*3.8;this.dummy.position.set(ship.position.x+Math.cos(a)*r,.08+phase*.3,Math.sin(a)*r);this.dummy.scale.set(.08+phase*.5,.05+phase*.18,.08+phase*.5);this.dummy.updateMatrix();this.dust.setMatrixAt(i,this.dummy.matrix);}this.dust.instanceMatrix.needsUpdate=true;
    const distance=Math.max(6,4/Math.max(.35,this.camera.aspect)),look=ship.position.clone();look.y-=.2;this.camera.position.set(look.x+Math.sin(this.yaw)*distance,look.y+2.5,look.z+Math.cos(this.yaw)*distance);this.camera.lookAt(look);
  }
  dispose(){this.alive=false;cancelAnimationFrame(this.frame);for(const [event,fn]of[['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.up]])this.canvas.removeEventListener(event,fn);const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.forceContextLoss();}
  lander(){
    const ship=new THREE.Group();
    const silver=this.material('#b9c1c6',{metalness:.82,roughness:.32});
    const dark=this.material('#242b31',{metalness:.3,roughness:.7});
    const hull=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,1.22,40),silver);hull.position.y=-.12;ship.add(hull);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.22,.58,40),silver);nose.position.y=.78;ship.add(nose);
    const tiles=new THREE.Mesh(new THREE.CylinderGeometry(.223,.223,1.2,32,1,true,0,Math.PI),dark);tiles.position.y=-.12;ship.add(tiles);
    for(const side of [-1,1])for(const [y,w,h] of [[-.46,.25,.32],[.55,.16,.2]]){
      const flap=new THREE.Mesh(new THREE.BoxGeometry(w,h,.035),silver);flap.position.set(side*(.2+w/2),y,0);flap.rotation.z=-side*.18;ship.add(flap);
    }
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,engine=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.14,16,1,true),dark);engine.position.set(Math.cos(a)*.1,-.79,Math.sin(a)*.1);ship.add(engine);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.3,8),silver);leg.position.set(Math.cos(a)*.28,-.8,Math.sin(a)*.28);leg.rotation.z=-Math.cos(a)*.3;ship.add(leg);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.025,12),dark);foot.position.set(Math.cos(a)*.31,-.95,Math.sin(a)*.31);ship.add(foot);
    }
    return ship;
  }
}
