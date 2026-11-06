import * as THREE from 'three';

// Composite the real outside world behind transparent greenhouse glass or cabin
// window apertures. Both passes use the same camera orientation and time of day.
export function renderInteriorView(renderer, world, room, kind, dt) {
  const camera=room.exteriorCamera??=new THREE.PerspectiveCamera();
  camera.copy(room.camera);camera.far=1800;
  if(kind!=='capsule'){
    camera.position.add(world.settlement.greenhouse.position);
  }else{
    const lander=world.outpost.group.getObjectByName('lander');
    const anchor=lander.getWorldPosition(new THREE.Vector3());
    camera.position.applyQuaternion(lander.quaternion).add(anchor).add(new THREE.Vector3(0,7.8,0));
    camera.quaternion.premultiply(lander.quaternion);
  }
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const hidden=[world.player,world.viewSlot,kind!=='capsule'?world.settlement.greenhouse:world.outpost.group.getObjectByName('lander')];
  if(kind!=='capsule')hidden.push(world.settlement.glassTunnel);
  if(kind==='habitat')hidden.push(world.settlement.model);
  const visibility=hidden.map(o=>o.visible),originalCamera=world.camera,autoClear=renderer.autoClear;
  try{
    hidden.forEach(o=>o.visible=false);
    world.time+=dt;world.frameDt=dt;world.camera=camera;world.placeSky(camera.position);
    renderer.autoClear=false;renderer.clear();renderer.render(world.scene,camera);
    renderer.clearDepth();renderer.render(room.scene,room.camera);
  }finally{
    hidden.forEach((o,i)=>o.visible=visibility[i]);world.camera=originalCamera;renderer.autoClear=autoClear;
  }
}

// A conical pressure shell with genuine openings at the three cabin windows.
export function capsuleWindowShell(material) {
  const positions=[],indices=[],segments=256,rows=80,height=3.2;
  for(let j=0;j<=rows;j++){
    const y=j/rows*height,r=2.8-1.3*y/height;
    for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*r,y,Math.cos(a)*r);}
  }
  const angleDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){
    const y=(j+.5)/rows*height,a=(i+.5)/segments*Math.PI*2;
    const sideWindow=[-1.15,1.15].some(w=>angleDistance(a,w)<.1&&Math.abs(y-1.73)<.165);
    const hatchWindow=(angleDistance(a,0)/.09)**2+((y-1.25)/.19)**2<1;
    if(sideWindow||hatchWindow)continue;
    const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  material.side=THREE.DoubleSide;const shell=new THREE.Mesh(geometry,material);shell.name='cabin-window-shell';return shell;
}
